from __future__ import annotations

import argparse
import json
import math
import random
import uuid
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_EXERCISE_FILE = BASE_DIR / "normalized_exercises.json"
DEFAULT_OUTPUT_FILE = BASE_DIR / "example_workouts.json"
DEFAULT_RESULT_FILE = BASE_DIR / "example_workout_results.json"


@dataclass
class WorkoutRequest:
    goal: str = "hypertrophy"
    experience: str = "intermediate"
    days_per_week: int = 4
    split: str = "upper_lower"
    duration_minutes: int = 60
    equipment: list[str] = field(default_factory=lambda: ["barbell", "dumbbell", "cable", "body_weight"])
    preferences: dict[str, Any] = field(default_factory=lambda: {"compound_priority": 0.7, "isolation_priority": 0.3, "exercise_variety": 0.5, "free_weight_preference": 0.5, "machine_preference": 0.5})
    excluded_exercises: list[str] = field(default_factory=list)
    excluded_muscles: list[str] = field(default_factory=list)
    seed: int | None = 42
    split_rotation_index: int = 0


@dataclass
class ExerciseSlot:
    target_muscle: str
    movement_pattern: str | None
    compound: bool | None
    priority: int
    sets: int
    role: str


@dataclass
class WorkoutExercise:
    exercise_id: str
    name: str
    target_muscles: list[str]
    primary_muscle: str | None
    movement_pattern: str | None
    compound: bool
    equipment: list[str]
    sets: int
    rep_range: list[int]
    rir: int
    rest_seconds: int
    role: str
    selection_score: float
    secondary_muscles: list[str] = field(default_factory=list)


@dataclass
class TrainingDay:
    day: int
    name: str
    focus: str
    target_muscles: list[str]
    split_day_index: int = 0
    split_cycle_length: int = 1
    exercises: list[WorkoutExercise] = field(default_factory=list)


@dataclass
class Workout:
    id: str
    name: str
    goal: str
    split: str
    duration_minutes: int
    estimated_minutes: int
    training_day: int
    focus: str
    exercises: list[WorkoutExercise]
    volume: dict[str, int]
    validation: dict[str, Any]
    unfulfilled_volume: dict[str, int] = field(default_factory=dict)
    split_day_index: int = 0
    split_cycle_length: int = 1

@dataclass
class WorkoutResult:
    workout_id: str
    completed: bool
    exercises: list[dict[str, Any]] = field(default_factory=list)
    recovery_score: float | None = None
    adherence_score: float | None = None
    notes: str = ""


@dataclass
class BayesianPosterior:
    alpha: float = 1.0
    beta: float = 1.0

    @property
    def mean(self) -> float:
        return self.alpha / (self.alpha + self.beta)

    def update(self, success: bool, weight: float = 1.0) -> None:
        if success:
            self.alpha += weight
        else:
            self.beta += weight


class ExerciseDatabase:
    REQUIRED_FIELDS = ("id", "name", "classification", "equipment", "muscles", "movement")

    def __init__(self, path: str | Path):
        self.path = Path(path).expanduser().resolve()
        if not self.path.exists():
            raise FileNotFoundError(f"Exercise database not found: {self.path}")
        try:
            with self.path.open("r", encoding="utf-8-sig") as file:
                data = json.load(file)
        except json.JSONDecodeError as error:
            raise ValueError(f"Invalid JSON in {self.path}: {error}") from error
        if isinstance(data, dict):
            data = data.get("exercises")
        if not isinstance(data, list):
            raise ValueError("normalized_exercises.json must be a JSON list or an object containing an 'exercises' list.")
        self.exercises = []
        self.rejected_records = []
        seen_ids = set()
        for index, item in enumerate(data):
            problems = self.validate_record(item)
            if problems:
                self.rejected_records.append({"index": index, "problems": problems})
                continue
            exercise_id = str(item["id"])
            if exercise_id in seen_ids:
                self.rejected_records.append({"index": index, "problems": [f"duplicate exercise id: {exercise_id}"]})
                continue
            seen_ids.add(exercise_id)
            normalized = dict(item)
            normalized["id"] = exercise_id
            normalized["name"] = str(item["name"]).strip()
            normalized["equipment"] = self._as_string_list(item.get("equipment"))
            normalized["muscles"] = dict(item.get("muscles") or {})
            for key in ("primary", "secondary", "groups"):
                normalized["muscles"][key] = self._as_string_list(normalized["muscles"].get(key))
            normalized["classification"] = dict(item.get("classification") or {})
            normalized["movement"] = dict(item.get("movement") or {})
            normalized["movement"]["pattern"] = self._optional_string(normalized["movement"].get("pattern"))
            normalized["movement"]["compound"] = normalized["movement"].get("compound")
            self.exercises.append(normalized)
        if not self.exercises:
            examples = self.rejected_records[:5]
            raise ValueError(f"No valid exercises were loaded from {self.path}. First rejected records: {examples}")
        self.by_id = {item["id"]: item for item in self.exercises}
        self.category_counts = {}
        for item in self.exercises:
            category = str((item.get("classification") or {}).get("category") or "uncategorized")
            self.category_counts[category] = self.category_counts.get(category, 0) + 1

    @staticmethod
    def _as_string_list(value: Any) -> list[str]:
        if value is None:
            return []
        if isinstance(value, str):
            return [value.strip()] if value.strip() else []
        if isinstance(value, list):
            return [str(item).strip() for item in value if str(item).strip()]
        return []

    @staticmethod
    def _optional_string(value: Any) -> str | None:
        if value is None:
            return None
        value = str(value).strip()
        return value or None

    @classmethod
    def validate_record(cls, item: Any) -> list[str]:
        if not isinstance(item, dict):
            return ["record is not an object"]
        problems = []
        for key in ("id", "name"):
            if item.get(key) is None or not str(item.get(key)).strip():
                problems.append(f"missing or empty '{key}'")
        for key in ("classification", "muscles", "movement"):
            if not isinstance(item.get(key), dict):
                problems.append(f"'{key}' must be an object")
        if not isinstance(item.get("equipment"), (list, str, type(None))):
            problems.append("'equipment' must be a list or string")
        muscles = item.get("muscles") if isinstance(item.get("muscles"), dict) else {}
        if not any(muscles.get(key) for key in ("primary", "secondary", "groups")):
            problems.append("'muscles' must contain at least one of primary, secondary, or groups")
        movement = item.get("movement") if isinstance(item.get("movement"), dict) else {}
        if movement.get("compound") is not None and not isinstance(movement.get("compound"), bool):
            problems.append("'movement.compound' must be true, false, or null")
        return problems

    @staticmethod
    def classification(exercise: dict[str, Any]) -> dict[str, Any]:
        return exercise.get("classification") or {}

    @staticmethod
    def muscles(exercise: dict[str, Any]) -> dict[str, Any]:
        return exercise.get("muscles") or {}

    @staticmethod
    def movement(exercise: dict[str, Any]) -> dict[str, Any]:
        return exercise.get("movement") or {}

    @staticmethod
    def equipment(exercise: dict[str, Any]) -> list[str]:
        return ExerciseDatabase._as_string_list(exercise.get("equipment"))

    def query(self, muscle: str | None = None, movement_pattern: str | None = None, compound: bool | None = None, equipment: list[str] | None = None, category: str | None = "strength", exclude_ids: set[str] | None = None) -> list[dict[str, Any]]:
        excluded = exclude_ids or set()
        available_equipment = set(equipment or [])
        output = []
        for exercise in self.exercises:
            exercise_id = str(exercise.get("id", ""))
            if exercise_id in excluded:
                continue
            classification = self.classification(exercise)
            muscles = self.muscles(exercise)
            movement = self.movement(exercise)
            if category and str(classification.get("category", "")).lower() != category.lower():
                continue
            if muscle:
                values = set(muscles.get("primary") or []) | set(muscles.get("secondary") or []) | set(muscles.get("groups") or [])
                if muscle not in values:
                    parent_children = ExerciseSelector.PARENT_TO_CHILDREN.get(muscle, set())
                    if not values.intersection(parent_children):
                        continue
            if movement_pattern and movement.get("pattern") != movement_pattern:
                continue
            if compound is not None and movement.get("compound") is not compound:
                continue
            required_equipment = set(self.equipment(exercise))
            if not required_equipment.issubset(available_equipment):
                continue
            output.append(exercise)
        return output

    def search(self, text: str) -> list[dict[str, Any]]:
        query = text.lower()
        return [item for item in self.exercises if query in str(item.get("name", "")).lower()]


