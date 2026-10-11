import math
import random

EARTH_RADIUS_M = 6_371_000


def distance_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    h = math.sin(d_lat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(h))


def blur(lat: float, lng: float, min_m: float = 50, max_m: float = 100) -> tuple[float, float]:
    """สุ่มขยับพิกัด min–max เมตร — ใช้กับแมวมีเจ้าของ ไม่ให้ระบุบ้านได้"""
    distance = random.uniform(min_m, max_m)
    angle = random.uniform(0, 2 * math.pi)
    d_lat = distance * math.cos(angle) / 111_320
    d_lng = distance * math.sin(angle) / (111_320 * math.cos(math.radians(lat)))
    return lat + d_lat, lng + d_lng
