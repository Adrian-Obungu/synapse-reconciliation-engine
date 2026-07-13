import httpx
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from prometheus_fastapi_instrumentator import Instrumentator
from app.core.config import settings
from app.core.logging import setup_structured_logging
from app.api.router import router as mpesa_router
from app.api.otp import router as otp_router
from app.services.storage import StorageEngine

# Initialize structured JSON logging
setup_structured_logging()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Deterministic pool initialization at startup
    limits = httpx.Limits(
        max_connections=200,
        max_keepalive_connections=100,
        keepalive_expiry=30.0
    )
    client = httpx.AsyncClient(limits=limits)
    app.state.http_client = client

    # Initialize an asyncio Semaphore to throttle raw outbound tasks gracefully without OOMing
    app.state.etims_semaphore = asyncio.Semaphore(200)

    # Initialize robust backend datastores
    storage = StorageEngine()
    try:
        await storage.startup()
    except Exception:
        pass
    app.state.storage = storage

    yield

    # Graceful teardown
    await storage.shutdown()
    await app.state.http_client.aclose()

app = FastAPI(title=settings.project_name, lifespan=lifespan)

# Expose telemetry metrics endpoints
Instrumentator().instrument(app).expose(app, endpoint="/metrics")

# Secure API Router Mounting Points
app.include_router(mpesa_router, prefix="/api/v1/mpesa", tags=["mpesa"])
app.include_router(otp_router, prefix="/api/v1/otp", tags=["auth"])
