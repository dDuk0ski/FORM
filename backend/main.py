
from fastapi import FastAPI

app = FastAPI(
    title="FORM API",
    description="Backend for the FORM fitness and nutrition application",
    version="0.1.0",
)


@app.get("/")
def root():
    return {"message": "FORM API is running"}


@app.get("/health")
def health():
    return {"status": "ok"}

