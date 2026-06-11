import json
import asyncio
import httpx
import threading
from locust import User, task, events, between

test_data = []

# Background thread running the asyncio event loop for httpx
loop = asyncio.new_event_loop()
def start_background_loop(loop):
    asyncio.set_event_loop(loop)
    loop.run_forever()

threading.Thread(target=start_background_loop, args=(loop,), daemon=True).start()

async_client = None

@events.init.add_listener
def on_locust_init(environment, **_kwargs):
    global test_data, async_client
    with open("scripts/load_test_data.json", "r") as f:
        test_data = json.load(f)

    # Initialize the client strictly inside the dedicated asyncio loop thread
    async def init_client():
        global async_client
        async_client = httpx.AsyncClient(base_url=environment.host or "http://127.0.0.1:8000")

    asyncio.run_coroutine_threadsafe(init_client(), loop).result()

@events.quit.add_listener
def on_locust_quit(exit_code, **kwargs):
    async def close_client():
        if async_client:
            await async_client.aclose()

    try:
        asyncio.run_coroutine_threadsafe(close_client(), loop).result()
    except Exception:
        pass

class MpesaWebhookUser(User):
    wait_time = between(0.1, 0.5)

    def on_start(self):
        self.request_index = 0

    @task
    def send_mpesa_webhook(self):
        if not test_data:
            return

        payload = test_data[self.request_index % len(test_data)]
        self.request_index += 1

        # Dispatch the coroutine to the background asyncio loop thread
        # We wait for the result synchronously in Locust's gevent thread so it correctly
        # tracks timing without crashing the asyncio loop or blocking other Locust users completely
        # Note: While this still blocks the current greenlet, gevent will yield control.
        # However, to be fully async in gevent we should not block, but for httpx this is the safest way
        # to interface between gevent and asyncio.
        future = asyncio.run_coroutine_threadsafe(self._send_request(payload), loop)
        try:
            future.result(timeout=10.0)
        except Exception as e:
            self.environment.events.request.fire(
                request_type="POST",
                name="/api/v1/mpesa/callback",
                response_time=0,
                response_length=0,
                exception=e,
                context={}
            )

    async def _send_request(self, payload):
        try:
            response = await async_client.post("/api/v1/mpesa/callback", json=payload)
            self.environment.events.request.fire(
                request_type="POST",
                name="/api/v1/mpesa/callback",
                response_time=response.elapsed.total_seconds() * 1000,
                response_length=len(response.content),
                exception=None,
                context={}
            )
        except Exception as e:
            self.environment.events.request.fire(
                request_type="POST",
                name="/api/v1/mpesa/callback",
                response_time=0,
                response_length=0,
                exception=e,
                context={}
            )
            raise
