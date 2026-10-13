import { useQuery } from '@tanstack/react-query'
import { BookOpenCheck, Crown } from 'lucide-react'
import { useI18n } from '../../hooks/useI18n'
import { fetchCollectionStats, fetchMyCollectedCats, fetchMyZoneProgress } from '../../lib/api'
import { provinceLabel, zoneLabel } from '../../lib/zones'
import { CatAvatar } from '../CatAvatar'

/** สมุดสะสมน้องแมว: เจอมาแล้วกี่ตัว / กี่โซน / เป็นเจ้าถิ่นที่ไหน (+ โซนของฉันและน้องที่เจอ เฉพาะโปรไฟล์ตัวเอง) */
export function CollectionSection({ userId, isMe, onOpenCat }: { userId: string; isMe: boolean; onOpenCat: (catId: string) => void }) {
  const { t, lang } = useI18n()
  const stats = useQuery({ queryKey: ['collection', userId], queryFn: () => fetchCollectionStats(userId) })
  const zones = useQuery({ queryKey: ['myZones', userId], queryFn: fetchMyZoneProgress, enabled: isMe })
  const cats = useQuery({ queryKey: ['myCollected', userId], queryFn: fetchMyCollectedCats, enabled: isMe })

  // ยังไม่ได้รัน migration 0026
  if (!stats.data) return null
  const s = stats.data
  if (!s.cats && !isMe) return null

  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-stone-700">
        <BookOpenCheck size={16} className="text-orange-500" aria-hidden="true" />
        {t('สมุดสะสมน้องแมว')}
      </h3>
      <div className="grid grid-cols-3 gap-2 text-center">
        {(
          [
            [s.cats, 'ตัวที่เจอ'],
            [s.zones, 'โซน'],
            [s.completed, 'โซนที่เจอครบ'],
          ] as const
        ).map(([n, label]) => (
          <div key={label} className="rounded-xl bg-stone-50 px-2 py-2 ring-1 ring-stone-100">
            <p className="font-display text-xl text-stone-900">{n}</p>
            <p className="text-[11px] text-stone-500">{t(label)}</p>
          </div>
        ))}
      </div>

      {s.mayor.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {s.mayor.map((z) => (
            <li key={z.key} className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
              <Crown size={12} aria-hidden="true" />
              {t('เจ้าถิ่น{zone}', { zone: lang === 'en' ? z.en : z.th })}
            </li>
          ))}
        </ul>
      )}

      {isMe && (zones.data?.length ?? 0) > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {zones.data!.slice(0, 6).map((z) => {
            const percent = Math.round((z.collected / z.total) * 100)
            return (
              <li key={z.key}>
                <div className="mb-0.5 flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate text-stone-800">
                    <span className="font-medium">{zoneLabel(z, lang)}</span> <span className="text-stone-500">{provinceLabel(z, lang)}</span>
                  </span>
                  <span className="shrink-0 text-stone-500">{t('{n}/{total} ตัว', { n: z.collected, total: z.total })}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                  <div className={`h-full rounded-full ${percent >= 100 ? 'bg-emerald-500' : 'bg-orange-400'}`} style={{ width: `${percent}%` }} />
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {isMe && (cats.data?.length ?? 0) > 0 && (
        <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5">
          {cats.data!.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onOpenCat(cat.id)}
              className="flex w-16 shrink-0 flex-col items-center gap-1 text-[11px] text-stone-600"
              title={cat.name}
            >
              <CatAvatar cat={cat} className="size-14 rounded-2xl" iconSize={22} />
              <span className="w-full truncate text-center">{cat.name}</span>
            </button>
          ))}
        </div>
      )}
      {isMe && !s.cats && <p className="mt-2 text-xs text-stone-500">{t('ปักหมุด กดเจอ ถ่ายรูป หรือให้อาหารน้องตอนอยู่ที่น้อง แล้วน้องจะเข้ามาอยู่ในสมุดสะสม')}</p>}
    </section>
  )
}
