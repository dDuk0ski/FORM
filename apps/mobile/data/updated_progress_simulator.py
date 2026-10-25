from __future__ import annotations

import json
import math
import random
from collections import Counter
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from workout_generator import ExerciseDatabase, WorkoutGenerator, WorkoutRequest
from global_progression_model import GlobalObservation, GlobalProgressionModel, SetResult
from local_progression_model import LocalObservation, LocalProgressionModel


BASE_DIR = Path(__file__).resolve().parent
EXERCISE_FILE = BASE_DIR / "normalized_exercises.json"
RESULTS_DIR = BASE_DIR / "simulation_results"

DEFAULT_WEEKS = 52
DEFAULT_SEED = 42

GOALS = {
    "1": ("hypertrophy", "Hypertrophy"),
    "2": ("strength", "Strength"),
    "3": ("general_fitness", "General Fitness"),
}

EXPERIENCE_LEVELS = {
    "1": ("beginner", "Beginner"),
    "2": ("intermediate", "Intermediate"),
    "3": ("advanced", "Advanced"),
}

DAYS_OPTIONS = {
    "1": 2,
    "2": 3,
    "3": 4,
    "4": 5,
}

DURATION_OPTIONS = {
    "1": 30,
    "2": 45,
    "3": 60,
    "4": 75,
    "5": 90,
}

SPLIT_OPTIONS = {
    "1": ("full_body", "Full Body"),
    "2": ("upper_lower", "Upper / Lower"),
    "3": ("push_pull_legs", "Push / Pull / Legs"),
    "4": ("ppl_upper_lower", "PPL + Upper / Lower"),
    "5": ("bro_split", "Bro Split"),
}

EQUIPMENT_OPTIONS = [
    "barbell",
    "dumbbell",
    "cable",
    "body_weight",
    "machine",
    "kettlebell",
    "resistance_band",
    "ez_bar",
    "smith_machine",
]

MUSCLE_OPTIONS = [
    "chest",
    "back",
    "shoulders",
    "side_delts",
    "rear_delts",
    "biceps",
    "triceps",
    "forearms",
    "quadriceps",
    "hamstrings",
    "glutes",
    "calves",
    "core",
]

PREFERENCE_DEFAULTS = {
    "compound_priority": 0.7,
    "isolation_priority": 0.3,
    "exercise_variety": 0.5,
    "free_weight_preference": 0.5,
    "machine_preference": 0.5,
}


@dataclass
class ExercisePrescription:
    exercise_id: str
    exercise_number: int
    name: str
    equipment: list[str]
    target_muscles: list[str]
    sets: int
    rep_range: tuple[int, int]
    rir: float
    rest_seconds: int
    role: str
    compound: bool
    starting_weight: float


@dataclass
class ExerciseState:
    exercise_id: str
    exercise_number: int
    name: str
    starting_weight: float
    current_weight: float
    starting_rep_range: tuple[int, int]
    current_rep_range: tuple[int, int]
    target_rir: float
    history: list[dict[str, Any]]


