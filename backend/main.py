
from fastapi import FastAPI, Depends

from auth import get_current_user
from routers.today import router as today_router

app = FastAPI(
    title="FORM API",
    description="Backend for the FORM fitness and nutrition application",
    version="0.1.0",
)

# Register the /today endpoint.
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
