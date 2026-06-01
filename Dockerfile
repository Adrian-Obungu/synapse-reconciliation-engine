# Stage 1: Builder
FROM python:3.11-slim AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies into a virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt


# Stage 2: Runtime
FROM python:3.11-slim

# Enforce Python unbuffered execution for accurate logging
ENV PYTHONUNBUFFERED=1
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /app

# Create dedicated non-root service user account
RUN useradd -m -s /bin/bash appuser

# Copy installed dependencies from builder stage
COPY --from=builder /opt/venv /opt/venv

# Copy application source code
COPY app/ /app/app/

# Enforce permissions
RUN chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 8000

# Execute FastAPI via Uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
