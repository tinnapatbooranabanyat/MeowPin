import { getLang, translate, type Lang } from '../i18n'
import type { Cat, CatReportReason, CatTraits, FurColor, Neutered, Verification } from '../types'

export const FUR_COLORS: Record<FurColor, { label: string; bg: string; fg: string }> = {
  orange: { label: 'ส้ม', bg: '#F59E42', fg: '#5C2A06' },
  black: { label: 'ดำ', bg: '#2E2A27', fg: '#F5EFE6' },
  white: { label: 'ขาว', bg: '#F7F2EA', fg: '#7A6F63' },
  calico: {
    label: 'สามสี',
    bg: 'radial-gradient(circle at 22% 28%, #F59E42 0 30%, transparent 31%), radial-gradient(circle at 80% 75%, #2E2A27 0 30%, transparent 31%), #F7F2EA',
    fg: '#5C2A06',
  },
  tabby: { label: 'ลายสลิด', bg: '#A88B6A', fg: '#3B2A18' },
  gray: { label: 'เทา', bg: '#9CA3AF', fg: '#1F2937' },
}

export const VERIFICATION: Record<Verification, { label: string; className: string }> = {
  camera_gps: { label: 'GPS ยืนยันแล้ว', className: 'bg-sky-100 text-sky-800' },
  exif_gps: { label: 'ตำแหน่งจากรูป', className: 'bg-violet-100 text-violet-800' },
  manual: { label: 'ปักหมุดเอง', className: 'bg-stone-200 text-stone-700' },
}

export const TRAITS = [
  { key: 'isFriendly', label: 'เฟรนด์ลี่', hint: 'เข้าหาได้ ไม่หนี' },
  { key: 'isClingy', label: 'ติดคน', hint: 'เดินตาม คลอเคลีย' },
  { key: 'isPlayful', label: 'เล่นด้วยได้', hint: 'ชอบเล่นกับคน' },
] as const satisfies readonly { key: keyof CatTraits; label: string; hint: string }[]

export const NEUTERED: Record<Neutered, { label: string; short: string; className: string }> = {
  yes: { label: 'ทำหมันแล้ว', short: 'ทำหมันแล้ว', className: 'bg-teal-100 text-teal-800' },
  no: { label: 'ยังไม่ทำหมัน', short: 'ยังไม่ทำหมัน', className: 'bg-amber-100 text-amber-800' },
  unknown: { label: 'ไม่แน่ใจ', short: 'ไม่แน่ใจเรื่องทำหมัน', className: 'bg-stone-200 text-stone-700' },
}

export const CAT_REPORT_REASONS: Record<CatReportReason, { label: string; hint: string }> = {
  not_cat: { label: 'ไม่ใช่แมว / ไม่เกี่ยวกับแมว', hint: 'รูปหรือหมุดไม่ได้เกี่ยวกับน้องแมว' },
  inappropriate: { label: 'เนื้อหาไม่เหมาะสม', hint: 'รูป ชื่อ หรือคำอธิบายไม่เหมาะสม' },
  wrong_location: { label: 'ปักผิดตำแหน่ง', hint: 'น้องไม่ได้อยู่ตรงนี้' },
  duplicate: { label: 'ซ้ำกับหมุดอื่น', hint: 'น้องตัวเดียวกันถูกปักไว้แล้ว' },
  privacy: { label: 'ละเมิดความเป็นส่วนตัว', hint: 'เปิดเผยบ้านหรือข้อมูลส่วนตัวของคน' },
  other: { label: 'อื่นๆ', hint: 'เล่ารายละเอียดด้านล่าง' },
}

const formatters: Partial<Record<Lang, Intl.RelativeTimeFormat>> = {}

export function timeAgo(iso: string, lang: Lang = getLang(), now = Date.now()): string {
  const rtf = (formatters[lang] ??= new Intl.RelativeTimeFormat(lang, { numeric: 'auto' }))
  const minutes = Math.round((new Date(iso).getTime() - now) / 60_000)
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour')
  return rtf.format(Math.round(hours / 24), 'day')
}

export function seenWithin(cat: Cat, hours: number, now = Date.now()): boolean {
  return now - new Date(cat.lastSeenAt).getTime() <= hours * 3_600_000
}

export function matchesQuery(cat: Cat, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const fur = FUR_COLORS[cat.furColor].label
  // ค้นได้ทั้งชื่อสีขนภาษาไทยและอังกฤษ
  return [cat.name, cat.placeName, cat.description, fur, translate(fur, undefined, 'en')]
    .some((text) => text.toLowerCase().includes(q))
}

export function directionsUrl(cat: Cat): string {
  const { lat, lng } = cat.position
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`
}
