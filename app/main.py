from fastapi import FastAPI
from app.core.config import settings
from app.core.logging import setup_structured_logging
from app.api.router import router as mpesa_router

# Initialize structured JSON logging
setup_structured_logging()

app = FastAPI(title=settings.project_name)

app.include_router(mpesa_router, prefix="/api/v1/mpesa", tags=["mpesa"])
