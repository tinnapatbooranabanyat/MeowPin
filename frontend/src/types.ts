export type FurColor =
  | 'orange'
  | 'orange_white'
  | 'cream'
  | 'white'
  | 'black'
  | 'black_white'
  | 'gray'
  | 'gray_white'
  | 'brown'
  | 'tabby'
  | 'silver_tabby'
  | 'tabby_white'
  | 'calico'
  | 'tortoiseshell'
  | 'pointed'
  /** สีที่ผู้ใช้พิมพ์เอง (ดูที่ Cat.furColorCustom) */
  | 'other'

export type PostKind = 'lost' | 'adoption'

/** ประกาศแมวหาย / หาบ้าน (ตำแหน่งถูกเบลอแล้ว) */
export interface CatPost {
  id: string
  kind: PostKind
  userId: string
  userName: string | null
  title: string
  description: string
  furColor: FurColor
  furColorCustom: string | null
  contact: string
  position: LatLng
  photoUrl: string | undefined
  createdAt: string
}

export interface UserStats {
  pins: number
  reviews: number
  sightings: number
  feedings: number
  photos: number
  helps: number
}

export interface LeaderboardRow {
  userId: string
  name: string
  avatarUrl: string | null
  points: number
}

export type FoodKind = 'dry' | 'wet' | 'treat' | 'other'

export interface FeedingsToday {
  feedings: number
  lastFedAt: string | null
  /** เราบันทึกไปแล้ววันนี้ */
  mine: boolean
}

export type ReviewReportReason = 'spam' | 'inappropriate' | 'harassment' | 'false_info' | 'other'

export interface ReviewReply {
  id: string
  reviewId: string
  userId: string
  body: string
  createdAt: string
  author: { displayName: string; avatarUrl: string | null } | null
}

/** ถูกใจ + ความเห็นของรีวิวหนึ่งอัน */
export interface ReviewSocial {
  likes: number
  liked: boolean
  replies: ReviewReply[]
}

export interface ReviewReport {
  id: string
  reviewId: string
  reason: string
  details: string
  createdAt: string
  reporterName: string | null
  comment: string | null
  paws: number | null
  authorName: string | null
  catId: string | null
  catName: string | null
}

export type NotificationKind = 'new_review' | 'help_request' | 'help_resolved' | 'not_seen' | 'review_reply'

export interface AppNotification {
  id: number
  kind: NotificationKind
  catId: string | null
  data: { cat_name?: string; actor_name?: string; paws?: number; help_kind?: string; days?: number; body?: string }
  createdAt: string
  readAt: string | null
}

/** เรื่องที่แจ้งว่าน้องต้องการความช่วยเหลือ */
export type HelpKind = 'injured' | 'sick' | 'thin' | 'not_neutered' | 'other'

export interface HelpRequest {
  id: string
  kind: HelpKind
  note: string
  createdAt: string
  userId: string
  reporterName: string | null
}

/** ตรวจว่าเป็นแมวด้วยวิธีไหน: โมเดลในเครื่องมั่นใจ / AI (Gemini) ยืนยัน / ผู้ปักหมุดยืนยันเอง (รอ admin ตรวจ) */
export type CatCheck = 'model' | 'ai' | 'user' | 'admin'

// ระดับความน่าเชื่อถือของตำแหน่ง: ถ่ายในแอป+GPS > EXIF ในรูป > ผู้ใช้ลากหมุดเอง
export type Verification = 'camera_gps' | 'exif_gps' | 'manual'

export type Neutered = 'yes' | 'no' | 'unknown'

/** แมวจร / มีเจ้าของ (เบลอตำแหน่ง) / ไม่แน่ใจ */
export type OwnerStatus = 'stray' | 'owned' | 'unknown'

export interface LatLng {
  lat: number
  lng: number
}

export interface CatTraits {
  isFriendly: boolean
  isClingy: boolean
  isPlayful: boolean
  neutered: Neutered
}

export interface Cat extends CatTraits {
  id: string
  name: string
  furColor: FurColor
  /** สีที่พิมพ์เอง เมื่อ furColor = other */
  furColorCustom: string | null
  /** key จาก BREEDS หรือข้อความที่ผู้ใช้พิมพ์เอง (null = ไม่ระบุ) */
  breed: string | null
  ownerStatus: OwnerStatus
  position: LatLng
  placeName: string
  description: string
  photoUrl?: string
  lastSeenAt: string
  sightings: number
  verification: Verification
  /** ความมั่นใจว่าเป็นแมวจริง 0–1 */
  catConfidence: number
  catCheck: CatCheck
  /** เรื่องที่ยังไม่มีใครปิด (ว่าง = ไม่ต้องการความช่วยเหลือ) */
  helpKinds: HelpKind[]
  createdBy: string | null
  createdByName: string | null
  reviewCount: number
  /** ค่าเฉลี่ยอุ้งเท้า 1–5 (null = ยังไม่มีรีวิว) */
  pawAvg: number | null
  recommendCount: number
}

