"""โซน (เขต/อำเภอ) ของหมุด — ถามชื่อจากพิกัดผ่าน OpenStreetMap (Nominatim)

ตามกติกาการใช้ Nominatim: ไม่เกิน 1 ครั้ง/วินาที และต้องบอกชื่อแอปใน User-Agent
ทำเบื้องหลังเสมอ — ถามไม่ได้ก็ไม่เป็นไร หมุดยังปักได้ปกติ (ไว้เติมทีหลังตอน /health)
"""

import logging
import threading
import time
from dataclasses import dataclass

import httpx

from .db import get_client

log = logging.getLogger(__name__)

# ปิดได้ (เทสต์ไม่ให้ยิงออกเน็ตจริง)
ENABLED = True
URL = "https://nominatim.openstreetmap.org/reverse"
HEADERS = {"User-Agent": "MeowPin/1.0 (+https://meowpin-th.vercel.app)"}

_rate_lock = threading.Lock()
_last_call = 0.0
_sweep_lock = threading.Lock()
_last_sweep = 0.0
_sweeping = False
# หมุดที่หาโซนไม่ได้ (เช่นอยู่กลางทะเล) — ไม่ต้องถามซ้ำจนกว่า server จะเริ่มใหม่
_failed: set[str] = set()


@dataclass
class Zone:
    key: str
    name_th: str
    name_en: str
    province_th: str
    province_en: str


def _reverse(lat: float, lng: float, lang: str) -> dict | None:
    """เรียก Nominatim ทีละครั้ง เว้นห่างอย่างน้อย 1.1 วินาที"""
    global _last_call
    with _rate_lock:
        wait = 1.1 - (time.monotonic() - _last_call)
        if wait > 0:
            time.sleep(wait)
        try:
            res = httpx.get(
                URL,
                params={"format": "jsonv2", "lat": lat, "lon": lng, "zoom": 10, "addressdetails": 1, "accept-language": lang},
                headers=HEADERS,
                timeout=10,
            )
            res.raise_for_status()
            return res.json()
        except Exception:
            log.warning("zone lookup failed (%s, %s)", lat, lng, exc_info=True)
            return None
        finally:
            _last_call = time.monotonic()


def parse_address(addr: dict) -> tuple[str, str, str] | None:
    """(รหัสจังหวัด, เขต/อำเภอ, จังหวัด) — กรุงเทพฯ ใช้ "เขต" (suburb) จังหวัดอื่นใช้ "อำเภอ" (county)"""
    iso = addr.get("ISO3166-2-lvl4") or addr.get("country_code", "")
    bangkok = iso == "TH-10"
    if bangkok:
        district = addr.get("suburb") or addr.get("city_district") or addr.get("quarter")
        province = addr.get("city") or addr.get("state") or ""
    else:
        district = addr.get("county") or addr.get("city") or addr.get("town") or addr.get("municipality") or addr.get("city_district")
        province = addr.get("province") or addr.get("state") or ""
    if not district:
        return None
    return iso, district, province


def lookup(lat: float, lng: float) -> Zone | None:
    th = _reverse(lat, lng, "th")
    parsed = parse_address((th or {}).get("address") or {})
    if not parsed:
        return None
    iso, district_th, province_th = parsed
    en = _reverse(lat, lng, "en")
    en_parsed = parse_address((en or {}).get("address") or {})
    district_en, province_en = (en_parsed[1], en_parsed[2]) if en_parsed else (district_th, province_th)
    # key จากชื่อภาษาไทย (ไม่เปลี่ยนตามภาษาที่ถาม)
    return Zone(f"{iso}:{district_th}"[:200], district_th, district_en, province_th, province_en)


def assign(cat_id: str, lat: float, lng: float) -> None:
    """หาโซนแล้วบันทึกให้หมุด — พลาดก็ข้ามไป"""
    if not ENABLED:
        return
    try:
        zone = lookup(lat, lng)
        if not zone:
            _failed.add(cat_id)
            return
        client = get_client()
        client.table("zones").upsert(
            {
                "key": zone.key,
                "name_th": zone.name_th,
                "name_en": zone.name_en,
                "province_th": zone.province_th,
                "province_en": zone.province_en,
            },
            on_conflict="key",
        ).execute()
        client.table("cats").update({"zone_key": zone.key}).eq("id", cat_id).execute()
    except Exception:
        # ยังไม่ได้รัน migration 0026 / ฐานข้อมูลมีปัญหา
        log.warning("assign zone failed for %s", cat_id, exc_info=True)


def assign_later(cat_id: str, lat: float, lng: float) -> None:
    if ENABLED:
        threading.Thread(target=assign, args=(cat_id, lat, lng), daemon=True).start()


def backfill_pending(batch: int = 10) -> None:
    """เติมโซนให้หมุดที่ยังไม่มี — เรียกจาก /health (ไม่เกิน 2 นาทีครั้ง ทีละไม่กี่หมุด)"""
    global _last_sweep, _sweeping
    if not ENABLED:
        return
    with _sweep_lock:
        if _sweeping or time.monotonic() - _last_sweep < 120:
            return
        _last_sweep = time.monotonic()
        _sweeping = True

    def run():
        global _sweeping
        try:
            client = get_client()
            pending = client.table("cats").select("id").is_("zone_key", "null").limit(batch + len(_failed)).execute().data
            ids = [r["id"] for r in pending if r["id"] not in _failed][:batch]
            if not ids:
                return
            rows = client.table("cats_public").select("id, lat, lng").in_("id", ids).execute().data
            for row in rows:
                assign(row["id"], row["lat"], row["lng"])
        except Exception:
            log.warning("zone backfill failed", exc_info=True)
        finally:
            _sweeping = False

    threading.Thread(target=run, daemon=True).start()
