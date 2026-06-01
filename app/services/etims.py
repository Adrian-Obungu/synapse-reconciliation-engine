import logging
import asyncio
import httpx
from app.schemas.mpesa import MpesaWebhookPayload
from app.core.config import settings

logger = logging.getLogger(__name__)

class ETIMSComplianceService:
    @staticmethod
    async def generate_electronic_invoice(payload: MpesaWebhookPayload):
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

        # Format mock payload for eTIMS
        etims_payload = {
            "sender_id": settings.etims_svd_sender_id,
            "transaction_reference": checkout_request_id,
            "status": "PAID"
        }

        url = "https://api.etims-mock.kra.go.ke/v1/invoices"
        max_retries = 3

        async with httpx.AsyncClient() as client:
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
                    logger.warning(f"[eTIMS Service] HTTP error {exc.response.status_code} on attempt {attempt}", extra=log_context)

                if attempt < max_retries:
                    wait_time = 2 ** attempt
                    logger.info(f"[eTIMS Service] Backing off for {wait_time} seconds before retrying...", extra=log_context)
                    await asyncio.sleep(wait_time)

            logger.error(f"[eTIMS Service] Failed to post invoice after {max_retries} attempts.", extra=log_context)