class SplitGenerator:
    SPLITS = {
        "full_body": [
            ("Full Body A", "full_body", ["chest", "back", "quadriceps", "hamstrings", "shoulders", "side_delts", "rear_delts", "biceps", "triceps", "glutes", "calves", "core", "forearms"]),
            ("Full Body B", "full_body", ["chest", "back", "quadriceps", "hamstrings", "shoulders", "side_delts", "rear_delts", "biceps", "triceps", "glutes", "calves", "core", "forearms"]),
            ("Full Body C", "full_body", ["chest", "back", "quadriceps", "hamstrings", "shoulders", "side_delts", "rear_delts", "biceps", "triceps", "glutes", "calves", "core", "forearms"]),
            ("Full Body D", "full_body", ["chest", "back", "quadriceps", "hamstrings", "shoulders", "side_delts", "rear_delts", "biceps", "triceps", "glutes", "calves", "core", "forearms"]),
        ],
        "upper_lower": [
            ("Upper A", "upper", ["chest", "back", "shoulders", "side_delts", "rear_delts", "biceps", "triceps", "forearms"]),
            ("Lower A", "lower", ["quadriceps", "hamstrings", "glutes", "calves", "core"]),
            ("Upper B", "upper", ["chest", "back", "shoulders", "side_delts", "rear_delts", "biceps", "triceps", "forearms"]),
            ("Lower B", "lower", ["quadriceps", "hamstrings", "glutes", "calves", "core"]),
        ],
        "push_pull_legs": [
            ("Push", "push", ["chest", "shoulders", "side_delts", "triceps"]),
            ("Pull", "pull", ["back", "rear_delts", "biceps", "forearms"]),
            ("Legs", "legs", ["quadriceps", "hamstrings", "glutes", "calves", "core"]),
        ],
        "ppl_upper_lower": [
            ("Push", "push", ["chest", "shoulders", "side_delts", "triceps"]),
            ("Pull", "pull", ["back", "rear_delts", "biceps", "forearms"]),
            ("Legs", "legs", ["quadriceps", "hamstrings", "glutes", "calves", "core"]),
            ("Upper", "upper", ["chest", "back", "shoulders", "side_delts", "rear_delts", "biceps", "triceps", "forearms"]),
            ("Lower", "lower", ["quadriceps", "hamstrings", "glutes", "calves", "core"]),
        ],
        "bro_split": [
            ("Chest and Triceps", "chest_triceps", ["chest", "triceps"]),
            ("Back and Biceps", "back_biceps", ["back", "biceps", "forearms"]),
            ("Legs", "legs", ["quadriceps", "hamstrings", "glutes", "calves", "core"]),
            ("Shoulders", "shoulders", ["shoulders", "side_delts", "rear_delts"]),
            ("Arms", "arms", ["biceps", "triceps", "forearms"]),
        ],
    }

    def generate(self, request: WorkoutRequest) -> list[TrainingDay]:
        split = request.split.lower()
        if split not in self.SPLITS:
            raise ValueError(f"Unsupported split: {request.split}")
        count = max(1, min(7, int(request.days_per_week)))
        templates = self.SPLITS[split]
        start_index = int(request.split_rotation_index) % len(templates)
        days = []
        for index in range(count):
            split_day_index = (start_index + index) % len(templates)
            name, focus, muscles = templates[split_day_index]
            days.append(TrainingDay(index + 1, name, focus, list(muscles), split_day_index, len(templates)))
        return days


