from datetime import date, datetime, timezone

import pytest

import nutrition
from form_ml.energy import TdeeEstimate


def test_local_today_uses_the_users_timezone():
    # 11:30 pm in Detroit on Nov 18 is already Nov 19 in UTC.
    now = datetime(2026, 11, 19, 4, 30, tzinfo=timezone.utc)
    assert nutrition.local_today("America/Detroit", now) == date(2026, 11, 18)
    assert nutrition.local_today(None, now) == date(2026, 11, 19)


def test_local_today_falls_back_to_utc_for_an_unknown_zone():
    now = datetime(2026, 11, 19, 4, 30, tzinfo=timezone.utc)
    assert nutrition.local_today("Not/AZone", now) == date(2026, 11, 19)


def test_age_counts_whole_years():
    assert nutrition.age_on(date(2002, 11, 20), date(2026, 11, 19)) == 23
    assert nutrition.age_on(date(2002, 11, 19), date(2026, 11, 19)) == 24


def test_build_profile_lists_everything_missing():
    with pytest.raises(nutrition.ProfileIncomplete) as error:
        nutrition.build_profile({"sex": "male"}, None, date(2026, 11, 19))
    assert error.value.missing == ["birth_date", "height_cm", "activity_level", "weigh_in"]


def test_build_profile_defaults_the_goal_to_maintain():
    row = {"sex": "female", "birth_date": "2000-01-01", "height_cm": "165.5", "activity_level": "light"}
    profile, goal = nutrition.build_profile(row, 61.2, date(2026, 11, 19))
    assert goal == "maintain"
    assert (profile.age, profile.height_cm, profile.weight_kg) == (26, 165.5, 61.2)


def test_build_history_has_one_record_per_day_with_gaps_as_none():
    start, end = date(2026, 11, 1), date(2026, 11, 4)
    history = nutrition.build_history(
        start, end, {date(2026, 11, 2): 2100.0}, {date(2026, 11, 3): 80.4}
    )
    assert [d.day for d in history] == [date(2026, 11, n) for n in range(1, 5)]
    assert [d.kcal_in for d in history] == [None, 2100.0, None, None]
    assert [d.weight_kg for d in history] == [None, None, 80.4, None]


def test_kcal_by_day_skips_unknowns_and_leaves_all_unknown_days_out():
    entries = [
        {"local_date": "2026-11-01", "kcal": 500},
        {"local_date": "2026-11-01", "kcal": None},
        {"local_date": "2026-11-01", "kcal": 250.5},
        {"local_date": "2026-11-02", "kcal": None},
    ]
    assert nutrition.kcal_by_day(entries) == {date(2026, 11, 1): 750.5}


def test_consumed_today_never_counts_unknown_as_zero_but_lowers_log_quality():
    entries = [
        {"kcal": 150, "protein_g": 10, "carb_g": None, "fat_g": 5},
        {"kcal": None, "protein_g": None, "carb_g": None, "fat_g": None},
    ]
    consumed, quality = nutrition.consumed_today(entries)
    assert consumed == {"kcal": 150, "protein_g": 10, "carb_g": 0, "fat_g": 5}
    assert quality == 0.5


def test_consumed_today_with_nothing_logged():
    assert nutrition.consumed_today([]) == ({"kcal": 0, "protein_g": 0, "carb_g": 0, "fat_g": 0}, 1.0)


def test_needs_recalc_after_a_week():
    today = date(2026, 11, 19)
    assert nutrition.needs_recalc(None, today)
    assert not nutrition.needs_recalc(date(2026, 11, 13), today)
    assert nutrition.needs_recalc(date(2026, 11, 12), today)


def estimate(weight_on_observed):
    return TdeeEstimate(
        tdee_kcal=2412.346, formula_kcal=2690.0, observed_kcal=None,
        weight_on_observed=weight_on_observed, source="formula", logged_days=0,
        mean_intake_kcal=None, weight_change_kg=None, window_days=0, trend_weight_kg=None,
    )


@pytest.mark.parametrize(
    "weight, status", [(0.0, "insufficient_data"), (0.4, "learning"), (1.0, "ok")]
)
def test_energy_output_status_follows_the_blend(weight, status):
    row = nutrition.energy_output_row("u", date(2026, 11, 19), estimate(weight))
    assert (row["status"], row["confidence"]) == (status, weight)
    assert row["output"]["tdee_kcal"] == 2412.35
    assert row["model"] == "energy" and row["version"] == nutrition.ENERGY_MODEL_VERSION
