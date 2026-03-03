"""
Student Dashboard API - FastAPI Backend
Integrates with Dicoding Coding Camp scraper via ARQ task queue.
"""
import asyncio
import os
from contextlib import asynccontextmanager

from arq import create_pool
from arq.connections import RedisSettings
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router, public_router

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")


def _parse_redis_url(url: str) -> RedisSettings:
    """Parse redis://host:port into RedisSettings."""
    url = url.removeprefix("redis://")
    host, _, port_str = url.partition(":")
    port = int(port_str) if port_str else 6379
    return RedisSettings(host=host or "redis", port=port)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage ARQ Redis pool lifecycle and background monitoring."""
    import time
    from app.services.monitoring import DiscordMonitor

    app.state.start_time = time.time()
    app.state.arq_pool = await create_pool(_parse_redis_url(REDIS_URL))
    
    # Start Monitoring
    monitor = DiscordMonitor(app.state)
    monitor_task = asyncio.create_task(monitor.start())
    app.state.monitor = monitor

    yield
    
    # Cleanup
    monitor_task.cancel()
    try:
        await monitor_task
    except asyncio.CancelledError:
        pass
    
    await app.state.arq_pool.aclose()


app = FastAPI(
    title="Student Dashboard API",
    description="Backend API for student progress dashboard with Dicoding scraper integration",
    version="0.3.0",
    lifespan=lifespan,
)

# Configure CORS
cors_origins_raw = os.getenv("CORS_ORIGINS", "*")
if cors_origins_raw.strip() == "*":
    cors_origins = ["*"]
else:
    cors_origins = [o.strip() for o in cors_origins_raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(router, prefix="/api")
app.include_router(public_router, prefix="/api")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Student Dashboard API",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "ok"}
