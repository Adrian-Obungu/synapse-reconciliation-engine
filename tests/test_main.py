import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/api/v1/mpesa/healthz")
    assert response.status_code == 200
    json_response = response.json()
    assert json_response["status"] == "healthy"
    assert "metrics" in json_response
    assert "cache_utilization" in json_response["metrics"]
    assert "current_count" in json_response["metrics"]["cache_utilization"]
    assert json_response["metrics"]["cache_utilization"]["maximum_capacity"] == 1000

@patch("asyncio.sleep")
@patch("httpx.AsyncClient.post")
def test_mpesa_callback_success(mock_post, mock_sleep):
    # Setup mock to simulate successful KRA response
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.raise_for_status.return_value = None
    mock_post.return_value = mock_response

    payload = {
        "Body": {
            "stkCallback": {
                "MerchantRequestID": "29115-34620561-1",
                "CheckoutRequestID": "ws_CO_191220191020363925",
                "ResultCode": 0,
                "ResultDesc": "The service request is processed successfully.",
                "CallbackMetadata": {
                    "Item": [
                        {"Name": "Amount", "Value": 1.00},
                        {"Name": "MpesaReceiptNumber", "Value": "NLJ7RT61SV"},
                        {"Name": "PhoneNumber", "Value": 254708374149}
                    ]
                }
            }
        }
    }

    response = client.post("/api/v1/mpesa/callback", json=payload)
    assert response.status_code == 200
    assert response.json() == {"status": "success", "message": "Callback processed"}

@patch("asyncio.sleep")
def test_mpesa_callback_failure_case(mock_sleep):
    # Test how we handle a failed M-Pesa transaction (ResultCode != 0), which may lack CallbackMetadata
    payload = {
        "Body": {
            "stkCallback": {
                "MerchantRequestID": "29115-34620561-1",
                "CheckoutRequestID": "ws_CO_191220191020363926",
                "ResultCode": 1032,
                "ResultDesc": "Request cancelled by user"
            }
        }
    }

    response = client.post("/api/v1/mpesa/callback", json=payload)
    assert response.status_code == 200
    assert response.json() == {"status": "success", "message": "Callback processed"}

@patch("asyncio.sleep")
@patch("httpx.AsyncClient.post")
def test_mpesa_callback_idempotency(mock_post, mock_sleep):
    # Setup mock to simulate successful KRA response for the first background execution
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.raise_for_status.return_value = None
    mock_post.return_value = mock_response

    payload = {
        "Body": {
            "stkCallback": {
                "MerchantRequestID": "29115-34620561-1",
                "CheckoutRequestID": "ws_CO_191220191020363927",
                "ResultCode": 0,
                "ResultDesc": "The service request is processed successfully.",
                "CallbackMetadata": {
                    "Item": [
                        {"Name": "Amount", "Value": 1.00},
                        {"Name": "MpesaReceiptNumber", "Value": "NLJ7RT61SV"},
                        {"Name": "PhoneNumber", "Value": "0708374149"}
                    ]
                }
            }
        }
    }

    # First request
    response1 = client.post("/api/v1/mpesa/callback", json=payload)
    assert response1.status_code == 200

    # Second request (duplicate)
    response2 = client.post("/api/v1/mpesa/callback", json=payload)
    assert response2.status_code == 200