class VolumeAllocator:
    BASE = {
        "beginner": {"chest": 8, "back": 10, "shoulders": 6, "side_delts": 4, "rear_delts": 4, "biceps": 6, "triceps": 6, "quadriceps": 8, "hamstrings": 6, "glutes": 6, "calves": 6, "core": 6, "forearms": 4},
        "intermediate": {"chest": 12, "back": 14, "shoulders": 8, "side_delts": 6, "rear_delts": 6, "biceps": 8, "triceps": 8, "quadriceps": 10, "hamstrings": 8, "glutes": 8, "calves": 8, "core": 8, "forearms": 6},
        "advanced": {"chest": 16, "back": 18, "shoulders": 10, "side_delts": 8, "rear_delts": 8, "biceps": 10, "triceps": 10, "quadriceps": 12, "hamstrings": 10, "glutes": 10, "calves": 10, "core": 10, "forearms": 8},
    }

    def __init__(self, request: WorkoutRequest):
        self.request = request
        experience = request.experience if request.experience in self.BASE else "intermediate"
        self.weekly = dict(self.BASE[experience])
        if request.goal == "strength":
            self.weekly = {muscle: max(4, round(value * 0.8)) for muscle, value in self.weekly.items()}
        elif request.goal == "general_fitness":
            self.weekly = {muscle: max(3, round(value * 0.65)) for muscle, value in self.weekly.items()}
        requested = request.preferences.get("target_muscles")
        if requested:
            requested_set = set(requested)
            self.weekly = {muscle: sets for muscle, sets in self.weekly.items() if muscle in requested_set}
        for muscle in request.excluded_muscles:
            self.weekly.pop(muscle, None)
        self.requested_weekly_targets = dict(self.weekly)
        self.scheduled_weekly_targets = dict(self.weekly)
        self.day_allocations: dict[tuple[int, str], int] = {}
        self.unscheduled_muscles: list[str] = []

    def muscles_for_day(self, focus: str, requested: list[str]) -> list[str]:
        aliases = {
            "upper": ["chest", "back", "shoulders", "side_delts", "rear_delts", "biceps", "triceps", "forearms"],
            "lower": ["quadriceps", "hamstrings", "glutes", "calves", "core"],
            "push": ["chest", "shoulders", "side_delts", "triceps"],
            "pull": ["back", "rear_delts", "biceps", "forearms"],
            "legs": ["quadriceps", "hamstrings", "glutes", "calves", "core"],
            "full_body": ["chest", "back", "quadriceps", "hamstrings", "shoulders", "side_delts", "rear_delts", "biceps", "triceps", "glutes", "calves", "core", "forearms"],
            "chest_triceps": ["chest", "triceps"],
            "back_biceps": ["back", "biceps", "forearms"],
            "shoulders": ["shoulders", "side_delts", "rear_delts"],
            "arms": ["biceps", "triceps", "forearms"],
        }
        allowed = aliases.get(focus, requested)
        if requested:
            allowed = [muscle for muscle in allowed if muscle in set(requested)]
        return [muscle for muscle in allowed if muscle in self.weekly]

    def prepare_week(self, days: list[TrainingDay]) -> None:
        exposures: dict[str, list[int]] = {muscle: [] for muscle in self.weekly}
        for day in days:
            requested = self.request.preferences.get("target_muscles", day.target_muscles)
            for muscle in self.muscles_for_day(day.focus, requested):
                exposures.setdefault(muscle, []).append(day.day)
        self.day_allocations.clear()
        self.unscheduled_muscles = sorted(muscle for muscle in self.weekly if not exposures.get(muscle))
        self.scheduled_weekly_targets = {
            muscle: sets for muscle, sets in self.requested_weekly_targets.items()
            if exposures.get(muscle)
        }
        for muscle, weekly_sets in self.scheduled_weekly_targets.items():
            day_numbers = exposures.get(muscle, [])
            if not day_numbers:
                continue
            base_sets, remainder = divmod(weekly_sets, len(day_numbers))
            for index, day_number in enumerate(day_numbers):
                self.day_allocations[(day_number, muscle)] = base_sets + (1 if index < remainder else 0)

    def day_volume(self, muscle: str, day_number: int, number_of_days: int | None = None, focus: str | None = None) -> int:
        return self.day_allocations.get((day_number, muscle), 0)


