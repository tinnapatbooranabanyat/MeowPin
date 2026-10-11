import logging
from io import BytesIO
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Annotated, Literal
from uuid import UUID, uuid4

import httpx
from fastapi import FastAPI, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.responses import JSONResponse, Response
from PIL import Image, ImageOps
from postgrest.exceptions import APIError
from pydantic import BaseModel, Field

from . import catcheck, summary
from .auth import current_user_id, is_admin, require_admin, sync_admin_emails
from .config import settings
from .db import NotConfigured, get_client, public_photo_url
from .geo import blur, distance_m
from .images import InvalidImage, open_image, to_public_webp
from .ratelimit import RateLimiter, client_ip

# log ของแอป (เช่นเวลาที่ใช้ตรวจรูป) ให้ขึ้นใน Render Logs
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("meowpin")

FurColor = Literal[
    "orange", "orange_white", "cream", "white", "black", "black_white", "gray", "gray_white",
    "brown", "tabby", "silver_tabby", "tabby_white", "calico", "tortoiseshell", "pointed", "other",
]
Verification = Literal["camera_gps", "exif_gps", "manual"]
PostKind = Literal["lost", "adoption"]
Neutered = Literal["yes", "no", "unknown"]
OwnerStatus = Literal["stray", "owned", "unknown"]

MAX_CUSTOM_COLOR = 30

# จำกัดทั้งต่อบัญชีและต่อ IP (กันสร้างหลายบัญชีมาสแปม)
create_user_limiter = RateLimiter(10, 3600, "เพิ่มแมวบ่อยเกินไป พักสักครู่แล้วลองใหม่")
create_ip_limiter = RateLimiter(30, 3600, "เพิ่มแมวบ่อยเกินไป พักสักครู่แล้วลองใหม่")
album_user_limiter = RateLimiter(30, 3600, "อัปโหลดรูปบ่อยเกินไป พักสักครู่แล้วลองใหม่")
summary_ip_limiter = RateLimiter(60, 3600, "ขอสรุปบ่อยเกินไป พักสักครู่แล้วลองใหม่")
check_user_limiter = RateLimiter(40, 3600, "ตรวจรูปบ่อยเกินไป พักสักครู่แล้วลองใหม่")
post_user_limiter = RateLimiter(5, 86400, "ลงประกาศได้วันละ 5 ครั้ง พรุ่งนี้ลองใหม่นะ")
MAX_PHOTOS_PER_REVIEW = 4


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # ไม่โหลดโมเดล ONNX ตอนเปิด server แล้ว (ตรวจแมวด้วย Gemini เป็นหลัก) — server ตื่นเร็วขึ้นมาก
    if settings.admin_emails:
        try:
            sync_admin_emails(settings.admin_emails)
            log.info("synced %d admin email(s)", len(settings.admin_emails))
        except Exception:
            # เช่นยังไม่ได้รัน migration 0002 — server ยังทำงานต่อได้
            log.warning("sync ADMIN_EMAILS ไม่สำเร็จ (รัน migration 0002 แล้วหรือยัง?)", exc_info=True)
    yield


app = FastAPI(title="MeowPin API", lifespan=lifespan)


async def catch_unhandled(request: Request, call_next):
    """error ที่ไม่ได้ดักไว้: ตอบเป็น JSON (และผ่าน CORS) — ไม่งั้นเบราว์เซอร์เห็นแค่ว่าเชื่อมต่อไม่ได้"""
    try:
        return await call_next(request)
    except Exception as e:
        log.exception("unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=500,
            content={"detail": f"server มีปัญหา ({type(e).__name__}) ลองใหม่อีกครั้ง", "code": "server_error"},
        )


# ต้องเพิ่มก่อน CORS: middleware ที่เพิ่มทีหลังจะอยู่ชั้นนอก → CORS ใส่ header ให้คำตอบ error นี้ด้วย
app.add_middleware(BaseHTTPMiddleware, dispatch=catch_unhandled)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["*"],
)


@app.exception_handler(NotConfigured)
def not_configured(_request: Request, exc: NotConfigured):
    return JSONResponse(status_code=503, content={"detail": str(exc)})


@app.get("/health")
def health():
    return {
        "ok": True,
        "model": settings.model_path.exists(),
        "database": bool(settings.supabase_url and settings.supabase_secret_key),
        "ai_summary": bool(settings.gemini_api_key),
    }


