from datetime import date, timedelta

import pytest

from form_ml.energy import (
    KCAL_PER_KG,
    DayRecord,
    Profile,
    estimate_tdee,
    formula_tdee,
    observed_tdee,
    observed_weight,
    resting_rate,
    trend_weights,
)

PROFILE = Profile(sex="male", age=30, height_cm=180, weight_kg=80, activity_level="moderate")


def days(kcal, weights):
    start = date(2026, 9, 1)
    return [DayRecord(start + timedelta(days=i), k, w) for i, (k, w) in enumerate(zip(kcal, weights))]


def test_resting_rate_matches_mifflin_st_jeor():
    assert resting_rate("male", 80, 180, 30) == pytest.approx(1780)
    assert resting_rate("female", 80, 180, 30) == pytest.approx(1614)


def test_formula_tdee_applies_activity_factor_and_newer_weight():
    assert formula_tdee(PROFILE) == pytest.approx(1780 * 1.55)
    assert formula_tdee(PROFILE, weight_kg=75) == pytest.approx((1780 - 50) * 1.55)


def test_trend_skips_missing_days_and_smooths():
    trend = trend_weights([None, 80.0, None, 81.0])
    assert trend[0] is None
    assert trend[1] == trend[2] == 80.0
    assert trend[3] == pytest.approx(80.1)


def test_observed_tdee_is_intake_minus_stored_energy():
    weights = [80 - 0.5 * i / 27 for i in range(28)]
    history = days([2500.0] * 28, weights)
    expected = 2500 + (0.5 / 27) * KCAL_PER_KG
    assert observed_tdee(history) == pytest.approx(expected)


def test_observed_tdee_needs_enough_weigh_ins():
    history = days([2500.0] * 28, [80.0, 79.9, 79.8] + [None] * 25)
    assert observed_tdee(history) is None


def test_unlogged_days_are_ignored_not_counted_as_zero():
    weights = [80.0] * 28
    with_gaps = days([2500.0 if i % 2 else None for i in range(28)], weights)
    assert observed_tdee(with_gaps) == pytest.approx(2500)


def test_ramp_from_formula_to_observed():
    assert observed_weight(5) == 0
    assert observed_weight(14) == pytest.approx(0.5)
    assert observed_weight(21) == 1
    assert observed_weight(40) == 1


def test_new_user_gets_formula_estimate():
    estimate = estimate_tdee(PROFILE, days([2400.0] * 5, [80.0] * 5))
    assert estimate.source == "formula"
    assert estimate.tdee_kcal == pytest.approx(formula_tdee(PROFILE, 80.0))
