import { Clock, Heart } from 'lucide-react'
import { FUR_COLORS } from '../lib/cat'
import type { FurColor } from '../types'
import { useI18n } from '../hooks/useI18n'

interface Props {
  furColor: FurColor | null
  onFurColorChange: (color: FurColor | null) => void
  seenToday: boolean
  onSeenTodayChange: (value: boolean) => void
  friendlyOnly: boolean
  onFriendlyOnlyChange: (value: boolean) => void
}

const chipBase =
  'flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm shadow-sm ring-1 transition-colors'
const chipOn = 'bg-orange-500 text-white ring-orange-500'
const chipOff = 'bg-surface text-stone-700 ring-stone-200 hover:bg-orange-50'

export function FilterChips({
  furColor,
  onFurColorChange,
  seenToday,
  onSeenTodayChange,
  friendlyOnly,
  onFriendlyOnlyChange,
}: Props) {
  const { t } = useI18n()
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1">
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
      {(Object.keys(FUR_COLORS) as FurColor[]).map((color) => {
        const active = furColor === color
        return (
          <button
            key={color}
            type="button"
            aria-pressed={active}
            onClick={() => onFurColorChange(active ? null : color)}
            className={`${chipBase} ${active ? chipOn : chipOff}`}
          >
            <span
              className="size-3.5 rounded-full ring-1 ring-black/10"
              style={{ background: FUR_COLORS[color].bg }}
              aria-hidden="true"
            />
            {t(FUR_COLORS[color].label)}
          </button>
        )
      })}
    </div>
  )
}
