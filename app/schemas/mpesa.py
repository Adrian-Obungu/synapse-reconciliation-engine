from typing import List, Optional, Any
from pydantic import BaseModel

class CallbackMetadataItem(BaseModel):
    Name: str
    Value: Optional[Any] = None

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
