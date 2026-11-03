"""Synthetic users with a known true TDEE, for developing and checking the energy model.

Each user has:
- a true TDEE that is their formula value times a personal multiplier (people differ by
  roughly +/-10-20% from any formula), recomputed daily as their weight changes
- a logging bias: they log a fixed fraction less than they actually eat, plus daily noise
- a goal that sets how far they eat from their true TDEE
- noisy weigh-ins (water swings), missed weigh-ins and missed logging days

Weight follows energy balance: each day's true surplus or deficit / 7700 kcal per kg.

`Realism` adds what makes real logs messy, so the model can be tested against it: days where a
meal was forgotten, weekends that run higher and are logged less carefully, water retention that
lingers for days after a salty meal, and multi-day gaps in weighing and logging. It is off unless
passed, so results without it stay reproducible.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta

import numpy as np

from .energy import ACTIVITY_FACTORS, KCAL_PER_KG, DayRecord, Profile, formula_tdee
from .targets import Goal

GOAL_OFFSETS: dict[str, float] = {"lose": -500.0, "maintain": 0.0, "gain": 300.0}


@dataclass(frozen=True)
class SyntheticUser:
    profile: Profile
    goal: Goal
    tdee_multiplier: float
    logging_bias: float
    intake_noise_kcal: float = 350.0
    logging_noise: float = 0.08
    weight_noise_kg: float = 0.5
    p_missed_weigh_in: float = 0.25
    p_missed_log: float = 0.1


@dataclass(frozen=True)
class Realism:
    """Messiness of real logging. Probabilities are per day."""

    p_partial_log: float = 0.10          # a meal forgotten: only part of the day is logged
    p_partial_log_weekend: float = 0.25
    partial_fraction: tuple[float, float] = (0.3, 0.7)
    weekend_extra_kcal: float = 300.0    # Saturdays and Sundays run higher
    water_persistence: float = 0.75      # day-to-day carryover of retained water
    water_noise_kg: float = 0.2
    p_water_spike: float = 0.06          # a salty or high-carb meal
    water_spike_kg: tuple[float, float] = (0.7, 1.5)
    p_gap_start: float = 0.03            # a stretch with no weigh-ins or logs (travel, illness)
    gap_days: tuple[int, int] = (3, 8)


@dataclass
class SyntheticRun:
    user: SyntheticUser
    records: list[DayRecord] = field(default_factory=list)
    true_weight_kg: list[float] = field(default_factory=list)
    true_tdee_kcal: list[float] = field(default_factory=list)
    true_intake_kcal: list[float] = field(default_factory=list)


def random_user(rng: np.random.Generator) -> SyntheticUser:
    sex = "male" if rng.random() < 0.5 else "female"
    height = rng.normal(178, 7) if sex == "male" else rng.normal(165, 6)
    weight = rng.normal(84, 12) if sex == "male" else rng.normal(68, 10)
    profile = Profile(
        sex=sex,
        age=int(rng.integers(18, 46)),
        height_cm=float(height),
        weight_kg=float(np.clip(weight, 48, 140)),
        activity_level=rng.choice(list(ACTIVITY_FACTORS)),
    )
    return SyntheticUser(
        profile=profile,
        goal=rng.choice(["lose", "maintain", "gain"], p=[0.5, 0.3, 0.2]),
        tdee_multiplier=float(np.clip(rng.normal(1.0, 0.1), 0.8, 1.2)),
        logging_bias=float(rng.uniform(0.0, 0.25)),
    )


def simulate(
    user: SyntheticUser,
    days: int,
    rng: np.random.Generator,
    start: date = date(2026, 9, 1),
    realism: Realism | None = None,
) -> SyntheticRun:
    if realism is not None:
        return _simulate_realistic(user, days, rng, start, realism)
    run = SyntheticRun(user=user)
    weight = user.profile.weight_kg
    for t in range(days):
        true_tdee = user.tdee_multiplier * formula_tdee(user.profile, weight)
        intake = max(800.0, true_tdee + GOAL_OFFSETS[user.goal] + rng.normal(0, user.intake_noise_kcal))
        logged_fraction = 1 - user.logging_bias + rng.normal(0, user.logging_noise)

        run.true_weight_kg.append(weight)
        run.true_tdee_kcal.append(true_tdee)
        run.true_intake_kcal.append(intake)
        run.records.append(
            DayRecord(
                day=start + timedelta(days=t),
                kcal_in=None if rng.random() < user.p_missed_log else intake * logged_fraction,
                weight_kg=None
                if rng.random() < user.p_missed_weigh_in
                else weight + rng.normal(0, user.weight_noise_kg),
            )
        )
        weight += (intake - true_tdee) / KCAL_PER_KG
    return run


def _simulate_realistic(
    user: SyntheticUser, days: int, rng: np.random.Generator, start: date, r: Realism
) -> SyntheticRun:
    run = SyntheticRun(user=user)
    weight = user.profile.weight_kg
    water = 0.0
    gap_left = 0
    for t in range(days):
        day = start + timedelta(days=t)
        weekend = day.weekday() >= 5
        true_tdee = user.tdee_multiplier * formula_tdee(user.profile, weight)
        intake = true_tdee + GOAL_OFFSETS[user.goal] + rng.normal(0, user.intake_noise_kcal)
        if weekend:
            intake += r.weekend_extra_kcal
        intake = max(800.0, intake)

        logged_fraction = 1 - user.logging_bias + rng.normal(0, user.logging_noise)
        if rng.random() < (r.p_partial_log_weekend if weekend else r.p_partial_log):
            logged_fraction *= rng.uniform(*r.partial_fraction)

        # Retained water is not body mass: it moves the scale but carries no energy.
        water = r.water_persistence * water + rng.normal(0, r.water_noise_kg)
        if rng.random() < r.p_water_spike:
            water += rng.uniform(*r.water_spike_kg)

        if gap_left == 0 and rng.random() < r.p_gap_start:
            gap_left = int(rng.integers(r.gap_days[0], r.gap_days[1] + 1))
        in_gap = gap_left > 0
        gap_left = max(0, gap_left - 1)

        run.true_weight_kg.append(weight)
        run.true_tdee_kcal.append(true_tdee)
        run.true_intake_kcal.append(intake)
        missed_log = in_gap or rng.random() < user.p_missed_log
        missed_weigh_in = in_gap or rng.random() < user.p_missed_weigh_in
        run.records.append(
            DayRecord(
                day=day,
                kcal_in=None if missed_log else intake * logged_fraction,
                weight_kg=None if missed_weigh_in else weight + water + rng.normal(0, 0.3),
            )
        )
        weight += (intake - true_tdee) / KCAL_PER_KG
    return run


def population(n: int, days: int, seed: int = 7, realism: Realism | None = None) -> list[SyntheticRun]:
    rng = np.random.default_rng(seed)
    return [simulate(random_user(rng), days, rng, realism=realism) for _ in range(n)]
