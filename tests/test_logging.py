import logging
import json
from app.core.logging import JSONFormatter

def test_json_formatter_outputs_event_type():
    # Setup test formatter instance
    formatter = JSONFormatter()

    # Create an explicit record with our newly introduced extra fields
    record = logging.LogRecord(
        name="test_logger",
        level=logging.INFO,
        pathname="test.py",
        lineno=10,
        msg="Testing structured layout output",
        args=(),
        exc_info=None
    )
    # Inject our telemetry markers directly
    record.event_type = "CACHE_HIT"
    record.async_lag_ms = 12.5

    formatted_output = formatter.format(record)
    parsed_json = json.loads(formatted_output)

    # Assert fields pass structural output criteria safely
    assert parsed_json["event_type"] == "CACHE_HIT"
    assert parsed_json["async_lag_ms"] == 12.5
