import json
from pathlib import Path
import numpy as np

from fast_global_progression_model import ACTIONS, PERFORMANCE_CLASSES, REP_POSITIONS, PROGRESSION_TYPES


class LocalProgressionModel:
    def __init__(self, global_model, state_file="local_bayesian_state.json", prior_strength=10.0):
        self.global_model = global_model
        self.state_file = Path(state_file)
        self.prior_strength = prior_strength
        self.observations = {}
        self.load()

    def load(self):
        if not self.state_file.exists():
            return
        try:
            data = json.loads(self.state_file.read_text())
            self.observations = data.get("exercises", {}) if isinstance(data, dict) else {}
        except (OSError, json.JSONDecodeError):
            self.observations = {}

    def save(self):
        self.state_file.write_text(json.dumps({"exercises": self.observations}, indent=2))

    def _normalize_progression_type(self, progression_type):
        return progression_type if progression_type in PROGRESSION_TYPES else "weighted"

    def _context_key(self, performance, rep_position, progression_type):
        progression_type = self._normalize_progression_type(progression_type)
        return f"{progression_type}|{performance}|{rep_position}"

    def _ensure(self, exercise, performance="good", rep_position="mid_range", progression_type="weighted"):
        progression_type = self._normalize_progression_type(progression_type)
        if exercise not in self.observations:
            self.observations[exercise] = {}
        key = self._context_key(performance, rep_position, progression_type)
        if key not in self.observations[exercise]:
            self.observations[exercise][key] = {action: [] for action in ACTIONS}
        for action in ACTIONS:
            if action not in self.observations[exercise][key]:
                self.observations[exercise][key][action] = []
        return key

    def _fit(self, exercise, performance, rep_position, progression_type="weighted"):
        progression_type = self._normalize_progression_type(progression_type)
        key = self._ensure(exercise, performance, rep_position, progression_type)
        global_probabilities = self.global_model.get_probabilities(performance, rep_position, progression_type)
        context = self.observations[exercise][key]
        probabilities = {}
        for action in ACTIONS:
            p = float(np.clip(global_probabilities[action], 0.001, 0.999))
            alpha = p * self.prior_strength
            beta = (1.0 - p) * self.prior_strength
            for score in context[action]:
                score = float(np.clip(score, 0.001, 0.999))
                alpha += score
                beta += 1.0 - score
            probabilities[action] = alpha / (alpha + beta)
        return probabilities

    def evidence_count(self, exercise, performance="good", rep_position="mid_range", progression_type="weighted", actions=None):
        progression_type = self._normalize_progression_type(progression_type)
        key = self._ensure(exercise, performance, rep_position, progression_type)
        actions = actions or ACTIONS
        return sum(len(self.observations[exercise][key].get(action, [])) for action in actions)

    def action_evidence(self, exercise, action, performance="good", rep_position="mid_range", progression_type="weighted"):
        progression_type = self._normalize_progression_type(progression_type)
        key = self._ensure(exercise, performance, rep_position, progression_type)
        return len(self.observations[exercise][key].get(action, []))

    def update(self, exercise, action, score, performance="good", rep_position="mid_range", progression_type="weighted"):
        if action not in ACTIONS:
            return
        progression_type = self._normalize_progression_type(progression_type)
        key = self._ensure(exercise, performance, rep_position, progression_type)
        score = float(np.clip(score, 0.0, 1.0))
        self.observations[exercise][key][action].append(score)
        self.save()

    def recommend(self, exercise, eligible_actions, performance="good", rep_position="mid_range", progression_type="weighted"):
        progression_type = self._normalize_progression_type(progression_type)
        if not eligible_actions:
            return {
                "decision": "maintain",
                "probability": 0.0,
                "confidence": 0.0,
                "probabilities": {action: 0.0 for action in ACTIONS},
                "performance": performance,
                "rep_position": rep_position,
                "progression_type": progression_type,
                "evidence_count": 0,
            }

        probabilities = self._fit(exercise, performance, rep_position, progression_type)
        decision = max(eligible_actions, key=lambda action: probabilities[action])
        total = sum(probabilities[action] for action in eligible_actions)
        confidence = probabilities[decision] / total if total > 0 else 0.0
        evidence_count = self.evidence_count(exercise, performance, rep_position, progression_type, eligible_actions)

        return {
            "decision": decision,
            "probability": probabilities[decision],
            "confidence": confidence,
            "probabilities": probabilities,
            "performance": performance,
            "rep_position": rep_position,
            "progression_type": progression_type,
            "evidence_count": evidence_count,
        }

    def reset(self):
        self.observations = {}
        if self.state_file.exists():
            self.state_file.unlink()