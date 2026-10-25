import json
import random
from pathlib import Path

from progression_model import (
    ACTIONS,
    ProgressionModel,
    ProgressionRecommendation,
    SetResult,
    create_observation,
)


EXERCISE_ID = "bench_press"
EXERCISE_NAME = "Barbell Bench Press"

STARTING_WEIGHT = 180.0
WEIGHT_INCREMENT = 5.0

DEFAULT_REP_RANGE = (8, 10)
DEFAULT_TARGET_RIR = 2.0
DEFAULT_SETS = 3

DEFAULT_WEEKS = 12
DEFAULT_DAYS_PER_WEEK = 3

STATE_FILE = "bayesian_state.json"


def print_header(title):
    print()
    print("=" * 70)
    print(title)
    print("=" * 70)


def print_workout(week, day, weight, rep_range, sets, target_rir):
    print()
    print(f"Week {week} | Day {day}")
    print("-" * 70)
    print(f"Exercise:      {EXERCISE_NAME}")
    print(f"Weight:        {weight:.1f} lb")
    print(f"Rep Range:     {rep_range[0]}-{rep_range[1]}")
    print(f"Sets:          {sets}")
    print(f"Target RIR:    {target_rir:.1f}")


def print_prediction(recommendation):
    print()
    print("Next Recommendation")
    print("-" * 70)
    print(f"Decision:              {recommendation.decision}")
    print(f"Confidence:            {recommendation.confidence:.3f}")
    print(f"Recommended Weight:    {recommendation.recommended_weight:.1f} lb")
    print(
        f"Recommended Rep Range: "
        f"{recommendation.recommended_rep_range[0]}-"
        f"{recommendation.recommended_rep_range[1]}"
    )
    print(f"Probability of Success: {recommendation.probability_of_success:.3f}")
    print(f"Reason:                {recommendation.reason}")


def print_bayesian_state(model, exercise_id=EXERCISE_ID):
    state = model.get_state(exercise_id)

    print()
    print("Bayesian State")
    print("-" * 70)

    for action in ACTIONS:
        belief = state[action]

        print(
            f"{action:<18} "
            f"P(success)={belief['success_probability']:.3f} "
            f"alpha={belief['alpha']:.3f} "
            f"beta={belief['beta']:.3f} "
            f"evidence={belief['evidence']:.3f}"
        )


def print_update_result(result):
    if result is None:
        print()
        print("Bayesian Update")
        print("-" * 70)
        print("No action was tested. Bayesian state unchanged.")
        return

    print()
    print("Bayesian Update")
    print("-" * 70)
    print(f"Tested Action:        {result['tested_action']}")
    print(f"Outcome:              {result['outcome']}")
    print(f"Success Score:        {result['success_score']:.3f}")
    print(f"Posterior Probability:{result['posterior_probability']:.3f}")


def calculate_average_rir(actual_sets):
    if not actual_sets:
        return 0.0

    return sum(result.rir for result in actual_sets) / len(actual_sets)


def calculate_average_reps(actual_sets):
    if not actual_sets:
        return 0.0

    return sum(result.reps for result in actual_sets) / len(actual_sets)


def generate_random_performance(
    rep_range,
    target_rir,
    sets,
    weight,
):
    outcomes = [
        ("excellent", 0.15),
        ("good", 0.40),
        ("mediocre", 0.25),
        ("poor", 0.15),
        ("failure", 0.05),
    ]

    outcome = random.choices(
        [item[0] for item in outcomes],
        weights=[item[1] for item in outcomes],
        k=1,
    )[0]

    min_reps, max_reps = rep_range

    actual_sets = []

    for _ in range(sets):
        if outcome == "excellent":
            reps = random.randint(max_reps, max_reps + 2)
            rir = random.uniform(target_rir + 0.5, target_rir + 2.0)

        elif outcome == "good":
            reps = random.randint(min_reps, max_reps)
            rir = random.uniform(target_rir - 0.25, target_rir + 1.0)

        elif outcome == "mediocre":
            reps = random.randint(
                max(min_reps - 1, 1),
                max_reps,
            )
            rir = random.uniform(
                max(target_rir - 1.0, 0.0),
                target_rir + 0.5,
            )

        elif outcome == "poor":
            reps = random.randint(
                max(min_reps - 2, 1),
                max(min_reps, 1),
            )
            rir = random.uniform(
                0.0,
                max(target_rir - 0.5, 0.0),
            )

        else:
            reps = random.randint(
                max(min_reps - 3, 1),
                max(min_reps - 1, 1),
            )
            rir = random.uniform(0.0, 0.5)

        actual_sets.append(
            SetResult(
                weight=weight,
                reps=reps,
                rir=round(rir, 1),
            )
        )

    return actual_sets


