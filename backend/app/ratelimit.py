import logging
import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException, Request

from .db import get_client

log = logging.getLogger("meowpin.ratelimit")


class RateLimiter:
    """จำกัดจำนวนครั้งต่อช่วงเวลา — นับในฐานข้อมูล (ไม่รีเซ็ตตอน server รีสตาร์ท)
    ถ้าฐานข้อมูลใช้ไม่ได้ (เช่นยังไม่ได้รัน migration 0018) นับในหน่วยความจำแทน"""

    def __init__(self, name: str, limit: int, window_s: float, message: str):
        self.name = name
        self.limit = limit
        self.window_s = window_s
        self.message = message
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def check(self, key: str) -> None:
        try:
            allowed = (
                get_client()
                .rpc("hit_rate_limit", {"p_key": f"{self.name}:{key}"[:200], "p_limit": self.limit, "p_window_s": int(self.window_s)})
                .execute()
                .data
            )
        except Exception:
            log.debug("rate limit in database unavailable, counting in memory", exc_info=True)
            return self._check_memory(key)
        if allowed is False:
            raise HTTPException(status_code=429, detail=self.message)

    def _check_memory(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            while hits and now - hits[0] > self.window_s:
                hits.popleft()
            if len(hits) >= self.limit:
                raise HTTPException(status_code=429, detail=self.message)
            hits.append(now)


def client_ip(request: Request) -> str:
    # Render/Vercel อยู่หลัง proxy — IP จริงอยู่ตัวแรกของ X-Forwarded-For
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