class MovementAllocator:
    PATTERNS = {
        "chest": [("horizontal_push", True, "primary_compound"), ("chest_isolation", False, "isolation")],
        "back": [("vertical_pull", True, "vertical_pull"), ("horizontal_pull", True, "horizontal_pull")],
        "shoulders": [("vertical_push", True, "press")],
        "side_delts": [("shoulder_abduction", False, "lateral_isolation")],
        "rear_delts": [("horizontal_pull", False, "rear_delt_isolation")],
        "biceps": [("elbow_flexion", False, "isolation")],
        "triceps": [("elbow_extension", False, "isolation")],
        "quadriceps": [("knee_dominant", True, "primary_compound")],
        "hamstrings": [("hip_dominant", True, "hip_hinge"), ("knee_flexion", False, "leg_curl")],
        "glutes": [("hip_dominant", True, "hip_dominant"), ("hip_extension", True, "hip_extension")],
        "calves": [("plantar_flexion", False, "calf")],
        "core": [("core", False, "core")],
        "forearms": [("forearm", False, "forearm")],
    }

    def create_slots(self, muscle: str, sets: int) -> list[ExerciseSlot]:
        if sets <= 0:
            return []
        patterns = self.PATTERNS.get(muscle, [(None, None, "accessory")])
        max_per_exercise = 5
        chunks = []
        remaining = sets
        while remaining > 0:
            chunk = min(max_per_exercise, remaining)
            chunks.append(chunk)
            remaining -= chunk
        slots = []
        for index, chunk in enumerate(chunks):
            pattern, compound, role = patterns[index % len(patterns)]
            slots.append(ExerciseSlot(muscle, pattern, compound, index + 1, chunk, role))
        return slots


class ExerciseSelector:
    PARENT_TO_CHILDREN = {
        "shoulders": {"front_delts", "side_delts", "rear_delts", "shoulders"},
        "back": {"lats", "upper_back", "lower_back", "upper_traps"},
        "arms": {"biceps", "triceps", "forearms"},
        "core": {"abs", "obliques", "serratus"},
        "quadriceps": {"quads"},
        "hamstrings": {"hamstrings"},
    }

    def __init__(self, database: ExerciseDatabase, request: WorkoutRequest, rng: random.Random):
        self.database = database
        self.request = request
        self.rng = rng
        self.recent_ids: set[str] = set()

    def muscle_match(self, exercise: dict[str, Any], target: str) -> float:
        muscles = exercise.get("muscles") or {}
        primary = set(muscles.get("primary") or [])
        secondary = set(muscles.get("secondary") or [])
        groups = set(muscles.get("groups") or [])
        if target in primary:
            return 1.0
        if target in groups:
            return 0.85
        if target in secondary:
            return 0.7
        children = self.PARENT_TO_CHILDREN.get(target, set())
        if primary.intersection(children):
            return 0.95
        if secondary.intersection(children):
            return 0.65
        return 0.0

    def equipment_score(self, exercise: dict[str, Any]) -> float:
        requested = set(self.request.equipment)
        if not requested:
            return 0.5
        actual = set(ExerciseDatabase.equipment(exercise))
        return 1.0 if actual.issubset(requested) else 0.0

    def preference_score(self, exercise: dict[str, Any]) -> float:
        compound = bool((exercise.get("movement") or {}).get("compound"))
        key = "compound_priority" if compound else "isolation_priority"
        return float(self.request.preferences.get(key, 0.5))

    def score(self, exercise: dict[str, Any], slot: ExerciseSlot) -> float:
        movement = exercise.get("movement") or {}
        muscle_score = self.muscle_match(exercise, slot.target_muscle)
        pattern_score = 1.0 if slot.movement_pattern and movement.get("pattern") == slot.movement_pattern else (0.35 if slot.movement_pattern is None else 0.0)
        compound_score = 1.0 if slot.compound is None or movement.get("compound") is slot.compound else 0.0
        equipment_score = self.equipment_score(exercise)
        preference_score = self.preference_score(exercise)
        category_score = 1.0 if (exercise.get("classification") or {}).get("category") == "strength" else 0.0
        recent_penalty = 0.12 if str(exercise.get("id")) in self.recent_ids else 0.0
        return muscle_score * 0.35 + pattern_score * 0.20 + compound_score * 0.10 + equipment_score * 0.15 + preference_score * 0.10 + category_score * 0.05 + 0.05 - recent_penalty

    def select(self, slot: ExerciseSlot, used_ids: set[str], current_workout_ids: set[str] | None = None) -> tuple[dict[str, Any], float]:
        excluded = used_ids | {str(value) for value in self.request.excluded_exercises}
        candidates = self.database.query(muscle=slot.target_muscle, movement_pattern=slot.movement_pattern, compound=slot.compound, equipment=self.request.equipment, category="strength", exclude_ids=excluded)
        if not candidates:
            candidates = self.database.query(muscle=slot.target_muscle, compound=slot.compound, equipment=self.request.equipment, category="strength", exclude_ids=excluded)
        if not candidates:
            candidates = self.database.query(muscle=slot.target_muscle, equipment=self.request.equipment, category="strength", exclude_ids=excluded)
        if not candidates:
            current_ids = current_workout_ids or set()
            relaxed_exclusions = current_ids | {str(value) for value in self.request.excluded_exercises}
            candidates = self.database.query(muscle=slot.target_muscle, equipment=self.request.equipment, category="strength", exclude_ids=relaxed_exclusions)
        if not candidates:
            raise ValueError(f"No exercise candidate found for {slot.target_muscle} with the requested equipment.")
        scored = sorted(((self.score(item, slot), item) for item in candidates), key=lambda pair: pair[0], reverse=True)
        top = scored[:min(5, len(scored))]
        score, exercise = self.rng.choice(top)
        self.recent_ids.add(str(exercise.get("id")))
        return exercise, score


class PrescriptionGenerator:
    RULES = {
        "strength": {"compound": ([3, 5], [3, 6], 3, 240), "isolation": ([2, 4], [6, 12], 2, 150)},
        "hypertrophy": {"compound": ([3, 4], [6, 10], 2, 180), "isolation": ([2, 4], [10, 15], 2, 90)},
        "general_fitness": {"compound": ([2, 3], [8, 12], 3, 120), "isolation": ([2, 3], [10, 20], 3, 75)},
    }

    def __init__(self, request: WorkoutRequest, rng: random.Random):
        self.request = request
        self.rng = rng

    def generate(self, slot: ExerciseSlot, actual_sets: int | None = None) -> tuple[list[int], int, int]:
        goal = self.request.goal if self.request.goal in self.RULES else "hypertrophy"
        rule = self.RULES[goal]["compound" if slot.compound else "isolation"]
        rep_range = list(rule[1])
        rir = rule[2]
        rest = rule[3]
        if self.request.experience == "beginner":
            rir += 1
        elif self.request.experience == "advanced":
            rir = max(1, rir - 1)
        if goal == "strength" and not slot.compound:
            rep_range = [8, 15]
        return rep_range, rir, rest


