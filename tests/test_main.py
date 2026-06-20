import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient
from app.main import app
from app.services.storage import StorageEngine

# Mock the storage engine so tests run cleanly without needing Redis or Postgres
mock_storage = AsyncMock(spec=StorageEngine)
# Simulate novel request explicitly
mock_storage.check_idempotency.return_value = True

app.state.storage = mock_storage
client = TestClient(app)

def test_health_check():
    response = client.get("/api/v1/mpesa/healthz")
    assert response.status_code == 200
    json_response = response.json()
    assert json_response["status"] == "healthy"
    assert "metrics" in json_response
    assert "storage_layer" in json_response["metrics"]
    assert json_response["metrics"]["storage_layer"] == "active"

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
    with patch("app.api.router.logger.info") as mock_logger_info:
        mock_storage.check_idempotency.return_value = True
        response1 = client.post("/api/v1/mpesa/callback", json=payload)
        assert response1.status_code == 200
        # The router injects `async_lag_ms` into the log context dynamically
        # Search through all calls to logger.info in the router specifically
        found_lag = False
        for call in mock_logger_info.call_args_list:
            if "async_lag_ms" in call.kwargs.get("extra", {}):
                found_lag = True
                break
        assert found_lag, "async_lag_ms not found in any logger.info call"

    # Second request (duplicate)
    with patch("app.api.router.logger.info") as mock_logger_info:
        mock_storage.check_idempotency.return_value = False
        response2 = client.post("/api/v1/mpesa/callback", json=payload)
        assert response2.status_code == 200
        mock_logger_info.assert_called_with(
            "Duplicate CheckoutRequestID detected. Skipping processing.",
            extra={"checkout_request_id": "ws_CO_191220191020363927", "event_type": "CACHE_HIT"}
        )
