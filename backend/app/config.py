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
    photo_bucket: str = "cat-photos"
    # SSD-MobileNet ฝั่ง server ให้คะแนนต่างจาก COCO-SSD ในเบราว์เซอร์เล็กน้อย จึงใช้เกณฑ์ต่ำกว่า
    cat_threshold: float = 0.4
    max_upload_bytes: int = 5 * 1024 * 1024
    # ขยับหมุดจากตำแหน่ง GPS/EXIF เกินระยะนี้ → นับเป็นปักหมุดเอง (ต้องตรงกับ frontend)
    max_adjust_m: float = 50


def _csv(name: str, default: str = "") -> list[str]:
    return [v.strip() for v in os.getenv(name, default).split(",") if v.strip()]


settings = Settings(
    supabase_url=os.getenv("SUPABASE_URL", ""),
    supabase_secret_key=os.getenv("SUPABASE_SECRET_KEY", ""),
    allowed_origins=_csv("ALLOWED_ORIGINS", "http://localhost:5173"),
    admin_emails=[e.lower() for e in _csv("ADMIN_EMAILS")],
    model_path=BACKEND_DIR / os.getenv("MODEL_PATH", "models/ssd_mobilenet_v1_12.onnx"),
)
