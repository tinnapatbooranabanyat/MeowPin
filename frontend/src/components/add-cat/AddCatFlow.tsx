import { Camera, CatIcon, ImageUp, ScanSearch } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { detectCat, loadCatDetector, rejectionMessage } from '../../lib/catDetector'
import { createCat } from '../../lib/api'
import { distanceMeters, getCurrentPosition, type GpsFix } from '../../lib/geo'
import { compressPhoto, guessFurColor, loadImage, readPhotoMeta } from '../../lib/photo'
import type { Cat, FurColor, LatLng, Verification } from '../../types'
import { Modal } from '../ui/Modal'
import { CameraCapture } from './CameraCapture'
import { CatForm, type CatFormValues } from './CatForm'
import { LocationPicker } from './LocationPicker'
import { useI18n } from '../../hooks/useI18n'

// ขยับหมุดจากตำแหน่ง GPS/EXIF เกินระยะนี้ → นับเป็นปักหมุดเอง
const MAX_ADJUST_M = 50
const OLD_PHOTO_DAYS = 30

interface Draft {
  /** รูปที่บีบอัดแล้ว (WebP ไม่มี EXIF) ส่งขึ้น server */
  photo: File
  photoUrl: string
  catScore: number
  guessedFur: FurColor
  sourcePosition: LatLng
  /** false = sourcePosition เป็นแค่ศูนย์กลางแผนที่ ไม่ใช่ GPS/EXIF */
  sourceKnown: boolean
  /** ได้รูปมาจากกล้องในแอป หรืออัปโหลดจากเครื่อง */
  source: 'camera' | 'upload'
  verification: Verification
  takenAt: Date | null
}

type Step =
  | { kind: 'source' }
  | { kind: 'camera' }
  | { kind: 'analyzing'; previewUrl: string }
  | { kind: 'rejected'; previewUrl: string; message: string }
  | { kind: 'pick'; draft: Draft }
  | { kind: 'details'; draft: Draft; position: LatLng; verification: Verification; notices: string[] }

export type AddCatStart = { kind: 'camera' } | { kind: 'upload'; file: File }

interface Props {
  /** จุดที่ผู้ใช้กดค้างบนแผนที่ */
  origin: LatLng
  start: AddCatStart
  onClose: () => void
  onAdded: (cat: Cat) => void
}

