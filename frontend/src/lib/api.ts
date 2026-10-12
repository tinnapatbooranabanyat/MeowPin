import type {
  ActivityAction,
  ActivityEntry,
  AppNotification,
  BugReport,
  Cat,
  CatPhoto,
  CatPost,
  CatReport,
  CatReportReason,
  CatCheck,
  CatSummary,
  CatTraits,
  DeviceSession,
  FeedingsToday,
  FoodKind,
  HelpKind,
  HelpRequest,
  LeaderboardRow,
  MoveRequest,
  FurColor,
  LatLng,
  Neutered,
  OwnerStatus,
  PostKind,
  Profile,
  ReportCategory,
  Review,
  ReviewReply,
  ReviewReport,
  ReviewReportReason,
  ReviewSocial,
  UserReview,
  UserStats,
  Verification,
} from '../types'
import type { CatFormValues } from '../components/add-cat/CatForm'
import type { GpsFix } from './geo'
import { photoUrl, storageUrl, supabase } from './supabase'

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '')

export const isConfigured = supabase !== null && Boolean(API_URL)

export class ApiError extends Error {
  readonly status: number
  /** เช่น not_cat = ตรวจแล้วไม่เจอแมว (ผู้ใช้ยืนยันเองแล้วส่งใหม่ได้) */
  readonly code: string | null
  /** ข้อความภาษาอังกฤษจาก AI (ถ้ามี) */
  readonly messageEn: string | null
  constructor(message: string, status: number, code: string | null = null, messageEn: string | null = null) {
    super(message)
    this.status = status
    this.code = code
    this.messageEn = messageEn
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
  fur_color_custom?: string | null
  cat_check?: CatCheck
  help_kinds?: HelpKind[]
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
    furColorCustom: row.fur_color_custom ?? null,
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
    // ก่อนรัน migration 0009 ยังไม่มีคอลัมน์นี้ — หมุดเดิมผ่านโมเดลทั้งหมด
    catCheck: row.cat_check ?? 'model',
    // ก่อนรัน migration 0011 ยังไม่มีคอลัมน์นี้
    helpKinds: row.help_kinds ?? [],
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
  let code: string | null = null
  let messageEn: string | null = null
  try {
    const body = await res.json()
    // FastAPI ส่ง detail เป็นข้อความ หรือเป็น list ตอน validation ไม่ผ่าน
    if (typeof body.detail === 'string') message = body.detail
    else if (Array.isArray(body.detail)) message = 'ข้อมูลไม่ครบหรือไม่ถูกต้อง'
    if (typeof body.code === 'string') code = body.code
    if (typeof body.detailEn === 'string') messageEn = body.detailEn
  } catch {
    // ไม่ใช่ JSON
  }
  return new ApiError(message, res.status, code, messageEn)
}

// Render แบบฟรีปิดเครื่องเมื่อไม่มีคนใช้ 15 นาที — request แรกต้องรอเครื่องเปิดเกือบนาที
// ระหว่างนั้นเชื่อมต่อไม่ได้ หรือได้หน้า error ของ Render (ไม่ใช่ JSON ของเรา) → รอแล้วลองใหม่เอง
const WAKE_RETRY_DELAYS_MS = [2000, 4000, 6000, 8000, 10_000, 10_000, 10_000, 10_000, 10_000, 10_000]
const wakingListeners = new Set<(waking: boolean) => void>()

/** ฟังว่ากำลังรอ server ตื่นอยู่ไหม (เอาไปโชว์ข้อความให้ผู้ใช้รู้ว่าไม่ได้ค้าง) */
export function onBackendWaking(listener: (waking: boolean) => void): () => void {
  wakingListeners.add(listener)
  return () => wakingListeners.delete(listener)
}

/** server ตอบ /health เร็วไหม — ตื่นอยู่แล้วแต่ request ล้ม = ปัญหาอื่น ไม่ต้องรอ */
async function backendAwake(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(6000) })
    return res.ok
  } catch {
    return false
  }
}

const isServerWaking = (res: Response) =>
  [502, 503, 504].includes(res.status) && !res.headers.get('content-type')?.includes('application/json')

