import json
from pathlib import Path

import numpy as np
import pymc as pm

from global_progression_model import ACTIONS


class LocalProgressionModel:

    def __init__(
        self,
        global_model,
        state_file="local_pymc_state.json",
        prior_strength=10.0,
    ):
        self.global_model = global_model
        self.state_file = Path(state_file)
        self.prior_strength = prior_strength

        self.observations = {}
        self.load()

    def load(self):
        if not self.state_file.exists():
            return

        try:
            self.observations = json.loads(
                self.state_file.read_text()
            )
        except (OSError, json.JSONDecodeError):
            self.observations = {}

    def save(self):
        self.state_file.write_text(
            json.dumps(
                self.observations,
                indent=2
            )
        )

    def _ensure(self, exercise):
        if exercise not in self.observations:
            self.observations[exercise] = {
                action: []
                for action in ACTIONS
            }

    def _fit(self, exercise):
        self._ensure(exercise)

        global_probabilities = (
            self.global_model.get_probabilities()
        )

        with pm.Model():
            probabilities = {}

            for action in ACTIONS:
                p_global = np.clip(
                    global_probabilities[action],
                    0.001,
                    0.999
                )

                p = pm.Beta(
                    action,
                    alpha=p_global * self.prior_strength,
                    beta=(1 - p_global) * self.prior_strength
                )

                probabilities[action] = p

                scores = self.observations[
                    exercise
                ][action]

                if scores:
                    pm.Beta(
                        f"{action}_observations",
                        alpha=p * 10,
                        beta=(1 - p) * 10,
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

        return {
            action: float(
                trace.posterior[action].mean()
            )
            for action in ACTIONS
        }

    def update(
        self,
        exercise,
        action,
        score,
    ):
        if action not in ACTIONS:
            return

        self._ensure(exercise)

        self.observations[
            exercise
        ][action].append(
            float(np.clip(score, 0, 1))
        )

        self.save()

    def recommend(
        self,
        exercise,
        eligible_actions,
    ):
        probabilities = self._fit(exercise)

        decision = max(
            eligible_actions,
            key=lambda action: probabilities[action]
        )

        total = sum(
            probabilities[action]
            for action in eligible_actions
        )

        confidence = (
            probabilities[decision] / total
            if total
            else 0.0
        )

        return {
            "decision": decision,
            "probability": probabilities[decision],
            "confidence": confidence,
            "probabilities": probabilities,
        }

    def reset(self):
        self.observations = {}

        if self.state_file.exists():
            self.state_file.unlink()