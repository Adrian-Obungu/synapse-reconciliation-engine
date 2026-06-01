from fastapi import FastAPI
from app.core.config import settings
from app.api.router import router as mpesa_router

app = FastAPI(title=settings.project_name)

app.include_router(mpesa_router, prefix="/api/v1/mpesa", tags=["mpesa"])

@app.get("/health")
async def health_check():
    return {"status": "ok"}