class SimulatedAthlete:
    def __init__(self, seed: int = DEFAULT_SEED):
        self.rng = random.Random(seed)
        self.strength: dict[str, float] = {}
        self.adaptation: dict[str, float] = {}
        self.exercise_noise: dict[str, float] = {}

    def initialize_exercise(
        self,
        exercise_id: str,
        starting_weight: float,
        compound: bool,
    ) -> None:
        if exercise_id in self.strength:
            return

        if starting_weight <= 0:
            base_strength = 30.0
        else:
            multiplier = 1.28 if compound else 1.20
            base_strength = starting_weight * multiplier

        self.strength[exercise_id] = base_strength
        self.adaptation[exercise_id] = 0.0
        self.exercise_noise[exercise_id] = self.rng.uniform(0.92, 1.08)

    def simulate(
        self,
        prescription: ExercisePrescription,
        week: int,
    ) -> tuple[list[SetResult], str]:
        exercise_id = prescription.exercise_id

        self.initialize_exercise(
            exercise_id,
            prescription.starting_weight,
            prescription.compound,
        )

        strength = self.strength[exercise_id]
        adaptation = self.adaptation[exercise_id]
        noise = self.exercise_noise[exercise_id]

        low, high = prescription.rep_range
        target_reps = (low + high) / 2
        weight = prescription.starting_weight

        if weight <= 0:
            difficulty = 0.55
        else:
            difficulty = weight / max(strength + adaptation, 1.0)

        difficulty += self.rng.uniform(-0.035, 0.035)
        difficulty *= noise

        performance = 1.0 - difficulty

        results: list[SetResult] = []

        for set_index in range(prescription.sets):
            fatigue = set_index * 0.025
            set_performance = performance - fatigue
            set_performance += self.rng.uniform(-0.035, 0.035)

            completed = set_performance > 0.05

            if not completed:
                reps = 0
                rir = 0.0
            else:
                rep_factor = 0.72 + set_performance * 0.70
                reps = int(round(target_reps * rep_factor))
                reps = max(1, min(high + 2, reps))

                rir_base = prescription.rir + (
                    set_performance - 0.30
                ) * 3.0

                rir = max(
                    0.0,
                    min(4.0, rir_base),
                )

                rir += self.rng.uniform(-0.25, 0.25)
                rir = max(
                    0.0,
                    min(4.0, rir),
                )

            results.append(
                SetResult(
                    weight=weight,
                    reps=reps,
                    rir=rir,
                    completed=completed,
                )
            )

        completed_sets = [
            result
            for result in results
            if result.completed
        ]

        if not completed_sets:
            outcome = "failure"
        else:
            average_reps = sum(
                result.reps
                for result in completed_sets
            ) / len(completed_sets)

            if (
                len(completed_sets) == len(results)
                and average_reps >= high
            ):
                outcome = "excellent"
            elif (
                len(completed_sets) == len(results)
                and average_reps >= low
            ):
                outcome = "good"
            elif len(completed_sets) >= max(
                1,
                math.ceil(len(results) * 0.5),
            ):
                outcome = "moderate"
            else:
                outcome = "poor"

        self.adaptation[exercise_id] += self.rng.uniform(
            0.15,
            0.45,
        )

        return results, outcome


