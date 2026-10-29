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
| `form_ml/energy.py` | Adaptive TDEE: Mifflin-St Jeor prior, smoothed trend weight, observed burn from logged intake and weight slope, blended from formula to observed over 7-21 logged days |
| `form_ml/targets.py` | Daily kcal, protein, carb and fat targets from the TDEE estimate and the user's goal, plus the one-line rationale |
| `form_ml/synthetic.py` | Synthetic users with a known true TDEE, logging bias, noisy weigh-ins and missed days |
| `scripts/evaluate_energy.py` | Walk-forward evaluation against the static formula |

These map onto `GET /today`: `daily_targets()` returns `targets`, `tdee_estimate`,
`target_source` and `rationale`. `consumed` comes from the day's food logs and
`remaining = targets - consumed`.

## Current results

```bash
.venv/bin/python scripts/evaluate_energy.py
```

Mean absolute error of the predicted next-week weight change, 300 synthetic users over 84 days,
from day 28 of history on:

| Estimate | Seed 7 | Seed 11 |
| --- | --- | --- |
| Static formula (baseline) | 0.316 kg | 0.343 kg |
| Adaptive, trend-difference slope | 0.163 kg | 0.162 kg |
| Adaptive, regression slope (default) | 0.110 kg | 0.108 kg |

The smoothed trend lags real change for the first couple of weeks, so the observed burn uses a
least-squares slope of the raw weigh-ins instead. The smoothed trend is still the weight to show
users.

Caveat: the synthetic users follow the same energy-balance rule the model assumes. Real weight
also swings with water, glycogen and sodium, so expect larger errors on real data. The team's own
logs are the real test.

## Next steps

- Kalman filter for the weight trend, with uncertainty reported alongside the estimate
- Per-user tuning of the 7-21 day ramp from how noisy their weigh-ins are
- Training-day adjustment of carbohydrate targets