def resolve_verification(
    claim: Verification, lat: float, lng: float, source_lat: float | None, source_lng: float | None
) -> Verification:
    """ไม่เชื่อ client ทั้งหมด: ถ้าไม่มีตำแหน่งต้นทาง หรือหมุดห่างจากต้นทางเกินกำหนด → ปักหมุดเอง"""
    if claim == "manual" or source_lat is None or source_lng is None:
        return "manual"
    if distance_m(lat, lng, source_lat, source_lng) > settings.max_adjust_m:
        return "manual"
    return claim


class NotCatError(Exception):
    """ตรวจแล้วไม่เจอแมว — ผู้ใช้กดยืนยันว่าเป็นแมวแล้วส่งใหม่ได้ (confirm_cat)"""

    def __init__(self, result: catcheck.CatCheck):
        self.result = result


def read_photo(photo: UploadFile) -> tuple[bytes, Image.Image]:
    data = photo.file.read(settings.max_upload_bytes + 1)
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail="รูปใหญ่เกิน 5 MB")
    try:
        return data, open_image(data)
    except InvalidImage as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


def resolve_cat_check(
    data: bytes, image: Image.Image, user_id: str, token: str, confirmed: bool
) -> tuple[float, catcheck.CheckMethod]:
    """ใช้ผลตรวจจาก token ถ้ามี (ไม่ต้องเรียก AI ซ้ำ) ไม่งั้นตรวจใหม่ — ไม่ผ่านแต่ผู้ใช้ยืนยันเอง = user"""
    result = catcheck.verify(token, catcheck.photo_digest(data), user_id) if token else None
    if result is None:
        result = catcheck.check(image)
    if result.ok and result.method:
        return result.score, result.method
    if confirmed:
        return result.score, "user"
    raise NotCatError(result)


def insert_tolerant(client, table: str, row: dict, new_columns: tuple[str, ...]) -> None:
    """ยังไม่ได้รัน migration ที่เพิ่มคอลัมน์ใหม่ → บันทึกแบบไม่มีคอลัมน์นั้นไปก่อน (ไม่ให้ปักหมุดพัง)"""
    try:
        client.table(table).insert(row).execute()
    except APIError as e:
        if not any(col in str(e) for col in new_columns):
            raise
        log.warning("%s: missing new columns, run the latest migration", table)
        client.table(table).insert({k: v for k, v in row.items() if k not in new_columns}).execute()


def flag_unconfirmed_cat(client, cat_id: UUID, user_id: str, what: str) -> None:
    """ผู้ใช้ยืนยันเองว่าเป็นแมว → ส่งเข้าคิวรายงานให้ admin ตรวจ (ใช้รายงานแบบ "ไม่ใช่แมว" ที่มีอยู่)"""
    try:
        client.table("cat_reports").upsert(
            {
                "cat_id": str(cat_id),
                "user_id": user_id,
                "reason": "not_cat",
                "details": f"ตรวจอัตโนมัติ: ระบบไม่แน่ใจว่า{what}เป็นแมว แต่ผู้ใช้ยืนยันว่าเป็นแมว",
            },
            on_conflict="cat_id,user_id",
            ignore_duplicates=True,
        ).execute()
    except Exception:
        log.warning("flag unconfirmed cat failed: %s", cat_id, exc_info=True)


def resolve_last_seen(taken_at: datetime | None) -> datetime:
    now = datetime.now(timezone.utc)
    if taken_at is None:
        return now
    if taken_at.tzinfo is None:
        taken_at = taken_at.replace(tzinfo=timezone.utc)
    # เวลาในอนาคตหรือเก่ากว่า 1 ปีถือว่าเชื่อไม่ได้
    if taken_at > now or taken_at < now - timedelta(days=365):
        return now
    return taken_at


@app.exception_handler(NotCatError)
async def not_cat_handler(_request: Request, exc: NotCatError):
    return JSONResponse(
        status_code=422,
        content={"detail": exc.result.message, "detailEn": exc.result.message_en, "code": "not_cat"},
    )


