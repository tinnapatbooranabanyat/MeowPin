import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { LatLng } from '../types'
import { useI18n } from './useI18n'

export interface PlaceSuggestion {
  id: string
  main: string
  secondary: string
  prediction: google.maps.places.PlacePrediction
}

export interface FoundPlace {
  name: string
  position: LatLng
  viewport: google.maps.LatLngBounds | null
}

// ใช้ Places API (New) — ยังไม่เปิดใน Google Cloud ก็แค่ไม่มีผลสถานที่ ค้นหาแมวยังใช้ได้ปกติ
let placesUnavailable = false

/** ค้นหาสถานที่จริงใน Google Maps (ร้าน, ซอย, มหาวิทยาลัย ฯลฯ) ใกล้ๆ บริเวณที่ดูแผนที่อยู่ */
export function usePlaceSearch(query: string) {
  const places = useMapsLibrary('places')
  const map = useMap()
  const { lang } = useI18n()
  const [results, setResults] = useState<{ items: PlaceSuggestion[] }>({ items: [] })
  // 1 session = พิมพ์จนเลือกสถานที่ (Google คิดเงินต่อ session ไม่ใช่ต่อตัวอักษร)
  const session = useRef<google.maps.places.AutocompleteSessionToken | null>(null)
  const q = query.trim()

  useEffect(() => {
    if (!places || placesUnavailable || q.length < 2) return
    let cancelled = false
    const timer = window.setTimeout(async () => {
      session.current ??= new places.AutocompleteSessionToken()
      try {
        const { suggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: q,
          sessionToken: session.current,
          language: lang,
          region: 'th',
          locationBias: map?.getBounds() ?? undefined,
        })
        if (cancelled) return
        setResults({
          items: suggestions.flatMap((s) => {
            const p = s.placePrediction
            if (!p) return []
            return [{ id: p.placeId, main: p.mainText?.text ?? p.text.text, secondary: p.secondaryText?.text ?? '', prediction: p }]
          }).slice(0, 4),
        })
      } catch (error) {
        // API ยังไม่เปิด/คีย์ไม่มีสิทธิ์ → เลิกเรียกจนกว่าจะโหลดหน้าใหม่ (เน็ตหลุดชั่วคราวแค่ข้ามไป)
        if (/disabled|not been used|not authorized|denied/i.test(String(error))) {
          console.warn('ค้นหาสถานที่ไม่ได้ — เปิด Places API (New) ใน Google Cloud หรือยัง?', error)
          placesUnavailable = true
        }
        if (!cancelled) setResults({ items: [] })
      }
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [places, map, q, lang])

  const resolve = useCallback(async (s: PlaceSuggestion): Promise<FoundPlace | null> => {
    const place = s.prediction.toPlace()
    session.current = null
    try {
      await place.fetchFields({ fields: ['displayName', 'location', 'viewport'] })
    } catch {
      return null
    }
    if (!place.location) return null
    return { name: place.displayName ?? s.main, position: place.location.toJSON(), viewport: place.viewport ?? null }
  }, [])

  // ระหว่างรอผลของคำใหม่ แสดงผลเดิมไปก่อน (ไม่ให้รายการกระพริบทุกตัวอักษร)
  return { places: q.length >= 2 ? results.items : [], resolve }
}
