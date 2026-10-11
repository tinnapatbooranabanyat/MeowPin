import { LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useI18n } from '../hooks/useI18n'
import { onBackendWaking } from '../lib/api'

/** แถบบอกว่ากำลังรอ server ตื่น (อยู่เหนือทุกหน้าต่าง ผู้ใช้จะได้ไม่คิดว่าแอปค้าง) */
export function ServerWakingBanner() {
  const { t } = useI18n()
  const [waking, setWaking] = useState(false)
  useEffect(() => onBackendWaking(setWaking), [])
  if (!waking) return null
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 top-3 z-[80] flex animate-fade-in justify-center px-4"
    >
      <p className="flex items-center gap-2 rounded-full bg-stone-900/90 px-4 py-2 text-sm text-white shadow-lg backdrop-blur dark:bg-stone-100/95 dark:text-stone-900">
        <LoaderCircle size={16} className="shrink-0 animate-spin" aria-hidden="true" />
        {t('กำลังปลุก server อยู่ อาจใช้เวลาเกือบนาที…')}
      </p>
    </div>
  )
}
