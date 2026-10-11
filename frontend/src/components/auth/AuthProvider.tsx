import type { Session } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PawPrint } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AuthContext, type AuthState } from '../../hooks/useAuth'
import { checkIsAdmin, fetchProfile } from '../../lib/api'
import { isGoogleSignInEnabled, supabase } from '../../lib/supabase'
import { useI18n } from '../../hooks/useI18n'
import { translate } from '../../i18n'
import { Modal } from '../ui/Modal'
import { GoogleButton } from './GoogleButton'

export function AuthProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(supabase !== null)
  const [loginReason, setLoginReason] = useState<string | null>(null)
  const [loginError, setLoginError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id ?? null

  const profileQuery = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => fetchProfile(userId!),
    enabled: userId !== null,
    staleTime: 5 * 60_000,
  })

  const adminQuery = useQuery({
    queryKey: ['isAdmin', userId],
    queryFn: checkIsAdmin,
    enabled: userId !== null,
    staleTime: 10 * 60_000,
  })

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) return
    setLoginError(null)
    // กลับมาหน้าเดิม (รวม ?cat=...) หลังล็อกอินเสร็จ
    // ขอ URL ก่อน (ยังไม่ redirect) แล้วเช็กว่า Google เปิดใช้อยู่ — ไม่งั้นผู้ใช้จะไปเจอหน้า error ของ Supabase
    const [{ data, error }, enabled] = await Promise.all([
      supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.href, skipBrowserRedirect: true },
      }),
      isGoogleSignInEnabled(),
    ])
    if (!error && data.url && enabled) {
      window.location.assign(data.url)
      return
    }
    // เปิดหน้าต่างล็อกอินค้างไว้พร้อมบอกสาเหตุ แทนที่จะเงียบไป
    setLoginReason((reason) => reason ?? translate('เข้าสู่ระบบด้วย Google'))
    setLoginError(
      enabled
        ? 'เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง'
        : 'ยังไม่ได้เปิดการล็อกอินด้วย Google ใน Supabase (Authentication → Sign In / Providers → Google)',
    )
  }, [])

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut()
    queryClient.removeQueries({ queryKey: ['profile'] })
    queryClient.removeQueries({ queryKey: ['isAdmin'] })
  }, [queryClient])

  const requireLogin = useCallback(
    (reason: string) => {
      if (session) return true
      setLoginReason(reason)
      return false
    },
    [session],
  )

  const value = useMemo<AuthState>(
    () => ({
      session,
      userId,
      email: session?.user.email ?? null,
      profile: profileQuery.data ?? null,
      isAdmin: adminQuery.data === true,
      loading,
      signInWithGoogle,
      signOut,
      requireLogin,
    }),
    [session, userId, profileQuery.data, adminQuery.data, loading, signInWithGoogle, signOut, requireLogin],
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
      {loginReason && (
        <Modal
          title={t('เข้าสู่ระบบก่อนนะ')}
          onClose={() => {
            setLoginReason(null)
            setLoginError(null)
          }}
        >
          <div className="flex flex-col items-center gap-4 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-orange-100 text-orange-600">
              <PawPrint size={28} aria-hidden="true" />
            </span>
            <p className="text-stone-700">{loginReason}</p>
            <GoogleButton onClick={signInWithGoogle} />
            {loginError && (
              <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                {t(loginError)}
              </p>
            )}
            <p className="text-xs text-stone-500">{t('เราใช้แค่ชื่อและรูปโปรไฟล์จาก Google เพื่อแสดงในแอป')}</p>
          </div>
        </Modal>
      )}
    </AuthContext.Provider>
  )
}
