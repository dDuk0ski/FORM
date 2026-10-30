from __future__ import annotations

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
    preferences: dict[str, float] = field(default_factory=lambda: {"compound_priority": 0.7, "isolation_priority": 0.3, "exercise_variety": 0.5, "free_weight_preference": 0.5, "machine_preference": 0.5})
    excluded_exercises: list[str] = field(default_factory=list)
    excluded_muscles: list[str] = field(default_factory=list)
    seed: int | None = 42


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


@dataclass
class TrainingDay:
    day: int
    name: str
    focus: str
    target_muscles: list[str]
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
    def __init__(self, path: str | Path):
        self.path = Path(path)
        with self.path.open("r", encoding="utf-8") as file:
            data = json.load(file)
        if isinstance(data, dict) and "exercises" in data:
            data = data["exercises"]
        if not isinstance(data, list):
            raise ValueError("Normalized exercise file must contain a list of exercises or an 'exercises' list.")
        self.exercises = [exercise for exercise in data if isinstance(exercise, dict)]
        self.by_id = {str(exercise.get("id")): exercise for exercise in self.exercises if exercise.get("id") is not None}

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
        equipment = exercise.get("equipment") or []
        return [equipment] if isinstance(equipment, str) else [str(value) for value in equipment]

    def query(self, muscle: str | None = None, movement_pattern: str | None = None, compound: bool | None = None, equipment: list[str] | None = None, category: str | None = "strength", exclude_ids: set[str] | None = None) -> list[dict[str, Any]]:
        exclude_ids = exclude_ids or set()
        required_equipment = set(equipment or [])
        results = []
        for exercise in self.exercises:
            exercise_id = str(exercise.get("id", ""))
            if exercise_id in exclude_ids:
                continue
            classification, muscles, movement = self.classification(exercise), self.muscles(exercise), self.movement(exercise)
            if category and classification.get("category") != category:
                continue
            if muscle:
                muscle_values = set(muscles.get("primary") or []) | set(muscles.get("secondary") or []) | set(muscles.get("groups") or [])
                if muscle not in muscle_values:
                    continue
            if movement_pattern and movement.get("pattern") != movement_pattern:
                continue
            if compound is not None and movement.get("compound") is not compound:
                continue
            if required_equipment and not set(self.equipment(exercise)).intersection(required_equipment):
                continue
            results.append(exercise)
        return results

    def search(self, text: str) -> list[dict[str, Any]]:
        text = text.lower()
        return [exercise for exercise in self.exercises if text in str(exercise.get("name", "")).lower()]


class SplitGenerator:
    SPLITS = {
        "full_body": [
            ("Full Body A", "full_body", ["chest", "back", "quadriceps", "hamstrings", "shoulders", "arms"]),
            ("Full Body B", "full_body", ["chest", "back", "quadriceps", "hamstrings", "shoulders", "arms"]),
            ("Full Body C", "full_body", ["chest", "back", "quadriceps", "hamstrings", "shoulders", "arms"]),
            ("Full Body D", "full_body", ["chest", "back", "quadriceps", "hamstrings", "shoulders", "arms"]),
        ],
        "upper_lower": [
            ("Upper A", "upper", ["chest", "back", "shoulders", "biceps", "triceps"]),
            ("Lower A", "lower", ["quadriceps", "hamstrings", "glutes", "calves"]),
            ("Upper B", "upper", ["chest", "back", "shoulders", "biceps", "triceps"]),
            ("Lower B", "lower", ["quadriceps", "hamstrings", "glutes", "calves"]),
        ],
        "push_pull_legs": [
            ("Push", "push", ["chest", "shoulders", "triceps"]),
            ("Pull", "pull", ["back", "rear_delts", "biceps"]),
            ("Legs", "legs", ["quadriceps", "hamstrings", "glutes", "calves"]),
        ],
        "ppl_upper_lower": [
            ("Push", "push", ["chest", "shoulders", "triceps"]),
            ("Pull", "pull", ["back", "rear_delts", "biceps"]),
            ("Legs", "legs", ["quadriceps", "hamstrings", "glutes", "calves"]),
            ("Upper", "upper", ["chest", "back", "shoulders", "biceps", "triceps"]),
            ("Lower", "lower", ["quadriceps", "hamstrings", "glutes", "calves"]),
        ],
        "bro_split": [
            ("Chest and Triceps", "chest_triceps", ["chest", "triceps"]),
            ("Back and Biceps", "back_biceps", ["back", "biceps"]),
            ("Legs", "legs", ["quadriceps", "hamstrings", "glutes", "calves"]),
            ("Shoulders", "shoulders", ["shoulders", "rear_delts"]),
            ("Arms", "arms", ["biceps", "triceps", "forearms"]),
        ],
    }

    def generate(self, request: WorkoutRequest) -> list[TrainingDay]:
        split = request.split.lower()
        if split not in self.SPLITS:
            raise ValueError(f"Unsupported split: {request.split}")
        templates, days = self.SPLITS[split], []
        count = min(max(1, request.days_per_week), len(templates))
        for index in range(count):
            name, focus, muscles = templates[index]
            days.append(TrainingDay(index + 1, name, focus, muscles))
        return days


