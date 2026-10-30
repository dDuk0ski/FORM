from __future__ import annotations

import json
import random
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np

from fast_global_progression_model import GlobalObservation, GlobalProgressionModel, SetResult
from fast_local_progression_model import LocalProgressionModel
from workout_generator import ExerciseDatabase, WorkoutGenerator, WorkoutRequest


BASE_DIR = Path(__file__).resolve().parent
EXERCISE_FILE = BASE_DIR / "normalized_exercises.json"
RESULTS_DIR = BASE_DIR / "simulation_results"
PROGRESSION_TYPES = ["weighted", "bodyweight", "assisted"]
ACTIONS = ["increase_weight", "increase_reps", "maintain", "decrease"]


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
    progression_type: str
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
    progression_type_metrics: dict = None
    confusion_matrices: dict = None

    def __post_init__(self):
        if self.progression_type_metrics is None:
            self.progression_type_metrics = {
                progression_type: {
                    "total": 0,
                    "correct": 0,
                    "incorrect": 0,
                    "acceptable": 0,
                    "unacceptable": 0,
                }
                for progression_type in PROGRESSION_TYPES
            }

        if self.confusion_matrices is None:
            self.confusion_matrices = {
                progression_type: {
                    predicted: {true_action: 0 for true_action in ACTIONS}
                    for predicted in ACTIONS
                }
                for progression_type in PROGRESSION_TYPES
            }

    @property
    def decision_accuracy(self):
        return self.correct_progressions / self.total_observations if self.total_observations else 0.0

    @property
    def acceptable_accuracy(self):
        return self.acceptable_progressions / self.total_observations if self.total_observations else 0.0

    def type_accuracy(self, progression_type):
        metrics = self.progression_type_metrics[progression_type]
        return metrics["correct"] / metrics["total"] if metrics["total"] else 0.0

    def type_acceptable_accuracy(self, progression_type):
        metrics = self.progression_type_metrics[progression_type]
        return metrics["acceptable"] / metrics["total"] if metrics["total"] else 0.0