class WorkoutValidator:
    EXPERIENCE_EXERCISE_CAPS = {
        "beginner": 4,
        "intermediate": 6,
        "advanced": 8,
    }

    def __init__(self, request: WorkoutRequest):
        self.request = request
        self.max_exercises = self.EXPERIENCE_EXERCISE_CAPS.get(request.experience, 6)

    def estimate_exercise_minutes(self, exercise: WorkoutExercise) -> float:
        average_reps = sum(exercise.rep_range) / 2
        seconds_per_rep = 3.5
        execution_seconds = exercise.sets * average_reps * seconds_per_rep
        rest_seconds = max(0, exercise.sets - 1) * exercise.rest_seconds
        setup_seconds = 30
        return (execution_seconds + rest_seconds + setup_seconds) / 60

    def estimate_workout_minutes(self, exercises: list[WorkoutExercise]) -> int:
        if not exercises:
            return 0
        warmup_minutes = 5
        transition_seconds = max(0, len(exercises) - 1) * 45
        exercise_minutes = sum(self.estimate_exercise_minutes(item) for item in exercises)
        return math.ceil(warmup_minutes + transition_seconds / 60 + exercise_minutes)

    def validate(self, workout: Workout) -> dict[str, Any]:
        errors, warnings = [], []
        if not workout.exercises:
            errors.append("Workout contains no exercises.")
        ids = [exercise.exercise_id for exercise in workout.exercises]
        if len(ids) != len(set(ids)):
            errors.append("Workout contains duplicate exercises.")

        duration_limit = self.request.duration_minutes
        tolerance_minutes = max(5, round(duration_limit * 0.10))
        overage = workout.estimated_minutes - duration_limit
        if overage <= 0:
            duration_status = "within_limit"
        elif overage <= tolerance_minutes:
            duration_status = "slightly_over"
            warnings.append(
                f"Estimated workout duration is {overage} minutes over the requested "
                f"{duration_limit}-minute limit."
            )
        else:
            duration_status = "significantly_over"
            errors.append(
                f"Estimated workout duration is {workout.estimated_minutes} minutes, "
                f"which exceeds the requested {duration_limit}-minute limit by "
                f"{overage} minutes."
            )

        if len(workout.exercises) < 3:
            warnings.append("Workout has fewer than 3 exercises.")
        if len(workout.exercises) > self.max_exercises:
            errors.append(
                f"Workout has {len(workout.exercises)} exercises, exceeding the "
                f"{self.max_exercises}-exercise cap for {self.request.experience} experience."
            )
        if any(exercise.sets <= 0 for exercise in workout.exercises):
            errors.append("Exercise has zero or negative sets.")
        if any(exercise.sets > 5 for exercise in workout.exercises):
            warnings.append("An exercise has more than 5 working sets.")

        available_equipment = set(self.request.equipment)
        excluded_ids = {str(value) for value in self.request.excluded_exercises}
        for exercise in workout.exercises:
            required = set(exercise.equipment)
            if not required.issubset(available_equipment):
                errors.append(
                    f"Exercise '{exercise.name}' requires unavailable equipment: "
                    f"{sorted(required - available_equipment)}."
                )
            if exercise.exercise_id in excluded_ids:
                errors.append(f"Excluded exercise was selected: {exercise.name}.")

        for muscle in self.request.excluded_muscles:
            if workout.volume.get(muscle, 0) > 0:
                errors.append(f"Excluded muscle received direct volume: {muscle}.")

        return {
            "valid": not errors,
            "errors": errors,
            "warnings": warnings,
            "duration_status": duration_status,
            "duration_limit_minutes": duration_limit,
            "estimated_minutes": workout.estimated_minutes,
            "duration_overage_minutes": max(0, overage),
            "duration_tolerance_minutes": tolerance_minutes,
        }


