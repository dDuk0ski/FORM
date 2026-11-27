
import secrets
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from database import service_supabase, recompute_api_secret
from routers.today import (
    build_model_profile,
    load_history,
    save_energy_output,
    save_targets,
)
from form_ml.energy import estimate_tdee
from form_ml.targets import daily_targets


router = APIRouter()


class RecomputeRequest(BaseModel):
    user_id: str
    from_date: date = Field(alias="from")
    to_date: date = Field(alias="to")


def verify_service_key(
    x_recompute_secret: str | None = Header(default=None),
):
    if not x_recompute_secret:
        raise HTTPException(
            status_code=401,
            detail="Unauthorized",
        )

    if not secrets.compare_digest(
        x_recompute_secret,
        recompute_api_secret,
    ):
        raise HTTPException(
            status_code=401,
            detail="Unauthorized",
        )


def get_daily_logs(user_id: str, start: date, end: date):
    response = (
        service_supabase.table("food_log_entries")
        .select("local_date, kcal, protein_g, carb_g, fat_g")
        .eq("user_id", user_id)
        .gte("local_date", start.isoformat())
        .lte("local_date", end.isoformat())
        .execute()
    )

    totals = {}

    for entry in response.data or []:
        if not entry.get("local_date"):
            continue

        entry_date = date.fromisoformat(entry["local_date"])

        if entry_date not in totals:
            totals[entry_date] = {
                "kcal": [],
                "protein": [],
                "carb": [],
                "fat": [],
                "entries": 0,
                "entries_with_kcal": 0,
            }

        day = totals[entry_date]
        day["entries"] += 1

        for source, destination in (
            ("kcal", "kcal"),
            ("protein_g", "protein"),
            ("carb_g", "carb"),
            ("fat_g", "fat"),
        ):
            value = entry.get(source)

            if value is not None:
                day[destination].append(float(value))

        if entry.get("kcal") is not None:
            day["entries_with_kcal"] += 1

    return totals


def sum_known(values):
    return round(sum(values), 2) if values else None


def save_daily_record(
    user_id: str,
    record_date: date,
    totals: dict,
    trend_weight: float | None,
    tdee: float | None,
):
    day_totals = totals.get(record_date, {
        "kcal": [],
        "protein": [],
        "carb": [],
        "fat": [],
        "entries": 0,
        "entries_with_kcal": 0,
    })

    kcal = sum_known(day_totals["kcal"])

    if kcal is not None:
        kcal = round(kcal)

    entries = day_totals["entries"]

    log_quality = (
        day_totals["entries_with_kcal"] / entries
        if entries
        else 1.0
    )

    row = {
        "user_id": user_id,
        "date": record_date.isoformat(),
        "kcal_in": kcal,
        "protein": sum_known(day_totals["protein"]),
        "carb": sum_known(day_totals["carb"]),
        "fat": sum_known(day_totals["fat"]),
        "trend_weight_kg": trend_weight,
        "training_load": None,
        "readiness": None,
        "tdee_estimate": tdee,
        "log_quality": log_quality,
    }

    service_supabase.table("daily_records").upsert(
        row,
        on_conflict="user_id,date",
    ).execute()


@router.post("/recompute")
def recompute(
    request: RecomputeRequest,
    authorized=Depends(verify_service_key),
):
    user_id = request.user_id
    start = request.from_date
    end = request.to_date

    if end < start:
        raise HTTPException(
            status_code=422,
            detail="The end date must be on or after the start date.",
        )

    if (end - start).days > 90:
        raise HTTPException(
            status_code=422,
            detail="A recompute request cannot exceed 91 calendar days.",
        )

    try:
        profile_response = (
            service_supabase.table("profiles")
            .select(
                "sex, birth_date, height_cm, activity_level, goal, timezone"
            )
            .eq("id", user_id)
            .limit(1)
            .execute()
        )

        if not profile_response.data:
            raise HTTPException(
                status_code=404,
                detail="User profile not found.",
            )

        profile = profile_response.data[0]

        latest_weight_response = (
            service_supabase.table("body_metrics")
            .select("weight_kg")
            .eq("user_id", user_id)
            .lte("date", end.isoformat())
            .order("date", desc=True)
            .limit(1)
            .execute()
        )

        latest_weight = (
            float(latest_weight_response.data[0]["weight_kg"])
            if latest_weight_response.data
            else None
        )

        model_profile, goal = build_model_profile(
            profile,
            latest_weight,
            end,
        )

        if model_profile is None:
            raise HTTPException(
                status_code=422,
                detail={
                    "error": {
                        "code": "profile_incomplete",
                        "message": "Complete the user's profile and add a weigh-in.",
                    }
                },
            )

        daily_totals = get_daily_logs(user_id, start, end)

    except HTTPException:
        raise
    except Exception as exc:
        print(
            f"Recompute profile/database error: {type(exc).__name__}: {exc}",
            flush=True,
        )
        raise HTTPException(
            status_code=502,
            detail="Unable to retrieve recompute input data.",
        )

    rows_written = 0
    latest_tdee = None

    current_date = start

    while current_date <= end:
        try:
            history = load_history(
                service_supabase,
                user_id,
                current_date,
            )

            weight_response = (
                service_supabase.table("body_metrics")
                .select("weight_kg")
                .eq("user_id", user_id)
                .lte("date", current_date.isoformat())
                .order("date", desc=True)
                .limit(1)
                .execute()
            )

            current_weight = (
                float(weight_response.data[0]["weight_kg"])
                if weight_response.data
                else None
            )

            day_profile, day_goal = build_model_profile(
                profile,
                current_weight,
                current_date,
            )

            estimate = None
            model_targets = None
            day_tdee = None

            if day_profile is not None:
                estimate = estimate_tdee(day_profile, history)
                day_tdee = float(estimate.tdee_kcal)
                latest_tdee = day_tdee

                save_energy_output(
                    user_id,
                    current_date,
                    estimate,
                )

                # Recalculate targets on the user's Monday.
                if current_date.weekday() == 0:
                    model_targets = daily_targets(
                        day_profile,
                        goal=day_goal,
                        estimate=estimate,
                    )

                    save_targets(
                        user_id,
                        current_date,
                        model_targets,
                    )

            save_daily_record(
                user_id,
                current_date,
                daily_totals,
                (
                    float(estimate.trend_weight_kg)
                    if estimate is not None
                    and estimate.trend_weight_kg is not None
                    else current_weight
                ),
                day_tdee,
            )

            rows_written += 1

        except Exception as exc:
            print(
                f"Recompute failed for {current_date}: "
                f"{type(exc).__name__}: {exc}",
                flush=True,
            )
            raise HTTPException(
                status_code=502,
                detail=f"Recompute failed for {current_date.isoformat()}.",
            )

        current_date += timedelta(days=1)

    return {
        "rows_written": rows_written,
        "tdee_estimate": latest_tdee,
        "stub": True,
    }
