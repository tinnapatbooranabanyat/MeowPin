import { ScrollText, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useI18n } from '../../hooks/useI18n'
import { termsFor, TERMS_UPDATED } from '../../lib/terms'

type Props =
  | { mode: 'view'; onClose: () => void }
  /** ยังไม่ยอมรับ — ปิดไม่ได้ ต้องยอมรับหรือออกจากระบบ */
  | { mode: 'accept'; onAccept: () => Promise<void>; onDecline: () => void }

export function TermsDialog(props: Props) {
  const { t, lang } = useI18n()
  const [agreed, setAgreed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const onClose = props.mode === 'view' ? props.onClose : undefined

  useEffect(() => {
    if (!onClose) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const accept = async () => {
    if (props.mode !== 'accept') return
    setSaving(true)
    setError(null)
    try {
      await props.onAccept()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง')
      setSaving(false)
    }
  }

  const date = new Date(TERMS_UPDATED).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-GB', { dateStyle: 'long' })

  return (
    <div className="pointer-events-auto fixed inset-0 z-[60] flex animate-fade-in items-end justify-center bg-black/50 md:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92%] w-full animate-sheet-up flex-col rounded-t-3xl bg-surface shadow-xl md:max-w-lg md:animate-pop-in md:rounded-3xl"
      >
        <div className="flex items-start gap-3 px-5 pt-5 pb-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600">
            <ScrollText size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="terms-title" className="font-display text-xl text-stone-900">
              {t('ข้อกำหนดการใช้งาน MeowPin')}
            </h2>
            <p className="text-xs text-stone-500">{t('ปรับปรุงล่าสุด {date}', { date })}</p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="-mr-1 shrink-0 rounded-full p-1.5 text-stone-500 hover:bg-stone-100"
              aria-label={t('ปิด')}
            >
              <X size={22} />
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto border-y border-stone-100 px-5 py-4">
          {props.mode === 'accept' && (
            <p className="mb-4 text-sm text-stone-700">{t('ยินดีต้อนรับ! ก่อนเริ่มปักหมุดและรีวิวน้องแมว อ่านและยอมรับข้อกำหนดนี้ก่อนนะ')}</p>
          )}
          <div className="flex flex-col gap-4">
            {termsFor(lang).map((section, i) => (
              <section key={section.title}>
                <h3 className="mb-1.5 font-medium text-stone-900">
                  {i + 1}. {section.title}
                </h3>
                <ul className="flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed text-stone-700 marker:text-orange-400">
                  {section.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>

        {props.mode === 'accept' && (
          <div className="flex flex-col gap-3 px-5 pt-4 pb-8 md:pb-5">
            <label className="flex cursor-pointer items-start gap-2.5 text-sm text-stone-800">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-orange-500"
              />
              {t('ฉันอ่านและยอมรับข้อกำหนดการใช้งาน')}
            </label>
            {error && (
              <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                {t(error)}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={props.onDecline}
                disabled={saving}
                className="flex-1 rounded-full border border-stone-300 px-4 py-2.5 font-medium text-stone-700 transition hover:bg-stone-100 disabled:opacity-60"
              >
                {t('ไม่ยอมรับ (ออกจากระบบ)')}
              </button>
              <button
                type="button"
                onClick={accept}
                disabled={!agreed || saving}
                className="flex-1 rounded-full bg-orange-500 px-4 py-2.5 font-medium text-white transition hover:bg-orange-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t(saving ? 'กำลังบันทึก…' : 'ยอมรับและเริ่มใช้งาน')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
