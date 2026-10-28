from __future__ import annotations

import json
import random
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np

from fast_global_progression_model import (
    ACTIONS,
    PERFORMANCE_CLASSES,
    GlobalObservation,
    GlobalProgressionModel,
    SetResult,
)
from fast_local_progression_model import LocalProgressionModel
from workout_generator import (
    ExerciseDatabase,
    WorkoutGenerator,
    WorkoutRequest,
)


BASE_DIR = Path(__file__).resolve().parent
EXERCISE_FILE = BASE_DIR / "normalized_exercises.json"
RESULTS_DIR = BASE_DIR / "simulation_results"


@dataclass
class ExerciseState:
    exercise_id: str
    name: str
    weight: float
    starting_weight: float
    rep_range: list[int]
    starting_rep_range: list[int]
    sets: int
    rir: float
    compound: bool
    equipment: list[str]
    movement_pattern: str | None
    role: str
    history: list[dict]


@dataclass
class SimulationMetrics:
    total_observations: int = 0
    correct_progressions: int = 0
    incorrect_progressions: int = 0
    acceptable_progressions: int = 0
    unacceptable_progressions: int = 0
    increase_weight: int = 0
    increase_reps: int = 0
    maintain: int = 0
    decrease: int = 0
    excellent: int = 0
    good: int = 0
    moderate: int = 0
    poor: int = 0
    failure: int = 0

    @property
    def decision_accuracy(self) -> float:
        if self.total_observations == 0:
            return 0.0
        return (
            self.correct_progressions
            / self.total_observations
        )

    @property
    def acceptable_accuracy(self) -> float:
        if self.total_observations == 0:
            return 0.0
        return (
            self.acceptable_progressions
            / self.total_observations
        )


