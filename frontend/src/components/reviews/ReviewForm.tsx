import { ThumbsDown, ThumbsUp } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { saveReview } from '../../lib/api'
import type { Review } from '../../types'
import { PawRatingInput } from './PawRating'
import { useI18n } from '../../hooks/useI18n'

interface Props {
  catId: string
  existing?: Review
  onCancel: () => void
  onSaved: () => void
}

export function ReviewForm({ catId, existing, onCancel, onSaved }: Props) {
  const { t } = useI18n()
  const [paws, setPaws] = useState(existing?.paws ?? 0)
  const [recommend, setRecommend] = useState<boolean | null>(existing?.recommend ?? null)
  const [comment, setComment] = useState(existing?.comment ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (paws === 0) return setError(t('ให้คะแนนอุ้งเท้าก่อน'))
    if (recommend === null) return setError(t('เลือกว่าแนะนำหรือไม่แนะนำ'))
    setSaving(true)
    try {
      await saveReview(catId, { paws, recommend, comment: comment.trim() }, existing?.id)
      onSaved()
    } catch (err) {
      setError(t(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ'))
      setSaving(false)
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
          {t(saving ? 'กำลังบันทึก…' : existing ? 'บันทึกการแก้ไข' : 'ส่งรีวิว')}
        </button>
      </div>
    </form>
  )
}