class VolumeAllocator:
    BASE = {
        "beginner": {"chest": 8, "back": 10, "shoulders": 6, "side_delts": 4, "rear_delts": 4, "biceps": 6, "triceps": 6, "quadriceps": 8, "hamstrings": 6, "glutes": 6, "calves": 6, "core": 6},
        "intermediate": {"chest": 12, "back": 14, "shoulders": 8, "side_delts": 6, "rear_delts": 6, "biceps": 8, "triceps": 8, "quadriceps": 10, "hamstrings": 8, "glutes": 8, "calves": 8, "core": 8},
        "advanced": {"chest": 16, "back": 18, "shoulders": 10, "side_delts": 8, "rear_delts": 8, "biceps": 10, "triceps": 10, "quadriceps": 12, "hamstrings": 10, "glutes": 10, "calves": 10, "core": 10},
    }

    GROUP_ALIASES = {
        "upper": ["chest", "back", "shoulders", "biceps", "triceps"],
        "lower": ["quadriceps", "hamstrings", "glutes", "calves"],
        "push": ["chest", "shoulders", "triceps"],
        "pull": ["back", "rear_delts", "biceps"],
        "legs": ["quadriceps", "hamstrings", "glutes", "calves"],
        "full_body": ["chest", "back", "quadriceps", "hamstrings", "shoulders", "arms"],
        "chest_triceps": ["chest", "triceps"],
        "back_biceps": ["back", "biceps"],
        "shoulders": ["shoulders", "rear_delts"],
        "arms": ["biceps", "triceps", "forearms"],
    }

    def __init__(self, request: WorkoutRequest):
        self.request = request
        experience = request.experience if request.experience in self.BASE else "intermediate"
        self.weekly = dict(self.BASE[experience])
        if request.goal == "strength":
            self.weekly = {muscle: max(4, round(value * 0.8)) for muscle, value in self.weekly.items()}
        elif request.goal == "general_fitness":
            self.weekly = {muscle: max(3, round(value * 0.65)) for muscle, value in self.weekly.items()}

    def muscles_for_day(self, focus: str, requested: list[str]) -> list[str]:
        muscles = self.GROUP_ALIASES.get(focus, [])
        if requested:
            selected = [muscle for muscle in muscles if muscle in set(requested)]
            if selected:
                return selected
        return muscles

    def day_volume(self, muscle: str, number_of_days: int, focus: str) -> int:
        weekly = self.weekly.get(muscle, 6)
        relevant_days = max(1, number_of_days)
        return max(2, round(weekly / relevant_days))


