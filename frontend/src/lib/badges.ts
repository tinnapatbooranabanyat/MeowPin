import type { UserStats } from '../types'

export type BadgeTier = 'bronze' | 'silver' | 'gold'

interface BadgeDef {
  key: keyof UserStats
  /** ข้อความไทย (key ของ t()) ตามระดับ */
  names: [string, string, string]
  goals: [number, number, number]
  /** หน่วยของตัวเลข เช่น "หมุด" */
  unit: string
}

// เกณฑ์ ทองแดง / เงิน / ทอง
const BADGES: BadgeDef[] = [
  { key: 'pins', names: ['นักสำรวจมือใหม่', 'นักสำรวจตัวยง', 'นักสำรวจระดับตำนาน'], goals: [1, 10, 30], unit: 'หมุด' },
  { key: 'reviews', names: ['นักรีวิวหน้าใหม่', 'นักรีวิวขาประจำ', 'กูรูรีวิวน้องแมว'], goals: [1, 10, 50], unit: 'รีวิว' },
  { key: 'sightings', names: ['ตาไว', 'ตาเหยี่ยว', 'เรดาร์ตามหาแมว'], goals: [5, 30, 100], unit: 'ครั้งที่เจอ' },
  { key: 'feedings', names: ['ใจดีให้อาหาร', 'แม่ครัวประจำซอย', 'โรงอาหารเคลื่อนที่'], goals: [3, 20, 60], unit: 'มื้อ' },
  { key: 'photos', names: ['ช่างภาพมือใหม่', 'ช่างภาพสายแมว', 'ปาปารัสซี่แมว'], goals: [3, 20, 60], unit: 'รูป' },
  { key: 'helps', names: ['ผู้พิทักษ์น้อง', 'ฮีโร่ช่วยน้อง', 'นางฟ้า/เทวดาของแมวจร'], goals: [1, 5, 15], unit: 'ครั้งที่แจ้งช่วย' },
]

const TIERS: BadgeTier[] = ['bronze', 'silver', 'gold']

export interface EarnedBadge {
  key: string
  name: string
  tier: BadgeTier
  count: number
  unit: string
  /** เป้าหมายระดับถัดไป (null = ได้ระดับทองแล้ว) */
  next: number | null
}

export interface NextBadge {
  name: string
  goal: number
  count: number
  unit: string
}

export function computeBadges(stats: UserStats): { earned: EarnedBadge[]; upcoming: NextBadge[] } {
  const earned: EarnedBadge[] = []
  const upcoming: NextBadge[] = []
  for (const badge of BADGES) {
    const count = stats[badge.key]
    let level = -1
    badge.goals.forEach((goal, i) => {
      if (count >= goal) level = i
    })
    if (level >= 0) {
      earned.push({
        key: badge.key,
        name: badge.names[level],
        tier: TIERS[level],
        count,
        unit: badge.unit,
        next: level < 2 ? badge.goals[level + 1] : null,
      })
    } else {
      upcoming.push({ name: badge.names[0], goal: badge.goals[0], count, unit: badge.unit })
    }
  }
  return { earned, upcoming }
}

export const TIER_STYLE: Record<BadgeTier, string> = {
  bronze: 'bg-orange-100 text-orange-900 ring-orange-300',
  silver: 'bg-slate-100 text-slate-800 ring-slate-300',
  gold: 'bg-amber-100 text-amber-900 ring-amber-400',
}
