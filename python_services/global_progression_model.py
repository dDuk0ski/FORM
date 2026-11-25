
from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any
import math

import numpy as np


FEATURE_COUNT = 7
TARGET_RIR = 2
GLOBAL_STATE_VERSION = 6


@dataclass
class ProgressionConfig:
    local_weight: float = 0.75

    global_prior_intercept: float = 0.55
    global_prior_intercept_variance: float = 0.75
    global_prior_feature_variance: float = 0.05
    global_noise_variance: float = 0.02

    local_prior_intercept: float = 0.75
    local_prior_intercept_variance: float = 0.35
    local_prior_feature_variance: float = 0.35
    local_prior_interaction_variance: float = 0.20
    local_noise_variance: float = 0.02

    rir_prior_intercept: float = 0.5
    rir_noise_variance: float = 0.08

    rep_score_weight: float = 0.70
    rir_score_weight: float = 0.20
    completion_score_weight: float = 0.10

    rir_above_target_decay: float = 6.0
    rir_below_target_decay: float = 0.75

    rep_miss_1_score: float = 0.80
    rep_miss_2_score: float = 0.55
    rep_miss_3_score: float = 0.25
    rep_miss_4_score: float = 0.15
    rep_miss_tail_decay: float = 2.0

    incomplete_set_penalty: float = 0.45
    challenge_bonus: float = 0.05
    challenge_difficulty_cap: float = 4.0
    near_target_reps: int = 0

    progression_bonus: float = 0.01
    progression_bonus_cap: float = 3.0
    uncertainty_penalty: float = 0.16

    rir_penalty_high: float = 0.01
    rir_penalty_moderate: float = 0.16
    rir_penalty_low: float = 0.20
    rir_penalty_unsafe: float = 0.60

    rir_threshold_high: float = 0.90
    rir_threshold_moderate: float = 0.60
    rir_threshold_low: float = 0.40
    rir_safety_fallback_threshold: float = 0.60

    candidate_rep_steps: tuple[int, ...] = (-1, 0, 1, 2)
    candidate_weight_steps: tuple[int, ...] = (-1, 0, 1, 2)

    softmax_temperature: float = 0.20


    def validate(self) -> None:
        if not 0.0 <= self.local_weight <= 1.0:
            raise ValueError("local_weight must be between 0 and 1")

        positive_values = [
            self.global_prior_intercept_variance,
            self.global_prior_feature_variance,
            self.local_prior_intercept_variance,
            self.local_prior_feature_variance,
            self.local_prior_interaction_variance,
            self.global_noise_variance,
            self.local_noise_variance,
            self.rir_noise_variance,
            self.rir_above_target_decay,
            self.rir_below_target_decay,
            self.rep_miss_tail_decay,
            self.challenge_difficulty_cap,
            self.progression_bonus_cap,
            self.softmax_temperature,
        ]

        if any(value <= 0 for value in positive_values):
            raise ValueError("Variance, decay, cap, and temperature values must be positive")

        nonnegative_values = [
            self.rep_score_weight,
            self.rir_score_weight,
            self.completion_score_weight,
            self.rep_miss_1_score,
            self.rep_miss_2_score,
            self.rep_miss_3_score,
            self.rep_miss_4_score,
            self.incomplete_set_penalty,
            self.challenge_bonus,
            self.progression_bonus,
            self.uncertainty_penalty,
            self.rir_penalty_high,
            self.rir_penalty_moderate,
            self.rir_penalty_low,
            self.rir_penalty_unsafe,
        ]

        if any(value < 0 for value in nonnegative_values):
            raise ValueError("Scoring weights and penalties cannot be negative")

        if self.near_target_reps < 0:
            raise ValueError("near_target_reps cannot be negative")

        if not (
            self.rir_threshold_high
            >= self.rir_threshold_moderate
            >= self.rir_threshold_low
        ):
            raise ValueError("RIR thresholds must be in descending order")

        if not 0.0 <= self.rir_safety_fallback_threshold <= 1.0:
            raise ValueError("RIR fallback threshold must be between 0 and 1")

        if not self.candidate_rep_steps:
            raise ValueError("candidate_rep_steps cannot be empty")

        if not self.candidate_weight_steps:
            raise ValueError("candidate_weight_steps cannot be empty")


@dataclass
class SetResult:
    weight: float
    reps: int
    rir: float
    completed: bool = True


