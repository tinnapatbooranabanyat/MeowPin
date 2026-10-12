import { useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Flag, Heart, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../hooks/useAuth'
import { useI18n } from '../hooks/useI18n'
import { usePhotoLikes } from '../hooks/usePhotoLikes'
import { deleteCatPhoto, photoRef } from '../lib/api'
import { confirmAction } from '../lib/dialogs'
import type { CatPhoto } from '../types'
import { ReportPhotoDialog } from './ReportPhotoDialog'

interface Props {
  photos: CatPhoto[]
  startIndex: number
  alt: string
  onClose: () => void
  /** ส่งมา = มีปุ่มหัวใจ / รายงาน / ลบ (รูปของหมุดน้องตัวนี้) */
  catId?: string
}

/** ดูรูปเต็มจอ เลื่อนดูรูปถัดไปได้ด้วยปุ่ม ลูกศรคีย์บอร์ด หรือปัดซ้าย-ขวา */
export function PhotoLightbox({ photos, startIndex, alt, onClose, catId }: Props) {
  const { t } = useI18n()
  const [index, setIndex] = useState(startIndex)
  const swipeStart = useRef<number | null>(null)
  // ปัดรูปแล้วปล่อยนิ้ว เบราว์เซอร์จะส่ง click ตามมา — ไม่ให้ไปปิดหน้าต่าง
  const justSwiped = useRef(false)
  const [reporting, setReporting] = useState(false)
  // ลบรูปแล้วรายการสั้นลง → ไม่ให้ index เกิน
  const current = Math.min(index, photos.length - 1)
  const photo = photos[current]
  const many = photos.length > 1

  const go = useCallback((delta: number) => setIndex((i) => (i + delta + photos.length) % photos.length), [photos.length])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // หน้าต่างรายงานเปิดอยู่ → ให้ Escape ปิดหน้าต่างนั้นก่อน
      if (reporting) return
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, go, reporting])

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
        className="max-h-[80%] max-w-full animate-pop-in rounded-xl object-contain shadow-2xl"
        draggable={false}
      />
      <p className="mt-3 text-sm text-white/80">
        {many && `${current + 1} / ${photos.length}`}
        {photo.uploaderName && `${many ? ' · ' : ''}${t('รูปจาก {name}', { name: photo.uploaderName })}`}
      </p>
      {catId && (
        <PhotoActions
          catId={catId}
          photo={photo}
          onReport={() => setReporting(true)}
          onDeleted={() => photos.length <= 1 && onClose()}
        />
      )}
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
      {reporting && catId && (
        // กันคลิก/ปัดในหน้าต่างรายงานไม่ให้ไปปิดหรือเลื่อนรูปข้างหลัง
        <StopEvents>
          <ReportPhotoDialog catId={catId} photoRef={photoRef(photo)} onClose={() => setReporting(false)} />
        </StopEvents>
      )}
    </div>,
    document.body,
  )
}

export function StopEvents({ children }: { children: ReactNode }) {
  return (
    <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
      {children}
    </div>
  )
}

export function PhotoActions({ catId, photo, onReport, onDeleted }: { catId: string; photo: CatPhoto; onReport: () => void; onDeleted: () => void }) {
  const { t } = useI18n()
  const { userId, isAdmin, requireLogin } = useAuth()
  const queryClient = useQueryClient()
  const likes = usePhotoLikes(catId)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ref = photoRef(photo)
  const liked = likes.liked(ref)
  const count = likes.count(ref)
  // รูปหลักลบไม่ได้ (ผูกกับหมุด) / รูปในอัลบั้มลบได้เฉพาะคนอัปโหลดหรือผู้ดูแล
  const canDelete = ref !== 'main' && userId !== null && (photo.userId === userId || isAdmin)
  const isMine = userId !== null && photo.userId === userId

  const remove = async () => {
    if (!(await confirmAction({ title: t('ลบรูปนี้?'), message: t('รูปจะหายจากอัลบั้มของน้อง'), confirmLabel: t('ลบรูป'), tone: 'danger' }))) return
    setDeleting(true)
    setError(null)
    try {
      await deleteCatPhoto(catId, photo.id)
      await queryClient.invalidateQueries({ queryKey: ['catPhotos', catId] })
      onDeleted()
    } catch (err) {
      setError(t(err instanceof Error ? err.message : 'ลบรูปไม่สำเร็จ ลองใหม่อีกครั้ง'))
    } finally {
      setDeleting(false)
    }
  }

  const button = 'flex h-10 items-center gap-1.5 rounded-full bg-white/15 px-4 text-sm font-medium text-white transition hover:bg-white/25 active:scale-95 disabled:opacity-50'
  return (
    <div className="mt-3 flex flex-col items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2">
      <button
        type="button"
        aria-pressed={liked}
        onClick={() => requireLogin(t('เข้าสู่ระบบเพื่อกดหัวใจรูป')) && likes.toggle(ref)}
        className={button}
        aria-label={t(liked ? 'เลิกถูกใจรูปนี้' : 'ถูกใจรูปนี้')}
      >
        <Heart size={18} className={liked ? 'fill-red-500 text-red-500' : ''} aria-hidden="true" />
        {count > 0 ? count : t('ถูกใจ')}
      </button>
      {!isMine && (
        <button
          type="button"
          onClick={() => requireLogin(t('เข้าสู่ระบบเพื่อรายงานรูป')) && onReport()}
          className={button}
          aria-label={t('รายงานรูปนี้')}
        >
          <Flag size={16} aria-hidden="true" />
          {t('รายงาน')}
        </button>
      )}
      {canDelete && (
        <button type="button" disabled={deleting} onClick={remove} className={button} aria-label={t('ลบรูปนี้')}>
          <Trash2 size={16} aria-hidden="true" />
          {t('ลบ')}
        </button>
      )}
      </div>
      {error && <p className="text-sm text-red-300">{error}</p>}
    </div>
  )
}