class SimulatedAthlete:
    def __init__(self, seed=42):
        self.rng = random.Random(seed)
        self.fatigue = 0.0
        self.session_count = 0
        self.exercise_adaptation = {}
        self.exercise_familiarity = {}

    def _adaptation(self, exercise_id):
        return self.exercise_adaptation.get(exercise_id, 0.0)

    def _familiarity(self, exercise_id):
        return self.exercise_familiarity.get(exercise_id, 0.0)

    def _update_fatigue(self):
        self.fatigue += self.rng.uniform(0.008, 0.025)
        self.fatigue = float(np.clip(self.fatigue, 0.0, 0.35))

    def start_session(self):
        self.session_count += 1
        self.fatigue += self.rng.uniform(0.005, 0.020)
        if self.session_count % 4 == 0:
            self.fatigue = max(0.0, self.fatigue - 0.08)

    def _difficulty(self, weight, compound):
        if weight <= 0:
            return 0.05 if compound else 0.02
        normalized_weight = weight / (weight + 50.0)
        return normalized_weight * 0.15 + (0.035 if compound else 0.015)

    def _select_performance_class(self, exercise_id, previous_action):
        weights = {"excellent": 0.15, "good": 0.45, "moderate": 0.20, "poor": 0.15, "failure": 0.05}
        adaptation = self._adaptation(exercise_id)
        fatigue = self.fatigue

        if adaptation > 0.08:
            weights["excellent"] += 0.05
            weights["moderate"] -= 0.025
            weights["poor"] -= 0.025

        if fatigue > 0.18:
            weights["excellent"] -= 0.05
            weights["good"] -= 0.05
            weights["moderate"] += 0.04
            weights["poor"] += 0.04
            weights["failure"] += 0.02

        if previous_action == "increase_weight":
            weights["excellent"] -= 0.03
            weights["good"] -= 0.03
            weights["moderate"] += 0.03
            weights["poor"] += 0.025
            weights["failure"] += 0.005

        if previous_action == "decrease":
            weights["excellent"] += 0.025
            weights["good"] += 0.025
            weights["moderate"] -= 0.02
            weights["poor"] -= 0.02
            weights["failure"] -= 0.01

        weights = {key: max(0.001, value) for key, value in weights.items()}
        total = sum(weights.values())
        probabilities = {key: value / total for key, value in weights.items()}

        return self.rng.choices(list(probabilities.keys()), weights=list(probabilities.values()), k=1)[0]

    def simulate(self, prescription, previous_action=None):
        exercise_id = prescription.exercise_id
        self._update_fatigue()
        performance_class = self._select_performance_class(exercise_id, previous_action)
        minimum, maximum = prescription.rep_range

        if performance_class == "excellent":
            rep_target = maximum
            rir_target = prescription.rir + self.rng.uniform(0.4, 1.2)
            completion_probability = 0.99
        elif performance_class == "good":
            rep_target = self.rng.uniform(minimum + (maximum - minimum) * 0.45, maximum)
            rir_target = prescription.rir + self.rng.uniform(-0.2, 0.6)
            completion_probability = 0.96
        elif performance_class == "moderate":
            rep_target = self.rng.uniform(minimum - 0.2, maximum - (maximum - minimum) * 0.35)
            rir_target = prescription.rir + self.rng.uniform(-0.7, 0.1)
            completion_probability = 0.88
        elif performance_class == "poor":
            rep_target = self.rng.uniform(max(1, minimum - 1.5), minimum + 0.5)
            rir_target = prescription.rir + self.rng.uniform(-1.5, -0.4)
            completion_probability = 0.68
        else:
            rep_target = self.rng.uniform(1, max(1, minimum - 1.5))
            rir_target = self.rng.uniform(0.0, max(0.5, prescription.rir - 1.5))
            completion_probability = 0.40

        difficulty = self._difficulty(prescription.weight, prescription.compound)
        rep_adjustment = -difficulty * 2.0
        rir_adjustment = difficulty * 1.5
        actual_sets = []

        for set_index in range(prescription.sets):
            set_fatigue = set_index * self.rng.uniform(0.08, 0.18)
            reps = int(round(rep_target + rep_adjustment - set_fatigue + self.rng.gauss(0.0, 0.45)))

            if performance_class in ["excellent", "good"]:
                reps = max(minimum, min(maximum, reps))
            elif performance_class == "moderate":
                reps = max(minimum - 1, min(maximum - 1, reps))
            elif performance_class == "poor":
                reps = max(1, min(minimum, reps))
            else:
                reps = max(1, min(minimum - 1, reps))

            rir = float(np.clip(rir_target + rir_adjustment + self.rng.gauss(0.0, 0.25), 0.0, 5.0))
            adjusted_completion = completion_probability - set_index * 0.04
            completed = self.rng.random() < adjusted_completion
            actual_sets.append(SetResult(weight=prescription.weight, reps=reps, rir=rir, completed=completed))

        if performance_class == "excellent":
            adaptation_change = self.rng.uniform(0.008, 0.018)
        elif performance_class == "good":
            adaptation_change = self.rng.uniform(0.002, 0.010)
        elif performance_class == "moderate":
            adaptation_change = self.rng.uniform(-0.002, 0.005)
        elif performance_class == "poor":
            adaptation_change = self.rng.uniform(-0.010, 0.002)
        else:
            adaptation_change = self.rng.uniform(-0.020, -0.005)

        current_adaptation = self._adaptation(exercise_id)
        self.exercise_adaptation[exercise_id] = float(np.clip(current_adaptation + adaptation_change, -0.20, 0.25))
        self.exercise_familiarity[exercise_id] = float(np.clip(self._familiarity(exercise_id) + 0.025, 0.0, 1.0))

        return actual_sets


