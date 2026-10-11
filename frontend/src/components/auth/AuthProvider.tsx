import type { Session } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PawPrint } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AuthContext, type AuthState } from '../../hooks/useAuth'
import { acceptTerms, checkIsAdmin, fetchProfile, tagSessionLocation } from '../../lib/api'
import { isGoogleSignInEnabled, supabase } from '../../lib/supabase'
import { TERMS_VERSION } from '../../lib/terms'
import { sessionIdOf } from '../../lib/userAgent'
import { useI18n } from '../../hooks/useI18n'
import { translate, type TParams } from '../../i18n'
import { Modal } from '../ui/Modal'
import { GoogleButton } from './GoogleButton'
import { TermsDialog } from './TermsDialog'

type LoginError = { key: string; params?: TParams }

/**
 * ล็อกอินไม่ผ่าน Supabase จะพากลับมาพร้อม ?error=...&error_description=... (หรือใน #hash)
 * ถ้าไม่อ่านไว้ ผู้ใช้จะเห็นแค่ว่ายังไม่ได้ล็อกอินโดยไม่รู้สาเหตุ — อ่านแล้วลบออกจาก URL
 */
function takeAuthErrorFromUrl(): LoginError | null {
  const url = new URL(window.location.href)
  const hash = new URLSearchParams(url.hash.slice(1))
  const pick = (key: string) => url.searchParams.get(key) ?? hash.get(key)
  const code = pick('error')
  const description = pick('error_description')
  if (!code && !description) return null
  for (const key of ['error', 'error_code', 'error_description']) url.searchParams.delete(key)
  if (hash.has('error') || hash.has('error_description')) url.hash = ''
  window.history.replaceState(window.history.state, '', url)
  const reason = (description ?? code ?? '').replace(/\+/g, ' ')
  if (code === 'access_denied') return { key: 'ยกเลิกการเข้าสู่ระบบ หรือ Google ไม่อนุญาตบัญชีนี้ ({reason})', params: { reason } }
  if (/database error/i.test(reason)) return { key: 'สร้างบัญชีใหม่ไม่สำเร็จ ลองใหม่อีกครั้ง ({reason})', params: { reason } }
  return { key: 'เข้าสู่ระบบไม่สำเร็จ: {reason}', params: { reason } }
}