async function callBackend<T>(method: 'POST' | 'PATCH' | 'DELETE', path: string, body?: BodyInit): Promise<T> {
  if (!API_URL) throw new ApiError('ยังไม่ได้ตั้งค่า VITE_API_URL', 0)
  let res: Response | null = null
  try {
    for (let attempt = 0; ; attempt++) {
      // ขอ token ใหม่ทุกรอบ เผื่อรอนานจน token เดิมหมดอายุ
      const headers: Record<string, string> = { ...(await authHeader()) }
      // body เป็นข้อความ = JSON (FormData ให้เบราว์เซอร์ใส่ content-type เอง)
      if (typeof body === 'string') headers['Content-Type'] = 'application/json'
      try {
        res = await fetch(`${API_URL}${path}`, { method, body, headers })
        if (!isServerWaking(res)) break
      } catch {
        res = null
      }
      if (attempt >= WAKE_RETRY_DELAYS_MS.length) break
      if (attempt === 0) {
        if (await backendAwake()) break
        wakingListeners.forEach((l) => l(true))
      }
      await new Promise((resolve) => setTimeout(resolve, WAKE_RETRY_DELAYS_MS[attempt]))
    }
  } finally {
    wakingListeners.forEach((l) => l(false))
  }
  if (!res) throw new ApiError('เชื่อมต่อ server ไม่ได้ เช็กอินเทอร์เน็ตแล้วลองใหม่', 0)
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
  furColorCustom: string
  /** ผลตรวจรูปจาก checkCatPhoto (ไม่ต้องตรวจซ้ำ) */
  checkToken: string | null
  /** ผู้ใช้ยืนยันเองว่าเป็นแมว ตอนระบบไม่แน่ใจ */
  confirmCat: boolean
}

export interface PhotoCheck {
  isCat: boolean
  score: number
  method: CatCheck | null
  message: string | null
  messageEn: string | null
  token: string
}

/** ตรวจรูปตอนเลือกรูป: โมเดลใน server ก่อน ไม่มั่นใจค่อยถาม AI */
export function checkCatPhoto(photo: Blob): Promise<PhotoCheck> {
  const form = new FormData()
  form.append('photo', photo, 'photo.jpg')
  return callBackend<PhotoCheck>('POST', '/cats/check-photo', form)
}