class Simulation:
    def __init__(
        self,
        request: WorkoutRequest,
        weeks: int,
        seed: int,
    ):
        self.request = request
        self.weeks = weeks
        self.seed = seed
        self.rng = random.Random(seed)

        self.database = ExerciseDatabase(
            EXERCISE_FILE
        )

        self.generator = WorkoutGenerator(
            database=self.database,
            seed=seed,
        )

        self.program = self.generator.generate_program(
            request
        )

        self.global_model = GlobalProgressionModel(
            state_file=BASE_DIR / "global_bayesian_state.json",
            prior_alpha=2.0,
            prior_beta=2.0,
            minimum_confidence=0.50,
        )

        self.local_model = LocalProgressionModel(
            global_model=self.global_model,
            state_file="local_bayesian_state.json",
            prior_alpha=2.0,
            prior_beta=2.0,
            global_influence_evidence=10.0,
            exploration_evidence=6.0,
            exploration_rate=0.10,
            random_seed=43,
        )

        self.athlete = SimulatedAthlete(
            seed=seed
        )

        self.prescriptions: dict[
            str,
            ExercisePrescription,
        ] = {}

        self.exercise_states: dict[
            str,
            ExerciseState,
        ] = {}

        self.history: list[
            dict[str, Any]
        ] = []

        self.progression_counts = Counter()
        self.outcome_counts = Counter()

        self._initialize_prescriptions()

    def _starting_weight(
        self,
        exercise: Any,
    ) -> float:
        equipment = {
            str(item).lower()
            for item in getattr(
                exercise,
                "equipment",
                [],
            )
        }

        compound = bool(
            getattr(
                exercise,
                "compound",
                False,
            )
        )

        role = str(
            getattr(
                exercise,
                "role",
                "",
            )
        ).lower()

        if "body_weight" in equipment:
            return 0.0

        if "barbell" in equipment:
            base = 85.0 if compound else 45.0
        elif "smith_machine" in equipment:
            base = 75.0 if compound else 40.0
        elif "machine" in equipment:
            base = 70.0 if compound else 35.0
        elif "dumbbell" in equipment:
            base = 30.0 if compound else 15.0
        elif "cable" in equipment:
            base = 35.0 if compound else 20.0
        elif "kettlebell" in equipment:
            base = 35.0 if compound else 20.0
        elif "ez_bar" in equipment:
            base = 50.0
        elif "resistance_band" in equipment:
            base = 20.0
        else:
            base = 25.0

        role_adjustment = {
            "primary_compound": 1.10,
            "secondary_compound": 0.95,
            "hip_hinge": 1.05,
            "vertical_pull": 0.95,
            "horizontal_pull": 0.95,
            "press": 0.90,
            "isolation": 0.65,
            "lateral_isolation": 0.50,
            "rear_delt_isolation": 0.50,
            "calf": 0.70,
            "core": 0.50,
        }.get(
            role,
            0.75,
        )

        variation = self.rng.uniform(
            0.90,
            1.10,
        )

        return round(
            max(
                2.5,
                base * role_adjustment * variation,
            ),
            1,
        )

    def _initialize_prescriptions(self) -> None:
        exercise_number = 0

        for workout in self.program:
            for exercise in workout.exercises:
                exercise_number += 1

                if exercise.exercise_id in self.prescriptions:
                    continue

                starting_weight = self._starting_weight(
                    exercise
                )

                prescription = ExercisePrescription(
                    exercise_id=exercise.exercise_id,
                    exercise_number=exercise_number,
                    name=exercise.name,
                    equipment=list(
                        exercise.equipment
                    ),
                    target_muscles=list(
                        exercise.target_muscles
                    ),
                    sets=exercise.sets,
                    rep_range=(
                        int(exercise.rep_range[0]),
                        int(exercise.rep_range[1]),
                    ),
                    rir=float(exercise.rir),
                    rest_seconds=int(
                        exercise.rest_seconds
                    ),
                    role=exercise.role,
                    compound=bool(
                        exercise.compound
                    ),
                    starting_weight=starting_weight,
                )

                self.prescriptions[
                    exercise.exercise_id
                ] = prescription

                self.exercise_states[
                    exercise.exercise_id
                ] = ExerciseState(
                    exercise_id=exercise.exercise_id,
                    exercise_number=exercise_number,
                    name=exercise.name,
                    starting_weight=starting_weight,
                    current_weight=starting_weight,
                    starting_rep_range=prescription.rep_range,
                    current_rep_range=prescription.rep_range,
                    target_rir=prescription.rir,
                    history=[],
                )

                self.athlete.initialize_exercise(
                    exercise.exercise_id,
                    starting_weight,
                    bool(exercise.compound),
                )

    def _weight_increment(
        self,
        prescription: ExercisePrescription,
    ) -> float:
        if prescription.starting_weight <= 0:
            return 0.0

        return (
            5.0
            if prescription.compound
            else 2.5
        )

    def _apply_action(
        self,
        prescription: ExercisePrescription,
        decision: str,
    ) -> None:
        increment = self._weight_increment(
            prescription
        )

        low, high = prescription.rep_range

        if decision == "increase_weight":
            if prescription.starting_weight > 0:
                prescription.starting_weight += increment

        elif decision == "increase_reps":
            prescription.rep_range = (
                low + 1,
                high + 1,
            )

        elif decision == "decrease":
            if prescription.starting_weight > 0:
                prescription.starting_weight = max(
                    increment,
                    prescription.starting_weight - increment,
                )

        state = self.exercise_states[
            prescription.exercise_id
        ]

        state.current_weight = (
            prescription.starting_weight
        )

        state.current_rep_range = (
            prescription.rep_range
        )

    def _global_observation(
        self,
        prescription: ExercisePrescription,
        actual_sets: list[SetResult],
        tested_action: str | None,
    ) -> GlobalObservation:
        return GlobalObservation(
            actual_sets=actual_sets,
            previous_rep_range=prescription.rep_range,
            previous_target_rir=prescription.rir,
            tested_action=tested_action,
            exercise_number=prescription.exercise_number,
        )

    def _local_observation(
        self,
        prescription: ExercisePrescription,
        actual_sets: list[SetResult],
        tested_action: str | None,
    ) -> LocalObservation:
        return LocalObservation(
            exercise_id=prescription.exercise_id,
            exercise_number=prescription.exercise_number,
            actual_sets=actual_sets,
            previous_rep_range=prescription.rep_range,
            previous_target_rir=prescription.rir,
            tested_action=tested_action,
        )

    def _recommend(
        self,
        prescription: ExercisePrescription,
        actual_sets: list[SetResult],
        tested_action: str | None,
    ) -> dict[str, Any]:
        global_observation = self._global_observation(
            prescription,
            actual_sets,
            tested_action,
        )

        local_observation = self._local_observation(
            prescription,
            actual_sets,
            tested_action,
        )

        global_recommendation = (
            self.global_model.recommend(
                global_observation
            )
        )

        local_recommendation = (
            self.local_model.recommend(
                local_observation
            )
        )

        return {
            "decision": local_recommendation.decision,
            "confidence": local_recommendation.confidence,
            "probability_of_success": (
                local_recommendation
                .probability_of_success
            ),
            "local_probability": (
                local_recommendation
                .local_probability
            ),
            "global_probability": (
                local_recommendation
                .global_probability
            ),
            "probabilities": (
                local_recommendation
                .probabilities
            ),
            "reason": local_recommendation.reason,
            "global_recommendation": asdict(
                global_recommendation
            ),
        }

    def run(self) -> dict[str, Any]:
        previous_actions: dict[
            str,
            str | None,
        ] = {
            exercise_id: None
            for exercise_id in self.prescriptions
        }

        for week in range(
            1,
            self.weeks + 1,
        ):
            for workout in self.program:
                for exercise in workout.exercises:
                    exercise_id = exercise.exercise_id

                    prescription = (
                        self.prescriptions[
                            exercise_id
                        ]
                    )

                    previous_action = (
                        previous_actions[
                            exercise_id
                        ]
                    )

                    actual_sets, outcome = (
                        self.athlete.simulate(
                            prescription,
                            week,
                        )
                    )

                    self.outcome_counts[
                        outcome
                    ] += 1

                    if previous_action is not None:
                        global_observation = (
                            self._global_observation(
                                prescription,
                                actual_sets,
                                previous_action,
                            )
                        )

                        local_observation = (
                            self._local_observation(
                                prescription,
                                actual_sets,
                                previous_action,
                            )
                        )

                        self.global_model.update(
                            global_observation
                        )

                        self.local_model.update(
                            local_observation
                        )

                    recommendation = self._recommend(
                        prescription,
                        actual_sets,
                        previous_action,
                    )

                    decision = recommendation[
                        "decision"
                    ]

                    if week == self.weeks:
                        decision = "maintain"

                    self.progression_counts[
                        decision
                    ] += 1

                    self._record_history(
                        week,
                        workout,
                        prescription,
                        actual_sets,
                        outcome,
                        previous_action,
                        recommendation,
                        decision,
                    )

                    self._apply_action(
                        prescription,
                        decision,
                    )

                    previous_actions[
                        exercise_id
                    ] = decision

        self.global_model.save_state()
        self.local_model.save_state()

        return self._build_results()

    def _record_history(
        self,
        week: int,
        workout: Any,
        prescription: ExercisePrescription,
        actual_sets: list[SetResult],
        outcome: str,
        previous_action: str | None,
        recommendation: dict[str, Any],
        decision: str,
    ) -> None:
        completed_sets = [
            result
            for result in actual_sets
            if result.completed
        ]

        average_reps = (
            sum(
                result.reps
                for result in completed_sets
            )
            / len(completed_sets)
            if completed_sets
            else 0.0
        )

        average_rir = (
            sum(
                result.rir
                for result in completed_sets
            )
            / len(completed_sets)
            if completed_sets
            else 0.0
        )

        entry = {
            "week": week,
            "workout_id": workout.id,
            "workout_name": workout.name,
            "training_day": workout.training_day,
            "exercise_id": prescription.exercise_id,
            "exercise_number": prescription.exercise_number,
            "exercise_name": prescription.name,
            "target_muscles": prescription.target_muscles,
            "role": prescription.role,
            "compound": prescription.compound,
            "prescribed_weight": prescription.starting_weight,
            "prescribed_rep_range": list(
                prescription.rep_range
            ),
            "target_rir": prescription.rir,
            "sets": prescription.sets,
            "actual_sets": [
                asdict(result)
                for result in actual_sets
            ],
            "completed_sets": len(
                completed_sets
            ),
            "average_reps": round(
                average_reps,
                2,
            ),
            "average_rir": round(
                average_rir,
                2,
            ),
            "outcome": outcome,
            "previous_action": previous_action,
            "decision": decision,
            "confidence": recommendation[
                "confidence"
            ],
            "probability_of_success": recommendation[
                "probability_of_success"
            ],
            "local_probability": recommendation[
                "local_probability"
            ],
            "global_probability": recommendation[
                "global_probability"
            ],
            "probabilities": recommendation[
                "probabilities"
            ],
            "reason": recommendation[
                "reason"
            ],
        }

        self.history.append(entry)

        self.exercise_states[
            prescription.exercise_id
        ].history.append(entry)

    def _build_results(self) -> dict[str, Any]:
        exercise_results = {}

        for exercise_id, state in (
            self.exercise_states.items()
        ):
            history = state.history

            exercise_results[
                exercise_id
            ] = {
                "exercise_id": exercise_id,
                "exercise_number": state.exercise_number,
                "name": state.name,
                "starting_weight": state.starting_weight,
                "final_weight": state.current_weight,
                "starting_rep_range": list(
                    state.starting_rep_range
                ),
                "final_rep_range": list(
                    state.current_rep_range
                ),
                "target_rir": state.target_rir,
                "decision_counts": dict(
                    Counter(
                        entry["decision"]
                        for entry in history
                    )
                ),
                "history": history,
            }

        return {
            "configuration": asdict(
                self.request
            ),
            "weeks": self.weeks,
            "seed": self.seed,
            "workout_sessions": (
                len(self.program)
                * self.weeks
            ),
            "exercise_observations": len(
                self.history
            ),
            "progression_decisions": dict(
                self.progression_counts
            ),
            "performance_outcomes": dict(
                self.outcome_counts
            ),
            "global_state": (
                self.global_model.get_state()
            ),
            "exercise_progression": (
                exercise_results
            ),
            "history": self.history,
        }