def build_observation(
    weight,
    rep_range,
    target_rir,
    recommended_action,
    actual_sets,
):
    return create_observation(
        exercise_id=EXERCISE_ID,
        previous_weight=weight,
        previous_rep_range=rep_range,
        previous_target_rir=target_rir,
        recommended_action=recommended_action,
        actual_sets=actual_sets,
        weight_increment=WEIGHT_INCREMENT,
    )


def build_next_workout(
    recommendation,
    sets,
    target_rir,
):
    return {
        "weight": recommendation.recommended_weight,
        "rep_range": recommendation.recommended_rep_range,
        "sets": sets,
        "target_rir": target_rir,
    }


def reset_simulation_state():
    state_path = Path(STATE_FILE)

    if state_path.exists():
        state_path.unlink()


def run_random_simulation(
    weeks,
    days_per_week,
    reset_state=True,
):
    if reset_state:
        reset_simulation_state()

    model = ProgressionModel(
        state_file=STATE_FILE,
        weight_increment=WEIGHT_INCREMENT,
        minimum_confidence=0.50,
    )

    total_workouts = weeks * days_per_week
    workout_number = 0

    current_weight = STARTING_WEIGHT
    current_rep_range = DEFAULT_REP_RANGE
    current_sets = DEFAULT_SETS
    current_target_rir = DEFAULT_TARGET_RIR
    previous_recommendation = None

    history = []

    print_header("LONG-TERM RANDOM PROGRESSION SIMULATION")

    print(f"Weeks:             {weeks}")
    print(f"Days per week:     {days_per_week}")
    print(f"Total workouts:    {total_workouts}")
    print(f"Starting weight:   {STARTING_WEIGHT:.1f} lb")
    print(f"Starting reps:     {DEFAULT_REP_RANGE[0]}-{DEFAULT_REP_RANGE[1]}")
    print(f"Sets:              {DEFAULT_SETS}")
    print(f"Target RIR:        {DEFAULT_TARGET_RIR:.1f}")

    for week in range(1, weeks + 1):
        for day in range(1, days_per_week + 1):
            workout_number += 1

            print_header(
                f"WORKOUT {workout_number}/{total_workouts}"
            )

            print_workout(
                week=week,
                day=day,
                weight=current_weight,
                rep_range=current_rep_range,
                sets=current_sets,
                target_rir=current_target_rir,
            )

            actual_sets = generate_random_performance(
                rep_range=current_rep_range,
                target_rir=current_target_rir,
                sets=current_sets,
                weight=current_weight,
            )

            average_reps = calculate_average_reps(actual_sets)
            average_rir = calculate_average_rir(actual_sets)

            print()
            print("Simulated Performance")
            print("-" * 70)

            for index, result in enumerate(actual_sets, start=1):
                print(
                    f"Set {index}: "
                    f"{result.weight:.1f} lb x "
                    f"{result.reps} reps "
                    f"@ RIR {result.rir:.1f}"
                )

            print()
            print(f"Average Reps: {average_reps:.2f}")
            print(f"Average RIR:  {average_rir:.2f}")

            if previous_recommendation is None:
                recommended_action = None
            else:
                recommended_action = previous_recommendation.decision

            observation = build_observation(
                weight=current_weight,
                rep_range=current_rep_range,
                target_rir=current_target_rir,
                recommended_action=recommended_action,
                actual_sets=actual_sets,
            )

            update_result = model.update(observation)

            print_update_result(update_result)

            recommendation = model.recommend(observation)

            print_prediction(recommendation)

            history.append(
                {
                    "workout_number": workout_number,
                    "week": week,
                    "day": day,
                    "exercise_id": EXERCISE_ID,
                    "exercise_name": EXERCISE_NAME,
                    "planned": {
                        "weight": current_weight,
                        "rep_range": list(current_rep_range),
                        "sets": current_sets,
                        "target_rir": current_target_rir,
                    },
                    "actual": {
                        "sets": [
                            {
                                "weight": result.weight,
                                "reps": result.reps,
                                "rir": result.rir,
                            }
                            for result in actual_sets
                        ],
                        "average_reps": round(average_reps, 3),
                        "average_rir": round(average_rir, 3),
                    },
                    "tested_action": recommended_action,
                    "update": update_result,
                    "recommendation": {
                        "decision": recommendation.decision,
                        "confidence": recommendation.confidence,
                        "recommended_weight": recommendation.recommended_weight,
                        "recommended_rep_range": list(
                            recommendation.recommended_rep_range
                        ),
                        "probability_of_success": (
                            recommendation.probability_of_success
                        ),
                        "probabilities": recommendation.probabilities,
                        "reason": recommendation.reason,
                    },
                }
            )

            current_workout = build_next_workout(
                recommendation=recommendation,
                sets=current_sets,
                target_rir=current_target_rir,
            )

            current_weight = current_workout["weight"]
            current_rep_range = current_workout["rep_range"]

            previous_recommendation = recommendation

    print_header("SIMULATION COMPLETE")

    print(f"Total weeks:        {weeks}")
    print(f"Days per week:      {days_per_week}")
    print(f"Total workouts:     {total_workouts}")
    print(f"Starting weight:    {STARTING_WEIGHT:.1f} lb")
    print(f"Final weight:       {current_weight:.1f} lb")
    print(
        f"Weight change:      "
        f"{current_weight - STARTING_WEIGHT:+.1f} lb"
    )

    print_bayesian_state(model)

    save_simulation_history(history)

    return model, history


