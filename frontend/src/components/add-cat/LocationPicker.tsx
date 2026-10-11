import { useMap } from '@vis.gl/react-google-maps'
import { ArrowLeft, Crosshair } from 'lucide-react'
import { useEffect, useState } from 'react'
import { VERIFICATION } from '../../lib/cat'
import { PawPin } from '../PawPin'
import type { LatLng, Verification } from '../../types'
import { useI18n } from '../../hooks/useI18n'

interface Props {
  initialPosition: LatLng
  verification: Verification
  /** ตำแหน่งจาก GPS/EXIF ที่ห่างจากจุดกดค้าง — ให้กดย้ายไปได้ทันที */
  alternative?: { position: LatLng; distance: number; label: string; verification: Verification }
  onBack: () => void
  onConfirm: (position: LatLng) => void
}

const HINTS: Record<Verification, string> = {
  camera_gps: 'ตำแหน่งจาก GPS ตอนถ่าย ขยับได้เล็กน้อยถ้าไม่ตรง',
  exif_gps: 'ตำแหน่งจากข้อมูลในรูป เช็กอีกทีว่าถูกที่',
  manual: 'รูปนี้ไม่มีข้อมูลตำแหน่ง เลื่อนแผนที่ไปที่ที่เจอแมวเลย',
}

// ใช้แผนที่หลักเลือกตำแหน่ง (หมุดค้างกลางจอ เลื่อนแผนที่แทน) — ไม่ต้องโหลดแผนที่ใหม่ ประหยัดโควตา Google
export function LocationPicker({ initialPosition, verification, alternative, onBack, onConfirm }: Props) {
  const { t } = useI18n()
  const map = useMap()
  const [shownVerification, setShownVerification] = useState(verification)

  useEffect(() => {
    if (!map) return
    map.panTo(initialPosition)
    map.setZoom(18)
  }, [map, initialPosition])

  const confirm = () => {
    const center = map?.getCenter()
    onConfirm(center ? { lat: center.lat(), lng: center.lng() } : initialPosition)
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      <div className="pointer-events-auto absolute inset-x-4 top-4 rounded-2xl bg-surface p-4 shadow-lg ring-1 ring-stone-200 md:right-auto md:w-[380px]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="-ml-1 rounded-full p-1.5 text-stone-600 hover:bg-stone-100"
            aria-label={t('ย้อนกลับ')}
          >
            <ArrowLeft size={20} />
          </button>
          <h2 className="font-display text-lg text-stone-900">{t('เจอแมวตรงไหน')}</h2>
          <span
            className={`ml-auto rounded-full px-2.5 py-1 text-xs font-medium ${VERIFICATION[shownVerification].className}`}
          >
            {t(VERIFICATION[shownVerification].label)}
          </span>
        </div>
        <p className="mt-1 text-sm text-stone-600">
          {alternative && shownVerification === 'manual'
            ? t('ตำแหน่งจาก{source}ห่างจากจุดที่คุณกดค้างประมาณ {m} ม.', {
                source: t(alternative.label),
                m: Math.round(alternative.distance),
              })
            : t(HINTS[shownVerification])}
        </p>
        {alternative && shownVerification === 'manual' && (
          <button
            type="button"
            onClick={() => {
              map?.panTo(alternative.position)
              // ตรงกับตำแหน่งจากรูป/GPS แล้ว → server จะยืนยันให้ถ้าไม่ขยับต่อเกิน 50 ม.
              setShownVerification(alternative.verification)
            }}
            className="mt-2 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-sky-700 ring-1 ring-sky-300 hover:bg-sky-50"
          >
            <Crosshair size={15} aria-hidden="true" />
            {t('ย้ายไปตำแหน่งจาก{source}', { source: t(alternative.label) })}
          </button>
        )}
      </div>

      {/* หมุดกลางจอ: ปลายหมุดชี้ตรงจุดศูนย์กลางแผนที่พอดี */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full">
        <PawPin size={48} className="animate-drop-in" />
      </div>
      <div className="absolute top-1/2 left-1/2 size-2 -translate-1/2 rounded-full bg-black/30" aria-hidden="true" />

      <div className="pointer-events-auto absolute inset-x-4 bottom-6 flex justify-center">
        <button
          type="button"
          onClick={confirm}
          className="h-13 w-full max-w-sm rounded-full bg-orange-500 font-medium text-white shadow-lg hover:bg-orange-600"
        >
          {t('ยืนยันตำแหน่งนี้')}
        </button>
      </div>
    </div>
  )
}