def print_header(title: str) -> None:
    print()
    print("=" * 80)
    print(title)
    print("=" * 80)


def select_option(
    title: str,
    options: dict[str, tuple[Any, str]],
    default: str,
) -> Any:
    print()
    print(title)

    for key, value in options.items():
        print(
            f"  {key}. {value[1]}"
        )

    while True:
        choice = (
            input(
                f"Select [{default}]: "
            ).strip()
            or default
        )

        if choice in options:
            return options[choice][0]

        print("Invalid selection.")


def select_days() -> int:
    print()
    print("Days Per Week")

    for key, value in DAYS_OPTIONS.items():
        print(
            f"  {key}. {value} days"
        )

    while True:
        choice = (
            input("Select [3]: ").strip()
            or "3"
        )

        if choice in DAYS_OPTIONS:
            return DAYS_OPTIONS[choice]

        print("Invalid selection.")


def select_duration() -> int:
    print()
    print("Workout Duration")

    for key, value in DURATION_OPTIONS.items():
        print(
            f"  {key}. {value} minutes"
        )

    while True:
        choice = (
            input("Select [3]: ").strip()
            or "3"
        )

        if choice in DURATION_OPTIONS:
            return DURATION_OPTIONS[choice]

        print("Invalid selection.")


def select_split(
    days_per_week: int,
) -> str:
    print()
    print("Split")

    available = dict(
        SPLIT_OPTIONS
    )

    if days_per_week < 5:
        available.pop("5", None)

    if days_per_week < 4:
        available.pop("4", None)

    for key, value in available.items():
        print(
            f"  {key}. {value[1]}"
        )

    default = "1"

    while True:
        choice = (
            input(
                f"Select [{default}]: "
            ).strip()
            or default
        )

        if choice in available:
            split_value = available[
                choice
            ][0]

            return split_value

        print("Invalid selection.")


