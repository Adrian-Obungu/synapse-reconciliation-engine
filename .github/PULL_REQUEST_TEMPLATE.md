## Summary
Provide a concise description of the changes introduced by this PR.

## Type of Change
- [ ] Bug fix (non-breaking change that resolves an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that alters existing behaviour)
- [ ] Documentation update

## Pipeline Stages Modified
- [ ] Ingress / Webhook Validation
- [ ] Redis Idempotency Guard
- [ ] Phone Normalisation Engine
- [ ] eTIMS Schema Transformer
- [ ] Ledger Storage (PostgreSQL)
- [ ] eTIMS Outbound Client / Retry Loop
- [ ] Observability / Metrics
- [ ] Docker Compose / Infrastructure

## Testing
Describe the tests that were run to validate this change. Confirm the simulation harness was executed.

```bash
# Simulation output
python scripts/simulate.py
```

- [ ] All 9 simulation scenarios passed
- [ ] Existing unit tests pass (`pytest tests/`)
- [ ] New tests added for new functionality

## Checklist
- [ ] Code follows the project's async-first, type-hinted style
- [ ] No synchronous I/O introduced in the main execution path
- [ ] Structured logging used (no `print()` statements)
- [ ] Documentation updated if applicable
