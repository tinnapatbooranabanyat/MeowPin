import { Camera, CatIcon, ImageUp, ScanSearch } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { ApiError, checkCatPhoto, createCat, fetchCatsInView, recordSighting, uploadCatPhoto, wakeBackend } from '../../lib/api'
import { isAndroid, isImageFile, UPLOAD_ACCEPT } from '../../lib/device'
import { distanceMeters, getCurrentPosition, type GpsFix } from '../../lib/geo'
import { compressPhoto, guessFurColor, loadImage, readPhotoMeta } from '../../lib/photo'
import type { Cat, CatCheck, FurColor, LatLng, Verification } from '../../types'
import { Modal } from '../ui/Modal'
import { CameraCapture } from './CameraCapture'
import { CatForm, type CatFormValues } from './CatForm'
import { LocationPicker } from './LocationPicker'
import { NearbyMatch, type NearbyCat } from './NearbyMatch'
import { useI18n } from '../../hooks/useI18n'

// ขยับหมุดจากตำแหน่ง GPS/EXIF เกินระยะนี้ → นับเป็นปักหมุดเอง
const MAX_ADJUST_M = 50
const OLD_PHOTO_DAYS = 30
// รูปไม่มีตำแหน่งแต่เพิ่งถ่ายภายในเวลานี้ → ใช้ตำแหน่งปัจจุบันของเครื่องเป็นจุดเริ่ม (น่าจะยังอยู่ใกล้น้อง)
const FRESH_PHOTO_MIN = 60
// มีหมุดอื่นอยู่ในระยะนี้ → ถามก่อนว่าใช่ตัวเดียวกันไหม (กันหมุดซ้ำ)
const DUPLICATE_RADIUS_M = 50

interface Draft {
  /** รูปที่บีบอัดแล้ว (WebP ไม่มี EXIF) ส่งขึ้น server */
  photo: File
  photoUrl: string
  catScore: number
  /** null = ระบบไม่แน่ใจ ผู้ใช้ต้องกดยืนยันเองก่อน (จะกลายเป็น user) */
  catCheck: CatCheck | null
  /** ผลตรวจที่ server เซ็นไว้ — ส่งกลับตอนปักหมุด จะได้ไม่ต้องตรวจซ้ำ */
  checkToken: string | null
  guessedFur: FurColor
  sourcePosition: LatLng
  /** false = sourcePosition เป็นแค่ศูนย์กลางแผนที่ ไม่ใช่ GPS/EXIF */
  sourceKnown: boolean
  /** รูปไม่มีตำแหน่ง เลยใช้ GPS ของเครื่องตอนนี้แทน (นับเป็นปักหมุดเอง) */
  fromDevice: boolean
  /** มือถือลบตำแหน่งออกจากรูป (มีช่อง GPS แต่ค่าว่าง) */
  gpsRedacted: boolean
  /** ได้รูปมาจากกล้องในแอป หรืออัปโหลดจากเครื่อง */
  source: 'camera' | 'upload'
  verification: Verification
  takenAt: Date | null
}

type Step =
  | { kind: 'source' }
  | { kind: 'camera' }
  | { kind: 'analyzing'; previewUrl: string }
  /** ระบบไม่แน่ใจว่าเป็นแมว (หรือตรวจไม่สำเร็จ) — ลองรูปใหม่ หรือยืนยันเองแล้วไปต่อได้ */
  | { kind: 'rejected'; previewUrl: string; message: string; messageEn: string | null; draft: Draft | null }
  | { kind: 'pick'; draft: Draft }
  | { kind: 'details'; draft: Draft; position: LatLng; verification: Verification; notices: string[] }
  | {
      kind: 'nearby'
      draft: Draft
      position: LatLng
      verification: Verification
      notices: string[]
      nearby: NearbyCat[]
    }

export type AddCatStart = { kind: 'camera' } | { kind: 'upload'; file: File }

interface Props {
  /** จุดที่ผู้ใช้กดค้างบนแผนที่ */
  origin: LatLng
  start: AddCatStart
  onClose: () => void
  onAdded: (cat: Cat) => void
  /** ผู้ใช้บอกว่าเป็นน้องที่ปักไว้แล้ว — บันทึกว่าเจอแทนการปักหมุดใหม่ */
  onMatched: (cat: Cat, sighting: { sightings: number; lastSeenAt: string } | null) => void
}

