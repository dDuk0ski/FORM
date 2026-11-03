"""Walk-forward evaluation of the TDEE model on synthetic users.

At each weekly checkpoint, estimate TDEE from the data so far and score it two ways:

- Next-week weight change: predict the next 7 days of weight change from that week's logged
  intake, (logged kcal - 7 x TDEE) / 7700, and compare with the user's true change. Days in the
  next week logged far below the user's normal are treated as unknown for every method alike, so
  the comparison measures the estimate rather than how the next week happened to be logged.
- TDEE error: the estimate against the user's true TDEE in logged calories (true TDEE times the
  fraction they log), the number the targets are built from.

Methods: the static formula, version 1 (least squares, every logged day counts), version 2
(Huber slope, incomplete days left out), and each version 2 change on its own.

Run: python scripts/evaluate_energy.py [--users 300] [--days 84] [--seed 7] [--realistic]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from form_ml.energy import INCOMPLETE_FRACTION, KCAL_PER_KG, estimate_tdee, formula_tdee  # noqa: E402
from form_ml.synthetic import Realism, population  # noqa: E402

# name -> (slope method, leave out incomplete days); None = the static formula
METHODS: dict[str, tuple[str, bool] | None] = {
    "formula": None,
    "v1": ("regression", False),
    "filter only": ("regression", True),
    "robust only": ("robust", False),
    "v2": ("robust", True),
}


def predicted_change(tdee: float, next_week: list[float | None], usual: float | None) -> float:
    known = [k for k in next_week if k is not None and (usual is None or k >= INCOMPLETE_FRACTION * usual)]
    week_intake = float(np.mean(known)) * 7 if known else 7 * tdee
    return (week_intake - 7 * tdee) / KCAL_PER_KG


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--users", type=int, default=300)
    parser.add_argument("--days", type=int, default=84)
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--realistic", action="store_true", help="forgotten meals, water, weekends, gaps")
    args = parser.parse_args()

    runs = population(args.users, args.days, args.seed, realism=Realism() if args.realistic else None)
    checkpoints = list(range(7, args.days - 7 + 1, 7))
    weight_err: dict[str, dict[int, list[float]]] = {m: {c: [] for c in checkpoints} for m in METHODS}
    tdee_err: dict[str, dict[int, list[float]]] = {m: {c: [] for c in checkpoints} for m in METHODS}

    for run in runs:
        profile = run.user.profile
        logged_share = 1 - run.user.logging_bias
        for c in checkpoints:
            history = run.records[:c]
            # Weight after day c+6's intake minus weight before day c's intake.
            end = run.true_weight_kg[c + 6]
            end += (run.true_intake_kcal[c + 6] - run.true_tdee_kcal[c + 6]) / KCAL_PER_KG
            actual = end - run.true_weight_kg[c]
            past = [r.kcal_in for r in history if r.kcal_in is not None]
            usual = float(np.median(past)) if len(past) >= 7 else None
            next_week = [r.kcal_in for r in run.records[c : c + 7]]
            true_logged_tdee = run.true_tdee_kcal[c - 1] * logged_share
            for name, spec in METHODS.items():
                if spec is None:
                    tdee = formula_tdee(profile)
                else:
                    method, filter_incomplete = spec
                    tdee = estimate_tdee(profile, history, method=method, filter_incomplete=filter_incomplete).tdee_kcal
                weight_err[name][c].append(abs(predicted_change(tdee, next_week, usual) - actual))
                tdee_err[name][c].append(abs(tdee - true_logged_tdee))

    kind = "realistic" if args.realistic else "clean"
    print(f"{args.users} {kind} synthetic users, {args.days} days, seed {args.seed}")
    print("MAE of predicted next-week weight change (kg), by days of history:\n")
    print(f"{'days':>5} " + " ".join(f"{m:>12}" for m in METHODS))
    for c in checkpoints:
        print(f"{c:>5} " + " ".join(f"{np.mean(weight_err[m][c]):>12.3f}" for m in METHODS))
    late = [c for c in checkpoints if c >= 28]
    print("\nFrom day 28 on:")
    for m in METHODS:
        w = [e for c in late for e in weight_err[m][c]]
        t = [e for c in late for e in tdee_err[m][c]]
        print(f"  {m:<12} weight MAE {np.mean(w):.3f} kg/week   TDEE MAE {np.mean(t):>4.0f} kcal/day")


if __name__ == "__main__":
    main()
