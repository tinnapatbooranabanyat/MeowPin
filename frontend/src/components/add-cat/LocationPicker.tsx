import { useMap } from '@vis.gl/react-google-maps'
import { ArrowLeft, Crosshair, LoaderCircle, LocateFixed } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useI18n } from '../../hooks/useI18n'
import { VERIFICATION } from '../../lib/cat'
import { getCurrentPosition } from '../../lib/geo'
import type { LatLng, Verification } from '../../types'
import { PawPin } from '../PawPin'

interface Props {
  initialPosition: LatLng
  verification: Verification
  /** คำอธิบายใต้หัวข้อ (แปลมาแล้ว) */
  hint: string
  /** ตำแหน่งสำรองให้สลับไปมาได้ — เช่นหมุดเริ่มที่ตำแหน่งจากรูป แต่ผู้ใช้อยากใช้จุดที่กดค้าง */
  alternative?: { position: LatLng; verification: Verification; goLabel: string; backLabel: string }
  onBack: () => void
  onConfirm: (position: LatLng) => void
}

// ใช้แผนที่หลักเลือกตำแหน่ง (หมุดค้างกลางจอ เลื่อนแผนที่แทน) — ไม่ต้องโหลดแผนที่ใหม่ ประหยัดโควตา Google
export function LocationPicker({ initialPosition, verification, hint, alternative, onBack, onConfirm }: Props) {
  const { t } = useI18n()
  const map = useMap()
  const [onAlternative, setOnAlternative] = useState(false)
  const [locating, setLocating] = useState(false)
  const [locateError, setLocateError] = useState<string | null>(null)
  const shownVerification = onAlternative && alternative ? alternative.verification : verification

  useEffect(() => {
    if (!map) return
    map.panTo(initialPosition)
    map.setZoom(18)
  }, [map, initialPosition])

  const toggleAlternative = () => {
    if (!alternative) return
    map?.panTo(onAlternative ? initialPosition : alternative.position)
    setOnAlternative((v) => !v)
  }

  const goToMyLocation = async () => {
    setLocating(true)
    setLocateError(null)
    const fix = await getCurrentPosition(10_000)
    setLocating(false)
    if (!fix) return setLocateError(t('เปิดสิทธิ์เข้าถึงตำแหน่งก่อน แล้วลองใหม่อีกครั้ง'))
    map?.panTo(fix.position)
    map?.setZoom(18)
  }

  const confirm = () => {
    const center = map?.getCenter()
    onConfirm(center ? { lat: center.lat(), lng: center.lng() } : initialPosition)
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      <div className="pointer-events-auto absolute inset-x-4 top-4 animate-pop-in rounded-2xl bg-surface p-4 shadow-lg ring-1 ring-stone-200 md:right-auto md:w-[380px]">
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
        <p className="mt-1 text-sm text-stone-600">{hint}</p>
        {alternative && (
          <button
            type="button"
            onClick={toggleAlternative}
            className="mt-2 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-sky-700 ring-1 ring-sky-300 transition hover:bg-sky-50 active:scale-95"
          >
            <Crosshair size={15} aria-hidden="true" />
            {onAlternative ? alternative.backLabel : alternative.goLabel}
          </button>
        )}
        {locateError && <p className="mt-2 text-sm text-red-600">{locateError}</p>}
      </div>

      {/* หมุดกลางจอ: ปลายหมุดชี้ตรงจุดศูนย์กลางแผนที่พอดี */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full">
        <PawPin size={48} className="animate-drop-in" />
      </div>
      <div className="absolute top-1/2 left-1/2 size-2 -translate-1/2 rounded-full bg-black/30" aria-hidden="true" />

      <button
        type="button"
        onClick={goToMyLocation}
        disabled={locating}
        className="pointer-events-auto absolute right-4 bottom-24 flex size-12 items-center justify-center rounded-full bg-surface text-sky-600 shadow-md ring-1 ring-stone-200 transition hover:bg-stone-50 active:scale-90 md:right-16"
        aria-label={t('ไปที่ตำแหน่งของฉัน')}
      >
        {locating ? <LoaderCircle size={22} className="animate-spin" /> : <LocateFixed size={22} />}
      </button>

      <div className="pointer-events-auto absolute inset-x-4 bottom-6 flex justify-center">
        <button
          type="button"
          onClick={confirm}
          className="h-13 w-full max-w-sm rounded-full bg-orange-500 font-medium text-white shadow-lg transition hover:bg-orange-600 active:scale-95"
        >
          {t('ยืนยันตำแหน่งนี้')}
        </button>
      </div>
    </div>
  )
}
