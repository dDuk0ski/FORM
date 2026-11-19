import logging
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query

from form_ml.energy import estimate_tdee
from form_ml.targets import daily_targets

import nutrition
from auth import get_current_user
from database import service_client, user_client

log = logging.getLogger(__name__)
router = APIRouter()

PAGE = 1000  # PostgREST returns at most this many rows per request

# Fixed values until the readiness, protein split and micronutrient models land.
STUB_READINESS = {"score": 71, "advice": "Normal session."}
STUB_PROTEIN_SPLIT = {"meals_logged": 3, "largest_meal_g": 52, "advice": "Aim for 40 g at dinner."}
STUB_MICRONUTRIENT_FLAGS = [{"nutrient": "magnesium", "pct_of_rda_7d": 55, "confidence": 0.8}]


def get_db(auth=Depends(get_current_user)):
    return user_client(auth["token"])


def get_service_db():
    return service_client()


def all_rows(make_query) -> list[dict]:
    """Every row of a query, a page at a time. make_query builds a fresh query per page."""
    rows: list[dict] = []
    while True:
        page = make_query().range(len(rows), len(rows) + PAGE - 1).execute().data or []
        rows.extend(page)
        if len(page) < PAGE:
            return rows


def number(value):
    return float(value) if value is not None else None


@router.get("/today")
def get_today(
    day: date | None = Query(default=None, alias="date"),
    auth=Depends(get_current_user),
    db=Depends(get_db),
    service=Depends(get_service_db),
):
    user_id = str(auth["user"].id)

    try:
        profile_rows = (
            db.table("profiles")
            .select("sex, birth_date, height_cm, activity_level, goal, timezone")
            .eq("id", user_id)
            .limit(1)
            .execute()
            .data
        )
        profile_row = profile_rows[0] if profile_rows else None

        local_today = nutrition.local_today(profile_row.get("timezone") if profile_row else None)
        today = day or local_today
        entries = all_rows(
            lambda: db.table("food_log_entries")
            .select("kcal, protein_g, carb_g, fat_g")
            .eq("user_id", user_id)
            .eq("local_date", today.isoformat())
            .order("logged_at")
        )
        target_rows = (
            db.table("targets")
            .select("*")
            .eq("user_id", user_id)
            .lte("effective_date", today.isoformat())
            .order("effective_date", desc=True)
            .limit(1)
            .execute()
            .data
        )
    except Exception:
        log.exception("GET /today: database read failed")
        raise HTTPException(status_code=502, detail="Unable to retrieve today's data")

    target = target_rows[0] if target_rows else None
    latest = nutrition.to_date(target["effective_date"]) if target else None

    # Targets are only (re)computed for the user's real today, never for a past date.
    if today == local_today and nutrition.needs_recalc(latest, today):
        try:
            target = recompute_targets(db, service, user_id, profile_row, today)
        except HTTPException as error:
            # An incomplete profile only blocks a user who has no targets at all.
            if not (error.status_code == 422 and target is not None):
                raise

    consumed, log_quality = nutrition.consumed_today(entries)

    if target:
        targets = {
            "kcal": number(target.get("kcal")),
            "protein_g": number(target.get("protein_g")),
            "carb_g": number(target.get("carb_g")),
            "fat_g": number(target.get("fat_g")),
        }
        remaining = {
            name: round(targets[name] - consumed[name], 1) if targets[name] is not None else None
            for name in targets
        }
        tdee_estimate = number(target.get("tdee_estimate"))
        target_source = target.get("source") or "formula"
        rationale = target.get("rationale")
    else:
        targets = remaining = tdee_estimate = rationale = None
        target_source = "none"

    return {
        "date": today.isoformat(),
        "targets": targets,
        "consumed": consumed,
        "remaining": remaining,
        "tdee_estimate": tdee_estimate,
        "target_source": target_source,
        "rationale": rationale,
        "readiness": STUB_READINESS,
        "protein_split": STUB_PROTEIN_SPLIT,
        "micronutrient_flags": STUB_MICRONUTRIENT_FLAGS,
        "log_quality": log_quality,
        "stub": True,
    }


def recompute_targets(db, service, user_id: str, profile_row: dict | None, today: date) -> dict:
    """Run the nutrition model and save new targets. Returns the targets row.

    Raises 422 profile_incomplete when the model cannot score this user. Without a service key
    the targets are still returned, just not saved.
    """
    start = today - timedelta(days=nutrition.HISTORY_DAYS)
    yesterday = today - timedelta(days=1)

    try:
        latest_weight = (
            db.table("body_metrics")
            .select("weight_kg")
            .eq("user_id", user_id)
            .lte("date", today.isoformat())
            .order("date", desc=True)
            .limit(1)
            .execute()
            .data
        )
        logs = all_rows(
            lambda: db.table("food_log_entries")
            .select("local_date, kcal")
            .eq("user_id", user_id)
            .gte("local_date", start.isoformat())
            .lte("local_date", yesterday.isoformat())
            .order("logged_at")
        )
        weights = all_rows(
            lambda: db.table("body_metrics")
            .select("date, weight_kg")
            .eq("user_id", user_id)
            .gte("date", start.isoformat())
            .lte("date", yesterday.isoformat())
            .order("date")
        )
    except Exception:
        log.exception("GET /today: reading model inputs failed")
        raise HTTPException(status_code=502, detail="Unable to retrieve today's data")

    weight_kg = number(latest_weight[0]["weight_kg"]) if latest_weight else None
    try:
        profile, goal = nutrition.build_profile(profile_row, weight_kg, today)
    except nutrition.ProfileIncomplete as missing:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "profile_incomplete",
                "message": f"Finish your profile to get targets (missing: {missing}).",
            },
        )

    history = nutrition.build_history(
        start, yesterday, nutrition.kcal_by_day(logs), nutrition.weight_by_day(weights)
    )
    estimate = estimate_tdee(profile, history)
    row = nutrition.targets_row(user_id, today, daily_targets(profile, goal, estimate))

    if service is None:
        log.warning("GET /today: SUPABASE_SERVICE_ROLE_KEY is not set, so new targets were not saved")
        return row
    try:
        service.table("targets").upsert(row, on_conflict="user_id,effective_date").execute()
        service.table("model_outputs").upsert(
            nutrition.energy_output_row(user_id, today, estimate),
            on_conflict="user_id,model,date",
        ).execute()
    except Exception:
        log.exception("GET /today: saving targets failed")
        raise HTTPException(status_code=502, detail="Unable to save today's targets")
    return row
