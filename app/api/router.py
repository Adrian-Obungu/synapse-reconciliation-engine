import logging
import asyncio
from fastapi import APIRouter, BackgroundTasks
from app.schemas.mpesa import MpesaWebhookPayload
from app.services.ledger import LedgerAutomationService
from app.services.etims import ETIMSComplianceService

router = APIRouter()
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

# High-performance global dictionary block for Idempotency Guard
PROCESSED_REQUESTS = {}

async def process_compliance_pipeline(payload: MpesaWebhookPayload):
    checkout_request_id = payload.Body.stkCallback.CheckoutRequestID
    logger.info(f"[Background Task] Starting compliance pipeline for {checkout_request_id}")

    # Execute Ledger Service mapping and append
    await LedgerAutomationService.append_transaction_record(payload)

    # Mocking 1.5-second network latency spike (eTIMS API hand-shake)
    await asyncio.sleep(1.5)

    # Execute ETIMS API submission
    await ETIMSComplianceService.generate_electronic_invoice(payload)

    logger.info(f"[Background Task] Completed compliance pipeline for {checkout_request_id}")


@router.post("/callback")
async def mpesa_callback(payload: MpesaWebhookPayload, background_tasks: BackgroundTasks):
    checkout_request_id = payload.Body.stkCallback.CheckoutRequestID

    # Idempotency check
    if checkout_request_id in PROCESSED_REQUESTS:
        logger.info(f"Duplicate CheckoutRequestID detected: {checkout_request_id}. Skipping processing.")
        return {"status": "success", "message": "Callback processed"}

    # Lightweight eviction guard (Memory Management)
    if len(PROCESSED_REQUESTS) >= 1000:
        oldest_key = next(iter(PROCESSED_REQUESTS))
        PROCESSED_REQUESTS.pop(oldest_key)

    # Record request to block duplicates
    PROCESSED_REQUESTS[checkout_request_id] = True

    # Fast deterministic log
    logger.info(f"Received M-Pesa webhook for CheckoutRequestID: {checkout_request_id}")

    # Hand off payload processing to background worker
    background_tasks.add_task(process_compliance_pipeline, payload)

    # Return strict HTTP 200 OK acknowledgment per specs instantly
    return {"status": "success", "message": "Callback processed"}
