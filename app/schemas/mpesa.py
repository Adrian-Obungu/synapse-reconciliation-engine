from typing import List, Optional, Any
from pydantic import BaseModel, model_validator

class CallbackMetadataItem(BaseModel):
    Name: str
    Value: Optional[Any] = None

    @model_validator(mode="after")
    def normalize_phone_number(self) -> 'CallbackMetadataItem':
        if self.Name == "PhoneNumber" and self.Value is not None:
            # Convert to string and strip spaces/symbols (e.g. +)
            val_str = str(self.Value).strip().replace("+", "")

            # Apply format rules
            if val_str.startswith("254"):
                self.Value = val_str
            elif val_str.startswith("07") or val_str.startswith("01"):
                # E.g. 07XXXXXXXX -> 2547XXXXXXXX
                self.Value = "254" + val_str[1:]
            elif val_str.startswith("7") or val_str.startswith("1"):
                # E.g. 7XXXXXXXX -> 2547XXXXXXXX
                self.Value = "254" + val_str
            else:
                # Fallback, just assign what was parsed
                self.Value = val_str
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
