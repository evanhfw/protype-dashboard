FROM python:3.14-slim

WORKDIR /app

# Install uv package manager from official image
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy dependency files
COPY pyproject.toml .
COPY .python-version .
COPY uv.lock .

RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libpango-1.0-0 libcairo2 libasound2 libatspi2.0-0 \
    && rm -rf /var/lib/apt/lists/*

RUN uv sync --frozen --no-dev
RUN uv run playwright install chromium

# Copy application code
COPY app/ ./app/

# Create output directory for scraped data
RUN mkdir -p /app/output

# Expose port
EXPOSE 3000

# Set environment variables
ENV PYTHONUNBUFFERED=1

# Run with uv
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3000"]
