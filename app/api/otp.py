import logging
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

router = APIRouter()
logger = logging.getLogger(__name__)

# Strict request verification blueprints
class OTPRequestPayload(BaseModel):
    phone_number: str

class OTPVerifyPayload(BaseModel):
    phone_number: str
    code: str

@router.post("/request")
async def request_otp(payload: OTPRequestPayload):
    """
    Catches the frontend registration action, logs mock execution paths, 
    and returns a clean verification handshake.
    """
    logger.warning(f"⚡ [MOCK AUTH STAGE] Verification code requested for footprint: {payload.phone_number}")
    logger.info("🔑 [MOCK AUTH STAGE] Generated transient bypass token: 123456")
    
    return {
        "status": "success",
        "message": "OTP generated successfully",
        "mock_code": "123456"
    }

@router.post("/verify")
async def verify_otp(payload: OTPVerifyPayload):
    """
    Validates the bypass token sequence to authorize full dashboard rendering.
    """
    if payload.code == "123456":
        logger.warning(f"✅ [MOCK AUTH STAGE] Authorization handshake successful for phone: {payload.phone_number}")
        return {
            "status": "success",
            "message": "Authentication successful",
            "access_token": "mock-synapse-jwt-token-abcdef123456",
            "token_type": "bearer"
        }
    
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid verification token provided."
    )