export function AddCatFlow({ origin, start, onClose, onAdded, onMatched }: Props) {
  const { t, lang } = useI18n()
  const [step, setStep] = useState<Step>(start.kind === 'camera' ? { kind: 'camera' } : { kind: 'source' })
  const [gps, setGps] = useState<GpsFix | null | undefined>(undefined)
  const gpsPromise = useRef<Promise<GpsFix | null> | null>(null)
  const uploadInput = useRef<HTMLInputElement>(null)
  const nativeCameraInput = useRef<HTMLInputElement>(null)
  const draftPhotoUrl = useRef<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [pickError, setPickError] = useState<string | null>(null)

  // StrictMode เรียก effect 2 รอบตอน dev — กันไม่ให้ตรวจรูปเดียวกันซ้ำ
  const started = useRef(false)
  useEffect(() => {
    // ปลุก server ไว้ก่อนระหว่างที่ผู้ใช้กำลังถ่ายรูป (Render แบบฟรีหลับเมื่อไม่มีคนใช้)
    wakeBackend()
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
    if (!isImageFile(file)) {
      setStep({ kind: 'source' })
      setPickError(t('ไฟล์นี้ไม่ใช่รูปภาพ เลือกไฟล์รูปน้องแมวนะ'))
      return
    }
    setPickError(null)
    const previewUrl = URL.createObjectURL(file)
    setStep({ kind: 'analyzing', previewUrl })
    try {
      // อ่าน EXIF จากไฟล์ต้นฉบับก่อน เพราะ compressPhoto จะลบ EXIF ทิ้ง
      const meta = source === 'upload' ? await readPhotoMeta(file) : null
      const compressed = await compressPhoto(file)
      const photoUrl = URL.createObjectURL(compressed)
      const img = await loadImage(photoUrl)
      // ตรวจที่ server (โมเดล → ไม่มั่นใจค่อยถาม AI) ตรวจไม่สำเร็จก็ยังให้ผู้ใช้ยืนยันเองแล้วไปต่อได้
      const check = await checkCatPhoto(compressed).catch((e: unknown) => (e instanceof Error ? e : new Error(String(e))))

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
      // Android/iOS มักลบตำแหน่งออกจากรูปตอนเลือกผ่านเบราว์เซอร์ แต่เวลาถ่ายยังอยู่ — รูปเพิ่งถ่ายก็ใช้ GPS ตอนนี้แทน
      let fromDevice = false
      const fresh = meta?.takenAt && Date.now() - meta.takenAt.getTime() < FRESH_PHOTO_MIN * 60_000
      if (source === 'upload' && !meta?.position && fresh) {
        requestGps()
        const fix = await gpsPromise.current
        if (fix) {
          sourcePosition = fix.position
          fromDevice = true
        }
      }

      draftPhotoUrl.current = photoUrl
      const checked = check instanceof Error ? null : check
      const draft: Draft = {
        photo: compressed,
        photoUrl,
        catScore: checked?.score ?? 0,
        catCheck: checked?.isCat ? checked.method : null,
        checkToken: checked?.token ?? null,
        guessedFur: guessFurColor(img),
        sourcePosition,
        sourceKnown: verification !== 'manual',
        fromDevice,
        gpsRedacted: meta?.gpsRedacted ?? false,
        source,
        verification,
        takenAt: meta?.takenAt ?? null,
      }
      if (!checked?.isCat) {
        const failed = check instanceof ApiError && check.status === 401
        setStep({
          kind: 'rejected',
          previewUrl,
          message: checked?.message ?? (check instanceof Error ? check.message : 'ตรวจรูปไม่สำเร็จ เช็กอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง'),
          messageEn: checked?.messageEn ?? null,
          // ยังไม่ล็อกอิน = ไปต่อไม่ได้อยู่แล้ว
          draft: failed ? null : draft,
        })
        return
      }
      URL.revokeObjectURL(previewUrl)
      setStep({ kind: 'pick', draft })
    } catch {
      setStep({ kind: 'rejected', previewUrl, message: 'ตรวจรูปไม่สำเร็จ เช็กอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง', messageEn: null, draft: null })
    }
  }

  /** หมุดอื่นในระยะ DUPLICATE_RADIUS_M — สีเดียวกับที่เดาจากรูปขึ้นก่อน แล้วเรียงตามระยะ */
  async function findNearby(position: LatLng, guessedFur: FurColor): Promise<NearbyCat[]> {
    const pad = 0.0007 // ~75 ม.
    try {
      const cats = await fetchCatsInView({
        minLat: position.lat - pad,
        maxLat: position.lat + pad,
        minLng: position.lng - pad,
        maxLng: position.lng + pad,
      })
      return cats
        .map((cat) => ({ cat, distance: distanceMeters(position, cat.position), sameColor: cat.furColor === guessedFur }))
        .filter((c) => c.distance <= DUPLICATE_RADIUS_M)
        .sort((a, b) => Number(b.sameColor) - Number(a.sameColor) || a.distance - b.distance)
        .slice(0, 5)
    } catch {
      // ค้นไม่ได้ก็ปักหมุดต่อตามปกติ
      return []
    }
  }

  const [matching, setMatching] = useState(false)
  const [matchError, setMatchError] = useState<string | null>(null)

  const sameCat = async (draft: Draft, cat: Cat, addPhoto: boolean) => {
    setMatching(true)
    setMatchError(null)
    let sighting: { sightings: number; lastSeenAt: string } | null = null
    try {
      sighting = await recordSighting(cat.id)
    } catch (e) {
      // เพิ่งกดเจอไปไม่ถึง 10 นาที — ไม่เป็นไร ยังเพิ่มรูปได้
      if (!(e instanceof ApiError && e.status === 429)) {
        setMatchError(t(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง'))
        setMatching(false)
        return
      }
    }
    if (addPhoto) {
      try {
        await uploadCatPhoto(cat.id, draft.photo, undefined, draft.catCheck === 'user')
      } catch {
        // รูปไม่ผ่าน/อัปไม่สำเร็จ ก็ยังนับว่าเจอน้องแล้ว
      }
    }
    onMatched(cat, sighting)
  }

  const confirmPosition = async (draft: Draft, position: LatLng) => {
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
    const nearby = await findNearby(position, draft.guessedFur)
    if (nearby.length) {
      setMatchError(null)
      setStep({ kind: 'nearby', draft, position, verification, notices, nearby })
      return
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
        furColorCustom: values.furColorCustom,
        checkToken: draft.checkToken,
        confirmCat: draft.catCheck === 'user',
      })
      onAdded(cat)
    } catch (e) {
      if (e instanceof ApiError && e.code === 'not_cat') {
        // ผลตรวจเดิมหมดอายุแล้ว ตรวจใหม่ไม่ผ่าน — กดปักหมุดอีกครั้ง = ยืนยันเองว่าเป็นแมว
        setStep((prev) => (prev.kind === 'details' ? { ...prev, draft: { ...prev.draft, catCheck: 'user' } } : prev))
        setSaveError(t('ระบบตรวจรูปอีกรอบแล้วไม่แน่ใจว่าเป็นแมว ถ้าแน่ใจว่าเป็นน้องแมว กดปักหมุดอีกครั้งเพื่อยืนยัน'))
      } else {
        setSaveError(t(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง'))
      }
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
      {/* Android: ไม่จำกัดชนิดไฟล์ → เลือกแอปเองได้ (แกลเลอรี/Files) แทน Photo Picker ที่ลบตำแหน่ง GPS ออกจากรูป */}
      <input ref={uploadInput} type="file" accept={UPLOAD_ACCEPT} hidden onChange={onFileChosen('upload')} />
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
    const hint = draft.fromDevice
      ? t('รูปนี้ไม่มีข้อมูลตำแหน่ง แต่เพิ่งถ่ายไม่นาน เลยวางหมุดที่ตำแหน่งปัจจุบันของคุณให้ ขยับได้ถ้าไม่ตรง')
      : !draft.sourceKnown
      ? draft.source === 'upload'
        ? draft.gpsRedacted
          ? t('มือถือลบตำแหน่งออกจากรูปนี้ตอนเลือกรูป — เลื่อนแผนที่ไปที่ที่เจอแมว หรือครั้งหน้าใช้ "ถ่ายรูปตอนนี้" ในแอปเพื่อให้ได้ตำแหน่งอัตโนมัติ')
          : isAndroid
          ? t('รูปนี้ไม่มีข้อมูลตำแหน่ง — ลองเลือกรูปผ่านแอป Files (โฟลเดอร์ DCIM → Camera) ซึ่งมักเก็บตำแหน่งไว้ หรือเลื่อนแผนที่ไปที่ที่เจอแมว')
          : t('รูปนี้ไม่มีข้อมูลตำแหน่ง — มือถือหลายรุ่นลบตำแหน่งออกตอนเลือกรูปจากแกลเลอรี เลื่อนแผนที่ไปที่ที่เจอแมว หรือใช้ "ถ่ายรูปตอนนี้" เพื่อยืนยันด้วย GPS')
        : t('ไม่ได้ตำแหน่ง GPS ตอนถ่าย เลื่อนแผนที่ไปที่ที่เจอแมวเลย')
      : sourceFar
        ? t('ย้ายหมุดไปตำแหน่งจาก{source}แล้ว (ห่างจากจุดที่คุณกดค้างประมาณ {m} ม.)', {
            source: sourceName,
            m: Math.round(distance),
          })
        : t(draft.verification === 'camera_gps' ? 'ตำแหน่งจาก GPS ตอนถ่าย ขยับได้เล็กน้อยถ้าไม่ตรง' : 'ตำแหน่งจากข้อมูลในรูป เช็กอีกทีว่าถูกที่')
    return (
      <LocationPicker
        initialPosition={draft.sourceKnown || draft.fromDevice ? draft.sourcePosition : origin}
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
    <Modal onClose={onClose} title={t(step.kind === 'details' ? 'ข้อมูลน้องแมว' : step.kind === 'nearby' ? 'ใช่น้องตัวนี้ไหม?' : 'เพิ่มแมวที่คุณเจอ')}>
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
          {pickError && (
            <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {pickError}
            </p>
          )}
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
          <p className="-mt-2 text-center text-xs text-stone-500">{t('อาจใช้เวลาสักครู่ ถ้า server เพิ่งตื่น')}</p>
        </div>
      )}

      {step.kind === 'rejected' && (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-full overflow-hidden rounded-2xl bg-stone-100">
            <img src={step.previewUrl} alt="" className="aspect-[4/3] w-full object-cover opacity-60 grayscale" />
          </div>
          <CatIcon size={32} className="text-stone-400" aria-hidden="true" />
          <p className="text-stone-700">{lang === 'en' && step.messageEn ? step.messageEn : t(step.message)}</p>
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
          {step.draft && (
            <>
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(step.previewUrl)
                  setStep({ kind: 'pick', draft: { ...step.draft!, catCheck: 'user' } })
                }}
                className="h-12 w-full rounded-full font-medium text-stone-700 ring-1 ring-stone-300 hover:bg-stone-100"
              >
                {t('ใช่ เป็นน้องแมวจริงๆ — ปักหมุดต่อ')}
              </button>
              <p className="-mt-1 text-xs text-stone-500">{t('หมุดจะขึ้นว่า "ยังไม่ยืนยันว่าเป็นแมว" จนกว่าผู้ดูแลจะตรวจ')}</p>
            </>
          )}
        </div>
      )}

      {step.kind === 'nearby' && (
        <NearbyMatch
          nearby={step.nearby}
          photoUrl={step.draft.photoUrl}
          busy={matching}
          error={matchError}
          onSame={(cat, addPhoto) => sameCat(step.draft, cat, addPhoto)}
          onNew={() =>
            setStep({
              kind: 'details',
              draft: step.draft,
              position: step.position,
              verification: step.verification,
              notices: step.notices,
            })
          }
        />
      )}

      {step.kind === 'details' && (
        <CatForm
          photoUrl={step.draft.photoUrl}
          catScore={step.draft.catScore}
          catCheck={step.draft.catCheck ?? 'user'}
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
