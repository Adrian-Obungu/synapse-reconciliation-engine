import json
import random
import uuid
from faker import Faker

def generate_mpesa_payload(faker, checkout_request_id, is_duplicate=False, is_dirty_phone=False, is_failure=False):
    merchant_request_id = str(uuid.uuid4())

    if is_failure:
        result_code = 1032
        result_desc = "Request cancelled by user"
        callback_metadata = None
    else:
        result_code = 0
        result_desc = "The service request is processed successfully."

        # Determine phone number format
        base_phone = faker.numerify('7########')
        if is_dirty_phone:
            dirty_formats = [
                f"0{base_phone}",       # 07... or 01...
                f"+254{base_phone}",    # +254...
                f"254{base_phone}",     # 254... (technically clean but included per prompt mix)
            ]
            # Replace start with 1 or 7 for base
            if random.random() > 0.5:
                base_phone = "1" + base_phone[1:]

            format_choice = random.choice([
                f"0{base_phone}",
                f"+254{base_phone}",
                f"254{base_phone}",
                base_phone
            ])
            phone_number = format_choice
        else:
            phone_number = f"254{base_phone}"

        callback_metadata = {
            "Item": [
                {"Name": "Amount", "Value": round(random.uniform(1.0, 10000.0), 2)},
                {"Name": "MpesaReceiptNumber", "Value": faker.bothify(text='??#?#?#?#?').upper()},
                {"Name": "Balance", "Value": round(random.uniform(0.0, 50000.0), 2)},
                {"Name": "TransactionDate", "Value": int(faker.date_time_this_year().strftime('%Y%m%d%H%M%S'))},
                {"Name": "PhoneNumber", "Value": phone_number}
            ]
        }

    payload = {
        "Body": {
            "stkCallback": {
                "MerchantRequestID": merchant_request_id,
                "CheckoutRequestID": checkout_request_id,
                "ResultCode": result_code,
                "ResultDesc": result_desc
            }
        }
    }

    if callback_metadata:
        payload["Body"]["stkCallback"]["CallbackMetadata"] = callback_metadata

    return payload

def main():
    faker = Faker()
    TOTAL_REQUESTS = 100000
    DUPLICATE_RATIO = 0.05
    DIRTY_PHONE_RATIO = 0.10
    FAILURE_RATIO = 0.15

    num_duplicates = int(TOTAL_REQUESTS * DUPLICATE_RATIO)
    num_unique = TOTAL_REQUESTS - num_duplicates

    unique_checkout_ids = [f"ws_CO_{faker.numerify('##################')}" for _ in range(num_unique)]
    duplicate_checkout_ids = random.choices(unique_checkout_ids, k=num_duplicates)

    all_checkout_ids = unique_checkout_ids + duplicate_checkout_ids
    random.shuffle(all_checkout_ids)

    # Track seen IDs to mark actual duplicates
    seen_ids = set()

    payloads = []

    for idx, checkout_request_id in enumerate(all_checkout_ids):
        is_duplicate = checkout_request_id in seen_ids
        seen_ids.add(checkout_request_id)

        is_failure = random.random() < FAILURE_RATIO
        is_dirty_phone = random.random() < DIRTY_PHONE_RATIO

        payload = generate_mpesa_payload(
            faker=faker,
            checkout_request_id=checkout_request_id,
            is_duplicate=is_duplicate,
            is_dirty_phone=is_dirty_phone,
            is_failure=is_failure
        )
        payloads.append(payload)

        if (idx + 1) % 10000 == 0:
            print(f"Generated {idx + 1} payloads...")

    output_file = "scripts/load_test_data.json"
    with open(output_file, "w") as f:
        json.dump(payloads, f)

    print(f"Successfully wrote {len(payloads)} records to {output_file}")

if __name__ == "__main__":
    main()
