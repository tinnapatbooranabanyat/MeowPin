import { useState, type FormEvent } from 'react'
import { sendBugReport } from '../lib/api'
import type { ReportCategory } from '../types'
import { Modal } from './ui/Modal'
import { useI18n } from '../hooks/useI18n'

const CATEGORIES: { value: ReportCategory; label: string }[] = [
  { value: 'bug', label: 'เจอปัญหา / บั๊ก' },
  { value: 'idea', label: 'เสนอไอเดีย' },
  { value: 'other', label: 'อื่นๆ' },
]

const MIN_LENGTH = 5

export function BugReportDialog({ onClose, onSent }: { onClose: () => void; onSent: () => void }) {
  const { t } = useI18n()
  const [category, setCategory] = useState<ReportCategory>('bug')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (message.trim().length < MIN_LENGTH) return setError(t('เล่ารายละเอียดอีกนิด (อย่างน้อย {n} ตัวอักษร)', { n: MIN_LENGTH }))
    setSending(true)
    try {
      await sendBugReport(category, message.trim())
      onSent()
    } catch (err) {
      setError(t(err instanceof Error ? err.message : 'ส่งไม่สำเร็จ'))
      setSending(false)
    }
  }

  return (
    <Modal title={t('รายงานปัญหา / เสนอไอเดีย')} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <p className="text-sm text-stone-600">{t('ข้อความจะส่งตรงถึงทีม MeowPin พร้อมลิงก์หน้าที่คุณเปิดอยู่และชนิดเบราว์เซอร์')}</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('ประเภท')}>
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={category === c.value}
              onClick={() => setCategory(c.value)}
              className={`h-9 rounded-full px-3.5 text-sm ring-1 ${
                category === c.value
                  ? 'bg-orange-500 text-white ring-orange-500'
                  : 'bg-surface text-stone-700 ring-stone-300 hover:bg-orange-50'
              }`}
            >
              {t(c.label)}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-stone-700">{t('รายละเอียด')}</span>
          <textarea
            value={message}
            onChange={(e) => {
              setMessage(e.target.value)
              setError(null)
            }}
            rows={5}
            maxLength={2000}
            placeholder={t(category === 'idea' ? 'อยากให้มีฟีเจอร์…' : 'กดอะไรแล้วเกิดอะไรขึ้น ควรจะเป็นแบบไหน')}
            aria-invalid={error !== null}
            className={`resize-none rounded-xl border bg-surface px-3.5 py-2.5 text-[15px] text-stone-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200 ${
              error ? 'border-red-400' : 'border-stone-300'
            }`}
          />
          {error && <span className="text-sm text-red-600">{error}</span>}
        </label>
        <button
          type="submit"
          disabled={sending}
          className="h-12 rounded-full bg-orange-500 font-medium text-white hover:bg-orange-600 disabled:opacity-70"
        >
          {sending ? t('กำลังส่ง…') : t('ส่งรายงาน')}
        </button>
      </form>
    </Modal>
  )
}
