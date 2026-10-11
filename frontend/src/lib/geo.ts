import type { LatLng } from '../types'

const EARTH_RADIUS_M = 6_371_000
const toRad = (deg: number) => (deg * Math.PI) / 180

export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

/** สุ่มขยับพิกัดออกไป min–max เมตร เพื่อไม่ให้ระบุบ้านเจ้าของแมวได้ */
export function blurPosition(position: LatLng, minM = 50, maxM = 100): LatLng {
  const distance = minM + Math.random() * (maxM - minM)
  const angle = Math.random() * 2 * Math.PI
  const metersPerDegLat = 111_320
  return {
    lat: position.lat + (distance * Math.cos(angle)) / metersPerDegLat,
    lng: position.lng + (distance * Math.sin(angle)) / (metersPerDegLat * Math.cos(toRad(position.lat))),
  }
}

export interface GpsFix {
  position: LatLng
  accuracy: number
}

export function getCurrentPosition(timeout = 15_000): Promise<GpsFix | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        resolve({ position: { lat: coords.latitude, lng: coords.longitude }, accuracy: coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout, maximumAge: 30_000 },
    )
  })
}
