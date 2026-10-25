from __future__ import annotations

import json
import math
from dataclasses import dataclass, asdict
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


@dataclass
class WorkoutObservation:
    exercise_id: str
    previous_weight: Optional[float]
    previous_reps: Optional[int]
    previous_rep_range: tuple[int, int]
    previous_target_rir: float
    recommended_action: Optional[str]
    actual_sets: list[SetResult]
    weight_increment: float = 5.0


@dataclass
class ProgressionRecommendation:
    exercise_id: str
    decision: str
    confidence: float
    recommended_weight: float
    recommended_rep_range: tuple[int, int]
    probability_of_success: float
    probabilities: dict[str, float]
    reason: str


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


class ProgressionModel:
    def __init__(
        self,
        state_file: str = "bayesian_state.json",
        prior_alpha: float = 2.0,
        prior_beta: float = 2.0,
        weight_increment: float = 5.0,
        minimum_confidence: float = 0.50,
    ):
        self.state_file = Path(state_file)
        self.prior_alpha = prior_alpha
        self.prior_beta = prior_beta
        self.weight_increment = weight_increment
        self.minimum_confidence = minimum_confidence

        self.state: dict[str, dict[str, ActionBelief]] = {}
        self._load_state()

    def _load_state(self) -> None:
        if not self.state_file.exists():
            return

        try:
            raw = self.state_file.read_text(encoding="utf-8").strip()

            if not raw:
                return

            data = json.loads(raw)

            if not isinstance(data, dict):
                return

            for exercise_id, action_data in data.items():
                if not isinstance(action_data, dict):
                    continue

                self.state[exercise_id] = {}

                for action in ACTIONS:
                    values = action_data.get(action, {})

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

                    self.state[exercise_id][action] = ActionBelief(
                        alpha=max(alpha, 0.001),
                        beta=max(beta, 0.001),
                    )

        except (json.JSONDecodeError, OSError, TypeError, ValueError):
            self.state = {}

    def _save_state(self) -> None:
        output = {}

        for exercise_id, actions in self.state.items():
            output[exercise_id] = {}

            for action, belief in actions.items():
                output[exercise_id][action] = {
                    "alpha": belief.alpha,
                    "beta": belief.beta,
                    "success_probability": belief.success_probability,
                    "evidence": belief.evidence,
                }

        self.state_file.parent.mkdir(parents=True, exist_ok=True)

        self.state_file.write_text(
            json.dumps(output, indent=2),
            encoding="utf-8",
        )

    def _ensure_exercise(self, exercise_id: str) -> None:
        if exercise_id in self.state:
            return

        self.state[exercise_id] = {
            action: ActionBelief(
                alpha=self.prior_alpha,
                beta=self.prior_beta,
            )
            for action in ACTIONS
        }

    def _get_probabilities(self, exercise_id: str) -> dict[str, float]:
        self._ensure_exercise(exercise_id)

        return {
            action: self.state[exercise_id][action].success_probability
            for action in ACTIONS
        }

    def _calculate_performance(
        self,
        observation: WorkoutObservation,
    ) -> dict[str, float]:
        if not observation.actual_sets:
            return {
                "average_reps": 0.0,
                "minimum_reps": 0.0,
                "maximum_reps": 0.0,
                "average_rir": 0.0,
                "minimum_rir": 0.0,
                "average_weight": 0.0,
                "weight": 0.0,
            }

        reps = [result.reps for result in observation.actual_sets]
        rirs = [result.rir for result in observation.actual_sets]
        weights = [result.weight for result in observation.actual_sets]

        return {
            "average_reps": sum(reps) / len(reps),
            "minimum_reps": min(reps),
            "maximum_reps": max(reps),
            "average_rir": sum(rirs) / len(rirs),
            "minimum_rir": min(rirs),
            "average_weight": sum(weights) / len(weights),
            "weight": weights[-1],
        }

    def _calculate_success_score(
        self,
        observation: WorkoutObservation,
    ) -> float:
        performance = self._calculate_performance(observation)

        if not observation.actual_sets:
            return 0.0

        minimum_reps, maximum_reps = observation.previous_rep_range
        target_rir = observation.previous_target_rir

        average_reps = performance["average_reps"]
        minimum_performed_reps = performance["minimum_reps"]
        average_rir = performance["average_rir"]
        minimum_rir = performance["minimum_rir"]

        rep_score = 0.0

        if average_reps >= maximum_reps:
            rep_score = 1.0
        elif average_reps >= minimum_reps:
            rep_score = (
                average_reps - minimum_reps
            ) / max(1, maximum_reps - minimum_reps)
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
            rir_score = 0.60
        elif rir_difference >= -2.0:
            rir_score = 0.30
        else:
            rir_score = 0.0

        if minimum_rir <= 0:
            rir_score *= 0.50

        score = (
            rep_score * 0.65
            + rir_score * 0.35
        )

        return max(0.0, min(1.0, score))

    def _classify_outcome(
        self,
        observation: WorkoutObservation,
    ) -> tuple[str, float]:
        score = self._calculate_success_score(observation)

        if score >= 0.85:
            return "strong_success", score

        if score >= 0.65:
            return "success", score

        if score >= 0.45:
            return "partial_success", score

        return "failure", score

    def _action_is_tested(
        self,
        observation: WorkoutObservation,
    ) -> bool:
        action = observation.recommended_action

        if action not in ACTIONS:
            return False

        if observation.previous_weight is None:
            return False

        if not observation.actual_sets:
            return False

        return True

    def _update_belief(
        self,
        exercise_id: str,
        action: str,
        success_score: float,
    ) -> None:
        self._ensure_exercise(exercise_id)

        belief = self.state[exercise_id][action]

        belief.alpha += success_score
        belief.beta += 1.0 - success_score

    def update(
        self,
        observation: WorkoutObservation,
    ) -> Optional[dict]:
        if not self._action_is_tested(observation):
            return None

        action = observation.recommended_action

        outcome, success_score = self._classify_outcome(observation)

        self._update_belief(
            observation.exercise_id,
            action,
            success_score,
        )

        self._save_state()

        return {
            "exercise_id": observation.exercise_id,
            "tested_action": action,
            "outcome": outcome,
            "success_score": round(success_score, 4),
            "posterior_probability": round(
                self.state[
                    observation.exercise_id
                ][action].success_probability,
                4,
            ),
        }

    def _current_performance_signal(
        self,
        observation: WorkoutObservation,
    ) -> dict[str, float]:
        performance = self._calculate_performance(observation)

        if not observation.actual_sets:
            return {
                action: 0.0
                for action in ACTIONS
            }

        minimum_reps, maximum_reps = observation.previous_rep_range
        target_rir = observation.previous_target_rir

        average_reps = performance["average_reps"]
        average_rir = performance["average_rir"]
        minimum_rir = performance["minimum_rir"]

        signals = {
            "increase_weight": 0.0,
            "increase_reps": 0.0,
            "maintain": 0.0,
            "decrease": 0.0,
        }

        reached_top_reps = average_reps >= maximum_reps
        reached_minimum_reps = average_reps >= minimum_reps
        high_rir = average_rir >= target_rir + 1.0
        target_rir_met = average_rir >= target_rir
        low_rir = average_rir < target_rir
        very_low_rir = minimum_rir <= 0

        if reached_top_reps and high_rir:
            signals["increase_weight"] = 1.0
        elif reached_top_reps and target_rir_met:
            signals["increase_weight"] = 0.85
        elif reached_minimum_reps and target_rir_met:
            signals["increase_weight"] = 0.45

        if reached_minimum_reps and not reached_top_reps:
            if target_rir_met:
                signals["increase_reps"] = 1.0
            else:
                signals["increase_reps"] = 0.35

        if reached_minimum_reps and target_rir_met:
            signals["maintain"] = 0.65

        if low_rir:
            signals["maintain"] = max(
                signals["maintain"],
                0.75,
            )

        if very_low_rir:
            signals["decrease"] = 0.85

        if (
            average_reps < minimum_reps
            and average_rir < target_rir
        ):
            signals["decrease"] = 1.0

        return signals

    def _calculate_action_scores(
        self,
        observation: WorkoutObservation,
    ) -> dict[str, float]:
        probabilities = self._get_probabilities(
            observation.exercise_id
        )

        signals = self._current_performance_signal(
            observation
        )

        scores = {}

        for action in ACTIONS:
            posterior = probabilities[action]
            signal = signals[action]

            scores[action] = (
                posterior * 0.60
                + signal * 0.40
            )

        return scores

    def _build_reason(
        self,
        observation: WorkoutObservation,
        decision: str,
        confidence: float,
    ) -> str:
        performance = self._calculate_performance(
            observation
        )

        average_reps = performance["average_reps"]
        average_rir = performance["average_rir"]

        minimum_reps, maximum_reps = (
            observation.previous_rep_range
        )

        if decision == "increase_weight":
            if average_reps >= maximum_reps:
                return (
                    f"The target rep ceiling was reached with "
                    f"an average RIR of {average_rir:.1f}. "
                    f"The Bayesian model supports testing a "
                    f"weight increase."
                )

            return (
                "Current performance provides some evidence "
                "for increasing weight, but the evidence is "
                "not as strong as reaching the top of the "
                "rep range."
            )

        if decision == "increase_reps":
            return (
                f"The average of {average_reps:.1f} reps is "
                f"within the {minimum_reps}-{maximum_reps} "
                f"range. Increasing reps before weight is "
                "the more appropriate progression step."
            )

        if decision == "maintain":
            if average_rir < observation.previous_target_rir:
                return (
                    f"Performance is below the target RIR "
                    f"with an average of {average_rir:.1f}. "
                    "Maintaining the current prescription "
                    "allows performance to stabilize before "
                    "another progression."
                )

            return (
                "The Bayesian evidence does not strongly "
                "support a progression change yet, so the "
                "current prescription should be maintained."
            )

        return (
            f"Performance averaged {average_reps:.1f} reps "
            f"with an average RIR of {average_rir:.1f}. "
            "The current prescription appears too demanding, "
            "so reducing the load is the safer progression."
        )

    def recommend(
        self,
        observation: WorkoutObservation,
    ) -> ProgressionRecommendation:
        self._ensure_exercise(observation.exercise_id)

        probabilities = self._get_probabilities(
            observation.exercise_id
        )

        scores = self._calculate_action_scores(
            observation
        )

        decision = max(
            scores,
            key=scores.get,
        )

        total_score = sum(scores.values())

        if total_score > 0:
            confidence = scores[decision] / total_score
        else:
            confidence = 0.0

        if confidence < self.minimum_confidence:
            maintain_score = scores["maintain"]

            if maintain_score >= scores[decision] * 0.90:
                decision = "maintain"
                confidence = (
                    scores["maintain"] / total_score
                    if total_score > 0
                    else 0.0
                )

        current_weight = (
            observation.actual_sets[-1].weight
            if observation.actual_sets
            else observation.previous_weight
        )

        if current_weight is None:
            current_weight = 0.0

        minimum_reps, maximum_reps = (
            observation.previous_rep_range
        )

        recommended_weight = current_weight

        recommended_rep_range = (
            minimum_reps,
            maximum_reps,
        )

        if decision == "increase_weight":
            recommended_weight = (
                current_weight
                + observation.weight_increment
            )

        elif decision == "increase_reps":
            recommended_rep_range = (
                minimum_reps + 1,
                maximum_reps + 1,
            )

        elif decision == "decrease":
            recommended_weight = max(
                0.0,
                current_weight
                - observation.weight_increment,
            )

        reason = self._build_reason(
            observation,
            decision,
            confidence,
        )

        return ProgressionRecommendation(
            exercise_id=observation.exercise_id,
            decision=decision,
            confidence=confidence,
            recommended_weight=recommended_weight,
            recommended_rep_range=recommended_rep_range,
            probability_of_success=probabilities[
                decision
            ],
            probabilities=probabilities,
            reason=reason,
        )

    def get_state(
        self,
        exercise_id: str,
    ) -> dict:
        self._ensure_exercise(exercise_id)

        output = {}

        for action, belief in self.state[
            exercise_id
        ].items():
            output[action] = {
                "alpha": belief.alpha,
                "beta": belief.beta,
                "success_probability": belief.success_probability,
                "evidence": belief.evidence,
            }

        return output

    def reset_exercise(
        self,
        exercise_id: str,
    ) -> None:
        self.state[exercise_id] = {
            action: ActionBelief(
                alpha=self.prior_alpha,
                beta=self.prior_beta,
            )
            for action in ACTIONS
        }

        self._save_state()

    def reset_all(self) -> None:
        self.state = {}

        if self.state_file.exists():
            self.state_file.unlink()

    def export_state(self) -> dict:
        output = {}

        for exercise_id in self.state:
            output[exercise_id] = self.get_state(
                exercise_id
            )

        return output


