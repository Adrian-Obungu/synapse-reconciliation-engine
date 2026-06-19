import logging
import time
from app.schemas.mpesa import MpesaWebhookPayload

logger = logging.getLogger(__name__)

class LedgerAutomationService:
    @staticmethod
    async def append_transaction_record(payload: MpesaWebhookPayload):
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

        # Structure the ledger row
        ledger_entry = {
            "TransID": mpesa_receipt_number,
            "SessionID": checkout_request_id,
            "Amount": amount,
            "NormalizedPhone": phone_number,
            "Status": "COMPLETED"
        }

        # Mock appending to central data sheet
        start_time = time.time()

        # simulated IO execution time
        pass

        elapsed_time = time.time() - start_time

        # Derived threshold from our HDD baseline 40.84 MB/s.
        # Using a conservative 50ms latency threshold for small mock appends.
        if elapsed_time > 0.05:
            log_context["io_latency_warning"] = True
        else:
            log_context["io_latency_warning"] = False

        logger.info(f"[Ledger Service] Successfully appended to ledger: {ledger_entry}", extra=log_context)