export function createCat(input: NewCatInput): Promise<Cat> {
  const form = new FormData()
  form.append('photo', input.photo)
  form.append('name', input.name)
  form.append('fur_color', input.furColor)
  if (input.furColor === 'other') form.append('fur_color_custom', input.furColorCustom)
  if (input.checkToken) form.append('check_token', input.checkToken)
  if (input.confirmCat) form.append('confirm_cat', 'true')
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

/** เรียก backend แบบส่ง JSON (ต้องล็อกอิน) */
export function callBackendJson<T = void>(method: 'POST' | 'PATCH', path: string, body: unknown): Promise<T> {
  return callBackend<T>(method, path, JSON.stringify(body))
}

/** แก้รายละเอียดหมุด (คนปักหมุดหรือเจ้าของแพลตฟอร์ม) */
export function updateCat(catId: string, values: CatFormValues): Promise<void> {
  return callBackend<void>(
    'PATCH',
    `/cats/${catId}`,
    JSON.stringify({
      name: values.name,
      fur_color: values.furColor,
      fur_color_custom: values.furColor === 'other' ? values.furColorCustom : '',
      breed: values.breed ?? '',
      place_name: values.placeName,
      description: values.description,
      owner_status: values.ownerStatus,
      is_friendly: values.isFriendly,
      is_clingy: values.isClingy,
      is_playful: values.isPlayful,
      neutered: values.neutered,
    }),
  )
}

/** ย้ายหมุด — คืนตำแหน่งที่บันทึกและป้ายยืนยันตำแหน่งที่เหลือ */
export async function moveCat(
  catId: string,
  position: LatLng,
  requestId?: string,
): Promise<{ position: LatLng; verification: Verification }> {
  const res = await callBackendJson<{ lat: number; lng: number; verification: Verification }>(
    'PATCH',
    `/cats/${catId}/location`,
    { ...position, request_id: requestId ?? null },
  )
  return { position: { lat: res.lat, lng: res.lng }, verification: res.verification }
}

interface MoveRequestRow {
  id: string
  user_id: string
  lat: number
  lng: number
  note: string
  created_at: string
  profiles: { display_name: string } | null
}

/** ตำแหน่งที่คนอื่นเสนอ (เห็นเฉพาะคนปักหมุด ผู้ดูแล และคนเสนอเอง) */
export async function fetchMoveRequests(catId: string): Promise<MoveRequest[]> {
  const { data, error } = await db()
    .from('cat_move_requests')
    .select('id, user_id, lat, lng, note, created_at, profiles!cat_move_requests_user_id_fkey(display_name)')
    .eq('cat_id', catId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error) return []
  return (data as unknown as MoveRequestRow[]).map((r) => ({
    id: r.id,
    userId: r.user_id,
    position: { lat: r.lat, lng: r.lng },
    note: r.note,
    createdAt: r.created_at,
    requesterName: r.profiles?.display_name ?? null,
  }))
}

export async function requestMove(catId: string, position: LatLng, note: string): Promise<void> {
  const { error } = await db().rpc('request_cat_move', { p_cat_id: catId, p_lat: position.lat, p_lng: position.lng, p_note: note })
  if (error) {
    if (error.message.includes('own_cat')) throw new ApiError('หมุดของคุณเอง ย้ายได้เลยที่ปุ่มแก้ไข', 400)
    throw new ApiError('ส่งไม่สำเร็จ ลองใหม่อีกครั้ง', 500)
  }
}

export async function rejectMove(requestId: string): Promise<void> {
  const { error } = await db().rpc('reject_cat_move', { p_request_id: requestId })
  if (error) throw new ApiError('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง', 500)
}

/** admin: ตรวจแล้วว่าเป็นแมวจริง */
export function verifyCat(catId: string): Promise<void> {
  return callBackend<void>('POST', `/cats/${catId}/verify`)
}

/** หมุดที่ผู้ใช้ยืนยันเองว่าเป็นแมว (รอ admin ตรวจ) */
export async function fetchUnverifiedCats(): Promise<Cat[]> {
  const { data, error } = await db()
    .from('cats_public')
    .select('*')
    .eq('cat_check', 'user')
    .order('last_seen_at', { ascending: false })
    .limit(100)
  if (error || !data) return []
  return (data as CatRow[]).map(rowToCat)
}

/** admin: ระงับ/ยกเลิกการระงับบัญชี */
export async function setUserBan(userId: string, banned: boolean, reason = ''): Promise<void> {
  const { error } = await db().rpc('set_user_ban', { p_user_id: userId, p_banned: banned, p_reason: reason })
  if (error) {
    if (error.message.includes('cannot_ban_admin')) throw new ApiError('ระงับบัญชีเจ้าของแพลตฟอร์มไม่ได้', 403)
    throw new ApiError('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง', 500)
  }
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
  terms_version?: number
  banned_at?: string | null
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
    termsVersion: row.terms_version ?? null,
    bannedAt: row.banned_at ?? null,
  }
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data } = await db().from('profiles').select('*').eq('id', userId).maybeSingle()
  return data ? rowToProfile(data as ProfileRow) : null
}

