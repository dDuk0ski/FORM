"""Glue between the database rows and the nutrition model in services/ml.

Everything here is a pure function: rows in, values out. The /today route does the reads
and writes, so these can be tested without a database.
"""

from __future__ import annotations

from dataclasses import asdict
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from form_ml.energy import DayRecord, Profile, TdeeEstimate
from form_ml.targets import Targets

HISTORY_DAYS = 90
RECALC_AFTER_DAYS = 7
ENERGY_MODEL_VERSION = "energy-v3"
REQUIRED_PROFILE_FIELDS = ("sex", "birth_date", "height_cm", "activity_level")


class ProfileIncomplete(Exception):
    """The profile is missing something the model needs. `missing` lists what."""

    def __init__(self, missing: list[str]):
        super().__init__(", ".join(missing))
        self.missing = missing


def local_today(tz_name: str | None, now: datetime | None = None) -> date:
    """The user's calendar day right now. Falls back to UTC for an empty or unknown zone."""
    now = now or datetime.now(timezone.utc)
    try:
        zone = ZoneInfo(tz_name) if tz_name else timezone.utc
    except (ZoneInfoNotFoundError, ValueError):
        zone = timezone.utc
    return now.astimezone(zone).date()


def age_on(birth_date: date, today: date) -> int:
    """Whole years on `today`."""
    had_birthday = (today.month, today.day) >= (birth_date.month, birth_date.day)
    return today.year - birth_date.year - (0 if had_birthday else 1)


def to_date(value: date | str) -> date:
    return value if isinstance(value, date) else date.fromisoformat(value)


def build_profile(row: dict | None, weight_kg: float | None, today: date) -> tuple[Profile, str]:
    """The model's Profile and the goal. Raises ProfileIncomplete if anything is missing.

    goal is optional and defaults to maintain; the weigh-in is required.
    """
    row = row or {}
    missing = [name for name in REQUIRED_PROFILE_FIELDS if row.get(name) in (None, "")]
    if weight_kg is None:
        missing.append("weigh_in")
    if missing:
        raise ProfileIncomplete(missing)

    profile = Profile(
        sex=row["sex"],
        age=age_on(to_date(row["birth_date"]), today),
        height_cm=float(row["height_cm"]),
        weight_kg=float(weight_kg),
        activity_level=row["activity_level"],
    )
    return profile, row.get("goal") or "maintain"


def build_history(
    start: date,
    end: date,
    kcal_by_day: dict[date, float],
    weight_by_day: dict[date, float],
) -> list[DayRecord]:
    """One record per calendar day from start to end, oldest first. Gaps stay None."""
    days = (end - start).days + 1
    return [
        DayRecord(day=d, kcal_in=kcal_by_day.get(d), weight_kg=weight_by_day.get(d))
        for d in (start + timedelta(n) for n in range(max(days, 0)))
    ]


def kcal_by_day(entries: list[dict]) -> dict[date, float]:
    """Logged kcal per local day from food_log_entries rows. Unknown kcal is skipped.

    A day whose every entry has unknown kcal is left out, so the model treats it as unlogged
    rather than as a day of eating nothing.
    """
    totals: dict[date, float] = {}
    for entry in entries:
        if entry.get("kcal") is None:
            continue
        day = to_date(entry["local_date"])
        totals[day] = totals.get(day, 0.0) + float(entry["kcal"])
    return totals


def weight_by_day(rows: list[dict]) -> dict[date, float]:
    return {to_date(r["date"]): float(r["weight_kg"]) for r in rows if r.get("weight_kg") is not None}


def consumed_today(entries: list[dict]) -> tuple[dict[str, float], float]:
    """Today's macro totals and log_quality. Unknown values are skipped, never counted as 0."""
    consumed = {}
    for field in ("kcal", "protein_g", "carb_g", "fat_g"):
        consumed[field] = round(sum(float(e[field]) for e in entries if e.get(field) is not None), 1)
    known = sum(1 for e in entries if e.get("kcal") is not None)
    log_quality = 1.0 if not entries else round(known / len(entries), 2)
    return consumed, log_quality


def needs_recalc(latest_effective_date: date | None, today: date) -> bool:
    """New targets when there are none yet, or the newest ones are a week old."""
    return latest_effective_date is None or (today - latest_effective_date).days >= RECALC_AFTER_DAYS


def targets_row(user_id: str, today: date, targets: Targets) -> dict:
    return {
        "user_id": user_id,
        "effective_date": today.isoformat(),
        "kcal": targets.kcal,
        "protein_g": targets.protein_g,
        "carb_g": targets.carb_g,
        "fat_g": targets.fat_g,
        "tdee_estimate": targets.tdee_estimate,
        "source": targets.target_source,
        "rationale": targets.rationale,
    }


def energy_output_row(user_id: str, today: date, estimate: TdeeEstimate) -> dict:
    """The model_outputs row for the energy model. Status follows how much of it is data-driven."""
    weight = estimate.weight_on_observed
    status = "insufficient_data" if weight <= 0 else ("ok" if weight >= 1 else "learning")
    return {
        "user_id": user_id,
        "model": "energy",
        "date": today.isoformat(),
        "version": ENERGY_MODEL_VERSION,
        "status": status,
        "confidence": round(weight, 3),
        "output": {k: (round(v, 2) if isinstance(v, float) else v) for k, v in asdict(estimate).items()},
    }
