import { getLang, translate, type Lang } from '../i18n'
import type { Cat, CatReportReason, CatTraits, FurColor, HelpKind, Neutered, OwnerStatus, PhotoReportReason, Verification } from '../types'

// สองสี: ครึ่งบนสีหลัก ครึ่งล่างสีขาว
const half = (top: string, bottom: string) => `linear-gradient(160deg, ${top} 0 52%, ${bottom} 52% 100%)`
const stripes = (base: string, stripe: string) =>
  `repeating-linear-gradient(115deg, ${base} 0 5px, ${stripe} 5px 8px)`

// เรียงตามที่คนไทยเจอบ่อย — ลำดับนี้ใช้ทั้งในตัวกรองและฟอร์ม
export const FUR_COLORS: Record<FurColor, { label: string; bg: string; fg: string }> = {
  orange: { label: 'ส้ม', bg: '#F59E42', fg: '#5C2A06' },
  orange_white: { label: 'ส้มขาว', bg: half('#F59E42', '#F7F2EA'), fg: '#5C2A06' },
  cream: { label: 'ครีม', bg: '#EED9B6', fg: '#6B4F2A' },
  white: { label: 'ขาว', bg: '#F7F2EA', fg: '#7A6F63' },
  black: { label: 'ดำ', bg: '#2E2A27', fg: '#F5EFE6' },
  black_white: { label: 'ขาวดำ', bg: half('#2E2A27', '#F7F2EA'), fg: '#F5EFE6' },
  gray: { label: 'เทา', bg: '#9CA3AF', fg: '#1F2937' },
  gray_white: { label: 'เทาขาว', bg: half('#9CA3AF', '#F7F2EA'), fg: '#1F2937' },
  brown: { label: 'น้ำตาล', bg: '#7B5134', fg: '#F8EBDD' },
  tabby: { label: 'ลายสลิด', bg: stripes('#A88B6A', '#5E4630'), fg: '#FFF7EC' },
  silver_tabby: { label: 'ลายสลิดเทา', bg: stripes('#B9BEC6', '#585E66'), fg: '#111827' },
  // วางสองชั้น: ครึ่งล่างสีขาวทับลายสลิด (ใส่ gradient ซ้อนใน gradient ไม่ได้)
  tabby_white: {
    label: 'ลายสลิดขาว',
    bg: `linear-gradient(160deg, transparent 0 52%, #F7F2EA 52% 100%), ${stripes('#A88B6A', '#5E4630')}`,
    fg: '#FFF7EC',
  },
  calico: {
    label: 'สามสี',
    bg: 'radial-gradient(circle at 22% 28%, #F59E42 0 30%, transparent 31%), radial-gradient(circle at 80% 75%, #2E2A27 0 30%, transparent 31%), #F7F2EA',
    fg: '#5C2A06',
  },
  tortoiseshell: {
    label: 'ลายเปรอะ (กระดองเต่า)',
    bg: 'radial-gradient(circle at 30% 30%, #C9732E 0 22%, transparent 23%), radial-gradient(circle at 70% 65%, #9A5524 0 20%, transparent 21%), #2E2420',
    fg: '#FCE7D2',
  },
  pointed: {
    label: 'แต้มสี',
    bg: 'radial-gradient(circle at 50% 45%, #F3E6D3 0 38%, #6B4A35 75%)',
    fg: '#3B2618',
  },
  other: {
    label: 'สีอื่นๆ (พิมพ์เอง)',
    bg: 'conic-gradient(#F59E42, #EED9B6, #9CA3AF, #2E2A27, #7B5134, #F59E42)',
    fg: '#FFFFFF',
  },
}

/** ชื่อสีขนสำหรับแสดง (ยังไม่แปล) — สีที่พิมพ์เองใช้ข้อความของผู้ใช้ */
export function furLabel(cat: { furColor: FurColor; furColorCustom?: string | null }): string {
  if (cat.furColor === 'other' && cat.furColorCustom) return cat.furColorCustom
  return FUR_COLORS[cat.furColor].label
}

/** สายพันธุ์ที่มีให้เลือก — ผู้ใช้พิมพ์ชื่ออื่นเองได้ (เก็บเป็นข้อความตรงๆ) */
export const BREEDS: Record<string, { label: string; en: string }> = {
  unknown: { label: 'ไม่ทราบสายพันธุ์', en: 'Unknown breed' },
  domestic: { label: 'แมวบ้าน / พันทาง', en: 'Domestic / mixed' },
  siamese: { label: 'วิเชียรมาศ', en: 'Siamese' },
  khao_manee: { label: 'ขาวมณี', en: 'Khao Manee' },
  korat: { label: 'โคราช / สีสวาด', en: 'Korat' },
  suphalak: { label: 'ศุภลักษณ์', en: 'Suphalak' },
  konja: { label: 'โกนจา', en: 'Konja' },
  persian: { label: 'เปอร์เซีย', en: 'Persian' },
  exotic_shorthair: { label: 'เอ็กโซติก ช็อตแฮร์', en: 'Exotic Shorthair' },
  scottish_fold: { label: 'สก็อตติช โฟลด์', en: 'Scottish Fold' },
  british_shorthair: { label: 'บริติช ช็อตแฮร์', en: 'British Shorthair' },
  american_shorthair: { label: 'อเมริกัน ช็อตแฮร์', en: 'American Shorthair' },
  maine_coon: { label: 'เมนคูน', en: 'Maine Coon' },
  ragdoll: { label: 'แร็กดอลล์', en: 'Ragdoll' },
  bengal: { label: 'เบงกอล', en: 'Bengal' },
  munchkin: { label: 'มันช์กิ้น', en: 'Munchkin' },
  sphynx: { label: 'สฟิงซ์', en: 'Sphynx' },
  russian_blue: { label: 'รัสเซียน บลู', en: 'Russian Blue' },
  norwegian_forest: { label: 'นอร์วีเจียน ฟอเรสต์', en: 'Norwegian Forest Cat' },
  siberian: { label: 'ไซบีเรียน', en: 'Siberian' },
  abyssinian: { label: 'อะบิสซิเนียน', en: 'Abyssinian' },
  turkish_angora: { label: 'เทอร์กิช แองโกรา', en: 'Turkish Angora' },
}

