import { Minus, Plus } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { useI18n } from '../../hooks/useI18n'
import { ApiError } from '../../lib/api'
import { Modal } from '../ui/Modal'

const OUTPUT_SIZE = 320

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
  // คืนหน่วยความจำของรูปตอนปิดหน้าต่าง (ไม่ใช้ cleanup ของ effect เพราะ StrictMode จะ revoke ทิ้งก่อนใช้)
  const src = useMemo(() => URL.createObjectURL(file), [file])
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState<Area | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onCropComplete = useCallback((_: Area, pixels: Area) => setArea(pixels), [])

  const cancel = () => {
    URL.revokeObjectURL(src)
    onCancel()
  }

  const save = async () => {
    if (!area) return
    setSaving(true)
    setError(null)
    try {
      await onCropped(await cropToWebp(src, area))
      URL.revokeObjectURL(src)
    } catch (e) {
      setError(t(e instanceof ApiError ? e.message : 'อัปโหลดรูปไม่สำเร็จ ลองใหม่อีกครั้ง'))
      setSaving(false)
    }
  }

  return (
    <Modal title={t('ปรับรูปโปรไฟล์')} onClose={cancel}>
      <div className="flex flex-col gap-4">
        <div className="relative h-72 overflow-hidden rounded-2xl bg-black">
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
