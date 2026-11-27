
from datetime import datetime

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from auth import get_current_user

router = APIRouter()


# Request model
class PredictMealRequest(BaseModel):
    at: datetime
    limit: int = Field(ge=1)


# Response models
class PredictedFoodItem(BaseModel):
    food_id: str
    grams: float


class MealPrediction(BaseModel):
    label: str
    confidence: float
    items: list[PredictedFoodItem]
    last_logged: datetime


class PredictMealResponse(BaseModel):
    stub: bool = True
    predictions: list[MealPrediction]


@router.post("/predict-meal", response_model=PredictMealResponse)
def predict_meal(
    request: PredictMealRequest,
    auth=Depends(get_current_user),
):
    """
    Predict upcoming meals.

    The actual prediction model will be connected later.
    """

    return JSONResponse(
        status_code=503,
        content={
            "error": {
                "code": "MODEL_NOT_READY",
                "message": "The meal prediction model is not available yet.",
            }
        },
    )