@dataclass
class ExercisePrescription:
    sets: int
    rep_range: tuple[int, int]
    weight: float
    target_rir: int = TARGET_RIR
    progression_type: str = "weighted"
    weight_increment: float = 5.0
    rep_increment: int = 1
    max_sets: int = 5

    def validate(self) -> None:
        if self.sets < 1:
            raise ValueError("sets must be at least 1")

        low, high = self.rep_range

        if low < 1 or high < low:
            raise ValueError("invalid rep range")

        if self.weight < 0:
            raise ValueError("weight cannot be negative")

        if self.weight_increment <= 0:
            raise ValueError("weight_increment must be positive")

        if self.rep_increment <= 0:
            raise ValueError("rep_increment must be positive")

        if self.progression_type not in {
            "weighted",
            "assisted",
            "bodyweight",
        }:
            raise ValueError("unsupported progression_type")


@dataclass
class ExerciseObservation:
    exercise_id: str
    baseline_prescription: ExercisePrescription
    prescription: ExercisePrescription
    actual_sets: list[SetResult]


@dataclass
class Prediction:
    mean: float
    standard_deviation: float


class BayesianLinearRegression:
    def __init__(
        self,
        feature_count: int = FEATURE_COUNT,
        prior_mean: list[float] | None = None,
        prior_covariance: np.ndarray | None = None,
        noise_variance: float = 0.04,
    ):
        self.feature_count = feature_count

        self.mean = np.array(
            prior_mean
            if prior_mean is not None
            else [0.65] + [0.0] * (feature_count - 1),
            dtype=float,
        )

        self.covariance = (
            np.array(prior_covariance, dtype=float)
            if prior_covariance is not None
            else np.diag([0.5] + [0.25] * (feature_count - 1))
        )

        self.noise_variance = max(float(noise_variance), 1e-6)

    def update(self, features: list[float], target: float) -> None:
        x = np.asarray(features, dtype=float)
        y = float(np.clip(target, 0.0, 1.0))

        if x.shape[0] != self.feature_count:
            raise ValueError("Incorrect feature count")

        covariance_x = self.covariance @ x
        denominator = self.noise_variance + x @ covariance_x

        if denominator <= 1e-12:
            return

        gain = covariance_x / denominator
        self.mean = self.mean + gain * (y - x @ self.mean)

        identity = np.eye(self.feature_count)
        self.covariance = (
            identity - np.outer(gain, x)
        ) @ self.covariance

        self.covariance = (
            self.covariance + self.covariance.T
        ) / 2.0

    def predict(self, features: list[float]) -> Prediction:
        x = np.asarray(features, dtype=float)

        if x.shape[0] != self.feature_count:
            raise ValueError("Incorrect feature count")

        mean = float(x @ self.mean)
        variance = float(
            self.noise_variance + x @ self.covariance @ x
        )

        return Prediction(
            mean=float(np.clip(mean, 0.0, 1.0)),
            standard_deviation=math.sqrt(max(variance, 1e-9)),
        )

    def export_state(self) -> dict[str, Any]:
        return {
            "feature_count": self.feature_count,
            "mean": self.mean.tolist(),
            "covariance": self.covariance.tolist(),
            "noise_variance": self.noise_variance,
        }

    @classmethod
    def from_state(cls, state: dict[str, Any]) -> BayesianLinearRegression:
        return cls(
            feature_count=state["feature_count"],
            prior_mean=state["mean"],
            prior_covariance=np.array(
                state["covariance"],
                dtype=float,
            ),
            noise_variance=state["noise_variance"],
        )


def _difficulty_units(
    baseline: ExercisePrescription,
    candidate: ExercisePrescription,
) -> float:
    if baseline.progression_type != candidate.progression_type:
        return 0.0

    rep_change = (
        candidate.rep_range[1] - baseline.rep_range[1]
    ) / max(baseline.rep_increment, 1)

    if candidate.progression_type == "weighted":
        weight_change = (
            candidate.weight - baseline.weight
        ) / max(baseline.weight_increment, 1e-6)

    elif candidate.progression_type == "assisted":
        weight_change = (
            baseline.weight - candidate.weight
        ) / max(baseline.weight_increment, 1e-6)

    else:
        weight_change = 0.0

    return float(weight_change + rep_change)


def progression_features(
    baseline: ExercisePrescription,
    candidate: ExercisePrescription,
) -> list[float]:
    sets_change = (
        candidate.sets - baseline.sets
    ) / max(baseline.sets, 1)

    reps_change = (
        candidate.rep_range[1] - baseline.rep_range[1]
    ) / max(baseline.rep_increment, 1)

    if candidate.progression_type == "weighted":
        weight_change = (
            candidate.weight - baseline.weight
        ) / max(baseline.weight_increment, 1e-6)

    elif candidate.progression_type == "assisted":
        weight_change = (
            baseline.weight - candidate.weight
        ) / max(baseline.weight_increment, 1e-6)

    else:
        weight_change = 0.0

    return [
        1.0,
        float(sets_change),
        float(reps_change),
        float(weight_change),
        0.0,
        float(reps_change * weight_change),
        float(sets_change * weight_change),
    ]


