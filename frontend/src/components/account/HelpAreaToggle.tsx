import { useQuery, useQueryClient } from '@tanstack/react-query'
import { HeartPulse, LoaderCircle, LocateFixed } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useI18n } from '../../hooks/useI18n'
import { clearHelpAlertArea, fetchHelpAlertArea, setHelpAlertArea } from '../../lib/api'
import { timeAgo } from '../../lib/cat'
import { getCurrentPosition } from '../../lib/geo'

const RADII = [1000, 2000, 5000]

/** แจ้งเตือนเมื่อมีน้องต้องการความช่วยเหลือใกล้ "พื้นที่ของฉัน" (ตั้งจากตำแหน่งตอนกด) */
export function HelpAreaToggle() {
  const { t, lang } = useI18n()
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  const area = useQuery({ queryKey: ['helpArea', userId], queryFn: fetchHelpAlertArea, enabled: userId !== null })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const on = Boolean(area.data)
  const radius = area.data?.radiusM ?? 2000

  const run = async (task: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await task()
      await queryClient.invalidateQueries({ queryKey: ['helpArea', userId] })
    } catch (e) {
      setError(t(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง'))
    }
    setBusy(false)
  }

  // ใช้ตำแหน่งตอนนี้เป็นจุดกลางของพื้นที่
  const saveHere = (radiusM: number) =>
    run(async () => {
      const fix = await getCurrentPosition(10_000)
      if (!fix) throw new Error('เปิดสิทธิ์เข้าถึงตำแหน่งก่อน แล้วลองใหม่อีกครั้ง')
      await setHelpAlertArea(fix.position, radiusM)
    })

  const toggle = () => (on ? run(() => clearHelpAlertArea(userId!)) : saveHere(radius))

  if (!userId || area.isPending) return null

  return (
    <div className="mb-3 rounded-2xl bg-stone-50 px-3.5 py-3 ring-1 ring-stone-100">
      <div className="flex items-center gap-3">
        <HeartPulse size={18} className="shrink-0 text-red-500" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-stone-900">{t('น้องต้องการความช่วยเหลือใกล้ฉัน')}</p>
          <p className="text-xs text-stone-500">{t('แจ้งเตือนเมื่อมีคนแจ้งว่าน้องแถวนี้ต้องการความช่วยเหลือ')}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={t('น้องต้องการความช่วยเหลือใกล้ฉัน')}
          disabled={busy}
          onClick={toggle}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${on ? 'bg-orange-500' : 'bg-stone-300'}`}
        >
          <span
            className={`absolute top-1 left-1 flex size-5 items-center justify-center rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`}
          >
            {busy && <LoaderCircle size={12} className="animate-spin text-stone-500" aria-hidden="true" />}
          </span>
        </button>
      </div>

      {on && area.data && (
        <div className="mt-2.5 flex flex-col gap-2 border-t border-stone-200 pt-2.5">
          <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label={t('รัศมี')}>
            <span className="mr-1 text-xs text-stone-600">{t('รัศมี')}</span>
            {RADII.map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={radius === r}
                disabled={busy}
                onClick={() => run(() => setHelpAlertArea(area.data!.position, r))}
                className={`h-7 rounded-full px-2.5 text-xs font-medium ring-1 ${
                  radius === r ? 'bg-orange-500 text-white ring-orange-500' : 'bg-surface text-stone-700 ring-stone-300 hover:bg-orange-50'
                }`}
              >
                {t('{n} กม.', { n: r / 1000 })}
              </button>
            ))}
          </div>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-stone-500">
            {t('ใช้ตำแหน่งที่ตั้งไว้เมื่อ {when}', { when: timeAgo(area.data.updatedAt, lang) })}
            <button
              type="button"
              disabled={busy}
              onClick={() => saveHere(radius)}
              className="flex items-center gap-1 font-medium text-sky-700 hover:underline"
            >
              <LocateFixed size={12} aria-hidden="true" />
              {t('ใช้ตำแหน่งตอนนี้แทน')}
            </button>
          </p>
        </div>
      )}
      {!on && <p className="mt-2 text-xs text-stone-500">{t('เปิดแล้วจะใช้ตำแหน่งตอนนี้เป็นจุดกลาง (เก็บแบบคร่าวๆ ไม่ใช่ตำแหน่งบ้านเป๊ะๆ)')}</p>}
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  )
}