def select_equipment() -> list[str]:
    print()
    print("Equipment")
    print(
        "Enter equipment numbers separated by commas."
    )
    print(
        "Enter A for all available equipment."
    )

    for index, equipment in enumerate(
        EQUIPMENT_OPTIONS,
        start=1,
    ):
        print(
            f"  {index}. {equipment}"
        )

    while True:
        raw = input(
            "Select [A]: "
        ).strip()

        if not raw or raw.lower() == "a":
            return list(
                EQUIPMENT_OPTIONS
            )

        try:
            indexes = [
                int(value.strip())
                for value in raw.split(",")
            ]
        except ValueError:
            print("Invalid selection.")
            continue

        selected = []

        for index in indexes:
            if 1 <= index <= len(
                EQUIPMENT_OPTIONS
            ):
                equipment = (
                    EQUIPMENT_OPTIONS[
                        index - 1
                    ]
                )

                if equipment not in selected:
                    selected.append(
                        equipment
                    )

        if selected:
            return selected

        print(
            "No valid equipment selected."
        )


def select_target_muscles() -> list[str]:
    print()
    print("Target Muscles")
    print(
        "Enter numbers separated by commas."
    )
    print(
        "Press Enter or type A/all for all muscles."
    )

    for index, muscle in enumerate(
        MUSCLE_OPTIONS,
        start=1,
    ):
        print(
            f"  {index}. {muscle}"
        )

    raw = input(
        "Select [all]: "
    ).strip().lower()

    if raw in {
        "",
        "a",
        "all",
    }:
        return []

    try:
        indexes = [
            int(value.strip())
            for value in raw.split(",")
        ]
    except ValueError:
        print(
            "Invalid selection. "
            "Using all muscles."
        )
        return []

    selected = []

    for index in indexes:
        if 1 <= index <= len(
            MUSCLE_OPTIONS
        ):
            selected.append(
                MUSCLE_OPTIONS[
                    index - 1
                ]
            )

    if not selected:
        print(
            "No valid muscles selected. "
            "Using all muscles."
        )
        return []

    return selected


