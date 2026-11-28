from dataclasses import asdict
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, Query, HTTPException
from supabase import create_client

from auth import get_current_user
from database import url, key, service_supabase

from form_ml.energy import Profile, DayRecord, estimate_tdee
from form_ml.targets import daily_targets


router = APIRouter()


def api_error(status_code: int, code: str, message: str):
    raise HTTPException(
        status_code=status_code,
        detail={
            "error": {
                "code": code,
                "message": message,
            }
        },
    )


def number(value, default=0):
    if value is None:
        return default
    return float(value)


def local_today(timezone_name: str | None) -> date:
    try:
        user_timezone = ZoneInfo(timezone_name or "UTC")
    except (ZoneInfoNotFoundError, ValueError, TypeError):
        user_timezone = ZoneInfo("UTC")

    return datetime.now(timezone.utc).astimezone(user_timezone).date()


def calculate_age(birth_date: date, on_date: date) -> int:
    age = on_date.year - birth_date.year

    if (on_date.month, on_date.day) < (
        birth_date.month,
        birth_date.day,
    ):
        age -= 1

    return age


def build_history(
    start: date,
    end: date,
    kcal_by_day: dict[date, float],
    weight_by_day: dict[date, float],
) -> list[DayRecord]:
    if end < start:
        return []

    return [
        DayRecord(
            day=start + timedelta(days=offset),
            kcal_in=kcal_by_day.get(start + timedelta(days=offset)),
            weight_kg=weight_by_day.get(start + timedelta(days=offset)),
        )
        for offset in range((end - start).days + 1)
    ]


def build_model_profile(
    profile: dict,
    latest_weight: float | None,
    on_date: date,
):
    required_fields = [
        "sex",
        "birth_date",
        "height_cm",
        "activity_level",
        "goal",
    ]

    if any(profile.get(field) is None for field in required_fields):
        return None, None

    if latest_weight is None:
        return None, None

    try:
        birth_date = date.fromisoformat(str(profile["birth_date"]))

        sex = profile["sex"]
        activity_level = profile["activity_level"]
        goal = profile["goal"]

        if sex not in ("male", "female"):
            return None, None

        if activity_level not in (
            "sedentary",
            "light",
            "moderate",
            "active",
            "very_active",
        ):
            return None, None

        if goal not in ("lose", "maintain", "gain"):
            return None, None

        age = calculate_age(birth_date, on_date)

        if age <= 0:
            return None, None

        model_profile = Profile(
            sex=sex,
            age=age,
            height_cm=float(profile["height_cm"]),
            weight_kg=float(latest_weight),
            activity_level=activity_level,
        )

        return model_profile, goal

    except (ValueError, TypeError):
        return None, None


def load_history(
    user_supabase,
    user_id: str,
    today: date,
) -> list[DayRecord]:
    start = today - timedelta(days=90)
    yesterday = today - timedelta(days=1)

    if yesterday < start:
        return []

    food_result = (
        user_supabase.table("food_log_entries")
        .select("local_date, kcal")
        .eq("user_id", user_id)
        .gte("local_date", start.isoformat())
        .lte("local_date", yesterday.isoformat())
        .execute()
    )

    weight_result = (
        user_supabase.table("body_metrics")
        .select("date, weight_kg")
        .eq("user_id", user_id)
        .gte("date", start.isoformat())
        .lte("date", yesterday.isoformat())
        .execute()
    )

    kcal_by_day = {}
    kcal_entries_by_day = {}

    for entry in food_result.data or []:
        entry_date = date.fromisoformat(entry["local_date"])

        if entry.get("kcal") is not None:
            kcal_by_day[entry_date] = (
                kcal_by_day.get(entry_date, 0.0)
                + float(entry["kcal"])
            )
            kcal_entries_by_day[entry_date] = (
                kcal_entries_by_day.get(entry_date, 0) + 1
            )

    # A day with no calorie values remains None, not zero.
    for entry_date in list(kcal_by_day):
        if kcal_entries_by_day.get(entry_date, 0) == 0:
            kcal_by_day.pop(entry_date, None)

    weight_by_day = {}

    for entry in weight_result.data or []:
        if entry.get("weight_kg") is not None:
            entry_date = date.fromisoformat(entry["date"])
            weight_by_day[entry_date] = float(entry["weight_kg"])

    return build_history(
        start,
        yesterday,
        kcal_by_day,
        weight_by_day,
    )