/** ชื่อสายพันธุ์ตามภาษา — ถ้าเป็นชื่อที่ผู้ใช้พิมพ์เองก็แสดงตามนั้น */
export function breedLabel(breed: string | null, lang: Lang = getLang()): string | null {
  if (!breed) return null
  const known = BREEDS[breed]
  if (!known) return breed
  return lang === 'en' ? known.en : known.label
}

export const VERIFICATION: Record<Verification, { label: string; className: string }> = {
  camera_gps: { label: 'GPS ยืนยันแล้ว', className: 'bg-sky-100 text-sky-800' },
  exif_gps: { label: 'ตำแหน่งจากรูป', className: 'bg-violet-100 text-violet-800' },
  manual: { label: 'ปักหมุดเอง', className: 'bg-stone-200 text-stone-700' },
}

export const HELP_KINDS: Record<HelpKind, { label: string; hint: string }> = {
  injured: { label: 'บาดเจ็บ', hint: 'มีแผล เดินกะเผลก หรือโดนรถชน' },
  sick: { label: 'ป่วย', hint: 'ซึม ไม่กินอาหาร น้ำมูก ตาแฉะ หรือมีอาการผิดปกติ' },
  thin: { label: 'ผอมมาก', hint: 'ผอมจนเห็นกระดูก อาจไม่มีใครให้อาหาร' },
  not_neutered: { label: 'ยังไม่ทำหมัน', hint: 'ไม่มีรอยตัดปลายหู หรือเพิ่งคลอดลูก — ควรพาไปทำหมันกับโครงการ TNR' },
  other: { label: 'อื่นๆ', hint: 'เล่ารายละเอียดด้านล่าง' },
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

export const PHOTO_REPORT_REASONS: Record<PhotoReportReason, string> = {
  not_this_cat: 'ไม่ใช่น้องตัวนี้',
  not_cat: 'ไม่ใช่รูปแมว',
  inappropriate: 'รูปไม่เหมาะสม',
  privacy: 'ละเมิดความเป็นส่วนตัว (เห็นหน้าคน บ้านเลขที่ ทะเบียนรถ)',
  other: 'อื่นๆ',
}

export const CAT_REPORT_REASONS: Record<CatReportReason, { label: string; hint: string }> = {
  not_cat: { label: 'ไม่ใช่แมว / ไม่เกี่ยวกับแมว', hint: 'รูปหรือหมุดไม่ได้เกี่ยวกับน้องแมว' },
  inappropriate: { label: 'เนื้อหาไม่เหมาะสม', hint: 'รูป ชื่อ หรือคำอธิบายไม่เหมาะสม' },
  wrong_location: { label: 'ปักผิดตำแหน่ง', hint: 'น้องไม่ได้อยู่ตรงนี้' },
  duplicate: { label: 'ซ้ำกับหมุดอื่น', hint: 'น้องตัวเดียวกันถูกปักไว้แล้ว' },
  privacy: { label: 'ละเมิดความเป็นส่วนตัว', hint: 'เปิดเผยบ้านหรือข้อมูลส่วนตัวของคน' },
  other: { label: 'อื่นๆ', hint: 'เล่ารายละเอียดด้านล่าง' },
}

export const OWNER_STATUS: Record<OwnerStatus, { label: string; hint: string; className: string }> = {
  stray: { label: 'แมวจร', hint: 'ไม่มีเจ้าของ อยู่ตามที่สาธารณะ', className: 'bg-amber-100 text-amber-800' },
  owned: { label: 'มีเจ้าของ', hint: 'มีคนเลี้ยงดู อาจมีบ้านอยู่แถวนั้น', className: 'bg-sky-100 text-sky-800' },
  unknown: { label: 'ไม่แน่ใจ', hint: '', className: '' },
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
  const fur = furLabel(cat)
  // ค้นได้ทั้งชื่อสีขนและสายพันธุ์ ภาษาไทยและอังกฤษ
  return [
    cat.name,
    cat.placeName,
    cat.description,
    fur,
    translate(fur, undefined, 'en'),
    breedLabel(cat.breed, 'th') ?? '',
    breedLabel(cat.breed, 'en') ?? '',
  ]
    .some((text) => text.toLowerCase().includes(q))
}

export function directionsUrl(cat: Cat): string {
  const { lat, lng } = cat.position
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`
}
