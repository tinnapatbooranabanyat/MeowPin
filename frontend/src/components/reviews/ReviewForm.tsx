import { ImagePlus, ThumbsDown, ThumbsUp, X } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { saveReview, uploadCatPhoto } from '../../lib/api'
import type { Review } from '../../types'
import { PawRatingInput } from './PawRating'
import { useI18n } from '../../hooks/useI18n'

interface Props {
  catId: string
  existing?: Review
  /** จำนวนรูปที่แนบกับรีวิวนี้ไว้แล้ว (แนบได้รวมไม่เกิน 4) */
  attachedPhotos?: number
  onCancel: () => void
  onSaved: () => void
}

const MAX_PHOTOS = 4

export function ReviewForm({ catId, existing, attachedPhotos = 0, onCancel, onSaved }: Props) {
  const { t } = useI18n()
  const [paws, setPaws] = useState(existing?.paws ?? 0)
  const [recommend, setRecommend] = useState<boolean | null>(existing?.recommend ?? null)
  const [comment, setComment] = useState(existing?.comment ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([])
  // บันทึกรีวิวไปแล้วแต่อัปโหลดรูปบางรูปไม่ผ่าน → กดส่งอีกครั้งจะแก้รีวิวเดิม ไม่สร้างซ้ำ
  const [savedId, setSavedId] = useState<string | undefined>(existing?.id)
  const fileInput = useRef<HTMLInputElement>(null)
  const previews = useRef<string[]>([])
  const slotsLeft = MAX_PHOTOS - attachedPhotos - photos.length

  useEffect(() => () => previews.current.forEach((url) => URL.revokeObjectURL(url)), [])

  const addPhotos = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []).slice(0, Math.max(0, slotsLeft))
    e.target.value = ''
    const next = picked.map((file) => {
      const preview = URL.createObjectURL(file)
      previews.current.push(preview)
      return { file, preview }
    })
    setPhotos((prev) => [...prev, ...next])
  }

  const removePhoto = (preview: string) => {
    URL.revokeObjectURL(preview)
    setPhotos((prev) => prev.filter((p) => p.preview !== preview))
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (paws === 0) return setError(t('ให้คะแนนอุ้งเท้าก่อน'))
    if (recommend === null) return setError(t('เลือกว่าแนะนำหรือไม่แนะนำ'))
    setSaving(true)
    setError(null)
    try {
      const reviewId = await saveReview(catId, { paws, recommend, comment: comment.trim() }, savedId)
      setSavedId(reviewId)
      if (photos.length) {
        // ไลบรารีบีบอัดรูปโหลดเฉพาะตอนมีรูปจะอัปโหลด
        const { compressPhoto } = await import('../../lib/photo')
        const failed: { photo: (typeof photos)[number]; reason: string }[] = []
        for (const [i, photo] of photos.entries()) {
          setProgress(t('กำลังอัปโหลดรูป {i}/{n}…', { i: i + 1, n: photos.length }))
          try {
            await uploadCatPhoto(catId, await compressPhoto(photo.file), reviewId)
          } catch (err) {
            failed.push({ photo, reason: t(err instanceof Error ? err.message : 'อัปโหลดรูปไม่สำเร็จ ลองใหม่อีกครั้ง') })
          }
        }
        setProgress(null)
        if (failed.length) {
          setPhotos(failed.map((f) => f.photo))
          setError(t('บันทึกรีวิวแล้ว แต่อัปโหลดรูปไม่สำเร็จ {n} รูป: {reason}', { n: failed.length, reason: failed[0].reason }))
          setSaving(false)
          return
        }
      }
      onSaved()
    } catch (err) {
      setError(t(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ'))
      setSaving(false)
      setProgress(null)
    }
  }

  const choice = (value: boolean) =>
    `flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-sm font-medium ring-1 transition-colors ${
      recommend === value
        ? value
          ? 'bg-emerald-500 text-white ring-emerald-500'
          : 'bg-[#57534e] text-white ring-[#57534e]'
        : 'bg-surface text-stone-700 ring-stone-300 hover:bg-stone-50'
    }`

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl bg-stone-50 p-3.5" noValidate>
      <PawRatingInput
        value={paws}
        onChange={(v) => {
          setPaws(v)
          setError(null)
        }}
      />
      <div className="flex gap-2" role="radiogroup" aria-label={t('แนะนำให้คนอื่นมาเจอไหม')}>
        <button
          type="button"
          role="radio"
          aria-checked={recommend === true}
          onClick={() => {
            setRecommend(true)
            setError(null)
          }}
          className={choice(true)}
        >
          <ThumbsUp size={16} aria-hidden="true" /> {t('แนะนำ')}
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={recommend === false}
          onClick={() => {
            setRecommend(false)
            setError(null)
          }}
          className={choice(false)}
        >
          <ThumbsDown size={16} aria-hidden="true" /> {t('ไม่แนะนำ')}
        </button>
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        maxLength={500}
        placeholder={t('เล่าความประทับใจ (ไม่บังคับ)')}
        aria-label={t('ความคิดเห็น')}
        className="resize-none rounded-xl border border-stone-300 bg-surface px-3.5 py-2.5 text-[15px] text-stone-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200"
      />
      <div className="flex flex-wrap gap-2">
        {photos.map((photo) => (
          <div key={photo.preview} className="relative size-20 animate-pop-in overflow-hidden rounded-xl bg-stone-200">
            <img src={photo.preview} alt="" className="size-full object-cover" />
            <button
              type="button"
              onClick={() => removePhoto(photo.preview)}
              className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
              aria-label={t('ลบรูปนี้')}
            >
              <X size={14} />
            </button>
          </div>
        ))}
        {slotsLeft > 0 && (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="flex size-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-stone-300 text-xs text-stone-500 transition hover:border-orange-400 hover:text-orange-700"
          >
            <ImagePlus size={20} aria-hidden="true" />
            {t('เพิ่มรูป')}
          </button>
        )}
        <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={addPhotos} />
      </div>
      {(photos.length > 0 || attachedPhotos > 0) && (
        <p className="-mt-1 text-xs text-stone-500">{t('รูปจะเข้าไปอยู่ในอัลบั้มของน้อง (สูงสุด {n} รูปต่อรีวิว)', { n: MAX_PHOTOS })}</p>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-10 flex-1 rounded-full text-sm font-medium text-stone-700 ring-1 ring-stone-300 hover:bg-surface"
        >
          {t('ยกเลิก')}
        </button>
        <button
          type="submit"
          disabled={saving}
          className="h-10 flex-1 rounded-full bg-orange-500 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-70"
        >
          {progress ?? t(saving ? 'กำลังบันทึก…' : savedId ? 'บันทึกการแก้ไข' : 'ส่งรีวิว')}
        </button>
      </div>
    </form>
  )
}
