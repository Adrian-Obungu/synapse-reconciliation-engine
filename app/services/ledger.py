import logging
from app.schemas.mpesa import MpesaWebhookPayload

logger = logging.getLogger(__name__)

class LedgerAutomationService:
    @staticmethod
    async def append_transaction_record(payload: MpesaWebhookPayload):
        stk_callback = payload.Body.stkCallback
        checkout_request_id = stk_callback.CheckoutRequestID

        logger.info(f"[Ledger Service] Processing transaction for session_id: {checkout_request_id}")

        # Abort and log if the transaction failed
        if stk_callback.ResultCode != 0:
            logger.warning(f"[Ledger Service] Transaction failed (ResultCode: {stk_callback.ResultCode}). "
                           f"Aborting ledger append for session_id: {checkout_request_id}")
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
            logger.error(f"[Ledger Service] Missing MpesaReceiptNumber for successful transaction {checkout_request_id}. Aborting.")
            return

        # Structure the ledger row
        ledger_entry = {
            "TransID": mpesa_receipt_number,
            "SessionID": checkout_request_id,
            "Amount": amount,
            "NormalizedPhone": phone_number,
            "Status": "COMPLETED"
        }

        # Mock appending to central data sheet
        logger.info(f"[Ledger Service] Successfully appended to ledger: {ledger_entry}")
