import { Camera, LoaderCircle, MapPin, MapPinOff, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { GpsFix } from '../../lib/geo'
import { useI18n } from '../../hooks/useI18n'

interface Props {
  gps: GpsFix | null | undefined
  onCapture: (file: File) => void
  onFallback: () => void
  onClose: () => void
}

// กล้องในแอป: บังคับถ่ายสดตอนนี้ (เลือกรูปเก่าจากเครื่องไม่ได้) จึงเชื่อถือตำแหน่ง GPS ได้มากที่สุด
export function CameraCapture({ gps, onCapture, onFallback, onClose }: Props) {
  const { t } = useI18n()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false
    if (!navigator.mediaDevices?.getUserMedia) {
      // เกิดขึ้นได้ตอนเปิดผ่าน http บนมือถือ (กล้องใช้ได้เฉพาะ https หรือ localhost)
      queueMicrotask(() => setError('เบราว์เซอร์นี้เปิดกล้องในแอปไม่ได้'))
      return
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1440 } } })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop())
        stream = s
        if (videoRef.current) videoRef.current.srcObject = s
      })
      .catch(() => setError('เปิดกล้องไม่ได้ ลองอนุญาตการใช้กล้องในเบราว์เซอร์'))
    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const capture = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => blob && onCapture(new File([blob], `meowpin-${Date.now()}.jpg`, { type: 'image/jpeg' })),
      'image/jpeg',
      0.92,
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-black/40 p-2 backdrop-blur"
          aria-label={t('ปิดกล้อง')}
        >
          <X size={24} />
        </button>
        <GpsChip gps={gps} />
      </div>

      {error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-stone-200">{t(error)}</p>
          <button
            type="button"
            onClick={onFallback}
            className="rounded-full bg-orange-500 px-5 py-3 font-medium text-white hover:bg-orange-600"
          >
            {t('ใช้กล้องของมือถือแทน')}
          </button>
        </div>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedData={() => setReady(true)}
          className="h-full w-full flex-1 object-cover"
        />
      )}

      {!error && (
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 pb-10">
          <p className="rounded-full bg-black/40 px-3 py-1 text-sm backdrop-blur">{t('ถ่ายให้เห็นน้องแมวชัดๆ')}</p>
          <button
            type="button"
            onClick={capture}
            disabled={!ready}
            className="flex size-18 items-center justify-center rounded-full border-4 border-white bg-white/20 transition active:scale-95 disabled:opacity-50"
            aria-label={t('ถ่ายรูป')}
          >
            <span className="flex size-14 items-center justify-center rounded-full bg-white text-orange-500">
              <Camera size={26} />
            </span>
          </button>
        </div>
      )}
    </div>
  )
}

function GpsChip({ gps }: { gps: GpsFix | null | undefined }) {
  const { t } = useI18n()
  const base = 'flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 text-sm backdrop-blur'
  if (gps === undefined) {
    return (
      <span className={base}>
        <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> {t('กำลังหาตำแหน่ง…')}
      </span>
    )
  }
  if (gps === null) {
    return (
      <span className={base}>
        <MapPinOff size={15} aria-hidden="true" /> {t('ไม่ได้ตำแหน่ง GPS')}
      </span>
    )
  }
  return (
    <span className={base}>
      <MapPin size={15} className="text-sky-300" aria-hidden="true" /> {t('GPS ±{m} ม.', { m: Math.round(gps.accuracy) })}
    </span>
  )
}
