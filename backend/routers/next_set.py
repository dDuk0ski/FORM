
from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse

from auth import get_current_user

router = APIRouter()


@router.get("/next-set")
def get_next_set(
    exercise_id: str = Query(...),
    set_index: int = Query(default=1, ge=1),
    auth=Depends(get_current_user),
):
    """
    Recommend the next exercise set.

    The actual workout recommendation model will be connected later.
    """

    return JSONResponse(
        status_code=503,
        content={
            "error": {
                "code": "MODEL_NOT_READY",
                "message": "The next-set recommendation model is not available yet.",
            }
        },
    )
