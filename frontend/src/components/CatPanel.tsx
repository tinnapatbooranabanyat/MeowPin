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
      className="absolute top-20 left-4 z-20 max-h-[calc(100%-6rem)] w-[400px] animate-slide-in-left overflow-x-hidden overflow-y-auto rounded-3xl bg-surface shadow-xl ring-1 ring-stone-200"
    >
      <CatDetails
        variant="panel"
        cat={cat}
        onClose={onClose}
        onSighting={onSighting}
        onShare={onShare}
        onDelete={onDelete}
        onReport={onReport}
      />
    </aside>
  )
}
