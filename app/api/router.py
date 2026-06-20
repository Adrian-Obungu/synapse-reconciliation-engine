import logging
import asyncio
import time
from fastapi import APIRouter, BackgroundTasks, Request
from app.schemas.mpesa import MpesaWebhookPayload
from app.services.ledger import LedgerAutomationService
from app.services.etims import ETIMSComplianceService

router = APIRouter()
logger = logging.getLogger(__name__)

async def process_compliance_pipeline(payload: MpesaWebhookPayload, enqueue_time: float, request: Request):
    checkout_request_id = payload.Body.stkCallback.CheckoutRequestID

    # Calculate async_lag_ms accurately right when the worker picks it up
    async_lag_ms = (time.perf_counter() - enqueue_time) * 1000.0

    # Extract MpesaReceiptNumber for structured logging context
    mpesa_receipt_number = None
    if payload.Body.stkCallback.CallbackMetadata and payload.Body.stkCallback.CallbackMetadata.Item:
        for item in payload.Body.stkCallback.CallbackMetadata.Item:
            if item.Name == "MpesaReceiptNumber":
                mpesa_receipt_number = item.Value
                break

    log_context = {
        "checkout_request_id": checkout_request_id,
        "async_lag_ms": round(async_lag_ms, 2)
    }
    if mpesa_receipt_number:
        log_context["mpesa_receipt_number"] = mpesa_receipt_number

    logger.info("[Background Task] Starting compliance pipeline", extra=log_context)

    try:
        # Execute Ledger Service mapping and append
        await LedgerAutomationService.append_transaction_record(payload, request.app.state.storage)

        # Execute ETIMS API submission
        await ETIMSComplianceService.generate_electronic_invoice(payload)

        logger.info("[Background Task] Completed compliance pipeline", extra=log_context)
    except Exception as e:
        logger.exception(f"[Background Task] Unhandled exception in compliance pipeline: {e}", extra=log_context)
        raise


@router.get("/healthz")
async def health_check():
    return {
        "status": "healthy",
        "metrics": {
            "storage_layer": "active"
        }
    }


@router.post("/callback")
async def mpesa_callback(payload: MpesaWebhookPayload, background_tasks: BackgroundTasks, request: Request):
    enqueue_time = time.perf_counter()

    checkout_request_id = payload.Body.stkCallback.CheckoutRequestID
    log_context = {"checkout_request_id": checkout_request_id}

    # Atomic Idempotency Check via Redis layer
    is_novel = await request.app.state.storage.check_idempotency(checkout_request_id)
    if not is_novel:
        cache_hit_context = log_context.copy()
        cache_hit_context["event_type"] = "CACHE_HIT"
        logger.info("Duplicate CheckoutRequestID detected. Skipping processing.", extra=cache_hit_context)
        return {"status": "success", "message": "Callback processed"}

    # Hand off payload processing to background worker
    background_tasks.add_task(process_compliance_pipeline, payload, enqueue_time, request)

    # Fast deterministic log
    logger.info("Received M-Pesa webhook", extra=log_context)

    # Return strict HTTP 200 OK acknowledgment per specs instantly
    return {"status": "success", "message": "Callback processed"}
