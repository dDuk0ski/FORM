from datetime import date, timedelta

import numpy as np
import pytest

from form_ml.energy import (
    KCAL_PER_KG,
    LOGGED_SHARE_PRIOR,
    DayRecord,
    Profile,
    energy_density,
    estimate_tdee,
    formula_tdee,
    observed_tdee,
    observed_weight,
    resting_rate,
    trend_weights,
)
from form_ml.synthetic import random_user, simulate

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


def test_new_user_gets_formula_estimate_in_logged_units():
    estimate = estimate_tdee(PROFILE, days([2400.0] * 5, [80.0] * 5))
    assert estimate.source == "formula"
    assert estimate.formula_kcal == pytest.approx(formula_tdee(PROFILE, 80.0))
    assert estimate.tdee_kcal == pytest.approx(formula_tdee(PROFILE, 80.0) * LOGGED_SHARE_PRIOR)


def test_energy_density_rises_with_body_fat():
    lean = Profile(sex="male", age=25, height_cm=180, weight_kg=68, activity_level="moderate")
    heavy = Profile(sex="male", age=25, height_cm=180, weight_kg=120, activity_level="moderate")
    assert energy_density(PROFILE) == pytest.approx(6459, abs=10)   # ~20% body fat
    assert energy_density(lean) < energy_density(PROFILE) < energy_density(heavy) < 9440


def test_dieter_who_under_logs_by_the_prior_gets_exact_burn_in_logged_units():
    # Regression for the units bug: weight change is real energy, intake is logged energy.
    true_tdee, real_intake = 2700.0, 2200.0
    kg_per_day = (real_intake - true_tdee) / energy_density(PROFILE)
    history = days([real_intake * LOGGED_SHARE_PRIOR] * 28, [80 + kg_per_day * i for i in range(28)])
    estimate = estimate_tdee(PROFILE, history)
    assert estimate.weight_on_observed == 1
    # Small slack: the model takes density at today's trend weight, ~1.7 kg below the start.
    assert estimate.tdee_kcal == pytest.approx(true_tdee * LOGGED_SHARE_PRIOR, abs=15)


def test_converges_to_users_real_burn_in_logged_units():
    rng = np.random.default_rng(3)
    errors = []
    for _ in range(40):
        user = random_user(rng)
        run = simulate(user, 56, rng)
        estimate = estimate_tdee(user.profile, run.records)
        assert estimate.source == "adaptive"
        # The model learns burn in the units the user logs in, so compare against that.
        target = np.mean(run.true_tdee_kcal[-28:]) * (1 - user.logging_bias)
        errors.append(abs(estimate.tdee_kcal - target))
    assert np.mean(errors) < 150
