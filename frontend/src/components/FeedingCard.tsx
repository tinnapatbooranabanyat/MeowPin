import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LoaderCircle, TriangleAlert, Utensils } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useI18n } from '../hooks/useI18n'
import { fetchFeedingsToday, fetchFoodInfo, recordFeeding, setFeedingReaction } from '../lib/api'
import type { Cat, Eaten, FoodInfo, FoodKind } from '../types'

const FOODS: { value: FoodKind; label: string }[] = [
  { value: 'dry', label: 'อาหารเม็ด' },
  { value: 'wet', label: 'อาหารเปียก' },
  { value: 'treat', label: 'ขนม' },
  { value: 'other', label: 'อื่นๆ' },
]
const FOOD_LABEL = Object.fromEntries(FOODS.map((f) => [f.value, f.label])) as Record<FoodKind, string>

const EATEN: { value: Eaten; label: string }[] = [
  { value: 'all', label: 'กินหมด' },
  { value: 'some', label: 'กินนิดหน่อย' },
  { value: 'none', label: 'ไม่กิน' },
]

// วันนี้ได้กินครบเท่านี้แล้ว → เตือนว่าพอแล้ว
const ENOUGH_MEALS = 3
// ต้องมีคนบอกว่ากินแค่ไหนอย่างน้อยเท่านี้ครั้ง ถึงจะสรุปว่าชอบ/ไม่ชอบ
const MIN_RATED = 2

/** ชอบแค่ไหน 0–1 (กินหมด = 1, กินนิดหน่อย = 0.5, ไม่กิน = 0) — null = ข้อมูลยังน้อยไป */
function liking(f: FoodInfo['foods'][number]) {
  const rated = f.all + f.some + f.none
  return rated >= MIN_RATED ? { score: (f.all + f.some * 0.5) / rated, rated } : null
}

