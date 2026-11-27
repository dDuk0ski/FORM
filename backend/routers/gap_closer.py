from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from fastapi.responses import JSONResponse

from auth import get_current_user

router = APIRouter()


# Request model
class GapCloserRequest(BaseModel):
    meal_size: Literal["snack", "meal", "rest_of_day"] = "meal"
    max_items: int = Field(ge=1, le=20)
    exclude_food_ids: list[str] = Field(max_length=500)


# Response models
class Macros(BaseModel):
    kcal: float
    protein_g: float
    carb_g: float
    fat_g: float


class GapCloserItem(BaseModel):
    food_id: str
    name: str
    grams: float
    pantry_item_id: str


class GapCloserSuggestion(BaseModel):
    rank: int
    items: list[GapCloserItem]
    totals: Macros
    fit: float
    reason: str


class GapCloserShortfall(BaseModel):
    nutrient: str
    amount: float
    suggested_foods: list[str]


class GapCloserResponse(BaseModel):
    stub: bool = True
    remaining: dict[str, float]
    suggestions: list[GapCloserSuggestion]
    shortfall: GapCloserShortfall | None


@router.post("/gap-closer", response_model=GapCloserResponse)
def gap_closer(
    request: GapCloserRequest,
    auth=Depends(get_current_user),
):
    """
    Suggest foods to help close the user's nutrition gap.

    The actual recommendation model will be connected later.
    """

    return JSONResponse(
        status_code=503,
        content={
            "error": {
                "code": "MODEL_NOT_READY",
                "message": "The gap-closer recommendation model is not available yet.",
            }
        },
    )