<div align="center">
  <img src="assets/synapse_banner.png" alt="Synapse Reconciliation Engine Banner" width="100%" />

  <h1>Synapse Reconciliation Engine</h1>
  <p><strong>Enterprise-Grade M-Pesa to KRA eTIMS Compliance Middleware</strong></p>

  <p>
    <a href="https://fastapi.tiangolo.com/"><img src="https://img.shields.io/badge/FastAPI-0.111.0-009688.svg?style=flat-square&logo=FastAPI&logoColor=white" alt="FastAPI" /></a>
    <a href="https://www.postgresql.org/"><img src="https://img.shields.io/badge/PostgreSQL-16-336791.svg?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL" /></a>
    <a href="https://redis.io/"><img src="https://img.shields.io/badge/Redis-7.2-DC382D.svg?style=flat-square&logo=redis&logoColor=white" alt="Redis" /></a>
    <a href="https://opentelemetry.io/"><img src="https://img.shields.io/badge/OpenTelemetry-Instrumented-2b3648.svg?style=flat-square" alt="OpenTelemetry" /></a>
    <a href="https://github.com/Adrian-Obungu/synapse-reconciliation-engine/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" alt="License" /></a>
  </p>
</div>

---

## 1. Executive Overview

The **Synapse Reconciliation Engine** is a high-performance, asynchronous middleware layer designed to bridge the gap between Safaricom's Daraja API (M-Pesa) and the Kenya Revenue Authority's (KRA) eTIMS compliance API. 

Built to solve the immediate compliance burden facing over 500,000 VAT-registered businesses in Kenya, the engine provides a fully automated, plug-and-play reconciliation pipeline. It intercepts M-Pesa STK Push webhooks, safely commits the transaction metadata to a persistent ledger, and seamlessly transforms the payload into a compliant electronic tax invoice.

By abstracting the integration complexity of two distinct financial domains, Synapse allows payment aggregators, POS vendors, and enterprise merchants to achieve zero-touch tax compliance.

---

## 2. Core Architecture

<div align="center">
  <img src="assets/synapse_pipeline_diagram.png" alt="Synapse Pipeline Architecture" width="85%" />
</div>

The engine operates on a strict, non-blocking asynchronous pipeline designed to meet Daraja's stringent sub-second acknowledgement SLA while ensuring absolute data durability.

### 2.1 Fast-Acknowledgement Gateway
Safaricom Daraja requires an immediate HTTP 200 OK response upon webhook delivery. The ingress gateway validates the payload via Pydantic v2 schemas and executes an atomic `SET NX` idempotency check against Redis. If the payload is structurally sound and novel, the gateway dispatches the transaction to a background worker and returns the acknowledgement instantly.

### 2.2 Regional Normalisation Engine
M-Pesa payloads often contain unstructured or regionally fragmented phone number formats (`07xx`, `011x`, `+254`, or integer coercions). The normalisation engine intercepts these inputs and standardises them into a strict E.164 canonical format (`254...`), ensuring downstream analytics and KRA schema compliance remain intact.

### 2.3 Dual-Storage State Engine
The engine abandons volatile memory in favour of a robust dual-storage facade:
- **Redis Idempotency Guard:** Prevents duplicate invoice generation during network retry storms using a 24-hour TTL atomic lock.
- **PostgreSQL Ledger:** Uses `asyncpg` connection pooling to commit transaction records to disk with sub-50ms latency, providing an immutable audit trail for reconciliation.

### 2.4 Context-Aware Schema Transformer
The boundary between the Safaricom domain and the KRA domain is strictly enforced. The transformer extracts the required fields (`MpesaReceiptNumber`, `Amount`, `PhoneNumber`) from Daraja's nested metadata array and maps them onto the strict `saveVscu` JSON structure expected by the eTIMS API.

---

## 3. Resilience & Observability

Enterprise financial middleware must degrade gracefully under load. Synapse is instrumented with OpenTelemetry and designed for extreme resilience.

- **Throttled Connection Pooling:** Outbound eTIMS submissions are routed through a shared `httpx.AsyncClient` pool (max 200 connections, 100 keepalive) to prevent file descriptor exhaustion.
- **Exponential Backoff:** A 3-try exponential backoff loop with jitter handles upstream KRA API degradation without causing retry storms.
- **Distributed Tracing:** Every invoice submission is tracked via OpenTelemetry, correlating the parent M-Pesa webhook to the child eTIMS HTTP spans in Jaeger.
- **Prometheus Alerting:** The stack includes pre-configured alert rules for connection pool saturation, SLA latency breaches (P99 > 5s), and retry exhaustion.

---

## 4. Getting Started

### Prerequisites
- Docker Engine 24.0+ and Docker Compose v2
- Python 3.11+ (for local simulation execution)

### Launching the Stack
The repository includes a complete, production-aligned Docker Compose topology encompassing the FastAPI application, Postgres, Redis, the OpenTelemetry Collector, Prometheus, Jaeger, and Grafana.

```bash
# Clone the repository
git clone https://github.com/Adrian-Obungu/synapse-reconciliation-engine.git
cd synapse-reconciliation-engine

# Boot the entire observability and application stack
docker compose up -d

# Verify service health
docker compose ps
```

### Running the Simulation Harness
To validate the architecture, the repository includes a deterministic simulation harness that fires 9 distinct scenarios (including dirty data, duplicates, and bulk concurrent loads) against the local instance.

```bash
# Install simulation dependencies
pip install -r requirements.txt

# Execute the end-to-end validation suite
python scripts/simulate.py
```

---

## 5. Documentation

For detailed technical specifications, refer to the following documents:
- [Architecture & Code Consolidation](docs/ARCHITECTURE.md)
- [Security & Compliance Standards](docs/SECURITY.md)
- [Contributing Guidelines](CONTRIBUTING.md)

---
<div align="center">
  <p><em>Engineered for the East African Digital Economy</em></p>
  <p>Nairobi, Kenya</p>
</div>
