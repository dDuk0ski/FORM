import json
from pathlib import Path
import numpy as np
from dataclasses import dataclass

ACTIONS = ["increase_weight", "increase_reps", "maintain", "decrease"]
PERFORMANCE_CLASSES = ["excellent", "good", "moderate", "poor", "failure"]
REP_POSITIONS = ["below_range", "mid_range", "top_of_range"]
PROGRESSION_TYPES = ["weighted", "bodyweight", "assisted"]


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


@dataclass
class Recommendation:
    decision: str
    probabilities: dict[str, float]
    performance_score: float
    performance_class: str
    rep_position: str
    progression_type: str


class GlobalProgressionModel:
    def __init__(self, state_file="global_bayesian_state.json", prior_alpha=2.0, prior_beta=2.0):
        self.state_file = Path(state_file)
        self.prior_alpha = prior_alpha
        self.prior_beta = prior_beta
        self.observations = {}
        self.load()

    def _normalize_progression_type(self, progression_type):
        if progression_type not in PROGRESSION_TYPES:
            return "weighted"
        return progression_type

    def _context_key(self, performance, rep_position, progression_type):
        progression_type = self._normalize_progression_type(progression_type)
        return f"{progression_type}|{performance}|{rep_position}"

    def _create_context(self):
        return {action: [] for action in ACTIONS}

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
        self.state_file.write_text(json.dumps({"contexts": self.observations}, indent=2))

    def ensure_context(self, performance, rep_position, progression_type="weighted"):
        progression_type = self._normalize_progression_type(progression_type)
        key = self._context_key(performance, rep_position, progression_type)
        if key not in self.observations:
            self.observations[key] = self._create_context()
        for action in ACTIONS:
            if action not in self.observations[key]:
                self.observations[key][action] = []
        return key

    def infer(self, performance=None, rep_position=None, progression_type="weighted"):
        probabilities = {}
        performance = performance or "good"
        rep_position = rep_position or "mid_range"
        progression_type = self._normalize_progression_type(progression_type)
        key = self.ensure_context(performance, rep_position, progression_type)
        context = self.observations[key]
        for action in ACTIONS:
            alpha = self.prior_alpha
            beta = self.prior_beta
            for score in context[action]:
                score = float(np.clip(score, 0.001, 0.999))
                alpha += score
                beta += 1.0 - score
            probabilities[action] = alpha / (alpha + beta)
        return probabilities

    def get_probabilities(self, performance=None, rep_position=None, progression_type="weighted"):
        return self.infer(performance, rep_position, progression_type)

    def update(self, observation):
        if observation.tested_action not in ACTIONS:
            return
        progression_type = self._normalize_progression_type(observation.progression_type)
        performance = self.performance(observation)
        rep_position = self.rep_position(observation)
        key = self.ensure_context(performance, rep_position, progression_type)
        score = self.action_score(observation, observation.tested_action)
        self.observations[key][observation.tested_action].append(score)
        self.save()

    def success_score(self, observation):
        if not observation.actual_sets:
            return 0.0
        completed = [s for s in observation.actual_sets if s.completed]
        if not completed:
            return 0.0
        minimum, maximum = observation.previous_rep_range
        completion = len(completed) / len(observation.actual_sets)
        reps = np.mean([s.reps for s in completed])
        rir = np.mean([s.rir for s in completed])
        if reps >= maximum:
            rep_score = 1.0
        elif reps >= minimum:
            rep_score = (reps - minimum) / max(1, maximum - minimum)
        else:
            rep_score = reps / max(1, minimum)
        rir_difference = rir - observation.previous_target_rir
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
        return completion * 0.15 + rep_score * 0.55 + rir_score * 0.30

    def _base_rewards(self, performance, rep_position):
        return {
            "excellent": {
                "below_range": {"increase_weight": 0.65, "increase_reps": 0.75, "maintain": 0.55, "decrease": 0.10},
                "mid_range": {"increase_weight": 0.70, "increase_reps": 0.85, "maintain": 0.40, "decrease": 0.05},
                "top_of_range": {"increase_weight": 1.00, "increase_reps": 0.85, "maintain": 0.25, "decrease": 0.05},
            },
            "good": {
                "below_range": {"increase_weight": 0.20, "increase_reps": 0.55, "maintain": 0.70, "decrease": 0.25},
                "mid_range": {"increase_weight": 0.25, "increase_reps": 0.90, "maintain": 0.45, "decrease": 0.10},
                "top_of_range": {"increase_weight": 0.90, "increase_reps": 0.85, "maintain": 0.30, "decrease": 0.05},
            },
            "moderate": {
                "below_range": {"increase_weight": 0.05, "increase_reps": 0.25, "maintain": 0.85, "decrease": 0.35},
                "mid_range": {"increase_weight": 0.10, "increase_reps": 0.65, "maintain": 0.75, "decrease": 0.20},
                "top_of_range": {"increase_weight": 0.30, "increase_reps": 0.75, "maintain": 0.55, "decrease": 0.10},
            },
            "poor": {
                "below_range": {"increase_weight": 0.01, "increase_reps": 0.05, "maintain": 0.85, "decrease": 0.90},
                "mid_range": {"increase_weight": 0.02, "increase_reps": 0.10, "maintain": 0.80, "decrease": 0.70},
                "top_of_range": {"increase_weight": 0.05, "increase_reps": 0.20, "maintain": 0.75, "decrease": 0.55},
            },
            "failure": {
                "below_range": {"increase_weight": 0.01, "increase_reps": 0.01, "maintain": 0.35, "decrease": 1.00},
                "mid_range": {"increase_weight": 0.01, "increase_reps": 0.02, "maintain": 0.40, "decrease": 0.95},
                "top_of_range": {"increase_weight": 0.02, "increase_reps": 0.05, "maintain": 0.55, "decrease": 0.85},
            },
        }

    def _progression_rewards(self, performance, rep_position, progression_type):
        rewards = self._base_rewards(performance, rep_position)
        if progression_type == "weighted":
            return rewards
        if progression_type == "bodyweight":
            for performance_key in rewards:
                for position in REP_POSITIONS:
                    rewards[performance_key][position]["increase_weight"] = 0.001
                if performance_key in ["excellent", "good"]:
                    rewards[performance_key]["below_range"]["increase_reps"] = max(rewards[performance_key]["below_range"]["increase_reps"], 0.75)
                    rewards[performance_key]["mid_range"]["increase_reps"] = max(rewards[performance_key]["mid_range"]["increase_reps"], 0.90)
                    rewards[performance_key]["top_of_range"]["increase_reps"] = max(rewards[performance_key]["top_of_range"]["increase_reps"], 0.95)
            return rewards
        if progression_type == "assisted":
            rewards["excellent"]["top_of_range"]["increase_weight"] = 1.00
            rewards["excellent"]["mid_range"]["increase_weight"] = 0.70
            rewards["good"]["top_of_range"]["increase_weight"] = 0.95
            rewards["good"]["mid_range"]["increase_weight"] = 0.30
            rewards["moderate"]["top_of_range"]["increase_weight"] = 0.45
            rewards["moderate"]["mid_range"]["increase_weight"] = 0.10
            return rewards
        return rewards

    def action_score(self, observation, action):
        performance = self.performance(observation)
        rep_position = self.rep_position(observation)
        progression_type = self._normalize_progression_type(observation.progression_type)
        rewards = self._progression_rewards(performance, rep_position, progression_type)
        score = rewards[performance][rep_position][action]
        workout_score = self.success_score(observation)
        if performance in ["excellent", "good"] and action in ["increase_weight", "increase_reps"]:
            score = score * 0.80 + workout_score * 0.20
        elif performance in ["poor", "failure"] and action in ["maintain", "decrease"]:
            score = score * 0.80 + (1.0 - workout_score) * 0.20
        else:
            score = score * 0.90 + workout_score * 0.10
        return float(np.clip(score, 0.001, 0.999))

    def performance(self, observation):
        if not observation.actual_sets:
            return "failure"
        completed = [s for s in observation.actual_sets if s.completed]
        if not completed:
            return "failure"
        minimum, maximum = observation.previous_rep_range
        reps = np.mean([s.reps for s in completed])
        rir = np.mean([s.rir for s in completed])
        target = observation.previous_target_rir
        completion = len(completed) / len(observation.actual_sets)
        if completion < 0.5:
            return "failure"
        if reps >= maximum and rir >= target:
            return "excellent"
        if reps >= minimum and rir >= target - 0.5:
            return "good"
        if reps >= minimum:
            return "moderate"
        if reps >= minimum - 1:
            return "poor"
        return "failure"

    def rep_position(self, observation):
        if not observation.actual_sets:
            return "below_range"
        completed = [s for s in observation.actual_sets if s.completed]
        if not completed:
            return "below_range"
        minimum, maximum = observation.previous_rep_range
        reps = np.mean([s.reps for s in completed])
        if reps < minimum:
            return "below_range"
        if reps >= maximum:
            return "top_of_range"
        return "mid_range"

    def eligible_actions(self, observation, performance):
        progression_type = self._normalize_progression_type(observation.progression_type)
        if not observation.actual_sets:
            return ["maintain", "decrease"]
        completed = [s for s in observation.actual_sets if s.completed]
        if not completed:
            return ["maintain", "decrease"]
        minimum, maximum = observation.previous_rep_range
        reps = np.mean([s.reps for s in completed])
        if performance == "excellent":
            actions = ["increase_weight", "increase_reps"]
        elif performance == "good":
            actions = ["increase_weight", "increase_reps", "maintain"] if reps >= maximum else ["increase_reps", "maintain"]
        elif performance == "moderate":
            actions = ["increase_reps", "maintain"]
        elif performance == "poor":
            actions = ["maintain", "decrease"]
        else:
            actions = ["decrease", "maintain"]
        if progression_type == "bodyweight":
            actions = [action for action in actions if action != "increase_weight"]
        return actions

    def recommend(self, observation):
        performance = self.performance(observation)
        rep_position = self.rep_position(observation)
        progression_type = self._normalize_progression_type(observation.progression_type)
        score = self.success_score(observation)
        probabilities = self.infer(performance, rep_position, progression_type)
        if not observation.actual_sets:
            return Recommendation("increase_reps", probabilities, score, performance, rep_position, progression_type)
        eligible = self.eligible_actions(observation, performance)
        decision = max(eligible, key=lambda action: probabilities[action])
        return Recommendation(decision, probabilities, score, performance, rep_position, progression_type)

    def reset(self):
        self.observations = {}
        if self.state_file.exists():
            self.state_file.unlink()