class MovementAllocator:
    PATTERNS = {
        "chest": [("horizontal_push", True, "primary_compound"), ("horizontal_push", True, "secondary_compound"), ("chest_isolation", False, "isolation")],
        "back": [("vertical_pull", True, "vertical_pull"), ("horizontal_pull", True, "horizontal_pull"), ("horizontal_pull", False, "secondary_pull")],
        "shoulders": [("vertical_push", True, "press"), ("shoulder_abduction", False, "lateral_isolation"), ("horizontal_pull", False, "rear_delt_isolation")],
        "side_delts": [("shoulder_abduction", False, "isolation")],
        "rear_delts": [("horizontal_pull", False, "isolation")],
        "biceps": [("elbow_flexion", False, "isolation"), ("elbow_flexion", False, "isolation")],
        "triceps": [("elbow_extension", False, "isolation"), ("elbow_extension", False, "isolation")],
        "quadriceps": [("knee_dominant", True, "primary_compound"), ("knee_dominant", True, "secondary_compound")],
        "hamstrings": [("hip_dominant", True, "hip_hinge"), ("knee_flexion", False, "leg_curl")],
        "glutes": [("hip_dominant", True, "hip_dominant"), ("hip_extension", True, "hip_extension")],
        "calves": [("plantar_flexion", False, "calf")],
        "core": [("core", False, "core")],
        "forearms": [("forearm", False, "forearm")],
    }

    def create_slots(self, muscle: str, sets: int) -> list[ExerciseSlot]:
        patterns = self.PATTERNS.get(muscle, [])
        if not patterns:
            return [ExerciseSlot(muscle, None, None, 1, sets, "accessory")]
        slots, remaining = [], sets
        for index, (pattern, compound, role) in enumerate(patterns):
            if remaining <= 0:
                break
            slot_sets = max(1, math.ceil(remaining * 0.55)) if index == 0 else max(1, math.ceil(remaining / max(1, len(patterns) - index)))
            slot_sets = min(slot_sets, remaining)
            slots.append(ExerciseSlot(muscle, pattern, compound, index + 1, slot_sets, role))
            remaining -= slot_sets
        if remaining > 0 and slots:
            slots[0].sets += remaining
        return slots


class ExerciseSelector:
    PARENT_TO_CHILDREN = {
        "shoulders": {"front_delts", "side_delts", "rear_delts"},
        "back": {"lats", "upper_back", "lower_back", "upper_traps"},
        "arms": {"biceps", "triceps", "forearms"},
        "core": {"abs", "obliques", "serratus"},
    }

    def __init__(self, database: ExerciseDatabase, request: WorkoutRequest, rng: random.Random):
        self.database, self.request, self.rng, self.recent_ids = database, request, rng, set()

    def muscle_match(self, exercise: dict[str, Any], target: str) -> float:
        muscles = exercise.get("muscles") or {}
        primary, secondary, groups = set(muscles.get("primary") or []), set(muscles.get("secondary") or []), set(muscles.get("groups") or [])
        if target in primary:
            return 1.0
        if target in secondary:
            return 0.7
        if target in groups:
            return 0.8
        if target in self.PARENT_TO_CHILDREN:
            children = self.PARENT_TO_CHILDREN[target]
            if primary.intersection(children):
                return 0.95
            if secondary.intersection(children):
                return 0.65
        return 0.0

    def equipment_score(self, exercise: dict[str, Any]) -> float:
        requested = set(self.request.equipment)
        if not requested:
            return 0.5
        return 1.0 if set(exercise.get("equipment") or []).intersection(requested) else 0.0

    def preference_score(self, exercise: dict[str, Any]) -> float:
        compound = bool((exercise.get("movement") or {}).get("compound"))
        return self.request.preferences.get("compound_priority", 0.5) if compound else self.request.preferences.get("isolation_priority", 0.5)

    def score(self, exercise: dict[str, Any], slot: ExerciseSlot) -> float:
        classification, movement = exercise.get("classification") or {}, exercise.get("movement") or {}
        muscle_score = self.muscle_match(exercise, slot.target_muscle)
        pattern_score = 1.0 if slot.movement_pattern and movement.get("pattern") == slot.movement_pattern else (0.35 if not slot.movement_pattern else 0.0)
        compound_score = 1.0 if slot.compound is None else (1.0 if movement.get("compound") is slot.compound else 0.0)
        equipment_score, preference_score = self.equipment_score(exercise), self.preference_score(exercise)
        category_score = 1.0 if classification.get("category") == "strength" else 0.0
        variety_penalty = 0.15 if str(exercise.get("id")) in self.recent_ids else 0.0
        return muscle_score * 0.35 + pattern_score * 0.20 + compound_score * 0.10 + equipment_score * 0.15 + preference_score * 0.10 + category_score * 0.05 + (1.0 - variety_penalty) * 0.05 - variety_penalty

    def select(self, slot: ExerciseSlot, used_ids: set[str]) -> tuple[dict[str, Any], float]:
        excluded_ids = used_ids | {str(value) for value in self.request.excluded_exercises}
        candidates = self.database.query(muscle=slot.target_muscle, movement_pattern=slot.movement_pattern, compound=slot.compound, equipment=self.request.equipment, category="strength", exclude_ids=excluded_ids)
        if not candidates:
            candidates = self.database.query(muscle=slot.target_muscle, compound=slot.compound, equipment=self.request.equipment, category="strength", exclude_ids=excluded_ids)
        if not candidates:
            candidates = self.database.query(muscle=slot.target_muscle, equipment=self.request.equipment, category="strength", exclude_ids=excluded_ids)
        if not candidates:
            raise ValueError(f"No exercise candidate found for {slot.target_muscle} / {slot.movement_pattern}.")
        scored = sorted(((self.score(exercise, slot), exercise) for exercise in candidates), key=lambda item: item[0], reverse=True)
        score, exercise = self.rng.choice(scored[:min(5, len(scored))])
        self.recent_ids.add(str(exercise.get("id")))
        return exercise, score


