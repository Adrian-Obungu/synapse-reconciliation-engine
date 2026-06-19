import httpx
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.core.config import settings
from app.core.logging import setup_structured_logging
from app.api.router import router as mpesa_router
from app.services.etims import set_shared_client, shared_client

# Initialize structured JSON logging
setup_structured_logging()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Deterministic pool initialization at startup
    limits = httpx.Limits(max_keepalive_connections=100, max_connections=200)
    client = httpx.AsyncClient(limits=limits)
    set_shared_client(client)
    yield
    # Graceful teardown
    await client.aclose()
    set_shared_client(None)

app = FastAPI(title=settings.project_name, lifespan=lifespan)

app.include_router(mpesa_router, prefix="/api/v1/mpesa", tags=["mpesa"])