const wantsTermsFromUrl = () => new URLSearchParams(window.location.search).has('terms')
// อ่านครั้งเดียวตอนโหลดแอป (StrictMode เรียก initializer ของ useState ซ้ำ แต่ URL ถูกลบไปแล้ว)
// ต้องเช็ก token ก่อน takeAuthErrorFromUrl และก่อนที่ supabase จะลบออกจาก URL
const cameBackWithToken = /[#&?](access_token|code)=/.test(window.location.href)
const initialAuthError = takeAuthErrorFromUrl()

export function AuthProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(supabase !== null)
  const [loginReason, setLoginReason] = useState<string | null>(() =>
    initialAuthError ? translate('เข้าสู่ระบบด้วย Google') : null,
  )
  const [loginError, setLoginError] = useState<LoginError | null>(initialAuthError)
  // ?terms ใน URL = เปิดอ่านข้อกำหนดเลย (ใช้เป็นลิงก์ Terms of Service ในหน้า consent ของ Google ได้)
  const [viewTerms, setViewTerms] = useState(wantsTermsFromUrl)

  useEffect(() => {
    if (!supabase) return
    const client = supabase
    // initialize() คืน error ตอนอ่าน token จาก URL ไม่ผ่าน — getSession() เงียบเฉยๆ ผู้ใช้เลยเห็นแค่ว่ายังไม่ได้ล็อกอิน
    client.auth.initialize().then(async ({ error }) => {
      const { data } = await client.auth.getSession()
      setSession(data.session)
      setLoading(false)
      if (data.session || (!error && !cameBackWithToken)) return
      console.error('[auth] sign-in from redirect failed', error)
      // token ที่ใช้ไม่ได้ไม่ต้องค้างใน URL (reload แล้วจะเจอ error ซ้ำ)
      if (window.location.hash) {
        window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
      }
      const reason = error?.message ?? translate('ได้ข้อมูลจาก Google แล้ว แต่เบราว์เซอร์สร้าง session ไม่ได้')
      setLoginReason((r) => r ?? translate('เข้าสู่ระบบด้วย Google'))
      setLoginError((e) => e ?? { key: 'เข้าสู่ระบบไม่สำเร็จ: {reason}', params: { reason } })
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id ?? null
  const sessionId = session ? sessionIdOf(session.access_token) : null

  // บันทึกตำแหน่งโดยประมาณของเครื่องนี้ครั้งเดียวต่อการล็อกอิน (ให้เห็นในหน้า "อุปกรณ์ที่เข้าสู่ระบบ")
  useEffect(() => {
    if (!sessionId) return
    const key = 'meowpin.locatedSession'
    try {
      if (localStorage.getItem(key) === sessionId) return
    } catch {
      // private mode — ทำซ้ำได้ ฐานข้อมูลรับแค่ครั้งแรกอยู่แล้ว
    }
    tagSessionLocation()
      .then((done) => {
        if (!done) return
        try {
          localStorage.setItem(key, sessionId)
        } catch {
          // ไม่เป็นไร
        }
      })
      .catch(() => {})
  }, [sessionId])

  // ถูกสั่งออกจากระบบจากเครื่องอื่น: refresh token ใช้ไม่ได้แล้ว แต่ access token ยังไม่หมดอายุ
  // — เช็กกับ Supabase ทุกครั้งที่กลับมาที่แท็บนี้ แล้วออกจากระบบเฉพาะเครื่องนี้
  useEffect(() => {
    if (!supabase || !sessionId) return
    const client = supabase
    const check = async () => {
      if (document.visibilityState !== 'visible') return
      const { error } = await client.auth.getUser()
      if (!error || (error.status !== 403 && error.code !== 'session_not_found')) return
      await client.auth.signOut({ scope: 'local' })
      setLoginReason(translate('อุปกรณ์นี้ถูกสั่งออกจากระบบจากอุปกรณ์อื่น เข้าสู่ระบบใหม่เพื่อใช้งานต่อ'))
    }
    check()
    document.addEventListener('visibilitychange', check)
    return () => document.removeEventListener('visibilitychange', check)
  }, [sessionId])

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
    // กลับมาหน้าเดิม (รวม ?cat=...) หลังล็อกอินเสร็จ — ไม่เอา #hash ไป Supabase จะต่อ #access_token ท้ายให้เอง
    const redirectTo = new URL(window.location.href)
    redirectTo.hash = ''
    // ขอ URL ก่อน (ยังไม่ redirect) แล้วเช็กว่า Google เปิดใช้อยู่ — ไม่งั้นผู้ใช้จะไปเจอหน้า error ของ Supabase
    const [{ data, error }, enabled] = await Promise.all([
      supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectTo.toString(), skipBrowserRedirect: true },
      }),
      isGoogleSignInEnabled(),
    ])
    if (!error && data.url && enabled) {
      window.location.assign(data.url)
      return
    }
    // เปิดหน้าต่างล็อกอินค้างไว้พร้อมบอกสาเหตุ แทนที่จะเงียบไป
    setLoginReason((reason) => reason ?? translate('เข้าสู่ระบบด้วย Google'))
    setLoginError({
      key: enabled
        ? 'เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง'
        : 'ยังไม่ได้เปิดการล็อกอินด้วย Google ใน Supabase (Authentication → Sign In / Providers → Google)',
    })
  }, [])

  const signOut = useCallback(async () => {
    // ออกเฉพาะเครื่องนี้ — อยากให้เครื่องอื่นออกด้วยให้ไปกดที่ "อุปกรณ์ที่เข้าสู่ระบบ"
    await supabase?.auth.signOut({ scope: 'local' })
    queryClient.removeQueries({ queryKey: ['profile'] })
    queryClient.removeQueries({ queryKey: ['isAdmin'] })
    queryClient.removeQueries({ queryKey: ['mySessions'] })
  }, [queryClient])

  const profile = profileQuery.data ?? null
  // termsVersion = null คือยังไม่ได้รัน migration 0007 — ข้ามไปก่อน ไม่งั้นจะกดยอมรับไม่ได้และติดอยู่หน้านี้
  const needsTerms = profile !== null && profile.termsVersion !== null && profile.termsVersion < TERMS_VERSION

  const onAcceptTerms = useCallback(async () => {
    await acceptTerms(TERMS_VERSION)
    await queryClient.invalidateQueries({ queryKey: ['profile', userId] })
  }, [queryClient, userId])

  const openTerms = useCallback(() => setViewTerms(true), [])

  const closeTerms = useCallback(() => {
    setViewTerms(false)
    if (!wantsTermsFromUrl()) return
    const url = new URL(window.location.href)
    url.searchParams.delete('terms')
    window.history.replaceState(window.history.state, '', url)
  }, [])

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
      profile,
      isAdmin: adminQuery.data === true,
      loading,
      signInWithGoogle,
      signOut,
      requireLogin,
      openTerms,
    }),
    [session, userId, profile, adminQuery.data, loading, signInWithGoogle, signOut, requireLogin, openTerms],
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
                {t(loginError.key, loginError.params)}
              </p>
            )}
            <p className="text-xs text-stone-500">
              {t('เราใช้แค่ชื่อและรูปโปรไฟล์จาก Google เพื่อแสดงในแอป')}{' '}
              <button type="button" onClick={openTerms} className="underline underline-offset-2 hover:text-orange-700">
                {t('ข้อกำหนดการใช้งาน')}
              </button>
            </p>
          </div>
        </Modal>
      )}
      {needsTerms ? (
        <TermsDialog mode="accept" onAccept={onAcceptTerms} onDecline={signOut} />
      ) : (
        viewTerms && <TermsDialog mode="view" onClose={closeTerms} />
      )}
    </AuthContext.Provider>
  )
}
