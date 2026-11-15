
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable
import copy


ACTIONS = (
    "increase_weight",
    "increase_reps",
    "maintain",
    "decrease",
)

PERFORMANCE_CLASSES = (
    "excellent",
    "good",
    "moderate",
    "poor",
    "failure",
)

REP_POSITIONS = (
    "below_range",
    "mid_range",
    "top_of_range",
)


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
    progression_type: str = "weighted"
    context_performance: str | None = None
    context_rep_position: str | None = None
    magnitude_units: float = 0.0
    outcome_score: float | None = None


@dataclass
class Recommendation:
    decision: str
    probabilities: dict[str, float]
    performance_score: float
    performance_class: str
    rep_position: str
    progression_type: str
    evidence_count: int = 0


class GlobalProgressionModel:

    def __init__(
        self,
        prior_strength: float = 4.0,
        state_data: dict | None = None
    ):
        if prior_strength <= 0:
            raise ValueError("prior_strength must be greater than zero")

        self.prior_strength = float(prior_strength)

        self.action_evidence: dict[str, dict[str, list[float]]] = {}
        self.magnitude_evidence: dict[str, list[float]] = {}

        if state_data:
            self.load_state(state_data)

    @staticmethod
    def _context(
        progression_type: str,
        performance: str,
        rep_position: str
    ) -> str:
        return f"{progression_type}|{performance}|{rep_position}"

    @staticmethod
    def _clamp(
        value: float,
        low: float = 0.0,
        high: float = 1.0
    ) -> float:
        return max(low, min(high, float(value)))

    @staticmethod
    def _valid_sets(
        sets: Iterable[SetResult]
    ) -> list[SetResult]:
        return [
            result
            for result in sets
            if result.completed and result.reps >= 0
        ]

    def performance(
        self,
        actual_sets: list[SetResult],
        rep_range: tuple[int, int],
        target_rir: float
    ) -> tuple[float, str]:

        valid = self._valid_sets(actual_sets)

        if not valid:
            return 0.0, "failure"

        low, high = rep_range

        rep_scores = [
            self._clamp(
                (result.reps - low + 1) /
                max(1, high - low + 2)
            )
            for result in valid
        ]

        rir_scores = [
            self._clamp(
                1.0 - abs(result.rir - target_rir) / 4.0
            )
            for result in valid
        ]

        completion = len(valid) / max(1, len(actual_sets))

        score = self._clamp(
            (sum(rep_scores) / len(rep_scores)) * 0.55
            + (sum(rir_scores) / len(rir_scores)) * 0.30
            + completion * 0.15
        )

        if completion < 0.5 or score < 0.20:
            performance_class = "failure"
        elif score < 0.43:
            performance_class = "poor"
        elif score < 0.64:
            performance_class = "moderate"
        elif score < 0.83:
            performance_class = "good"
        else:
            performance_class = "excellent"

        return score, performance_class

    def rep_position(
        self,
        actual_sets: list[SetResult],
        rep_range: tuple[int, int]
    ) -> str:

        valid = self._valid_sets(actual_sets)

        if not valid:
            return "below_range"

        average_reps = (
            sum(result.reps for result in valid) / len(valid)
        )

        low, high = rep_range

        if average_reps < low:
            return "below_range"

        if average_reps >= high:
            return "top_of_range"

        return "mid_range"

    def eligible_actions(
        self,
        performance: str,
        rep_position: str,
        progression_type: str = "weighted"
    ) -> list[str]:

        if performance in ("failure", "poor"):
            return ["decrease", "maintain"]

        if performance == "moderate":
            return ["maintain", "increase_reps"]

        if rep_position == "top_of_range":
            actions = [
                "increase_weight",
                "increase_reps",
                "maintain"
            ]
        else:
            actions = [
                "increase_reps",
                "maintain"
            ]

        if progression_type == "bodyweight":
            actions = [
                action
                for action in actions
                if action != "increase_weight"
            ]

        return actions

    def _ensure_action_bucket(
        self,
        context: str,
        action: str
    ) -> list[float]:

        self.action_evidence.setdefault(context, {})

        return self.action_evidence[context].setdefault(
            action,
            [0.0, 0.0]
        )

    def _ensure_magnitude_bucket(
        self,
        progression_type: str,
        action: str,
        magnitude_units: float
    ) -> list[float]:

        key = (
            f"{progression_type}|{action}|"
            f"{float(magnitude_units):g}"
        )

        return self.magnitude_evidence.setdefault(
            key,
            [0.0, 0.0]
        )

    def action_posterior(
        self,
        context: str,
        action: str
    ) -> tuple[float, float, int]:

        successes, failures = self._ensure_action_bucket(
            context,
            action
        )

        alpha = self.prior_strength / 2.0 + successes
        beta = self.prior_strength / 2.0 + failures

        evidence_count = int(successes + failures)

        return alpha, beta, evidence_count

    def action_probability(
        self,
        context: str,
        action: str
    ) -> float:

        alpha, beta, _ = self.action_posterior(
            context,
            action
        )

        return alpha / (alpha + beta)

    def magnitude_probability(
        self,
        progression_type: str,
        action: str,
        magnitude_units: float
    ) -> float:

        successes, failures = self._ensure_magnitude_bucket(
            progression_type,
            action,
            magnitude_units
        )

        alpha = self.prior_strength / 2.0 + successes
        beta = self.prior_strength / 2.0 + failures

        return alpha / (alpha + beta)

    def recommend(
        self,
        observation: GlobalObservation
    ) -> Recommendation:

        score, performance_class = self.performance(
            observation.actual_sets,
            observation.previous_rep_range,
            observation.previous_target_rir
        )

        position = self.rep_position(
            observation.actual_sets,
            observation.previous_rep_range
        )

        progression_type = observation.progression_type

        context = self._context(
            progression_type,
            performance_class,
            position
        )

        eligible = self.eligible_actions(
            performance_class,
            position,
            progression_type
        )

        raw_probabilities = {
            action: self.action_probability(context, action)
            for action in eligible
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
            self.action_posterior(context, action)[2]
            for action in eligible
        )

        return Recommendation(
            decision=decision,
            probabilities=probabilities,
            performance_score=score,
            performance_class=performance_class,
            rep_position=position,
            progression_type=progression_type,
            evidence_count=evidence_count
        )

    def action_score(
        self,
        observation: GlobalObservation,
        action: str
    ) -> float:

        recommendation = self.recommend(observation)

        context = self._context(
            recommendation.progression_type,
            recommendation.performance_class,
            recommendation.rep_position
        )

        return self.action_probability(context, action)

    def update(
        self,
        observation: GlobalObservation
    ) -> bool:

        action = observation.tested_action

        if action not in ACTIONS:
            return False

        score = observation.outcome_score

        if score is None:
            score, _ = self.performance(
                observation.actual_sets,
                observation.previous_rep_range,
                observation.previous_target_rir
            )

        score = self._clamp(score)

        performance = observation.context_performance
        position = observation.context_rep_position

        if not performance or not position:
            _, performance = self.performance(
                observation.actual_sets,
                observation.previous_rep_range,
                observation.previous_target_rir
            )

            position = self.rep_position(
                observation.actual_sets,
                observation.previous_rep_range
            )

        context = self._context(
            observation.progression_type,
            performance,
            position
        )

        bucket = self._ensure_action_bucket(
            context,
            action
        )

        bucket[0] += score
        bucket[1] += 1.0 - score

        if (
            observation.magnitude_units > 0
            and action != "maintain"
        ):

            magnitude_bucket = self._ensure_magnitude_bucket(
                observation.progression_type,
                action,
                observation.magnitude_units
            )

            magnitude_bucket[0] += score
            magnitude_bucket[1] += 1.0 - score

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
            )
        }

    def load_state(self, state_data: dict) -> None:

        self.action_evidence = copy.deepcopy(
            state_data.get("action_evidence", {})
        )

        self.magnitude_evidence = copy.deepcopy(
            state_data.get("magnitude_evidence", {})
        )

        self.prior_strength = float(
            state_data.get(
                "prior_strength",
                self.prior_strength
            )
        )
