# Security & Compliance Standards

The Synapse Reconciliation Engine handles sensitive financial metadata and PII (Personally Identifiable Information). Security is integrated at the architectural level to ensure compliance with the Kenya Data Protection Act (DPA) and enterprise risk management standards.

---

## 1. Data Sanitisation & Validation

### 1.1 Ingress Validation
All incoming payloads from the Safaricom Daraja API are strictly validated using Pydantic v2 schemas (`app/schemas/mpesa.py`). Any payload failing structural validation is rejected with an HTTP 422 Unprocessable Entity error before it reaches the application's business logic layer.

### 1.2 PII Handling
Phone numbers extracted from the Daraja payload are immediately passed through the `safe_normalize_phone` utility. In production environments, raw phone numbers should not be logged in plaintext. Structured logs currently retain the `checkout_request_id` and `mpesa_receipt_number` as correlation identifiers, which are not classified as PII.

---

## 2. Infrastructure Security

### 2.1 Dependency Management
The project uses pinned dependencies in `requirements.txt` to ensure deterministic builds and mitigate supply chain attacks.

### 2.2 Container Isolation
The provided Docker Compose topology runs the FastAPI application as a non-root user (`ubuntu`) within the container, adhering to the principle of least privilege.

---

## 3. Network Resilience

### 3.1 Idempotency Guard
The Redis-backed idempotency guard prevents replay attacks and duplicate processing. By using an atomic `SET NX` command, the engine guarantees that a given `CheckoutRequestID` is processed exactly once, regardless of concurrent network retries.

### 3.2 Outbound Throttling
The `httpx.AsyncClient` pool limits concurrent outbound connections to the KRA eTIMS API. This prevents the engine from becoming an unintentional vector for DDoS attacks against downstream regulatory infrastructure if the Daraja ingress experiences an anomalous spike.

---

## 4. Reporting Vulnerabilities

If you discover a security vulnerability within this repository, please do not disclose it publicly. Submit a detailed report via the GitHub repository's private vulnerability reporting feature or contact the maintainers directly.