class SimulatedAthlete:
    def __init__(
        self,
        seed: int = 42,
        ability: float = 0.60,
        consistency: float = 0.80,
        recovery: float = 0.78,
    ):
        self.rng = random.Random(seed)

        self.ability = float(
            np.clip(
                ability,
                0.25,
                0.90,
            )
        )

        self.consistency = float(
            np.clip(
                consistency,
                0.40,
                1.00,
            )
        )

        self.recovery = float(
            np.clip(
                recovery,
                0.40,
                1.00,
            )
        )

        self.fatigue = 0.0
        self.exercise_adaptation: dict[str, float] = {}
        self.exercise_familiarity: dict[str, float] = {}
        self.session_count = 0

    def _adaptation(
        self,
        exercise_id: str,
    ) -> float:
        return self.exercise_adaptation.get(
            exercise_id,
            0.0,
        )

    def _familiarity(
        self,
        exercise_id: str,
    ) -> float:
        return self.exercise_familiarity.get(
            exercise_id,
            0.0,
        )

    @staticmethod
    def _is_bodyweight(
        weight: float,
    ) -> bool:
        return weight <= 0.0

    def _update_fatigue(self):
        self.fatigue += self.rng.uniform(
            0.008,
            0.025,
        )

        recovery_amount = (
            self.recovery
            * self.rng.uniform(
                0.018,
                0.030,
            )
        )

        self.fatigue -= recovery_amount

        self.fatigue = float(
            np.clip(
                self.fatigue,
                0.0,
                0.35,
            )
        )

    def start_session(self):
        self.session_count += 1

        self.fatigue += self.rng.uniform(
            0.005,
            0.025,
        )

        if self.session_count % 4 == 0:
            recovery_bonus = (
                self.recovery
                * 0.06
            )

            self.fatigue = max(
                0.0,
                self.fatigue
                - recovery_bonus,
            )

    def _action_effect(
        self,
        previous_action: str | None,
    ) -> float:
        if previous_action == "increase_weight":
            return -0.075

        if previous_action == "increase_reps":
            return -0.025

        if previous_action == "maintain":
            return 0.015

        if previous_action == "decrease":
            return 0.065

        return 0.0

    def _difficulty(
        self,
        weight: float,
        compound: bool,
    ) -> float:
        if self._is_bodyweight(weight):
            return 0.0

        normalized_weight = (
            weight
            / (weight + 40.0)
        )

        compound_modifier = (
            0.035
            if compound
            else 0.015
        )

        return (
            normalized_weight * 0.16
            + compound_modifier
        )

    def simulate(
        self,
        prescription,
        previous_action: str | None = None,
    ) -> list[SetResult]:
        exercise_id = prescription.exercise_id

        self._update_fatigue()

        adaptation = self._adaptation(
            exercise_id
        )

        familiarity = self._familiarity(
            exercise_id
        )

        action_effect = self._action_effect(
            previous_action
        )

        difficulty = self._difficulty(
            prescription.weight,
            prescription.compound,
        )

        consistency_noise = self.rng.gauss(
            0.0,
            (1.0 - self.consistency) * 0.28,
        )

        recovery_variation = self.rng.gauss(
            0.0,
            (1.0 - self.recovery) * 0.10,
        )

        performance = (
            self.ability
            + adaptation
            + familiarity * 0.04
            + action_effect
            + consistency_noise
            + recovery_variation
            - self.fatigue
            - difficulty
        )

        performance = float(
            np.clip(
                performance,
                0.03,
                0.97,
            )
        )

        minimum, maximum = (
            prescription.rep_range
        )

        range_width = max(
            1,
            maximum - minimum,
        )

        rep_center = (
            minimum
            + range_width * performance
        )

        actual_sets: list[SetResult] = []

        for set_index in range(
            prescription.sets
        ):
            set_fatigue = (
                set_index
                * self.rng.uniform(
                    0.10,
                    0.20,
                )
            )

            set_performance = float(
                np.clip(
                    performance
                    - set_fatigue,
                    0.03,
                    0.97,
                )
            )

            variation = self.rng.gauss(
                0.0,
                0.85,
            )

            reps = int(
                round(
                    rep_center
                    + (
                        set_performance
                        - performance
                    ) * 2.0
                    + variation
                )
            )

            reps = max(
                1,
                min(
                    maximum + 1,
                    reps,
                ),
            )

            target_rir = prescription.rir

            rir = (
                target_rir
                + (
                    0.55
                    - set_performance
                ) * 2.1
                + self.rng.gauss(
                    0.0,
                    0.45,
                )
            )

            rir = float(
                np.clip(
                    rir,
                    0.0,
                    5.0,
                )
            )

            completion_probability = (
                0.66
                + performance * 0.30
                - max(
                    0.0,
                    -action_effect,
                ) * 0.25
            )

            completion_probability = float(
                np.clip(
                    completion_probability,
                    0.35,
                    0.99,
                )
            )

            completed = (
                self.rng.random()
                < completion_probability
            )

            actual_sets.append(
                SetResult(
                    weight=prescription.weight,
                    reps=reps,
                    rir=rir,
                    completed=completed,
                )
            )

        completed_sets = [
            result
            for result in actual_sets
            if result.completed
        ]

        if completed_sets:
            average_reps = float(
                np.mean(
                    [
                        result.reps
                        for result in completed_sets
                    ]
                )
            )
        else:
            average_reps = 0.0

        if average_reps >= maximum:
            adaptation_change = (
                self.rng.uniform(
                    0.008,
                    0.025,
                )
            )
        elif average_reps >= minimum:
            adaptation_change = (
                self.rng.uniform(
                    0.001,
                    0.012,
                )
            )
        elif average_reps >= minimum - 1:
            adaptation_change = (
                self.rng.uniform(
                    -0.010,
                    0.004,
                )
            )
        else:
            adaptation_change = (
                self.rng.uniform(
                    -0.020,
                    -0.002,
                )
            )

        self.exercise_adaptation[
            exercise_id
        ] = float(
            np.clip(
                adaptation
                + adaptation_change,
                -0.20,
                0.35,
            )
        )

        self.exercise_familiarity[
            exercise_id
        ] = float(
            np.clip(
                familiarity + 0.035,
                0.0,
                1.0,
            )
        )

        return actual_sets