class ProgressionSimulation:
    def __init__(self, weeks=12, seed=42, goal="hypertrophy", experience="intermediate", days_per_week=4, split="upper_lower", duration_minutes=60, reset_state=True):
        self.weeks = weeks
        self.seed = seed
        self.goal = goal
        self.experience = experience
        self.days_per_week = days_per_week
        self.split = split
        self.duration_minutes = duration_minutes
        self.reset_state = reset_state
        self.rng = random.Random(seed)
        np.random.seed(seed)
        self.global_state_file = BASE_DIR / "simulation_global_state.json"
        self.local_state_file = BASE_DIR / "simulation_local_state.json"

        if reset_state:
            self.global_state_file.unlink(missing_ok=True)
            self.local_state_file.unlink(missing_ok=True)

        self.global_model = GlobalProgressionModel(state_file=self.global_state_file)
        self.local_model = LocalProgressionModel(self.global_model, state_file=self.local_state_file)
        self.athlete = SimulatedAthlete(seed=seed)
        self.exercise_states = {}
        self.previous_actions = {}
        self.results = []
        self.metrics = SimulationMetrics()

    def _create_generator(self):
        if not EXERCISE_FILE.exists():
            raise FileNotFoundError(f"Could not find {EXERCISE_FILE}")
        database = ExerciseDatabase(EXERCISE_FILE)
        return WorkoutGenerator(database=database, seed=self.seed)

    def _create_request(self):
        return WorkoutRequest(
            goal=self.goal,
            experience=self.experience,
            days_per_week=self.days_per_week,
            split=self.split,
            duration_minutes=self.duration_minutes,
            equipment=["barbell", "dumbbell", "cable", "body_weight", "leverage_machine", "smith_machine", "resistance_band", "kettlebell"],
            preferences={"compound_priority": 0.70, "isolation_priority": 0.30, "exercise_variety": 0.50, "free_weight_preference": 0.50, "machine_preference": 0.50},
            excluded_exercises=[],
            excluded_muscles=[],
            seed=self.seed,
        )

    def _progression_type(self, exercise):
        name = exercise.name.lower()
        equipment = {str(value).lower() for value in exercise.equipment}
        assisted_terms = ["assisted", "assistance", "assisted pull", "assisted chin", "assisted dip"]

        if any(term in name for term in assisted_terms):
            return "assisted"

        if "assisted" in equipment or "assistance" in equipment:
            return "assisted"

        bodyweight_terms = ["push up", "push-up", "pull up", "pull-up", "chin up", "chin-up", "muscle up", "muscle-up", "pistol squat", "handstand", "plank", "dip"]

        if "body_weight" in equipment or "bodyweight" in equipment:
            return "bodyweight"

        if any(term in name for term in bodyweight_terms):
            return "bodyweight"

        return "weighted"

    def _weight_from_name(self, exercise):
        name = exercise.name.lower()
        equipment = {str(value).lower() for value in exercise.equipment}
        progression_type = self._progression_type(exercise)

        if progression_type == "bodyweight":
            return 0.0

        if progression_type == "assisted":
            return 40.0

        if "barbell" in equipment:
            if exercise.compound:
                if any(keyword in name for keyword in ["deadlift", "rack pull", "hip thrust"]):
                    return 185.0
                if any(keyword in name for keyword in ["squat", "leg press"]):
                    return 155.0
                return 95.0
            return 55.0

        if "smith_machine" in equipment or "leverage_machine" in equipment:
            return 90.0 if exercise.compound else 45.0

        if "machine" in equipment:
            return 80.0 if exercise.compound else 40.0

        if "cable" in equipment:
            return 60.0 if exercise.compound else 30.0

        if "dumbbell" in equipment:
            return 45.0 if exercise.compound else 20.0

        if "kettlebell" in equipment:
            return 40.0 if exercise.compound else 20.0

        if "resistance_band" in equipment or "band" in equipment:
            return 0.0

        return 50.0 if exercise.compound else 20.0

    def _get_state(self, exercise):
        exercise_id = str(exercise.exercise_id)

        if exercise_id not in self.exercise_states:
            progression_type = self._progression_type(exercise)
            starting_weight = self._weight_from_name(exercise)

            self.exercise_states[exercise_id] = ExerciseState(
                exercise_id=exercise_id,
                name=exercise.name,
                weight=starting_weight,
                starting_weight=starting_weight,
                rep_range=list(exercise.rep_range),
                starting_rep_range=list(exercise.rep_range),
                sets=exercise.sets,
                rir=float(exercise.rir),
                compound=exercise.compound,
                equipment=list(exercise.equipment),
                movement_pattern=exercise.movement_pattern,
                role=exercise.role,
                progression_type=progression_type,
                history=[],
            )

        return self.exercise_states[exercise_id]

    def _rep_cap(self, state):
        if self.goal == "strength":
            return 8 if state.compound else 12
        if self.goal == "hypertrophy":
            return 12 if state.compound else 15
        return 15 if state.compound else 20

    def _eligible_actions(self, observation, performance, state):
        actions = list(self.global_model.eligible_actions(observation, performance))
        progression_type = state.progression_type

        if progression_type == "bodyweight":
            actions = [action for action in actions if action != "increase_weight"]

        rep_cap = self._rep_cap(state)

        if state.rep_range[1] >= rep_cap:
            actions = [action for action in actions if action != "increase_reps"]

            if performance in {"excellent", "good"} and progression_type in {"weighted", "assisted"} and "increase_weight" not in actions:
                actions.insert(0, "increase_weight")

        if performance in {"excellent", "good"} and state.rep_range[1] >= rep_cap and progression_type in {"weighted", "assisted"}:
            actions = [action for action in actions if action != "maintain"]

        if not actions:
            actions = ["maintain"]

        return list(dict.fromkeys(actions))

    def _update_models(self, state, actual_sets, previous_action):
        observation = GlobalObservation(actual_sets=actual_sets, previous_rep_range=tuple(state.rep_range), previous_target_rir=state.rir, tested_action=previous_action, progression_type=state.progression_type)
        performance = self.global_model.performance(observation)
        rep_position = self.global_model.rep_position(observation)
        score = self.global_model.success_score(observation)
        eligible_actions = self._eligible_actions(observation, performance, state)

        if previous_action is not None:
            for action in eligible_actions:
                training_observation = GlobalObservation(actual_sets=actual_sets, previous_rep_range=tuple(state.rep_range), previous_target_rir=state.rir, tested_action=action, progression_type=state.progression_type)
                self.global_model.update(training_observation)
                action_score = self.global_model.action_score(training_observation, action)
                self.local_model.update(exercise=state.exercise_id, action=action, score=action_score, performance=performance, rep_position=rep_position)

        return observation, performance, rep_position, score, eligible_actions

    def _recommend(self, state, actual_sets, previous_action):
        observation, performance, rep_position, score, eligible_actions = self._update_models(state, actual_sets, previous_action)
        local = self.local_model.recommend(exercise=state.exercise_id, eligible_actions=eligible_actions, performance=performance, rep_position=rep_position)

        return {
            "decision": local["decision"],
            "confidence": local["confidence"],
            "probability": local["probability"],
            "probabilities": local["probabilities"],
            "performance": performance,
            "rep_position": rep_position,
            "score": score,
            "eligible_actions": eligible_actions,
            "progression_type": state.progression_type,
        }

    def _true_action(self, performance, rep_position, state, actual_sets):
        completed = [result for result in actual_sets if result.completed]

        if not completed:
            return "decrease"

        average_reps = float(np.mean([result.reps for result in completed]))
        minimum, maximum = state.rep_range

        if performance == "failure":
            return "decrease"

        if performance == "poor":
            return "decrease" if average_reps < minimum - 1 else "maintain"

        if performance == "moderate":
            return "maintain"

        if performance in {"good", "excellent"}:
            if rep_position == "top_of_range":
                if state.progression_type == "bodyweight":
                    return "increase_reps"
                return "increase_weight"
            return "increase_reps"

        return "maintain"

    def _acceptable_actions(self, performance, rep_position, state):
        progression_type = state.progression_type
        rep_cap = self._rep_cap(state)

        if performance in {"failure", "poor"}:
            return {"decrease", "maintain"}

        if performance == "moderate":
            return {"maintain", "increase_reps"}

        if performance == "good":
            if rep_position == "top_of_range":
                acceptable = {"increase_reps"}
                if progression_type in {"weighted", "assisted"}:
                    acceptable.add("increase_weight")
                if state.rep_range[1] < rep_cap:
                    acceptable.add("maintain")
                return acceptable
            return {"increase_reps", "maintain"}

        if performance == "excellent":
            acceptable = {"increase_reps"}
            if progression_type in {"weighted", "assisted"}:
                acceptable.add("increase_weight")
            return acceptable

        return {"maintain"}

    def _apply_action(self, state, action):
        old_weight = state.weight
        old_range = list(state.rep_range)
        requested_action = action
        applied_action = action

        if state.progression_type == "bodyweight" and action == "increase_weight":
            applied_action = "increase_reps"

        if applied_action == "increase_weight":
            if state.progression_type == "assisted":
                reduction = 5.0 if state.weight >= 20.0 else 2.5
                state.weight = max(0.0, round(state.weight - reduction, 2))
            else:
                increment = 5.0 if state.weight >= 100.0 else 2.5
                state.weight = round(state.weight + increment, 2)

            state.rep_range = list(state.starting_rep_range)

        elif applied_action == "increase_reps":
            low, high = state.rep_range
            cap = self._rep_cap(state)

            if high < cap:
                state.rep_range = [min(low + 1, cap - 1), min(high + 1, cap)]

        elif applied_action == "decrease":
            if state.progression_type == "weighted":
                reduction = 5.0 if state.weight >= 100.0 else 2.5
                state.weight = max(0.0, round(state.weight - reduction, 2))
            elif state.progression_type == "assisted":
                increase = 5.0 if state.weight >= 20.0 else 2.5
                state.weight = round(state.weight + increase, 2)

            state.rep_range = list(state.starting_rep_range)

        return {
            "requested_action": requested_action,
            "applied_action": applied_action,
            "progression_type": state.progression_type,
            "old_weight": old_weight,
            "new_weight": state.weight,
            "old_range": old_range,
            "new_range": list(state.rep_range),
        }

    def _update_metrics(self, performance, rep_position, decision, true_action, state):
        self.metrics.total_observations += 1

        if decision == true_action:
            self.metrics.correct_progressions += 1
        else:
            self.metrics.incorrect_progressions += 1

        acceptable = self._acceptable_actions(performance, rep_position, state)

        if decision in acceptable:
            self.metrics.acceptable_progressions += 1
        else:
            self.metrics.unacceptable_progressions += 1

        type_metrics = self.metrics.progression_type_metrics[state.progression_type]
        type_metrics["total"] += 1

        if decision == true_action:
            type_metrics["correct"] += 1
        else:
            type_metrics["incorrect"] += 1

        if decision in acceptable:
            type_metrics["acceptable"] += 1
        else:
            type_metrics["unacceptable"] += 1

        self.metrics.confusion_matrices[state.progression_type][decision][true_action] += 1

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
        workouts = generator.generate_program(request)

        if not workouts:
            raise RuntimeError("Workout generator produced no workouts.")

        print("=" * 80)
        print("PROGRESSION SIMULATION")
        print("=" * 80)
        print(f"Goal: {self.goal}")
        print(f"Experience: {self.experience}")
        print(f"Days/week: {self.days_per_week}")
        print(f"Split: {self.split}")
        print(f"Duration: {self.duration_minutes} minutes")
        print(f"Weeks: {self.weeks}")
        print(f"Seed: {self.seed}")
        print(f"Reset model state: {self.reset_state}")
        print()

        for week in range(1, self.weeks + 1):
            print(f"Simulating week {week}/{self.weeks}...")

            for workout in workouts:
                self.athlete.start_session()

                for exercise in workout.exercises:
                    state = self._get_state(exercise)
                    exercise_id = state.exercise_id
                    previous_action = self.previous_actions.get(exercise_id)

                    prescription = type("Prescription", (), {
                        "exercise_id": exercise_id,
                        "weight": state.weight,
                        "rep_range": list(state.rep_range),
                        "sets": state.sets,
                        "rir": state.rir,
                        "compound": state.compound,
                    })()

                    actual_sets = self.athlete.simulate(prescription, previous_action)
                    recommendation = self._recommend(state, actual_sets, previous_action)
                    decision = recommendation["decision"]
                    true_action = self._true_action(recommendation["performance"], recommendation["rep_position"], state, actual_sets)

                    self._update_metrics(recommendation["performance"], recommendation["rep_position"], decision, true_action, state)

                    progression = self._apply_action(state, decision)
                    self.previous_actions[exercise_id] = progression["applied_action"]

                    result = {
                        "week": week,
                        "training_day": workout.training_day,
                        "workout": workout.name,
                        "exercise": state.name,
                        "exercise_id": exercise_id,
                        "progression_type": state.progression_type,
                        "performance": recommendation["performance"],
                        "rep_position": recommendation["rep_position"],
                        "score": round(recommendation["score"], 4),
                        "decision": decision,
                        "true_action": true_action,
                        "decision_correct": decision == true_action,
                        "decision_acceptable": decision in self._acceptable_actions(recommendation["performance"], recommendation["rep_position"], state),
                        "confidence": round(recommendation["confidence"], 4),
                        "probability": round(recommendation["probability"], 4),
                        "probabilities": {key: round(value, 4) for key, value in recommendation["probabilities"].items()},
                        "eligible_actions": recommendation["eligible_actions"],
                        "weight_before": progression["old_weight"],
                        "weight_after": progression["new_weight"],
                        "rep_range_before": progression["old_range"],
                        "rep_range_after": progression["new_range"],
                        "actual_sets": [asdict(result) for result in actual_sets],
                        "progression": progression,
                    }

                    state.history.append(result)
                    self.results.append(result)

        self._print_results()
        self._save_results()
        return self.results

    def _print_confusion_matrix(self, progression_type):
        matrix = self.metrics.confusion_matrices[progression_type]

        print()
        print(progression_type.upper())
        print("-" * 80)
        print("Rows = Predicted Action")
        print("Columns = True Action")
        print()

        header = f"{'Predicted':<20}" + "".join(f"{action:<20}" for action in ACTIONS)
        print(header)
        print("-" * 100)

        for predicted in ACTIONS:
            values = "".join(f"{matrix[predicted][true_action]:<20}" for true_action in ACTIONS)
            print(f"{predicted:<20}{values}")

    def _print_results(self):
        print()
        print("=" * 80)
        print("SIMULATION COMPLETE")
        print("=" * 80)
        print(f"Weeks simulated: {self.weeks}")
        print(f"Workout sessions: {self.weeks * self.days_per_week}")
        print(f"Exercise observations: {len(self.results)}")
        print()

        print("Progression Decisions")
        print("-" * 80)
        print(f"{'increase_weight':<25}{self.metrics.increase_weight}")
        print(f"{'increase_reps':<25}{self.metrics.increase_reps}")
        print(f"{'maintain':<25}{self.metrics.maintain}")
        print(f"{'decrease':<25}{self.metrics.decrease}")
        print()

        print("Performance Outcomes")
        print("-" * 80)

        total = max(1, self.metrics.total_observations)

        print(f"{'excellent':<25}{self.metrics.excellent} ({self.metrics.excellent / total:.1%})")
        print(f"{'good':<25}{self.metrics.good} ({self.metrics.good / total:.1%})")
        print(f"{'moderate':<25}{self.metrics.moderate} ({self.metrics.moderate / total:.1%})")
        print(f"{'poor':<25}{self.metrics.poor} ({self.metrics.poor / total:.1%})")
        print(f"{'failure':<25}{self.metrics.failure} ({self.metrics.failure / total:.1%})")

        print()
        print("Model Accuracy")
        print("-" * 80)
        print(f"Correct decisions: {self.metrics.correct_progressions}")
        print(f"Incorrect decisions: {self.metrics.incorrect_progressions}")
        print(f"Exact decision accuracy: {self.metrics.decision_accuracy:.2%}")
        print(f"Acceptable decisions: {self.metrics.acceptable_progressions}")
        print(f"Unacceptable decisions: {self.metrics.unacceptable_progressions}")
        print(f"Acceptable decision accuracy: {self.metrics.acceptable_accuracy:.2%}")

        print()
        print("Accuracy By Progression Type")
        print("-" * 80)

        for progression_type in PROGRESSION_TYPES:
            type_metrics = self.metrics.progression_type_metrics[progression_type]
            print()
            print(progression_type.upper())
            print(f"  Observations: {type_metrics['total']}")
            print(f"  Correct: {type_metrics['correct']}")
            print(f"  Incorrect: {type_metrics['incorrect']}")
            print(f"  Exact accuracy: {self.metrics.type_accuracy(progression_type):.2%}")
            print(f"  Acceptable: {type_metrics['acceptable']}")
            print(f"  Unacceptable: {type_metrics['unacceptable']}")
            print(f"  Acceptable accuracy: {self.metrics.type_acceptable_accuracy(progression_type):.2%}")

        print()
        print("=" * 80)
        print("CONFUSION MATRICES")
        print("=" * 80)

        for progression_type in PROGRESSION_TYPES:
            self._print_confusion_matrix(progression_type)

        print()
        print("=" * 80)
        print("Exercise Progression")
        print("=" * 80)

        for state in sorted(self.exercise_states.values(), key=lambda item: item.name.lower()):
            if state.progression_type == "weighted":
                progression_label = f"{state.starting_weight:.1f} -> {state.weight:.1f}"
            elif state.progression_type == "assisted":
                progression_label = f"{state.starting_weight:.1f} assist -> {state.weight:.1f} assist"
            else:
                progression_label = "bodyweight"

            print(f"{state.name}: [{state.progression_type}] {progression_label} | {state.starting_rep_range} -> {state.rep_range}")

    def _save_results(self):
        RESULTS_DIR.mkdir(parents=True, exist_ok=True)

        output = {
            "configuration": {
                "weeks": self.weeks,
                "seed": self.seed,
                "goal": self.goal,
                "experience": self.experience,
                "days_per_week": self.days_per_week,
                "split": self.split,
                "duration_minutes": self.duration_minutes,
                "reset_state": self.reset_state,
            },
            "metrics": {
                "total_observations": self.metrics.total_observations,
                "correct_progressions": self.metrics.correct_progressions,
                "incorrect_progressions": self.metrics.incorrect_progressions,
                "decision_accuracy": self.metrics.decision_accuracy,
                "acceptable_progressions": self.metrics.acceptable_progressions,
                "unacceptable_progressions": self.metrics.unacceptable_progressions,
                "acceptable_accuracy": self.metrics.acceptable_accuracy,
                "increase_weight": self.metrics.increase_weight,
                "increase_reps": self.metrics.increase_reps,
                "maintain": self.metrics.maintain,
                "decrease": self.metrics.decrease,
                "excellent": self.metrics.excellent,
                "good": self.metrics.good,
                "moderate": self.metrics.moderate,
                "poor": self.metrics.poor,
                "failure": self.metrics.failure,
                "progression_type_metrics": self.metrics.progression_type_metrics,
                "confusion_matrices": self.metrics.confusion_matrices,
            },
            "results": self.results,
            "exercise_states": {key: asdict(value) for key, value in self.exercise_states.items()},
        }

        result_path = RESULTS_DIR / "progression_simulation.json"
        result_path.write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")

        print()
        print(f"Results saved to: {result_path}")


def main():
    simulation = ProgressionSimulation(
        weeks=52,
        seed=42,
        goal="hypertrophy",
        experience="intermediate",
        days_per_week=4,
        split="upper_lower",
        duration_minutes=60,
        reset_state=True,
    )
    simulation.run()


if __name__ == "__main__":
    main()