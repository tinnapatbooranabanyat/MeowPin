import { Eye, LoaderCircle, Plus } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '../../hooks/useI18n'
import { furLabel } from '../../lib/cat'
import type { Cat } from '../../types'
import { CatAvatar } from '../CatAvatar'

export interface NearbyCat {
  cat: Cat
  distance: number
  sameColor: boolean
}

interface Props {
  nearby: NearbyCat[]
  photoUrl: string
  busy: boolean
  error: string | null
  onSame: (cat: Cat, addPhoto: boolean) => void
  onNew: () => void
}

/** ก่อนปักหมุดใหม่: แถวนี้มีน้องที่ปักไว้แล้ว — ใช่ตัวเดียวกันไหม (ถ้าใช่ บันทึกว่าเจอแทน แผนที่จะได้ไม่มีหมุดซ้ำ) */
export function NearbyMatch({ nearby, photoUrl, busy, error, onSame, onNew }: Props) {
  const { t } = useI18n()
  const [addPhoto, setAddPhoto] = useState(true)
  const [picked, setPicked] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <img src={photoUrl} alt="" className="size-16 shrink-0 rounded-2xl object-cover" />
        <div>
          <p className="font-medium text-stone-900">{t('แถวนี้มีน้องที่ปักหมุดไว้แล้ว')}</p>
          <p className="text-sm text-stone-600">{t('ใช่ตัวเดียวกับในรูปไหม? ถ้าใช่ จะบันทึกว่าคุณเจอน้องแทนการปักหมุดซ้ำ')}</p>
        </div>
      </div>

      <ul className="flex flex-col gap-2">
        {nearby.map(({ cat, distance, sameColor }) => (
          <li key={cat.id} className="flex items-center gap-3 rounded-2xl p-2.5 ring-1 ring-stone-200">
            <CatAvatar cat={cat} className="size-14 rounded-xl" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-stone-900">{cat.name}</p>
              <p className="truncate text-xs text-stone-500">
                {t(furLabel(cat))} · {t('ห่าง {m} ม.', { m: Math.max(1, Math.round(distance)) })}
                {sameColor && <span className="ml-1 font-medium text-orange-700">· {t('สีเดียวกัน')}</span>}
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setPicked(cat.id)
                onSame(cat, addPhoto)
              }}
              className="flex shrink-0 items-center gap-1 rounded-full bg-orange-500 px-3.5 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-60"
            >
              {busy && picked === cat.id ? (
                <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />
              ) : (
                <Eye size={15} aria-hidden="true" />
              )}
              {t('ใช่ตัวนี้')}
            </button>
          </li>
        ))}
      </ul>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-700">
        <input
          type="checkbox"
          checked={addPhoto}
          onChange={(e) => setAddPhoto(e.target.checked)}
          className="size-4 accent-orange-500"
        />
        {t('เพิ่มรูปนี้เข้าอัลบั้มของน้องด้วย')}
      </label>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={onNew}
        className="flex h-12 items-center justify-center gap-1.5 rounded-full font-medium text-stone-700 ring-1 ring-stone-300 hover:bg-stone-100 disabled:opacity-60"
      >
        <Plus size={18} aria-hidden="true" />
        {t('ไม่ใช่ เป็นน้องตัวใหม่')}
      </button>
    </div>
  )
}
