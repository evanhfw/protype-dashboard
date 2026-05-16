"""
ARQ Worker — runs scraping jobs from the Redis queue.

Start with:  arq app.worker.WorkerSettings
"""
import asyncio
import json
import os
from pathlib import Path
from datetime import datetime, timezone

from arq.connections import RedisSettings
from dotenv import load_dotenv

# Load environment variables (for local dev)
load_dotenv(dotenv_path=Path(__file__).parent.parent.parent / ".env")

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")


def _parse_redis_url(url: str) -> RedisSettings:
    """Parse redis://host:port into RedisSettings."""
    url = url.removeprefix("redis://")
    host, _, port_str = url.partition(":")
    port = int(port_str) if port_str else 6379
    return RedisSettings(host=host or "redis", port=port)


from app.db import init_db, get_session
from app.models import RequestLog
from app.services.notification import NotificationService
from app.services.scraper import InvalidCredentialsError


async def startup(ctx):
    """Initialize DB on worker startup"""
    await init_db()


async def handle_scrape_event(event: str, data: dict, notification_service: NotificationService):
    """Handle scraping events (logging + webhook)"""
    facilitator = "Unknown"
    group = "Unknown"
    status = event
    message = ""
    error_type = data.get("error_type", "")

    if event == "started":
        # Data is mentor_info
        facilitator = data.get("name", "Unknown")
        group = data.get("group", "Unknown")
    elif event == "completed":
        # Data is full result
        mentor = data.get("mentor", {})
        facilitator = mentor.get("name", "Unknown")
        group = mentor.get("group", "Unknown")
    elif event == "failed":
        # Data might have error info
        facilitator = data.get("facilitator", "Unknown")
        group = data.get("group", "Unknown")
        message = str(data.get("error", ""))

    # Db Logging
    try:
        async for session in get_session():
            log = RequestLog(
                facilitator_name=facilitator,
                class_name=group,
                status=status,
                message=message
            )
            session.add(log)
            await session.commit()
            break
    except Exception as e:
        print(f"Failed to log request to DB: {e}")

    # Webhook
    await notification_service.send_webhook(
        facilitator_name=facilitator,
        class_name=group,
        status=status,
        message=message,
        error_type=error_type,
    )


async def scrape_task(ctx: dict, email: str, password: str) -> dict:
    """
    ARQ task: run the Dicoding scraper.

    Playwright runs synchronously inside the thread via asyncio.to_thread.
    """
    from app.services.scraper import ScraperService

    loop = asyncio.get_running_loop()
    notification_service = NotificationService()
    redis = ctx["redis"]
    job_id = ctx.get("job_id") or "unknown"
    progress_key = f"job_progress:{job_id}"

    async def write_progress(
        percent: int,
        message: str,
        current_step: int,
        total_steps: int,
    ) -> None:
        payload = {
            "percent": max(0, min(100, int(percent))),
            "message": message,
            "current_step": int(current_step),
            "total_steps": int(total_steps),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        await redis.set(progress_key, json.dumps(payload).encode("utf-8"), ex=7200)

    def on_progress(event, data):
        asyncio.run_coroutine_threadsafe(
            handle_scrape_event(event, data, notification_service), loop
        )

    def on_step_progress(message: str, current_step: int, total_steps: int):
        percent = int((current_step / max(total_steps, 1)) * 100)
        asyncio.run_coroutine_threadsafe(
            write_progress(percent, message, current_step, total_steps), loop
        )

    scraper = ScraperService()

    try:
        await write_progress(1, "Initializing scraper...", 1, 100)

        result = await asyncio.to_thread(
            scraper.run_scraper,
            email=email,
            password=password,
            on_progress=on_progress,
            progress_callback=on_step_progress,
        )

        await write_progress(100, "Complete", 100, 100)
        await handle_scrape_event("completed", result, notification_service)
        return result

    except InvalidCredentialsError as e:
        await write_progress(100, str(e), 100, 100)
        await handle_scrape_event(
            "failed",
            {"error": str(e), "error_type": "invalid_credentials"},
            notification_service,
        )
        return {"success": False, "error": str(e), "error_type": "invalid_credentials"}

    except Exception as e:
        await write_progress(100, f"Failed: {str(e)}", 100, 100)
        await handle_scrape_event("failed", {"error": str(e)}, notification_service)
        raise


class WorkerSettings:
    """ARQ worker configuration."""

    functions = [scrape_task]
    redis_settings = _parse_redis_url(REDIS_URL)

    on_startup = startup

    # Concurrency: max 3 scrape jobs at once
    max_jobs = 3

    # Timeout: 10 minutes per scrape job
    job_timeout = 600

    # Keep results in Redis for 1 hour so frontend can poll
    keep_result = 3600

    # Retry once on failure
    max_tries = 2

    # Health check interval
    health_check_interval = 30
