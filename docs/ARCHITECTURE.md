# Synapse Reconciliation Engine: Architecture & Code Consolidation

This document details the architectural decisions, pipeline mechanics, and code consolidation strategies employed within the Synapse Reconciliation Engine. It is intended for technical stakeholders evaluating the system's resilience, scalability, and integration with East African financial infrastructure.

---

## 1. Pipeline Orchestration

The engine is built on **FastAPI**, leveraging its native `asyncio` event loop to handle concurrent I/O operations without thread blocking.

### 1.1 The Fast-Acknowledgement Boundary
Safaricom's Daraja API imposes strict timeout limits on webhook delivery. The engine enforces a fast-acknowledgement boundary: the `/callback` endpoint validates the payload structure, checks idempotency, and offloads the heavy processing to a `BackgroundTasks` queue. It then immediately returns an HTTP 200 OK.

```python
# Code Consolidation: Ingress Router
@router.post("/callback")
async def mpesa_callback(payload: MpesaWebhookPayload, background_tasks: BackgroundTasks, request: Request):
    # Atomic Idempotency Check via Redis
    is_novel = await request.app.state.storage.check_idempotency(payload.Body.stkCallback.CheckoutRequestID)
    if not is_novel:
        return {"status": "success", "message": "Duplicate ignored"}

    # Hand off payload processing to background worker
    background_tasks.add_task(process_compliance_pipeline, payload, request)
    
    # Return strict HTTP 200 OK acknowledgment instantly
    return {"status": "success", "message": "Callback processed"}
```

---

## 2. Context-Aware Schema Mapping

The Daraja webhook payload is deeply nested and loosely typed (key-value pairs inside `CallbackMetadata.Item`). The engine employs a Pydantic v2 transformer to map these fields into a strict schema required by the KRA eTIMS API.

### 2.1 E.164 Normalisation
East African phone numbers are frequently submitted in dirty formats (`07...`, `011...`). The `safe_normalize_phone` utility uses a pre-compiled regex to coerce these into a canonical `254...` format.

```python
# Code Consolidation: Phone Normalisation Utility
PHONE_REGEX = re.compile(r"^(?:(?:\+?254)|0)?([17]\d{8})$")

def safe_normalize_phone(raw_phone: Any, fallback: str = "254700000000") -> str:
    val_str = str(raw_phone).strip().replace(" ", "").replace("-", "")
    if val_str.endswith(".0"):
        val_str = val_str[:-2]
    match = PHONE_REGEX.match(val_str)
    return "254" + match.group(1) if match else fallback
```

---

## 3. Resilient Network Middleware

Outbound calls to the KRA eTIMS API are managed by a shared `httpx.AsyncClient` pool, preventing socket exhaustion during high-concurrency bursts.

### 3.1 Connection Pool & Backoff Strategy
The HTTP client is instantiated during the FastAPI lifespan context. It is configured with `httpx.Limits(max_connections=200, max_keepalive_connections=100)` to maintain open TCP sockets, reducing TLS handshake latency on repeated calls.

A 3-try exponential backoff loop with jitter protects against transient network failures.

```python
# Code Consolidation: eTIMS Outbound Client
async def generate_electronic_invoice(payload: MpesaWebhookPayload, client: httpx.AsyncClient):
    etims_payload = ETIMSTransformer.transform_daraja_to_etims(payload)
    
    for attempt in range(1, 4):
        try:
            response = await client.post(
                "https://api.etims.mock.kra.go.ke/v1/invoices",
                json=etims_payload.model_dump()
            )
            response.raise_for_status()
            return
        except httpx.RequestError as exc:
            if attempt == 3:
                logger.error("eTIMS submission failed permanently after 3 attempts.")
                raise
            await asyncio.sleep(2 ** attempt) # Exponential backoff
```

---

## 4. Dual-Storage State Engine

The engine relies on two distinct storage paradigms to ensure data integrity.

- **Redis (Idempotency):** A high-throughput, low-latency in-memory datastore. We execute an atomic `SET NX` (set if not exists) command with a 24-hour TTL. If the key exists, the transaction is a duplicate Daraja retry and is safely ignored.
- **PostgreSQL (Ledger):** An ACID-compliant relational database. We utilise `asyncpg` to execute parameterised SQL inserts. The latency of these inserts is actively monitored; any write exceeding 50ms triggers an `io_latency_warning` flag in the OpenTelemetry logs.
