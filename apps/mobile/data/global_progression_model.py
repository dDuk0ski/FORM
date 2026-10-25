from __future__ import annotations

import json
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


ACTIONS = [
    "increase_weight",
    "increase_reps",
    "maintain",
    "decrease",
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
    tested_action: Optional[str] = None
    exercise_number: Optional[int] = None


@dataclass
class ActionBelief:
    alpha: float = 2.0
    beta: float = 2.0

    @property
    def success_probability(self) -> float:
        return self.alpha / (self.alpha + self.beta)

    @property
    def evidence(self) -> float:
        return self.alpha + self.beta


@dataclass
class GlobalRecommendation:
    decision: str
    confidence: float
    probability_of_success: float
    probabilities: dict[str, float]
    performance_score: float
    performance_class: str
    eligible_actions: list[str]
    reason: str


class GlobalProgressionModel:
    def __init__(
        self,
        state_file: str | Path = "global_bayesian_state.json",
        prior_alpha: float = 2.0,
        prior_beta: float = 2.0,
        minimum_confidence: float = 0.50,
        exploration_evidence: float = 6.0,
        exploration_rate: float = 0.15,
        random_seed: int = 42,
    ):
        self.state_file = Path(state_file)
        self.prior_alpha = prior_alpha
        self.prior_beta = prior_beta
        self.minimum_confidence = minimum_confidence
        self.exploration_evidence = exploration_evidence
        self.exploration_rate = exploration_rate
        self.rng = random.Random(random_seed)

        self.state: dict[str, ActionBelief] = {
            action: ActionBelief(
                alpha=self.prior_alpha,
                beta=self.prior_beta,
            )
            for action in ACTIONS
        }

        self.load_state()

    def load_state(self) -> None:
        if not self.state_file.exists():
            return

        try:
            data = json.loads(
                self.state_file.read_text(encoding="utf-8")
            )

            if not isinstance(data, dict):
                return

            state_data = data.get("actions", data)

            for action in ACTIONS:
                values = state_data.get(action, {})

                if not isinstance(values, dict):
                    continue

                alpha = float(
                    values.get(
                        "alpha",
                        self.prior_alpha,
                    )
                )

                beta = float(
                    values.get(
                        "beta",
                        self.prior_beta,
                    )
                )

                self.state[action] = ActionBelief(
                    alpha=max(alpha, 0.001),
                    beta=max(beta, 0.001),
                )

        except (
            json.JSONDecodeError,
            OSError,
            TypeError,
            ValueError,
        ):
            self.reset()

    def save_state(self) -> None:
        output = {
            "actions": {
                action: {
                    "alpha": belief.alpha,
                    "beta": belief.beta,
                    "success_probability": belief.success_probability,
                    "evidence": belief.evidence,
                }
                for action, belief in self.state.items()
            }
        }

        self.state_file.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        self.state_file.write_text(
            json.dumps(output, indent=2),
            encoding="utf-8",
        )

    def reset(self) -> None:
        self.state = {
            action: ActionBelief(
                alpha=self.prior_alpha,
                beta=self.prior_beta,
            )
            for action in ACTIONS
        }

        if self.state_file.exists():
            self.state_file.unlink()

    def get_state(self) -> dict[str, dict[str, float]]:
        return {
            action: {
                "alpha": belief.alpha,
                "beta": belief.beta,
                "probability": belief.success_probability,
                "evidence": belief.evidence,
            }
            for action, belief in self.state.items()
        }

    def get_context(self) -> dict[str, dict[str, float]]:
        return {
            action: {
                "probability": belief.success_probability,
                "evidence": belief.evidence,
                "alpha": belief.alpha,
                "beta": belief.beta,
            }
            for action, belief in self.state.items()
        }

    def get_probabilities(self) -> dict[str, float]:
        return {
            action: self.state[action].success_probability
            for action in ACTIONS
        }

    def calculate_success_score(
        self,
        observation: GlobalObservation,
    ) -> float:
        if not observation.actual_sets:
            return 0.0

        minimum_reps, maximum_reps = observation.previous_rep_range
        target_rir = observation.previous_target_rir

        completed_sets = [
            result
            for result in observation.actual_sets
            if result.completed
        ]

        if not completed_sets:
            return 0.0

        completion_rate = (
            len(completed_sets)
            / len(observation.actual_sets)
        )

        average_reps = sum(
            result.reps
            for result in completed_sets
        ) / len(completed_sets)

        average_rir = sum(
            result.rir
            for result in completed_sets
        ) / len(completed_sets)

        if average_reps >= maximum_reps:
            rep_score = 1.0
        elif average_reps >= minimum_reps:
            rep_score = (
                average_reps - minimum_reps
            ) / max(
                1.0,
                maximum_reps - minimum_reps,
            )
        else:
            rep_score = max(
                0.0,
                average_reps / max(1, minimum_reps),
            )

        rir_difference = average_rir - target_rir

        if rir_difference >= 1.0:
            rir_score = 1.0
        elif rir_difference >= 0.0:
            rir_score = 0.85
        elif rir_difference >= -1.0:
            rir_score = 0.55
        elif rir_difference >= -2.0:
            rir_score = 0.25
        else:
            rir_score = 0.0

        score = (
            completion_rate * 0.15
            + rep_score * 0.55
            + rir_score * 0.30
        )

        return max(
            0.0,
            min(1.0, score),
        )

    def classify_performance(
        self,
        observation: GlobalObservation,
    ) -> tuple[str, float]:
        score = self.calculate_success_score(observation)

        if not observation.actual_sets:
            return "failure", score

        minimum_reps, maximum_reps = observation.previous_rep_range

        completed_sets = [
            result
            for result in observation.actual_sets
            if result.completed
        ]

        if not completed_sets:
            return "failure", score

        average_reps = sum(
            result.reps
            for result in completed_sets
        ) / len(completed_sets)

        average_rir = sum(
            result.rir
            for result in completed_sets
        ) / len(completed_sets)

        if (
            average_reps >= maximum_reps
            and average_rir >= observation.previous_target_rir
        ):
            return "excellent", score

        if (
            average_reps >= minimum_reps
            and average_rir >= observation.previous_target_rir - 0.5
        ):
            return "good", score

        if average_reps >= minimum_reps:
            return "moderate", score

        if average_reps >= minimum_reps - 1:
            return "poor", score

        return "failure", score

    def update(
        self,
        observation: GlobalObservation,
    ) -> Optional[dict]:
        action = observation.tested_action

        if action not in ACTIONS:
            return None

        if not observation.actual_sets:
            return None

        success_score = self.calculate_success_score(
            observation
        )

        belief = self.state[action]

        belief.alpha += success_score
        belief.beta += 1.0 - success_score

        performance_class, _ = self.classify_performance(
            observation
        )

        self.save_state()

        return {
            "tested_action": action,
            "performance_class": performance_class,
            "success_score": round(
                success_score,
                4,
            ),
            "posterior_probability": round(
                belief.success_probability,
                4,
            ),
            "evidence": round(
                belief.evidence,
                4,
            ),
        }

    def get_eligible_actions(
        self,
        performance_class: str,
        average_reps: float,
        rep_range: tuple[int, int],
        average_rir: float,
        target_rir: float,
    ) -> list[str]:
        minimum_reps, maximum_reps = rep_range

        if performance_class == "excellent":
            return [
                "increase_weight",
                "increase_reps",
                "maintain",
            ]

        if performance_class == "good":
            if average_reps >= maximum_reps:
                return [
                    "increase_weight",
                    "increase_reps",
                    "maintain",
                ]

            return [
                "increase_reps",
                "maintain",
            ]

        if performance_class == "moderate":
            return [
                "increase_reps",
                "maintain",
            ]

        if performance_class == "poor":
            return [
                "maintain",
                "decrease",
            ]

        return [
            "decrease",
            "maintain",
        ]

    def _exploration_action(
        self,
        eligible_actions: list[str],
    ) -> Optional[str]:
        if not eligible_actions:
            return None

        low_evidence = sorted(
            eligible_actions,
            key=lambda action: self.state[action].evidence,
        )

        least_tested = low_evidence[0]

        if (
            self.state[least_tested].evidence
            < self.exploration_evidence
        ):
            return least_tested

        if self.rng.random() < self.exploration_rate:
            return self.rng.choice(
                eligible_actions
            )

        return None

    def recommend(
        self,
        observation: GlobalObservation,
    ) -> GlobalRecommendation:
        performance_class, performance_score = (
            self.classify_performance(
                observation
            )
        )

        if not observation.actual_sets:
            eligible_actions = [
                "increase_reps",
                "maintain",
            ]

            return GlobalRecommendation(
                decision="increase_reps",
                confidence=0.25,
                probability_of_success=self.state[
                    "increase_reps"
                ].success_probability,
                probabilities=self.get_probabilities(),
                performance_score=0.0,
                performance_class="unknown",
                eligible_actions=eligible_actions,
                reason="No previous performance is available, so the model starts with a conservative rep progression.",
            )

        completed_sets = [
            result
            for result in observation.actual_sets
            if result.completed
        ]

        average_reps = sum(
            result.reps
            for result in completed_sets
        ) / len(completed_sets)

        average_rir = sum(
            result.rir
            for result in completed_sets
        ) / len(completed_sets)

        eligible_actions = self.get_eligible_actions(
            performance_class,
            average_reps,
            observation.previous_rep_range,
            average_rir,
            observation.previous_target_rir,
        )

        probabilities = self.get_probabilities()

        exploration_action = self._exploration_action(
            eligible_actions
        )

        if exploration_action is not None:
            decision = exploration_action
            confidence = probabilities[decision]
            reason = (
                f"Performance was classified as {performance_class}. "
                f"The model is exploring {decision} because that action "
                f"has limited evidence."
            )
        else:
            scores = {
                action: probabilities[action]
                for action in eligible_actions
            }

            decision = max(
                scores,
                key=scores.get,
            )

            total = sum(scores.values())

            confidence = (
                scores[decision] / total
                if total > 0
                else 0.0
            )

            if performance_class == "excellent":
                reason = (
                    "The athlete reached the top of the rep range "
                    "while maintaining the target RIR, so progression "
                    "is appropriate."
                )
            elif performance_class == "good":
                reason = (
                    "The athlete completed the target range without "
                    "clear evidence that another weight increase is "
                    "necessary, so the model favors gradual progression."
                )
            elif performance_class == "moderate":
                reason = (
                    "The athlete is completing the lower portion of "
                    "the target range, so rep progression is preferred "
                    "before adding load."
                )
            elif performance_class == "poor":
                reason = (
                    "Performance is below the desired target, so the "
                    "model avoids increasing demand and considers "
                    "maintaining or reducing the prescription."
                )
            else:
                reason = (
                    "Performance is below the target range, so the "
                    "model favors reducing the demand."
                )

        return GlobalRecommendation(
            decision=decision,
            confidence=confidence,
            probability_of_success=probabilities[decision],
            probabilities=probabilities,
            performance_score=performance_score,
            performance_class=performance_class,
            eligible_actions=eligible_actions,
            reason=reason,
        )

    def get_confidence(
        self,
        action: str,
    ) -> float:
        if action not in ACTIONS:
            return 0.0

        probabilities = self.get_probabilities()
        values = [
            probabilities[item]
            for item in ACTIONS
        ]

        total = sum(values)

        if total <= 0:
            return 0.0

        return probabilities[action] / total

    def create_observation(
        self,
        actual_sets: list[SetResult],
        previous_rep_range: tuple[int, int],
        previous_target_rir: float,
        tested_action: Optional[str],
        exercise_number: Optional[int] = None,
    ) -> GlobalObservation:
        return GlobalObservation(
            actual_sets=actual_sets,
            previous_rep_range=previous_rep_range,
            previous_target_rir=previous_target_rir,
            tested_action=tested_action,
            exercise_number=exercise_number,
        )

    def export_state(self) -> dict:
        return {
            "actions": self.get_state()
        }


if __name__ == "__main__":
    model = GlobalProgressionModel(
        state_file="global_bayesian_state.json"
    )

    observation = GlobalObservation(
        actual_sets=[
            SetResult(185, 10, 3),
            SetResult(185, 10, 2),
            SetResult(185, 10, 2),
        ],
        previous_rep_range=(8, 10),
        previous_target_rir=2,
        tested_action="increase_weight",
    )

    print(
        model.recommend(
            observation
        )
    )
