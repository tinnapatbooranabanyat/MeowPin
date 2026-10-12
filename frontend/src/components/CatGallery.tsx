import { Heart, ImagePlus, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { useAddCatPhotos } from '../hooks/useAddCatPhotos'
import { useI18n } from '../hooks/useI18n'
import { usePhotoLikes } from '../hooks/usePhotoLikes'
import { photoRef } from '../lib/api'
import type { Cat, CatPhoto } from '../types'
import { PhotoLightbox } from './PhotoLightbox'
import { Modal } from './ui/Modal'

interface Props {
  cat: Cat
  photos: CatPhoto[]
  onClose: () => void
}

/** อัลบั้มรูปทั้งหมดของแมว — กดรูปเพื่อดูเต็มจอ / เพิ่มรูปได้โดยไม่ต้องรีวิว */
export function CatGallery({ cat, photos, onClose }: Props) {
  const { t } = useI18n()
  const [open, setOpen] = useState<number | null>(null)
  const add = useAddCatPhotos(cat)
  const likes = usePhotoLikes(cat.id)

  return (
    <>
      <Modal title={t('รูปทั้งหมดของ {name} ({n})', { name: cat.name, n: photos.length })} onClose={onClose} wide>
        {add.input}
        {add.message && (
          <p className={`mb-3 rounded-xl px-3.5 py-2.5 text-sm ${add.message.tone === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
            {add.message.text}
          </p>
        )}
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <li>
            <AddPhotoTile onClick={add.pick} progress={add.progress} className="aspect-square w-full" />
          </li>
          {photos.map((photo, i) => {
            const count = likes.count(photoRef(photo))
            return (
              <li key={photo.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
                <button
                  type="button"
                  onClick={() => setOpen(i)}
                  className="group relative block aspect-square w-full overflow-hidden rounded-xl bg-stone-200"
                >
                  <img
                    src={photo.url}
                    alt=""
                    loading="lazy"
                    className="size-full object-cover transition duration-300 group-hover:scale-105"
                  />
                  {count > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex items-center gap-0.5 rounded-full bg-black/55 px-1.5 py-0.5 text-xs font-medium text-white backdrop-blur">
                      <Heart size={11} className="fill-red-500 text-red-500" aria-hidden="true" />
                      {count}
                    </span>
                  )}
                  {photo.uploaderName && (
                    <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 pt-4 pb-1.5 text-left text-xs text-white">
                      {photo.uploaderName}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </Modal>
      {open !== null && (
        <PhotoLightbox photos={photos} startIndex={open} alt={cat.name} catId={cat.id} onClose={() => setOpen(null)} />
      )}
    </>
  )
}

/** ช่อง "เพิ่มรูป" แบบเส้นประ — ใช้ทั้งในหน้าน้องและในอัลบั้ม */
export function AddPhotoTile({
  onClick,
  progress,
  className = '',
}: {
  onClick: () => void
  progress: { done: number; total: number } | null
  className?: string
}) {
  const { t } = useI18n()
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={progress !== null}
      className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-stone-300 text-xs font-medium text-stone-600 transition hover:border-orange-400 hover:bg-orange-50 hover:text-orange-700 active:scale-95 disabled:cursor-wait ${className}`}
    >
      {progress ? (
        <>
          <LoaderCircle size={22} className="animate-spin text-orange-500" aria-hidden="true" />
          {t('กำลังอัปโหลด {done}/{total}', { done: Math.min(progress.done + 1, progress.total), total: progress.total })}
        </>
      ) : (
        <>
          <ImagePlus size={22} aria-hidden="true" />
          {t('เพิ่มรูป')}
        </>
      )}
    </button>
  )
}
