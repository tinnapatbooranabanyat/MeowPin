import { BookOpenCheck, Camera, HeartHandshake, MapPinPlus, Trophy, Utensils, type LucideIcon } from 'lucide-react'

export type BoardCategory = 'total' | 'collector' | 'explorer' | 'kind' | 'hero' | 'photographer'
export type BoardPeriod = 'week' | 'month' | 'all'

// ข้อความไทยเป็น key ของ t()
export const CATEGORIES: { key: BoardCategory; label: string; unit: string; hint: string; icon: LucideIcon }[] = [
  {
    key: 'total',
    label: 'แต้มรวม',
    unit: 'คะแนน',
    hint: 'ช่วยน้องสำเร็จ 8 · ปักหมุด 5 · รีวิว 3 · รูป 2 · ยืนยันเรื่องขอความช่วยเหลือ 1–2 · เจอน้อง/ให้อาหาร 1 (ตัวเดิมวันละครั้ง)',
    icon: Trophy,
  },
  { key: 'collector', label: 'นักสะสม', unit: 'ตัว', hint: 'น้องที่เจอเป็นครั้งแรกในช่วงนี้ (ทำตอนอยู่ที่น้อง)', icon: BookOpenCheck },
  { key: 'explorer', label: 'นักสำรวจ', unit: 'หมุดใหม่', hint: 'ปักหมุดน้องตัวใหม่', icon: MapPinPlus },
  { key: 'kind', label: 'ใจดี', unit: 'วัน', hint: 'จำนวนวันที่ให้อาหารน้อง นับตัวละวันละครั้ง (ให้เยอะไม่ได้แต้มเพิ่ม)', icon: Utensils },
  { key: 'hero', label: 'ฮีโร่', unit: 'คะแนน', hint: 'ช่วยน้องสำเร็จ 3 · ยืนยันเรื่องขอความช่วยเหลือ 1–2', icon: HeartHandshake },
  { key: 'photographer', label: 'ช่างภาพ', unit: 'หัวใจ', hint: 'หัวใจที่รูปของคุณได้จากคนอื่น', icon: Camera },
]

export const PERIODS: { key: BoardPeriod; label: string }[] = [
  { key: 'week', label: 'สัปดาห์นี้' },
  { key: 'month', label: 'เดือนนี้' },
  { key: 'all', label: 'ตลอดกาล' },
]

export const categoryOf = (key: string) => CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[0]

/** วันจันทร์ 00:00 เวลาไทยของสัปดาห์นี้ (เป็น YYYY-MM-DD) และอีกกี่วันจะเริ่มสัปดาห์ใหม่ */
export function bangkokWeek(now = new Date()) {
  // เวลาไทย = UTC+7 ไม่มีเวลาออมแสง
  const th = new Date(now.getTime() + 7 * 3600_000)
  const day = (th.getUTCDay() + 6) % 7 // จันทร์ = 0
  const monday = new Date(Date.UTC(th.getUTCFullYear(), th.getUTCMonth(), th.getUTCDate() - day))
  const lastMonday = new Date(monday.getTime() - 7 * 86_400_000)
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  return { thisWeek: iso(monday), lastWeek: iso(lastMonday), daysLeft: 7 - day }
}