def select_float(
    title: str,
    default: float,
) -> float:
    while True:
        raw = input(
            f"{title} [{default:.2f}]: "
        ).strip()

        if not raw:
            return default

        try:
            value = float(raw)
        except ValueError:
            print(
                "Enter a number."
            )
            continue

        if 0.0 <= value <= 1.0:
            return value

        print(
            "Enter a value from 0.0 to 1.0."
        )


def select_preferences() -> dict[str, float]:
    print()
    print("Training Preferences")
    print(
        "Each value ranges from 0.0 to 1.0."
    )

    preferences = {}

    for key, default in (
        PREFERENCE_DEFAULTS.items()
    ):
        display = key.replace(
            "_",
            " ",
        ).title()

        preferences[key] = select_float(
            display,
            default,
        )

    return preferences


def select_weeks() -> int:
    print()
    print("Simulation Length")

    print("  1. 12 weeks")
    print("  2. 26 weeks")
    print("  3. 52 weeks")
    print("  4. Custom")

    while True:
        choice = (
            input("Select [3]: ").strip()
            or "3"
        )

        if choice == "1":
            return 12

        if choice == "2":
            return 26

        if choice == "3":
            return 52

        if choice == "4":
            while True:
                try:
                    weeks = int(
                        input(
                            "Number of weeks: "
                        ).strip()
                    )

                    if weeks > 0:
                        return weeks
                except ValueError:
                    pass

                print(
                    "Enter a positive "
                    "whole number."
                )

        print("Invalid selection.")


def select_seed() -> int:
    raw = input(
        f"Random Seed [{DEFAULT_SEED}]: "
    ).strip()

    if not raw:
        return DEFAULT_SEED

    try:
        return int(raw)
    except ValueError:
        print(
            "Invalid seed. "
            "Using 42."
        )
        return DEFAULT_SEED


def build_request() -> tuple[
    WorkoutRequest,
    int,
    int,
]:
    print_header(
        "WORKOUT SIMULATION CONFIGURATION"
    )

    goal = select_option(
        "Goal",
        GOALS,
        "1",
    )

    experience = select_option(
        "Experience",
        EXPERIENCE_LEVELS,
        "2",
    )

    days_per_week = select_days()

    split = select_split(
        days_per_week
    )

    duration_minutes = select_duration()

    equipment = select_equipment()

    target_muscles = (
        select_target_muscles()
    )

    preferences = (
        select_preferences()
    )

    weeks = select_weeks()

    seed = select_seed()

    preferences[
        "target_muscles"
    ] = target_muscles

    request = WorkoutRequest(
        goal=goal,
        experience=experience,
        days_per_week=days_per_week,
        split=split,
        duration_minutes=duration_minutes,
        equipment=equipment,
        preferences=preferences,
        excluded_exercises=[],
        excluded_muscles=[],
        seed=seed,
    )

    return (
        request,
        weeks,
        seed,
    )


def print_configuration(
    request: WorkoutRequest,
    weeks: int,
    seed: int,
) -> None:
    print_header(
        "SELECTED CONFIGURATION"
    )

    print(
        f"Goal:           {request.goal}"
    )

    print(
        f"Experience:     {request.experience}"
    )

    print(
        f"Days per week:  {request.days_per_week}"
    )

    print(
        f"Split:          {request.split}"
    )

    print(
        f"Duration:       "
        f"{request.duration_minutes} minutes"
    )

    print(
        f"Simulation:     {weeks} weeks"
    )

    print(
        f"Seed:            {seed}"
    )

    print()
    print("Equipment:")

    for equipment in request.equipment:
        print(
            f"  - {equipment}"
        )

    target_muscles = (
        request.preferences.get(
            "target_muscles",
            [],
        )
    )

    print()
    print("Target muscles:")

    if target_muscles:
        for muscle in target_muscles:
            print(
                f"  - {muscle}"
            )
    else:
        print(
            "  - All applicable muscles"
        )

    print()
    print("Preferences:")

    for key in PREFERENCE_DEFAULTS:
        print(
            f"  {key}: "
            f"{request.preferences.get(key, 0.0):.2f}"
        )


