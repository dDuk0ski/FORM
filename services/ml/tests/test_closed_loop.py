"""Closed loop: a synthetic user eats at the model's targets. Checks the targets themselves,
not just the TDEE estimate, so unit mistakes like a real-calorie floor on logged calories show up."""

from datetime import date, timedelta

import numpy as np

from form_ml.energy import KCAL_PER_KG, DayRecord, estimate_tdee, formula_tdee
from form_ml.synthetic import random_user
from form_ml.targets import daily_targets


def follow_targets(user, days, rng):
    """Recompute targets weekly; the user eats so that what they *log* matches the target."""
    weight = user.profile.weight_kg
    history, weights, targets = [], [], None
    for t in range(days):
        if t % 7 == 0:
            targets = daily_targets(user.profile, user.goal, estimate_tdee(user.profile, history))
        true_tdee = user.tdee_multiplier * formula_tdee(user.profile, weight)
        logged = targets.kcal + rng.normal(0, 150)
        true_intake = logged / (1 - user.logging_bias)
        history.append(DayRecord(date(2026, 9, 1) + timedelta(days=t), logged, weight + rng.normal(0, 0.5)))
        weights.append(weight)
        weight += (true_intake - true_tdee) / KCAL_PER_KG
    return weights


def test_users_who_follow_lose_targets_lose_weight_safely():
    rng = np.random.default_rng(5)
    rates = []
    for _ in range(60):
        user = random_user(rng)
        if user.goal != "lose":
            continue
        weights = follow_targets(user, 70, rng)
        weekly_loss = (weights[35] - weights[63]) / 4  # weeks 6-9, after the model has adapted
        rates.append(weekly_loss / weights[35])
    rates = np.array(rates)
    assert len(rates) >= 20
    assert np.percentile(rates, 5) > 0.001   # nearly everyone loses (> 0.1% of body weight a week)
    assert np.median(rates) > 0.004          # typically ~0.5% a week
    assert np.percentile(rates, 95) < 0.012  # and almost never faster than ~1% a week
