import os
import httpx
from datetime import datetime, date, timezone, timedelta
from sqlmodel import select, func, col
from app.db import get_session
from app.models import RequestLog


def _normalize_class_name(class_name: str | None) -> str:
    return (class_name or "").strip() or "Unknown"


class NotificationService:
    def __init__(self):
        self.webhook_url = os.getenv("DISCORD_STATS_WEBHOOK_URL")

    async def get_daily_stats(self) -> dict:
        """Get count of completed requests per class for today (WIB)"""
        # Calculate today in WIB (UTC+7)
        wib = timezone(timedelta(hours=7))
        today_wib = datetime.now(wib).date()
        
        stats = {}
        
        # We need a fresh session here since this might be called from a worker
        # that doesn't share the dependency injection context easily
        async for session in get_session():
            # Query for today's logs (casting timestamp to date in DB might be tricky with TZ, 
            # so we can filter by range or assume the store handles it if using timestamptz)
            # Simplest: filter where date(timestamp) == today_wib
            # But since we store with timezone info now, we should compare dates carefully.
            
            # Note: SQLite/Postgres might behave differently with func.date on TZ-aware datetime.
            # Assuming Postgres with managed service.
            query = select(RequestLog.class_name, func.count(RequestLog.id)).where(
                func.date(RequestLog.timestamp) == today_wib,
                RequestLog.status == "completed"
            ).group_by(RequestLog.class_name)
            
            result = await session.exec(query)
            for class_name, count in result:
                class_name = _normalize_class_name(class_name)
                # Aggregate by prefix (e.g. CAC-19 -> CAC)
                prefix = class_name.split("-")[0].strip().upper() if "-" in class_name else class_name
                # Handle known prefixes or fallback
                if prefix in ["CAC", "CDC", "CFC"]:
                    stats[prefix] = stats.get(prefix, 0) + count
                else:
                    stats[class_name] = stats.get(class_name, 0) + count
            
            break # We only need one session yield
            
        return stats

    async def send_webhook(
        self,
        facilitator_name: str,
        class_name: str,
        status: str,
        message: str = "",
        error_type: str = "",
    ):
        """Send Discord webhook"""
        if not self.webhook_url:
            print("DISCORD_STATS_WEBHOOK_URL not set, skipping notification")
            return

        # Get stats for the "dashboard" part of the message
        stats = await self.get_daily_stats()

        # Determine color and title based on status
        color = 0x3498db  # Blue (Started)
        title = "🚀 Scraping Started"

        if status == "completed":
            color = 0x2ecc71  # Green (Completed)
            title = "✅ Scraping Completed"
        elif status == "failed":
            if error_type == "invalid_credentials":
                color = 0xe67e22  # Orange (Auth error)
                title = "🔐 Login Failed — Invalid Credentials"
            else:
                color = 0xe74c3c  # Red (Failed)
                title = "❌ Scraping Failed"

        # Build stats field text
        stats_lines = []
        # Priority classes
        for c in ["CFC", "CDC", "CAC"]:
            count = stats.get(c, 0)
            stats_lines.append(f"**{c}**: {count}")

        # Other classes
        for c, count in stats.items():
            if c not in ["CFC", "CDC", "CAC"]:
                stats_lines.append(f"**{c}**: {count}")

        stats_value = "\n".join(stats_lines) if stats_lines else "No data yet"

        # Build embed fields
        fields = []

        if error_type == "invalid_credentials":
            fields.append({
                "name": "Reason",
                "value": "The provided email or password was rejected by Dicoding.",
                "inline": False,
            })
        else:
            fields.append({
                "name": "Facilitator",
                "value": facilitator_name or "Unknown",
                "inline": True,
            })
            fields.append({
                "name": "Class",
                "value": class_name or "Unknown",
                "inline": True,
            })

        fields.append({
            "name": "Daily Stats (WIB)",
            "value": stats_value,
            "inline": False,
        })

        # Build embed
        embed = {
            "title": title,
            "color": color,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "fields": fields,
            "footer": {
                "text": "Student Dashboard Scraper"
            },
        }

        if message:
            embed["description"] = f"**Message**: {message}"

        async with httpx.AsyncClient() as client:
            try:
                await client.post(self.webhook_url, json={"embeds": [embed]})
            except Exception as e:
                print(f"Failed to send Discord webhook: {e}")