def print_program(
    program: list[Any],
) -> None:
    print_header(
        "GENERATED WORKOUT PROGRAM"
    )

    for workout in program:
        print()
        print(
            f"DAY {workout.training_day}: "
            f"{workout.name}"
        )

        print(
            f"Focus: {workout.focus}"
        )

        print(
            f"Estimated: "
            f"{workout.estimated_minutes} min"
        )

        print("-" * 80)

        for index, exercise in enumerate(
            workout.exercises,
            start=1,
        ):
            muscles = ", ".join(
                exercise.target_muscles
            )

            equipment = ", ".join(
                exercise.equipment
            )

            print(
                f"{index}. "
                f"{exercise.name}"
            )

            print(
                f"   ID: {exercise.exercise_id} | "
                f"Role: {exercise.role}"
            )

            print(
                f"   Muscle: {muscles}"
            )

            print(
                f"   Equipment: {equipment}"
            )

            print(
                f"   Sets: {exercise.sets} | "
                f"Reps: "
                f"{exercise.rep_range[0]}-"
                f"{exercise.rep_range[1]} | "
                f"RIR: {exercise.rir}"
            )


def print_exercise_list(
    simulation: Simulation,
) -> None:
    print_header(
        "EXERCISES"
    )

    exercises = sorted(
        simulation.exercise_states.values(),
        key=lambda item: item.exercise_number,
    )

    for state in exercises:
        print(
            f"{state.exercise_number:2d}. "
            f"{state.name}"
        )


def show_exercise_progression(
    simulation: Simulation,
    exercise_number: int,
) -> None:
    selected = None

    for state in (
        simulation.exercise_states.values()
    ):
        if (
            state.exercise_number
            == exercise_number
        ):
            selected = state
            break

    if selected is None:
        print(
            "Exercise not found."
        )
        return

    print_header(
        selected.name
    )

    print(
        f"Exercise ID:     "
        f"{selected.exercise_id}"
    )

    print(
        f"Exercise #:      "
        f"{selected.exercise_number}"
    )

    print(
        f"Starting Weight: "
        f"{selected.starting_weight:.1f} lb"
    )

    print(
        f"Final Weight:    "
        f"{selected.current_weight:.1f} lb"
    )

    print(
        f"Starting Reps:   "
        f"{selected.starting_rep_range[0]}-"
        f"{selected.starting_rep_range[1]}"
    )

    print(
        f"Current Reps:    "
        f"{selected.current_rep_range[0]}-"
        f"{selected.current_rep_range[1]}"
    )

    print(
        f"Target RIR:      "
        f"{selected.target_rir:.1f}"
    )

    actions = Counter(
        entry["decision"]
        for entry in selected.history
    )

    print()
    print(
        "Progression Decisions"
    )

    print("-" * 80)

    for action in [
        "increase_weight",
        "increase_reps",
        "maintain",
        "decrease",
    ]:
        print(
            f"{action:<20}"
            f"{actions.get(action, 0):>5}"
        )

    print()
    print("Week History")
    print("-" * 105)

    print(
        f"{'Week':>4} "
        f"{'Weight':>9} "
        f"{'Reps':>9} "
        f"{'Avg RIR':>9} "
        f"{'Outcome':<12} "
        f"{'Action':<18}"
    )

    for entry in selected.history:
        reps = (
            f"{entry['prescribed_rep_range'][0]}-"
            f"{entry['prescribed_rep_range'][1]}"
        )

        print(
            f"{entry['week']:>4} "
            f"{entry['prescribed_weight']:>9.1f} "
            f"{reps:>9} "
            f"{entry['average_rir']:>9.2f} "
            f"{entry['outcome']:<12} "
            f"{entry['decision']:<18}"
        )


def select_individual_exercise(
    simulation: Simulation,
) -> None:
    print_exercise_list(
        simulation
    )

    while True:
        raw = input(
            "Select exercise number "
            "(or Enter to return): "
        ).strip()

        if not raw:
            return

        try:
            number = int(raw)
        except ValueError:
            print(
                "Invalid selection."
            )
            continue

        show_exercise_progression(
            simulation,
            number,
        )

        input(
            "\nPress Enter to return..."
        )

        return


