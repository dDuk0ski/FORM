from __future__ import annotations

from dataclasses import asdict, is_dataclass
from typing import Any, Iterable


def _recommendation_data(recommendation: Any) -> dict[str, Any]:
    if isinstance(recommendation, dict):
        return recommendation
    if is_dataclass(recommendation):
        return asdict(recommendation)
    raise TypeError("recommendation must be a dictionary or dataclass instance")


def apply_recommendation_to_exercise(exercise: Any, recommendation: Any) -> None:
    data = _recommendation_data(recommendation)
    values = {
        "sets": data["recommended_sets"],
        "rep_range": list(data["recommended_rep_range"]),
        "rir": data["target_rir"],
        "weight": data["recommended_weight"],
    }
    for key, value in values.items():
        if isinstance(exercise, dict):
            exercise[key] = value
        else:
            setattr(exercise, key, value)


def apply_recommendations_to_program(
    workouts: Iterable[Any],
    recommendations: dict[str, Any],
) -> dict[str, int]:
    updated = 0
    unmatched = 0
    for workout in workouts:
        exercises = workout.get("exercises", []) if isinstance(workout, dict) else workout.exercises
        for exercise in exercises:
            exercise_id = exercise.get("exercise_id") if isinstance(exercise, dict) else exercise.exercise_id
            recommendation = recommendations.get(str(exercise_id))
            if recommendation is None:
                unmatched += 1
                continue
            apply_recommendation_to_exercise(exercise, recommendation)
            updated += 1
    return {"updated": updated, "unmatched": unmatched}