class WeeklyVolumeValidator:
    def build_report(
        self,
        request: WorkoutRequest,
        workouts: list[Workout],
        targets: dict[str, int],
        unscheduled: list[str] | None = None,
        shortfall_reasons: dict[str, dict[str, int]] | None = None,
    ) -> dict[str, Any]:
        actual = {muscle: 0 for muscle in targets}
        effective: dict[str, float] = {}
        unfulfilled: dict[str, int] = {}
        for workout in workouts:
            for muscle, sets in workout.volume.items():
                actual[muscle] = actual.get(muscle, 0) + sets
            for muscle, sets in workout.unfulfilled_volume.items():
                unfulfilled[muscle] = unfulfilled.get(muscle, 0) + sets
            for exercise in workout.exercises:
                if exercise.primary_muscle:
                    effective[exercise.primary_muscle] = effective.get(exercise.primary_muscle, 0.0) + exercise.sets
                for muscle in exercise.secondary_muscles:
                    effective[muscle] = effective.get(muscle, 0.0) + exercise.sets * 0.5
        shortfall_reasons = shortfall_reasons or {}
        muscles = {}
        for muscle, target in targets.items():
            achieved = actual.get(muscle, 0)
            difference = achieved - target
            if achieved == target:
                status = "on_target"
            elif achieved < target:
                status = "under_target"
            else:
                status = "over_target"
            reasons = shortfall_reasons.get(muscle, {})
            if muscle in set(unscheduled or []):
                shortfall_reason = "split_coverage"
            elif reasons.get("time_limit", 0) > 0:
                shortfall_reason = "time_constraint"
            elif reasons.get("exercise_cap", 0) > 0:
                shortfall_reason = "exercise_cap"
            elif reasons.get("exercise_availability", 0) > 0:
                shortfall_reason = "exercise_availability"
            elif achieved < target:
                shortfall_reason = "other"
            else:
                shortfall_reason = None
            muscles[muscle] = {
                "target_sets": target,
                "allocated_sets": achieved,
                "difference": difference,
                "completion_percent": round((achieved / target) * 100, 1) if target else 100.0,
                "status": status,
                "effective_sets_estimate": round(effective.get(muscle, 0.0), 1),
                "unfulfilled_sets": unfulfilled.get(muscle, 0),
                "shortfall_reason": shortfall_reason,
                "shortfall_breakdown": {
                    "time_limit": reasons.get("time_limit", 0),
                    "exercise_cap": reasons.get("exercise_cap", 0),
                    "exercise_availability": reasons.get("exercise_availability", 0),
                },
            }
        missing = [muscle for muscle, values in muscles.items() if values["allocated_sets"] == 0 and values["target_sets"] > 0]
        under = [muscle for muscle, values in muscles.items() if values["status"] == "under_target"]
        over = [muscle for muscle, values in muscles.items() if values["status"] == "over_target"]
        unscheduled_set = set(unscheduled or [])
        scheduled_under = [muscle for muscle in under if muscle not in unscheduled_set]
        time_limited = [muscle for muscle, values in muscles.items() if values["shortfall_reason"] == "time_constraint"]
        cap_limited = [muscle for muscle, values in muscles.items() if values["shortfall_reason"] == "exercise_cap"]
        unavailable = [muscle for muscle, values in muscles.items() if values["shortfall_reason"] == "exercise_availability"]
        feedback = []
        if time_limited:
            details = ", ".join(
                f"{muscle} ({muscles[muscle]['allocated_sets']}/{muscles[muscle]['target_sets']} sets)"
                for muscle in time_limited
            )
            feedback.append({
                "type": "time_constraint",
                "severity": "info",
                "message": (
                    f"The recommended weekly volume could not be fully met within your "
                    f"{request.duration_minutes}-minute workout limit for: {details}. "
                    "Your workouts were kept within your available time. Increasing "
                    "session duration or adding another training day may help you get closer."
                ),
                "suggestion": "Increase workout duration or add a training day if your schedule allows.",
            })
        if unscheduled:
            feedback.append({
                "type": "split_coverage",
                "severity": "info",
                "message": (
                    "Some recommended muscle groups are not covered by the selected "
                    f"{request.split} split: {', '.join(unscheduled)}. This is a split-coverage "
                    "limitation, not a time-limit failure."
                ),
                "suggestion": "Choose a split that trains these muscle groups or adjust your target muscles.",
            })
        if cap_limited:
            feedback.append({
                "type": "exercise_cap",
                "severity": "info",
                "message": (
                    "Some weekly volume could not be scheduled because the workout "
                    "reached the exercise limit for your experience level: "
                    f"{', '.join(cap_limited)}."
                ),
                "suggestion": "Adding a training day or choosing a split with broader muscle coverage may help.",
            })
        if unavailable:
            feedback.append({
                "type": "exercise_availability",
                "severity": "warning",
                "message": (
                    "Some target volume could not be assigned because no eligible exercise "
                    f"was available for: {', '.join(unavailable)}. Equipment choices or exercise exclusions may be limiting selection."
                ),
                "suggestion": "Review available equipment and excluded exercises.",
            })
        return {
            "goal": request.goal,
            "experience": request.experience,
            "split": request.split,
            "days_per_week_requested": request.days_per_week,
            "days_generated": len(workouts),
            "muscles": muscles,
            "scheduled_targets_met": not scheduled_under and not over,
            "all_targets_met": not under and not over and not (unscheduled or []) and not unfulfilled,
            "under_target_muscles": under,
            "scheduled_under_target_muscles": scheduled_under,
            "over_target_muscles": over,
            "untrained_target_muscles": missing,
            "unallocated_target_muscles": unscheduled or [],
            "unfulfilled_sets_by_muscle": dict(sorted(unfulfilled.items())),
            "feedback": feedback,
            "duration_over_limit_workouts": [
                {
                    "training_day": workout.training_day,
                    "estimated_minutes": workout.estimated_minutes,
                    "requested_minutes": request.duration_minutes,
                    "duration_status": workout.validation.get("duration_status"),
                }
                for workout in workouts
                if workout.validation.get("duration_status") != "within_limit"
            ],
            "notes": [
                "Allocated sets are direct sets assigned to each target muscle.",
                "Effective sets are estimates using 1.0 credit for primary muscles and 0.5 for secondary muscles. They are informational and are not used to double-count the direct weekly targets.",
                "Unfulfilled sets represent requested direct volume for which no eligible unique exercise could be selected.",
                "The original weekly targets are retained in this report, including muscles that the selected split cannot schedule.",
            ],
        }


