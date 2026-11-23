
from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any
import math

import numpy as np

from fast_global_progression_model import (
    TARGET_RIR,
    BayesianLinearRegression,
    ExerciseObservation,
    ExercisePrescription,
    GlobalProgressionModel,
    Prediction,
    ProgressionConfig,
    progression_features,
)


LOCAL_STATE_VERSION = 6


@dataclass
class ExerciseRecommendation:
    exercise_id: str
    recommended_sets: int
    recommended_rep_range: tuple[int, int]
    recommended_reps: int
    recommended_weight: float
    target_rir: int
    sets_confidence: float
    reps_confidence: float
    weight_confidence: float
    predicted_performance: float
    prediction_standard_deviation: float
    candidate_count: int

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _prescription_from_dict(
    data: dict[str, Any],
) -> ExercisePrescription:
    values = dict(data)
    values["rep_range"] = tuple(values["rep_range"])
    return ExercisePrescription(**values)


def _fixed_rir_prescription(
    prescription: ExercisePrescription,
) -> ExercisePrescription:
    return ExercisePrescription(
        sets=prescription.sets,
        rep_range=tuple(prescription.rep_range),
        weight=prescription.weight,
        target_rir=TARGET_RIR,
        progression_type=prescription.progression_type,
        weight_increment=prescription.weight_increment,
        rep_increment=prescription.rep_increment,
        max_sets=prescription.max_sets,
    )


def _new_regressor(
    config: ProgressionConfig,
    rir_model: bool = False,
) -> BayesianLinearRegression:
    prior_intercept = (
        config.rir_prior_intercept
        if rir_model
        else config.local_prior_intercept
    )

    noise_variance = (
        config.rir_noise_variance
        if rir_model
        else config.local_noise_variance
    )

    prior_covariance = np.diag(
        [
            config.local_prior_intercept_variance,
            config.local_prior_feature_variance,
            config.local_prior_feature_variance,
            config.local_prior_feature_variance,
            config.local_prior_feature_variance,
            config.local_prior_interaction_variance,
            config.local_prior_interaction_variance,
        ]
    )

    return BayesianLinearRegression(
        feature_count=7,
        prior_mean=[
            prior_intercept,
            0.0,
            0.0,
            0.0,
            0.0,
            0.0,
            0.0,
        ],
        prior_covariance=prior_covariance,
        noise_variance=noise_variance,
    )