/** วันนี้น้องได้กินไปกี่มื้อแล้ว + ข้อควรระวัง + น้องชอบกินอะไร + ปุ่มบันทึกว่าให้อาหาร (ไม่แสดงว่าใครให้) */
export function FeedingCard({ cat }: { cat: Cat }) {
  const { t, lang } = useI18n()
  const { userId, requireLogin } = useAuth()
  const queryClient = useQueryClient()
  const [picked, setPicked] = useState<FoodKind | null>(null)
  // เพิ่งบันทึก → ถามต่อว่าน้องกินแค่ไหน
  const [asking, setAsking] = useState(false)
  const [thanks, setThanks] = useState(false)
  const today = useQuery({
    queryKey: ['feedings', cat.id, userId],
    queryFn: () => fetchFeedingsToday(cat.id),
    refetchInterval: 5 * 60_000,
  })
  const info = useQuery({ queryKey: ['foodInfo', cat.id], queryFn: () => fetchFoodInfo(cat.id), staleTime: 60_000 })
  const record = useMutation({
    mutationFn: (food: FoodKind) => recordFeeding(cat.id, food),
    onSuccess: () => {
      setAsking(true)
      setThanks(false)
      for (const key of [['feedings', cat.id], ['foodInfo', cat.id], ['fedToday']]) queryClient.invalidateQueries({ queryKey: key })
    },
  })
  const react = useMutation({
    mutationFn: (eaten: Eaten) => setFeedingReaction(cat.id, eaten),
    onSuccess: () => {
      setAsking(false)
      setThanks(true)
      queryClient.invalidateQueries({ queryKey: ['foodInfo', cat.id] })
    },
  })

  // ยังไม่ได้รัน migration 0014 → ไม่แสดงการ์ดนี้
  if (!today.data) return null
  const { feedings, lastFedAt, mine } = today.data
  const time = lastFedAt
    ? new Date(lastFedAt).toLocaleTimeString(lang === 'th' ? 'th-TH' : 'en-GB', { hour: '2-digit', minute: '2-digit' })
    : null
  const notes = info.data?.notes.trim() ?? ''
  const rated = (info.data?.foods ?? [])
    .map((f) => ({ ...f, like: liking(f) }))
    .filter((f): f is typeof f & { like: NonNullable<ReturnType<typeof liking>> } => f.like !== null)
    .sort((a, b) => b.like.score - a.like.score)
  const favorite = rated[0] && rated[0].like.score >= 0.6 ? rated[0] : null
  const disliked = rated.filter((f) => f.like.score <= 0.3 && f !== favorite)

  return (
    <section className="rounded-2xl px-4 py-3 ring-1 ring-stone-200">
      {notes && (
        <p className="mb-2.5 flex items-start gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
          <TriangleAlert size={16} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
          <span>
            <span className="font-medium">{t('ข้อควรระวังเรื่องอาหาร:')}</span> {notes}
          </span>
        </p>
      )}
      <h3 className="flex items-center gap-1.5 text-sm font-medium text-stone-800">
        <Utensils size={15} className="text-orange-500" aria-hidden="true" />
        {feedings === 0
          ? t('วันนี้ยังไม่มีใครบันทึกว่าให้อาหาร')
          : t('วันนี้มีคนให้อาหารแล้ว {n} ครั้ง ล่าสุด {time}', { n: feedings, time: time ?? '' })}
      </h3>
      {mine && !asking && <p className="mt-0.5 text-xs text-emerald-700">{t('คุณบันทึกว่าให้อาหารน้องวันนี้แล้ว ขอบคุณนะ')}</p>}
      {feedings >= ENOUGH_MEALS && (
        <p className="mt-1 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
          {t('วันนี้น้องได้กินหลายมื้อแล้ว ระวังให้เยอะเกินจนน้องอ้วนหรือท้องเสียนะ')}
        </p>
      )}

      {/* น้องชอบกินอะไร (จากที่คนบอกว่าน้องกินแค่ไหน) */}
      {(favorite || disliked.length > 0) && (
        <div className="mt-2 rounded-lg bg-stone-50 px-2.5 py-1.5 text-xs text-stone-700">
          {favorite && (
            <p>
              {t('น้องชอบ{food} — กินหมด {all} จาก {n} ครั้ง', { food: t(FOOD_LABEL[favorite.food]), all: favorite.all, n: favorite.like.rated })}
            </p>
          )}
          {disliked.map((f) => (
            <p key={f.food} className="text-stone-500">
              {t('ไม่ค่อยกิน{food} ({n} ครั้งที่ลองให้)', { food: t(FOOD_LABEL[f.food]), n: f.like.rated })}
            </p>
          ))}
        </div>
      )}

      {asking ? (
        <div className="mt-2.5 animate-fade-in rounded-xl bg-orange-50 px-3 py-2.5 ring-1 ring-orange-200">
          <p className="text-sm font-medium text-orange-900">{t('บันทึกแล้ว น้องกินแค่ไหน?')}</p>
          <p className="text-xs text-orange-800/80">{t('ช่วยให้รู้ว่าน้องชอบกินอะไรจริงๆ')}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {EATEN.map((e) => (
              <button
                key={e.value}
                type="button"
                disabled={react.isPending}
                onClick={() => react.mutate(e.value)}
                className="h-8 rounded-full bg-surface px-3 text-sm text-stone-700 ring-1 ring-orange-200 transition hover:bg-orange-100 active:scale-95 disabled:opacity-60"
              >
                {t(e.label)}
              </button>
            ))}
            <button type="button" onClick={() => setAsking(false)} className="h-8 px-2 text-xs text-stone-500 hover:underline">
              {t('ข้าม')}
            </button>
          </div>
          {react.error && <p className="mt-1.5 text-xs text-red-700">{t(react.error.message)}</p>}
        </div>
      ) : (
        <>
          {thanks && <p className="mt-2 text-xs text-emerald-700">{t('ขอบคุณที่บอกนะ ข้อมูลนี้ช่วยคนที่มาให้อาหารครั้งหน้า')}</p>}
          <p className="mt-2 text-xs text-stone-500">{t('เพิ่งให้อาหารน้อง? กดบันทึกให้คนอื่นรู้:')}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {FOODS.map((food) => (
              <button
                key={food.value}
                type="button"
                disabled={record.isPending}
                onClick={() => {
                  if (!requireLogin(t('เข้าสู่ระบบเพื่อบันทึกว่าให้อาหารน้อง{name}', { name: cat.name }))) return
                  setPicked(food.value)
                  record.mutate(food.value)
                }}
                className="flex h-8 items-center gap-1 rounded-full px-3 text-sm text-stone-700 ring-1 ring-stone-300 transition hover:bg-orange-50 active:scale-95 disabled:opacity-60"
              >
                {record.isPending && picked === food.value && <LoaderCircle size={13} className="animate-spin" aria-hidden="true" />}
                {t(food.label)}
              </button>
            ))}
          </div>
        </>
      )}
      {record.error && <p className="mt-2 text-xs text-red-700">{t(record.error.message)}</p>}
    </section>
  )
}