@app.post("/cats/check-photo")
def check_cat_photo(request: Request, photo: UploadFile):
    """ตรวจรูปตอนเลือกรูป (ก่อนกรอกรายละเอียด) — คืน token ไว้ใช้ตอนปักหมุดจริง จะได้ไม่ต้องตรวจซ้ำ"""
    user_id = current_user_id(request)
    check_user_limiter.check(user_id)
    data, image = read_photo(photo)
    result = catcheck.check(image)
    return {
        "isCat": result.ok,
        "score": round(result.score, 4),
        "method": result.method,
        "message": result.message,
        "messageEn": result.message_en,
        "token": catcheck.sign(catcheck.photo_digest(data), user_id, result),
    }


@app.post("/cats", status_code=201)
def create_cat(
    request: Request,
    photo: UploadFile,
    name: Annotated[str, Form(min_length=1, max_length=40)],
    fur_color: Annotated[FurColor, Form()],
    lat: Annotated[float, Form(ge=-90, le=90)],
    lng: Annotated[float, Form(ge=-180, le=180)],
    verification: Annotated[Verification, Form()] = "manual",
    source_lat: Annotated[float | None, Form(ge=-90, le=90)] = None,
    source_lng: Annotated[float | None, Form(ge=-180, le=180)] = None,
    taken_at: Annotated[datetime | None, Form()] = None,
    place_name: Annotated[str, Form(max_length=80)] = "",
    description: Annotated[str, Form(max_length=500)] = "",
    has_owner: Annotated[bool, Form()] = False,
    is_friendly: Annotated[bool, Form()] = False,
    is_clingy: Annotated[bool, Form()] = False,
    is_playful: Annotated[bool, Form()] = False,
    neutered: Annotated[Neutered, Form()] = "unknown",
    # key จากรายการสายพันธุ์ในแอป หรือข้อความที่ผู้ใช้พิมพ์เอง (ว่าง = ไม่ระบุ)
    breed: Annotated[str, Form(max_length=40)] = "",
    owner_status: Annotated[OwnerStatus, Form()] = "unknown",
    # สีที่ผู้ใช้พิมพ์เอง (ใช้คู่กับ fur_color = other)
    fur_color_custom: Annotated[str, Form(max_length=MAX_CUSTOM_COLOR)] = "",
    # ผลตรวจรูปจาก /cats/check-photo และการยืนยันเองว่าเป็นแมว (ตอนระบบไม่แน่ใจ)
    check_token: Annotated[str, Form(max_length=1000)] = "",
    confirm_cat: Annotated[bool, Form()] = False,
):
    client = get_client()
    user_id = current_user_id(request)
    create_user_limiter.check(user_id)
    create_ip_limiter.check(client_ip(request))

    name = name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="ตั้งชื่อให้น้องก่อน")
    custom_color = fur_color_custom.strip() if fur_color == "other" else ""
    if fur_color == "other" and not custom_color:
        raise HTTPException(status_code=422, detail="พิมพ์สีขนของน้องก่อน")

    data, image = read_photo(photo)
    cat_score, cat_check = resolve_cat_check(data, image, user_id, check_token, confirm_cat)

    final_verification = resolve_verification(verification, lat, lng, source_lat, source_lng)
    last_seen_at = resolve_last_seen(taken_at)
    # has_owner เป็นช่องแบบเก่า — ถือว่ามีเจ้าของถ้าส่งอย่างใดอย่างหนึ่งมา
    if has_owner:
        owner_status = "owned"
    has_owner = owner_status == "owned"
    if has_owner:
        lat, lng = blur(lat, lng)

    cat_id = uuid4()
    photo_path = f"{cat_id}.webp"
    bucket = client.storage.from_(settings.photo_bucket)
    bucket.upload(
        path=photo_path,
        file=to_public_webp(image),
        file_options={"content-type": "image/webp", "cache-control": "31536000"},
    )

    row = {
        "id": str(cat_id),
        "name": name,
        "fur_color": fur_color,
        "location": f"SRID=4326;POINT({lng} {lat})",
        "place_name": place_name.strip(),
        "description": description.strip(),
        "photo_path": photo_path,
        "verification": final_verification,
        "cat_confidence": round(cat_score, 4),
        "cat_check": cat_check,
        "fur_color_custom": custom_color or None,
        "has_owner": has_owner,
        "created_by": user_id,
        "is_friendly": is_friendly,
        "is_clingy": is_clingy,
        "is_playful": is_playful,
        "neutered": neutered,
        "breed": breed.strip() or None,
        "owner_status": owner_status,
        "sightings_count": 1,
        "last_seen_at": last_seen_at.isoformat(),
    }
    try:
        insert_tolerant(client, "cats", row, ("cat_check", "fur_color_custom"))
        client.table("sightings").insert(
            {"cat_id": str(cat_id), "user_id": user_id, "seen_at": last_seen_at.isoformat()}
        ).execute()
    except APIError:
        # บันทึกลงตารางไม่สำเร็จ → ลบรูปที่อัปโหลดไปแล้วทิ้ง ไม่ให้มีไฟล์กำพร้า
        bucket.remove([photo_path])
        log.exception("insert cat failed")
        raise HTTPException(status_code=500, detail="บันทึกข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง")
    if cat_check == "user":
        flag_unconfirmed_cat(client, cat_id, user_id, "รูปหมุดนี้")

    profile = client.table("profiles").select("display_name").eq("id", user_id).limit(1).execute().data
    return {
        "id": str(cat_id),
        "name": name,
        "furColor": fur_color,
        "position": {"lat": lat, "lng": lng},
        "placeName": row["place_name"],
        "description": row["description"],
        "photoUrl": public_photo_url(photo_path),
        "lastSeenAt": row["last_seen_at"],
        "sightings": 1,
        "verification": final_verification,
        "catConfidence": row["cat_confidence"],
        "catCheck": cat_check,
        "furColorCustom": row["fur_color_custom"],
        "isFriendly": is_friendly,
        "isClingy": is_clingy,
        "isPlayful": is_playful,
        "neutered": neutered,
        "breed": row["breed"],
        "ownerStatus": owner_status,
        "createdBy": user_id,
        "createdByName": profile[0]["display_name"] if profile else None,
        "reviewCount": 0,
        "pawAvg": None,
        "recommendCount": 0,
    }


