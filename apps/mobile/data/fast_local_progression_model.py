import json
from pathlib import Path
import numpy as np

from fast_global_progression_model import (
    ACTIONS,
    PERFORMANCE_CLASSES,
    REP_POSITIONS,
)


class LocalProgressionModel:
    def __init__(
        self,
        global_model,
        state_file="local_bayesian_state.json",
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
            data = json.loads(
                self.state_file.read_text()
            )

            if isinstance(data, dict) and "exercises" in data:
                self.observations = data["exercises"]
            else:
                self.observations = {}

        except (OSError, json.JSONDecodeError):
            self.observations = {}

    def save(self):
        data = {
            "exercises": self.observations
        }

        self.state_file.write_text(
            json.dumps(data, indent=2)
        )

    def _context_key(
        self,
        performance,
        rep_position,
    ):
        return f"{performance}|{rep_position}"

    def _ensure(
        self,
        exercise,
        performance=None,
        rep_position=None,
    ):
        if performance is None:
            performance = "good"

        if rep_position is None:
            rep_position = "mid_range"

        if exercise not in self.observations:
            self.observations[exercise] = {}

        key = self._context_key(
            performance,
            rep_position,
        )

        if key not in self.observations[exercise]:
            self.observations[exercise][key] = {
                action: []
                for action in ACTIONS
            }

        for action in ACTIONS:
            if action not in self.observations[
                exercise
            ][key]:
                self.observations[
                    exercise
                ][key][action] = []

        return key

    def _fit(
        self,
        exercise,
        performance,
        rep_position,
    ):
        key = self._ensure(
            exercise,
            performance,
            rep_position,
        )

        global_probabilities = (
            self.global_model.get_probabilities(
                performance,
                rep_position,
            )
        )

        probabilities = {}

        context = self.observations[
            exercise
        ][key]

        for action in ACTIONS:
            p = float(
                np.clip(
                    global_probabilities[action],
                    0.001,
                    0.999,
                )
            )

            alpha = (
                p
                * self.prior_strength
            )

            beta = (
                (1.0 - p)
                * self.prior_strength
            )

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

    def update(
        self,
        exercise,
        action,
        score,
        performance="good",
        rep_position="mid_range",
    ):
        if action not in ACTIONS:
            return

        key = self._ensure(
            exercise,
            performance,
            rep_position,
        )

        score = float(
            np.clip(
                score,
                0.0,
                1.0,
            )
        )

        self.observations[
            exercise
        ][key][action].append(score)

        self.save()

    def recommend(
        self,
        exercise,
        eligible_actions,
        performance="good",
        rep_position="mid_range",
    ):
        if not eligible_actions:
            return {
                "decision": "maintain",
                "probability": 0.0,
                "confidence": 0.0,
                "probabilities": {
                    action: 0.0
                    for action in ACTIONS
                },
                "performance": performance,
                "rep_position": rep_position,
            }

        probabilities = self._fit(
            exercise,
            performance,
            rep_position,
        )

        decision = max(
            eligible_actions,
            key=lambda action:
                probabilities[action],
        )

        total = sum(
            probabilities[action]
            for action in eligible_actions
        )

        confidence = (
            probabilities[decision]
            / total
            if total > 0
            else 0.0
        )

        return {
            "decision": decision,
            "probability": probabilities[
                decision
            ],
            "confidence": confidence,
            "probabilities": probabilities,
            "performance": performance,
            "rep_position": rep_position,
        }

    def reset(self):
        self.observations = {}

        if self.state_file.exists():
            self.state_file.unlink()