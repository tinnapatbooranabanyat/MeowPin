import { X } from 'lucide-react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../hooks/useI18n'

/** ดูรูปเต็มจอ — กดที่ไหนก็ได้หรือ Esc เพื่อปิด */
export function PhotoLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const { t } = useI18n()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // portal ออกไปที่ body เพราะแผ่นด้านล่างของมือถือมี transform ทำให้ fixed ไม่เต็มจอ
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
      className="fixed inset-0 z-[60] flex animate-fade-in items-center justify-center bg-black/90 p-4"
    >
      <img src={src} alt={alt} className="max-h-full max-w-full animate-pop-in rounded-xl object-contain shadow-2xl" />
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 flex size-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
        aria-label={t('ปิด')}
      >
        <X size={22} />
      </button>
    </div>,
    document.body,
  )
}
