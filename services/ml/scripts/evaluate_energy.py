"""Walk-forward evaluation of the TDEE model on synthetic users.

At each weekly checkpoint, estimate TDEE from the data so far, then predict the next 7 days of
weight change from that week's logged intake: (logged kcal - 7 x TDEE) / 7700. Compare against
the user's true weight change. The baseline is the static formula, which never adapts.

Run: python scripts/evaluate_energy.py [--users 300] [--days 84] [--seed 7]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from form_ml.energy import KCAL_PER_KG, estimate_tdee, formula_tdee  # noqa: E402
from form_ml.synthetic import population  # noqa: E402

METHODS = ("formula", "trend", "regression")


def predicted_change(tdee: float, logged_next_week: list[float | None]) -> float:
    known = [k for k in logged_next_week if k is not None]
    week_intake = float(np.mean(known)) * 7 if known else 7 * tdee
    return (week_intake - 7 * tdee) / KCAL_PER_KG


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--users", type=int, default=300)
    parser.add_argument("--days", type=int, default=84)
    parser.add_argument("--seed", type=int, default=7)
    args = parser.parse_args()

    runs = population(args.users, args.days, args.seed)
    checkpoints = list(range(7, args.days - 7 + 1, 7))
    errors: dict[str, dict[int, list[float]]] = {m: {c: [] for c in checkpoints} for m in METHODS}

    for run in runs:
        profile = run.user.profile
        for c in checkpoints:
            history = run.records[:c]
            # Weight after day c+6's intake minus weight before day c's intake.
            end = run.true_weight_kg[c + 6]
            end += (run.true_intake_kcal[c + 6] - run.true_tdee_kcal[c + 6]) / KCAL_PER_KG
            actual = end - run.true_weight_kg[c]
            next_week = [r.kcal_in for r in run.records[c : c + 7]]
            estimates = {
                "formula": formula_tdee(profile),
                "trend": estimate_tdee(profile, history, method="trend").tdee_kcal,
                "regression": estimate_tdee(profile, history, method="regression").tdee_kcal,
            }
            for m, tdee in estimates.items():
                errors[m][c].append(abs(predicted_change(tdee, next_week) - actual))

    print(f"{args.users} synthetic users, {args.days} days, seed {args.seed}")
    print("MAE of predicted next-week weight change (kg), by days of history:\n")
    print(f"{'days':>5} " + " ".join(f"{m:>11}" for m in METHODS))
    for c in checkpoints:
        row = " ".join(f"{np.mean(errors[m][c]):>11.3f}" for m in METHODS)
        print(f"{c:>5} {row}")
    late = [c for c in checkpoints if c >= 28]
    print("\nFrom day 28 on:")
    for m in METHODS:
        values = [e for c in late for e in errors[m][c]]
        print(f"  {m:<11} MAE {np.mean(values):.3f} kg/week")


if __name__ == "__main__":
    main()
