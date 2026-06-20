import json
import sys
from pathlib import Path
from locust import FastHttpUser, task, events, between

test_data = []

@events.init.add_listener
def on_locust_init(environment, **_kwargs):
    global test_data
    # Use deterministic relative path tracing to find data regardless of run directory
    data_path = Path(__file__).parent / "scripts" / "load_test_data.json"
    try:
        with open(data_path, "r") as f:
            test_data = json.load(f)
    except FileNotFoundError:
        print(f"Error: '{data_path}' not found. Run 'python scripts/generate_test_data.py' first.")
        sys.exit(1)

class MpesaWebhookUser(FastHttpUser):
    # Match our planned concurrency pace bounds
    wait_time = between(0.1, 0.5)

    def on_start(self):
        self.request_index = 0

    @task
    def send_mpesa_webhook(self):
        if not test_data:
            return

        payload = test_data[self.request_index % len(test_data)]
        self.request_index += 1

        # FastHttpUser client automatically tracks non-blocking network time, timeouts,
        # and errors inside native gevent greenlets without double-firing metrics.
        self.client.post("/api/v1/mpesa/callback", json=payload)