export interface Profile {
  id: string
  displayName: string
  /** รูปที่ใช้แสดงจริง: รูปที่อัปโหลดเอง ถ้าไม่มีใช้รูปจาก Google */
  avatarUrl: string | null
  googleAvatarUrl: string | null
  /** path ใน bucket avatars (null = ใช้รูปจาก Google) */
  avatarPath: string | null
  createdAt: string
  /** ถูกระงับบัญชีเมื่อ (null = ปกติ) */
  bannedAt: string | null
  /** เวอร์ชันข้อกำหนดที่ยอมรับล่าสุด (0 = ยังไม่เคย, null = ยังไม่ได้รัน migration 0007) */
  termsVersion: number | null
}

/** รีวิวในหน้าโปรไฟล์ — แสดงพร้อมแมวที่รีวิว */
export interface UserReview {
  id: string
  paws: number
  recommend: boolean
  comment: string
  createdAt: string
  cat: { id: string; name: string; photoUrl?: string; furColor: FurColor } | null
}

export interface Review {
  id: string
  catId: string
  userId: string
  paws: number
  recommend: boolean
  comment: string
  createdAt: string
  author: { displayName: string; avatarUrl: string | null } | null
}

/** รูปในอัลบั้มของแมว (รูปหลักตอนปักหมุด + รูปที่แนบกับรีวิว) */
export interface CatPhoto {
  id: string
  url: string
  userId: string | null
  uploaderName: string | null
  reviewId: string | null
  createdAt: string
}

/** สรุปแมวด้วย AI จากคำอธิบาย + รีวิว (สร้างที่ backend เก็บไว้ในตาราง cat_summaries) */
export interface CatSummary {
  th: string
  en: string
  /** จำนวนรีวิวตอนสรุป — ไม่ตรงกับตอนนี้แปลว่าล้าสมัย */
  reviewCount: number
  generatedAt: string
}

export type ReportCategory = 'bug' | 'idea' | 'other'

export type CatReportReason = 'not_cat' | 'inappropriate' | 'wrong_location' | 'duplicate' | 'privacy' | 'other'

export interface CatReport {
  id: string
  catId: string
  reason: CatReportReason
  details: string
  status: 'open' | 'resolved'
  createdAt: string
  reporterName: string | null
  cat: { name: string; photoPath: string | null; placeName: string } | null
}

export interface BugReport {
  id: string
  category: ReportCategory
  message: string
  pageUrl: string | null
  userAgent: string | null
  status: 'open' | 'resolved'
  createdAt: string
  reporterName: string | null
}

/** เครื่องที่ล็อกอินบัญชีนี้อยู่ (1 แถว = 1 session ของ Supabase) */
export interface DeviceSession {
  id: string
  userAgent: string | null
  ip: string | null
  createdAt: string
  lastActiveAt: string
  city: string | null
  region: string | null
  country: string | null
  isCurrent: boolean
}

export type ActivityAction =
  | 'sign_in'
  | 'cat_create'
  | 'cat_update'
  | 'cat_delete'
  | 'review_create'
  | 'review_update'
  | 'review_delete'
  | 'photo_add'
  | 'sighting'
  | 'bug_report'
  | 'cat_report'
  | 'help_request'
  | 'help_resolve'
  | 'feeding'
  | 'post_create'
  | 'post_resolve'
  | 'post_delete'
  | 'user_ban'
  | 'user_unban'
  | 'cat_verify'
  | 'review_reply'
  | 'review_report'

export interface ActivityEntry {
  id: number
  action: ActivityAction
  catId: string | null
  createdAt: string
  user: { id: string; name: string; avatarUrl: string | null } | null
  detail: {
    cat_name?: string
    paws?: number
    recommend?: boolean
    by_other?: boolean
    category?: string
    reason?: string
    kind?: string
    food?: string
    post_kind?: string
    target_name?: string
    title?: string
    ip?: string
    user_agent?: string
    city?: string
    region?: string
    country?: string
  }
}
