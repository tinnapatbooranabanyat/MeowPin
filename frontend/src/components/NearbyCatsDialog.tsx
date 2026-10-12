import { useQuery } from '@tanstack/react-query'
import { Footprints, HeartPulse, LocateOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useI18n } from '../hooks/useI18n'
import { fetchCatsInView } from '../lib/api'
import { furLabel, timeAgo } from '../lib/cat'
import { distanceMeters, getCurrentPosition } from '../lib/geo'
import type { Cat, LatLng } from '../types'
import { CatAvatar } from './CatAvatar'
import { Modal } from './ui/Modal'

const RADIUS_M = 2000
// เดินปกติราว 80 ม./นาที
const WALK_M_PER_MIN = 80

interface Props {
  userPosition: LatLng | null
  onPosition: (position: LatLng) => void
  onOpenCat: (cat: Cat) => void
  onClose: () => void
}

/** น้องแมวในรัศมี 2 กม. จากตำแหน่งของเรา เรียงจากใกล้ไปไกล */
export function NearbyCatsDialog({ userPosition, onPosition, onOpenCat, onClose }: Props) {
  const { t, lang } = useI18n()
  const [locating, setLocating] = useState(userPosition === null)
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    if (userPosition) return
    let cancelled = false
    getCurrentPosition().then((fix) => {
      if (cancelled) return
      setLocating(false)
      if (fix) onPosition(fix.position)
      else setDenied(true)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- หาตำแหน่งครั้งเดียวตอนเปิด
  }, [])

  const nearby = useQuery({
    queryKey: ['nearbyCats', userPosition && `${userPosition.lat.toFixed(3)},${userPosition.lng.toFixed(3)}`],
    enabled: userPosition !== null,
    queryFn: async () => {
      const pad = 0.02 // ~2.2 กม.
      const here = userPosition!
      const cats = await fetchCatsInView({
        minLat: here.lat - pad,
        maxLat: here.lat + pad,
        minLng: here.lng - pad,
        maxLng: here.lng + pad,
      })
      return cats
        .map((cat) => ({ cat, distance: distanceMeters(here, cat.position) }))
        .filter((c) => c.distance <= RADIUS_M)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 40)
    },
  })

  const distanceText = (m: number) =>
    m < 1000 ? t('{m} ม.', { m: Math.max(10, Math.round(m / 10) * 10) }) : t('{km} กม.', { km: (m / 1000).toFixed(1) })

  return (
    <Modal title={t('แมวใกล้ฉัน')} onClose={onClose}>
      {(locating || (userPosition && nearby.isPending)) && (
        <p className="py-8 text-center text-sm text-stone-500">{t(locating ? 'กำลังหาตำแหน่งของคุณ…' : 'กำลังโหลด…')}</p>
      )}
      {denied && (
        <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-stone-600">
          <LocateOff size={28} className="text-stone-400" aria-hidden="true" />
          {t('หาตำแหน่งของคุณไม่ได้ เปิดสิทธิ์เข้าถึงตำแหน่งให้เว็บนี้แล้วลองใหม่')}
        </div>
      )}
      {nearby.isSuccess && nearby.data.length === 0 && (
        <p className="py-8 text-center text-sm text-stone-500">{t('ยังไม่มีน้องแมวที่ปักหมุดไว้ในรัศมี 2 กม. ปักหมุดตัวแรกเลยไหม?')}</p>
      )}
      {nearby.isSuccess && nearby.data.length > 0 && (
        <>
          <p className="mb-3 text-sm text-stone-600">{t('{n} ตัวในรัศมี 2 กม.', { n: nearby.data.length })}</p>
          <ul className="flex flex-col">
            {nearby.data.map(({ cat, distance }) => (
              <li key={cat.id}>
                <button
                  type="button"
                  onClick={() => onOpenCat(cat)}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-stone-50"
                >
                  <CatAvatar cat={cat} className="size-14 shrink-0 rounded-xl" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 font-medium text-stone-900">
                      <span className="truncate">{cat.name}</span>
                      {cat.helpKinds.length > 0 && <HeartPulse size={14} className="shrink-0 text-red-600" aria-label={t('ต้องการความช่วยเหลือ')} />}
                    </span>
                    <span className="block truncate text-xs text-stone-500">
                      {t(furLabel(cat))} · {t('เจอล่าสุด {when}', { when: timeAgo(cat.lastSeenAt, lang) })}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-medium text-stone-800">{distanceText(distance)}</span>
                    <span className="flex items-center justify-end gap-0.5 text-[11px] text-stone-500">
                      <Footprints size={11} aria-hidden="true" />
                      {t('{n} นาที', { n: Math.max(1, Math.round(distance / WALK_M_PER_MIN)) })}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  )
}
