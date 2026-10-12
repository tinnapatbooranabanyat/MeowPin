import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useI18n } from '../../hooks/useI18n'
import { addDays, sameDay, startOfDay, type DateRange } from '../../lib/dates'

/** ปุ่มเลือกช่วงวันที่ + ปฏิทินของแอปเอง (กางลงมาใต้ปุ่ม) */
export function DateRangePicker({ value, onChange }: { value: DateRange | null; onChange: (range: DateRange | null) => void }) {
  const { t, lang } = useI18n()
  const [open, setOpen] = useState(false)
  // วันนี้ ณ ตอนเปิดหน้านี้ (ไม่ต้องเปลี่ยนระหว่าง render)
  const [today] = useState(() => startOfDay(new Date()))
  const [month, setMonth] = useState(() => new Date((value?.to ?? today).getFullYear(), (value?.to ?? today).getMonth(), 1))
  // แตะวันแรกแล้ว รอแตะวันสุดท้าย
  const [anchor, setAnchor] = useState<Date | null>(null)

  const locale = lang === 'th' ? 'th-TH' : 'en-GB'
  const dayFmt = useMemo(() => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }), [locale])
  const monthFmt = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }), [locale])
  // หัวคอลัมน์ อา–ส (1 ม.ค. 2023 เป็นวันอาทิตย์)
  const weekdays = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: 'narrow' })
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2023, 0, 1 + i)))
  }, [locale])

  const label = !value
    ? t('ทุกวัน')
    : sameDay(value.from, value.to)
      ? dayFmt.format(value.from)
      : dayFmt.formatRange(value.from, value.to)

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
    return [...Array<null>(first.getDay()).fill(null), ...Array.from({ length: days }, (_, i) => addDays(first, i))]
  }, [month])

  const isCurrentMonth = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth()

  const pick = (day: Date) => {
    if (!anchor) {
      setAnchor(day)
      onChange({ from: day, to: day })
      return
    }
    const [from, to] = anchor <= day ? [anchor, day] : [day, anchor]
    setAnchor(null)
    onChange({ from, to })
    setOpen(false)
  }

  const preset = (days: number | null) => {
    setAnchor(null)
    setOpen(false)
    if (days === null) return onChange(null)
    onChange({ from: addDays(today, -(days - 1)), to: today })
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1))
  }

  return (
    <div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            setOpen((v) => !v)
            setAnchor(null)
          }}
          aria-expanded={open}
          className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-sm ring-1 transition-colors ${
            value ? 'bg-orange-50 font-medium text-orange-800 ring-orange-300' : 'bg-surface text-stone-700 ring-stone-300 hover:bg-stone-50'
          }`}
        >
          <CalendarDays size={15} aria-hidden="true" />
          {label}
          <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        {value && (
          <button
            type="button"
            onClick={() => preset(null)}
            className="rounded-full p-1.5 text-stone-500 hover:bg-stone-100"
            aria-label={t('ล้างวันที่')}
          >
            <X size={15} />
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2 w-full max-w-xs origin-top animate-pop-in rounded-2xl bg-surface p-3 shadow-lg ring-1 ring-stone-200">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {(
              [
                [1, 'วันนี้'],
                [7, '7 วันล่าสุด'],
                [30, '30 วันล่าสุด'],
                [null, 'ทั้งหมด'],
              ] as const
            ).map(([days, text]) => (
              <button
                key={text}
                type="button"
                onClick={() => preset(days)}
                className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-orange-100 hover:text-orange-800"
              >
                {t(text)}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              className="rounded-full p-1.5 text-stone-600 hover:bg-stone-100"
              aria-label={t('เดือนก่อน')}
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-semibold text-stone-900">{monthFmt.format(month)}</span>
            <button
              type="button"
              disabled={isCurrentMonth}
              onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              className="rounded-full p-1.5 text-stone-600 hover:bg-stone-100 disabled:opacity-30 disabled:hover:bg-transparent"
              aria-label={t('เดือนถัดไป')}
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="mt-1 grid grid-cols-7 text-center text-xs text-stone-500" aria-hidden="true">
            {weekdays.map((d, i) => (
              <span key={i} className="py-1">
                {d}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-0.5 text-center text-sm">
            {cells.map((day, i) => {
              if (!day) return <span key={`e${i}`} />
              const future = day > today
              const isEdge = value && (sameDay(day, value.from) || sameDay(day, value.to))
              const inRange = value && day > value.from && day < value.to
              return (
                <button
                  key={day.getTime()}
                  type="button"
                  disabled={future}
                  onClick={() => pick(day)}
                  aria-pressed={Boolean(isEdge || inRange)}
                  aria-label={dayFmt.format(day)}
                  className={`mx-auto flex size-9 items-center justify-center rounded-full transition-colors disabled:text-stone-300 ${
                    isEdge
                      ? 'bg-orange-500 font-semibold text-white'
                      : inRange
                        ? 'bg-orange-100 text-orange-900'
                        : sameDay(day, today)
                          ? 'font-semibold text-orange-700 ring-1 ring-orange-300 hover:bg-orange-50'
                          : 'text-stone-800 hover:bg-stone-100 disabled:hover:bg-transparent'
                  }`}
                >
                  {day.getDate()}
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-center text-xs text-stone-500">
            {t(anchor ? 'แตะวันสุดท้ายของช่วง หรือแตะวันเดิมเพื่อดูวันเดียว' : 'แตะวันที่อยากดู หรือแตะวันแรกแล้ววันสุดท้ายเพื่อเลือกช่วง')}
          </p>
        </div>
      )}
    </div>
  )
}
