# FORM ML

Python 3.12. Models for the ML service, starting with the nutrition side. The FastAPI app that
serves them is not here yet; these modules are plain functions it will call.

## Setup

```bash
cd services/ml
python3.12 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/pytest
```

## What is here

| Module | What it does |
| --- | --- |
| `form_ml/energy.py` | Adaptive TDEE in logged calories: Mifflin-St Jeor prior, smoothed trend weight, observed burn from logged intake and a Huber weight slope converted at the user's body-fat energy density, blended from formula to observed over 7-21 logged days; days logged far below normal are left out |
| `form_ml/targets.py` | Daily kcal, protein, carb and fat targets from the TDEE estimate and the user's goal, plus the one-line rationale |
| `form_ml/synthetic.py` | Synthetic users with a known true TDEE, logging bias, noisy weigh-ins and missed days; `Realism` adds forgotten meals, weekends, water retention and multi-day gaps; `Physiology` adds what real bodies do that the model does not assume |
| `scripts/evaluate_energy.py` | Walk-forward evaluation against the static formula |

These map onto `GET /today`: `daily_targets()` returns `targets`, `tdee_estimate`,
`target_source` and `rationale`. `consumed` comes from the day's food logs and
`remaining = targets - consumed`.

## Current results

```bash
.venv/bin/python scripts/evaluate_energy.py                            # clean synthetic users
.venv/bin/python scripts/evaluate_energy.py --realistic                # messy logs
.venv/bin/python scripts/evaluate_energy.py --realistic --physiology   # messy logs, real bodies
```

`--physiology` drops the model's own assumptions from the simulated bodies: a kilogram of weight
change carries the Forbes/Hall energy density for that person's body fat instead of 7700 kcal,
a deficit drains about 1.5 kg of glycogen-bound water in its first days, women carry about
0.5 kg of extra water around menstruation, burn drops 150 kcal/day over the first three weeks
of a deficit, and the share of food a user logs drifts. Before this the synthetic users obeyed
exactly the rules the model assumed, so the evaluation could not see those rules fail.

300 synthetic users over 84 days. Error of the TDEE estimate against the user's true burn in
logged calories (kcal/day, MAE), the number targets are built from. Seed 7; seed 11 is within
about 10 kcal/day everywhere.

| Estimate | Clean, days 7-21 | Clean, day 28+ | Realistic, day 28+ | Physiology, day 28+ | Realistic + physiology, days 7-21 | Realistic + physiology, day 28+ |
| --- | --- | --- | --- | --- | --- | --- |
| Static formula (baseline) | 347 | 355 | 342 | 423 | 393 | 418 |
| Version 1 | 243 | 106 | 215 | 176 | 357 | 240 |
| Version 2 | 246 | 111 | 190 | 183 | 363 | 220 |
| Version 3 (default) | **170** | **88** | **152** | **107** | **227** | **158** |

Version 3 fixes two things:

- **Units.** The estimate is meant to be in logged calories, but version 2 subtracted the energy
  stored in body mass in real calories, and its formula prior was in real calories too. For
  someone who under-logs, that put the estimate high by roughly (share not logged) x deficit
  once adaptive, and (share not logged) x TDEE while still on the formula. Both terms are now
  scaled by `LOGGED_SHARE_PRIOR` (0.875; doubly labelled water studies find people log less
  than they eat). Most of the early-days gain comes from this.
- **Energy density.** Leaner people lose and gain proportionally more lean tissue, which holds
  far less energy than fat, so a flat 7700 kcal/kg overstates the energy in their weight
  change (median about 6,800 kcal/kg across the synthetic users). Body fat is estimated from
  BMI, age and sex (Deurenberg 1991) and split with the Forbes curve (Hall 2008). The 1%-a-week
  loss cap uses the same density.

Each fix alone gets part of the way (`units only` and `density only` in the script output);
together they are better than either.

The script also predicts next week's weight change from next week's logged intake. On that
measure version 3 is slightly worse than version 2 (0.131 vs 0.115 kg/week clean, day 28+;
0.242 vs 0.224 realistic + physiology). That is not better physics in version 2: its larger
divisor (7700 in logged calories) shrinks the noisy next-week intake term, and plugging in each
user's true logged share makes the forecast worse still. The app does not make this forecast,
so the burn error is the number to watch.

Closed loop (`tests/test_closed_loop.py`): synthetic users who eat at the model's targets with a
lose goal now lose a median 0.71% of body weight a week (5th-95th percentile 0.35-0.95%),
against 0.54% with version 2. Version 2 was delivering less than the planned 500 kcal deficit
because its estimate ran high for dieters.

What still goes wrong: the glycogen water lost when a diet starts reads as fat loss, so for a
user who starts dieting on day one the estimate runs high through week four. The days 7-21
column is mostly this.

Caveat: even the physiology users are a model of a body. `LOGGED_SHARE_PRIOR` is set near the
synthetic users' average, so its fit here is partly by construction; if the true share differs,
the error grows by about (difference) x TDEE early on and (difference) x deficit later, which
stays no worse than version 2 while the prior is within a factor of two. The team's own logs
are the real test.

## Next steps

- State-space (Kalman) model with fat, lean and a fast glycogen-water state, so the diet-start
  water drop is not read as fat loss; it would also report uncertainty alongside the estimate
  and handle missed days naturally
- Learn each user's logged share from how weight responds to changes in their logged intake,
  instead of one population prior
- Per-user tuning of the 7-21 day ramp from how noisy their weigh-ins are
- Training-day adjustment of carbohydrate targets
