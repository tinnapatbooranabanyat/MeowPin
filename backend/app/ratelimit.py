import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException, Request


class RateLimiter:
    """จำกัดจำนวนครั้งต่อช่วงเวลาแบบเก็บในหน่วยความจำ — พอสำหรับ server ตัวเดียวบน Render free"""

    def __init__(self, limit: int, window_s: float, message: str):
        self.limit = limit
        self.window_s = window_s
        self.message = message
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def check(self, key: str) -> None:
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
