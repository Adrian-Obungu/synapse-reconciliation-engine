from typing import Optional
from decimal import Decimal
from pydantic import BaseModel, Field
from app.schemas.mpesa import MpesaWebhookPayload
from app.core.config import settings

class ETIMSInvoicePayload(BaseModel):
    sender_id: str = Field(..., description="The registered sender ID for eTIMS (e.g. SVD)")
    invoice_number: str = Field(..., description="Mapped from MpesaReceiptNumber")
    transaction_reference: str = Field(..., description="Mapped from CheckoutRequestID")
    amount: Decimal = Field(..., description="Exact numeric transaction amount")
    customer_phone: str = Field(..., description="Normalized E.164 phone number")
    transaction_date: str = Field(..., description="Transaction timestamp from Daraja")
    status: str = Field(default="PAID", description="Payment status")

class ETIMSTransformer:
    @classmethod
    def transform_daraja_to_etims(cls, daraja_payload: MpesaWebhookPayload) -> ETIMSInvoicePayload:
        stk_callback = daraja_payload.Body.stkCallback

        # Default fallback values for parsing
        mpesa_receipt_number = ""
        amount = Decimal("0.00")
        phone_number = ""
        transaction_date = ""

        if stk_callback.CallbackMetadata and stk_callback.CallbackMetadata.Item:
            for item in stk_callback.CallbackMetadata.Item:
                if item.Name == "MpesaReceiptNumber" and item.Value:
                    mpesa_receipt_number = str(item.Value)
                elif item.Name == "Amount" and item.Value is not None:
                    amount = Decimal(str(item.Value))
                elif item.Name == "PhoneNumber" and item.Value:
                    phone_number = str(item.Value)
                elif item.Name == "TransactionDate" and item.Value:
                    transaction_date = str(item.Value)

        return ETIMSInvoicePayload(
            sender_id=settings.etims_svd_sender_id,
            invoice_number=mpesa_receipt_number,
            transaction_reference=stk_callback.CheckoutRequestID,
            amount=amount,
            customer_phone=phone_number,
            transaction_date=transaction_date
        )
