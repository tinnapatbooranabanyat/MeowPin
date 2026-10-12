import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_secret_key: str
    allowed_origins: list[str]
    # อีเมลเจ้าของแพลตฟอร์ม (ว่าง = ไม่ sync ไม่แตะตาราง admin_emails)
    admin_emails: list[str]
    model_path: Path
    gemini_api_key: str
    # แจ้ง error ไป Sentry (ว่าง = ปิด)
    sentry_dsn: str
    # Web Push (แจ้งเตือนเด้งบนมือถือ) — ว่าง = ปิด
    vapid_public_key: str
    vapid_private_key: str
    vapid_subject: str
    gemini_model: str
    photo_bucket: str = "cat-photos"
    # SSD-MobileNet ฝั่ง server ให้คะแนนต่างจาก COCO-SSD ในเบราว์เซอร์เล็กน้อย จึงใช้เกณฑ์ต่ำกว่า
    cat_threshold: float = 0.4
    max_upload_bytes: int = 5 * 1024 * 1024
    # ขยับหมุดจากตำแหน่ง GPS/EXIF เกินระยะนี้ → นับเป็นปักหมุดเอง (ต้องตรงกับ frontend)
    max_adjust_m: float = 50
    # สรุปด้วย AI เมื่อมีรีวิวอย่างน้อยเท่านี้ และสร้างใหม่ได้ไม่ถี่กว่านี้ต่อแมว 1 ตัว
    summary_min_reviews: int = 3
    summary_cooldown_s: int = 600


def _csv(name: str, default: str = "") -> list[str]:
    return [v.strip() for v in os.getenv(name, default).split(",") if v.strip()]


settings = Settings(
    supabase_url=os.getenv("SUPABASE_URL", ""),
    supabase_secret_key=os.getenv("SUPABASE_SECRET_KEY", ""),
    allowed_origins=_csv("ALLOWED_ORIGINS", "http://localhost:5173"),
    admin_emails=[e.lower() for e in _csv("ADMIN_EMAILS")],
    model_path=BACKEND_DIR / os.getenv("MODEL_PATH", "models/ssd_mobilenet_v1_12.onnx"),
    gemini_api_key=os.getenv("GEMINI_API_KEY", ""),
    sentry_dsn=os.getenv("SENTRY_DSN", ""),
    vapid_public_key=os.getenv("VAPID_PUBLIC_KEY", ""),
    vapid_private_key=os.getenv("VAPID_PRIVATE_KEY", ""),
    vapid_subject=os.getenv("VAPID_SUBJECT", "https://meowpin-th.vercel.app"),
    gemini_model=os.getenv("GEMINI_MODEL", "gemini-3.8-flash"),
)
