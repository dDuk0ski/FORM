"""Adaptive energy expenditure (TDEE) model, first version.

How the estimate is built:

1. Prior: Mifflin-St Jeor resting rate times an activity factor. This is all a new user has.
2. Trend weight: exponential smoothing of daily weigh-ins (alpha 0.1). Missing days are skipped,
   so the trend simply carries forward.
3. Observed TDEE over a trailing window: mean logged intake minus the energy that went into or
   came out of body mass (7700 kcal per kg), using the weight slope over the window.
4. Blend: the weight on the observed value ramps from 0 at 7 logged days to 1 at 21 logged days.

Two guards against messy real logs (version 2):
- Incomplete days: a day logged far below the user's normal (under 60% of the window median) is
  almost always a forgotten meal, not a fast. Those days are left out of the mean intake, so they
  do not drag the estimate, and the targets, down.
- Robust slope: the weight slope is a Huber regression, so a few water-inflated weigh-ins after a
  salty meal pull on it far less than they would on ordinary least squares.

Because the observed value uses *logged* intake, a user who consistently under-logs gets a lower
TDEE in the same units they log in. Targets set from it still move their real weight correctly,
which is why logging does not have to be perfect.

Units and energy density (version 3):
- Everything is kept in logged calories. Weight change is energy in real calories, so the
  stored-energy term is scaled by the share of food people typically log (LOGGED_SHARE_PRIOR);
  so is the formula prior. Without this the estimate ran high by roughly (share not logged) x
  (the user's deficit), and the day-one estimate by (share not logged) x TDEE.
- A kilogram of weight change is not always 7700 kcal. Leaner people lose and gain more lean
  tissue per kilogram, which holds far less energy than fat (Forbes; Hall 2008). The energy
  density comes from body fat, which is estimated from BMI, age and sex (Deurenberg 1991).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Literal, Sequence

import numpy as np

KCAL_PER_KG = 7700.0                 # classic rule; kept as the reference value
LOGGED_SHARE_PRIOR = 0.875           # people log ~12.5% less than they eat (doubly labelled water)
FAT_KCAL_PER_KG = 9440.0             # Hall 2008
LEAN_KCAL_PER_KG = 1816.0
FORBES_C_KG = 10.4                   # Forbes partition constant
TREND_ALPHA = 0.1
WINDOW_DAYS = 28
RAMP_START_DAYS = 7
RAMP_FULL_DAYS = 21
MIN_WEIGH_INS = 4
INCOMPLETE_FRACTION = 0.6
MIN_DAYS_FOR_FILTER = 7
HUBER_K = 1.345

Sex = Literal["male", "female"]
ActivityLevel = Literal["sedentary", "light", "moderate", "active", "very_active"]
SlopeMethod = Literal["robust", "regression", "trend"]

ACTIVITY_FACTORS: dict[str, float] = {
    "sedentary": 1.2,
    "light": 1.375,
    "moderate": 1.55,
    "active": 1.725,
    "very_active": 1.9,
}


@dataclass(frozen=True)
class Profile:
    sex: Sex
    age: int
    height_cm: float
    weight_kg: float
    activity_level: ActivityLevel


@dataclass(frozen=True)
class DayRecord:
    """One day of a user's data. None means not logged, never zero."""

    day: date
    kcal_in: float | None
    weight_kg: float | None


@dataclass(frozen=True)
class TdeeEstimate:
    tdee_kcal: float
    formula_kcal: float              # real kcal; the prior used is this x LOGGED_SHARE_PRIOR
    observed_kcal: float | None
    weight_on_observed: float
    source: Literal["formula", "adaptive"]
    logged_days: int
    mean_intake_kcal: float | None
    weight_change_kg: float | None
    window_days: int
    trend_weight_kg: float | None


def resting_rate(sex: Sex, weight_kg: float, height_cm: float, age: int) -> float:
    """Mifflin-St Jeor resting energy expenditure, kcal/day."""
    base = 10.0 * weight_kg + 6.25 * height_cm - 5.0 * age
    return base + 5.0 if sex == "male" else base - 161.0


def body_fat_kg(sex: Sex, weight_kg: float, height_cm: float, age: int) -> float:
    """Body fat estimated from BMI, age and sex (Deurenberg 1991), floored at 3 kg."""
    bmi = weight_kg / (height_cm / 100) ** 2
    pct = 1.2 * bmi + 0.23 * age - 10.8 * (sex == "male") - 5.4
    return max(3.0, pct / 100 * weight_kg)


def energy_density(profile: Profile, weight_kg: float | None = None) -> float:
    """Real kcal per kg of weight change, from the Forbes share of lean tissue in that change."""
    weight = profile.weight_kg if weight_kg is None else weight_kg
    fat = body_fat_kg(profile.sex, weight, profile.height_cm, profile.age)
    lean_share = FORBES_C_KG / (FORBES_C_KG + fat)
    return lean_share * LEAN_KCAL_PER_KG + (1 - lean_share) * FAT_KCAL_PER_KG


def logged_kcal_per_kg(profile: Profile, weight_kg: float | None = None) -> float:
    """Logged kcal per kg of weight change: the factor between weight change and logged intake."""
    return energy_density(profile, weight_kg) * LOGGED_SHARE_PRIOR


def formula_tdee(profile: Profile, weight_kg: float | None = None) -> float:
    """Resting rate times activity factor. Uses the given weight if newer than the profile's."""
    weight = profile.weight_kg if weight_kg is None else weight_kg
    rmr = resting_rate(profile.sex, weight, profile.height_cm, profile.age)
    return rmr * ACTIVITY_FACTORS[profile.activity_level]