def print_simulation_summary(
    results: dict[str, Any],
) -> None:
    print_header(
        "SIMULATION COMPLETE"
    )

    print(
        f"Weeks simulated: "
        f"{results['weeks']}"
    )

    print(
        f"Workout sessions: "
        f"{results['workout_sessions']}"
    )

    print(
        f"Exercise observations: "
        f"{results['exercise_observations']}"
    )

    print()
    print(
        "Progression Decisions"
    )

    print("-" * 80)

    decisions = results[
        "progression_decisions"
    ]

    for action in [
        "increase_weight",
        "increase_reps",
        "maintain",
        "decrease",
    ]:
        print(
            f"{action:<20}"
            f"{decisions.get(action, 0):>5}"
        )

    print()
    print(
        "Performance Outcomes"
    )

    print("-" * 80)

    outcomes = results[
        "performance_outcomes"
    ]

    for outcome in [
        "excellent",
        "good",
        "moderate",
        "poor",
        "failure",
    ]:
        print(
            f"{outcome:<20}"
            f"{outcomes.get(outcome, 0):>5}"
        )

    print()
    print(
        "Global Bayesian State"
    )

    print("-" * 80)

    state = results[
        "global_state"
    ]

    for action in [
        "increase_weight",
        "increase_reps",
        "maintain",
        "decrease",
    ]:
        action_state = state.get(
            action,
            {},
        )

        probability = action_state.get(
            "probability",
            action_state.get(
                "success_probability",
                0.0,
            ),
        )

        evidence = action_state.get(
            "evidence",
            0.0,
        )

        print(
            f"{action:<20}"
            f"P(success)={probability:.3f} "
            f"evidence={evidence:.1f}"
        )

    print()
    print(
        "Exercise Progression"
    )

    print("-" * 80)

    exercises = results[
        "exercise_progression"
    ]

    ordered = sorted(
        exercises.values(),
        key=lambda item: (
            item["exercise_number"]
        ),
    )

    for exercise in ordered:
        print(
            f"{exercise['exercise_number']:2d} "
            f"-> {results['weeks']:>2} | "
            f"{exercise['exercise_id']:<40} "
            f"{exercise['starting_weight']:>8.1f} "
            f"-> "
            f"{exercise['final_weight']:>8.1f} lb"
        )


def save_results(
    results: dict[str, Any],
) -> Path:
    RESULTS_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    result_file = (
        RESULTS_DIR
        / "simulation_results.json"
    )

    with result_file.open(
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(
            results,
            file,
            indent=2,
        )

    return result_file


def interactive_menu(
    simulation: Simulation,
    results: dict[str, Any],
) -> None:
    while True:
        print()
        print("=" * 80)
        print(
            "SIMULATION MENU"
        )
        print("=" * 80)

        print(
            "1. View generated workout"
        )

        print(
            "2. View all exercises"
        )

        print(
            "3. View individual "
            "exercise progression"
        )

        print(
            "4. View simulation summary"
        )

        print(
            "5. Exit"
        )

        choice = input(
            "Select: "
        ).strip()

        if choice == "1":
            print_program(
                simulation.program
            )

        elif choice == "2":
            print_exercise_list(
                simulation
            )

        elif choice == "3":
            select_individual_exercise(
                simulation
            )

        elif choice == "4":
            print_simulation_summary(
                results
            )

        elif choice == "5":
            return

        else:
            print(
                "Invalid selection."
            )


def confirm_configuration() -> bool:
    print()
    print(
        "1. Run simulation"
    )

    print(
        "2. Reconfigure"
    )

    print(
        "3. Exit"
    )

    while True:
        choice = input(
            "Select: "
        ).strip()

        if choice == "1":
            return True

        if choice == "2":
            return False

        if choice == "3":
            raise SystemExit(0)

        print(
            "Invalid selection."
        )


def main() -> None:
    while True:
        request, weeks, seed = (
            build_request()
        )

        try:
            preview = Simulation(
                request=request,
                weeks=weeks,
                seed=seed,
            )
        except Exception as exc:
            print()
            print(
                "Workout generation failed."
            )
            print(
                f"{type(exc).__name__}: "
                f"{exc}"
            )
            input(
                "Press Enter to return..."
            )
            continue

        print_configuration(
            request,
            weeks,
            seed,
        )

        print_program(
            preview.program
        )

        if confirm_configuration():
            break

    print_header(
        "RUNNING BAYESIAN SIMULATION"
    )

    print(
        f"Simulating {weeks} weeks..."
    )

    simulation = Simulation(
        request=request,
        weeks=weeks,
        seed=seed,
    )

    results = simulation.run()

    result_file = save_results(
        results
    )

    print_simulation_summary(
        results
    )

    print()
    print(
        "Global state: "
        f"{BASE_DIR / 'global_bayesian_state.json'}"
    )

    print(
        "Local state: "
        f"{BASE_DIR / 'local_bayesian_state.json'}"
    )

    print(
        "Simulation results: "
        f"{result_file}"
    )

    interactive_menu(
        simulation,
        results,
    )


if __name__ == "__main__":
    main()