export async function acceptTerms(version: number): Promise<void> {
  const { error } = await db().rpc('accept_terms', { version })
  if (error) throw new ApiError('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง', 500)
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

// ตารางที่เชื่อมทั้งรีวิวและผู้ใช้ (เช่น review_likes) ทำให้ "profiles" มีได้หลายทาง — ต้องระบุ FK ให้ชัด
// ไม่งั้น Supabase ตอบ error PGRST201 แล้วรีวิวโหลดไม่ขึ้นทั้งหน้า
export async function fetchReviews(catId: string): Promise<Review[]> {
  const { data, error } = await db()
    .from('reviews')
    .select('id, cat_id, user_id, paws, recommend, comment, created_at, profiles!reviews_user_id_fkey(*)')
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

// ═══════════════ ค้นหาด้วยรูป ═══════════════
export interface PhotoSearchResult {
  furColor: FurColor
  /** จำนวนหมุดที่ให้ AI เทียบ */
  checked: number
  matches: { catId: string; score: number; reason: string; reasonEn: string; distance: number }[]
}

export function searchByPhoto(photo: File, position: LatLng): Promise<PhotoSearchResult> {
  const form = new FormData()
  form.append('photo', photo)
  form.append('lat', String(position.lat))
  form.append('lng', String(position.lng))
  return callBackend<PhotoSearchResult>('POST', '/cats/search-by-photo', form)
}

// ═══════════════ ถูกใจ / ตอบกลับ / รายงานรีวิว ═══════════════
interface ReplyRow {
  id: string
  review_id: string
  user_id: string
  body: string
  created_at: string
  profiles: ProfileRow | null
}

/** ถูกใจ + ความเห็นของรีวิวทั้งหมดในหน้า (ยังไม่ได้รัน migration 0019 ก็ได้ค่าว่าง) */
export async function fetchReviewSocial(reviewIds: string[], userId: string | null): Promise<Record<string, ReviewSocial>> {
  const out: Record<string, ReviewSocial> = {}
  if (!reviewIds.length) return out
  for (const id of reviewIds) out[id] = { likes: 0, liked: false, replies: [] }
  const [likes, replies] = await Promise.all([
    db().from('review_likes').select('review_id, user_id').in('review_id', reviewIds),
    db()
      .from('review_replies')
      .select('id, review_id, user_id, body, created_at, profiles(*)')
      .in('review_id', reviewIds)
      .order('created_at', { ascending: true }),
  ])
  for (const like of (likes.data ?? []) as { review_id: string; user_id: string }[]) {
    out[like.review_id].likes += 1
    if (like.user_id === userId) out[like.review_id].liked = true
  }
  for (const r of (replies.data ?? []) as unknown as ReplyRow[]) {
    const reply: ReviewReply = {
      id: r.id,
      reviewId: r.review_id,
      userId: r.user_id,
      body: r.body,
      createdAt: r.created_at,
      author: r.profiles ? { displayName: r.profiles.display_name, avatarUrl: effectiveAvatar(r.profiles) } : null,
    }
    out[r.review_id].replies.push(reply)
  }
  return out
}

export async function setReviewLike(reviewId: string, like: boolean): Promise<void> {
  const { error } = like
    ? await db().from('review_likes').insert({ review_id: reviewId })
    : await db().from('review_likes').delete().eq('review_id', reviewId)
  if (error && error.code !== '23505') throw new ApiError('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง', 500)
}

export async function addReviewReply(reviewId: string, body: string): Promise<void> {
  const { error } = await db().from('review_replies').insert({ review_id: reviewId, body })
  if (error) throw new ApiError('ส่งความเห็นไม่สำเร็จ ลองใหม่อีกครั้ง', 500)
}

export async function deleteReviewReply(replyId: string): Promise<void> {
  const { error } = await db().from('review_replies').delete().eq('id', replyId)
  if (error) throw new ApiError('ลบไม่สำเร็จ', 500)
}

export async function reportReview(reviewId: string, reason: ReviewReportReason, details: string): Promise<void> {
  const { error } = await db().from('review_reports').insert({ review_id: reviewId, reason, details })
  if (error) {
    if (error.code === '23505') throw new ApiError('คุณรายงานรีวิวนี้ไปแล้ว', 409)
    throw new ApiError('ส่งรายงานไม่สำเร็จ ลองใหม่อีกครั้ง', 500)
  }
}

interface ReviewReportRow {
  id: string
  review_id: string
  reason: string
  details: string
  created_at: string
  profiles: { display_name: string } | null
  reviews: { comment: string; paws: number; cat_id: string; profiles: { display_name: string } | null; cats: { name: string } | null } | null
}

export async function fetchReviewReports(status: 'open' | 'resolved'): Promise<ReviewReport[]> {
  const { data, error } = await db()
    .from('review_reports')
    .select('id, review_id, reason, details, created_at, profiles!review_reports_user_id_fkey(display_name), reviews(comment, paws, cat_id, profiles!reviews_user_id_fkey(display_name), cats(name))')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error || !data) return []
  return (data as unknown as ReviewReportRow[]).map((r) => ({
    id: r.id,
    reviewId: r.review_id,
    reason: r.reason,
    details: r.details,
    createdAt: r.created_at,
    reporterName: r.profiles?.display_name ?? null,
    comment: r.reviews?.comment ?? null,
    paws: r.reviews?.paws ?? null,
    authorName: r.reviews?.profiles?.display_name ?? null,
    catId: r.reviews?.cat_id ?? null,
    catName: r.reviews?.cats?.name ?? null,
  }))
}

export async function setReviewReportStatus(ids: string[], status: 'open' | 'resolved'): Promise<void> {
  const { error } = await db().from('review_reports').update({ status }).in('id', ids)
  if (error) throw new ApiError('อัปเดตรายงานไม่สำเร็จ', 500)
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
export function uploadCatPhoto(
  catId: string,
  photo: File,
  reviewId?: string,
  confirmCat = false,
): Promise<{ id: string }> {
  const form = new FormData()
  form.append('photo', photo)
  if (reviewId) form.append('review_id', reviewId)
  if (confirmCat) form.append('confirm_cat', 'true')
  return callBackend<{ id: string }>('POST', `/cats/${catId}/photos`, form)
}

export async function deleteReview(reviewId: string): Promise<void> {
  const { error } = await db().from('reviews').delete().eq('id', reviewId)
  if (error) throw new ApiError('ลบรีวิวไม่สำเร็จ', 500)
}

// ═══════════════ สรุปด้วย AI ═══════════════

/** สรุปที่เก็บไว้แล้ว (null = ยังไม่มี หรือยังไม่ได้รัน migration 0006) */
export async function fetchCatSummary(catId: string): Promise<CatSummary | null> {
  const { data, error } = await db()
    .from('cat_summaries')
    .select('summary_th, summary_en, review_count, generated_at')
    .eq('cat_id', catId)
    .maybeSingle()
  if (error || !data) return null
  return { th: data.summary_th, en: data.summary_en, reviewCount: data.review_count, generatedAt: data.generated_at }
}

/**
 * ขอให้ backend สรุป (ไม่ต้องล็อกอิน) — backend คืนของเดิมถ้าข้อมูลไม่เปลี่ยน
 * คืน null ถ้ารีวิวยังไม่ครบ / throw ถ้าเรียกไม่สำเร็จ (server กำลังตื่น, AI ล่ม) ให้ลองใหม่ได้
 */
export async function requestCatSummary(catId: string): Promise<CatSummary | null> {
  if (!API_URL) return null
  const res = await fetch(`${API_URL}/cats/${catId}/summary`, { method: 'POST' })
  if (!res.ok) throw new ApiError('สรุปด้วย AI ไม่สำเร็จ ลองใหม่ภายหลัง', res.status)
  const body = (await res.json()) as { summary: CatSummary | null }
  return body.summary
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

// ═══════════════ ติดตามน้อง + การแจ้งเตือน ═══════════════
export async function fetchIsFollowing(catId: string): Promise<boolean> {
  const { data, error } = await db().from('cat_follows').select('cat_id').eq('cat_id', catId).maybeSingle()
  return !error && data !== null
}

export async function setFollowing(catId: string, follow: boolean): Promise<void> {
  const { error } = follow
    ? await db().from('cat_follows').insert({ cat_id: catId })
    : await db().from('cat_follows').delete().eq('cat_id', catId)
  // กดติดตามซ้ำ (มีอยู่แล้ว) ถือว่าสำเร็จ
  if (error && error.code !== '23505') throw new ApiError('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง', 500)
}

interface NotificationRow {
  id: number
  kind: AppNotification['kind']
  cat_id: string | null
  data: AppNotification['data'] | null
  created_at: string
  read_at: string | null
}

/** การแจ้งเตือน 40 อันล่าสุด (ยังไม่ได้รัน migration 0013 ก็ได้รายการว่าง) */
export async function fetchNotifications(): Promise<AppNotification[]> {
  const { data, error } = await db()
    .from('notifications')
    .select('id, kind, cat_id, data, created_at, read_at')
    .order('created_at', { ascending: false })
    .limit(40)
  if (error || !data) return []
  return (data as NotificationRow[]).map((r) => ({
    id: r.id,
    kind: r.kind,
    catId: r.cat_id,
    data: r.data ?? {},
    createdAt: r.created_at,
    readAt: r.read_at,
  }))
}

export async function markNotificationsRead(): Promise<void> {
  const { error } = await db().from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)
  if (error) throw new ApiError('บันทึกไม่สำเร็จ', 500)
}

// ═══════════════ ประกาศแมวหาย / หาบ้าน ═══════════════
interface PostRow {
  id: string
  kind: PostKind
  user_id: string
  user_name: string | null
  title: string
  description: string
  fur_color: FurColor
  fur_color_custom: string | null
  contact: string
  lat: number
  lng: number
  photo_path: string | null
  created_at: string
}

/** ประกาศที่ยังเปิดอยู่ในกรอบแผนที่ (ยังไม่ได้รัน migration 0016 ก็ได้รายการว่าง) */
export async function fetchPostsInView(bounds: Bounds): Promise<CatPost[]> {
  const { data, error } = await db().rpc('posts_in_view', {
    min_lat: bounds.minLat,
    min_lng: bounds.minLng,
    max_lat: bounds.maxLat,
    max_lng: bounds.maxLng,
  })
  if (error || !data) return []
  return (data as PostRow[]).map((r) => ({
    id: r.id,
    kind: r.kind,
    userId: r.user_id,
    userName: r.user_name,
    title: r.title,
    description: r.description,
    furColor: r.fur_color,
    furColorCustom: r.fur_color_custom,
    contact: r.contact,
    position: { lat: r.lat, lng: r.lng },
    photoUrl: photoUrl(r.photo_path),
    createdAt: r.created_at,
  }))
}

export interface NewPostInput {
  kind: PostKind
  photo: File
  title: string
  furColor: FurColor
  furColorCustom: string
  description: string
  contact: string
  position: LatLng
  confirmCat: boolean
}

export function createPost(input: NewPostInput): Promise<{ id: string }> {
  const form = new FormData()
  form.append('photo', input.photo)
  form.append('kind', input.kind)
  form.append('title', input.title)
  form.append('fur_color', input.furColor)
  if (input.furColor === 'other') form.append('fur_color_custom', input.furColorCustom)
  form.append('description', input.description)
  form.append('contact', input.contact)
  form.append('lat', String(input.position.lat))
  form.append('lng', String(input.position.lng))
  if (input.confirmCat) form.append('confirm_cat', 'true')
  return callBackend<{ id: string }>('POST', '/posts', form)
}

export function resolvePost(postId: string): Promise<void> {
  return callBackend<void>('POST', `/posts/${postId}/resolve`)
}

export function deletePost(postId: string): Promise<void> {
  return callBackend<void>('DELETE', `/posts/${postId}`)
}

// ═══════════════ ตราสัญลักษณ์ + อันดับในพื้นที่ ═══════════════
/** null = ยังไม่ได้รัน migration 0015 */
export async function fetchUserStats(userId: string): Promise<UserStats | null> {
  const { data, error } = await db().rpc('user_stats', { p_user_id: userId })
  if (error || !data) return null
  return (data as UserStats[])[0] ?? null
}

export async function fetchAreaLeaderboard(bounds: Bounds): Promise<LeaderboardRow[]> {
  const { data, error } = await db().rpc('area_leaderboard', {
    min_lat: bounds.minLat,
    min_lng: bounds.minLng,
    max_lat: bounds.maxLat,
    max_lng: bounds.maxLng,
  })
  if (error || !data) return []
  return (data as { user_id: string; display_name: string; avatar_url: string | null; avatar_path: string | null; points: number }[]).map(
    (r) => ({ userId: r.user_id, name: r.display_name, avatarUrl: effectiveAvatar(r), points: r.points }),
  )
}

// ═══════════════ บันทึกการให้อาหาร ═══════════════
/** null = ยังไม่ได้รัน migration 0014 (ไม่ต้องแสดงการ์ด) */
export async function fetchFeedingsToday(catId: string): Promise<FeedingsToday | null> {
  const { data, error } = await db().rpc('cat_feedings_today', { p_cat_id: catId })
  if (error) return null
  const row = (data as { feedings: number; last_fed_at: string | null; mine: boolean }[])[0]
  return { feedings: row?.feedings ?? 0, lastFedAt: row?.last_fed_at ?? null, mine: row?.mine ?? false }
}

export async function recordFeeding(catId: string, food: FoodKind): Promise<void> {
  const { error } = await db().rpc('record_feeding', { p_cat_id: catId, p_food: food })
  if (error) {
    if (error.message.includes('too_soon')) throw new ApiError('คุณเพิ่งบันทึกการให้อาหารน้องตัวนี้ไป รอสัก 2 ชั่วโมงนะ', 429)
    if (error.message.includes('login_required')) throw new ApiError('เข้าสู่ระบบก่อนนะ', 401)
    throw new ApiError('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง', 500)
  }
}

// ═══════════════ ช่วงเวลาที่มักเจอ ═══════════════
/** จำนวนครั้งที่เจอน้องในแต่ละชั่วโมง (เวลาไทย) index 0–23 — ยังไม่ได้รัน migration 0012 ก็ได้ศูนย์ทั้งหมด */
export async function fetchSightingHours(catId: string): Promise<number[]> {
  const counts = Array<number>(24).fill(0)
  const { data, error } = await db().rpc('cat_sighting_hours', { p_cat_id: catId })
  if (error || !data) return counts
  for (const row of data as { hour: number; sightings: number }[]) counts[row.hour] = row.sightings
  return counts
}

// ═══════════════ น้องต้องการความช่วยเหลือ ═══════════════
interface HelpRow {
  id: string
  kind: HelpKind
  note: string
  created_at: string
  user_id: string
  near_cat?: boolean
  reminded_at?: string | null
  cat_help_confirmations?: { user_id: string; near_cat: boolean }[]
  profiles: { display_name: string } | null
}

const HELP_SELECT = 'id, kind, note, created_at, user_id, profiles!cat_help_requests_user_id_fkey(display_name)'

/** เรื่องที่ยังไม่มีใครปิดของน้องตัวนี้ */
export async function fetchHelpRequests(catId: string): Promise<HelpRequest[]> {
  const query = (select: string) =>
    db().from('cat_help_requests').select(select).eq('cat_id', catId).is('resolved_at', null).order('created_at', { ascending: false })
  let { data, error } = await query(`${HELP_SELECT}, near_cat, reminded_at, cat_help_confirmations(user_id, near_cat)`)
  // ยังไม่ได้รัน migration 0021 → ใช้แบบเดิม
  if (error) ({ data, error } = await query(HELP_SELECT))
  if (error) return []
  return (data as unknown as HelpRow[]).map((r) => ({
    id: r.id,
    kind: r.kind,
    note: r.note,
    createdAt: r.created_at,
    userId: r.user_id,
    reporterName: r.profiles?.display_name ?? null,
    nearCat: r.near_cat ?? false,
    confirmations: (r.cat_help_confirmations ?? []).map((c) => ({ userId: c.user_id, nearCat: c.near_cat })),
    remindedAt: r.reminded_at ?? null,
  }))
}

const gpsArgs = (fix: GpsFix | null) =>
  fix ? { p_lat: fix.position.lat, p_lng: fix.position.lng, p_accuracy: fix.accuracy } : {}

/** แจ้งเรื่อง — ส่งพิกัดไปให้ฐานข้อมูลเช็กว่าอยู่ใกล้หมุดไหม (ไม่ได้เก็บพิกัดไว้) */
export async function requestHelp(catId: string, kind: HelpKind, note: string, fix: GpsFix | null = null): Promise<void> {
  let { error } = await db().rpc('request_cat_help', { p_cat_id: catId, p_kind: kind, p_note: note, ...gpsArgs(fix) })
  // ยังไม่ได้รัน migration 0021
  if (error?.code === 'PGRST202') ({ error } = await db().from('cat_help_requests').insert({ cat_id: catId, kind, note }))
  if (error) {
    if (error.code === '23505') throw new ApiError('คุณแจ้งเรื่องนี้ของน้องไปแล้ว รอคนมาช่วยก่อนนะ', 409)
    throw new ApiError('แจ้งไม่สำเร็จ ลองใหม่อีกครั้ง', 500)
  }
}

export async function resolveHelp(catId: string, note = ''): Promise<void> {
  const { error } = await db().rpc('resolve_cat_help', { p_cat_id: catId, p_note: note })
  if (error) {
    if (error.message.includes('not_allowed')) throw new ApiError('ปิดเรื่องได้เฉพาะคนแจ้ง คนปักหมุด หรือผู้ดูแล', 403)
    throw new ApiError('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง', 500)
  }
}

/** "ฉันก็เห็น" — คืน true ถ้าอยู่ใกล้หมุดตอนกด */
export async function confirmHelp(requestId: string, fix: GpsFix | null): Promise<boolean> {
  const { data, error } = await db().rpc('confirm_cat_help', { p_request_id: requestId, ...gpsArgs(fix) })
  if (error) {
    if (error.message.includes('request_closed')) throw new ApiError('เรื่องนี้ปิดไปแล้ว', 409)
    if (error.message.includes('own_request')) throw new ApiError('ยืนยันเรื่องที่ตัวเองแจ้งไม่ได้', 400)
    throw new ApiError('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง', 500)
  }
  return Boolean(data)
}

export async function unconfirmHelp(requestId: string, userId: string): Promise<void> {
  const { error } = await db().from('cat_help_confirmations').delete().eq('request_id', requestId).eq('user_id', userId)
  if (error) throw new ApiError('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง', 500)
}

/** คนแจ้งตอบว่าน้องยังต้องการความช่วยเหลืออยู่ */
export async function renewHelp(requestId: string): Promise<void> {
  const { error } = await db().rpc('renew_cat_help', { p_request_id: requestId })
  if (error) throw new ApiError('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง', 500)
}

// ═══════════════ อุปกรณ์ที่เข้าสู่ระบบ ═══════════════
interface DeviceSessionRow {
  id: string
  user_agent: string | null
  ip: string | null
  created_at: string
  last_active_at: string | null
  city: string | null
  region: string | null
  country: string | null
  is_current: boolean
}

export async function fetchMySessions(): Promise<DeviceSession[]> {
  const { data, error } = await db().rpc('my_sessions')
  if (error) throw new ApiError('โหลดรายการอุปกรณ์ไม่สำเร็จ', 500)
  return (data as DeviceSessionRow[]).map((r) => ({
    id: r.id,
    userAgent: r.user_agent,
    ip: r.ip,
    createdAt: r.created_at,
    lastActiveAt: r.last_active_at ?? r.created_at,
    city: r.city,
    region: r.region,
    country: r.country,
    isCurrent: r.is_current,
  }))
}

export async function revokeSession(sessionId: string): Promise<void> {
  const { error } = await db().rpc('revoke_session', { p_session_id: sessionId })
  if (error) throw new ApiError('ออกจากระบบอุปกรณ์นั้นไม่สำเร็จ ลองใหม่อีกครั้ง', 500)
}

export async function revokeOtherSessions(): Promise<number> {
  const { data, error } = await db().rpc('revoke_other_sessions')
  if (error) throw new ApiError('ออกจากระบบอุปกรณ์นั้นไม่สำเร็จ ลองใหม่อีกครั้ง', 500)
  return data as number
}

/** บันทึกตำแหน่งโดยประมาณของเครื่องนี้ (จาก Vercel /api/geo) — คืน true ถ้าเสร็จแล้วไม่ต้องทำซ้ำ */
export async function tagSessionLocation(): Promise<boolean> {
  const res = await fetch('/api/geo').catch(() => null)
  // ตอนรันในเครื่อง (vite dev) ไม่มี /api/geo — ได้ index.html กลับมา
  if (!res?.ok || !res.headers.get('content-type')?.includes('json')) return false
  const geo = (await res.json()) as { city: string | null; region: string | null; country: string | null }
  if (!geo.city && !geo.country) return false
  const { error } = await db().rpc('tag_session_location', {
    p_city: geo.city ?? '',
    p_region: geo.region ?? '',
    p_country: geo.country ?? '',
  })
  return !error
}

// ═══════════════ บันทึกกิจกรรม (admin) ═══════════════
interface ActivityRow {
  id: number
  action: ActivityAction
  cat_id: string | null
  created_at: string
  detail: ActivityEntry['detail'] | null
  profiles: { id: string; display_name: string; avatar_url: string | null; avatar_path?: string | null } | null
}

export const ACTIVITY_PAGE_SIZE = 50

export async function fetchActivity(options: {
  actions: ActivityAction[] | null
  userId: string | null
  page: number
}): Promise<ActivityEntry[]> {
  let query = db()
    .from('activity_log')
    .select('id, action, cat_id, created_at, detail, profiles(id, display_name, avatar_url, avatar_path)')
    .order('created_at', { ascending: false })
    .range(options.page * ACTIVITY_PAGE_SIZE, (options.page + 1) * ACTIVITY_PAGE_SIZE - 1)
  if (options.actions) query = query.in('action', options.actions)
  if (options.userId) query = query.eq('user_id', options.userId)
  const { data, error } = await query
  if (error) throw new ApiError('โหลดบันทึกกิจกรรมไม่สำเร็จ', 500)
  return (data as unknown as ActivityRow[]).map((r) => ({
    id: r.id,
    action: r.action,
    catId: r.cat_id,
    createdAt: r.created_at,
    detail: r.detail ?? {},
    user: r.profiles ? { id: r.profiles.id, name: r.profiles.display_name, avatarUrl: effectiveAvatar(r.profiles) } : null,
  }))
}
