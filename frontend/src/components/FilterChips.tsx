import { Check, ChevronDown, Clock, Heart, HeartPulse, Palette, Utensils, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../hooks/useI18n'
import { FUR_COLORS } from '../lib/cat'
import type { FurColor } from '../types'

interface Props {
  /** ว่าง = ทุกสี */
  furColors: FurColor[]
  onFurColorsChange: (colors: FurColor[]) => void
  seenToday: boolean
  onSeenTodayChange: (value: boolean) => void
  friendlyOnly: boolean
  onFriendlyOnlyChange: (value: boolean) => void
  needsHelp: boolean
  onNeedsHelpChange: (value: boolean) => void
  notFedToday: boolean
  onNotFedTodayChange: (value: boolean) => void
}

const chipBase =
  'flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm shadow-sm ring-1 transition active:scale-95'
const chipOn = 'bg-orange-500 text-white ring-orange-500'
const chipOff = 'bg-surface text-stone-700 ring-stone-200 hover:bg-orange-50'

export function FilterChips({
  furColors,
  onFurColorsChange,
  seenToday,
  onSeenTodayChange,
  friendlyOnly,
  onFriendlyOnlyChange,
  needsHelp,
  onNeedsHelpChange,
  notFedToday,
  onNotFedTodayChange,
}: Props) {
  const { t } = useI18n()
  const [palette, setPalette] = useState<{ top: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const hasFur = furColors.length > 0
  const toggleColor = (color: FurColor) =>
    onFurColorsChange(furColors.includes(color) ? furColors.filter((c) => c !== color) : [...furColors, color])

  // แถบชิปเลื่อนแนวนอนได้ (overflow) → วางตารางสีแบบ fixed ไม่งั้นจะโดนตัดขอบ
  const togglePalette = () => {
    if (palette) return setPalette(null)
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    const width = Math.min(320, window.innerWidth - 32)
    setPalette({ top: rect.bottom + 8, left: Math.max(16, Math.min(rect.left, window.innerWidth - width - 16)) })
  }

  useEffect(() => {
    if (!palette) return
    const close = (e: PointerEvent) => {
      const target = e.target as Node
      if (!popoverRef.current?.contains(target) && !buttonRef.current?.contains(target)) setPalette(null)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPalette(null)
    const onResize = () => setPalette(null)
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
    }
  }, [palette])

  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={palette !== null}
        onClick={togglePalette}
        className={`${chipBase} ${hasFur ? chipOn : chipOff}`}
      >
        {hasFur ? (
          // สีที่เลือกซ้อนกันไม่เกิน 3 วง
          <span className="flex -space-x-1.5" aria-hidden="true">
            {furColors.slice(0, 3).map((color) => (
              <span key={color} className="size-3.5 rounded-full ring-1 ring-white/70" style={{ background: FUR_COLORS[color].bg }} />
            ))}
          </span>
        ) : (
          <Palette size={15} aria-hidden="true" />
        )}
        {furColors.length === 1
          ? t(FUR_COLORS[furColors[0]].label)
          : hasFur
            ? t('{n} สี', { n: furColors.length })
            : t('สีขน')}
        {hasFur ? (
          <X
            size={14}
            aria-label={t('ล้างตัวกรองสีขน')}
            onClick={(e) => {
              e.stopPropagation()
              onFurColorsChange([])
              setPalette(null)
            }}
          />
        ) : (
          <ChevronDown size={14} className={`transition-transform ${palette ? 'rotate-180' : ''}`} aria-hidden="true" />
        )}
      </button>
      <button
        type="button"
        aria-pressed={seenToday}
        onClick={() => onSeenTodayChange(!seenToday)}
        className={`${chipBase} ${seenToday ? chipOn : chipOff}`}
      >
        <Clock size={15} aria-hidden="true" />
        {t('เจอใน 24 ชม.')}
      </button>
      <button
        type="button"
        aria-pressed={friendlyOnly}
        onClick={() => onFriendlyOnlyChange(!friendlyOnly)}
        className={`${chipBase} ${friendlyOnly ? chipOn : chipOff}`}
      >
        <Heart size={15} aria-hidden="true" />
        {t('เฟรนด์ลี่')}
      </button>
      <button
        type="button"
        aria-pressed={needsHelp}
        onClick={() => onNeedsHelpChange(!needsHelp)}
        className={`${chipBase} ${needsHelp ? 'bg-red-600 text-white ring-red-600' : 'bg-surface text-red-700 ring-red-200 hover:bg-red-50'}`}
      >
        <HeartPulse size={15} aria-hidden="true" />
        {t('ต้องการความช่วยเหลือ')}
      </button>
      <button
        type="button"
        aria-pressed={notFedToday}
        onClick={() => onNotFedTodayChange(!notFedToday)}
        className={`${chipBase} ${notFedToday ? chipOn : chipOff}`}
        title={t('น้องที่ยังไม่มีใครบันทึกว่าให้อาหารวันนี้ (ไม่รวมน้องมีเจ้าของ)')}
      >
        <Utensils size={15} aria-hidden="true" />
        {t('ยังไม่ได้กินวันนี้')}
      </button>

      {palette && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={t('เลือกสีขน')}
          style={{ top: palette.top, left: palette.left }}
          className="fixed z-40 w-[min(320px,calc(100vw-2rem))] origin-top-left animate-pop-in rounded-2xl bg-surface p-3 shadow-xl ring-1 ring-stone-200"
        >
          <p className="mb-2 px-1 text-xs text-stone-500">{t('เลือกได้หลายสี')}</p>
          <div className="grid grid-cols-3 gap-1.5">
            {(Object.keys(FUR_COLORS) as FurColor[]).map((color) => {
              const active = furColors.includes(color)
              return (
                <button
                  key={color}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleColor(color)}
                  className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-xs transition ${
                    active
                      ? 'bg-orange-100 font-medium text-orange-800 ring-1 ring-orange-300'
                      : 'text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  <span
                    className="relative flex size-8 items-center justify-center rounded-full shadow-inner ring-1 ring-black/10 dark:ring-white/30"
                    style={{ background: FUR_COLORS[color].bg }}
                    aria-hidden="true"
                  >
                    {active && <Check size={16} style={{ color: FUR_COLORS[color].fg }} />}
                  </span>
                  {t(FUR_COLORS[color].label)}
                </button>
              )
            })}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-stone-100 pt-3">
            <button
              type="button"
              disabled={!hasFur}
              onClick={() => onFurColorsChange([])}
              className="rounded-full px-3 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-100 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              {t('ล้าง')}
            </button>
            <button
              type="button"
              onClick={() => setPalette(null)}
              className="rounded-full bg-orange-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-orange-600"
            >
              {t('เสร็จ')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
