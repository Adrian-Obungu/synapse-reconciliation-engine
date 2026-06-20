import logging
import time
import asyncio
from app.schemas.mpesa import MpesaWebhookPayload
from app.schemas.etims import ETIMSTransformer
from app.services.storage import StorageEngine

logger = logging.getLogger(__name__)

class LedgerAutomationService:
    @staticmethod
    async def append_transaction_record(payload: MpesaWebhookPayload, storage: StorageEngine):
        stk_callback = payload.Body.stkCallback
        checkout_request_id = stk_callback.CheckoutRequestID
        log_context = {"checkout_request_id": checkout_request_id}

        logger.info("[Ledger Service] Processing transaction", extra=log_context)

        # Abort and log if the transaction failed
        if stk_callback.ResultCode != 0:
            logger.warning(f"[Ledger Service] Transaction failed (ResultCode: {stk_callback.ResultCode}). Aborting ledger append.", extra=log_context)
            return

        # Extract fields from CallbackMetadata safely
        mpesa_receipt_number = None
        amount = None
        phone_number = None

        if stk_callback.CallbackMetadata and stk_callback.CallbackMetadata.Item:
            for item in stk_callback.CallbackMetadata.Item:
                if item.Name == "MpesaReceiptNumber":
                    mpesa_receipt_number = item.Value
                elif item.Name == "Amount":
                    amount = item.Value
                elif item.Name == "PhoneNumber":
                    phone_number = item.Value

        if not mpesa_receipt_number:
            logger.error("[Ledger Service] Missing MpesaReceiptNumber for successful transaction. Aborting.", extra=log_context)
            return

        log_context["mpesa_receipt_number"] = mpesa_receipt_number

        # Structure the ledger payload dynamically via our standard schema
        etims_schema = ETIMSTransformer.transform_daraja_to_etims(payload)

        # Let the StorageEngine handle the DB connection cleanly
        await storage.commit_ledger_record(etims_schema)
        logger.info(f"[Ledger Service] Append request dispatched to storage layer.", extra=log_context)
