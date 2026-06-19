from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.core.config import settings
from app.core.logging import setup_structured_logging
from app.api.router import router as mpesa_router
from app.services.etims import shared_client

# Initialize structured JSON logging
setup_structured_logging()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic: shared client is instantiated lazily in etims.py
    yield
    # Shutdown logic: clean up the shared HTTP client gracefully
    import app.services.etims as etims
    if etims.shared_client is not None:
        await etims.shared_client.aclose()

app = FastAPI(title=settings.project_name, lifespan=lifespan)

app.include_router(mpesa_router, prefix="/api/v1/mpesa", tags=["mpesa"])
