import { Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '../../hooks/useI18n'
import { CHANGELOG } from '../../lib/changelog'
import { Modal } from '../ui/Modal'

/** บันทึกการอัปเดต — มีอะไรใหม่ในแต่ละครั้ง เลือกดูทีละวันได้ */
export function WhatsNewDialog({ onClose, unseenId }: { onClose: () => void; unseenId: string | null }) {
  const { t, lang } = useI18n()
  const [day, setDay] = useState<string | null>(null)
  const locale = lang === 'th' ? 'th-TH' : 'en-GB'
  const dateFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' })
  const chipFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' })
  const toDate = (d: string) => new Date(`${d}T12:00:00`)
  // รายการที่ใหม่กว่าตัวที่เคยเห็น ติดป้าย "ใหม่"
  const seenIndex = unseenId ? CHANGELOG.findIndex((e) => e.id === unseenId) : -1
  const days = [...new Set(CHANGELOG.map((e) => e.date))]
  const entries = CHANGELOG.map((entry, i) => ({ entry, isNew: seenIndex > 0 && i < seenIndex })).filter(
    ({ entry }) => day === null || entry.date === day,
  )

  const chip = (active: boolean) =>
    `h-8 shrink-0 rounded-full px-3 text-sm ring-1 transition-colors ${
      active ? 'bg-orange-500 font-medium text-white ring-orange-500' : 'bg-surface text-stone-700 ring-stone-300 hover:bg-orange-50'
    }`

  return (
    <Modal title={t('มีอะไรใหม่')} onClose={onClose}>
      {days.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label={t('เลือกวันที่')}>
          <button type="button" aria-pressed={day === null} onClick={() => setDay(null)} className={chip(day === null)}>
            {t('ทั้งหมด')}
          </button>
          {days.map((d) => (
            <button key={d} type="button" aria-pressed={day === d} onClick={() => setDay(d)} className={chip(day === d)}>
              {chipFmt.format(toDate(d))}
              <span className={`ml-1 text-xs ${day === d ? 'text-white/80' : 'text-stone-400'}`}>
                {CHANGELOG.filter((e) => e.date === d).length}
              </span>
            </button>
          ))}
        </div>
      )}
      <ol className="flex flex-col gap-5">
        {entries.map(({ entry, isNew }) => (
          <li key={entry.id} className="relative animate-fade-in border-l-2 border-orange-200 pl-4">
            <span className="absolute top-1.5 -left-[7px] size-3 rounded-full bg-orange-500 ring-4 ring-surface" aria-hidden="true" />
            <p className="flex items-center gap-2 text-xs text-stone-500">
              {dateFmt.format(toDate(entry.date))}
              {isNew && (
                <span className="flex items-center gap-0.5 rounded-full bg-orange-100 px-1.5 py-px text-[11px] font-medium text-orange-700">
                  <Sparkles size={11} aria-hidden="true" />
                  {t('ใหม่')}
                </span>
              )}
            </p>
            <h3 className="mt-0.5 font-medium text-stone-900">{entry.title[lang]}</h3>
            <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4 text-sm text-stone-700 marker:text-orange-400">
              {entry.items.map((item) => (
                <li key={item.th}>{item[lang]}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </Modal>
  )
}
