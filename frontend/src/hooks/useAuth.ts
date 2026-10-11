import type { Session } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'
import type { Profile } from '../types'

export interface AuthState {
  session: Session | null
  userId: string | null
  email: string | null
  profile: Profile | null
  isAdmin: boolean
  /** กำลังเช็กเซสชันตอนเปิดแอป */
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  /** ถ้ายังไม่ล็อกอิน จะเปิดหน้าต่างชวนล็อกอินพร้อมบอกเหตุผล แล้วคืน false */
  requireLogin: (reason: string) => boolean
  /** เปิดอ่านข้อกำหนดการใช้งาน */
  openTerms: () => void
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth ต้องใช้ภายใน <AuthProvider>')
  return value
}
