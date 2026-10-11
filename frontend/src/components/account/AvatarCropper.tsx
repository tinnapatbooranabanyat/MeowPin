import { Minus, Plus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { useI18n } from '../../hooks/useI18n'
import { ApiError } from '../../lib/api'
import { Modal } from '../ui/Modal'

const OUTPUT_SIZE = 320
// รูปจากกล้องมือถือ (12–50 ล้านพิกเซล) กินหน่วยความจำมากจนบางเครื่องปิดแท็บทิ้ง (จอขาว)
// — ย่อให้ด้านยาวไม่เกินนี้ก่อน crop (รูปโปรไฟล์ออกมาแค่ 320px อยู่แล้ว)
const MAX_EDIT_SIZE = 1600

/** ย่อรูปก่อนเอาไปแสดงในตัว crop — ย่อไม่ได้ (เช่น HEIC ในบางเบราว์เซอร์) ใช้ไฟล์เดิม */
async function prepareForEditing(file: File): Promise<string> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_EDIT_SIZE / Math.max(bitmap.width, bitmap.height))
    if (scale === 1) {
      bitmap.close()
      return URL.createObjectURL(file)
    }
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
    canvas.width = canvas.height = 0
    return URL.createObjectURL(blob ?? file)
  } catch {
    return URL.createObjectURL(file)
  }
}

interface Props {
  file: File
  onCancel: () => void
  onCropped: (image: Blob) => Promise<void>
}

/** ตัดรูปตามกรอบที่เลือกเป็นสี่เหลี่ยมจัตุรัส 320px แล้วแปลงเป็น WebP (ไม่มี EXIF ติดไป) */
async function cropToWebp(src: string, area: Area): Promise<Blob> {
  const img = new Image()
  img.src = src
  await img.decode()
  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_SIZE
  canvas.height = OUTPUT_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob'))), 'image/webp', 0.85),
  )
}

export function AvatarCropper({ file, onCancel, onCropped }: Props) {
  const { t } = useI18n()
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    let url: string | null = null
    prepareForEditing(file).then((next) => {
      url = next
      if (cancelled) URL.revokeObjectURL(next)
      else setSrc(next)
    })
    // StrictMode เรียก effect ซ้ำ: รอบแรกถูกยกเลิกและคืนหน่วยความจำของรูปเอง
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [file])
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState<Area | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onCropComplete = useCallback((_: Area, pixels: Area) => setArea(pixels), [])

  const cancel = () => onCancel()

  const save = async () => {
    if (!area || !src) return
    setSaving(true)
    setError(null)
    try {
      await onCropped(await cropToWebp(src, area))
    } catch (e) {
      setError(t(e instanceof ApiError ? e.message : 'อัปโหลดรูปไม่สำเร็จ ลองใหม่อีกครั้ง'))
      setSaving(false)
    }
  }

  return (
    <Modal title={t('ปรับรูปโปรไฟล์')} onClose={cancel}>
      <div className="flex flex-col gap-4">
        <div className="relative h-72 overflow-hidden rounded-2xl bg-black">
          {!src && (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-white/70">{t('กำลังเตรียมรูป…')}</p>
          )}
          {src && (
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
          )}
        </div>
        <p className="-mt-2 text-center text-xs text-stone-500">{t('ลากเพื่อเลื่อนรูป ใช้นิ้วหรือแถบด้านล่างเพื่อซูม')}</p>

        <label className="flex items-center gap-3">
          <Minus size={16} className="text-stone-500" aria-hidden="true" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label={t('ซูม')}
            className="flex-1 accent-orange-500"
          />
          <Plus size={16} className="text-stone-500" aria-hidden="true" />
        </label>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={cancel}
            className="h-11 flex-1 rounded-full font-medium text-stone-700 ring-1 ring-stone-300 hover:bg-stone-50"
          >
            {t('ยกเลิก')}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || !area}
            className="h-11 flex-1 rounded-full bg-orange-500 font-medium text-white transition active:scale-95 hover:bg-orange-600 disabled:opacity-70"
          >
            {saving ? t('กำลังบันทึก…') : t('ใช้รูปนี้')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
