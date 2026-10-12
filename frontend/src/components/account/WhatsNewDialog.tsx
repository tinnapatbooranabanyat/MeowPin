import { Sparkles } from 'lucide-react'
import { useI18n } from '../../hooks/useI18n'
import { CHANGELOG } from '../../lib/changelog'
import { Modal } from '../ui/Modal'

/** บันทึกการอัปเดต — มีอะไรใหม่ในแต่ละครั้ง */
export function WhatsNewDialog({ onClose, unseenId }: { onClose: () => void; unseenId: string | null }) {
  const { t, lang } = useI18n()
  const dateFmt = new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  // รายการที่ใหม่กว่าตัวที่เคยเห็น ติดป้าย "ใหม่"
  const seenIndex = unseenId ? CHANGELOG.findIndex((e) => e.id === unseenId) : -1

  return (
    <Modal title={t('มีอะไรใหม่')} onClose={onClose}>
      <ol className="flex flex-col gap-5">
        {CHANGELOG.map((entry, i) => (
          <li key={entry.id} className="relative border-l-2 border-orange-200 pl-4">
            <span className="absolute top-1.5 -left-[7px] size-3 rounded-full bg-orange-500 ring-4 ring-surface" aria-hidden="true" />
            <p className="flex items-center gap-2 text-xs text-stone-500">
              {dateFmt.format(new Date(`${entry.date}T12:00:00`))}
              {seenIndex > 0 && i < seenIndex && (
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
