import { RefreshCw, X } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useI18n } from '../hooks/useI18n'

// เช็กเวอร์ชันใหม่ทุก 30 นาที (เปิดแอปค้างไว้นานๆ ก็ยังรู้)
const CHECK_EVERY_MS = 30 * 60_000

/** มีเวอร์ชันใหม่ → ขึ้นแถบให้กดอัปเดตเอง (ไม่โหลดหน้าใหม่ทันที เผื่อผู้ใช้กรอกฟอร์มค้างอยู่) */
export function UpdatePrompt() {
  const { t } = useI18n()
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => registration.update().catch(() => {}), CHECK_EVERY_MS)
    },
  })
  if (!needRefresh) return null
  return (
    <div role="status" className="fixed inset-x-0 bottom-24 z-[70] flex animate-fade-up justify-center px-4 md:bottom-6">
      <div className="flex items-center gap-2 rounded-full bg-stone-900 py-1.5 pr-1.5 pl-4 text-sm text-white shadow-lg dark:bg-stone-100 dark:text-stone-900">
        {t('มี MeowPin เวอร์ชันใหม่')}
        <button
          type="button"
          onClick={() => updateServiceWorker(true)}
          className="flex items-center gap-1 rounded-full bg-orange-500 px-3 py-1.5 font-medium text-white hover:bg-orange-600"
        >
          <RefreshCw size={14} aria-hidden="true" />
          {t('อัปเดต')}
        </button>
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          className="rounded-full p-1.5 opacity-70 hover:opacity-100"
          aria-label={t('ไว้ทีหลัง')}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