class WorkoutGenerator:
    def __init__(self, database: ExerciseDatabase, seed: int | None = 42):
        self.database = database
        self.rng = random.Random(seed)
        self.split_generator = SplitGenerator()
        self.last_weekly_volume_report: dict[str, Any] = {}

    def generate_program(self, request: WorkoutRequest) -> list[Workout]:
        days = self.split_generator.generate(request)
        volume_allocator = VolumeAllocator(request)
        volume_allocator.prepare_week(days)
        movement_allocator = MovementAllocator()
        selector = ExerciseSelector(self.database, request, self.rng)
        prescription = PrescriptionGenerator(request, self.rng)
        validator = WorkoutValidator(request)
        workouts: list[Workout] = []
        recent_exercises: set[str] = set()
        shortfall_reasons: dict[str, dict[str, int]] = {}

        def record_shortfall(muscle: str, reason: str, sets: int) -> None:
            if sets <= 0:
                return
            bucket = shortfall_reasons.setdefault(muscle, {})
            bucket[reason] = bucket.get(reason, 0) + sets

        for day in days:
            requested_muscles = request.preferences.get("target_muscles", day.target_muscles)
            target_muscles = volume_allocator.muscles_for_day(day.focus, requested_muscles)
            slots: list[ExerciseSlot] = []
            for muscle in target_muscles:
                allocated_sets = volume_allocator.day_volume(muscle, day.day)
                slots.extend(movement_allocator.create_slots(muscle, allocated_sets))

            selected: list[WorkoutExercise] = []
            used_ids = set(recent_exercises)
            current_workout_ids: set[str] = set()
            unfulfilled_volume: dict[str, int] = {}
            max_exercises = validator.max_exercises
            selected_slots: list[tuple[ExerciseSlot, dict[str, Any], float]] = []

            ordered_slots = sorted(slots, key=lambda item: item.priority)
            for slot in ordered_slots:
                if len(selected_slots) >= max_exercises:
                    unfulfilled_volume[slot.target_muscle] = (
                        unfulfilled_volume.get(slot.target_muscle, 0) + slot.sets
                    )
                    record_shortfall(slot.target_muscle, "exercise_cap", slot.sets)
                    continue
                try:
                    exercise, score = selector.select(slot, used_ids, current_workout_ids)
                except ValueError:
                    unfulfilled_volume[slot.target_muscle] = (
                        unfulfilled_volume.get(slot.target_muscle, 0) + slot.sets
                    )
                    record_shortfall(slot.target_muscle, "exercise_availability", slot.sets)
                    continue

                exercise_id = str(exercise.get("id"))
                if exercise_id in current_workout_ids:
                    unfulfilled_volume[slot.target_muscle] = (
                        unfulfilled_volume.get(slot.target_muscle, 0) + slot.sets
                    )
                    record_shortfall(slot.target_muscle, "exercise_availability", slot.sets)
                    continue

                used_ids.add(exercise_id)
                current_workout_ids.add(exercise_id)
                selected_slots.append((slot, exercise, score))

            def build_exercise(slot: ExerciseSlot, exercise: dict[str, Any], score: float, sets: int) -> WorkoutExercise:
                movement = exercise.get("movement") or {}
                muscles = exercise.get("muscles") or {}
                primary_values = muscles.get("primary") or []
                primary = str(primary_values[0]) if primary_values else None
                secondary = [str(value) for value in (muscles.get("secondary") or [])]
                rep_range, rir, rest = prescription.generate(slot, sets)
                return WorkoutExercise(
                    exercise_id=str(exercise.get("id")),
                    name=str(exercise.get("name", "Unknown Exercise")),
                    target_muscles=[slot.target_muscle],
                    primary_muscle=primary,
                    movement_pattern=movement.get("pattern"),
                    compound=bool(movement.get("compound")),
                    equipment=ExerciseDatabase.equipment(exercise),
                    sets=sets,
                    rep_range=rep_range,
                    rir=rir,
                    rest_seconds=rest,
                    role=slot.role,
                    selection_score=round(score, 4),
                    secondary_muscles=secondary,
                )

            for slot, exercise, score in selected_slots:
                selected.append(build_exercise(slot, exercise, score, 1))

            while selected and validator.estimate_workout_minutes(selected) > request.duration_minutes:
                removed = selected.pop()
                removed_slot = next(item[0] for item in selected_slots if str(item[1].get("id")) == removed.exercise_id)
                unfulfilled_volume[removed_slot.target_muscle] = (
                    unfulfilled_volume.get(removed_slot.target_muscle, 0) + removed_slot.sets
                )
                record_shortfall(removed_slot.target_muscle, "time_limit", removed_slot.sets)
                selected_slots = [item for item in selected_slots if str(item[1].get("id")) != removed.exercise_id]

            desired_by_id = {
                str(exercise.get("id")): slot.sets
                for slot, exercise, score in selected_slots
            }
            slot_by_id = {
                str(exercise.get("id")): slot
                for slot, exercise, score in selected_slots
            }

            made_progress = True
            while made_progress:
                made_progress = False
                for exercise in selected:
                    desired_sets = desired_by_id[exercise.exercise_id]
                    if exercise.sets >= desired_sets or exercise.sets >= 5:
                        continue
                    exercise.sets += 1
                    if validator.estimate_workout_minutes(selected) <= request.duration_minutes:
                        made_progress = True
                    else:
                        exercise.sets -= 1

            for exercise in selected:
                slot = slot_by_id[exercise.exercise_id]
                missing_sets = max(0, slot.sets - exercise.sets)
                if missing_sets:
                    unfulfilled_volume[slot.target_muscle] = (
                        unfulfilled_volume.get(slot.target_muscle, 0) + missing_sets
                    )
                    record_shortfall(slot.target_muscle, "time_limit", missing_sets)
                recent_exercises.add(exercise.exercise_id)

            volume = self.calculate_volume(selected)
            estimated = validator.estimate_workout_minutes(selected)
            workout = Workout(
                id=f"workout_{uuid.uuid4().hex[:10]}",
                name=day.name,
                goal=request.goal,
                split=request.split,
                duration_minutes=request.duration_minutes,
                estimated_minutes=estimated,
                training_day=day.day,
                focus=day.focus,
                exercises=selected,
                volume=volume,
                validation={},
                unfulfilled_volume=dict(sorted(unfulfilled_volume.items())),
                split_day_index=day.split_day_index,
                split_cycle_length=day.split_cycle_length,
            )
            workout.validation = validator.validate(workout)
            workouts.append(workout)

        self.last_weekly_volume_report = WeeklyVolumeValidator().build_report(
            request,
            workouts,
            volume_allocator.requested_weekly_targets,
            volume_allocator.unscheduled_muscles,
            shortfall_reasons,
        )
        rotation_length = len(self.split_generator.SPLITS[request.split.lower()])
        rotation_start = int(request.split_rotation_index) % rotation_length
        self.last_weekly_volume_report["split_rotation"] = {
            "start_index": rotation_start,
            "cycle_length": rotation_length,
            "workout_indices": [workout.split_day_index for workout in workouts],
            "advance_on_generation": False,
            "next_index_if_all_workouts_completed_in_order": (rotation_start + len(workouts)) % rotation_length,
            "completion_rule": "After a workout is completed, set the saved index to (completed workout split_day_index + 1) modulo cycle_length.",
        }
        return workouts

    @staticmethod
    def calculate_volume(exercises: list[WorkoutExercise]) -> dict[str, int]:
        volume: dict[str, int] = {}
        for exercise in exercises:
            for muscle in exercise.target_muscles:
                volume[muscle] = volume.get(muscle, 0) + exercise.sets
        return dict(sorted(volume.items()))


