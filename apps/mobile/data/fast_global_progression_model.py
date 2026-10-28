import json
from pathlib import Path
import numpy as np
from dataclasses import dataclass

ACTIONS = ["increase_weight", "increase_reps", "maintain", "decrease"]

PERFORMANCE_CLASSES = [
    "excellent",
    "good",
    "moderate",
    "poor",
    "failure",
]

REP_POSITIONS = [
    "below_range",
    "mid_range",
    "top_of_range",
]


@dataclass
class SetResult:
    weight: float
    reps: int
    rir: float
    completed: bool = True


@dataclass
class GlobalObservation:
    actual_sets: list[SetResult]
    previous_rep_range: tuple[int, int]
    previous_target_rir: float
    tested_action: str | None = None


@dataclass
class Recommendation:
    decision: str
    probabilities: dict[str, float]
    performance_score: float
    performance_class: str
    rep_position: str


class GlobalProgressionModel:
    def __init__(
        self,
        state_file="global_bayesian_state.json",
        prior_alpha=2.0,
        prior_beta=2.0,
    ):
        self.state_file = Path(state_file)
        self.prior_alpha = prior_alpha
        self.prior_beta = prior_beta
        self.observations = {}
        self.load()

    def _context_key(self, performance, rep_position):
        return f"{performance}|{rep_position}"

    def _create_context(self):
        return {
            action: []
            for action in ACTIONS
        }

    def load(self):
        if not self.state_file.exists():
            return

        try:
            data = json.loads(self.state_file.read_text())

            if isinstance(data, dict) and "contexts" in data:
                self.observations = data["contexts"]
            else:
                self.observations = {}

        except (OSError, json.JSONDecodeError):
            self.observations = {}

    def save(self):
        data = {
            "contexts": self.observations
        }

        self.state_file.write_text(
            json.dumps(data, indent=2)
        )

    def _ensure_context(self, performance, rep_position):
        key = self._context_key(
            performance,
            rep_position,
        )

        if key not in self.observations:
            self.observations[key] = self._create_context()

        for action in ACTIONS:
            if action not in self.observations[key]:
                self.observations[key][action] = []

        return key

    def infer(
        self,
        performance=None,
        rep_position=None,
    ):
        probabilities = {}

        if performance is None:
            performance = "good"

        if rep_position is None:
            rep_position = "mid_range"

        key = self._ensure_context(
            performance,
            rep_position,
        )

        context = self.observations[key]

        for action in ACTIONS:
            alpha = self.prior_alpha
            beta = self.prior_beta

            for score in context[action]:
                score = float(
                    np.clip(
                        score,
                        0.001,
                        0.999,
                    )
                )

                alpha += score
                beta += 1.0 - score

            probabilities[action] = (
                alpha / (alpha + beta)
            )

        return probabilities

    def get_probabilities(
        self,
        performance=None,
        rep_position=None,
    ):
        return self.infer(
            performance,
            rep_position,
        )

    def update(self, observation):
        if observation.tested_action not in ACTIONS:
            return

        performance = self.performance(observation)
        rep_position = self.rep_position(observation)

        key = self._ensure_context(
            performance,
            rep_position,
        )

        score = self.success_score(observation)

        self.observations[key][
            observation.tested_action
        ].append(score)

        self.save()

    def success_score(self, observation):
        if not observation.actual_sets:
            return 0.0

        completed = [
            s
            for s in observation.actual_sets
            if s.completed
        ]

        if not completed:
            return 0.0

        minimum, maximum = (
            observation.previous_rep_range
        )

        completion = (
            len(completed)
            / len(observation.actual_sets)
        )

        reps = np.mean([
            s.reps
            for s in completed
        ])

        rir = np.mean([
            s.rir
            for s in completed
        ])

        if reps >= maximum:
            rep_score = 1.0
        elif reps >= minimum:
            rep_score = (
                (reps - minimum)
                / max(1, maximum - minimum)
            )
        else:
            rep_score = (
                reps
                / max(1, minimum)
            )

        rir_difference = (
            rir
            - observation.previous_target_rir
        )

        if rir_difference >= 1:
            rir_score = 1.0
        elif rir_difference >= 0:
            rir_score = 0.85
        elif rir_difference >= -1:
            rir_score = 0.55
        elif rir_difference >= -2:
            rir_score = 0.25
        else:
            rir_score = 0.0

        return (
            completion * 0.15
            + rep_score * 0.55
            + rir_score * 0.30
        )

    def performance(self, observation):
        if not observation.actual_sets:
            return "failure"

        completed = [
            s
            for s in observation.actual_sets
            if s.completed
        ]

        if not completed:
            return "failure"

        minimum, maximum = (
            observation.previous_rep_range
        )

        reps = np.mean([
            s.reps
            for s in completed
        ])

        rir = np.mean([
            s.rir
            for s in completed
        ])

        target = observation.previous_target_rir

        completion = (
            len(completed)
            / len(observation.actual_sets)
        )

        if completion < 0.5:
            return "failure"

        if reps >= maximum and rir >= target:
            return "excellent"

        if (
            reps >= minimum
            and rir >= target - 0.5
        ):
            return "good"

        if reps >= minimum:
            return "moderate"

        if reps >= minimum - 1:
            return "poor"

        return "failure"

    def rep_position(self, observation):
        if not observation.actual_sets:
            return "below_range"

        completed = [
            s
            for s in observation.actual_sets
            if s.completed
        ]

        if not completed:
            return "below_range"

        minimum, maximum = (
            observation.previous_rep_range
        )

        reps = np.mean([
            s.reps
            for s in completed
        ])

        if reps < minimum:
            return "below_range"

        if reps >= maximum:
            return "top_of_range"

        return "mid_range"

    def eligible_actions(
        self,
        observation,
        performance,
    ):
        if not observation.actual_sets:
            return [
                "maintain",
                "decrease",
            ]

        completed = [
            s
            for s in observation.actual_sets
            if s.completed
        ]

        if not completed:
            return [
                "maintain",
                "decrease",
            ]

        minimum, maximum = (
            observation.previous_rep_range
        )

        reps = np.mean([
            s.reps
            for s in completed
        ])

        if performance == "excellent":
            return [
                "increase_weight",
                "increase_reps",
                "maintain",
            ]

        if performance == "good":
            if reps >= maximum:
                return [
                    "increase_weight",
                    "increase_reps",
                    "maintain",
                ]

            return [
                "increase_reps",
                "maintain",
            ]

        if performance == "moderate":
            return [
                "increase_reps",
                "maintain",
            ]

        if performance == "poor":
            return [
                "maintain",
                "decrease",
            ]

        return [
            "decrease",
            "maintain",
        ]

    def recommend(self, observation):
        performance = self.performance(
            observation
        )

        rep_position = self.rep_position(
            observation
        )

        score = self.success_score(
            observation
        )

        probabilities = self.infer(
            performance,
            rep_position,
        )

        if not observation.actual_sets:
            return Recommendation(
                "increase_reps",
                probabilities,
                score,
                performance,
                rep_position,
            )

        eligible = self.eligible_actions(
            observation,
            performance,
        )

        decision = max(
            eligible,
            key=lambda action:
                probabilities[action],
        )

        return Recommendation(
            decision,
            probabilities,
            score,
            performance,
            rep_position,
        )

    def reset(self):
        self.observations = {}

        if self.state_file.exists():
            self.state_file.unlink()