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
| `form_ml/energy.py` | Adaptive TDEE: Mifflin-St Jeor prior, smoothed trend weight, observed burn from logged intake and a Huber weight slope, blended from formula to observed over 7-21 logged days; days logged far below normal are left out |
| `form_ml/targets.py` | Daily kcal, protein, carb and fat targets from the TDEE estimate and the user's goal, plus the one-line rationale |
| `form_ml/synthetic.py` | Synthetic users with a known true TDEE, logging bias, noisy weigh-ins and missed days; `Realism` adds forgotten meals, weekends, water retention and multi-day gaps |
| `scripts/evaluate_energy.py` | Walk-forward evaluation against the static formula |

These map onto `GET /today`: `daily_targets()` returns `targets`, `tdee_estimate`,
`target_source` and `rationale`. `consumed` comes from the day's food logs and
`remaining = targets - consumed`.

## Current results

```bash
.venv/bin/python scripts/evaluate_energy.py               # clean synthetic users
.venv/bin/python scripts/evaluate_energy.py --realistic   # messy logs
```

300 synthetic users over 84 days, from day 28 of history on. Each cell: mean absolute error of
the predicted next-week weight change (kg/week) / error against the true TDEE in logged calories
(kcal/day). Seeds 7 and 11.

| Estimate | Clean, seed 7 | Clean, seed 11 | Realistic, seed 7 | Realistic, seed 11 |
| --- | --- | --- | --- | --- |
| Static formula (baseline) | 0.310 / 356 | 0.336 / 396 | 0.344 / 343 | 0.331 / 329 |
| Version 1: least squares, every logged day | 0.113 / 106 | 0.111 / 108 | 0.212 / 216 | 0.220 / 215 |
| Incomplete-day filter only | 0.114 / 109 | 0.112 / 112 | 0.202 / 192 | 0.208 / 188 |
| Huber slope only | 0.114 / 107 | 0.113 / 110 | 0.211 / 214 | 0.219 / 213 |
| Version 2 (default): both | 0.115 / 111 | 0.114 / 114 | 0.201 / 190 | 0.207 / 186 |

Realistic logs roughly double version 1's error. Leaving out days logged under 60% of the
user's normal does most of the recovery (about 12% less TDEE error); the Huber slope adds little,
because retained water persists for days and looks like a trend rather than an outlier. On clean
users version 2 costs about 4 kcal/day, the price of occasionally dropping a genuinely light day.
The earlier report numbers (0.110 / 0.108 kg) were version 1 on clean users with the previous
evaluation, which did not screen incomplete days in the week being predicted.

Closed-loop check (`tests/test_closed_loop.py`): synthetic users who eat at the model's targets
with a lose goal lose a median 0.55% of body weight a week (5th-95th percentile 0.30-0.71%).
Targets are in the user's logged calories, so the safety floor and the 1%-a-week loss cap are
scaled into those units first. Without that scaling, 26% of under-logging users barely lost weight.

The smoothed trend lags real change for the first couple of weeks, so the observed burn uses a
least-squares slope of the raw weigh-ins instead. The smoothed trend is still the weight to show
users.

Caveat: even the realistic users follow the energy-balance rule the model assumes, with water
and logging noise layered on top. Real bodies also shift glycogen and adapt their burn, so the
team's own logs are the real test.

## Next steps

- Kalman filter for the weight trend and burn together, with uncertainty reported alongside the
  estimate; it should also handle lingering water better than the Huber slope
- Per-user tuning of the 7-21 day ramp from how noisy their weigh-ins are
- Training-day adjustment of carbohydrate targets
