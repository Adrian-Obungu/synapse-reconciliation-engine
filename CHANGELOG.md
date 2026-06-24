# Changelog

All notable changes to the Synapse Reconciliation Engine will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- **Enterprise Architecture:** Fully asynchronous pipeline bridging M-Pesa Daraja and KRA eTIMS.
- **Dual-Storage Engine:** Redis-backed idempotency guard (`SET NX`) and PostgreSQL transaction ledger (`asyncpg`).
- **Schema Transformer:** Pydantic v2 dynamic mapping from nested Daraja webhooks to strict eTIMS payloads.
- **Regional Normalisation:** Pre-compiled regex utility (`safe_normalize_phone`) for E.164 East African phone standardisation.
- **Resilient Middleware:** Throttled `httpx.AsyncClient` pool with exponential backoff and jitter.
- **Observability Stack:** OpenTelemetry instrumentation, Prometheus metrics, Jaeger distributed tracing, and Grafana provisioning.
- **Simulation Harness:** Deterministic 9-scenario test suite (`scripts/simulate.py`) including bulk concurrency validation.
- **Documentation:** Enterprise-grade README, ARCHITECTURE.md, SECURITY.md, and CONTRIBUTING.md.

### Changed
- Refactored `LedgerAutomationService` to utilise the new `StorageEngine` for persistent I/O.
- Refactored `ETIMSComplianceService` to utilise the shared `httpx` connection pool and `ETIMSTransformer`.
- Updated FastAPI `/callback` router to enforce the fast-acknowledgement boundary strictly.

### Fixed
- Addressed Prometheus alert evaluation windows to prevent false positives during rapid simulation bursts.
- Resolved Grafana dashboard panel queries for accurate connection pool tracking.