export function AddCatFlow({ origin, start, onClose, onAdded }: Props) {
  const { t, lang } = useI18n()
  const [step, setStep] = useState<Step>(start.kind === 'camera' ? { kind: 'camera' } : { kind: 'source' })
  const [gps, setGps] = useState<GpsFix | null | undefined>(undefined)
  const gpsPromise = useRef<Promise<GpsFix | null> | null>(null)
  const uploadInput = useRef<HTMLInputElement>(null)
  const nativeCameraInput = useRef<HTMLInputElement>(null)
  const draftPhotoUrl = useRef<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // StrictMode เรียก effect 2 รอบตอน dev — กันไม่ให้ตรวจรูปเดียวกันซ้ำ
  const started = useRef(false)
  useEffect(() => {
    // เริ่มโหลดโมเดลไว้ก่อนระหว่างที่ผู้ใช้กำลังถ่ายรูป
    loadCatDetector().catch(() => {})
    if (!started.current) {
      started.current = true
      if (start.kind === 'camera') requestGps()
      else processPhoto(start.file, 'upload')
    }
    return () => {
      // คืนหน่วยความจำของรูปพรีวิว (แมวที่บันทึกแล้วใช้ URL ของตัวเอง)
      if (draftPhotoUrl.current) URL.revokeObjectURL(draftPhotoUrl.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- เริ่ม flow ครั้งเดียวตอนเปิด
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function requestGps() {
    if (gpsPromise.current) return
    gpsPromise.current = getCurrentPosition()
    gpsPromise.current.then(setGps)
  }

  const openCamera = () => {
    requestGps()
    setStep({ kind: 'camera' })
  }

  async function processPhoto(file: File, source: 'camera' | 'upload') {
    const previewUrl = URL.createObjectURL(file)
    setStep({ kind: 'analyzing', previewUrl })
    try {
      // อ่าน EXIF จากไฟล์ต้นฉบับก่อน เพราะ compressPhoto จะลบ EXIF ทิ้ง
      const meta = source === 'upload' ? await readPhotoMeta(file) : null
      const compressed = await compressPhoto(file)
      const photoUrl = URL.createObjectURL(compressed)
      const img = await loadImage(photoUrl)
      const detection = await detectCat(img)

      if (!detection.isCat) {
        URL.revokeObjectURL(photoUrl)
        setStep({ kind: 'rejected', previewUrl, message: rejectionMessage(detection) })
        return
      }

      let sourcePosition = origin
      let verification: Verification = 'manual'
      if (source === 'camera') {
        const fix = await gpsPromise.current
        if (fix) {
          sourcePosition = fix.position
          verification = 'camera_gps'
        }
      } else if (meta?.position) {
        sourcePosition = meta.position
        verification = 'exif_gps'
      }

      URL.revokeObjectURL(previewUrl)
      draftPhotoUrl.current = photoUrl
      setStep({
        kind: 'pick',
        draft: {
          photo: compressed,
          photoUrl,
          catScore: detection.score,
          guessedFur: guessFurColor(img, detection.bbox),
          sourcePosition,
          sourceKnown: verification !== 'manual',
          source,
          verification,
          takenAt: meta?.takenAt ?? null,
        },
      })
    } catch {
      setStep({ kind: 'rejected', previewUrl, message: 'ตรวจรูปไม่สำเร็จ เช็กอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง' })
    }
  }

  const confirmPosition = (draft: Draft, position: LatLng) => {
    const notices: string[] = []
    let verification = draft.verification
    if (verification !== 'manual' && distanceMeters(position, draft.sourcePosition) > MAX_ADJUST_M) {
      verification = 'manual'
      notices.push(t('ย้ายหมุดไกลจากตำแหน่งเดิมเกิน {m} ม. เลยนับเป็น “ปักหมุดเอง”', { m: MAX_ADJUST_M }))
    }
    if (draft.takenAt && Date.now() - draft.takenAt.getTime() > OLD_PHOTO_DAYS * 86_400_000) {
      notices.push(
        t('รูปนี้ถ่ายไว้ตั้งแต่ {date} น้องอาจย้ายไปแล้ว', {
          date: draft.takenAt.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-GB', { dateStyle: 'medium' }),
        }),
      )
    }
    setStep({ kind: 'details', draft, position, verification, notices })
  }

  const submit = async (draft: Draft, position: LatLng, verification: Verification, values: CatFormValues) => {
    setSaving(true)
    setSaveError(null)
    try {
      const cat = await createCat({
        photo: draft.photo,
        name: values.name,
        furColor: values.furColor,
        breed: values.breed,
        isFriendly: values.isFriendly,
        isClingy: values.isClingy,
        isPlayful: values.isPlayful,
        neutered: values.neutered,
        position,
        placeName: values.placeName,
        description: values.description,
        ownerStatus: values.ownerStatus,
        verification,
        sourcePosition: draft.sourceKnown ? draft.sourcePosition : null,
        takenAt: draft.takenAt,
      })
      onAdded(cat)
    } catch (e) {
      setSaveError(t(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง'))
      setSaving(false)
    }
  }

  const onFileChosen = (source: 'camera' | 'upload') => (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) processPhoto(file, source)
  }

  const hiddenInputs = (
    <>
      <input ref={uploadInput} type="file" accept="image/*" hidden onChange={onFileChosen('upload')} />
      <input
        ref={nativeCameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={onFileChosen('camera')}
      />
    </>
  )

  if (step.kind === 'camera') {
    return (
      <>
        {hiddenInputs}
        <CameraCapture
          gps={gps}
          onCapture={(file) => processPhoto(file, 'camera')}
          onFallback={() => nativeCameraInput.current?.click()}
          onClose={onClose}
        />
      </>
    )
  }

  if (step.kind === 'pick') {
    const { draft } = step
    const distance = distanceMeters(origin, draft.sourcePosition)
    const sourceFar = draft.sourceKnown && distance > MAX_ADJUST_M
    const sourceName = t(draft.verification === 'camera_gps' ? 'GPS ตอนถ่าย' : 'ข้อมูลในรูป')
    // มีตำแหน่งจากรูป/GPS → เริ่มหมุดที่นั่นเลย (เดิมเริ่มที่จุดกดค้าง ทำให้ดูเหมือนอ่านตำแหน่งในรูปไม่ได้)
    const hint = !draft.sourceKnown
      ? draft.source === 'upload'
        ? t('รูปนี้ไม่มีข้อมูลตำแหน่ง — มือถือหลายรุ่นลบตำแหน่งออกตอนเลือกรูปจากแกลเลอรี เลื่อนแผนที่ไปที่ที่เจอแมว หรือใช้ "ถ่ายรูปตอนนี้" เพื่อยืนยันด้วย GPS')
        : t('ไม่ได้ตำแหน่ง GPS ตอนถ่าย เลื่อนแผนที่ไปที่ที่เจอแมวเลย')
      : sourceFar
        ? t('ย้ายหมุดไปตำแหน่งจาก{source}แล้ว (ห่างจากจุดที่คุณกดค้างประมาณ {m} ม.)', {
            source: sourceName,
            m: Math.round(distance),
          })
        : t(draft.verification === 'camera_gps' ? 'ตำแหน่งจาก GPS ตอนถ่าย ขยับได้เล็กน้อยถ้าไม่ตรง' : 'ตำแหน่งจากข้อมูลในรูป เช็กอีกทีว่าถูกที่')
    return (
      <LocationPicker
        initialPosition={draft.sourceKnown ? draft.sourcePosition : origin}
        verification={draft.verification}
        hint={hint}
        alternative={
          sourceFar
            ? {
                position: origin,
                verification: 'manual',
                goLabel: t('ใช้จุดที่กดค้างแทน'),
                backLabel: t('กลับไปตำแหน่งจาก{source}', { source: sourceName }),
              }
            : undefined
        }
        onBack={() => setStep({ kind: 'source' })}
        onConfirm={(position) => confirmPosition(draft, position)}
      />
    )
  }

  return (
    <Modal onClose={onClose} title={t(step.kind === 'details' ? 'ข้อมูลน้องแมว' : 'เพิ่มแมวที่คุณเจอ')}>
      {hiddenInputs}

      {step.kind === 'source' && (
        <div className="flex flex-col gap-3">
          <SourceButton
            icon={<Camera size={26} />}
            title={t('ถ่ายรูปตอนนี้')}
            subtitle={t('ใช้ GPS ยืนยันตำแหน่ง น่าเชื่อถือที่สุด')}
            badge={t('แนะนำ')}
            onClick={openCamera}
          />
          <SourceButton
            icon={<ImageUp size={26} />}
            title={t('เลือกรูปจากเครื่อง')}
            subtitle={t('ใช้ตำแหน่งจากข้อมูลในรูป (ถ้ามี)')}
            onClick={() => uploadInput.current?.click()}
          />
          <p className="px-1 text-xs leading-relaxed text-stone-500">
            {t('รูปที่ส่งต่อผ่าน LINE หรือ Facebook และรูปแคปหน้าจอมักไม่มีข้อมูลตำแหน่ง ถ้าไม่มีจะให้ปักหมุดเองแทน')}
          </p>
        </div>
      )}

      {step.kind === 'analyzing' && (
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-full overflow-hidden rounded-2xl bg-stone-100">
            <img src={step.previewUrl} alt="" className="aspect-[4/3] w-full object-cover" />
            <div className="absolute inset-x-0 h-1/4 animate-[scan_1.6s_ease-in-out_infinite_alternate] bg-gradient-to-b from-transparent via-orange-400/40 to-transparent" />
          </div>
          <div className="flex items-center gap-2 text-stone-700">
            <ScanSearch size={20} className="text-orange-500" aria-hidden="true" />
            <span className="font-medium">{t('กำลังดูว่าเป็นน้องแมวไหม…')}</span>
          </div>
          <p className="-mt-2 text-center text-xs text-stone-500">{t('ครั้งแรกจะช้าหน่อย เพราะต้องโหลดโมเดล AI')}</p>
        </div>
      )}

      {step.kind === 'rejected' && (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-full overflow-hidden rounded-2xl bg-stone-100">
            <img src={step.previewUrl} alt="" className="aspect-[4/3] w-full object-cover opacity-60 grayscale" />
          </div>
          <CatIcon size={32} className="text-stone-400" aria-hidden="true" />
          <p className="text-stone-700">{t(step.message)}</p>
          <button
            type="button"
            onClick={() => {
              URL.revokeObjectURL(step.previewUrl)
              setStep({ kind: 'source' })
            }}
            className="h-12 w-full rounded-full bg-orange-500 font-medium text-white hover:bg-orange-600"
          >
            {t('ลองรูปใหม่')}
          </button>
        </div>
      )}

      {step.kind === 'details' && (
        <CatForm
          photoUrl={step.draft.photoUrl}
          catScore={step.draft.catScore}
          verification={step.verification}
          notices={step.notices}
          guessedFur={step.draft.guessedFur}
          submitting={saving}
          submitError={saveError}
          onSubmit={(values) => submit(step.draft, step.position, step.verification, values)}
        />
      )}
    </Modal>
  )
}

interface SourceButtonProps {
  icon: ReactNode
  title: string
  subtitle: string
  badge?: string
  onClick: () => void
}

function SourceButton({ icon, title, subtitle, badge, onClick }: SourceButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-4 rounded-2xl p-4 text-left ring-1 ring-stone-200 transition-colors hover:bg-orange-50 hover:ring-orange-300"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 font-medium text-stone-900">
          {title}
          {badge && (
            <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[11px] font-medium text-white">{badge}</span>
          )}
        </span>
        <span className="block text-sm text-stone-500">{subtitle}</span>
      </span>
    </button>
  )
}