class ProgressionSimulation:
    def __init__(
        self,
        weeks: int = 12,
        seed: int = 42,
        goal: str = "hypertrophy",
        experience: str = "intermediate",
        days_per_week: int = 4,
        split: str = "upper_lower",
        duration_minutes: int = 60,
    ):
        self.weeks = weeks
        self.seed = seed
        self.goal = goal
        self.experience = experience
        self.days_per_week = days_per_week
        self.split = split
        self.duration_minutes = duration_minutes

        self.rng = random.Random(seed)
        np.random.seed(seed)

        self.global_model = GlobalProgressionModel(
            state_file=BASE_DIR
            / "simulation_global_state.json"
        )

        self.local_model = LocalProgressionModel(
            self.global_model,
            state_file=BASE_DIR
            / "simulation_local_state.json",
        )

        self.athlete = SimulatedAthlete(
            seed=seed,
            ability=0.62,
            consistency=0.76,
            recovery=0.74,
        )

        self.exercise_states: dict[
            str,
            ExerciseState,
        ] = {}

        self.previous_actions: dict[
            str,
            str | None,
        ] = {}

        self.results: list[dict] = []

        self.metrics = SimulationMetrics()

    def _create_generator(self):
        if not EXERCISE_FILE.exists():
            raise FileNotFoundError(
                f"Could not find {EXERCISE_FILE}"
            )

        database = ExerciseDatabase(
            EXERCISE_FILE
        )

        return WorkoutGenerator(
            database=database,
            seed=self.seed,
        )

    def _create_request(self):
        return WorkoutRequest(
            goal=self.goal,
            experience=self.experience,
            days_per_week=self.days_per_week,
            split=self.split,
            duration_minutes=self.duration_minutes,
            equipment=[
                "barbell",
                "dumbbell",
                "cable",
                "body_weight",
                "leverage_machine",
                "smith_machine",
                "resistance_band",
                "kettlebell",
            ],
            preferences={
                "compound_priority": 0.70,
                "isolation_priority": 0.30,
                "exercise_variety": 0.50,
                "free_weight_preference": 0.50,
                "machine_preference": 0.50,
            },
            excluded_exercises=[],
            excluded_muscles=[],
            seed=self.seed,
        )

    def _weight_from_name(
        self,
        exercise,
    ) -> float:
        name = exercise.name.lower()

        equipment = {
            str(value).lower()
            for value in exercise.equipment
        }

        bodyweight_equipment = {
            "body_weight",
            "bodyweight",
        }

        bodyweight_terms = [
            "push up",
            "push-up",
            "pull up",
            "pull-up",
            "chin up",
            "chin-up",
            "muscle up",
            "muscle-up",
            "pistol squat",
            "handstand",
            "plank",
        ]

        if (
            equipment
            & bodyweight_equipment
        ):
            return 0.0

        if any(
            term in name
            for term in bodyweight_terms
        ):
            return 0.0

        if (
            "barbell" in equipment
        ):
            if exercise.compound:
                if any(
                    keyword in name
                    for keyword in [
                        "deadlift",
                        "rack pull",
                        "hip thrust",
                    ]
                ):
                    return 185.0

                if any(
                    keyword in name
                    for keyword in [
                        "squat",
                        "leg press",
                    ]
                ):
                    return 155.0

                return 95.0

            return 55.0

        if (
            "smith_machine" in equipment
            or "leverage_machine" in equipment
        ):
            if exercise.compound:
                return 90.0

            return 45.0

        if "machine" in equipment:
            if exercise.compound:
                return 80.0

            return 40.0

        if "cable" in equipment:
            if exercise.compound:
                return 60.0

            return 30.0

        if "dumbbell" in equipment:
            if exercise.compound:
                return 45.0

            return 20.0

        if "kettlebell" in equipment:
            if exercise.compound:
                return 40.0

            return 20.0

        if (
            "resistance_band" in equipment
            or "band" in equipment
        ):
            return 0.0

        if exercise.compound:
            return 50.0

        return 20.0

    def _get_state(
        self,
        exercise,
    ) -> ExerciseState:
        exercise_id = str(
            exercise.exercise_id
        )

        if exercise_id not in self.exercise_states:
            starting_weight = (
                self._weight_from_name(
                    exercise
                )
            )

            self.exercise_states[
                exercise_id
            ] = ExerciseState(
                exercise_id=exercise_id,
                name=exercise.name,
                weight=starting_weight,
                starting_weight=starting_weight,
                rep_range=list(
                    exercise.rep_range
                ),
                starting_rep_range=list(
                    exercise.rep_range
                ),
                sets=exercise.sets,
                rir=float(exercise.rir),
                compound=exercise.compound,
                equipment=list(
                    exercise.equipment
                ),
                movement_pattern=(
                    exercise.movement_pattern
                ),
                role=exercise.role,
                history=[],
            )

        return self.exercise_states[
            exercise_id
        ]

    @staticmethod
    def _is_bodyweight(
        state: ExerciseState,
    ) -> bool:
        return state.weight <= 0.0

    def _rep_cap(
        self,
        state: ExerciseState,
    ) -> int:
        if self.goal == "strength":
            return (
                8
                if state.compound
                else 12
            )

        if self.goal == "hypertrophy":
            return (
                12
                if state.compound
                else 15
            )

        return (
            15
            if state.compound
            else 20
        )

    def _rep_position(
        self,
        state: ExerciseState,
        actual_sets: list[SetResult],
    ) -> str:
        completed = [
            result
            for result in actual_sets
            if result.completed
        ]

        if not completed:
            return "below_range"

        minimum, maximum = (
            state.rep_range
        )

        average_reps = float(
            np.mean(
                [
                    result.reps
                    for result in completed
                ]
            )
        )

        if average_reps < minimum:
            return "below_range"

        if average_reps >= maximum:
            return "top_of_range"

        return "mid_range"

    def _eligible_actions(
        self,
        observation: GlobalObservation,
        performance: str,
        state: ExerciseState,
    ) -> list[str]:
        actions = self.global_model.eligible_actions(
            observation,
            performance,
        )

        actions = list(actions)

        if self._is_bodyweight(state):
            actions = [
                action
                for action in actions
                if action != "increase_weight"
            ]

        rep_cap = self._rep_cap(state)

        if state.rep_range[1] >= rep_cap:
            actions = [
                action
                for action in actions
                if action != "increase_reps"
            ]

            if (
                performance
                in {
                    "excellent",
                    "good",
                }
                and not self._is_bodyweight(state)
                and "increase_weight"
                not in actions
            ):
                actions.insert(
                    0,
                    "increase_weight",
                )

        if not actions:
            actions = ["maintain"]

        return actions

    def _update_models(
        self,
        state: ExerciseState,
        actual_sets: list[SetResult],
        previous_action: str | None,
    ):
        observation = GlobalObservation(
            actual_sets=actual_sets,
            previous_rep_range=tuple(
                state.rep_range
            ),
            previous_target_rir=state.rir,
            tested_action=previous_action,
        )

        performance = (
            self.global_model
            .performance(observation)
        )

        rep_position = (
            self.global_model
            .rep_position(observation)
        )

        score = (
            self.global_model
            .success_score(observation)
        )

        if previous_action is not None:
            self.global_model.update(
                observation
            )

            self.local_model.update(
                exercise=state.exercise_id,
                action=previous_action,
                score=score,
                performance=performance,
                rep_position=rep_position,
            )

        return (
            observation,
            performance,
            rep_position,
            score,
        )

    def _recommend(
        self,
        state: ExerciseState,
        actual_sets: list[SetResult],
        previous_action: str | None,
    ):
        (
            observation,
            performance,
            rep_position,
            score,
        ) = self._update_models(
            state,
            actual_sets,
            previous_action,
        )

        eligible_actions = (
            self._eligible_actions(
                observation,
                performance,
                state,
            )
        )

        local = self.local_model.recommend(
            exercise=state.exercise_id,
            eligible_actions=eligible_actions,
            performance=performance,
            rep_position=rep_position,
        )

        return {
            "decision": local["decision"],
            "confidence": local["confidence"],
            "probability": local[
                "probability"
            ],
            "probabilities": local[
                "probabilities"
            ],
            "performance": performance,
            "rep_position": rep_position,
            "score": score,
            "eligible_actions": eligible_actions,
        }

    def _true_action(
        self,
        performance: str,
        rep_position: str,
        state: ExerciseState,
        actual_sets: list[SetResult],
    ) -> str:
        completed = [
            result
            for result in actual_sets
            if result.completed
        ]

        if not completed:
            return "decrease"

        average_reps = float(
            np.mean(
                [
                    result.reps
                    for result in completed
                ]
            )
        )

        average_rir = float(
            np.mean(
                [
                    result.rir
                    for result in completed
                ]
            )
        )

        minimum, maximum = (
            state.rep_range
        )

        rep_cap = self._rep_cap(
            state
        )

        if performance == "failure":
            return "decrease"

        if performance == "poor":
            if (
                self.rng.random()
                < 0.75
            ):
                return "maintain"

            return "decrease"

        if performance == "moderate":
            if (
                average_reps
                < minimum
            ):
                return "maintain"

            if (
                self.rng.random()
                < 0.25
            ):
                return "increase_reps"

            return "maintain"

        if performance == "good":
            if (
                rep_position
                == "top_of_range"
            ):
                if (
                    maximum >= rep_cap
                    and not self._is_bodyweight(
                        state
                    )
                ):
                    return "increase_weight"

                if (
                    self._is_bodyweight(
                        state
                    )
                ):
                    return "increase_reps"

                if (
                    self.rng.random()
                    < 0.72
                ):
                    return "increase_reps"

                return "maintain"

            if (
                average_rir
                > state.rir + 1.0
            ):
                if (
                    self.rng.random()
                    < 0.75
                ):
                    return "increase_reps"

                return "maintain"

            if (
                self.rng.random()
                < 0.80
            ):
                return "increase_reps"

            return "maintain"

        if performance == "excellent":
            if (
                rep_position
                == "top_of_range"
            ):
                if (
                    not self._is_bodyweight(
                        state
                    )
                ):
                    if (
                        maximum >= rep_cap
                    ):
                        return "increase_weight"

                    if (
                        self.rng.random()
                        < 0.78
                    ):
                        return "increase_weight"

                return "increase_reps"

            if (
                self.rng.random()
                < 0.70
            ):
                return "increase_reps"

            return "maintain"

        return "maintain"

    def _acceptable_actions(
        self,
        performance: str,
        rep_position: str,
        state: ExerciseState,
    ) -> set[str]:
        bodyweight = self._is_bodyweight(
            state
        )

        rep_cap = self._rep_cap(
            state
        )

        if performance == "failure":
            return {
                "decrease",
                "maintain",
            }

        if performance == "poor":
            return {
                "decrease",
                "maintain",
            }

        if performance == "moderate":
            return {
                "maintain",
                "increase_reps",
            }

        if performance == "good":
            if (
                rep_position
                == "top_of_range"
            ):
                acceptable = {
                    "increase_reps",
                    "maintain",
                }

                if (
                    not bodyweight
                    and state.rep_range[1]
                    >= rep_cap
                ):
                    acceptable.add(
                        "increase_weight"
                    )

                return acceptable

            return {
                "increase_reps",
                "maintain",
            }

        if performance == "excellent":
            acceptable = {
                "increase_reps",
                "maintain",
            }

            if not bodyweight:
                acceptable.add(
                    "increase_weight"
                )

            return acceptable

        return {"maintain"}

    def _apply_action(
        self,
        state: ExerciseState,
        action: str,
    ) -> dict:
        old_weight = state.weight
        old_range = list(
            state.rep_range
        )

        requested_action = action
        applied_action = action

        if (
            action == "increase_weight"
            and self._is_bodyweight(state)
        ):
            applied_action = (
                "increase_reps"
            )

        if applied_action == "increase_weight":
            increment = (
                5.0
                if state.weight >= 100.0
                else 2.5
            )

            state.weight = round(
                state.weight + increment,
                2,
            )

            state.rep_range = list(
                state.starting_rep_range
            )

        elif applied_action == "increase_reps":
            low, high = (
                state.rep_range
            )

            cap = self._rep_cap(
                state
            )

            if high < cap:
                new_low = min(
                    low + 1,
                    cap - 1,
                )

                new_high = min(
                    high + 1,
                    cap,
                )

                state.rep_range = [
                    new_low,
                    new_high,
                ]

        elif applied_action == "maintain":
            state.weight = round(
                state.weight,
                2,
            )

        elif applied_action == "decrease":
            if not self._is_bodyweight(
                state
            ):
                reduction = (
                    5.0
                    if state.weight >= 100.0
                    else 2.5
                )

                state.weight = max(
                    0.0,
                    round(
                        state.weight
                        - reduction,
                        2,
                    ),
                )

            state.rep_range = list(
                state.starting_rep_range
            )

        return {
            "requested_action": (
                requested_action
            ),
            "applied_action": (
                applied_action
            ),
            "old_weight": old_weight,
            "new_weight": state.weight,
            "old_range": old_range,
            "new_range": list(
                state.rep_range
            ),
        }

    def _update_metrics(
        self,
        performance: str,
        rep_position: str,
        decision: str,
        true_action: str,
        state: ExerciseState,
    ):
        self.metrics.total_observations += 1

        if decision == true_action:
            self.metrics.correct_progressions += 1
        else:
            self.metrics.incorrect_progressions += 1

        acceptable = self._acceptable_actions(
            performance,
            rep_position,
            state,
        )

        if decision in acceptable:
            self.metrics.acceptable_progressions += 1
        else:
            self.metrics.unacceptable_progressions += 1

        if decision == "increase_weight":
            self.metrics.increase_weight += 1
        elif decision == "increase_reps":
            self.metrics.increase_reps += 1
        elif decision == "maintain":
            self.metrics.maintain += 1
        elif decision == "decrease":
            self.metrics.decrease += 1

        if performance == "excellent":
            self.metrics.excellent += 1
        elif performance == "good":
            self.metrics.good += 1
        elif performance == "moderate":
            self.metrics.moderate += 1
        elif performance == "poor":
            self.metrics.poor += 1
        elif performance == "failure":
            self.metrics.failure += 1

    def run(self):
        generator = self._create_generator()
        request = self._create_request()

        workouts = generator.generate_program(
            request
        )

        if not workouts:
            raise RuntimeError(
                "Workout generator produced no workouts."
            )

        print("=" * 80)
        print("PROGRESSION SIMULATION")
        print("=" * 80)
        print(
            f"Goal: {self.goal}"
        )
        print(
            f"Experience: {self.experience}"
        )
        print(
            f"Days/week: {self.days_per_week}"
        )
        print(
            f"Split: {self.split}"
        )
        print(
            f"Duration: "
            f"{self.duration_minutes} minutes"
        )
        print(
            f"Weeks: {self.weeks}"
        )
        print(
            f"Seed: {self.seed}"
        )
        print()

        for week in range(
            1,
            self.weeks + 1,
        ):
            print(
                f"Simulating week "
                f"{week}/{self.weeks}..."
            )

            for workout in workouts:
                self.athlete.start_session()

                for exercise in workout.exercises:
                    state = self._get_state(
                        exercise
                    )

                    exercise_id = (
                        state.exercise_id
                    )

                    previous_action = (
                        self.previous_actions.get(
                            exercise_id
                        )
                    )

                    prescription = type(
                        "Prescription",
                        (),
                        {
                            "exercise_id": exercise_id,
                            "weight": state.weight,
                            "rep_range": list(
                                state.rep_range
                            ),
                            "sets": state.sets,
                            "rir": state.rir,
                            "compound": state.compound,
                        },
                    )()

                    actual_sets = (
                        self.athlete.simulate(
                            prescription,
                            previous_action,
                        )
                    )

                    recommendation = (
                        self._recommend(
                            state,
                            actual_sets,
                            previous_action,
                        )
                    )

                    decision = (
                        recommendation[
                            "decision"
                        ]
                    )

                    true_action = (
                        self._true_action(
                            recommendation[
                                "performance"
                            ],
                            recommendation[
                                "rep_position"
                            ],
                            state,
                            actual_sets,
                        )
                    )

                    self._update_metrics(
                        recommendation[
                            "performance"
                        ],
                        recommendation[
                            "rep_position"
                        ],
                        decision,
                        true_action,
                        state,
                    )

                    progression = (
                        self._apply_action(
                            state,
                            decision,
                        )
                    )

                    self.previous_actions[
                        exercise_id
                    ] = progression[
                        "applied_action"
                    ]

                    result = {
                        "week": week,
                        "training_day": (
                            workout.training_day
                        ),
                        "workout": workout.name,
                        "exercise": state.name,
                        "exercise_id": exercise_id,
                        "performance": (
                            recommendation[
                                "performance"
                            ]
                        ),
                        "rep_position": (
                            recommendation[
                                "rep_position"
                            ]
                        ),
                        "score": round(
                            recommendation[
                                "score"
                            ],
                            4,
                        ),
                        "decision": decision,
                        "true_action": true_action,
                        "decision_correct": (
                            decision
                            == true_action
                        ),
                        "decision_acceptable": (
                            decision
                            in self._acceptable_actions(
                                recommendation[
                                    "performance"
                                ],
                                recommendation[
                                    "rep_position"
                                ],
                                state,
                            )
                        ),
                        "confidence": round(
                            recommendation[
                                "confidence"
                            ],
                            4,
                        ),
                        "probability": round(
                            recommendation[
                                "probability"
                            ],
                            4,
                        ),
                        "probabilities": {
                            key: round(
                                value,
                                4,
                            )
                            for key, value
                            in recommendation[
                                "probabilities"
                            ].items()
                        },
                        "eligible_actions": (
                            recommendation[
                                "eligible_actions"
                            ]
                        ),
                        "weight_before": (
                            progression[
                                "old_weight"
                            ]
                        ),
                        "weight_after": (
                            progression[
                                "new_weight"
                            ]
                        ),
                        "rep_range_before": (
                            progression[
                                "old_range"
                            ]
                        ),
                        "rep_range_after": (
                            progression[
                                "new_range"
                            ]
                        ),
                        "actual_sets": [
                            asdict(result)
                            for result in actual_sets
                        ],
                        "progression": progression,
                    }

                    state.history.append(
                        result
                    )

                    self.results.append(
                        result
                    )

        self._print_results()
        self._save_results()

        return self.results

    def _print_results(self):
        print()
        print("=" * 80)
        print("SIMULATION COMPLETE")
        print("=" * 80)

        print(
            f"Weeks simulated: "
            f"{self.weeks}"
        )

        print(
            f"Workout sessions: "
            f"{self.weeks * self.days_per_week}"
        )

        print(
            f"Exercise observations: "
            f"{len(self.results)}"
        )

        print()
        print("Progression Decisions")
        print("-" * 80)

        print(
            f"{'increase_weight':<25}"
            f"{self.metrics.increase_weight}"
        )

        print(
            f"{'increase_reps':<25}"
            f"{self.metrics.increase_reps}"
        )

        print(
            f"{'maintain':<25}"
            f"{self.metrics.maintain}"
        )

        print(
            f"{'decrease':<25}"
            f"{self.metrics.decrease}"
        )

        print()
        print("Performance Outcomes")
        print("-" * 80)

        print(
            f"{'excellent':<25}"
            f"{self.metrics.excellent}"
        )

        print(
            f"{'good':<25}"
            f"{self.metrics.good}"
        )

        print(
            f"{'moderate':<25}"
            f"{self.metrics.moderate}"
        )

        print(
            f"{'poor':<25}"
            f"{self.metrics.poor}"
        )

        print(
            f"{'failure':<25}"
            f"{self.metrics.failure}"
        )

        print()
        print("Model Accuracy")
        print("-" * 80)

        print(
            f"Correct decisions: "
            f"{self.metrics.correct_progressions}"
        )

        print(
            f"Incorrect decisions: "
            f"{self.metrics.incorrect_progressions}"
        )

        print(
            f"Exact decision accuracy: "
            f"{self.metrics.decision_accuracy:.2%}"
        )

        print(
            f"Acceptable decisions: "
            f"{self.metrics.acceptable_progressions}"
        )

        print(
            f"Unacceptable decisions: "
            f"{self.metrics.unacceptable_progressions}"
        )

        print(
            f"Acceptable decision accuracy: "
            f"{self.metrics.acceptable_accuracy:.2%}"
        )

        print()
        print("Exercise Progression")
        print("-" * 80)

        for state in sorted(
            self.exercise_states.values(),
            key=lambda item:
                item.name.lower(),
        ):
            print(
                f"{state.name}: "
                f"{state.starting_weight:.1f} -> "
                f"{state.weight:.1f} | "
                f"{state.starting_rep_range} -> "
                f"{state.rep_range}"
            )

    def _save_results(self):
        RESULTS_DIR.mkdir(
            parents=True,
            exist_ok=True,
        )

        output = {
            "configuration": {
                "weeks": self.weeks,
                "seed": self.seed,
                "goal": self.goal,
                "experience": self.experience,
                "days_per_week": (
                    self.days_per_week
                ),
                "split": self.split,
                "duration_minutes": (
                    self.duration_minutes
                ),
            },
            "metrics": {
                "total_observations": (
                    self.metrics.total_observations
                ),
                "correct_progressions": (
                    self.metrics.correct_progressions
                ),
                "incorrect_progressions": (
                    self.metrics.incorrect_progressions
                ),
                "decision_accuracy": (
                    self.metrics.decision_accuracy
                ),
                "acceptable_progressions": (
                    self.metrics.acceptable_progressions
                ),
                "unacceptable_progressions": (
                    self.metrics.unacceptable_progressions
                ),
                "acceptable_accuracy": (
                    self.metrics.acceptable_accuracy
                ),
                "increase_weight": (
                    self.metrics.increase_weight
                ),
                "increase_reps": (
                    self.metrics.increase_reps
                ),
                "maintain": (
                    self.metrics.maintain
                ),
                "decrease": (
                    self.metrics.decrease
                ),
                "excellent": (
                    self.metrics.excellent
                ),
                "good": (
                    self.metrics.good
                ),
                "moderate": (
                    self.metrics.moderate
                ),
                "poor": (
                    self.metrics.poor
                ),
                "failure": (
                    self.metrics.failure
                ),
            },
            "results": self.results,
            "exercise_states": {
                key: asdict(value)
                for key, value
                in self.exercise_states.items()
            },
        }

        result_path = (
            RESULTS_DIR
            / "progression_simulation.json"
        )

        result_path.write_text(
            json.dumps(
                output,
                indent=2,
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )

        print()
        print(
            f"Results saved to: "
            f"{result_path}"
        )


def main():
    simulation = ProgressionSimulation(
        weeks=12,
        seed=42,
        goal="hypertrophy",
        experience="intermediate",
        days_per_week=4,
        split="upper_lower",
        duration_minutes=60,
    )

    simulation.run()


if __name__ == "__main__":
    main()
