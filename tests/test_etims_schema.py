from decimal import Decimal
from app.schemas.etims import ETIMSTransformer
from app.schemas.mpesa import MpesaWebhookPayload
from app.core.config import settings

def test_etims_transformer_mapping():
    # Construct a valid dummy payload
    payload_dict = {
        "Body": {
            "stkCallback": {
                "MerchantRequestID": "29115-34620561-1",
                "CheckoutRequestID": "ws_CO_191220191020363925",
                "ResultCode": 0,
                "ResultDesc": "The service request is processed successfully.",
                "CallbackMetadata": {
                    "Item": [
                        {"Name": "Amount", "Value": 105.50},
                        {"Name": "MpesaReceiptNumber", "Value": "NLJ7RT61SV"},
                        {"Name": "TransactionDate", "Value": 20191219102036},
                        {"Name": "PhoneNumber", "Value": 254708374149}
                    ]
                }
            }
        }
    }

    # Run through the standard pipeline (which also runs the phone normalization)
    daraja_payload = MpesaWebhookPayload(**payload_dict)

    # Execute the transformation
    etims_payload = ETIMSTransformer.transform_daraja_to_etims(daraja_payload)

    # Assert structural integrity and explicit types
    assert etims_payload.invoice_number == "NLJ7RT61SV"
    assert etims_payload.transaction_reference == "ws_CO_191220191020363925"
    assert etims_payload.amount == Decimal("105.50")
    assert etims_payload.customer_phone == "254708374149"
    assert etims_payload.transaction_date == "20191219102036"
    assert etims_payload.status == "PAID"
    assert etims_payload.sender_id == settings.etims_svd_sender_id