class PrescriptionGenerator:
    RULES = {
        "strength": {"compound": ([3, 5], [3, 6], 3, 240), "isolation": ([2, 4], [6, 12], 2, 150)},
        "hypertrophy": {"compound": ([3, 4], [6, 10], 2, 180), "isolation": ([2, 4], [10, 15], 2, 90)},
        "general_fitness": {"compound": ([2, 3], [8, 12], 3, 120), "isolation": ([2, 3], [10, 20], 3, 75)},
    }

    def __init__(self, request: WorkoutRequest, rng: random.Random):
        self.request, self.rng = request, rng

    def generate(self, slot: ExerciseSlot, actual_sets: int) -> tuple[list[int], int, int]:
        goal = self.request.goal if self.request.goal in self.RULES else "hypertrophy"
        rule = self.RULES[goal]["compound" if slot.compound else "isolation"]
        rep_range, rir, rest = list(rule[1]), rule[2], rule[3]
        if self.request.experience == "beginner":
            rir += 1
        elif self.request.experience == "advanced":
            rir = max(1, rir - 1)
        if goal == "strength" and not slot.compound:
            rep_range = [8, 15]
        return rep_range, rir, rest


class WorkoutValidator:
    def __init__(self, request: WorkoutRequest):
        self.request = request

    def estimate_exercise_minutes(self, exercise: WorkoutExercise) -> float:
        reps = sum(exercise.rep_range) / 2
        work_seconds = exercise.sets * reps * 4
        rest_seconds = max(0, exercise.sets - 1) * exercise.rest_seconds
        return (work_seconds + rest_seconds + 60) / 60

    def validate(self, workout: Workout) -> dict[str, Any]:
        errors, warnings = [], []
        if not workout.exercises:
            errors.append("Workout contains no exercises.")
        ids = [exercise.exercise_id for exercise in workout.exercises]
        if len(ids) != len(set(ids)):
            errors.append("Workout contains duplicate exercises.")
        if workout.estimated_minutes > self.request.duration_minutes * 1.15:
            errors.append("Workout exceeds requested duration by more than 15%.")
        elif workout.estimated_minutes > self.request.duration_minutes:
            warnings.append("Workout slightly exceeds requested duration.")
        for muscle in self.request.excluded_muscles:
            if workout.volume.get(muscle, 0) > 0:
                errors.append(f"Excluded muscle received direct volume: {muscle}.")
        if len(workout.exercises) < 3:
            warnings.append("Workout has fewer than 3 exercises.")
        if len(workout.exercises) > 10:
            errors.append("Workout has more than 10 exercises.")
        if any(exercise.sets <= 0 for exercise in workout.exercises):
            errors.append("Exercise has zero or negative sets.")
        return {"valid": not errors, "errors": errors, "warnings": warnings}


