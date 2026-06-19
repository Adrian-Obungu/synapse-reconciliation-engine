import logging
import json
from datetime import datetime, timezone

class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_obj = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "log_level": record.levelname,
            "module": record.name,
            "message": record.getMessage()
        }

        # Inject any additional context (like CheckoutRequestID, MpesaReceiptNumber) passed via the `extra` dictionary
        if hasattr(record, "hdd_baseline_write_mbps"):
            log_obj["hdd_baseline_write_mbps"] = record.hdd_baseline_write_mbps
        if hasattr(record, "checkout_request_id"):
            log_obj["checkout_request_id"] = record.checkout_request_id
        if hasattr(record, "mpesa_receipt_number"):
            log_obj["mpesa_receipt_number"] = record.mpesa_receipt_number
        if hasattr(record, "event_type"):
            log_obj["event_type"] = record.event_type
        if hasattr(record, "io_latency_warning"):
            log_obj["io_latency_warning"] = record.io_latency_warning
        if hasattr(record, "async_lag_ms"):
            log_obj["async_lag_ms"] = record.async_lag_ms

        return json.dumps(log_obj)

def setup_structured_logging():
    logger = logging.getLogger()

    # Remove existing handlers to avoid duplicates
    for handler in logger.handlers[:]:
        logger.removeHandler(handler)

    handler = logging.StreamHandler()
    handler.setFormatter(JSONFormatter())

    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
