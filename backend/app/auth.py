from fastapi import HTTPException, Request

from .db import get_client


def current_user_id(request: Request) -> str:
    """ตรวจ access token ของ Supabase Auth ที่ frontend ส่งมา (Authorization: Bearer ...)"""
    header = request.headers.get("authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="เข้าสู่ระบบก่อนนะ")
    try:
        response = get_client().auth.get_user(token)
    except Exception as e:  # token หมดอายุ / ปลอม / Supabase ตอบ error
        raise HTTPException(status_code=401, detail="เซสชันหมดอายุ เข้าสู่ระบบใหม่อีกครั้ง") from e
    if not response or not response.user:
        raise HTTPException(status_code=401, detail="เซสชันหมดอายุ เข้าสู่ระบบใหม่อีกครั้ง")
    return response.user.id


def sync_admin_emails(emails: list[str]) -> None:
    """ให้ตาราง admin_emails ตรงกับ ADMIN_EMAILS — trigger ในฐานข้อมูลจะตั้ง/ถอด admin ให้เอง"""
    table = get_client().table("admin_emails")
    current = {row["email"] for row in table.select("email").execute().data}
    wanted = set(emails)
    if missing := wanted - current:
        table.insert([{"email": e} for e in sorted(missing)]).execute()
    for email in current - wanted:
        table.delete().eq("email", email).execute()


def require_admin(user_id: str) -> None:
    rows = get_client().table("admins").select("user_id").eq("user_id", user_id).limit(1).execute().data
    if not rows:
        raise HTTPException(status_code=403, detail="เฉพาะเจ้าของแพลตฟอร์มเท่านั้น")