class WorkoutGenerator:
    def __init__(self, database: ExerciseDatabase, seed: int | None = 42):
        self.database, self.rng, self.split_generator = database, random.Random(seed), SplitGenerator()

    def generate_program(self, request: WorkoutRequest) -> list[Workout]:
        days = self.split_generator.generate(request)
        volume_allocator, movement_allocator = VolumeAllocator(request), MovementAllocator()
        selector, prescription, validator = ExerciseSelector(self.database, request, self.rng), PrescriptionGenerator(request, self.rng), WorkoutValidator(request)
        workouts, recent_exercises = [], set()

        for day in days:
            target_muscles = volume_allocator.muscles_for_day(day.focus, request.preferences.get("target_muscles", []))
            slots = []
            for muscle in target_muscles:
                if muscle not in request.excluded_muscles:
                    slots.extend(movement_allocator.create_slots(muscle, volume_allocator.day_volume(muscle, len(days), day.focus)))
            slots = self.limit_slots_to_duration(slots, request.duration_minutes)
            selected, used_ids = [], set(recent_exercises)

            for slot in sorted(slots, key=lambda item: item.priority):
                try:
                    exercise, score = selector.select(slot, used_ids)
                except ValueError:
                    continue
                exercise_id = str(exercise.get("id"))
                used_ids.add(exercise_id)
                recent_exercises.add(exercise_id)
                movement, muscles = exercise.get("movement") or {}, exercise.get("muscles") or {}
                rep_range, rir, rest = prescription.generate(slot, slot.sets)
                primary = (muscles.get("primary") or [None])[0]
                selected.append(WorkoutExercise(exercise_id=exercise_id, name=str(exercise.get("name", "Unknown Exercise")), target_muscles=[primary] if primary else [slot.target_muscle], primary_muscle=primary, movement_pattern=movement.get("pattern"), compound=bool(movement.get("compound")), equipment=list(exercise.get("equipment") or []), sets=slot.sets, rep_range=rep_range, rir=rir, rest_seconds=rest, role=slot.role, selection_score=round(score, 4)))

            selected = self.repair_exercise_count(selected)
            volume = self.calculate_volume(selected)
            estimated = round(sum(validator.estimate_exercise_minutes(exercise) for exercise in selected))
            workout = Workout(id=f"workout_{uuid.uuid4().hex[:10]}", name=day.name, goal=request.goal, split=request.split, duration_minutes=request.duration_minutes, estimated_minutes=estimated, training_day=day.day, focus=day.focus, exercises=selected, volume=volume, validation={})
            workout.validation = validator.validate(workout)
            workouts.append(self.repair_workout(workout, request, validator))

        return workouts

    def limit_slots_to_duration(self, slots: list[ExerciseSlot], duration: int) -> list[ExerciseSlot]:
        max_exercises = 7 if duration >= 60 else 5 if duration >= 45 else 4
        if len(slots) <= max_exercises:
            return slots
        return sorted(slots, key=lambda slot: (slot.priority, -slot.sets))[:max_exercises]

    def repair_exercise_count(self, exercises: list[WorkoutExercise]) -> list[WorkoutExercise]:
        if len(exercises) <= 7:
            return exercises
        return sorted(exercises, key=lambda exercise: (exercise.role not in {"primary_compound", "vertical_pull", "horizontal_pull", "press"}, exercise.selection_score))[:7]

    def calculate_volume(self, exercises: list[WorkoutExercise]) -> dict[str, int]:
        volume = {}
        for exercise in exercises:
            muscle = exercise.primary_muscle or (exercise.target_muscles[0] if exercise.target_muscles else "unknown")
            volume[muscle] = volume.get(muscle, 0) + exercise.sets
        return dict(sorted(volume.items()))

    def repair_workout(self, workout: Workout, request: WorkoutRequest, validator: WorkoutValidator) -> Workout:
        attempts = 0
        while not workout.validation["valid"] and attempts < 3:
            attempts += 1
            if any("duration" in error.lower() for error in workout.validation["errors"]) and workout.exercises:
                lowest = min(workout.exercises, key=lambda exercise: (exercise.role in {"primary_compound", "press", "vertical_pull", "horizontal_pull"}, exercise.selection_score))
                if lowest.sets > 2:
                    lowest.sets -= 1
                else:
                    workout.exercises.remove(lowest)
            workout.volume = self.calculate_volume(workout.exercises)
            workout.estimated_minutes = round(sum(validator.estimate_exercise_minutes(exercise) for exercise in workout.exercises))
            workout.validation = validator.validate(workout)
        return workout


