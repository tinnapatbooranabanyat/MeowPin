import type {
  BugReport,
  Cat,
  CatReport,
  CatReportReason,
  CatTraits,
  FurColor,
  LatLng,
  Neutered,
  Profile,
  ReportCategory,
  Review,
  Verification,
} from '../types'
import { photoUrl, supabase } from './supabase'

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '')

export const isConfigured = supabase !== null && Boolean(API_URL)

export class ApiError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function db() {
  if (!supabase) throw new ApiError('ยังไม่ได้ตั้งค่า Supabase ใน frontend/.env.local', 0)
  return supabase
}

export interface Bounds {
  minLat: number
  minLng: number
  maxLat: number
  maxLng: number
}

// ═══════════════ แมว ═══════════════

interface CatRow {
  id: string
  name: string
  fur_color: FurColor
  lat: number
  lng: number
  place_name: string
  description: string
  photo_path: string | null
  verification: Verification
  cat_confidence: number
  sightings_count: number
  last_seen_at: string
  is_friendly: boolean
  is_clingy: boolean
  is_playful: boolean
  neutered: Neutered
  created_by: string | null
  created_by_name: string | null
  review_count: number
  paw_avg: number | null
  recommend_count: number
}

function rowToCat(row: CatRow): Cat {
  return {
    id: row.id,
    name: row.name,
    furColor: row.fur_color,
    position: { lat: row.lat, lng: row.lng },
    // ค่าว่างให้ UI ใส่ข้อความแทนตามภาษาที่เลือก
    placeName: row.place_name,
    description: row.description,
    photoUrl: photoUrl(row.photo_path),
    lastSeenAt: row.last_seen_at,
    sightings: row.sightings_count,
    verification: row.verification,
    catConfidence: row.cat_confidence,
    // ค่า default กันพังถ้าฐานข้อมูลยังไม่ได้รัน migration 0002
    isFriendly: row.is_friendly ?? false,
    isClingy: row.is_clingy ?? false,
    isPlayful: row.is_playful ?? false,
    neutered: row.neutered ?? 'unknown',
    createdBy: row.created_by ?? null,
    createdByName: row.created_by_name ?? null,
    reviewCount: row.review_count ?? 0,
    pawAvg: row.paw_avg ?? null,
    recommendCount: row.recommend_count ?? 0,
  }
}

export async function fetchCatsInView(bounds: Bounds): Promise<Cat[]> {
  const { data, error } = await db().rpc('cats_in_view', {
    min_lat: bounds.minLat,
    min_lng: bounds.minLng,
    max_lat: bounds.maxLat,
    max_lng: bounds.maxLng,
  })
  if (error) throw new ApiError('โหลดข้อมูลแมวไม่สำเร็จ', 500)
  return (data as CatRow[]).map(rowToCat)
}

export async function fetchCat(id: string): Promise<Cat | null> {
  const { data, error } = await db().from('cats_public').select('*').eq('id', id).maybeSingle()
  // id ผิดรูปแบบ (ไม่ใช่ uuid) ก็ถือว่าไม่พบ
  if (error || !data) return null
  return rowToCat(data as CatRow)
}

// ── เรียก backend (ต้องแนบ token ของคนที่ล็อกอิน) ──

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await db().auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new ApiError('เข้าสู่ระบบก่อนนะ', 401)
  return { Authorization: `Bearer ${token}` }
}

async function readError(res: Response): Promise<ApiError> {
  let message = 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง'
  try {
    const body = await res.json()
    // FastAPI ส่ง detail เป็นข้อความ หรือเป็น list ตอน validation ไม่ผ่าน
    if (typeof body.detail === 'string') message = body.detail
    else if (Array.isArray(body.detail)) message = 'ข้อมูลไม่ครบหรือไม่ถูกต้อง'
  } catch {
    // ไม่ใช่ JSON
  }
  return new ApiError(message, res.status)
}

async function callBackend<T>(method: 'POST' | 'DELETE', path: string, body?: BodyInit): Promise<T> {
  if (!API_URL) throw new ApiError('ยังไม่ได้ตั้งค่า VITE_API_URL', 0)
  const headers = await authHeader()
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, { method, body, headers })
  } catch {
    throw new ApiError('เชื่อมต่อ server ไม่ได้ เช็กอินเทอร์เน็ตแล้วลองใหม่', 0)
  }
  if (!res.ok) throw await readError(res)
  return (res.status === 204 ? undefined : await res.json()) as T
}

