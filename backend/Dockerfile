# Stage 1: Install dependencies
FROM python:3.13.2-slim AS builder

WORKDIR /app

# Install uv package manager (pinned version)
COPY --from=ghcr.io/astral-sh/uv:0.6.6 /uv /usr/local/bin/uv

# Copy dependency files first for better layer caching
COPY pyproject.toml .python-version uv.lock ./

# Install dependencies into a virtual environment
RUN uv sync --frozen --no-dev

# Stage 2: Minimal runtime image
FROM python:3.13.2-slim AS runtime

WORKDIR /app

# Copy uv binary and the pre-built virtualenv from builder
COPY --from=ghcr.io/astral-sh/uv:0.6.6 /uv /usr/local/bin/uv
COPY --from=builder /app/.venv /app/.venv

# Copy application code
COPY app/ ./app/

# Create output directory and non-root user in one layer
RUN mkdir -p /app/output && \
    groupadd -r appgroup && \
    useradd -r -g appgroup appuser && \
    chown -R appuser:appgroup /app

USER appuser

# Expose port
EXPOSE 3000

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PATH="/app/.venv/bin:$PATH"

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:3000/health')" || exit 1

# Run the application directly via the venv (no uv run needed at runtime)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3000"]
