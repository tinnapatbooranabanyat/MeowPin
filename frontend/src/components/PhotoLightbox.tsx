import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../hooks/useI18n'
import type { CatPhoto } from '../types'

interface Props {
  photos: CatPhoto[]
  startIndex: number
  alt: string
  onClose: () => void
}

/** ดูรูปเต็มจอ เลื่อนดูรูปถัดไปได้ด้วยปุ่ม ลูกศรคีย์บอร์ด หรือปัดซ้าย-ขวา */
export function PhotoLightbox({ photos, startIndex, alt, onClose }: Props) {
  const { t } = useI18n()
  const [index, setIndex] = useState(startIndex)
  const swipeStart = useRef<number | null>(null)
  // ปัดรูปแล้วปล่อยนิ้ว เบราว์เซอร์จะส่ง click ตามมา — ไม่ให้ไปปิดหน้าต่าง
  const justSwiped = useRef(false)
  const photo = photos[index]
  const many = photos.length > 1

  const go = useCallback((delta: number) => setIndex((i) => (i + delta + photos.length) % photos.length), [photos.length])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, go])

  if (!photo) return null

  const navButton = (side: 'left' | 'right') => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        go(side === 'left' ? -1 : 1)
      }}
      className={`absolute top-1/2 ${side === 'left' ? 'left-3' : 'right-3'} flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 active:scale-90`}
      aria-label={side === 'left' ? t('รูปก่อนหน้า') : t('รูปถัดไป')}
    >
      {side === 'left' ? <ChevronLeft size={26} /> : <ChevronRight size={26} />}
    </button>
  )

  // portal ออกไปที่ body เพราะแผ่นด้านล่างของมือถือมี transform ทำให้ fixed ไม่เต็มจอ
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={() => {
        if (justSwiped.current) {
          justSwiped.current = false
          return
        }
        onClose()
      }}
      onPointerDown={(e) => (swipeStart.current = e.clientX)}
      onPointerUp={(e) => {
        const dx = swipeStart.current === null ? 0 : e.clientX - swipeStart.current
        swipeStart.current = null
        if (many && Math.abs(dx) > 50) {
          justSwiped.current = true
          go(dx < 0 ? 1 : -1)
        }
      }}
      className="pointer-events-auto fixed inset-0 z-[60] flex animate-fade-in flex-col items-center justify-center bg-black/90 p-4"
    >
      <img
        key={photo.id}
        src={photo.url}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85%] max-w-full animate-pop-in rounded-xl object-contain shadow-2xl"
        draggable={false}
      />
      <p className="mt-3 text-sm text-white/80">
        {many && `${index + 1} / ${photos.length}`}
        {photo.uploaderName && `${many ? ' · ' : ''}${t('รูปจาก {name}', { name: photo.uploaderName })}`}
      </p>
      {many && navButton('left')}
      {many && navButton('right')}
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
