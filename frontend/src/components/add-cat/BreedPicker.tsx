import { Check, ChevronDown, X } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { useI18n } from '../../hooks/useI18n'
import { BREEDS, breedLabel } from '../../lib/cat'

interface Props {
  /** key จาก BREEDS, ข้อความที่พิมพ์เอง หรือ null = ไม่ระบุ */
  value: string | null
  onChange: (value: string | null) => void
}

const MAX_LENGTH = 40
const QUICK_PICKS = ['unknown', 'domestic'] as const

/** ช่องสายพันธุ์: พิมพ์เพื่อค้นจากรายการ (ไทย/อังกฤษ) หรือพิมพ์ชื่อที่ไม่มีในรายการเองก็ได้ */
export function BreedPicker({ value, onChange }: Props) {
  const { t, lang } = useI18n()
  const listId = useId()
  const [text, setText] = useState(() => breedLabel(value, lang) ?? '')
  const [open, setOpen] = useState(false)

  const options = useMemo(() => {
    const q = text.trim().toLowerCase()
    const all = Object.entries(BREEDS)
    // ยังไม่ได้พิมพ์ หรือข้อความตรงกับตัวที่เลือกอยู่ → แสดงทั้งหมด
    if (!q || q === (breedLabel(value, lang) ?? '').toLowerCase()) return all
    return all.filter(([, b]) => b.label.toLowerCase().includes(q) || b.en.toLowerCase().includes(q))
  }, [text, value, lang])

  const pick = (key: string | null) => {
    onChange(key)
    setText(breedLabel(key, lang) ?? '')
    setOpen(false)
  }

  // ออกจากช่องโดยไม่ได้เลือกจากรายการ → ถ้าพิมพ์ตรงชื่อในรายการให้ใช้ key นั้น ไม่งั้นใช้ข้อความที่พิมพ์
  const commitTyped = () => {
    const typed = text.trim()
    if (!typed) return pick(null)
    const match = Object.entries(BREEDS).find(
      ([, b]) => b.label.toLowerCase() === typed.toLowerCase() || b.en.toLowerCase() === typed.toLowerCase(),
    )
    if (match) return pick(match[0])
    onChange(typed.slice(0, MAX_LENGTH))
    setOpen(false)
  }

  const isCustom = value !== null && !(value in BREEDS)

  return (
    <div className="relative">
      <div className="flex items-center rounded-xl border border-stone-300 bg-surface pr-1.5 focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-200">
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={commitTyped}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (options.length === 1) pick(options[0][0])
              else commitTyped()
            }
            if (e.key === 'Escape') setOpen(false)
          }}
          maxLength={MAX_LENGTH}
          placeholder={t('เลือกหรือพิมพ์สายพันธุ์')}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          className="min-w-0 flex-1 bg-transparent px-3.5 py-2.5 text-[15px] text-stone-800 outline-none placeholder:text-stone-400"
        />
        {text ? (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pick(null)}
            className="rounded-full p-1.5 text-stone-500 hover:bg-stone-100"
            aria-label={t('ล้างสายพันธุ์')}
          >
            <X size={16} />
          </button>
        ) : (
          <ChevronDown size={18} className="mr-1 text-stone-400" aria-hidden="true" />
        )}
      </div>
      {isCustom && !open && <p className="mt-1 text-xs text-stone-500">{t('ใช้ชื่อที่คุณพิมพ์เอง')}</p>}
      {value === null && !open && (
        // ปุ่มลัดสำหรับกรณีที่เจอบ่อยที่สุด (แมวจรส่วนใหญ่ไม่รู้สายพันธุ์)
        <div className="mt-2 flex flex-wrap gap-2">
          {QUICK_PICKS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => pick(key)}
              className="rounded-full px-3 py-1 text-xs text-stone-700 ring-1 ring-stone-300 transition hover:bg-orange-50 active:scale-95"
            >
              {breedLabel(key, lang)}
            </button>
          ))}
        </div>
      )}

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-10 mt-1 max-h-56 origin-top animate-pop-in overflow-y-auto rounded-xl bg-surface py-1 shadow-lg ring-1 ring-stone-200"
        >
          {options.map(([key, b]) => (
            <li key={key}>
              <button
                type="button"
                role="option"
                aria-selected={value === key}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(key)}
                className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-[15px] text-stone-800 hover:bg-orange-50"
              >
                <span className="flex-1">
                  {lang === 'en' ? b.en : b.label}
                  {lang === 'th' && <span className="ml-1.5 text-xs text-stone-500">{b.en}</span>}
                </span>
                {value === key && <Check size={16} className="text-orange-600" aria-hidden="true" />}
              </button>
            </li>
          ))}
          {options.length === 0 && (
            <li className="px-3.5 py-2 text-sm text-stone-500">
              {t('ไม่มีในรายการ — ใช้ “{name}” ได้เลย', { name: text.trim() })}
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
