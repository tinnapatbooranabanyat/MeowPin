import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { useI18n } from '../../hooks/useI18n'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  /** กว้างขึ้นสำหรับหน้าที่มีรายการยาว เช่นรายงานของ admin */
  wide?: boolean
}

// บนมือถือเป็นแผ่นเลื่อนขึ้นจากด้านล่าง บนจอใหญ่เป็นกล่องกลางจอ
export function Modal({ title, onClose, children, wide = false }: Props) {
  const { t } = useI18n()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[92%] w-full overflow-y-auto rounded-t-3xl bg-surface p-5 pb-8 shadow-xl md:rounded-3xl md:pb-5 ${
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
