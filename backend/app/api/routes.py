"""
API Routes for Student Dashboard
All endpoints are protected by API Key authentication (when API_KEY is configured).
Job management is backed by ARQ + Redis.
"""
import asyncio
import json
import time
from typing import Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr
from arq.jobs import Job, JobStatus

from app.api.auth import require_api_key
from app.utils.file_handler import FileHandler
from app.utils.parser import DataTransformer
from app.db import get_session
from app.models import RequestLog


class ScrapeRequest(BaseModel):
    """Request model for scraping with credentials"""
    email: EmailStr
    password: str


router = APIRouter(dependencies=[Depends(require_api_key)])
# Separate public router (no API key required)
public_router = APIRouter()
file_handler = FileHandler()
transformer = DataTransformer()


@public_router.get("/stats/scraping")
async def get_scraping_stats() -> Dict[str, Any]:
    """
    Public endpoint: Get scraping statistics for the landing page.
    Returns today's completed scrapes grouped by cohort prefix (CAC, CDC, CFC)
    and all-time total completed scrapes.
    """
    from datetime import datetime, timezone, timedelta
    from sqlmodel import select, func

    wib = timezone(timedelta(hours=7))
    today_wib = datetime.now(wib).date()

    today_stats: Dict[str, int] = {}
    total_all_time = 0

    try:
        async for session in get_session():
            # Today's completed scrapes by class prefix
            query_today = select(
                RequestLog.class_name, func.count(RequestLog.id)
            ).where(
                func.date(RequestLog.timestamp) == today_wib,
                RequestLog.status == "completed"
            ).group_by(RequestLog.class_name)

            result = await session.exec(query_today)
            for class_name, count in result:
                prefix = class_name.split("-")[0].strip().upper() if "-" in class_name else class_name
                if prefix in ["CAC", "CDC", "CFC"]:
                    today_stats[prefix] = today_stats.get(prefix, 0) + count
                else:
                    today_stats[class_name] = today_stats.get(class_name, 0) + count

            # Total all-time completed scrapes
            query_total = select(func.count(RequestLog.id)).where(
                RequestLog.status == "completed"
            )
            total_result = await session.exec(query_total)
            total_all_time = total_result.one_or_none() or 0

            break
    except Exception as e:
        print(f"Stats query error: {e}")

    return {
        "today": today_stats,
        "total_completed": total_all_time,
    }

async def _decode_progress(arq_pool, job_id: str) -> Dict[str, Any] | None:
    """Decode progress payload from Redis (supports JSON + legacy pipe format)."""
    progress_data = await arq_pool.get(f"job_progress:{job_id}")
    if not progress_data:
        return None

    decoded = progress_data.decode()

    try:
        payload = json.loads(decoded)
        return {
            "percent": int(payload.get("percent", 0)),
            "message": str(payload.get("message", "")),
            "current_step": int(payload.get("current_step", 0)),
            "total_steps": int(payload.get("total_steps", 100)),
            "updated_at": payload.get("updated_at"),
        }
    except (ValueError, TypeError, json.JSONDecodeError):
        pass

    # Legacy format: "percent|message|current|total"
    try:
        percent, msg, current, total = decoded.split("|")
        return {
            "percent": int(percent),
            "message": msg,
            "current_step": int(current),
            "total_steps": int(total),
            "updated_at": None,
        }
    except Exception:
        return None


async def _build_job_status(job_id: str, request: Request) -> Dict[str, Any]:
    """Build a unified job status payload for polling and SSE."""
    arq_pool = request.app.state.arq_pool
    job = Job(job_id=job_id, redis=arq_pool)
    status = await job.status()

    response: Dict[str, Any] = {
        "job_id": job_id,
        "status": status.value,
    }

    if status == JobStatus.queued:
        response["running"] = True
        response["message"] = "Job is queued, waiting for available worker slot."
        try:
            queued_jobs = await arq_pool.queued_jobs()
            position = next((i for i, j in enumerate(queued_jobs) if j.job_id == job_id), None)
            if position is not None:
                response["queue_position"] = position + 1
        except Exception:
            pass

    elif status == JobStatus.in_progress:
        response["running"] = True
        response["message"] = "Scraping in progress..."
        try:
            progress = await _decode_progress(arq_pool, job_id)
            if progress:
                response["progress"] = progress
                response["message"] = progress.get("message") or response["message"]
        except Exception:
            pass

    elif status == JobStatus.complete:
        response["running"] = False
        info = await job.info()
        if info and info.result is not None:
            response["result"] = info.result
            response["progress"] = {
                "percent": 100,
                "message": "Complete",
                "current_step": 100,
                "total_steps": 100,
                "updated_at": None,
            }
        elif info and info.result is None:
            response["result"] = {"success": False, "error": "Job completed with no result"}

    elif status == JobStatus.not_found:
        response["running"] = False
        response["result"] = None
        response["message"] = "Job not found or expired."
    else:
        response["running"] = False

    return response


