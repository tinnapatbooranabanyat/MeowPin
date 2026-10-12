"""แจ้งเตือนเด้งบนมือถือ (Web Push) — ส่งการแจ้งเตือนในแอปออกไปยังทุกเครื่องที่เปิดรับไว้"""

import json
import logging
import threading
import time
from datetime import datetime, timedelta, timezone

from pywebpush import WebPushException, webpush

from .config import settings
from .db import get_client

log = logging.getLogger("meowpin.push")

# ส่งเฉพาะแจ้งเตือนที่ยังใหม่ — เก่ากว่านี้ไม่เด้งแล้ว (ยังเห็นในกระดิ่งในแอปตามเดิม)
MAX_AGE = timedelta(hours=1)

HELP_KINDS = {
    "injured": ("บาดเจ็บ", "injured"),
    "sick": ("ป่วย", "sick"),
    "thin": ("ผอมมาก", "very thin"),
    "not_neutered": ("ยังไม่ทำหมัน", "not neutered"),
    "other": ("อื่นๆ", "other"),
}


def enabled() -> bool:
    return bool(settings.vapid_private_key and settings.vapid_public_key)


def render(kind: str, data: dict, lang: str) -> tuple[str, str]:
    """หัวข้อ + ข้อความ (ข้อความเดียวกับในแอป)"""
    th = lang != "en"
    cat = data.get("cat_name") or ("น้องแมว" if th else "a cat")
    actor = data.get("actor_name") or ("มีคน" if th else "Someone")
    if kind == "new_review":
        paws = data.get("paws", "?")
        return ("รีวิวใหม่ 🐾", f"{actor} รีวิว{cat} ให้ {paws} อุ้งเท้า") if th else ("New review 🐾", f"{actor} gave {cat} {paws} paws")
    if kind == "help_request":
        label = HELP_KINDS.get(data.get("help_kind", ""), HELP_KINDS["other"])
        return (
            ("น้องต้องการความช่วยเหลือ 🚑", f"{actor} แจ้งว่า{cat}{label[0]}")
            if th
            else ("A cat needs help 🚑", f"{actor} reported that {cat} is {label[1]}")
        )
    if kind == "help_resolved":
        return ("ช่วยน้องแล้ว 💚", f"{cat} ได้รับความช่วยเหลือแล้ว") if th else ("Cat helped 💚", f"{cat} has been helped")
    if kind == "not_seen":
        days = data.get("days", 14)
        return (
            ("ไม่มีใครเจอน้องเลย", f"ไม่มีใครเจอ{cat} มา {days} วันแล้ว ถ้าผ่านไปแถวนั้นช่วยดูน้องหน่อยนะ")
            if th
            else ("Nobody has seen this cat", f"Nobody has seen {cat} for {days} days. If you're nearby, please check on them.")
        )
    if kind == "review_reply":
        body = data.get("body", "")
        return ("มีคนตอบรีวิวของคุณ 💬", f"{actor}: {body}") if th else ("New reply 💬", f"{actor}: {body}")
    return ("MeowPin", cat)


def _send(sub: dict, payload: dict) -> bool:
    """คืน False ถ้าเครื่องนั้นเลิกรับแล้ว (ควรลบทิ้ง)"""
    try:
        webpush(
            subscription_info={"endpoint": sub["endpoint"], "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]}},
            data=json.dumps(payload, ensure_ascii=False),
            vapid_private_key=settings.vapid_private_key,
            vapid_claims={"sub": settings.vapid_subject},
            timeout=10,
            ttl=24 * 3600,
        )
        return True
    except WebPushException as e:
        status = getattr(e.response, "status_code", None)
        if status in (404, 410):
            return False
        log.warning("push failed (%s): %s", status, e)
        return True


def dispatch(notification_id: int) -> int:
    """ส่งแจ้งเตือนหนึ่งรายการ — จองก่อนส่ง (pushed_at) กันส่งซ้ำ คืนจำนวนเครื่องที่ส่ง"""
    if not enabled():
        return 0
    client = get_client()
    since = (datetime.now(timezone.utc) - MAX_AGE).isoformat()
    claimed = (
        client.table("notifications")
        .update({"pushed_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", notification_id)
        .is_("pushed_at", "null")
        .gt("created_at", since)
        .execute()
        .data
    )
    if not claimed:
        return 0
    n = claimed[0]
    subs = client.table("push_subscriptions").select("id, endpoint, p256dh, auth, lang").eq("user_id", n["user_id"]).execute().data
    sent = 0
    for sub in subs:
        title, body = render(n["kind"], n.get("data") or {}, sub.get("lang", "th"))
        payload = {
            "title": title,
            "body": body,
            "url": f"/?cat={n['cat_id']}" if n.get("cat_id") else "/",
            "tag": f"meowpin-{n['id']}",
        }
        if _send(sub, payload):
            sent += 1
        else:
            client.table("push_subscriptions").delete().eq("id", sub["id"]).execute()
    return sent


_last_sweep = 0.0
_sweep_lock = threading.Lock()


def dispatch_pending() -> None:
    """เก็บตกแจ้งเตือนที่ยังไม่ได้ส่ง (เช่นตอน server หลับ) — เรียกจาก /health ไม่เกินนาทีละครั้ง"""
    global _last_sweep
    if not enabled():
        return
    with _sweep_lock:
        if time.monotonic() - _last_sweep < 60:
            return
        _last_sweep = time.monotonic()

    def run():
        try:
            since = (datetime.now(timezone.utc) - MAX_AGE).isoformat()
            rows = (
                get_client()
                .table("notifications")
                .select("id")
                .is_("pushed_at", "null")
                .gt("created_at", since)
                .order("created_at")
                .limit(50)
                .execute()
                .data
            )
            for row in rows:
                dispatch(row["id"])
        except Exception:
            log.warning("push sweep failed", exc_info=True)

    threading.Thread(target=run, daemon=True).start()
