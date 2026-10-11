import { X } from 'lucide-react'
import type { Cat } from '../types'
import { CatDetails } from './CatDetails'
import { useI18n } from '../hooks/useI18n'

interface Props {
  cat: Cat
  onClose: () => void
  onSighting: (cat: Cat) => Promise<boolean>
  onShare: (cat: Cat) => void
  onDelete: (cat: Cat) => void
  onReport: (cat: Cat) => void
}

// แผงด้านซ้ายบนจอใหญ่ แบบ Google Maps เวอร์ชันเดสก์ท็อป
export function CatPanel({ cat, onClose, onSighting, onShare, onDelete, onReport }: Props) {
  const { t } = useI18n()
  return (
    <aside
      aria-label={t('ข้อมูลของ {name}', { name: cat.name })}
      className="absolute top-20 left-4 z-20 animate-slide-in-left max-h-[calc(100%-6rem)] w-[380px] overflow-y-auto rounded-3xl bg-surface p-5 shadow-xl ring-1 ring-stone-200"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 rounded-full p-1.5 text-stone-500 hover:bg-stone-100"
        aria-label={t('ปิด')}
      >
        <X size={20} />
      </button>
      <CatDetails cat={cat} onSighting={onSighting} onShare={onShare} onDelete={onDelete} onReport={onReport} />
    </aside>
  )
}
