import { useState, type FormEvent } from 'react'
import { useI18n } from '../hooks/useI18n'
import { sendCatReport } from '../lib/api'
import { CAT_REPORT_REASONS } from '../lib/cat'
import type { Cat, CatReportReason } from '../types'
import { Modal } from './ui/Modal'

interface Props {
  cat: Cat
  onClose: () => void
  onSent: () => void
}

export function CatReportDialog({ cat, onClose, onSent }: Props) {
  const { t } = useI18n()
  const [reason, setReason] = useState<CatReportReason | null>(null)
  const [details, setDetails] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!reason) return setError(t('เลือกเหตุผลก่อน'))
    if (reason === 'other' && !details.trim()) return setError(t('เล่ารายละเอียดเพิ่มอีกนิด'))
    setSending(true)
    try {
      await sendCatReport(cat.id, reason, details.trim())
      onSent()
    } catch (err) {
      setError(t(err instanceof Error ? err.message : 'ส่งรายงานไม่สำเร็จ ลองใหม่อีกครั้ง'))
      setSending(false)
    }
  }

  return (
    <Modal title={t('รายงานหมุด {name}', { name: cat.name })} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <p className="text-sm text-stone-600">{t('หมุดนี้มีปัญหาอะไร ทีมงานจะตรวจสอบและลบออกถ้าไม่เหมาะสม')}</p>
        <div className="flex flex-col gap-2" role="radiogroup" aria-label={t('เหตุผล')}>
          {(Object.keys(CAT_REPORT_REASONS) as CatReportReason[]).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={reason === value}
              onClick={() => {
                setReason(value)
                setError(null)
              }}
              className={`rounded-xl px-3.5 py-2.5 text-left ring-1 transition-colors ${
                reason === value ? 'bg-red-50 ring-2 ring-red-400' : 'bg-surface ring-stone-200 hover:bg-stone-50'
              }`}
            >
              <span className="block text-[15px] font-medium text-stone-900">{t(CAT_REPORT_REASONS[value].label)}</span>
              <span className="block text-xs text-stone-500">{t(CAT_REPORT_REASONS[value].hint)}</span>
            </button>
          ))}
        </div>
        <textarea
          value={details}
          onChange={(e) => {
            setDetails(e.target.value)
            setError(null)
          }}
          rows={3}
          maxLength={500}
          placeholder={t('รายละเอียดเพิ่มเติม (ไม่บังคับ)')}
          aria-label={t('รายละเอียดเพิ่มเติม')}
          className="resize-none rounded-xl border border-stone-300 bg-surface px-3.5 py-2.5 text-[15px] text-stone-800 outline-none placeholder:text-stone-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-200"
        />
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={sending}
          className="h-12 rounded-full bg-red-600 font-medium text-white hover:bg-red-700 disabled:opacity-70"
        >
          {sending ? t('กำลังส่ง…') : t('ส่งรายงาน')}
        </button>
      </form>
    </Modal>
  )
}
