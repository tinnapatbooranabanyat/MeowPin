import { useState } from 'react'
import { useI18n } from '../hooks/useI18n'
import type { CatPhoto } from '../types'
import { PhotoLightbox } from './PhotoLightbox'
import { Modal } from './ui/Modal'

interface Props {
  name: string
  photos: CatPhoto[]
  onClose: () => void
}

/** อัลบั้มรูปทั้งหมดของแมว — กดรูปเพื่อดูเต็มจอ */
export function CatGallery({ name, photos, onClose }: Props) {
  const { t } = useI18n()
  const [open, setOpen] = useState<number | null>(null)

  return (
    <>
      <Modal title={t('รูปทั้งหมดของ {name} ({n})', { name, n: photos.length })} onClose={onClose} wide>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {photos.map((photo, i) => (
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
                {photo.uploaderName && (
                  <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 pt-4 pb-1.5 text-left text-xs text-white">
                    {photo.uploaderName}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </Modal>
      {open !== null && <PhotoLightbox photos={photos} startIndex={open} alt={name} onClose={() => setOpen(null)} />}
    </>
  )
}