def create_example_requests() -> list[WorkoutRequest]:
    equipment = ["barbell", "dumbbell", "cable", "body_weight", "leverage_machine", "smith_machine"]
    return [
        WorkoutRequest(goal="hypertrophy", experience="intermediate", days_per_week=4, split="upper_lower", duration_minutes=60, equipment=equipment, preferences={"compound_priority": 0.7, "isolation_priority": 0.3, "exercise_variety": 0.5}, seed=42),
        WorkoutRequest(goal="strength", experience="intermediate", days_per_week=4, split="upper_lower", duration_minutes=75, equipment=equipment, preferences={"compound_priority": 0.9, "isolation_priority": 0.1, "exercise_variety": 0.3}, seed=43),
        WorkoutRequest(goal="general_fitness", experience="beginner", days_per_week=3, split="full_body", duration_minutes=45, equipment=["dumbbell", "cable", "body_weight", "resistance_band"], preferences={"compound_priority": 0.6, "isolation_priority": 0.4, "exercise_variety": 0.7}, seed=44),
        WorkoutRequest(goal="hypertrophy", experience="advanced", days_per_week=5, split="push_pull_legs", duration_minutes=70, equipment=equipment, preferences={"compound_priority": 0.65, "isolation_priority": 0.35, "exercise_variety": 0.7}, seed=45),
    ]


def serialize_workouts(workouts: list[Workout]) -> list[dict[str, Any]]:
    return [asdict(workout) for workout in workouts]


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        json.dump(data, file, indent=2, ensure_ascii=False)


def main() -> None:
    exercise_file = DEFAULT_EXERCISE_FILE
    if not exercise_file.exists():
        raise FileNotFoundError(f"Could not find {exercise_file}. Put normalized_exercises.json beside this script or change DEFAULT_EXERCISE_FILE.")
    database, generator, requests = ExerciseDatabase(exercise_file), WorkoutGenerator(exercise_file and 42), create_example_requests()
    generator.database = database
    generated = [{"request": asdict(request), "workouts": serialize_workouts(generator.generate_program(request))} for request in requests]
    write_json(DEFAULT_OUTPUT_FILE, generated)
    result = WorkoutResult(workout_id="example_workout", completed=True, exercises=[], recovery_score=None, adherence_score=None, notes="Example result schema. Populate this with real workout results after the user completes a workout.")
    write_json(DEFAULT_RESULT_FILE, asdict(result))
    print(f"Loaded {len(database.exercises)} exercises.")
    print(f"Generated {sum(len(item['workouts']) for item in generated)} workouts.")
    print(f"Workout file: {DEFAULT_OUTPUT_FILE}")
    print(f"Result schema: {DEFAULT_RESULT_FILE}")
    for program in generated:
        request = program["request"]
        print(f"\n{request['goal']} | {request['split']} | {request['days_per_week']} days")
        for workout in program["workouts"]:
            status = "PASS" if workout["validation"]["valid"] else "FAIL"
            print(f"  {workout['training_day']}. {workout['name']}: {len(workout['exercises'])} exercises, {workout['estimated_minutes']} min, {status}")
            for exercise in workout["exercises"]:
                print(f"     {exercise['sets']} x {exercise['rep_range'][0]}-{exercise['rep_range'][1]} {exercise['name']}")


if __name__ == "__main__":
    main()