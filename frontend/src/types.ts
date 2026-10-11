export type FurColor = 'orange' | 'black' | 'white' | 'calico' | 'tabby' | 'gray'

// ระดับความน่าเชื่อถือของตำแหน่ง: ถ่ายในแอป+GPS > EXIF ในรูป > ผู้ใช้ลากหมุดเอง
export type Verification = 'camera_gps' | 'exif_gps' | 'manual'

export type Neutered = 'yes' | 'no' | 'unknown'

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
  position: LatLng
  placeName: string
  description: string
  photoUrl?: string
  lastSeenAt: string
  sightings: number
  verification: Verification
  /** ความมั่นใจของโมเดลว่าเป็นแมวจริง 0–1 */
  catConfidence: number
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
