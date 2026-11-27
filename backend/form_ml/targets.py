"""Daily calorie and macro targets from a TDEE estimate, first version.

Rules (deliberately simple, each one a number to tune later):
- Goal offset: lose = 500 kcal deficit, capped so loss never exceeds 1% of body weight a week
  (the cap uses the user's energy density per kg, not a flat 7700);
  maintain = 0; gain = 300 kcal surplus.
- Floor: never below the resting rate, as a conservative stand-in for an energy-availability check
  (that check needs fat-free mass, which we do not collect).
- Units: the adaptive TDEE is in the user's *logged* calories, which differ from real calories
  when someone under- or over-logs. The two safety limits (floor and loss cap) are computed in
  real calories, so they are scaled into logged units by estimate / formula before use.
- Protein 1.8 g per kg body weight (inside the 1.6-2.2 g/kg range for resistance training).
- Fat 25% of calories; carbohydrate takes the rest.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from .energy import KCAL_PER_KG, Profile, TdeeEstimate, energy_density, resting_rate

Goal = Literal["lose", "maintain", "gain"]

DEFICIT_KCAL = 500.0
SURPLUS_KCAL = 300.0
MAX_WEEKLY_LOSS_FRACTION = 0.01
# Bounds on the logged-to-real scale, so one bad stretch of data cannot collapse the safety limits.
MIN_UNIT_SCALE = 0.6
MAX_UNIT_SCALE = 1.4
PROTEIN_G_PER_KG = 1.8
FAT_FRACTION = 0.25


@dataclass(frozen=True)
class Targets:
    kcal: int
    protein_g: int
    carb_g: int
    fat_g: int
    tdee_estimate: int
    target_source: Literal["formula", "adaptive"]
    rationale: str


def unit_scale(estimate: TdeeEstimate) -> float:
    """Logged calories per real calorie, as far as the model can tell (1.0 for the formula)."""
    scale = estimate.tdee_kcal / estimate.formula_kcal
    return min(MAX_UNIT_SCALE, max(MIN_UNIT_SCALE, scale))


def goal_offset(goal: Goal, weight_kg: float, scale: float = 1.0, kcal_per_kg: float = KCAL_PER_KG) -> float:
    """kcal_per_kg is the real energy in a kg of weight change; daily_targets passes the user's."""
    if goal == "lose":
        max_daily_deficit = MAX_WEEKLY_LOSS_FRACTION * weight_kg * kcal_per_kg / 7 * scale
        return -min(DEFICIT_KCAL, max_daily_deficit)
    if goal == "gain":
        return SURPLUS_KCAL
    return 0.0


def rationale(estimate: TdeeEstimate) -> str:
    """The one line shown under the targets."""
    if estimate.source == "formula" or estimate.weight_change_kg is None:
        return "Starting estimate from your profile. It adapts after 2-3 weeks of logging."
    change = estimate.weight_change_kg
    direction = "held steady" if abs(change) < 0.1 else ("fell" if change < 0 else "rose")
    amount = "" if direction == "held steady" else f" {abs(change):.1f} kg"
    return (
        f"Weight trend {direction}{amount} over {estimate.window_days} days "
        f"on {estimate.mean_intake_kcal:,.0f} kcal average."
    )


def daily_targets(profile: Profile, goal: Goal, estimate: TdeeEstimate) -> Targets:
    weight = estimate.trend_weight_kg or profile.weight_kg
    scale = unit_scale(estimate)
    floor = resting_rate(profile.sex, weight, profile.height_cm, profile.age) * scale
    offset = goal_offset(goal, weight, scale, energy_density(profile, weight))
    kcal = max(floor, estimate.tdee_kcal + offset)

    protein_g = PROTEIN_G_PER_KG * weight
    fat_g = FAT_FRACTION * kcal / 9
    carb_g = max(0.0, (kcal - protein_g * 4 - fat_g * 9) / 4)

    return Targets(
        kcal=round(kcal),
        protein_g=round(protein_g),
        carb_g=round(carb_g),
        fat_g=round(fat_g),
        tdee_estimate=round(estimate.tdee_kcal),
        target_source=estimate.source,
        rationale=rationale(estimate),
    )
