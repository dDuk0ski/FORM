
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable
import copy

from fast_global_progression_model import (
    ACTIONS,
    GlobalProgressionModel
)


@dataclass
class LocalRecommendation:
    decision: str
    weight_delta: float
    rep_delta: int
    magnitude_units: float
    probabilities: dict[str, float]
    magnitude_probabilities: dict[str, float]
    confidence: float
    evidence_count: int
    performance_class: str
    rep_position: str
    progression_type: str


class LocalProgressionModel:

    def __init__(
        self,
        global_model: GlobalProgressionModel,
        prior_strength: float = 6.0,
        state_data: dict | None = None
    ):

        if prior_strength <= 0:
            raise ValueError(
                "prior_strength must be greater than zero"
            )

        self.global_model = global_model
        self.prior_strength = float(prior_strength)

        self.action_evidence: dict[
            str,
            dict[str, dict[str, list[float]]]
        ] = {}

        self.magnitude_evidence: dict[
            str,
            dict[str, list[float]]
        ] = {}

        self.exercise_baselines: dict[str, dict] = {}

        if state_data:
            self.load_state(state_data)

    @staticmethod
    def _context(
        progression_type: str,
        performance: str,
        rep_position: str
    ) -> str:

        return (
            f"{progression_type}|{performance}|"
            f"{rep_position}"
        )

    @staticmethod
    def _clamp(value: float) -> float:
        return max(0.0, min(1.0, float(value)))

    def initialize_exercise(
        self,
        exercise: str,
        starting_weight: float,
        rep_range: tuple[int, int],
        sets: int = 3,
        target_rir: float = 2.0,
        progression_type: str = "weighted",
        weight_increment: float = 2.5,
        rep_increment: int = 1
    ) -> dict:

        if not exercise:
            raise ValueError(
                "exercise must not be empty"
            )

        if (
            rep_range[0] < 1
            or rep_range[1] < rep_range[0]
        ):
            raise ValueError(
                "rep_range must be a valid positive range"
            )

        baseline = {
            "starting_weight": float(starting_weight),
            "current_weight": float(starting_weight),
            "rep_range": [
                int(rep_range[0]),
                int(rep_range[1])
            ],
            "sets": int(sets),
            "target_rir": float(target_rir),
            "progression_type": progression_type,
            "weight_increment": float(weight_increment),
            "rep_increment": int(rep_increment),
            "observations": 0
        }

        self.exercise_baselines[exercise] = baseline

        return copy.deepcopy(baseline)

    def get_exercise_baseline(
        self,
        exercise: str
    ) -> dict | None:

        value = self.exercise_baselines.get(exercise)

        return copy.deepcopy(value) if value else None

    def _local_action_bucket(
        self,
        exercise: str,
        context: str,
        action: str
    ) -> list[float]:

        self.action_evidence.setdefault(
            exercise,
            {}
        ).setdefault(context, {})

        return self.action_evidence[
            exercise
        ][context].setdefault(
            action,
            [0.0, 0.0]
        )

    def _local_magnitude_bucket(
        self,
        exercise: str,
        key: str
    ) -> list[float]:

        self.magnitude_evidence.setdefault(
            exercise,
            {}
        )

        return self.magnitude_evidence[
            exercise
        ].setdefault(
            key,
            [0.0, 0.0]
        )

    def _action_probability(
        self,
        exercise: str,
        context: str,
        action: str
    ) -> tuple[float, int]:

        global_probability = (
            self.global_model.action_probability(
                context,
                action
            )
        )

        prior_alpha = max(
            0.05,
            global_probability * self.prior_strength
        )

        prior_beta = max(
            0.05,
            (1.0 - global_probability) * self.prior_strength
        )

        successes, failures = self._local_action_bucket(
            exercise,
            context,
            action
        )

        alpha = prior_alpha + successes
        beta = prior_beta + failures

        return (
            alpha / (alpha + beta),
            int(successes + failures)
        )

    def _magnitude_probability(
        self,
        exercise: str,
        progression_type: str,
        action: str,
        units: float
    ) -> tuple[float, int]:

        key = (
            f"{progression_type}|{action}|{float(units):g}"
        )

        global_probability = (
            self.global_model.magnitude_probability(
                progression_type,
                action,
                units
            )
        )

        prior_alpha = max(
            0.05,
            global_probability * self.prior_strength
        )

        prior_beta = max(
            0.05,
            (1.0 - global_probability) * self.prior_strength
        )

        successes, failures = self._local_magnitude_bucket(
            exercise,
            key
        )

        alpha = prior_alpha + successes
        beta = prior_beta + failures

        return (
            alpha / (alpha + beta),
            int(successes + failures)
        )

    def recommend(
        self,
        exercise: str,
        performance: str,
        rep_position: str,
        progression_type: str = "weighted",
        current_weight: float | None = None,
        weight_increment: float | None = None,
        rep_increment: int | None = None,
        weight_magnitude_candidates: Iterable[float] = (1.0, 2.0),
        rep_magnitude_candidates: Iterable[float] = (1.0, 2.0)
    ) -> LocalRecommendation:

        baseline = self.exercise_baselines.get(
            exercise,
            {}
        )

        weight_increment = float(
            weight_increment
            if weight_increment is not None
            else baseline.get("weight_increment", 2.5)
        )

        rep_increment = int(
            rep_increment
            if rep_increment is not None
            else baseline.get("rep_increment", 1)
        )

        current_weight = float(
            current_weight
            if current_weight is not None
            else baseline.get("current_weight", 0.0)
        )

        context = self._context(
            progression_type,
            performance,
            rep_position
        )

        eligible = self.global_model.eligible_actions(
            performance,
            rep_position,
            progression_type
        )

        action_data = {
            action: self._action_probability(
                exercise,
                context,
                action
            )
            for action in eligible
        }

        raw_probabilities = {
            action: values[0]
            for action, values in action_data.items()
        }

        total = sum(raw_probabilities.values()) or 1.0

        probabilities = {
            action: probability / total
            for action, probability in raw_probabilities.items()
        }

        decision = max(
            probabilities,
            key=probabilities.get
        )

        evidence_count = sum(
            values[1]
            for values in action_data.values()
        )

        magnitude_probabilities = {}

        magnitude_units = 0.0
        weight_delta = 0.0
        rep_delta = 0

        if decision == "increase_weight":

            candidates = sorted({
                max(1.0, float(value))
                for value in weight_magnitude_candidates
            })

            if progression_type == "bodyweight":
                decision = "increase_reps"

            else:
                for candidate in candidates:

                    probability, count = (
                        self._magnitude_probability(
                            exercise,
                            progression_type,
                            decision,
                            candidate
                        )
                    )

                    magnitude_probabilities[
                        f"{candidate:g}"
                    ] = probability

                    evidence_count += count

                magnitude_units = max(
                    candidates,
                    key=lambda value:
                    magnitude_probabilities[f"{value:g}"]
                )

                weight_delta = round(
                    weight_increment * magnitude_units,
                    4
                )

        if decision == "increase_reps":

            candidates = sorted({
                max(1, int(value))
                for value in rep_magnitude_candidates
            })

            for candidate in candidates:

                probability, count = (
                    self._magnitude_probability(
                        exercise,
                        progression_type,
                        decision,
                        candidate
                    )
                )

                magnitude_probabilities[
                    f"{candidate:g}"
                ] = probability

                evidence_count += count

            magnitude_units = float(
                max(
                    candidates,
                    key=lambda value:
                    magnitude_probabilities[f"{value:g}"]
                )
            )

            rep_delta = int(
                rep_increment * magnitude_units
            )

        elif decision == "decrease":

            magnitude_units = 1.0

            if progression_type == "weighted":
                weight_delta = -weight_increment

            elif progression_type == "assisted":
                weight_delta = weight_increment

            else:
                rep_delta = -rep_increment

        confidence = probabilities[decision]

        return LocalRecommendation(
            decision=decision,
            weight_delta=weight_delta,
            rep_delta=rep_delta,
            magnitude_units=magnitude_units,
            probabilities=probabilities,
            magnitude_probabilities=magnitude_probabilities,
            confidence=confidence,
            evidence_count=evidence_count,
            performance_class=performance,
            rep_position=rep_position,
            progression_type=progression_type
        )

    def update(
        self,
        exercise: str,
        action: str,
        score: float,
        performance: str,
        rep_position: str,
        progression_type: str = "weighted",
        magnitude_units: float = 0.0
    ) -> bool:

        if action not in ACTIONS:
            return False

        score = self._clamp(score)

        context = self._context(
            progression_type,
            performance,
            rep_position
        )

        bucket = self._local_action_bucket(
            exercise,
            context,
            action
        )

        bucket[0] += score
        bucket[1] += 1.0 - score

        if (
            magnitude_units > 0
            and action != "maintain"
        ):

            key = (
                f"{progression_type}|{action}|"
                f"{float(magnitude_units):g}"
            )

            magnitude_bucket = (
                self._local_magnitude_bucket(
                    exercise,
                    key
                )
            )

            magnitude_bucket[0] += score
            magnitude_bucket[1] += 1.0 - score

        if exercise in self.exercise_baselines:

            self.exercise_baselines[
                exercise
            ]["observations"] += 1

        return True

    def export_state(self) -> dict:

        return {
            "version": 2,
            "prior_strength": self.prior_strength,
            "action_evidence": copy.deepcopy(
                self.action_evidence
            ),
            "magnitude_evidence": copy.deepcopy(
                self.magnitude_evidence
            ),
            "exercise_baselines": copy.deepcopy(
                self.exercise_baselines
            )
        }

    def load_state(self, state_data: dict) -> None:

        self.action_evidence = copy.deepcopy(
            state_data.get("action_evidence", {})
        )

        self.magnitude_evidence = copy.deepcopy(
            state_data.get("magnitude_evidence", {})
        )

        self.exercise_baselines = copy.deepcopy(
            state_data.get("exercise_baselines", {})
        )

        self.prior_strength = float(
            state_data.get(
                "prior_strength",
                self.prior_strength
            )
        )
