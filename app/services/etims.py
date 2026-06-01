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

        # We only generate invoices for successful transactions
        if stk_callback.ResultCode != 0:
            logger.info(f"[eTIMS Service] Transaction {checkout_request_id} failed. Skipping invoice generation.")
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
                    logger.info(f"[eTIMS Service] Attempt {attempt} to post invoice for {checkout_request_id}")
                    response = await client.post(url, json=etims_payload, timeout=10.0)
                    response.raise_for_status()
                    logger.info(f"[eTIMS Service] Successfully posted invoice for {checkout_request_id}")
                    return # Exit on success
                except httpx.RequestError as exc:
                    logger.warning(f"[eTIMS Service] Request error on attempt {attempt} for {checkout_request_id}: {exc}")
                except httpx.HTTPStatusError as exc:
                    logger.warning(f"[eTIMS Service] HTTP error {exc.response.status_code} on attempt {attempt} for {checkout_request_id}")

                if attempt < max_retries:
                    wait_time = 2 ** attempt
                    logger.info(f"[eTIMS Service] Backing off for {wait_time} seconds before retrying...")
                    await asyncio.sleep(wait_time)

            logger.error(f"[eTIMS Service] Failed to post invoice for {checkout_request_id} after {max_retries} attempts.")
