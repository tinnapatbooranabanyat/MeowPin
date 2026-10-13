import { BookOpenCheck, Camera, EyeOff, HeartPulse, Map as MapIcon, Utensils, type LucideIcon } from 'lucide-react'

/** ตัวกรองบนแผนที่ที่ภารกิจพาไปเปิด (ช่วยให้หาน้องที่ใช่ได้เลย) */
export type MissionFilter = 'stale' | 'fewPhotos' | 'notFed' | 'needsHelp'

// ข้อความไทยเป็น key ของ t() — {n} = เป้าหมาย
export const MISSIONS: Record<string, { label: string; hint: string; icon: LucideIcon; filter: MissionFilter | null }> = {
  new_cats: { label: 'เจอน้องที่ไม่เคยเจอ {n} ตัว', hint: 'ออกไปสำรวจแถวใหม่ๆ', icon: BookOpenCheck, filter: null },
  lost_cat: { label: 'ไปดูน้องที่ไม่มีใครเจอเกิน 14 วัน {n} ตัว', hint: 'ช่วยให้รู้ว่าน้องยังอยู่สบายดี', icon: EyeOff, filter: 'stale' },
  photo_needy: { label: 'ถ่ายรูปน้องที่ยังมีรูปไม่ถึง 2 รูป {n} ตัว', hint: 'ถ่ายตอนอยู่ที่น้อง แล้วกดเพิ่มรูปภาพ', icon: Camera, filter: 'fewPhotos' },
  feed_unfed: { label: 'ให้อาหารน้องที่วันนั้นยังไม่มีใครให้ {n} ตัว', hint: 'ใช้ตัวกรอง "ยังไม่ได้กินวันนี้"', icon: Utensils, filter: 'notFed' },
  confirm_help: { label: 'ยืนยันเรื่องขอความช่วยเหลือ {n} เรื่อง', hint: 'ไปดูน้องที่มีป้ายแดงแล้วกด "ฉันก็เห็น"', icon: HeartPulse, filter: 'needsHelp' },
  two_zones: { label: 'เจอน้องใน {n} โซนต่างกัน', hint: 'ลองเดินข้ามเขตดู', icon: MapIcon, filter: null },
}

export const missionOf = (key: string) => MISSIONS[key] ?? MISSIONS.new_cats
