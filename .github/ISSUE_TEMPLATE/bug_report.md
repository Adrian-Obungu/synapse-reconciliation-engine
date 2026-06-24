---
name: Bug Report
about: Report a defect in the pipeline, schema transformer, or storage engine
title: "[BUG] "
labels: bug, triage
assignees: ''
---

## Summary
Provide a concise description of the bug.

## Pipeline Stage Affected
Select the stage where the defect was observed:
- [ ] Ingress / Webhook Validation
- [ ] Redis Idempotency Guard
- [ ] Phone Normalisation Engine
- [ ] eTIMS Schema Transformer
- [ ] Ledger Storage (PostgreSQL)
- [ ] eTIMS Outbound Client / Retry Loop
- [ ] Observability / Metrics

## Steps to Reproduce
Describe the exact steps required to reproduce the issue.

## Expected Behaviour
What should the system have done?

## Actual Behaviour
What did the system actually do? Include relevant log output.

```
Paste structured log output here
```

## Environment
- Python Version:
- Docker Compose Version:
- Commit SHA (`git rev-parse HEAD`):