def load_own_cat(client, cat_id: UUID, user_id: str, columns: str) -> dict:
    """หมุดที่ผู้ใช้คนนี้แก้/ลบได้: คนปักหมุดเอง หรือเจ้าของแพลตฟอร์ม"""
    rows = client.table("cats").select(f"created_by, {columns}").eq("id", str(cat_id)).limit(1).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="ไม่พบน้องแมวตัวนี้")
    if rows[0].get("created_by") != user_id and not is_admin(user_id):
        raise HTTPException(status_code=403, detail="แก้ไขหรือลบได้เฉพาะหมุดที่คุณปักเอง")
    return rows[0]


class CatUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    fur_color: FurColor
    fur_color_custom: str = Field("", max_length=MAX_CUSTOM_COLOR)
    breed: str = Field("", max_length=40)
    place_name: str = Field("", max_length=80)
    description: str = Field("", max_length=500)
    owner_status: OwnerStatus
    is_friendly: bool
    is_clingy: bool
    is_playful: bool
    neutered: Neutered


@app.patch("/cats/{cat_id}")
def update_cat(cat_id: UUID, body: CatUpdate, request: Request):
    """แก้รายละเอียดหมุด (คนปักหมุดหรือเจ้าของแพลตฟอร์ม) — รูปและตำแหน่งแก้ไม่ได้ เพราะผูกกับการตรวจแมว/ยืนยันตำแหน่ง"""
    user_id = current_user_id(request)
    client = get_client()
    current = load_own_cat(client, cat_id, user_id, "owner_status")

    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="ตั้งชื่อให้น้องก่อน")
    custom_color = body.fur_color_custom.strip() if body.fur_color == "other" else ""
    if body.fur_color == "other" and not custom_color:
        raise HTTPException(status_code=422, detail="พิมพ์สีขนของน้องก่อน")

    row = {
        "name": name,
        "fur_color": body.fur_color,
        "fur_color_custom": custom_color or None,
        "breed": body.breed.strip() or None,
        "place_name": body.place_name.strip(),
        "description": body.description.strip(),
        "owner_status": body.owner_status,
        "has_owner": body.owner_status == "owned",
        "is_friendly": body.is_friendly,
        "is_clingy": body.is_clingy,
        "is_playful": body.is_playful,
        "neutered": body.neutered,
    }
    # เพิ่งเปลี่ยนเป็น "มีเจ้าของ" → เบลอตำแหน่งเหมือนตอนปักหมุด ไม่ให้ระบุบ้านได้
    if body.owner_status == "owned" and current.get("owner_status") != "owned":
        pos = client.table("cats_public").select("lat, lng").eq("id", str(cat_id)).limit(1).execute().data
        if pos:
            lat, lng = blur(pos[0]["lat"], pos[0]["lng"])
            row["location"] = f"SRID=4326;POINT({lng} {lat})"
    try:
        client.table("cats").update(row).eq("id", str(cat_id)).execute()
    except APIError as e:
        # ยังไม่ได้รัน migration 0009 (ไม่มีคอลัมน์สีพิมพ์เอง)
        if "fur_color_custom" not in str(e):
            raise
        row.pop("fur_color_custom")
        client.table("cats").update(row).eq("id", str(cat_id)).execute()
    log_activity(client, user_id, "cat_update", cat_id, {"cat_name": name})
    return {"ok": True}


