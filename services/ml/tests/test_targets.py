import pytest

from form_ml.energy import Profile, TdeeEstimate, resting_rate
from form_ml.targets import daily_targets, goal_offset

PROFILE = Profile(sex="male", age=30, height_cm=180, weight_kg=80, activity_level="moderate")


def estimate(tdee=2700.0, source="adaptive", change=-0.4, trend=80.0):
    return TdeeEstimate(
        tdee_kcal=tdee,
        formula_kcal=2759.0,
        observed_kcal=tdee,
        weight_on_observed=1.0 if source == "adaptive" else 0.0,
        source=source,
        logged_days=26,
        mean_intake_kcal=2560.0,
        weight_change_kg=change,
        window_days=28,
        trend_weight_kg=trend,
    )


def test_deficit_is_capped_at_one_percent_body_weight_per_week():
    assert goal_offset("lose", 80) == -500
    assert goal_offset("lose", 40) == pytest.approx(-0.01 * 40 * 7700 / 7)


def test_targets_follow_goal_and_macro_rules():
    t = daily_targets(PROFILE, "lose", estimate())
    assert t.kcal == 2200
    assert t.protein_g == 144
    assert t.fat_g == round(0.25 * 2200 / 9)
    assert abs(t.protein_g * 4 + t.carb_g * 4 + t.fat_g * 9 - t.kcal) < 15
    assert t.target_source == "adaptive"


def test_never_below_resting_rate():
    t = daily_targets(PROFILE, "lose", estimate(tdee=1900))
    assert t.kcal == round(resting_rate("male", 80, 180, 30))


def test_rationale_lines():
    assert daily_targets(PROFILE, "maintain", estimate()).rationale == (
        "Weight trend fell 0.4 kg over 28 days on 2,560 kcal average."
    )
    assert "held steady" in daily_targets(PROFILE, "maintain", estimate(change=0.05)).rationale
    assert daily_targets(PROFILE, "maintain", estimate(source="formula")).rationale.startswith(
        "Starting estimate"
    )