@router.get("/students")
async def get_students() -> Dict[str, Any]:
    """
    Get the latest student data

    Returns transformed student data from the most recent scrape
    """
    try:
        latest_data = await file_handler.get_latest_data()

        if not latest_data:
            raise HTTPException(
                status_code=404,
                detail="No student data found. Please run scraper first."
            )

        transformed = transformer.transform_dicodex_to_dashboard(latest_data)
        return transformed
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading data: {str(e)}")


@router.post("/scrape")
async def trigger_scrape(
    credentials: ScrapeRequest,
    request: Request,
) -> Dict[str, Any]:
    """
    Trigger a new scraping job with user-provided credentials.

    The job is enqueued in Redis via ARQ. Returns a job_id for polling.
    ARQ worker handles concurrency (max 5) and queueing automatically.
    """
    arq_pool = request.app.state.arq_pool

    job = await arq_pool.enqueue_job(
        "scrape_task",
        credentials.email,
        credentials.password,
    )

    if job is None:
        raise HTTPException(
            status_code=409,
            detail="A job with the same parameters is already queued or running.",
        )

    return {
        "status": "queued",
        "job_id": job.job_id,
        "message": f"Scraping job queued. Check /api/scrape/status/{job.job_id} for progress.",
    }


@router.get("/scrape/status")
async def get_scrape_status(request: Request) -> Dict[str, Any]:
    """
    Get aggregated scraper status (backward compatible).

    Returns basic info about the ARQ worker queue.
    """
    arq_pool = request.app.state.arq_pool

    # Get queue info from Redis
    queued_jobs = await arq_pool.queued_jobs()

    return {
        "queued_count": len(queued_jobs) if queued_jobs else 0,
        "jobs": [
            {"job_id": j.job_id, "function": j.function, "enqueue_time": str(j.enqueue_time)}
            for j in (queued_jobs or [])[:20]
        ],
    }


@router.get("/scrape/status/{job_id}")
async def get_job_status(job_id: str, request: Request) -> Dict[str, Any]:
    """
    Get the status of a specific scraping job.

    Possible statuses: queued, in_progress, complete, not_found, deferred
    """
    return await _build_job_status(job_id, request)


@router.get("/scrape/stream/{job_id}")
async def stream_job_status(job_id: str, request: Request) -> StreamingResponse:
    """
    Stream realtime job status updates via SSE.
    """
    async def event_stream():
        last_payload: str | None = None
        last_heartbeat = time.monotonic()

        while True:
            if await request.is_disconnected():
                break

            status_payload = await _build_job_status(job_id, request)
            status_name = str(status_payload.get("status"))
            result_obj = status_payload.get("result")
            result_success = result_obj.get("success") if isinstance(result_obj, dict) else None
            if status_name == "complete":
                event_name = "complete"
            elif status_name == "not_found":
                event_name = "error"
            elif result_success is False:
                event_name = "error"
            elif status_payload.get("progress"):
                event_name = "progress"
            else:
                event_name = "status"

            serialized = json.dumps(status_payload, ensure_ascii=False)
            if serialized != last_payload:
                yield f"event: {event_name}\ndata: {serialized}\n\n"
                last_payload = serialized

            now = time.monotonic()
            if now - last_heartbeat >= 15:
                heartbeat = {"job_id": job_id, "ts": int(time.time())}
                yield f"event: heartbeat\ndata: {json.dumps(heartbeat)}\n\n"
                last_heartbeat = now

            if status_name in {"complete", "not_found"}:
                break
            if result_success is False:
                break

            await asyncio.sleep(0.5)

    headers = {
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    return StreamingResponse(event_stream(), media_type="text/event-stream", headers=headers)


@router.get("/files")
async def list_files() -> Dict[str, Any]:
    """
    List all available scraped data files

    Returns a list of JSON files with metadata (size, timestamps)
    """
    try:
        files = await file_handler.list_all_files()
        return {"files": files, "total": len(files)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing files: {str(e)}")


@router.get("/files/{filename}")
async def get_file_by_name(filename: str) -> Dict[str, Any]:
    """
    Get data from a specific file

    Args:
        filename: Name of the JSON file (e.g., "CAC-19_20260215T074815Z.json")
    """
    try:
        data = await file_handler.get_file_by_name(filename)

        if not data:
            raise HTTPException(status_code=404, detail=f"File not found: {filename}")

        transformed = transformer.transform_dicodex_to_dashboard(data)
        return transformed
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"File not found: {filename}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading file: {str(e)}")
