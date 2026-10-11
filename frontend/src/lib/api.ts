import type {
  BugReport,
  Cat,
  CatPhoto,
  CatReport,
  CatReportReason,
  CatTraits,
  FurColor,
  LatLng,
  Neutered,
  OwnerStatus,
  Profile,
  ReportCategory,
  Review,
  UserReview,
  Verification,
} from '../types'
import { photoUrl, storageUrl, supabase } from './supabase'

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
  breed?: string | null
  owner_status?: OwnerStatus
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
    breed: row.breed ?? null,
    ownerStatus: row.owner_status ?? 'unknown',
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

let lastWake = 0

/**
 * Render แพ็กเกจฟรีพักเครื่องหลังว่าง 15 นาที — ปลุกไว้ก่อนตั้งแต่ผู้ใช้เริ่มปักหมุด
 * กว่าจะถ่ายรูป/กรอกข้อมูลเสร็จ server ก็ตื่นพอดี (ไม่สนผลลัพธ์ ไม่ต้องรอ)
 */
export function wakeBackend(): void {
  if (!API_URL || Date.now() - lastWake < 5 * 60_000) return
  lastWake = Date.now()
  fetch(`${API_URL}/health`).catch(() => {})
}

export interface NewCatInput extends CatTraits {
  photo: File
  name: string
  furColor: FurColor
  breed: string | null
  position: LatLng
  placeName: string
  description: string
  ownerStatus: OwnerStatus
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
  if (input.breed) form.append('breed', input.breed)
  form.append('lat', String(input.position.lat))
  form.append('lng', String(input.position.lng))
  form.append('place_name', input.placeName)
  form.append('description', input.description)
  form.append('owner_status', input.ownerStatus)
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

interface ProfileRow {
  id: string
  display_name: string
  avatar_url: string | null
  avatar_path?: string | null
  created_at: string
}

/** รูปที่อัปโหลดเองมาก่อนรูปจาก Google (avatar_path ยังไม่มีถ้ายังไม่ได้รัน migration 0003) */
function effectiveAvatar(row: { avatar_url: string | null; avatar_path?: string | null }): string | null {
  return storageUrl('avatars', row.avatar_path ?? null) ?? row.avatar_url
}

function rowToProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    avatarUrl: effectiveAvatar(row),
    googleAvatarUrl: row.avatar_url,
    avatarPath: row.avatar_path ?? null,
    createdAt: row.created_at,
  }
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data } = await db().from('profiles').select('*').eq('id', userId).maybeSingle()
  return data ? rowToProfile(data as ProfileRow) : null
}

/** อัปโหลดรูปที่ crop แล้วเป็นรูปโปรไฟล์ — ชื่อไฟล์ใหม่ทุกครั้ง (กัน cache รูปเก่า) แล้วลบไฟล์เดิมทิ้ง */
export async function uploadAvatar(userId: string, image: Blob, previousPath: string | null): Promise<void> {
  const path = `${userId}/${Date.now()}.webp`
  const bucket = db().storage.from('avatars')
  const { error: uploadError } = await bucket.upload(path, image, { contentType: 'image/webp', cacheControl: '31536000' })
  if (uploadError) throw new ApiError('อัปโหลดรูปไม่สำเร็จ ลองใหม่อีกครั้ง', 500)
  const { error } = await db().from('profiles').update({ avatar_path: path }).eq('id', userId)
  if (error) {
    await bucket.remove([path])
    throw new ApiError('อัปโหลดรูปไม่สำเร็จ ลองใหม่อีกครั้ง', 500)
  }
  if (previousPath) await bucket.remove([previousPath])
}

/** กลับไปใช้รูปจาก Google */
export async function removeAvatar(userId: string, currentPath: string): Promise<void> {
  const { error } = await db().from('profiles').update({ avatar_path: null }).eq('id', userId)
  if (error) throw new ApiError('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง', 500)
  await db().storage.from('avatars').remove([currentPath])
}