def trend_weights(weights: Sequence[float | None], alpha: float = TREND_ALPHA) -> list[float | None]:
    """Exponentially smoothed weight. Days before the first weigh-in stay None."""
    trend: list[float | None] = []
    current: float | None = None
    for w in weights:
        if w is not None:
            current = w if current is None else current + alpha * (w - current)
        trend.append(current)
    return trend


def typical_intakes(intakes: Sequence[float]) -> list[float]:
    """Logged intakes without the days that were clearly logged incomplete.

    Needs a week of logs to know what normal is; with fewer, every day counts.
    """
    if len(intakes) < MIN_DAYS_FOR_FILTER:
        return list(intakes)
    cutoff = INCOMPLETE_FRACTION * float(np.median(intakes))
    return [k for k in intakes if k >= cutoff]


def huber_slope(xs: np.ndarray, ys: np.ndarray, iterations: int = 25) -> float:
    """Slope of a Huber regression, fitted by iteratively reweighted least squares.

    Residuals within HUBER_K robust standard deviations count fully; larger ones count less
    the further out they are.
    """
    slope, intercept = np.polyfit(xs, ys, 1)
    for _ in range(iterations):
        residuals = ys - (intercept + slope * xs)
        scale = 1.4826 * float(np.median(np.abs(residuals - np.median(residuals))))
        if scale < 1e-9:
            break
        cutoff = HUBER_K * scale
        weights = np.minimum(1.0, cutoff / np.maximum(np.abs(residuals), 1e-12))
        new_slope, new_intercept = np.polyfit(xs, ys, 1, w=np.sqrt(weights))
        if abs(new_slope - slope) < 1e-7:
            slope, intercept = new_slope, new_intercept
            break
        slope, intercept = new_slope, new_intercept
    return float(slope)


def weight_slope(
    days: Sequence[DayRecord], method: SlopeMethod = "robust", alpha: float = TREND_ALPHA
) -> float | None:
    """Body-weight change in kg/day across the given days, or None without enough weigh-ins.

    "robust": Huber regression on the raw weigh-ins. Like "regression", but outliers count less.
    "regression": least-squares slope of the raw weigh-ins. No lag, a little noisier.
    "trend": change in the smoothed trend between the first and last day. Smoother, but lags
    behind real change for the first couple of weeks of a user's history.
    """
    xs = [i for i, d in enumerate(days) if d.weight_kg is not None]
    if len(xs) < MIN_WEIGH_INS or xs[-1] - xs[0] < RAMP_START_DAYS:
        return None
    if method in ("robust", "regression"):
        x = np.asarray(xs, dtype=float)
        y = np.asarray([days[i].weight_kg for i in xs], dtype=float)
        if method == "robust":
            return huber_slope(x, y)
        slope, _ = np.polyfit(x, y, 1)
        return float(slope)
    trend = trend_weights([d.weight_kg for d in days], alpha)
    first, last = trend[xs[0]], trend[-1]
    assert first is not None and last is not None
    return (last - first) / (len(days) - 1 - xs[0])


def observed_tdee(
    days: Sequence[DayRecord],
    method: SlopeMethod = "robust",
    filter_incomplete: bool = True,
    kcal_per_kg: float = KCAL_PER_KG,
) -> float | None:
    """Mean logged intake minus energy stored in body mass, over the given days.

    kcal_per_kg converts the weight slope into the units of the intake; estimate_tdee passes
    the user's logged_kcal_per_kg.
    """
    intakes = [d.kcal_in for d in days if d.kcal_in is not None]
    if filter_incomplete:
        intakes = typical_intakes(intakes)
    slope = weight_slope(days, method)
    if not intakes or slope is None:
        return None
    return float(np.mean(intakes)) - slope * kcal_per_kg


def observed_weight(logged_days: int) -> float:
    """How much to trust the observed value: 0 below 7 logged days, 1 from 21 on."""
    span = RAMP_FULL_DAYS - RAMP_START_DAYS
    return min(1.0, max(0.0, (logged_days - RAMP_START_DAYS) / span))


def estimate_tdee(
    profile: Profile,
    history: Sequence[DayRecord],
    window_days: int = WINDOW_DAYS,
    method: SlopeMethod = "robust",
    filter_incomplete: bool = True,
) -> TdeeEstimate:
    """Today's TDEE estimate from the profile and the user's history (oldest first)."""
    trend = trend_weights([d.weight_kg for d in history])
    latest_trend = next((t for t in reversed(trend) if t is not None), None)
    formula = formula_tdee(profile, latest_trend)
    prior = formula * LOGGED_SHARE_PRIOR      # the formula is in real kcal; estimates are logged

    window = list(history[-window_days:])
    intakes = [d.kcal_in for d in window if d.kcal_in is not None]
    logged = len(intakes)
    if filter_incomplete:
        intakes = typical_intakes(intakes)
    observed = observed_tdee(window, method, filter_incomplete, logged_kcal_per_kg(profile, latest_trend))
    slope = weight_slope(window, method)

    weight = observed_weight(logged) if observed is not None else 0.0
    tdee = prior if observed is None else (1 - weight) * prior + weight * observed

    return TdeeEstimate(
        tdee_kcal=tdee,
        formula_kcal=formula,
        observed_kcal=observed,
        weight_on_observed=weight,
        source="adaptive" if weight > 0 else "formula",
        logged_days=logged,
        mean_intake_kcal=float(np.mean(intakes)) if intakes else None,
        weight_change_kg=None if slope is None else slope * (len(window) - 1),
        window_days=len(window),
        trend_weight_kg=latest_trend,
    )