@app.delete("/cats/{cat_id}", status_code=204)
def delete_cat(cat_id: UUID, request: Request):
    """ลบหมุดแมว (คนปักหมุดหรือเจ้าของแพลตฟอร์ม) — ลบรูปใน storage ด้วย, รีวิวและการเจอลบตามด้วย cascade"""
    user_id = current_user_id(request)
    client = get_client()
    cat = load_own_cat(client, cat_id, user_id, "photo_path, name")
    album = client.table("cat_photos").select("photo_path").eq("cat_id", str(cat_id)).execute().data
    client.table("cats").delete().eq("id", str(cat_id)).execute()
    log_activity(client, user_id, "cat_delete", cat_id, {"cat_name": cat.get("name")})
    paths = [p for p in [cat["photo_path"], *(a["photo_path"] for a in album)] if p]
    if paths:
        client.storage.from_(settings.photo_bucket).remove(paths)


@app.post("/cats/{cat_id}/photos", status_code=201)
def add_cat_photo(
    cat_id: UUID,
    request: Request,
    photo: UploadFile,
    review_id: Annotated[UUID | None, Form()] = None,
    confirm_cat: Annotated[bool, Form()] = False,
):
    """เพิ่มรูปเข้าอัลบั้มของแมว (แนบกับรีวิวของตัวเองได้ สูงสุด 4 รูปต่อรีวิว)"""
    client = get_client()
    user_id = current_user_id(request)
    album_user_limiter.check(user_id)

    if not client.table("cats").select("id").eq("id", str(cat_id)).limit(1).execute().data:
        raise HTTPException(status_code=404, detail="ไม่พบน้องแมวตัวนี้")
    if review_id:
        review = (
            client.table("reviews").select("user_id, cat_id").eq("id", str(review_id)).limit(1).execute().data
        )
        if not review or review[0]["user_id"] != user_id or review[0]["cat_id"] != str(cat_id):
            raise HTTPException(status_code=403, detail="แนบรูปได้เฉพาะรีวิวของตัวเอง")
        attached = client.table("cat_photos").select("id").eq("review_id", str(review_id)).execute().data
        if len(attached) >= MAX_PHOTOS_PER_REVIEW:
            raise HTTPException(status_code=422, detail="แนบรูปได้สูงสุด 4 รูปต่อรีวิว")

    data, image = read_photo(photo)
    cat_score, cat_check = resolve_cat_check(data, image, user_id, "", confirm_cat)
    photo_id = uuid4()
    photo_path = f"album/{cat_id}/{photo_id}.webp"
    bucket = client.storage.from_(settings.photo_bucket)
    bucket.upload(
        path=photo_path,
        file=to_public_webp(image),
        file_options={"content-type": "image/webp", "cache-control": "31536000"},
    )
    row = {
        "id": str(photo_id),
        "cat_id": str(cat_id),
        "user_id": user_id,
        "review_id": str(review_id) if review_id else None,
        "photo_path": photo_path,
        "cat_confidence": round(cat_score, 4),
        "cat_check": cat_check,
    }
    try:
        insert_tolerant(client, "cat_photos", row, ("cat_check",))
    except APIError:
        bucket.remove([photo_path])
        log.exception("insert cat photo failed")
        raise HTTPException(status_code=500, detail="บันทึกข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง")
    if cat_check == "user":
        flag_unconfirmed_cat(client, cat_id, user_id, "รูปในอัลบั้ม")
    return {"id": row["id"], "photoUrl": public_photo_url(photo_path), "reviewId": row["review_id"]}


