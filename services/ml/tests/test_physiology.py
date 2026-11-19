"""Synthetic physiology the model does not assume, and version 3 against version 2 on it."""

import numpy as np
import pytest

from form_ml.energy import energy_density, estimate_tdee
from form_ml.synthetic import Physiology, population


def test_physiology_population_is_reproducible_and_uses_body_fat_density():
    a = population(4, 30, seed=2, physiology=Physiology())
    b = population(4, 30, seed=2, physiology=Physiology())
    assert [r.records for r in a] == [r.records for r in b]
    run = a[0]
    for t in range(29):
        balance = run.true_intake_kcal[t] - run.true_tdee_kcal[t]
        density = energy_density(run.user.profile, run.true_weight_kg[t])
        assert run.true_weight_kg[t + 1] - run.true_weight_kg[t] == pytest.approx(balance / density)


def test_dieters_drain_glycogen_water_on_the_scale():
    runs = [r for r in population(60, 21, seed=5, physiology=Physiology(cycle_water_kg=0))
            if r.user.goal == "lose"]
    gaps = []
    for run in runs:
        late = [(r.weight_kg - w) for r, w in zip(run.records[14:], run.true_weight_kg[14:]) if r.weight_kg]
        gaps.extend(late)
    assert np.mean(gaps) == pytest.approx(-1.5, abs=0.15)   # scale reads ~1.5 kg under tissue


def test_logged_share_drifts_but_stays_plausible():
    run = population(1, 84, seed=9, physiology=Physiology())[0]
    shares = np.array(run.true_logged_share)
    assert shares.std() > 0
    assert shares.min() >= 0.55 and shares.max() <= 1.0


def test_version_three_beats_version_two_once_bodies_behave_like_bodies():
    runs = population(80, 56, seed=13, physiology=Physiology())
    errors = {"v2": [], "v3": []}
    for run in runs:
        truth = run.true_tdee_kcal[48] * run.true_logged_share[48]
        history = run.records[:49]
        v2 = estimate_tdee(run.user.profile, history, logged_share=1.0, body_fat_density=False)
        v3 = estimate_tdee(run.user.profile, history)
        errors["v2"].append(abs(v2.tdee_kcal - truth))
        errors["v3"].append(abs(v3.tdee_kcal - truth))
    assert np.mean(errors["v3"]) < 0.85 * np.mean(errors["v2"])
