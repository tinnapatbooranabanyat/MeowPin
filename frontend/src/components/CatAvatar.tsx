import { Cat as CatIcon } from 'lucide-react'
import { FUR_COLORS } from '../lib/cat'
import type { Cat } from '../types'

interface Props {
  cat: Cat
  className?: string
  iconSize?: number
}

// ใช้รูปจริงถ้ามี ไม่งั้นแสดงไอคอนแมวตามสีขน
export function CatAvatar({ cat, className = '', iconSize = 20 }: Props) {
  if (cat.photoUrl) {
    return <img src={cat.photoUrl} alt={cat.name} className={`object-cover ${className}`} />
  }
  const fur = FUR_COLORS[cat.furColor]
  return (
    <div
      className={`flex items-center justify-center ${className}`}
      style={{ background: fur.bg, color: fur.fg }}
      aria-hidden="true"
    >
      <CatIcon size={iconSize} strokeWidth={2.2} />
    </div>
  )
}
