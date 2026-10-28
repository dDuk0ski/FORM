from dataclasses import dataclass
from pathlib import Path
import json

import numpy as np
import pymc as pm


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
    tested_action: str | None = None


@dataclass
class Recommendation:
    decision: str
    probabilities: dict[str, float]
    performance_score: float
    performance_class: str


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

        self.observations = {
            action: []
            for action in ACTIONS
        }

        self.load()
    def get_probabilities(self):
        return self.infer()
    def load(self):
        if not self.state_file.exists():
            return

        try:
            data = json.loads(
                self.state_file.read_text()
            )

            for action in ACTIONS:
                self.observations[action] = data.get(
                    action,
                    []
                )

        except (OSError, json.JSONDecodeError):
            pass

    def save(self):
        self.state_file.write_text(
            json.dumps(
                self.observations,
                indent=2
            )
        )

    def infer(self):
        probabilities = {}

        with pm.Model():

            p = pm.Beta(
                "p",
                alpha=self.prior_alpha,
                beta=self.prior_beta,
                shape=len(ACTIONS)
            )

            for i, action in enumerate(ACTIONS):

                scores = self.observations[action]

                if scores:
                    pm.Beta(
                        action,
                        alpha=p[i] * 10,
                        beta=(1 - p[i]) * 10,
                        observed=np.clip(
                            scores,
                            0.001,
                            0.999
                        )
                    )

            trace = pm.sample(
                draws=50,
                tune=50,
                chains=2,
                cores=2,
                progressbar=False
            )

        values = trace.posterior["p"].mean(
            dim=("chain", "draw")
        ).values

        for i, action in enumerate(ACTIONS):
            probabilities[action] = float(
                values[i]
            )

        return probabilities

    def update(self, observation):
        if observation.tested_action not in ACTIONS:
            return

        score = self.success_score(
            observation
        )

        self.observations[
            observation.tested_action
        ].append(score)

        self.save()

    def success_score(self, observation):
        if not observation.actual_sets:
            return 0.0

        completed = [
            s for s in observation.actual_sets
            if s.completed
        ]

        if not completed:
            return 0.0

        minimum, maximum = observation.previous_rep_range

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
                reps - minimum
            ) / max(
                1,
                maximum - minimum
            )
        else:
            rep_score = reps / max(
                1,
                minimum
            )

        rir_difference = (
            rir - observation.previous_target_rir
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
            return "unknown"

        completed = [
            s for s in observation.actual_sets
            if s.completed
        ]

        if not completed:
            return "failure"

        minimum, maximum = observation.previous_rep_range

        reps = np.mean([
            s.reps
            for s in completed
        ])

        rir = np.mean([
            s.rir
            for s in completed
        ])

        target = observation.previous_target_rir

        if reps >= maximum and rir >= target:
            return "excellent"

        if reps >= minimum and rir >= target - 0.5:
            return "good"

        if reps >= minimum:
            return "moderate"

        if reps >= minimum - 1:
            return "poor"

        return "failure"

    def eligible_actions(self, observation, performance):
        minimum, maximum = observation.previous_rep_range

        reps = np.mean([
            s.reps
            for s in observation.actual_sets
            if s.completed
        ])

        if performance == "excellent":
            return [
                "increase_weight",
                "increase_reps",
                "maintain"
            ]

        if performance == "good":
            if reps >= maximum:
                return [
                    "increase_weight",
                    "increase_reps",
                    "maintain"
                ]

            return [
                "increase_reps",
                "maintain"
            ]

        if performance == "moderate":
            return [
                "increase_reps",
                "maintain"
            ]

        if performance == "poor":
            return [
                "maintain",
                "decrease"
            ]

        return [
            "decrease",
            "maintain"
        ]

    def recommend(self, observation):
        performance = self.performance(
            observation
        )

        score = self.success_score(
            observation
        )

        probabilities = self.infer()

        if not observation.actual_sets:
            return Recommendation(
                "increase_reps",
                probabilities,
                score,
                performance
            )

        eligible = self.eligible_actions(
            observation,
            performance
        )

        decision = max(
            eligible,
            key=lambda action: probabilities[action]
        )

        return Recommendation(
            decision,
            probabilities,
            score,
            performance
        )