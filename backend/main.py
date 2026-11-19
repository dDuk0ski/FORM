from fastapi import FastAPI, Depends, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from auth import get_current_user
from routers.today import router as today_router

app = FastAPI(
    title="FORM API",
    description="Backend for the FORM fitness and nutrition application",
    version="0.1.0",
)

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    error_codes = {
        400: "bad_request",
        401: "unauthorized",
        403: "forbidden",
        404: "not_found",
        405: "method_not_allowed",
        422: "invalid_request",
        500: "internal_error",
        502: "database_error",
        503: "model_unavailable",
    }

    # A route can pass {"code": ..., "message": ...} as the detail to pick its own code.
    if isinstance(exc.detail, dict):
        error = exc.detail
    else:
        error = {
            "code": error_codes.get(exc.status_code, "http_error"),
            "message": str(exc.detail),
        }

    return JSONResponse(
        status_code=exc.status_code,
        content={"error": error},
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
                "code": "invalid_request",
                "message": "Request validation failed",
            }
        },
    )


app.include_router(today_router)


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