class LocalProgressionModel:
    def __init__(
        self,
        global_model: GlobalProgressionModel,
        state_data: dict[str, Any] | None = None,
        config: ProgressionConfig | None = None,
    ):
        self.global_model = global_model
        self.config = config or global_model.config
        self.config.validate()

        if self.config is not global_model.config:
            raise ValueError(
                "LocalProgressionModel and GlobalProgressionModel "
                "must share the same ProgressionConfig instance"
            )

        self.exercises: dict[str, dict[str, Any]] = {}

        if state_data:
            self.load_state(state_data)

    def initialize_exercise(
        self,
        exercise_id: str,
        starting_prescription: ExercisePrescription,
    ) -> None:
        prescription = _fixed_rir_prescription(
            starting_prescription
        )
        prescription.validate()

        self.exercises[exercise_id] = {
            "baseline_prescription": asdict(prescription),
            "current_prescription": asdict(prescription),
            "performance_regressor": _new_regressor(
                self.config
            ).export_state(),
            "rir_regressor": _new_regressor(
                self.config,
                rir_model=True,
            ).export_state(),
            "observation_count": 0,
            "consecutive_successes": 0,
            "last_score": None,
        }

    def _get_record(self, exercise_id: str) -> dict[str, Any]:
        if exercise_id not in self.exercises:
            raise KeyError(
                f"Exercise '{exercise_id}' has not been initialized"
            )

        return self.exercises[exercise_id]

    def get_exercise_baseline(
        self,
        exercise_id: str,
    ) -> ExercisePrescription:
        record = self._get_record(exercise_id)

        return _prescription_from_dict(
            record["baseline_prescription"]
        )

    def get_current_prescription(
        self,
        exercise_id: str,
    ) -> ExercisePrescription:
        record = self._get_record(exercise_id)

        return _prescription_from_dict(
            record["current_prescription"]
        )

    def _successful_session(
        self,
        observation: ExerciseObservation,
    ) -> bool:
        prescription = observation.prescription

        if len(observation.actual_sets) < prescription.sets:
            return False

        expected_sets = observation.actual_sets[:prescription.sets]

        for result in expected_sets:
            if not result.completed:
                return False

            if result.reps < prescription.rep_range[1]:
                return False

            if result.rir < TARGET_RIR:
                return False

        return True

    def update(
        self,
        observation: ExerciseObservation,
    ) -> float:
        record = self._get_record(observation.exercise_id)

        baseline = _fixed_rir_prescription(
            observation.baseline_prescription
        )

        prescription = _fixed_rir_prescription(
            observation.prescription
        )

        normalized_observation = ExerciseObservation(
            exercise_id=observation.exercise_id,
            baseline_prescription=baseline,
            prescription=prescription,
            actual_sets=observation.actual_sets,
        )

        score = self.global_model.update(
            normalized_observation
        )

        features = progression_features(
            baseline,
            prescription,
        )

        performance_regressor = BayesianLinearRegression.from_state(
            record["performance_regressor"]
        )

        performance_regressor.update(
            features,
            score,
        )

        valid_sets = [
            result
            for result in observation.actual_sets
            if result.completed
        ]

        if valid_sets:
            mean_rir = float(
                np.mean([result.rir for result in valid_sets])
            )

            rir_safety_score = (
                1.0 if mean_rir >= TARGET_RIR else 0.0
            )

            rir_regressor = BayesianLinearRegression.from_state(
                record["rir_regressor"]
            )

            rir_regressor.update(
                features,
                rir_safety_score,
            )

            record["rir_regressor"] = (
                rir_regressor.export_state()
            )

        if self._successful_session(observation):
            record["consecutive_successes"] += 1
        else:
            record["consecutive_successes"] = 0

        record["performance_regressor"] = (
            performance_regressor.export_state()
        )

        record["observation_count"] += 1
        record["last_score"] = score
        record["current_prescription"] = asdict(prescription)

        return score

    def _candidate_prescriptions(
        self,
        current: ExercisePrescription,
    ) -> list[ExercisePrescription]:
        candidates: list[ExercisePrescription] = []

        low, high = current.rep_range
        rep_increment = current.rep_increment
        weight_increment = current.weight_increment

        for rep_step in self.config.candidate_rep_steps:
            candidate_low = max(
                1,
                low + rep_step * rep_increment,
            )

            candidate_high = max(
                candidate_low,
                high + rep_step * rep_increment,
            )

            for weight_step in self.config.candidate_weight_steps:
                candidate_weight = current.weight

                if current.progression_type == "weighted":
                    candidate_weight += (
                        weight_step * weight_increment
                    )

                elif current.progression_type == "assisted":
                    candidate_weight -= (
                        weight_step * weight_increment
                    )

                candidate_weight = max(0.0, candidate_weight)

                if current.progression_type == "bodyweight":
                    candidate_weight = current.weight

                candidate = ExercisePrescription(
                    sets=current.sets,
                    rep_range=(
                        candidate_low,
                        candidate_high,
                    ),
                    weight=round(candidate_weight, 2),
                    target_rir=TARGET_RIR,
                    progression_type=current.progression_type,
                    weight_increment=weight_increment,
                    rep_increment=rep_increment,
                    max_sets=current.max_sets,
                )

                try:
                    candidate.validate()
                except ValueError:
                    continue

                candidates.append(candidate)

        unique_candidates = {}

        for candidate in candidates:
            key = (
                candidate.sets,
                candidate.rep_range,
                candidate.weight,
            )
            unique_candidates[key] = candidate

        return list(unique_candidates.values())

    def _progression_units(
        self,
        current: ExercisePrescription,
        candidate: ExercisePrescription,
    ) -> float:
        rep_units = (
            candidate.rep_range[1] - current.rep_range[1]
        ) / max(current.rep_increment, 1)

        if current.progression_type == "weighted":
            weight_units = (
                candidate.weight - current.weight
            ) / max(current.weight_increment, 1e-6)

        elif current.progression_type == "assisted":
            weight_units = (
                current.weight - candidate.weight
            ) / max(current.weight_increment, 1e-6)

        else:
            weight_units = 0.0

        return float(rep_units + weight_units)

    def _rir_penalty(self, safety_score: float) -> float:
        if safety_score >= self.config.rir_threshold_high:
            return self.config.rir_penalty_high

        if safety_score >= self.config.rir_threshold_moderate:
            return self.config.rir_penalty_moderate

        if safety_score >= self.config.rir_threshold_low:
            return self.config.rir_penalty_low

        return self.config.rir_penalty_unsafe

    def _prescription_key(
        self,
        prescription: ExercisePrescription,
    ) -> tuple[int, tuple[int, int], float]:
        return (
            prescription.sets,
            tuple(prescription.rep_range),
            round(prescription.weight, 2),
        )

    def recommend(
        self,
        exercise_id: str,
        current_prescription: ExercisePrescription,
    ) -> ExerciseRecommendation:
        record = self._get_record(exercise_id)

        current = _fixed_rir_prescription(
            current_prescription
        )

        current.validate()

        baseline = _prescription_from_dict(
            record["baseline_prescription"]
        )

        performance_regressor = BayesianLinearRegression.from_state(
            record["performance_regressor"]
        )

        rir_regressor = BayesianLinearRegression.from_state(
            record["rir_regressor"]
        )

        candidates = self._candidate_prescriptions(current)

        if not candidates:
            raise RuntimeError("No valid prescription candidates")

        evaluated = []

        local_weight = self.config.local_weight
        global_weight = 1.0 - local_weight

        for candidate in candidates:
            features = progression_features(
                baseline,
                candidate,
            )

            local_prediction = performance_regressor.predict(
                features
            )

            global_prediction = self.global_model.predict(
                baseline,
                candidate,
            )

            rir_prediction = rir_regressor.predict(
                features
            )

            predicted_performance = (
                local_weight * local_prediction.mean
                + global_weight * global_prediction.mean
            )

            prediction_uncertainty = (
                local_weight * local_prediction.standard_deviation
                + global_weight * global_prediction.standard_deviation
            )

            progression_units = self._progression_units(
                current,
                candidate,
            )

            progression_bonus = (
                self.config.progression_bonus
                * min(
                    max(progression_units, 0.0),
                    self.config.progression_bonus_cap,
                )
            )

            uncertainty_penalty = (
                self.config.uncertainty_penalty
                * prediction_uncertainty
            )

            rir_safety_probability = float(
                np.clip(rir_prediction.mean, 0.0, 1.0)
            )

            rir_penalty = self._rir_penalty(
                rir_safety_probability
            )

            utility = (
                predicted_performance
                + progression_bonus
                - uncertainty_penalty
                - rir_penalty
            )

            evaluated.append({
                "candidate": candidate,
                "utility": float(utility),
                "performance": float(predicted_performance),
                "uncertainty": float(prediction_uncertainty),
                "rir_safety": rir_safety_probability,
                "progression_units": progression_units,
            })

        current_key = self._prescription_key(current)

        current_index = next(
            (
                index
                for index, item in enumerate(evaluated)
                if self._prescription_key(item["candidate"]) == current_key
            ),
            None,
        )

        if current_index is None:
            raise RuntimeError(
                "Current prescription was not included in candidate set"
            )

        best_index = max(
            range(len(evaluated)),
            key=lambda index: evaluated[index]["utility"],
        )

        best_entry = evaluated[best_index]

        if (
            best_entry["progression_units"] > 0
            and best_entry["rir_safety"]
            < self.config.rir_safety_fallback_threshold
        ):
            best_index = current_index
            best_entry = evaluated[best_index]

        selected = best_entry["candidate"]

        utilities = np.array(
            [item["utility"] for item in evaluated],
            dtype=float,
        )

        shifted = utilities - np.max(utilities)

        probabilities = np.exp(
            shifted / self.config.softmax_temperature
        )

        probabilities /= np.sum(probabilities)

        selected_confidence = float(
            probabilities[best_index]
        )

        return ExerciseRecommendation(
            exercise_id=exercise_id,
            recommended_sets=selected.sets,
            recommended_rep_range=selected.rep_range,
            recommended_reps=selected.rep_range[1],
            recommended_weight=selected.weight,
            target_rir=TARGET_RIR,
            sets_confidence=selected_confidence,
            reps_confidence=selected_confidence,
            weight_confidence=selected_confidence,
            predicted_performance=best_entry["performance"],
            prediction_standard_deviation=best_entry["uncertainty"],
            candidate_count=len(candidates),
        )

    def export_state(self) -> dict[str, Any]:
        return {
            "version": LOCAL_STATE_VERSION,
            "exercises": self.exercises,
        }

    def load_state(self, state: dict[str, Any]) -> None:
        self.exercises = state.get("exercises", {})

        for record in self.exercises.values():
            baseline = _prescription_from_dict(
                record["baseline_prescription"]
            )

            current = _prescription_from_dict(
                record["current_prescription"]
            )

            record["baseline_prescription"] = asdict(
                _fixed_rir_prescription(baseline)
            )

            record["current_prescription"] = asdict(
                _fixed_rir_prescription(current)
            )

            if "performance_regressor" not in record:
                record["performance_regressor"] = (
                    _new_regressor(
                        self.config
                    ).export_state()
                )

            if "rir_regressor" not in record:
                record["rir_regressor"] = (
                    _new_regressor(
                        self.config,
                        rir_model=True,
                    ).export_state()
                )

            record.setdefault("observation_count", 0)
            record.setdefault("consecutive_successes", 0)
            record.setdefault("last_score", None)


