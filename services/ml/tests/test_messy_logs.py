"""Version 2 guards: forgotten meals and water-inflated weigh-ins."""

import numpy as np
import pytest

from form_ml.energy import KCAL_PER_KG, estimate_tdee, huber_slope, typical_intakes
from form_ml.synthetic import Realism, population


def test_incomplete_days_are_left_out_once_there_is_a_week_of_logs():
    week = [2400, 2350, 900, 2500, 2450, 1100, 2380]
    assert typical_intakes(week) == [2400, 2350, 2500, 2450, 2380]
    assert typical_intakes(week[:5]) == week[:5]  # too few days to know what normal is


def test_huber_slope_resists_a_water_spike():
    xs = np.arange(28, dtype=float)
    ys = 80 - 0.05 * xs
    ys[10:12] += 1.5  # two salty-meal weigh-ins
    ols, _ = np.polyfit(xs, ys, 1)
    assert abs(huber_slope(xs, ys) + 0.05) < abs(ols + 0.05)


def test_realistic_population_is_reproducible_and_still_follows_energy_balance():
    a = population(3, 21, seed=4, realism=Realism())
    b = population(3, 21, seed=4, realism=Realism())
    assert [r.records for r in a] == [r.records for r in b]
    run = a[0]
    for t in range(20):
        balance = run.true_intake_kcal[t] - run.true_tdee_kcal[t]
        assert run.true_weight_kg[t + 1] - run.true_weight_kg[t] == pytest.approx(balance / KCAL_PER_KG)


def test_version_two_beats_version_one_on_realistic_users():
    runs = population(80, 56, seed=13, realism=Realism())
    errors = {"v1": [], "v2": []}
    for run in runs:
        true_logged = run.true_tdee_kcal[48] * (1 - run.user.logging_bias)
        history = run.records[:49]
        v1 = estimate_tdee(run.user.profile, history, method="regression", filter_incomplete=False)
        v2 = estimate_tdee(run.user.profile, history)
        errors["v1"].append(abs(v1.tdee_kcal - true_logged))
        errors["v2"].append(abs(v2.tdee_kcal - true_logged))
    assert np.mean(errors["v2"]) < 0.95 * np.mean(errors["v1"])
