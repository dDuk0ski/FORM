import pytest

from form_ml.energy import KCAL_PER_KG
from form_ml.synthetic import population


def test_population_is_reproducible():
    a = population(3, 14, seed=1)
    b = population(3, 14, seed=1)
    assert [r.records for r in a] == [r.records for r in b]


def test_weight_follows_energy_balance():
    run = population(1, 30, seed=2)[0]
    for t in range(29):
        balance = run.true_intake_kcal[t] - run.true_tdee_kcal[t]
        assert run.true_weight_kg[t + 1] - run.true_weight_kg[t] == pytest.approx(balance / KCAL_PER_KG)
