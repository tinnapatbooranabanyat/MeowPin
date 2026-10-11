import { useCallback, useEffect, useRef } from 'react'
import type { LatLng } from '../types'

const HOLD_MS = 500
const MOVE_TOLERANCE_PX = 10

/**
 * กดค้างบนแผนที่ (มือถือ) หรือคลิกขวา (คอมฯ) → ได้พิกัดจุดนั้น
 * ฟัง pointer event ที่ div ของแผนที่โดยตรง เพราะ Google Maps ไม่มี event กดค้าง
 * และ mousedown ของ Maps ไม่ทำงานสม่ำเสมอบนจอสัมผัส
 */
export function useMapLongPress(
  map: google.maps.Map | null,
  onLongPress: (position: LatLng) => void,
  enabled: boolean,
) {
  const callback = useRef(onLongPress)
  useEffect(() => {
    callback.current = onLongPress
  }, [onLongPress])

  // click ที่ตามมาหลังปล่อยนิ้วจากการกดค้าง ไม่ควรไปปิดหมุดที่เพิ่งวาง
  const firedAt = useRef(0)
  const consumeClick = useCallback(() => Date.now() - firedAt.current < 800, [])

  useEffect(() => {
    if (!map || !enabled) return
    const div = map.getDiv()

    // OverlayView เปล่าๆ เพื่อเอา projection ไว้แปลงพิกเซลบนจอ → พิกัด
    const overlay = new google.maps.OverlayView()
    overlay.onAdd = () => {}
    overlay.draw = () => {}
    overlay.onRemove = () => {}
    overlay.setMap(map)

    const toLatLng = (clientX: number, clientY: number): LatLng | null => {
      const projection = overlay.getProjection()
      if (!projection) return null
      const rect = div.getBoundingClientRect()
      return projection.fromContainerPixelToLatLng(new google.maps.Point(clientX - rect.left, clientY - rect.top))?.toJSON() ?? null
    }

    const fire = (clientX: number, clientY: number) => {
      const position = toLatLng(clientX, clientY)
      if (!position) return
      firedAt.current = Date.now()
      navigator.vibrate?.(25)
      callback.current(position)
    }

    let timer: number | undefined
    let start: { x: number; y: number } | null = null
    const pointers = new Set<number>()
    const cancel = () => {
      window.clearTimeout(timer)
      start = null
    }

    const onDown = (e: PointerEvent) => {
      pointers.add(e.pointerId)
      // นิ้วที่สอง = กำลัง pinch zoom ไม่ใช่กดค้าง
      if (pointers.size > 1 || e.button !== 0) return cancel()
      // กดบนหมุดแมว/ปุ่มบนแผนที่ ไม่นับ
      if ((e.target as Element).closest('gmp-advanced-marker, button')) return
      start = { x: e.clientX, y: e.clientY }
      timer = window.setTimeout(() => {
        if (start) fire(start.x, start.y)
        start = null
      }, HOLD_MS)
    }
    const onMove = (e: PointerEvent) => {
      if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > MOVE_TOLERANCE_PX) cancel()
    }
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId)
      cancel()
    }
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      // Android จะส่ง contextmenu ตามหลังการกดค้างด้วย — กันไม่ให้วางหมุดซ้ำ
      if (Date.now() - firedAt.current < 800) return
      cancel()
      fire(e.clientX, e.clientY)
    }

    const opts = { capture: true }
    div.addEventListener('pointerdown', onDown, opts)
    div.addEventListener('pointermove', onMove, opts)
    div.addEventListener('pointerup', onUp, opts)
    div.addEventListener('pointercancel', onUp, opts)
    div.addEventListener('contextmenu', onContextMenu, opts)
    return () => {
      cancel()
      overlay.setMap(null)
      div.removeEventListener('pointerdown', onDown, opts)
      div.removeEventListener('pointermove', onMove, opts)
      div.removeEventListener('pointerup', onUp, opts)
      div.removeEventListener('pointercancel', onUp, opts)
      div.removeEventListener('contextmenu', onContextMenu, opts)
    }
  }, [map, enabled])

  return { consumeClick }
}
