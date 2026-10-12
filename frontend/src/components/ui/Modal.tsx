import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { useI18n } from '../../hooks/useI18n'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  /** กว้างขึ้นสำหรับหน้าที่มีรายการยาว เช่นรายงานของ admin */
  wide?: boolean
  /** อยู่เหนือทุกอย่าง (เช่นหน้าต่างให้เข้าสู่ระบบ ที่อาจเด้งขึ้นตอนดูรูปเต็มจอ) */
  top?: boolean
}

// บนมือถือเป็นแผ่นเลื่อนขึ้นจากด้านล่าง บนจอใหญ่เป็นกล่องกลางจอ
// pointer-events-auto: ตอนการ์ดแมว (vaul) เปิดอยู่ body ถูกตั้ง pointer-events: none — ไม่ใส่แล้วแตะ/เลื่อนในหน้าต่างไม่ได้
export function Modal({ title, onClose, children, wide = false, top = false }: Props) {
  const { t } = useI18n()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className={`pointer-events-auto fixed inset-0 ${top ? 'z-[70]' : 'z-50'} flex animate-fade-in items-end justify-center bg-black/40 md:items-center`} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[92%] w-full animate-sheet-up overflow-y-auto rounded-t-3xl bg-surface p-5 md:animate-pop-in pb-8 shadow-xl md:rounded-3xl md:pb-5 ${
          wide ? 'md:max-w-2xl' : 'md:max-w-md'
        }`}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl text-stone-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 shrink-0 rounded-full p-1.5 text-stone-500 hover:bg-stone-100"
            aria-label={t('ปิด')}
          >
            <X size={22} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
