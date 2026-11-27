
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from auth import get_current_user

router = APIRouter()


class ReceiptRequest(BaseModel):
    storage_path: str = Field(min_length=1)


class ReceiptItem(BaseModel):
    raw_text: str
    food_id: str
    name: str
    grams: float
    confidence: float


class ReceiptResponse(BaseModel):
    stub: bool = True
    items: list[ReceiptItem]
    unmatched: list[str]


@router.post("/receipt", response_model=ReceiptResponse)
def process_receipt(
    request: ReceiptRequest,
    auth=Depends(get_current_user),
):
    """
    Process a receipt image already uploaded to Supabase Storage.

    Receipt recognition will be integrated when the ML service is ready.
    """

    return JSONResponse(
        status_code=503,
        content={
            "error": {
                "code": "MODEL_NOT_READY",
                "message": "The receipt processing model is not available yet.",
            }
        },
    )
