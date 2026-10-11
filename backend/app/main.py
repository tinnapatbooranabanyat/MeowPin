import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Annotated, Literal
from uuid import UUID, uuid4

from fastapi import FastAPI, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image
from postgrest.exceptions import APIError

from . import detector
from .auth import current_user_id, require_admin, sync_admin_emails
from .config import settings
from .db import NotConfigured, get_client, public_photo_url
from .geo import blur, distance_m
from .images import InvalidImage, open_image, to_public_webp
from .ratelimit import RateLimiter, client_ip

log = logging.getLogger("meowpin")

FurColor = Literal[
    "orange", "orange_white", "cream", "white", "black", "black_white", "gray", "gray_white",
    "brown", "tabby", "silver_tabby", "tabby_white", "calico", "tortoiseshell", "pointed",
]
Verification = Literal["camera_gps", "exif_gps", "manual"]
Neutered = Literal["yes", "no", "unknown"]
OwnerStatus = Literal["stray", "owned", "unknown"]

REJECTION_MESSAGES = {
    "dog": "ดูเหมือนน้องหมานะ ไว้มีแอปปักหมุดหมาค่อยมาเจอกัน",
    "teddy bear": "ตุ๊กตาไม่นับนะ ต้องเป็นแมวตัวจริง",
    "person": "เจอแต่คน ยังไม่เห็นแมวเลย",
    "bird": "นี่นกนะ ไม่ใช่แมว",
}

# จำกัดทั้งต่อบัญชีและต่อ IP (กันสร้างหลายบัญชีมาสแปม)
create_user_limiter = RateLimiter(10, 3600, "เพิ่มแมวบ่อยเกินไป พักสักครู่แล้วลองใหม่")
create_ip_limiter = RateLimiter(30, 3600, "เพิ่มแมวบ่อยเกินไป พักสักครู่แล้วลองใหม่")
album_user_limiter = RateLimiter(30, 3600, "อัปโหลดรูปบ่อยเกินไป พักสักครู่แล้วลองใหม่")
MAX_PHOTOS_PER_REVIEW = 4


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # โหลดโมเดลตั้งแต่เปิด server — request แรกจะได้ไม่ช้า
    try:
        detector.warm_up()
    except RuntimeError as e:
        log.warning("%s", e)
    if settings.admin_emails:
        try:
            sync_admin_emails(settings.admin_emails)
            log.info("synced %d admin email(s)", len(settings.admin_emails))
        except Exception:
            # เช่นยังไม่ได้รัน migration 0002 — server ยังทำงานต่อได้
            log.warning("sync ADMIN_EMAILS ไม่สำเร็จ (รัน migration 0002 แล้วหรือยัง?)", exc_info=True)
    yield


app = FastAPI(title="MeowPin API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_methods=["GET", "POST", "DELETE"],
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


def read_cat_photo(photo: UploadFile) -> tuple[Image.Image, detector.Detection]:
    """อ่านรูปที่อัปโหลด + ตรวจว่าเป็นแมว (ตรวจซ้ำฝั่ง server เพราะการตรวจในเบราว์เซอร์ถูกข้ามได้)"""
    data = photo.file.read(settings.max_upload_bytes + 1)
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail="รูปใหญ่เกิน 5 MB")
    try:
        image = open_image(data)
    except InvalidImage as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    detection = detector.detect_cat(image)
    if not detection.is_cat:
        message = REJECTION_MESSAGES.get(detection.other_label or "", "ไม่เจอแมวในรูปนี้ ลองถ่ายใหม่ให้เห็นน้องชัดๆ")
        raise HTTPException(status_code=422, detail=message)
    return image, detection


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
):
    client = get_client()
    user_id = current_user_id(request)
    create_user_limiter.check(user_id)
    create_ip_limiter.check(client_ip(request))

    name = name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="ตั้งชื่อให้น้องก่อน")

    image, detection = read_cat_photo(photo)

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
        "cat_confidence": round(detection.score, 4),
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
        client.table("cats").insert(row).execute()
        client.table("sightings").insert(
            {"cat_id": str(cat_id), "user_id": user_id, "seen_at": last_seen_at.isoformat()}
        ).execute()
    except APIError:
        # บันทึกลงตารางไม่สำเร็จ → ลบรูปที่อัปโหลดไปแล้วทิ้ง ไม่ให้มีไฟล์กำพร้า
        bucket.remove([photo_path])
        log.exception("insert cat failed")
        raise HTTPException(status_code=500, detail="บันทึกข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง")

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


@app.delete("/cats/{cat_id}", status_code=204)
def delete_cat(cat_id: UUID, request: Request):
    """ลบหมุดแมว (เฉพาะเจ้าของแพลตฟอร์ม) — ลบรูปใน storage ด้วย, รีวิวและการเจอลบตามด้วย cascade"""
    require_admin(current_user_id(request))
    client = get_client()
    rows = client.table("cats").select("photo_path").eq("id", str(cat_id)).limit(1).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="ไม่พบน้องแมวตัวนี้")
    album = client.table("cat_photos").select("photo_path").eq("cat_id", str(cat_id)).execute().data
    client.table("cats").delete().eq("id", str(cat_id)).execute()
    paths = [p for p in [rows[0]["photo_path"], *(a["photo_path"] for a in album)] if p]
    if paths:
        client.storage.from_(settings.photo_bucket).remove(paths)


@app.post("/cats/{cat_id}/photos", status_code=201)
def add_cat_photo(
    cat_id: UUID,
    request: Request,
    photo: UploadFile,
    review_id: Annotated[UUID | None, Form()] = None,
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

    image, detection = read_cat_photo(photo)
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
        "cat_confidence": round(detection.score, 4),
    }
    try:
        client.table("cat_photos").insert(row).execute()
    except APIError:
        bucket.remove([photo_path])
        log.exception("insert cat photo failed")
        raise HTTPException(status_code=500, detail="บันทึกข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง")
    return {"id": row["id"], "photoUrl": public_photo_url(photo_path), "reviewId": row["review_id"]}