def log_activity(client, user_id: str, action: str, cat_id: UUID | None, detail: dict) -> None:
    """บันทึกกิจกรรมที่ trigger ในฐานข้อมูลไม่รู้ว่าใครทำ (เช่น admin ลบหมุดผ่าน backend) — พลาดก็ไม่เป็นไร"""
    try:
        client.table("activity_log").insert(
            {"user_id": user_id, "action": action, "cat_id": str(cat_id) if cat_id else None, "detail": detail}
        ).execute()
    except Exception:
        log.warning("activity log failed: %s %s", action, cat_id, exc_info=True)


def _summary_response(row: dict) -> dict:
    return {
        "th": row["summary_th"],
        "en": row["summary_en"],
        "reviewCount": row["review_count"],
        "generatedAt": row["generated_at"],
    }


@app.post("/cats/{cat_id}/summary")
def refresh_cat_summary(cat_id: UUID, request: Request):
    """สรุปแมวด้วย AI — คืนของเดิมถ้าข้อมูลไม่เปลี่ยนหรือเพิ่งสรุปไป ไม่งั้นสร้างใหม่ด้วย Gemini"""
    summary_ip_limiter.check(client_ip(request))
    client = get_client()
    cats = (
        client.table("cats")
        .select("name, description, place_name, fur_color, breed, owner_status, neutered, is_friendly, is_clingy, is_playful")
        .eq("id", str(cat_id))
        .limit(1)
        .execute()
        .data
    )
    if not cats:
        raise HTTPException(status_code=404, detail="ไม่พบน้องแมวตัวนี้")
    reviews = (
        client.table("reviews")
        .select("paws, recommend, comment")
        .eq("cat_id", str(cat_id))
        .order("created_at", desc=True)
        .limit(summary.MAX_REVIEWS)
        .execute()
        .data
    )
    if len(reviews) < settings.summary_min_reviews:
        return {"summary": None, "reason": "not_enough_reviews"}

    data = summary.build_input(cats[0], reviews)
    digest = summary.source_hash(data)
    existing = client.table("cat_summaries").select("*").eq("cat_id", str(cat_id)).limit(1).execute().data
    if existing:
        row = existing[0]
        age = (datetime.now(timezone.utc) - datetime.fromisoformat(row["generated_at"])).total_seconds()
        if row["source_hash"] == digest or age < settings.summary_cooldown_s:
            return {"summary": _summary_response(row)}

    try:
        result = summary.generate(data)
    except summary.SummaryError as e:
        # มีสรุปเก่าอยู่ก็ส่งของเก่าไปก่อน ดีกว่าไม่มีอะไรเลย
        if existing:
            return {"summary": _summary_response(existing[0])}
        raise HTTPException(status_code=503, detail=str(e)) from e

    row = {
        "cat_id": str(cat_id),
        "summary_th": result.th,
        "summary_en": result.en,
        "review_count": len(reviews),
        "source_hash": digest,
        "model": settings.gemini_model,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    client.table("cat_summaries").upsert(row).execute()
    return {"summary": _summary_response(row)}


# ── รูปตัวอย่างตอนแชร์ลิงก์ (LINE/Facebook) — JPEG 1200x630 เพราะบางแอปไม่แสดง WebP ──
OG_SIZE = (1200, 630)
_og_cache: dict[str, bytes] = {}


@app.get("/cats/{cat_id}/og.jpg")
def cat_share_image(cat_id: UUID):
    client = get_client()
    rows = client.table("cats").select("photo_path").eq("id", str(cat_id)).limit(1).execute().data
    if not rows or not rows[0].get("photo_path"):
        raise HTTPException(status_code=404, detail="ไม่พบรูปของน้องตัวนี้")
    path = rows[0]["photo_path"]
    if path not in _og_cache:
        try:
            res = httpx.get(public_photo_url(path), timeout=15)
            res.raise_for_status()
            image = ImageOps.fit(Image.open(BytesIO(res.content)).convert("RGB"), OG_SIZE)
        except (httpx.HTTPError, OSError) as e:
            raise HTTPException(status_code=404, detail="โหลดรูปไม่สำเร็จ") from e
        out = BytesIO()
        image.save(out, "JPEG", quality=82, optimize=True)
        if len(_og_cache) > 200:
            _og_cache.clear()
        _og_cache[path] = out.getvalue()
    # ชื่อไฟล์รูปไม่เปลี่ยน (เปลี่ยนรูป = ไฟล์ใหม่) จึงแคชได้นาน
    return Response(_og_cache[path], media_type="image/jpeg", headers={"cache-control": "public, max-age=86400"})


# ── ประกาศแมวหาย / หาบ้าน ──
# เบลอตำแหน่งเสมอ: แมวหาย = จุดที่เห็นครั้งล่าสุด (เบลอนิดเดียว) / หาบ้าน = มักเป็นบ้านคนโพสต์ (เบลอมากกว่า)
POST_BLUR_M = {"lost": (30, 80), "adoption": (200, 400)}


@app.post("/posts", status_code=201)
def create_post(
    request: Request,
    photo: UploadFile,
    kind: Annotated[PostKind, Form()],
    title: Annotated[str, Form(min_length=1, max_length=40)],
    fur_color: Annotated[FurColor, Form()],
    contact: Annotated[str, Form(min_length=1, max_length=100)],
    lat: Annotated[float, Form(ge=-90, le=90)],
    lng: Annotated[float, Form(ge=-180, le=180)],
    description: Annotated[str, Form(max_length=800)] = "",
    fur_color_custom: Annotated[str, Form(max_length=MAX_CUSTOM_COLOR)] = "",
    confirm_cat: Annotated[bool, Form()] = False,
):
    client = get_client()
    user_id = current_user_id(request)
    post_user_limiter.check(user_id)

    title, contact = title.strip(), contact.strip()
    if not title or not contact:
        raise HTTPException(status_code=422, detail="ใส่ชื่อน้องและช่องทางติดต่อก่อน")
    custom_color = fur_color_custom.strip() if fur_color == "other" else ""
    if fur_color == "other" and not custom_color:
        raise HTTPException(status_code=422, detail="พิมพ์สีขนของน้องก่อน")

    data, image = read_photo(photo)
    resolve_cat_check(data, image, user_id, "", confirm_cat)

    post_id = uuid4()
    photo_path = f"posts/{post_id}.webp"
    bucket = client.storage.from_(settings.photo_bucket)
    bucket.upload(
        path=photo_path,
        file=to_public_webp(image),
        file_options={"content-type": "image/webp", "cache-control": "31536000"},
    )
    lat, lng = blur(lat, lng, *POST_BLUR_M[kind])
    row = {
        "id": str(post_id),
        "kind": kind,
        "user_id": user_id,
        "title": title,
        "description": description.strip(),
        "fur_color": fur_color,
        "fur_color_custom": custom_color or None,
        "contact": contact,
        "location": f"SRID=4326;POINT({lng} {lat})",
        "photo_path": photo_path,
    }
    try:
        client.table("cat_posts").insert(row).execute()
    except APIError:
        bucket.remove([photo_path])
        log.exception("insert post failed")
        raise HTTPException(status_code=500, detail="บันทึกประกาศไม่สำเร็จ (รัน migration 0016 แล้วหรือยัง?)")
    log_activity(client, user_id, "post_create", None, {"post_kind": kind, "title": title})
    return {"id": str(post_id)}


def load_own_post(client, post_id: UUID, user_id: str) -> dict:
    rows = client.table("cat_posts").select("user_id, photo_path, title, kind").eq("id", str(post_id)).limit(1).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="ไม่พบประกาศนี้")
    if rows[0]["user_id"] != user_id and not is_admin(user_id):
        raise HTTPException(status_code=403, detail="จัดการได้เฉพาะประกาศของคุณเอง")
    return rows[0]


@app.post("/posts/{post_id}/resolve")
def resolve_post(post_id: UUID, request: Request):
    """ปิดประกาศ (เจอน้องแล้ว / มีคนรับเลี้ยงแล้ว)"""
    user_id = current_user_id(request)
    client = get_client()
    post = load_own_post(client, post_id, user_id)
    client.table("cat_posts").update(
        {"status": "resolved", "resolved_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", str(post_id)).execute()
    log_activity(client, user_id, "post_resolve", None, {"post_kind": post["kind"], "title": post["title"]})
    return {"ok": True}


@app.delete("/posts/{post_id}", status_code=204)
def delete_post(post_id: UUID, request: Request):
    user_id = current_user_id(request)
    client = get_client()
    post = load_own_post(client, post_id, user_id)
    client.table("cat_posts").delete().eq("id", str(post_id)).execute()
    if post.get("photo_path"):
        client.storage.from_(settings.photo_bucket).remove([post["photo_path"]])
    log_activity(client, user_id, "post_delete", None, {"post_kind": post["kind"], "title": post["title"]})
