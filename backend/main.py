
from fastapi import FastAPI, Depends, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from auth import get_current_user
from routers.today import router as today_router
from routers.readiness import router as readiness_router
from routers.gap_closer import router as gap_closer_router
from routers.predict_meal import router as predict_meal_router
from routers.next_set import router as next_set_router
from routers.receipt import router as receipt_router
from routers.barcode import router as barcode_router
from routers.recompute import router as recompute_router

app = FastAPI(
    title="FORM API",
    description="Backend for the FORM fitness and nutrition application",
    version="0.1.0",
)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    if isinstance(exc.detail, dict) and "error" in exc.detail:
        content = exc.detail
    else:
        error_codes = {
            400: "BAD_REQUEST",
            401: "UNAUTHORIZED",
            403: "FORBIDDEN",
            404: "NOT_FOUND",
            405: "METHOD_NOT_ALLOWED",
            409: "CONFLICT",
            422: "VALIDATION_ERROR",
            500: "INTERNAL_SERVER_ERROR",
            502: "BAD_GATEWAY",
            503: "SERVICE_UNAVAILABLE",
        }

        content = {
            "error": {
                "code": error_codes.get(exc.status_code, "HTTP_ERROR"),
                "message": str(exc.detail),
            }
        }

    return JSONResponse(
        status_code=exc.status_code,
        content=content,
        headers=exc.headers,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
):
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed",
            }
        },
    )


app.include_router(today_router)
app.include_router(readiness_router)
app.include_router(gap_closer_router)
app.include_router(predict_meal_router)
app.include_router(next_set_router)
app.include_router(receipt_router)
app.include_router(barcode_router)
app.include_router(recompute_router)

@app.get("/")
def root():
    return {"message": "FORM API is running"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/me")
def me(auth=Depends(get_current_user)):
    user = auth["user"]

    return {
        "id": str(user.id),
        "email": user.email,
    }
