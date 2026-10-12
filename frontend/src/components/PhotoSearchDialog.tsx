import { useMutation } from '@tanstack/react-query'
import { Camera, ImageUp, ScanSearch, SearchX } from 'lucide-react'
import { useRef, useState, type ChangeEvent } from 'react'
import { useI18n } from '../hooks/useI18n'
import { fetchCat, searchByPhoto, type Bounds } from '../lib/api'
import { UPLOAD_ACCEPT } from '../lib/device'
import type { Cat, LatLng } from '../types'
import { CatAvatar } from './CatAvatar'
import { Modal } from './ui/Modal'

interface Props {
  bounds: Bounds
  userPosition: LatLng | null
  onOpenCat: (cat: Cat) => void
  onClose: () => void
}

interface Result {
  cat: Cat
  score: number
  reason: string
  reasonEn: string
  distance: number
}

/** อัปโหลดรูปน้อง → AI หาหมุดใกล้ๆ ที่น่าจะเป็นตัวเดียวกัน (เช่น ตามหาแมวหาย) */
export function PhotoSearchDialog({ bounds, userPosition, onOpenCat, onClose }: Props) {
  const { t, lang } = useI18n()
  const uploadInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  // ค้นรอบตัวเราถ้ารู้ตำแหน่ง ไม่งั้นรอบกลางแผนที่ที่เปิดอยู่
  const center: LatLng = userPosition ?? { lat: (bounds.minLat + bounds.maxLat) / 2, lng: (bounds.minLng + bounds.maxLng) / 2 }

  const search = useMutation({
    mutationFn: async (file: File) => {
      const { compressPhoto } = await import('../lib/photo')
      const res = await searchByPhoto(await compressPhoto(file), center)
      const cats = await Promise.all(res.matches.map((m) => fetchCat(m.catId)))
      const results: Result[] = res.matches.flatMap((m, i) => (cats[i] ? [{ ...m, cat: cats[i]! }] : []))
      return { results, checked: res.checked }
    },
  })

  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (preview) URL.revokeObjectURL(preview)
    setPreview(URL.createObjectURL(file))
    search.mutate(file)
  }

  const distanceText = (m: number) =>
    m < 1000 ? t('{m} ม.', { m: Math.max(10, Math.round(m / 10) * 10) }) : t('{km} กม.', { km: (m / 1000).toFixed(1) })

  return (
    <Modal title={t('ค้นหาด้วยรูป')} onClose={onClose}>
      <p className="mb-3 text-sm text-stone-600">
        {t('ใช้รูปน้องแมวหาหมุดในรัศมีประมาณ 3 กม. ที่น่าจะเป็นตัวเดียวกัน เหมาะกับตามหาแมวหาย หรือเช็กว่ามีคนปักหมุดน้องตัวนี้ไว้แล้วหรือยัง')}
      </p>
      <div className="mb-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => cameraInput.current?.click()}
          disabled={search.isPending}
          className="flex flex-col items-center gap-1 rounded-2xl bg-orange-500 py-3 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-60"
        >
          <Camera size={22} aria-hidden="true" />
          {t('ถ่ายรูป')}
        </button>
        <button
          type="button"
          onClick={() => uploadInput.current?.click()}
          disabled={search.isPending}
          className="flex flex-col items-center gap-1 rounded-2xl bg-orange-50 py-3 text-sm font-medium text-orange-800 ring-1 ring-orange-200 hover:bg-orange-100 disabled:opacity-60"
        >
          <ImageUp size={22} aria-hidden="true" />
          {t('เลือกรูป')}
        </button>
      </div>
      <input ref={uploadInput} type="file" accept={UPLOAD_ACCEPT} hidden onChange={pick} />
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={pick} />

      {preview && (
        <div className="relative mb-4 overflow-hidden rounded-2xl bg-stone-100">
          <img src={preview} alt="" className="aspect-[4/3] w-full object-cover" />
          {search.isPending && (
            <div className="absolute inset-x-0 h-1/4 animate-[scan_1.6s_ease-in-out_infinite_alternate] bg-gradient-to-b from-transparent via-orange-400/40 to-transparent" />
          )}
        </div>
      )}

      {search.isPending && (
        <p className="flex items-center justify-center gap-2 py-2 text-sm text-stone-600">
          <ScanSearch size={18} className="text-orange-500" aria-hidden="true" />
          {t('AI กำลังเทียบกับน้องแมวแถวนี้… อาจใช้เวลาครึ่งนาที')}
        </p>
      )}
      {search.error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {t(search.error.message)}
        </p>
      )}
      {search.isSuccess && search.data.results.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-stone-600">
          <SearchX size={28} className="text-stone-400" aria-hidden="true" />
          {search.data.checked === 0
            ? t('แถวนี้ยังไม่มีหมุดน้องแมวสีใกล้เคียงกันเลย')
            : t('เทียบกับน้องแมวสีใกล้เคียง {n} ตัวแล้ว ไม่เจอตัวที่น่าจะใช่', { n: search.data.checked })}
        </div>
      )}
      {search.isSuccess && search.data.results.length > 0 && (
        <ul className="flex flex-col gap-1">
          {search.data.results.map((r) => (
            <li key={r.cat.id}>
              <button
                type="button"
                onClick={() => onOpenCat(r.cat)}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-stone-50"
              >
                <CatAvatar cat={r.cat} className="size-16 shrink-0 rounded-xl" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-stone-900">{r.cat.name}</span>
                  <span className="block text-xs text-stone-600">{lang === 'en' && r.reasonEn ? r.reasonEn : r.reason}</span>
                  <span className="text-xs text-stone-500">{distanceText(r.distance)}</span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                    r.score >= 0.7 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {t('ใช่ {n}%', { n: Math.round(r.score * 100) })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
