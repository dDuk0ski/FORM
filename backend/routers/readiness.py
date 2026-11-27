from datetime import date

from fastapi import APIRouter, Depends, Query

from auth import get_current_user

router = APIRouter()


@router.get("/readiness")
def get_readiness(
    date_requested: date | None = Query(default=None, alias="date"),
    auth=Depends(get_current_user),
):
    """
    Temporary readiness endpoint.

    Returns placeholder readiness data until the real
    readiness calculation and database integration are ready.
    """

    requested_date = date_requested or date.today()

    return {
        "stub": True,
        "date": requested_date.isoformat(),
        "score": 71,
        "inputs": {
            "sleep_h": 7.5,
            "soreness": 2,
            "stress": 2,
            "hrv_ms": None,
            "training_load_7d": 0,
        },
        "fatigue": 0.3,
        "fitness": 0.7,
        "advice": "Normal session. Continue with your planned training.",
        "source": "manual",
    }