export interface NewCatInput extends CatTraits {
  photo: File
  name: string
  furColor: FurColor
  position: LatLng
  placeName: string
  description: string
  hasOwner: boolean
  verification: Verification
  /** ตำแหน่งจาก GPS/EXIF ก่อนผู้ใช้ขยับหมุด — server ใช้ตรวจว่าขยับไกลเกินไหม */
  sourcePosition: LatLng | null
  takenAt: Date | null
}

export function createCat(input: NewCatInput): Promise<Cat> {
  const form = new FormData()
  form.append('photo', input.photo)
  form.append('name', input.name)
  form.append('fur_color', input.furColor)
  form.append('lat', String(input.position.lat))
  form.append('lng', String(input.position.lng))
  form.append('place_name', input.placeName)
  form.append('description', input.description)
  form.append('has_owner', String(input.hasOwner))
  form.append('verification', input.verification)
  form.append('is_friendly', String(input.isFriendly))
  form.append('is_clingy', String(input.isClingy))
  form.append('is_playful', String(input.isPlayful))
  form.append('neutered', input.neutered)
  if (input.sourcePosition) {
    form.append('source_lat', String(input.sourcePosition.lat))
    form.append('source_lng', String(input.sourcePosition.lng))
  }
  if (input.takenAt) form.append('taken_at', input.takenAt.toISOString())
  return callBackend<Cat>('POST', '/cats', form)
}

export function deleteCat(catId: string): Promise<void> {
  return callBackend<void>('DELETE', `/cats/${catId}`)
}

export interface SightingResult {
  sightings: number
  lastSeenAt: string
}

export async function recordSighting(catId: string): Promise<SightingResult> {
  const { data, error } = await db().rpc('record_sighting', { p_cat_id: catId })
  if (error) {
    if (error.message.includes('login_required')) throw new ApiError('เข้าสู่ระบบก่อนนะ', 401)
    if (error.message.includes('too_soon')) throw new ApiError('เพิ่งบันทึกการเจอน้องตัวนี้ไป รอสัก 10 นาทีนะ', 429)
    throw new ApiError('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง', 500)
  }
  const row = (data as { sightings_count: number; last_seen_at: string }[])[0]
  return { sightings: row.sightings_count, lastSeenAt: row.last_seen_at }
}

// ═══════════════ โปรไฟล์ / เจ้าของแพลตฟอร์ม ═══════════════

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data } = await db().from('profiles').select('id, display_name, avatar_url').eq('id', userId).maybeSingle()
  return data ? { id: data.id, displayName: data.display_name, avatarUrl: data.avatar_url } : null
}

export async function updateDisplayName(userId: string, displayName: string): Promise<void> {
  const { error } = await db().from('profiles').update({ display_name: displayName }).eq('id', userId)
  if (error) throw new ApiError('บันทึกชื่อไม่สำเร็จ ลองใหม่อีกครั้ง', 500)
}

export async function checkIsAdmin(): Promise<boolean> {
  const { data, error } = await db().rpc('is_admin')
  return !error && data === true
}

// ═══════════════ รีวิว ═══════════════

interface ReviewRow {
  id: string
  cat_id: string
  user_id: string
  paws: number
  recommend: boolean
  comment: string
  created_at: string
  profiles: { display_name: string; avatar_url: string | null } | null
}

