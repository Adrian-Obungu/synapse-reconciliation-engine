import json
import sys
from pathlib import Path
from pydantic import ValidationError

# Dynamically inject the repository root into sys.path to allow standalone execution on Windows/Linux
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.schemas.mpesa import MpesaWebhookPayload

def validate_data():
    file_path = "scripts/load_test_data.json"
    print(f"Validating {file_path} against MpesaWebhookPayload schema...")

    with open(file_path, "r") as f:
        data = json.load(f)

    success_count = 0
    failure_count = 0
    validation_errors = 0

    for i, payload_dict in enumerate(data):
        try:
            # Parse and validate against the Pydantic schema
            payload = MpesaWebhookPayload(**payload_dict)

            # Count result codes
            if payload.Body.stkCallback.ResultCode == 0:
                success_count += 1
            else:
                failure_count += 1

        except ValidationError as e:
            validation_errors += 1
            if validation_errors <= 5:  # Print only first 5 errors to avoid spam
                print(f"Validation Error at index {i}:\n{e}\nPayload: {payload_dict}\n")

    total = len(data)
    print(f"Total Records: {total}")
    print(f"Successfully Validated Records: {total - validation_errors}")
    print(f"Validation Errors: {validation_errors}")

    if total > 0:
        print(f"Success Payload Ratio (ResultCode=0): {success_count / total * 100:.2f}% (Expected ~85%)")
        print(f"Failure Payload Ratio (ResultCode!=0): {failure_count / total * 100:.2f}% (Expected ~15%)")

    if validation_errors == 0:
        print("SUCCESS: All generated payloads strictly match the Pydantic schema.")
    else:
        print("ERROR: Schema validation failed for some payloads.")

if __name__ == "__main__":
    validate_data()