def save_energy_output(
    user_id: str,
    today: date,
    estimate,
):
    weight_on_observed = float(estimate.weight_on_observed)

    if weight_on_observed <= 0:
        status = "insufficient_data"
    elif weight_on_observed < 1:
        status = "learning"
    else:
        status = "ok"

    service_supabase.table("model_outputs").upsert(
        {
            "user_id": user_id,
            "model": "energy",
            "date": today.isoformat(),
            "version": "energy-v3",
            "status": status,
            "confidence": weight_on_observed,
            "output": asdict(estimate),
        },
        on_conflict="user_id,model,date",
    ).execute()


def save_targets(
    user_id: str,
    today: date,
    model_targets,
):
    target_row = {
        "user_id": user_id,
        "effective_date": today.isoformat(),
        "kcal": model_targets.kcal,
        "protein_g": model_targets.protein_g,
        "carb_g": model_targets.carb_g,
        "fat_g": model_targets.fat_g,
        "tdee_estimate": model_targets.tdee_estimate,
        "source": model_targets.target_source,
        "rationale": model_targets.rationale,
    }

    service_supabase.table("targets").upsert(
        target_row,
        on_conflict="user_id,effective_date",
    ).execute()

    return target_row


@router.get("/today")
def get_today(
    date_requested: date | None = Query(default=None, alias="date"),
    auth=Depends(get_current_user),
):
    user = auth["user"]
    token = auth["token"]
    user_id = str(user.id)

    user_supabase = create_client(url, key)
    user_supabase.postgrest.auth(token)

    # --------------------------------------------------
    # 1. Load the user's profile and local date
    # --------------------------------------------------

    try:
        profile_result = (
            user_supabase.table("profiles")
            .select(
                "sex, birth_date, height_cm, activity_level, "
                "goal, timezone"
            )
            .eq("id", user_id)
            .limit(1)
            .execute()
        )

        profile = (
            profile_result.data[0]
            if profile_result.data
            else {}
        )

        today = date_requested or local_today(
            profile.get("timezone")
        )

    except Exception as e:
        print(
            f"GET /today profile error: {type(e).__name__}: {e}",
            flush=True,
        )
        api_error(
            502,
            "DATABASE_ERROR",
            "Unable to retrieve today's profile.",
        )

    # --------------------------------------------------
    # 2. Read existing targets
    # --------------------------------------------------

    try:
        target_result = (
            user_supabase.table("targets")
            .select("*")
            .eq("user_id", user_id)
            .lte("effective_date", today.isoformat())
            .order("effective_date", desc=True)
            .limit(1)
            .execute()
        )

        target = (
            target_result.data[0]
            if target_result.data
            else None
        )

    except Exception as e:
        print(
            f"GET /today targets error: {type(e).__name__}: {e}",
            flush=True,
        )
        api_error(
            502,
            "DATABASE_ERROR",
            "Unable to retrieve nutrition targets.",
        )

    # --------------------------------------------------
    # 3. Recalculate targets if missing or 7+ days old
    # --------------------------------------------------

    should_recalculate = target is None

    if target is not None:
        effective_date = date.fromisoformat(
            target["effective_date"]
        )

        should_recalculate = (
            (today - effective_date).days >= 7
        )

    if should_recalculate:
        try:
            weight_result = (
                user_supabase.table("body_metrics")
                .select("weight_kg")
                .eq("user_id", user_id)
                .lte("date", today.isoformat())
                .order("date", desc=True)
                .limit(1)
                .execute()
            )

            latest_weight = (
                number(weight_result.data[0].get("weight_kg"))
                if weight_result.data
                and weight_result.data[0].get("weight_kg") is not None
                else None
            )

            model_profile, goal = build_model_profile(
                profile,
                latest_weight,
                today,
            )

            if model_profile is None:
                api_error(
                    422,
                    "profile_incomplete",
                    "Complete your profile and add a weigh-in to get nutrition targets.",
                )

            history = load_history(
                user_supabase,
                user_id,
                today,
            )

        except HTTPException:
            raise

        except Exception as e:
            print(
                f"GET /today history error: {type(e).__name__}: {e}",
                flush=True,
            )
            api_error(
                502,
                "DATABASE_ERROR",
                "Unable to retrieve nutrition history.",
            )

        try:
            estimate = estimate_tdee(
                model_profile,
                history,
            )

            model_targets = daily_targets(
                model_profile,
                goal=goal,
                estimate=estimate,
            )

        except Exception as e:
            print(
                f"GET /today model error: {type(e).__name__}: {e}",
                flush=True,
            )
            api_error(
                503,
                "MODEL_UNAVAILABLE",
                "Unable to calculate nutrition targets.",
            )

        try:
            target = save_targets(
                user_id,
                today,
                model_targets,
            )

            save_energy_output(
                user_id,
                today,
                estimate,
            )

        except Exception as e:
            print(
                f"GET /today model save error: {type(e).__name__}: {e}",
                flush=True,
            )
            api_error(
                502,
                "DATABASE_ERROR",
                "Unable to save calculated nutrition targets.",
            )

    # --------------------------------------------------
    # 4. Read today's food logs using local_date
    # --------------------------------------------------

    try:
        food_result = (
            user_supabase.table("food_log_entries")
            .select("kcal, protein_g, carb_g, fat_g")
            .eq("user_id", user_id)
            .eq("local_date", today.isoformat())
            .execute()
        )

    except Exception as e:
        print(
            f"GET /today food log error: {type(e).__name__}: {e}",
            flush=True,
        )
        api_error(
            502,
            "DATABASE_ERROR",
            "Unable to retrieve today's food logs.",
        )

    food_entries = food_result.data or []

    # --------------------------------------------------
    # 5. Calculate consumed nutrients and log quality
    # --------------------------------------------------

    consumed = {
        "kcal": 0.0,
        "protein_g": 0.0,
        "carb_g": 0.0,
        "fat_g": 0.0,
    }

    entries_with_kcal = 0

    for entry in food_entries:
        if entry.get("kcal") is not None:
            entries_with_kcal += 1

        for nutrient in consumed:
            consumed[nutrient] += number(
                entry.get(nutrient)
            )

    if not food_entries:
        log_quality = 0.0
    else:
        log_quality = (
            entries_with_kcal / len(food_entries)
        )

    # --------------------------------------------------
    # 6. Build targets and remaining values
    # --------------------------------------------------

    targets = {
        "kcal": number(target.get("kcal")),
        "protein_g": number(target.get("protein_g")),
        "carb_g": number(target.get("carb_g")),
        "fat_g": number(target.get("fat_g")),
    }

    remaining = {
        nutrient: targets[nutrient] - consumed[nutrient]
        for nutrient in targets
    }

    # --------------------------------------------------
    # 7. Return the /today response
    # --------------------------------------------------

    return {
        "date": today.isoformat(),
        "targets": targets,
        "consumed": consumed,
        "remaining": remaining,
        "tdee_estimate": number(
            target.get("tdee_estimate")
        ),
        "target_source": target.get("source") or "formula",
        "rationale": target.get("rationale") or "",
        "readiness": {
            "score": 0,
            "advice": "Readiness data is not available yet.",
        },
        "protein_split": {
            "meals_logged": 0,
            "largest_meal_g": 0,
            "advice": "Protein distribution data is not available yet.",
        },
        "micronutrient_flags": [],
        "log_quality": log_quality,
        "stub": True,
    }