class ProgressionSystem:
    def __init__(
        self,
        state_data: dict[str, Any] | None = None,
        config: ProgressionConfig | None = None,
    ):
        self.config = config or ProgressionConfig()
        self.config.validate()

        self.global_model = GlobalProgressionModel(
            config=self.config
        )

        self.local_model = LocalProgressionModel(
            self.global_model,
            config=self.config,
        )

        if state_data:
            if "global" in state_data:
                self.global_model.load_state(
                    state_data["global"]
                )

            if "local" in state_data:
                self.local_model.load_state(
                    state_data["local"]
                )

    def initialize_exercise(
        self,
        exercise_id: str,
        starting_prescription: ExercisePrescription,
    ) -> None:
        self.local_model.initialize_exercise(
            exercise_id,
            starting_prescription,
        )

    def record_completed_exercise(
        self,
        observation: ExerciseObservation,
    ) -> float:
        return self.local_model.update(observation)

    def recommend(
        self,
        exercise_id: str,
        current_prescription: ExercisePrescription,
    ) -> ExerciseRecommendation:
        return self.local_model.recommend(
            exercise_id,
            current_prescription,
        )

    def export_state(self) -> dict[str, Any]:
        return {
            "global": self.global_model.export_state(),
            "local": self.local_model.export_state(),
        }
