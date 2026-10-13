import { ArrowLeft, ChevronLeft, ChevronRight, Heart, ImagePlus, LoaderCircle, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAddCatPhotos } from '../hooks/useAddCatPhotos'
import { useI18n } from '../hooks/useI18n'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { usePhotoLikes } from '../hooks/usePhotoLikes'
import { photoRef } from '../lib/api'
import type { Cat, CatPhoto } from '../types'
import { PhotoActions, StopEvents } from './PhotoLightbox'
import { ReportPhotoDialog } from './ReportPhotoDialog'

interface Props {
  cat: Cat
  photos: CatPhoto[]
  /** รูปที่เปิดก่อน (คอมเปิดรูปนี้ทันที / มือถือ null = เริ่มที่ตารางรูป) */
  startIndex: number | null
  onClose: () => void
}

/**
 * ดูรูปทั้งหมดของน้อง — คอม: รายการรูปด้านซ้าย + รูปใหญ่ด้านขวา / มือถือ: ตารางรูป แตะแล้วดูเต็มจอ
 * มีปุ่ม "เพิ่มรูปภาพ" (ไม่ต้องรีวิว) หัวใจ รายงาน และลบรูปของตัวเอง
 */
export function PhotoBrowser({ cat, photos, startIndex, onClose }: Props) {
  const { t, lang } = useI18n()
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const [selected, setSelected] = useState<number | null>(startIndex ?? (isDesktop ? 0 : null))
  const [reporting, setReporting] = useState(false)
  const swipeStart = useRef<number | null>(null)
  const add = useAddCatPhotos(cat)
  const likes = usePhotoLikes(cat.id)
  // คอมต้องมีรูปที่เลือกเสมอ / ลบรูปแล้วรายการสั้นลง → ไม่ให้เกิน
  const index = selected === null ? (isDesktop ? 0 : null) : Math.min(selected, photos.length - 1)
  const photo = index === null ? null : photos[index]
  const dateFmt = new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  const go = useCallback(
    (delta: number) => setSelected((i) => ((i ?? 0) + delta + photos.length) % photos.length),
    [photos.length],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (reporting) return
      if (e.key === 'Escape') {
        // มือถือ: ดูรูปอยู่ → กลับไปตารางรูปก่อน
        if (!isDesktop && selected !== null) setSelected(null)
        else onClose()
      }
      if (index !== null && e.key === 'ArrowRight') go(1)
      if (index !== null && e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, go, reporting, isDesktop, selected, index])

  const viewer = photo && (
    <div
      // min-w-0 + overflow-hidden: รูปใหญ่มาก (กว้างหลายพันพิกเซล) ต้องไม่ดันพื้นที่ให้กว้างเกินจอ (Safari)
      // พื้นหลังโปร่งแสง เห็นแผนที่ด้านหลังจางๆ
      className="relative flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center overflow-hidden bg-black/55 p-4 backdrop-blur-sm"
      // ปัดซ้าย-ขวาเพื่อเปลี่ยนรูป (มือถือ)
      onPointerDown={(e) => (swipeStart.current = e.clientX)}
      onPointerUp={(e) => {
        const dx = swipeStart.current === null ? 0 : e.clientX - swipeStart.current
        swipeStart.current = null
        if (photos.length > 1 && Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
      }}
    >
      {/* ใครถ่าย / เมื่อไหร่ */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 rounded-2xl bg-black/60 px-3 py-2 text-white backdrop-blur">
        {!isDesktop && (
          <button type="button" onClick={() => setSelected(null)} className="-ml-1 rounded-full p-1 hover:bg-white/15" aria-label={t('กลับไปรายการรูป')}>
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{photo.uploaderName ?? t('ผู้ใช้')}</p>
          <p className="text-xs text-white/70">
            {index! + 1} / {photos.length}
            {photo.createdAt && ` · ${dateFmt.format(new Date(photo.createdAt))}`}
            {photo.id === 'main' && ` · ${t('รูปตอนปักหมุด')}`}
          </p>
        </div>
      </div>
      <img
        key={photo.id}
        src={photo.url}
        alt={cat.name}
        className="max-h-[calc(100%-5rem)] min-h-0 max-w-full animate-fade-in rounded-lg object-contain"
        draggable={false}
      />
      <PhotoActions catId={cat.id} photo={photo} onReport={() => setReporting(true)} onDeleted={() => setSelected((i) => (i ? i - 1 : 0))} />
      {photos.length > 1 && (
        <>
          <NavButton side="left" onClick={() => go(-1)} label={t('รูปก่อนหน้า')} />
          <NavButton side="right" onClick={() => go(1)} label={t('รูปถัดไป')} />
        </>
      )}
    </div>
  )

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('รูปทั้งหมดของ {name} ({n})', { name: cat.name, n: photos.length })}
      className="pointer-events-auto fixed inset-0 z-[60] flex animate-fade-in"
    >
      {add.input}

      {/* ── รายการรูป ── */}
      <aside className={`${isDesktop ? 'w-[340px] shrink-0' : index !== null ? 'hidden' : 'w-full'} flex flex-col bg-surface`}>
        <div className="flex items-center gap-2 px-4 pt-4 pb-3">
          <button type="button" onClick={onClose} className="-ml-1.5 rounded-full p-1.5 text-stone-600 hover:bg-stone-100" aria-label={t('ปิด')}>
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0">
            <h2 className="truncate font-display text-lg text-stone-900">{t('รูปของน้อง{name}', { name: cat.name })}</h2>
            <p className="text-xs text-stone-500">{t('{n} รูป', { n: photos.length })}</p>
          </div>
        </div>
        <div className="px-4 pb-3">
          <button
            type="button"
            onClick={add.pick}
            disabled={add.progress !== null}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-orange-500 text-sm font-medium text-white shadow-sm transition hover:bg-orange-600 active:scale-[0.98] disabled:opacity-70"
          >
            {add.progress ? (
              <>
                <LoaderCircle size={17} className="animate-spin" aria-hidden="true" />
                {t('กำลังอัปโหลด {done}/{total}', { done: Math.min(add.progress.done + 1, add.progress.total), total: add.progress.total })}
              </>
            ) : (
              <>
                <ImagePlus size={17} aria-hidden="true" />
                {t('เพิ่มรูปภาพ')}
              </>
            )}
          </button>
          {add.message && (
            <p className={`mt-2 text-xs ${add.message.tone === 'ok' ? 'text-emerald-700' : 'text-red-700'}`}>{add.message.text}</p>
          )}
        </div>
        {/* pt-1.5: เว้นที่ให้กรอบส้มของรูปที่เลือก ไม่โดนขอบบนตัด */}
        <ul className="thin-scrollbar grid flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto px-4 pt-1.5 pb-4">
          {photos.map((p, i) => {
            const count = likes.count(photoRef(p))
            const active = index === i
            return (
              <li key={p.id} className={i === 0 ? 'col-span-2' : ''}>
                <button
                  type="button"
                  onClick={() => setSelected(i)}
                  aria-current={active}
                  className={`group relative block w-full overflow-hidden rounded-xl bg-stone-200 ${i === 0 ? 'aspect-[16/10]' : 'aspect-square'} ${
                    active ? 'ring-3 ring-orange-500 ring-offset-2 ring-offset-surface' : ''
                  }`}
                >
                  <img src={p.url} alt="" loading="lazy" className="size-full object-cover transition duration-300 group-hover:scale-105" />
                  {count > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex items-center gap-0.5 rounded-full bg-black/55 px-1.5 py-0.5 text-xs font-medium text-white backdrop-blur">
                      <Heart size={11} className="fill-red-500 text-red-500" aria-hidden="true" />
                      {count}
                    </span>
                  )}
                  {p.uploaderName && (
                    <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 pt-4 pb-1.5 text-left text-xs text-white">
                      {p.uploaderName}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </aside>

      {/* ── รูปใหญ่ ── */}
      {viewer}

      {isDesktop && (
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 flex size-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
          aria-label={t('ปิด')}
        >
          <X size={22} />
        </button>
      )}

      {reporting && photo && (
        <StopEvents>
          <ReportPhotoDialog catId={cat.id} photoRef={photoRef(photo)} onClose={() => setReporting(false)} />
        </StopEvents>
      )}
    </div>,
    document.body,
  )
}

function NavButton({ side, onClick, label }: { side: 'left' | 'right'; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`absolute top-1/2 ${side === 'left' ? 'left-3' : 'right-3'} flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 active:scale-90`}
      aria-label={label}
    >
      {side === 'left' ? <ChevronLeft size={26} /> : <ChevronRight size={26} />}
    </button>
  )
}