def _rep_attainment_score(
    achieved_reps: int,
    target_reps: int,
    config: ProgressionConfig,
) -> float:
    if target_reps <= 0:
        return 0.0

    difference = achieved_reps - target_reps

    if difference >= 0:
        return 1.0

    miss = abs(difference)

    miss_scores = {
        1: config.rep_miss_1_score,
        2: config.rep_miss_2_score,
        3: config.rep_miss_3_score,
        4: config.rep_miss_4_score,
    }

    if miss in miss_scores:
        return float(np.clip(miss_scores[miss], 0.0, 1.0))

    tail_score = (
        config.rep_miss_4_score
        * math.exp(-(miss - 4) / config.rep_miss_tail_decay)
    )

    return float(np.clip(tail_score, 0.0, 1.0))


def _rir_score(
    actual_rir: float,
    config: ProgressionConfig,
) -> float:
    difference = actual_rir - TARGET_RIR

    if difference >= 0:
        return math.exp(
            -abs(difference) / config.rir_above_target_decay
        )

    return math.exp(
        -abs(difference) / config.rir_below_target_decay
    )


def score_exercise(
    observation: ExerciseObservation,
    config: ProgressionConfig | None = None,
) -> float:
    config = config or ProgressionConfig()
    config.validate()

    prescription = observation.prescription
    baseline = observation.baseline_prescription

    if not observation.actual_sets:
        return 0.0

    target_reps = prescription.rep_range[1]

    valid_sets = [
        result
        for result in observation.actual_sets
        if result.completed
    ]

    completion_ratio = (
        len(valid_sets) / max(prescription.sets, 1)
    )

    if not valid_sets:
        return 0.0

    rep_scores = [
        _rep_attainment_score(
            result.reps,
            target_reps,
            config,
        )
        for result in valid_sets
    ]

    rir_scores = [
        _rir_score(result.rir, config)
        for result in valid_sets
    ]

    rep_score = float(np.mean(rep_scores))
    rir_score = float(np.mean(rir_scores))
    completion_score = min(completion_ratio, 1.0)

    difficulty = _difficulty_units(
        baseline,
        prescription,
    )

    challenge_quality = (
        min(max(difficulty, 0.0), config.challenge_difficulty_cap)
        / config.challenge_difficulty_cap
    )

    near_target = sum(
        result.reps >= target_reps - config.near_target_reps
        for result in valid_sets
    ) / len(valid_sets)

    challenge_bonus = (
        config.challenge_bonus
        * challenge_quality
        * near_target
    )

    completion_penalty = (
        config.incomplete_set_penalty
        * (1.0 - completion_score)
    )

    score = (
        config.rep_score_weight * rep_score
        + config.rir_score_weight * rir_score
        + config.completion_score_weight * completion_score
        + challenge_bonus
        - completion_penalty
    )

    return float(np.clip(score, 0.0, 1.0))


class GlobalProgressionModel:
    def __init__(
        self,
        state_data: dict[str, Any] | None = None,
        config: ProgressionConfig | None = None,
    ):
        self.config = config or ProgressionConfig()
        self.config.validate()

        prior_mean = (
            [self.config.global_prior_intercept]
            + [0.0] * (FEATURE_COUNT - 1)
        )

        prior_covariance = np.diag(
            [self.config.global_prior_intercept_variance]
            + [self.config.global_prior_feature_variance]
            * (FEATURE_COUNT - 1)
        )

        self.regressor = BayesianLinearRegression(
            prior_mean=prior_mean,
            prior_covariance=prior_covariance,
            noise_variance=self.config.global_noise_variance,
        )

        if state_data:
            self.load_state(state_data)

    def update(self, observation: ExerciseObservation) -> float:
        score = score_exercise(observation, self.config)

        features = progression_features(
            observation.baseline_prescription,
            observation.prescription,
        )

        self.regressor.update(features, score)

        return score

    def predict(
        self,
        baseline: ExercisePrescription,
        candidate: ExercisePrescription,
    ) -> Prediction:
        features = progression_features(
            baseline,
            candidate,
        )

        return self.regressor.predict(features)

    def export_state(self) -> dict[str, Any]:
        return {
            "version": GLOBAL_STATE_VERSION,
            "regressor": self.regressor.export_state(),
        }

    def load_state(self, state: dict[str, Any]) -> None:
        regressor_state = state.get("regressor")

        if regressor_state:
            self.regressor = BayesianLinearRegression.from_state(
                regressor_state
            )
