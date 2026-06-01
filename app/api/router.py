import logging
from fastapi import APIRouter
from app.schemas.mpesa import MpesaWebhookPayload

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/callback")
async def mpesa_callback(payload: MpesaWebhookPayload):
    checkout_request_id = payload.Body.stkCallback.CheckoutRequestID

    # Fast deterministic log
    logger.info(f"Received M-Pesa webhook for CheckoutRequestID: {checkout_request_id}")

    # Return strict HTTP 200 OK acknowledgment per specs
    return {"status": "success", "message": "Callback processed"}
