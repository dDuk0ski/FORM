"""Walk-forward evaluation of the TDEE model on synthetic users.

At each weekly checkpoint, estimate TDEE from the data so far and score it two ways:

- Next-week weight change: predict the next 7 days of tissue change from that week's logged
  intake, (logged kcal - 7 x TDEE) / logged kcal per kg, and compare with the user's true change.
  Days in the next week logged far below the user's normal are treated as unknown for every
  method alike, so the comparison measures the estimate rather than how the week was logged.
- TDEE error: the estimate against the user's true TDEE in logged calories (true TDEE times the
  share of food they were logging that day), the number the targets are built from.

Methods: the static formula, version 1 (least squares, every logged day counts), version 2
(Huber slope, incomplete days left out, real-calorie units, 7700 kcal/kg), version 3 (version 2
in logged units with body-fat energy density), and each version 3 change on its own.

Run: python scripts/evaluate_energy.py [--users 300] [--days 84] [--seed 7] [--realistic] [--physiology]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from form_ml.energy import INCOMPLETE_FRACTION, estimate_tdee, formula_tdee, logged_kcal_per_kg  # noqa: E402
from form_ml.synthetic import Physiology, Realism, population  # noqa: E402

V2 = dict(logged_share=1.0, body_fat_density=False)
# name -> estimate_tdee options; None = the static formula
METHODS: dict[str, dict | None] = {
    "formula": None,
    "v1": dict(method="regression", filter_incomplete=False, **V2),
    "v2": V2,
    "units only": dict(body_fat_density=False),
    "density only": dict(logged_share=1.0),
    "v3": {},
}


def predicted_change(tdee: float, next_week: list[float | None], usual: float | None, kcal_per_kg: float) -> float:
    known = [k for k in next_week if k is not None and (usual is None or k >= INCOMPLETE_FRACTION * usual)]
    week_intake = float(np.mean(known)) * 7 if known else 7 * tdee
    return (week_intake - 7 * tdee) / kcal_per_kg


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--users", type=int, default=300)
    parser.add_argument("--days", type=int, default=84)
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--realistic", action="store_true", help="forgotten meals, water, weekends, gaps")
    parser.add_argument("--physiology", action="store_true",
                        help="body-fat energy density, glycogen water, menstrual cycle, adaptation, logging drift")
    args = parser.parse_args()

    runs = population(args.users, args.days, args.seed,
                      realism=Realism() if args.realistic else None,
                      physiology=Physiology() if args.physiology else None)
    checkpoints = list(range(7, args.days - 7, 7))   # each needs a true weight 7 days later
    weight_err: dict[str, dict[int, list[float]]] = {m: {c: [] for c in checkpoints} for m in METHODS}
    tdee_err: dict[str, dict[int, list[float]]] = {m: {c: [] for c in checkpoints} for m in METHODS}

    for run in runs:
        profile = run.user.profile
        for c in checkpoints:
            history = run.records[:c]
            actual = run.true_weight_kg[c + 7] - run.true_weight_kg[c]
            past = [r.kcal_in for r in history if r.kcal_in is not None]
            usual = float(np.median(past)) if len(past) >= 7 else None
            next_week = [r.kcal_in for r in run.records[c : c + 7]]
            true_logged_tdee = run.true_tdee_kcal[c - 1] * run.true_logged_share[c - 1]
            for name, options in METHODS.items():
                if options is None:
                    tdee = formula_tdee(profile)
                    per_kg = logged_kcal_per_kg(profile, **V2)
                else:
                    est = estimate_tdee(profile, history, **options)
                    tdee = est.tdee_kcal
                    share = options.get("logged_share", None)
                    density = options.get("body_fat_density", True)
                    per_kg = logged_kcal_per_kg(profile, est.trend_weight_kg, body_fat_density=density,
                                                **({} if share is None else {"logged_share": share}))
                weight_err[name][c].append(abs(predicted_change(tdee, next_week, usual, per_kg) - actual))
                tdee_err[name][c].append(abs(tdee - true_logged_tdee))

    kind = "realistic" if args.realistic else "clean"
    if args.physiology:
        kind += " + physiology"
    print(f"{args.users} {kind} synthetic users, {args.days} days, seed {args.seed}")
    print("MAE of the TDEE estimate (kcal/day, logged units), by days of history:\n")
    print(f"{'days':>5} " + " ".join(f"{m:>12}" for m in METHODS))
    for c in checkpoints:
        print(f"{c:>5} " + " ".join(f"{np.mean(tdee_err[m][c]):>12.0f}" for m in METHODS))
    for label, keep in [("Days 7-21", lambda c: c <= 21), ("From day 28 on", lambda c: c >= 28)]:
        sel = [c for c in checkpoints if keep(c)]
        print(f"\n{label}:")
        for m in METHODS:
            w = [e for c in sel for e in weight_err[m][c]]
            t = [e for c in sel for e in tdee_err[m][c]]
            print(f"  {m:<12} weight MAE {np.mean(w):.3f} kg/week   TDEE MAE {np.mean(t):>4.0f} kcal/day")


if __name__ == "__main__":
    main()