def save_simulation_history(history):
    output_directory = Path("simulation_results")
    output_directory.mkdir(exist_ok=True)

    output_file = output_directory / "progression_simulation.json"

    with output_file.open("w", encoding="utf-8") as file:
        json.dump(history, file, indent=2)

    print()
    print(f"Simulation history saved to:")
    print(output_file.resolve())


def get_positive_int(prompt, default):
    while True:
        value = input(f"{prompt} [{default}]: ").strip()

        if not value:
            return default

        try:
            value = int(value)

            if value <= 0:
                raise ValueError

            return value

        except ValueError:
            print("Please enter a positive whole number.")


def get_days_per_week():
    while True:
        value = get_positive_int(
            "How many workout days per week?",
            DEFAULT_DAYS_PER_WEEK,
        )

        if 1 <= value <= 7:
            return value

        print("Days per week must be between 1 and 7.")


def choose_reset_state():
    while True:
        value = input(
            "Reset Bayesian state before simulation? [Y/n]: "
        ).strip().lower()

        if not value or value == "y":
            return True

        if value == "n":
            return False

        print("Please enter Y or N.")


def run_custom_simulation(
    weeks,
    days_per_week,
    reset_state=True,
):
    if reset_state:
        reset_simulation_state()

    model = ProgressionModel(
        state_file=STATE_FILE,
        weight_increment=WEIGHT_INCREMENT,
        minimum_confidence=0.50,
    )

    starting_weight = float(
        input(
            f"Starting weight [{STARTING_WEIGHT}]: "
        ).strip()
        or STARTING_WEIGHT
    )

    sets = get_positive_int(
        "Number of sets per workout",
        DEFAULT_SETS,
    )

    rep_min = get_positive_int(
        "Minimum reps",
        DEFAULT_REP_RANGE[0],
    )

    rep_max = get_positive_int(
        "Maximum reps",
        DEFAULT_REP_RANGE[1],
    )

    if rep_max < rep_min:
        rep_min, rep_max = rep_max, rep_min

    target_rir = float(
        input(
            f"Target RIR [{DEFAULT_TARGET_RIR}]: "
        ).strip()
        or DEFAULT_TARGET_RIR
    )

    current_weight = starting_weight
    current_rep_range = (rep_min, rep_max)
    current_sets = sets
    current_target_rir = target_rir
    previous_recommendation = None

    total_workouts = weeks * days_per_week

    print_header("CUSTOM LONG-TERM SIMULATION")

    print(f"Weeks:             {weeks}")
    print(f"Days per week:     {days_per_week}")
    print(f"Total workouts:    {total_workouts}")

    history = []

    workout_number = 0

    for week in range(1, weeks + 1):
        for day in range(1, days_per_week + 1):
            workout_number += 1

            print_header(
                f"WORKOUT {workout_number}/{total_workouts}"
            )

            print_workout(
                week=week,
                day=day,
                weight=current_weight,
                rep_range=current_rep_range,
                sets=current_sets,
                target_rir=current_target_rir,
            )

            actual_sets = []

            print()

            for set_number in range(1, current_sets + 1):
                while True:
                    try:
                        reps = int(
                            input(
                                f"Set {set_number} reps: "
                            ).strip()
                        )

                        if reps < 0:
                            raise ValueError

                        break

                    except ValueError:
                        print("Enter a valid number of reps.")

                while True:
                    try:
                        rir = float(
                            input(
                                f"Set {set_number} RIR: "
                            ).strip()
                        )

                        if rir < 0:
                            raise ValueError

                        break

                    except ValueError:
                        print("Enter a valid RIR.")

                actual_sets.append(
                    SetResult(
                        weight=current_weight,
                        reps=reps,
                        rir=rir,
                    )
                )

            if previous_recommendation is None:
                recommended_action = None
            else:
                recommended_action = previous_recommendation.decision

            observation = build_observation(
                weight=current_weight,
                rep_range=current_rep_range,
                target_rir=current_target_rir,
                recommended_action=recommended_action,
                actual_sets=actual_sets,
            )

            update_result = model.update(observation)

            print_update_result(update_result)

            recommendation = model.recommend(observation)

            print_prediction(recommendation)

            history.append(
                {
                    "workout_number": workout_number,
                    "week": week,
                    "day": day,
                    "exercise_id": EXERCISE_ID,
                    "planned": {
                        "weight": current_weight,
                        "rep_range": list(current_rep_range),
                        "sets": current_sets,
                        "target_rir": current_target_rir,
                    },
                    "actual": {
                        "sets": [
                            {
                                "weight": result.weight,
                                "reps": result.reps,
                                "rir": result.rir,
                            }
                            for result in actual_sets
                        ]
                    },
                    "tested_action": recommended_action,
                    "update": update_result,
                    "recommendation": {
                        "decision": recommendation.decision,
                        "confidence": recommendation.confidence,
                        "recommended_weight": recommendation.recommended_weight,
                        "recommended_rep_range": list(
                            recommendation.recommended_rep_range
                        ),
                        "probability_of_success": (
                            recommendation.probability_of_success
                        ),
                        "probabilities": recommendation.probabilities,
                        "reason": recommendation.reason,
                    },
                }
            )

            current_weight = recommendation.recommended_weight
            current_rep_range = recommendation.recommended_rep_range

            previous_recommendation = recommendation

    print_header("CUSTOM SIMULATION COMPLETE")

    print(f"Total weeks:        {weeks}")
    print(f"Days per week:      {days_per_week}")
    print(f"Total workouts:     {total_workouts}")
    print(f"Starting weight:    {starting_weight:.1f} lb")
    print(f"Final weight:       {current_weight:.1f} lb")
    print(
        f"Weight change:      "
        f"{current_weight - starting_weight:+.1f} lb"
    )

    print_bayesian_state(model)

    save_simulation_history(history)

    return model, history


def choose_mode():
    print_header("PROGRESSION SIMULATOR")

    print("1. Random long-term simulation")
    print("2. Custom long-term simulation")
    print("3. Exit")

    while True:
        choice = input("\nSelect mode: ").strip()

        if choice in {"1", "2", "3"}:
            return choice

        print("Please select 1, 2, or 3.")


def main():
    mode = choose_mode()

    if mode == "3":
        print("Exiting.")
        return

    weeks = get_positive_int(
        "How many weeks should the simulation run?",
        DEFAULT_WEEKS,
    )

    days_per_week = get_days_per_week()

    reset_state = choose_reset_state()

    if mode == "1":
        run_random_simulation(
            weeks=weeks,
            days_per_week=days_per_week,
            reset_state=reset_state,
        )

    elif mode == "2":
        run_custom_simulation(
            weeks=weeks,
            days_per_week=days_per_week,
            reset_state=reset_state,
        )


if __name__ == "__main__":
    main()
