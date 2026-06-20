import os
import logging
import asyncio
import random
import httpx
from app.schemas.mpesa import MpesaWebhookPayload
from app.schemas.etims import ETIMSTransformer
from app.core.config import settings

logger = logging.getLogger(__name__)

class ETIMSComplianceService:
    @staticmethod
    async def generate_electronic_invoice(payload: MpesaWebhookPayload, client: httpx.AsyncClient, semaphore: asyncio.Semaphore):
        stk_callback = payload.Body.stkCallback
        checkout_request_id = stk_callback.CheckoutRequestID
        log_context = {"checkout_request_id": checkout_request_id}

        if stk_callback.CallbackMetadata and stk_callback.CallbackMetadata.Item:
            for item in stk_callback.CallbackMetadata.Item:
                if item.Name == "MpesaReceiptNumber":
                    log_context["mpesa_receipt_number"] = item.Value
                    break

        # We only generate invoices for successful transactions
        if stk_callback.ResultCode != 0:
            logger.info("[eTIMS Service] Transaction failed. Skipping invoice generation.", extra=log_context)
            return

        # Map to precise eTIMS invoice schema natively, decoupling transport from payload logic
        invoice_schema = ETIMSTransformer.transform_daraja_to_etims(payload)
        # We use model_dump(mode="json") so Pydantic properly serializes the Decimal to a float/string compliant with standard JSON
        etims_payload = invoice_schema.model_dump(mode="json")

        async with semaphore:
            if settings.mock_etims:
                logger.info("[eTIMS Service] MOCK_ETIMS is enabled. Simulating API processing...", extra=log_context)
                await asyncio.sleep(0.15)  # Simulate typical remote round-trip latency
                logger.info("[eTIMS Service] Successfully posted invoice (MOCKED)", extra=log_context)
                return

            url = settings.etims_url
            max_retries = 3

            for attempt in range(1, max_retries + 1):
                try:
                    logger.info(f"[eTIMS Service] Attempt {attempt} to post invoice", extra=log_context)
                    response = await client.post(url, json=etims_payload, timeout=10.0)
                    response.raise_for_status()
                    logger.info("[eTIMS Service] Successfully posted invoice", extra=log_context)
                    return # Exit on success
                except httpx.RequestError as exc:
                    logger.warning(f"[eTIMS Service] Request error on attempt {attempt}: {exc}", extra=log_context)
                except httpx.HTTPStatusError as exc:
                    # Only retry on 429 Too Many Requests or 5xx server errors
                    if exc.response.status_code not in (429, 500, 502, 503, 504):
                        logger.error(f"[eTIMS Service] Terminal HTTP error {exc.response.status_code}. Aborting.", extra=log_context)
                        break
                    logger.warning(f"[eTIMS Service] Upstream HTTP error {exc.response.status_code} on attempt {attempt}", extra=log_context)

                if attempt < max_retries:
                    # Exponential backoff: 2^attempt (2s, 4s) + random jitter (0 to 0.5s)
                    jitter = random.uniform(0, 0.5)
                    wait_time = (2 ** attempt) + jitter
                    logger.info(f"[eTIMS Service] Backing off for {wait_time:.2f} seconds before retrying...", extra=log_context)
                    await asyncio.sleep(wait_time)

            log_context["transaction_state"] = "FAILED_COMPLIANCE"
            logger.error(f"[eTIMS Service] Failed to post invoice after {max_retries} attempts.", extra=log_context)
