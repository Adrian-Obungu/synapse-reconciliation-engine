from typing import List, Optional, Any
from pydantic import BaseModel, model_validator
from app.utils.phone import safe_normalize_phone

class CallbackMetadataItem(BaseModel):
    Name: str
    Value: Optional[Any] = None

    @model_validator(mode="after")
    def normalize_phone_number(self) -> 'CallbackMetadataItem':
        if self.Name == "PhoneNumber" and self.Value is not None:
            self.Value = safe_normalize_phone(self.Value)
        return self

class CallbackMetadataType(BaseModel):
    Item: List[CallbackMetadataItem]

class StkCallback(BaseModel):
    MerchantRequestID: str
    CheckoutRequestID: str
    ResultCode: int
    ResultDesc: str
    CallbackMetadata: Optional[CallbackMetadataType] = None

class Body(BaseModel):
    stkCallback: StkCallback

class MpesaWebhookPayload(BaseModel):
    Body: Body
