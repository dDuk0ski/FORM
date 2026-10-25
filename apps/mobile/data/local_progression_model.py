from __future__ import annotations

import json
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from global_progression_model import (
    ACTIONS,
    ActionBelief,
    GlobalObservation,
    GlobalProgressionModel,
    SetResult,
)


@dataclass
class LocalObservation:
    exercise_id: str
    exercise_number: int
    actual_sets: list[SetResult]
    previous_rep_range: tuple[int, int]
    previous_target_rir: float
    tested_action: Optional[str] = None


@dataclass
class LocalRecommendation:
    exercise_id: str
    exercise_number: int
    decision: str
    confidence: float
    probability_of_success: float
    local_probability: float
    global_probability: float
    probabilities: dict[str, float]
    performance_score: float
    performance_class: str
    eligible_actions: list[str]
    reason: str


class LocalProgressionModel:
    def __init__(
        self,
        global_model: GlobalProgressionModel,
        state_file: str | Path = "local_bayesian_state.json",
        prior_alpha: float = 2.0,
        prior_beta: float = 2.0,
        global_influence_evidence: float = 10.0,
        exploration_evidence: float = 6.0,
        exploration_rate: float = 0.10,
        random_seed: int = 43,
    ):
        self.global_model = global_model
        self.state_file = Path(state_file)

        self.prior_alpha = prior_alpha
        self.prior_beta = prior_beta
        self.global_influence_evidence = global_influence_evidence
        self.exploration_evidence = exploration_evidence
        self.exploration_rate = exploration_rate

        self.rng = random.Random(random_seed)

        self.state: dict[
            str,
            dict[str, ActionBelief]
        ] = {}

        self.load_state()

    def load_state(self) -> None:
        if not self.state_file.exists():
            return

        try:
            data = json.loads(
                self.state_file.read_text(
                    encoding="utf-8"
                )
            )

            if not isinstance(data, dict):
                return

            for exercise_id, action_data in data.items():
                if not isinstance(action_data, dict):
                    continue

                self.ensure_exercise(
                    str(exercise_id)
                )

                for action in ACTIONS:
                    values = action_data.get(
                        action,
                        {}
                    )

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

                    self.state[
                        str(exercise_id)
                    ][action] = ActionBelief(
                        alpha=max(
                            alpha,
                            0.001
                        ),
                        beta=max(
                            beta,
                            0.001
                        ),
                    )

        except (
            json.JSONDecodeError,
            OSError,
            TypeError,
            ValueError,
        ):
            self.state = {}

    def save_state(self) -> None:
        output = {}

        for exercise_id, actions in self.state.items():
            output[exercise_id] = {}

            for action, belief in actions.items():
                output[exercise_id][action] = {
                    "alpha": belief.alpha,
                    "beta": belief.beta,
                    "probability": belief.success_probability,
                    "evidence": belief.evidence,
                }

        self.state_file.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        self.state_file.write_text(
            json.dumps(
                output,
                indent=2,
            ),
            encoding="utf-8",
        )

    def reset(self) -> None:
        self.state = {}

        if self.state_file.exists():
            self.state_file.unlink()

    def ensure_exercise(
        self,
        exercise_id: str,
    ) -> None:
        if exercise_id in self.state:
            return

        self.state[exercise_id] = {
            action: ActionBelief(
                alpha=self.prior_alpha,
                beta=self.prior_beta,
            )
            for action in ACTIONS
        }

    def get_exercise_state(
        self,
        exercise_id: str,
    ) -> dict[str, dict[str, float]]:
        self.ensure_exercise(
            exercise_id
        )

        return {
            action: {
                "alpha": belief.alpha,
                "beta": belief.beta,
                "probability": belief.success_probability,
                "evidence": belief.evidence,
            }
            for action, belief
            in self.state[exercise_id].items()
        }

    def get_local_probability(
        self,
        exercise_id: str,
        action: str,
    ) -> float:
        self.ensure_exercise(
            exercise_id
        )

        return self.state[
            exercise_id
        ][action].success_probability

    def get_local_evidence(
        self,
        exercise_id: str,
        action: str,
    ) -> float:
        self.ensure_exercise(
            exercise_id
        )

        return self.state[
            exercise_id
        ][action].evidence

    def combine_probability(
        self,
        exercise_id: str,
        action: str,
        global_probability: float,
    ) -> float:
        local_probability = self.get_local_probability(
            exercise_id,
            action,
        )

        local_evidence = self.get_local_evidence(
            exercise_id,
            action,
        )

        local_weight = (
            local_evidence
            / (
                local_evidence
                + self.global_influence_evidence
            )
        )

        global_weight = 1.0 - local_weight

        return (
            local_probability * local_weight
            + global_probability * global_weight
        )

    def get_combined_probabilities(
        self,
        exercise_id: str,
    ) -> dict[str, float]:
        self.ensure_exercise(
            exercise_id
        )

        global_probabilities = (
            self.global_model.get_probabilities()
        )

        return {
            action: self.combine_probability(
                exercise_id,
                action,
                global_probabilities[action],
            )
            for action in ACTIONS
        }

    def calculate_success_score(
        self,
        observation: LocalObservation,
    ) -> float:
        global_observation = GlobalObservation(
            actual_sets=observation.actual_sets,
            previous_rep_range=observation.previous_rep_range,
            previous_target_rir=observation.previous_target_rir,
            tested_action=observation.tested_action,
            exercise_number=observation.exercise_number,
        )

        return self.global_model.calculate_success_score(
            global_observation
        )

    def classify_performance(
        self,
        observation: LocalObservation,
    ) -> tuple[str, float]:
        global_observation = GlobalObservation(
            actual_sets=observation.actual_sets,
            previous_rep_range=observation.previous_rep_range,
            previous_target_rir=observation.previous_target_rir,
            tested_action=observation.tested_action,
            exercise_number=observation.exercise_number,
        )

        return self.global_model.classify_performance(
            global_observation
        )

    def update(
        self,
        observation: LocalObservation,
    ) -> Optional[dict]:
        action = observation.tested_action

        if action not in ACTIONS:
            return None

        if not observation.actual_sets:
            return None

        self.ensure_exercise(
            observation.exercise_id
        )

        success_score = self.calculate_success_score(
            observation
        )

        belief = self.state[
            observation.exercise_id
        ][action]

        belief.alpha += success_score
        belief.beta += 1.0 - success_score

        performance_class, _ = (
            self.classify_performance(
                observation
            )
        )

        self.save_state()

        return {
            "exercise_id": observation.exercise_id,
            "exercise_number": observation.exercise_number,
            "tested_action": action,
            "performance_class": performance_class,
            "success_score": round(
                success_score,
                4,
            ),
            "local_probability": round(
                belief.success_probability,
                4,
            ),
            "local_evidence": round(
                belief.evidence,
                4,
            ),
        }

    def _exploration_action(
        self,
        exercise_id: str,
        eligible_actions: list[str],
    ) -> Optional[str]:
        if not eligible_actions:
            return None

        ordered = sorted(
            eligible_actions,
            key=lambda action:
                self.get_local_evidence(
                    exercise_id,
                    action,
                ),
        )

        least_tested = ordered[0]

        if (
            self.get_local_evidence(
                exercise_id,
                least_tested,
            )
            < self.exploration_evidence
        ):
            return least_tested

        if self.rng.random() < self.exploration_rate:
            return self.rng.choice(
                eligible_actions
            )

        return None

    def build_reason(
        self,
        observation: LocalObservation,
        decision: str,
        performance_class: str,
        local_probability: float,
        global_probability: float,
    ) -> str:
        completed_sets = [
            result
            for result in observation.actual_sets
            if result.completed
        ]

        if completed_sets:
            average_reps = sum(
                result.reps
                for result in completed_sets
            ) / len(completed_sets)

            average_rir = sum(
                result.rir
                for result in completed_sets
            ) / len(completed_sets)
        else:
            average_reps = 0.0
            average_rir = 0.0

        return (
            f"Performance was {performance_class} "
            f"with {average_reps:.1f} average reps and "
            f"{average_rir:.1f} average RIR. "
            f"The local probability for {decision} is "
            f"{local_probability:.3f}, while the global probability "
            f"is {global_probability:.3f}. "
            f"The exercise-specific model is combined with the global "
            f"model according to the amount of local evidence."
        )

    def recommend(
        self,
        observation: LocalObservation,
    ) -> LocalRecommendation:
        self.ensure_exercise(
            observation.exercise_id
        )

        performance_class, performance_score = (
            self.classify_performance(
                observation
            )
        )

        completed_sets = [
            result
            for result in observation.actual_sets
            if result.completed
        ]

        if not completed_sets:
            eligible_actions = [
                "decrease",
                "maintain",
            ]
        else:
            average_reps = sum(
                result.reps
                for result in completed_sets
            ) / len(completed_sets)

            average_rir = sum(
                result.rir
                for result in completed_sets
            ) / len(completed_sets)

            eligible_actions = (
                self.global_model.get_eligible_actions(
                    performance_class,
                    average_reps,
                    observation.previous_rep_range,
                    average_rir,
                    observation.previous_target_rir,
                )
            )

        if not eligible_actions:
            eligible_actions = [
                "maintain"
            ]

        global_probabilities = (
            self.global_model.get_probabilities()
        )

        combined_probabilities = (
            self.get_combined_probabilities(
                observation.exercise_id
            )
        )

        exploration_action = self._exploration_action(
            observation.exercise_id,
            eligible_actions,
        )

        if exploration_action is not None:
            decision = exploration_action
        else:
            decision = max(
                eligible_actions,
                key=lambda action:
                    combined_probabilities[action],
            )

        values = [
            combined_probabilities[action]
            for action in eligible_actions
        ]

        total = sum(values)

        confidence = (
            combined_probabilities[decision] / total
            if total > 0
            else 0.0
        )

        reason = self.build_reason(
            observation,
            decision,
            performance_class,
            self.get_local_probability(
                observation.exercise_id,
                decision,
            ),
            global_probabilities[decision],
        )

        return LocalRecommendation(
            exercise_id=observation.exercise_id,
            exercise_number=observation.exercise_number,
            decision=decision,
            confidence=confidence,
            probability_of_success=combined_probabilities[
                decision
            ],
            local_probability=self.get_local_probability(
                observation.exercise_id,
                decision,
            ),
            global_probability=global_probabilities[
                decision
            ],
            probabilities=combined_probabilities,
            performance_score=performance_score,
            performance_class=performance_class,
            eligible_actions=eligible_actions,
            reason=reason,
        )

    def get_context(
        self,
        exercise_id: str,
    ) -> dict:
        self.ensure_exercise(
            exercise_id
        )

        global_context = (
            self.global_model.get_context()
        )

        return {
            "exercise_id": exercise_id,
            "local": self.get_exercise_state(
                exercise_id
            ),
            "global": global_context,
            "combined": self.get_combined_probabilities(
                exercise_id
            ),
        }

    def export_state(self) -> dict:
        return {
            exercise_id: self.get_exercise_state(
                exercise_id
            )
            for exercise_id in self.state
        }


def create_observation(
    exercise_id: str,
    exercise_number: int,
    actual_sets: list[SetResult],
    previous_rep_range: tuple[int, int],
    previous_target_rir: float,
    tested_action: Optional[str],
) -> LocalObservation:
    return LocalObservation(
        exercise_id=exercise_id,
        exercise_number=exercise_number,
        actual_sets=actual_sets,
        previous_rep_range=previous_rep_range,
        previous_target_rir=previous_target_rir,
        tested_action=tested_action,
    )