def create_observation(
    exercise_id: str,
    previous_weight: Optional[float],
    previous_rep_range: tuple[int, int],
    previous_target_rir: float,
    recommended_action: Optional[str],
    actual_sets: list[SetResult],
    weight_increment: float = 5.0,
) -> WorkoutObservation:
    previous_reps = None

    if actual_sets:
        previous_reps = actual_sets[0].reps

    return WorkoutObservation(
        exercise_id=exercise_id,
        previous_weight=previous_weight,
        previous_reps=previous_reps,
        previous_rep_range=previous_rep_range,
        previous_target_rir=previous_target_rir,
        recommended_action=recommended_action,
        actual_sets=actual_sets,
        weight_increment=weight_increment,
    )


if __name__ == "__main__":
    model = ProgressionModel(
        state_file="bayesian_state.json"
    )

    observation = create_observation(
        exercise_id="bench_press",
        previous_weight=185,
        previous_rep_range=(8, 10),
        previous_target_rir=2,
        recommended_action=None,
        actual_sets=[
            SetResult(185, 10, 3),
            SetResult(185, 10, 2),
            SetResult(185, 10, 2),
        ],
    )

    recommendation = model.recommend(
        observation
    )

    print("Progression Recommendation")
    print(
        f"Exercise: {recommendation.exercise_id}"
    )
    print(
        f"Decision: {recommendation.decision}"
    )
    print(
        f"Confidence: {recommendation.confidence:.3f}"
    )
    print(
        f"Recommended Weight: "
        f"{recommendation.recommended_weight:g}"
    )
    print(
        f"Recommended Rep Range: "
        f"{recommendation.recommended_rep_range[0]}-"
        f"{recommendation.recommended_rep_range[1]}"
    )
    print(
        f"Probability of Success: "
        f"{recommendation.probability_of_success:.3f}"
    )
    print(
        f"Reason: {recommendation.reason}"
    )

    print()
    print("Bayesian Success Probabilities")

    for action, probability in (
        recommendation.probabilities.items()
    ):
        print(
            f"  {action}: "
            f"{probability:.3f}"
        )

    update_result = model.update(
        observation
    )

    if update_result is None:
        print()
        print(
            "No Bayesian update performed because "
            "this workout did not test a previous "
            "progression decision."
        )