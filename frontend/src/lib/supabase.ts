import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

// frontend ใช้แค่ publishable key อ่านข้อมูล (สิทธิ์ถูกจำกัดด้วย RLS) — การเขียนทั้งหมดผ่าน backend
export const supabase = url && publishableKey ? createClient(url, publishableKey) : null

/** เช็กว่าเปิด Google sign-in ใน Supabase แล้วหรือยัง — ถ้ายังไม่เปิด Supabase จะพาไปหน้า error JSON เปล่าๆ */
export async function isGoogleSignInEnabled(): Promise<boolean> {
  if (!url || !publishableKey) return false
  try {
    const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: publishableKey } })
    const settings = (await res.json()) as { external?: Record<string, boolean> }
    return settings.external?.google === true
  } catch {
    // เช็กไม่ได้ (เน็ตหลุด ฯลฯ) ให้ลองพาไปตามปกติ
    return true
  }
}

export function photoUrl(path: string | null): string | undefined {
  if (!path || !url) return undefined
  return `${url}/storage/v1/object/public/cat-photos/${path}`
}
