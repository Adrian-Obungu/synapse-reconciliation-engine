# Contributing to Synapse Reconciliation Engine

We welcome contributions from the community. Whether you are fixing a bug, improving documentation, or proposing a new feature, please follow these guidelines to ensure a smooth collaborative process.

---

## 1. Development Environment Setup

1. **Fork and Clone:** Fork the repository to your GitHub account and clone it locally.
2. **Virtual Environment:** Create a Python 3.11+ virtual environment.
   ```bash
   python -m venv venv
   source venv/bin/activate
   ```
3. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
4. **Run Tests:** Ensure the existing test suite passes before making changes.
   ```bash
   pytest tests/
   ```

---

## 2. Contribution Workflow

### 2.1 Branch Naming
Use descriptive branch names that indicate the purpose of the contribution:
- `feature/short-description`
- `fix/issue-description`
- `docs/update-description`

### 2.2 Coding Standards
- **Type Hints:** All Python functions must include comprehensive type hints.
- **Async/Await:** Maintain the non-blocking architecture. Do not introduce synchronous I/O calls (e.g., `requests`, `time.sleep()`) in the main execution path.
- **Logging:** Use the structured `logger` instance rather than `print()`. Include relevant context (e.g., `checkout_request_id`).

### 2.3 Pull Requests
- Open a Pull Request against the `main` branch.
- Provide a clear description of the changes, the rationale behind them, and any related issue numbers.
- Ensure all tests pass and add new tests for any introduced functionality.

---

## 3. Simulation & Validation

Before submitting a PR, validate your changes using the deterministic simulation harness:

```bash
# Ensure the Docker stack is running
docker compose up -d

# Run the simulation scenarios
python scripts/simulate.py
```

All scenarios must report `✅` (success). If a scenario fails, review the application logs (`docker compose logs app`) to diagnose the issue.