export async function fetchUserReviews(userId: string): Promise<UserReview[]> {
  const { data, error } = await db()
    .from('reviews')
    .select('id, paws, recommend, comment, created_at, cats(id, name, photo_path, fur_color)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw new ApiError('โหลดรีวิวไม่สำเร็จ', 500)
  type Row = {
    id: string
    paws: number
    recommend: boolean
    comment: string
    created_at: string
    cats: { id: string; name: string; photo_path: string | null; fur_color: FurColor } | null
  }
  return (data as unknown as Row[]).map((r) => ({
    id: r.id,
    paws: r.paws,
    recommend: r.recommend,
    comment: r.comment,
    createdAt: r.created_at,
    cat: r.cats
      ? { id: r.cats.id, name: r.cats.name, photoUrl: photoUrl(r.cats.photo_path), furColor: r.cats.fur_color }
      : null,
  }))
}

export async function fetchUserCats(userId: string): Promise<Cat[]> {
  const { data, error } = await db()
    .from('cats_public')
    .select('*')
    .eq('created_by', userId)
    .order('last_seen_at', { ascending: false })
    .limit(100)
  if (error) throw new ApiError('โหลดข้อมูลแมวไม่สำเร็จ', 500)
  return (data as CatRow[]).map(rowToCat)
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
  profiles: { display_name: string; avatar_url: string | null; avatar_path?: string | null } | null
}

export async function fetchReviews(catId: string): Promise<Review[]> {
  const { data, error } = await db()
    .from('reviews')
    .select('id, cat_id, user_id, paws, recommend, comment, created_at, profiles(*)')
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
    author: r.profiles ? { displayName: r.profiles.display_name, avatarUrl: effectiveAvatar(r.profiles) } : null,
  }))
}

export interface ReviewInput {
  paws: number
  recommend: boolean
  comment: string
}

/** ไม่ใช้ upsert เพราะผู้ใช้ไม่มีสิทธิ์ update คอลัมน์ cat_id — แยก insert / update แทน คืน id ของรีวิว */
export async function saveReview(catId: string, input: ReviewInput, existingId?: string): Promise<string> {
  if (existingId) {
    const { error } = await db().from('reviews').update(input).eq('id', existingId)
    if (error) throw new ApiError('บันทึกรีวิวไม่สำเร็จ ลองใหม่อีกครั้ง', 500)
    return existingId
  }
  const { data, error } = await db().from('reviews').insert({ cat_id: catId, ...input }).select('id').single()
  if (error || !data) {
    if (error?.code === '23505') throw new ApiError('คุณรีวิวน้องตัวนี้ไปแล้ว', 409)
    throw new ApiError('บันทึกรีวิวไม่สำเร็จ ลองใหม่อีกครั้ง', 500)
  }
  return data.id as string
}

// ═══════════════ อัลบั้มรูป ═══════════════

export async function fetchCatPhotos(catId: string): Promise<CatPhoto[]> {
  const { data, error } = await db()
    .from('cat_photos')
    .select('id, photo_path, user_id, review_id, created_at, profiles(display_name)')
    .eq('cat_id', catId)
    .order('created_at', { ascending: false })
    .limit(200)
  // ยังไม่ได้รัน migration 0005 → ถือว่าอัลบั้มว่าง
  if (error) return []
  type Row = {
    id: string
    photo_path: string
    user_id: string | null
    review_id: string | null
    created_at: string
    profiles: { display_name: string } | null
  }
  return (data as unknown as Row[]).map((r) => ({
    id: r.id,
    url: photoUrl(r.photo_path) ?? '',
    userId: r.user_id,
    uploaderName: r.profiles?.display_name ?? null,
    reviewId: r.review_id,
    createdAt: r.created_at,
  }))
}

/** ส่งรูป (บีบอัดแล้ว) เข้าอัลบั้ม — server ตรวจว่าเป็นแมวและลบ EXIF อีกรอบ */
export function uploadCatPhoto(catId: string, photo: File, reviewId?: string): Promise<{ id: string }> {
  const form = new FormData()
  form.append('photo', photo)
  if (reviewId) form.append('review_id', reviewId)
  return callBackend<{ id: string }>('POST', `/cats/${catId}/photos`, form)
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
