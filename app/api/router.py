import logging
import asyncio
from fastapi import APIRouter, BackgroundTasks
from app.schemas.mpesa import MpesaWebhookPayload
from app.services.ledger import LedgerAutomationService
from app.services.etims import ETIMSComplianceService

router = APIRouter()
logger = logging.getLogger(__name__)

# High-performance global dictionary block for Idempotency Guard
PROCESSED_REQUESTS = {}

async def process_compliance_pipeline(payload: MpesaWebhookPayload):
    checkout_request_id = payload.Body.stkCallback.CheckoutRequestID

    # Extract MpesaReceiptNumber for structured logging context
    mpesa_receipt_number = None
    if payload.Body.stkCallback.CallbackMetadata and payload.Body.stkCallback.CallbackMetadata.Item:
        for item in payload.Body.stkCallback.CallbackMetadata.Item:
            if item.Name == "MpesaReceiptNumber":
                mpesa_receipt_number = item.Value
                break

    log_context = {"checkout_request_id": checkout_request_id}
    if mpesa_receipt_number:
        log_context["mpesa_receipt_number"] = mpesa_receipt_number

    logger.info("[Background Task] Starting compliance pipeline", extra=log_context)

    # Execute Ledger Service mapping and append
    await LedgerAutomationService.append_transaction_record(payload)

    # Mocking 1.5-second network latency spike (eTIMS API hand-shake)
    await asyncio.sleep(1.5)

    # Execute ETIMS API submission
    await ETIMSComplianceService.generate_electronic_invoice(payload)

    logger.info("[Background Task] Completed compliance pipeline", extra=log_context)


@router.get("/healthz")
async def health_check():
    return {
        "status": "healthy",
        "metrics": {
            "cache_utilization": {
                "current_count": len(PROCESSED_REQUESTS),
                "maximum_capacity": 1000
            }
        }
    }


@router.post("/callback")
async def mpesa_callback(payload: MpesaWebhookPayload, background_tasks: BackgroundTasks):
    checkout_request_id = payload.Body.stkCallback.CheckoutRequestID
    log_context = {"checkout_request_id": checkout_request_id}

    # Idempotency check
    if checkout_request_id in PROCESSED_REQUESTS:
        logger.info("Duplicate CheckoutRequestID detected. Skipping processing.", extra=log_context)
        return {"status": "success", "message": "Callback processed"}

    # Lightweight eviction guard (Memory Management)
    if len(PROCESSED_REQUESTS) >= 1000:
        oldest_key = next(iter(PROCESSED_REQUESTS))
        PROCESSED_REQUESTS.pop(oldest_key)

    # Record request to block duplicates
    PROCESSED_REQUESTS[checkout_request_id] = True

    # Fast deterministic log
    logger.info("Received M-Pesa webhook", extra=log_context)

    # Hand off payload processing to background worker
    background_tasks.add_task(process_compliance_pipeline, payload)

    # Return strict HTTP 200 OK acknowledgment per specs instantly
    return {"status": "success", "message": "Callback processed"}