export async function fetchReviews(catId: string): Promise<Review[]> {
  const { data, error } = await db()
    .from('reviews')
    .select('id, cat_id, user_id, paws, recommend, comment, created_at, profiles(display_name, avatar_url)')
    .eq('cat_id', catId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw new ApiError('โหลดรีวิวไม่สำเร็จ', 500)
  return (data as unknown as ReviewRow[]).map((r) => ({
    id: r.id,
    catId: r.cat_id,
    userId: r.user_id,
    paws: r.paws,
    recommend: r.recommend,
    comment: r.comment,
    createdAt: r.created_at,
    author: r.profiles ? { displayName: r.profiles.display_name, avatarUrl: r.profiles.avatar_url } : null,
  }))
}

export interface ReviewInput {
  paws: number
  recommend: boolean
  comment: string
}

/** ไม่ใช้ upsert เพราะผู้ใช้ไม่มีสิทธิ์ update คอลัมน์ cat_id — แยก insert / update แทน */
export async function saveReview(catId: string, input: ReviewInput, existingId?: string): Promise<void> {
  const query = existingId
    ? db().from('reviews').update(input).eq('id', existingId)
    : db().from('reviews').insert({ cat_id: catId, ...input })
  const { error } = await query
  if (error) {
    if (error.code === '23505') throw new ApiError('คุณรีวิวน้องตัวนี้ไปแล้ว', 409)
    throw new ApiError('บันทึกรีวิวไม่สำเร็จ ลองใหม่อีกครั้ง', 500)
  }
}

export async function deleteReview(reviewId: string): Promise<void> {
  const { error } = await db().from('reviews').delete().eq('id', reviewId)
  if (error) throw new ApiError('ลบรีวิวไม่สำเร็จ', 500)
}

// ═══════════════ รายงานปัญหา ═══════════════

export async function sendBugReport(category: ReportCategory, message: string): Promise<void> {
  const { error } = await db()
    .from('bug_reports')
    .insert({
      category,
      message,
      page_url: window.location.href.slice(0, 500),
      user_agent: navigator.userAgent.slice(0, 500),
    })
  if (error) throw new ApiError('ส่งรายงานไม่สำเร็จ ลองใหม่อีกครั้ง', 500)
}

interface BugReportRow {
  id: string
  category: ReportCategory
  message: string
  page_url: string | null
  user_agent: string | null
  status: 'open' | 'resolved'
  created_at: string
  profiles: { display_name: string } | null
}

export async function fetchBugReports(status: 'open' | 'resolved'): Promise<BugReport[]> {
  const { data, error } = await db()
    .from('bug_reports')
    .select('id, category, message, page_url, user_agent, status, created_at, profiles(display_name)')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw new ApiError('โหลดรายงานไม่สำเร็จ', 500)
  return (data as unknown as BugReportRow[]).map((r) => ({
    id: r.id,
    category: r.category,
    message: r.message,
    pageUrl: r.page_url,
    userAgent: r.user_agent,
    status: r.status,
    createdAt: r.created_at,
    reporterName: r.profiles?.display_name ?? null,
  }))
}

export async function setReportStatus(id: string, status: 'open' | 'resolved'): Promise<void> {
  const { error } = await db().from('bug_reports').update({ status }).eq('id', id)
  if (error) throw new ApiError('อัปเดตรายงานไม่สำเร็จ', 500)
}

// ═══════════════ รายงานหมุดแมว ═══════════════

export async function sendCatReport(catId: string, reason: CatReportReason, details: string): Promise<void> {
  const { error } = await db().from('cat_reports').insert({ cat_id: catId, reason, details })
  if (error) {
    if (error.code === '23505') throw new ApiError('คุณรายงานหมุดนี้ไปแล้ว ทีมงานกำลังตรวจสอบ', 409)
    throw new ApiError('ส่งรายงานไม่สำเร็จ ลองใหม่อีกครั้ง', 500)
  }
}

interface CatReportRow {
  id: string
  cat_id: string
  reason: CatReportReason
  details: string
  status: 'open' | 'resolved'
  created_at: string
  profiles: { display_name: string } | null
  cats: { name: string; photo_path: string | null; place_name: string } | null
}

export async function fetchCatReports(status: 'open' | 'resolved'): Promise<CatReport[]> {
  const { data, error } = await db()
    .from('cat_reports')
    .select('id, cat_id, reason, details, status, created_at, profiles(display_name), cats(name, photo_path, place_name)')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw new ApiError('โหลดรายงานไม่สำเร็จ', 500)
  return (data as unknown as CatReportRow[]).map((r) => ({
    id: r.id,
    catId: r.cat_id,
    reason: r.reason,
    details: r.details,
    status: r.status,
    createdAt: r.created_at,
    reporterName: r.profiles?.display_name ?? null,
    cat: r.cats ? { name: r.cats.name, photoPath: r.cats.photo_path, placeName: r.cats.place_name } : null,
  }))
}

/** ปิดรายงานทั้งหมดของหมุดนี้ (เช่นตรวจแล้วไม่มีปัญหา หรือเปิดกลับมาดูใหม่) */
export async function setCatReportsStatus(catId: string, status: 'open' | 'resolved'): Promise<void> {
  const from = status === 'resolved' ? 'open' : 'resolved'
  const { error } = await db().from('cat_reports').update({ status }).eq('cat_id', catId).eq('status', from)
  if (error) throw new ApiError('อัปเดตรายงานไม่สำเร็จ', 500)
}

export interface AdminCounts {
  catReports: number
  bugReports: number
}

export async function fetchAdminCounts(): Promise<AdminCounts> {
  const count = async (table: 'cat_reports' | 'bug_reports') => {
    const { count: n } = await db().from(table).select('id', { count: 'exact', head: true }).eq('status', 'open')
    return n ?? 0
  }
  const [catReports, bugReports] = await Promise.all([count('cat_reports'), count('bug_reports')])
  return { catReports, bugReports }
}
