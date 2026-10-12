import { BellRing, LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useI18n } from '../../hooks/useI18n'
import { disablePush, enablePush, getPushState, type PushState } from '../../lib/push'

const HINTS: Partial<Record<PushState, string>> = {
  'needs-install': 'บน iPhone/iPad ต้องกดปุ่มแชร์ → "เพิ่มไปยังหน้าจอโฮม" แล้วเปิด MeowPin จากหน้าจอหลักก่อน ถึงจะเปิดแจ้งเตือนได้',
  unsupported: 'เบราว์เซอร์นี้ยังไม่รองรับแจ้งเตือนเด้ง ลองเปิดใน Chrome หรือติดตั้งแอปลงหน้าจอหลัก',
  denied: 'คุณปิดการแจ้งเตือนของเว็บนี้ไว้ เปิดได้ที่การตั้งค่าเว็บไซต์ของเบราว์เซอร์',
}

/** เปิด/ปิดแจ้งเตือนเด้งบนเครื่องนี้ */
export function PushToggle() {
  const { t, lang } = useI18n()
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getPushState().then(setState).catch(() => setState('unsupported'))
  }, [])

  if (!state) return null
  const on = state === 'on'
  const canToggle = state === 'on' || state === 'off'

  const toggle = async () => {
    setBusy(true)
    setError(null)
    try {
      setState(on ? await disablePush() : await enablePush(lang))
    } catch (e) {
      setError(t(e instanceof Error ? e.message : 'เปิดการแจ้งเตือนไม่สำเร็จ ลองใหม่อีกครั้ง'))
    }
    setBusy(false)
  }

  return (
    <div className="mb-3 rounded-2xl bg-stone-50 px-3.5 py-3 ring-1 ring-stone-100">
      <div className="flex items-center gap-3">
        <BellRing size={18} className="shrink-0 text-orange-500" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-stone-900">{t('แจ้งเตือนเด้งบนเครื่องนี้')}</p>
          <p className="text-xs text-stone-500">{t('รู้ทันทีแม้ไม่ได้เปิดแอป')}</p>
        </div>
        {canToggle && (
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={t('แจ้งเตือนเด้งบนเครื่องนี้')}
            disabled={busy}
            onClick={toggle}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${on ? 'bg-orange-500' : 'bg-stone-300'}`}
          >
            <span
              className={`absolute top-1 left-1 flex size-5 items-center justify-center rounded-full bg-white shadow transition-transform ${
                on ? 'translate-x-5' : ''
              }`}
            >
              {busy && <LoaderCircle size={12} className="animate-spin text-stone-500" aria-hidden="true" />}
            </span>
          </button>
        )}
      </div>
      {HINTS[state] && <p className="mt-2 text-xs text-stone-600">{t(HINTS[state]!)}</p>}
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  )
}