def next_split_rotation_index(completed_split_day_index: int, split_cycle_length: int) -> int:
    if split_cycle_length < 1:
        raise ValueError("split_cycle_length must be at least 1.")
    return (int(completed_split_day_index) + 1) % int(split_cycle_length)


def advance_profile_split_rotation(
    profile_rotation_indices: dict[str, int],
    completed_workout: Workout | dict[str, Any],
) -> dict[str, int]:
    workout = asdict(completed_workout) if isinstance(completed_workout, Workout) else completed_workout
    split = str(workout["split"]).lower()
    completed_index = int(workout["split_day_index"])
    cycle_length = int(workout["split_cycle_length"])
    updated = dict(profile_rotation_indices)
    updated[split] = next_split_rotation_index(completed_index, cycle_length)
    return updated


def create_example_requests() -> list[WorkoutRequest]:
    equipment = ["barbell", "dumbbell", "cable", "body_weight", "leverage_machine", "smith_machine", "resistance_band"]
    return [
        WorkoutRequest(goal="hypertrophy", experience="intermediate", days_per_week=4, split="upper_lower", duration_minutes=75, equipment=equipment, seed=42),
        WorkoutRequest(goal="strength", experience="intermediate", days_per_week=4, split="upper_lower", duration_minutes=75, equipment=equipment, seed=43, preferences={"compound_priority": 0.9, "isolation_priority": 0.1}),
        WorkoutRequest(goal="general_fitness", experience="beginner", days_per_week=3, split="full_body", duration_minutes=60, equipment=equipment, seed=44, preferences={"compound_priority": 0.6, "isolation_priority": 0.4}),
        WorkoutRequest(goal="hypertrophy", experience="advanced", days_per_week=5, split="ppl_upper_lower", duration_minutes=90, equipment=equipment, seed=45),
    ]


def serialize_workouts(workouts: list[Workout]) -> list[dict[str, Any]]:
    return [asdict(workout) for workout in workouts]


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        json.dump(data, file, indent=2, ensure_ascii=False)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate FORM workouts from normalized_exercises.json.")
    parser.add_argument("--exercises", type=Path, default=DEFAULT_EXERCISE_FILE, help="Path to normalized_exercises.json")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_FILE, help="Output path for generated workouts JSON")
    parser.add_argument("--results", type=Path, default=DEFAULT_RESULT_FILE, help="Output path for the workout result schema JSON")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    database = ExerciseDatabase(args.exercises)
    generated = []
    for request in create_example_requests():
        generator = WorkoutGenerator(database, seed=request.seed)
        workouts = generator.generate_program(request)
        generated.append({"request": asdict(request), "workouts": serialize_workouts(workouts), "weekly_volume": generator.last_weekly_volume_report})
    write_json(args.output, generated)
    result = WorkoutResult(workout_id="example_workout", completed=True, notes="Example result schema. Populate this with real workout results after a user completes a workout.")
    write_json(args.results, asdict(result))
    print(f"Exercise database: {database.path}")
    print(f"Loaded exercises: {len(database.exercises)}")
    print(f"Category counts: {json.dumps(database.category_counts, sort_keys=True)}")
    print(f"Rejected records: {len(database.rejected_records)}")
    if database.rejected_records:
        for record in database.rejected_records[:10]:
            print(f"  Rejected record {record['index']}: {'; '.join(record['problems'])}")
    print(f"Generated {sum(len(item['workouts']) for item in generated)} workouts across {len(generated)} programs.")
    print(f"Workout file: {args.output.resolve()}")
    print(f"Result schema: {args.results.resolve()}")
    for program in generated:
        request = program["request"]
        report = program["weekly_volume"]
        print(f"\n{request['goal']} | {request['experience']} | {request['split']} | {len(program['workouts'])} days")
        for workout in program["workouts"]:
            status = "PASS" if workout["validation"]["valid"] else "FAIL"
            print(f"  Day {workout['training_day']} {workout['name']}: {len(workout['exercises'])} exercises, {workout['estimated_minutes']} min, {status}")
        print(f"  Weekly volume targets met: {report['all_targets_met']}")
        for muscle, values in report["muscles"].items():
            print(f"    {muscle}: {values['allocated_sets']}/{values['target_sets']} ({values['status']})")


if __name__ == "__main__":
    main()
