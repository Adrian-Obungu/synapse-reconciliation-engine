import asyncio
import httpx
import json
import uuid

BASE_URL = "http://localhost:8000/api/v1/mpesa/callback"

def generate_payload(checkout_id: str, phone: any, result_code: int = 0, exclude_metadata: bool = False):
    merchant_id = str(uuid.uuid4())
    receipt_no = str(uuid.uuid4())[:10].upper()

    payload = {
        "Body": {
            "stkCallback": {
                "MerchantRequestID": merchant_id,
                "CheckoutRequestID": checkout_id,
                "ResultCode": result_code,
                "ResultDesc": "Simulation test execution" if result_code == 0 else "Failed execution"
            }
        }
    }

    if not exclude_metadata and result_code == 0:
        payload["Body"]["stkCallback"]["CallbackMetadata"] = {
            "Item": [
                {"Name": "Amount", "Value": 100.50},
                {"Name": "MpesaReceiptNumber", "Value": receipt_no},
                {"Name": "Balance", "Value": 0},
                {"Name": "TransactionDate", "Value": 20231015120000},
                {"Name": "PhoneNumber", "Value": phone}
            ]
        }

    return payload

async def run_scenarios():
    print("🚀 Starting Synapse Execution Scenarios Validation...\n")

    # Store ID for duplicate check
    scenario_1_id = f"ws_CO_{uuid.uuid4().hex[:12]}"

    scenarios = [
        ("Scenario 1: Clean E.164 phone layout", generate_payload(scenario_1_id, "254712345678")),
        ("Scenario 2: Dirty regional phone formatting ('07...')", generate_payload(f"ws_CO_{uuid.uuid4().hex[:12]}", "0712345678")),
        ("Scenario 3: Integer phone type conversion testing", generate_payload(f"ws_CO_{uuid.uuid4().hex[:12]}", 254712345678)),
        ("Scenario 4: E.164 string incorporating a leading '+' prefix", generate_payload(f"ws_CO_{uuid.uuid4().hex[:12]}", "+254712345678")),
        ("Scenario 5: Safaricom's custom 011x number range routing", generate_payload(f"ws_CO_{uuid.uuid4().hex[:12]}", "0112345678")),
        ("Scenario 6: Intentionally failed payment parameters (ResultCode != 0)", generate_payload(f"ws_CO_{uuid.uuid4().hex[:12]}", "254712345678", result_code=1032)),
        ("Scenario 7: A duplicate request containing the exact same ID as Scenario 1", generate_payload(scenario_1_id, "254712345678")),
        ("Scenario 8: Payload missing critical metadata parameters", generate_payload(f"ws_CO_{uuid.uuid4().hex[:12]}", "254712345678", exclude_metadata=True)),
    ]

    async with httpx.AsyncClient(timeout=10.0) as client:
        # Run scenarios 1 to 8 sequentially
        for name, payload in scenarios:
            try:
                response = await client.post(BASE_URL, json=payload)
                status = response.status_code
                print(f"✅ {name}")
                print(f"   ↳ Status: {status}, Response: {response.json()}")
            except Exception as e:
                print(f"❌ {name}")
                print(f"   ↳ Error: {e}")

        # Scenario 9: High-concurrency bulk load (50 concurrent requests)
        print("\n⏳ Executing Scenario 9: High-concurrency bulk load (50 concurrent requests)...")
        bulk_payloads = [generate_payload(f"ws_bulk_{uuid.uuid4().hex[:8]}", "254700000000") for _ in range(50)]

        async def send_req(payload):
            return await client.post(BASE_URL, json=payload)

        try:
            results = await asyncio.gather(*(send_req(p) for p in bulk_payloads))
            successes = sum(1 for r in results if r.status_code == 200)
            print(f"✅ Scenario 9 Complete")
            print(f"   ↳ 50 requests fired simultaneously. {successes}/50 returned 200 OK.")
        except Exception as e:
            print(f"❌ Scenario 9 Failed")
            print(f"   ↳ Error during bulk dispatch: {e}")

    print("\n🎉 Validation run finished. Check Docker logs for structural transformation accuracy and Redis atomic duplicate blocking.")

if __name__ == "__main__":
    asyncio.run(run_scenarios())
