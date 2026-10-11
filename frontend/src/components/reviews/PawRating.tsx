import { PawPrint } from 'lucide-react'
import { useI18n } from '../../hooks/useI18n'

const PAWS = [1, 2, 3, 4, 5]

/** แสดงคะแนนเป็นอุ้งเท้า 5 อัน แทนดาว */
export function PawRating({ value, size = 16 }: { value: number; size?: number }) {
  const { t } = useI18n()
  const rounded = Math.round(value)
  return (
    <span className="flex items-center gap-0.5" role="img" aria-label={t('{n} จาก 5 อุ้งเท้า', { n: value })}>
      {PAWS.map((n) => (
        <PawPrint
          key={n}
          size={size}
          aria-hidden="true"
          className={n <= rounded ? 'fill-orange-500 text-orange-500' : 'text-stone-300'}
        />
      ))}
    </span>
  )
}

const LABELS = ['', 'ก็น่ารักนะ', 'น่ารัก', 'น่ารักมาก', 'น่ารักสุดๆ', 'ใจละลาย']

export function PawRatingInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const { t } = useI18n()
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-1" role="radiogroup" aria-label={t('คะแนนอุ้งเท้า')}>
        {PAWS.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={t('{n} อุ้งเท้า', { n })}
            onClick={() => onChange(n)}
            className="rounded-full p-1 transition-transform hover:scale-110 active:scale-95"
          >
            <PawPrint
              // เปลี่ยน key ทุกครั้งที่ให้คะแนน → อุ้งเท้าที่เต็มเด้งเรียงกัน
              key={n <= value ? `on-${value}` : 'off'}
              size={30}
              className={n <= value ? 'animate-paw-pop fill-orange-500 text-orange-500' : 'text-stone-300'}
              style={{ animationDelay: `${(n - 1) * 40}ms` }}
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
      <span className="text-sm text-stone-600">{value > 0 && t(LABELS[value])}</span>
    </div>
  )
}
