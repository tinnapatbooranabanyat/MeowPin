import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LoaderCircle, Utensils } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useI18n } from '../hooks/useI18n'
import { fetchFeedingsToday, recordFeeding } from '../lib/api'
import type { Cat, FoodKind } from '../types'

const FOODS: { value: FoodKind; label: string }[] = [
  { value: 'dry', label: 'อาหารเม็ด' },
  { value: 'wet', label: 'อาหารเปียก' },
  { value: 'treat', label: 'ขนม' },
  { value: 'other', label: 'อื่นๆ' },
]

// วันนี้ได้กินครบเท่านี้แล้ว → เตือนว่าพอแล้ว
const ENOUGH_MEALS = 3

/** วันนี้น้องได้กินไปกี่มื้อแล้ว + ปุ่มบันทึกว่าให้อาหาร (ไม่แสดงว่าใครให้) */
export function FeedingCard({ cat }: { cat: Cat }) {
  const { t, lang } = useI18n()
  const { userId, requireLogin } = useAuth()
  const queryClient = useQueryClient()
  const [picked, setPicked] = useState<FoodKind | null>(null)
  const today = useQuery({
    queryKey: ['feedings', cat.id, userId],
    queryFn: () => fetchFeedingsToday(cat.id),
    refetchInterval: 5 * 60_000,
  })
  const record = useMutation({
    mutationFn: (food: FoodKind) => recordFeeding(cat.id, food),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feedings', cat.id] }),
  })

  // ยังไม่ได้รัน migration 0014 → ไม่แสดงการ์ดนี้
  if (!today.data) return null
  const { feedings, lastFedAt, mine } = today.data
  const time = lastFedAt
    ? new Date(lastFedAt).toLocaleTimeString(lang === 'th' ? 'th-TH' : 'en-GB', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <section className="rounded-2xl px-4 py-3 ring-1 ring-stone-200">
      <h3 className="flex items-center gap-1.5 text-sm font-medium text-stone-800">
        <Utensils size={15} className="text-orange-500" aria-hidden="true" />
        {feedings === 0
          ? t('วันนี้ยังไม่มีใครบันทึกว่าให้อาหาร')
          : t('วันนี้มีคนให้อาหารแล้ว {n} ครั้ง ล่าสุด {time}', { n: feedings, time: time ?? '' })}
      </h3>
      {mine && <p className="mt-0.5 text-xs text-emerald-700">{t('คุณบันทึกว่าให้อาหารน้องวันนี้แล้ว ขอบคุณนะ')}</p>}
      {feedings >= ENOUGH_MEALS && (
        <p className="mt-1 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
          {t('วันนี้น้องได้กินหลายมื้อแล้ว ระวังให้เยอะเกินจนน้องอ้วนหรือท้องเสียนะ')}
        </p>
      )}
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
      {record.error && <p className="mt-2 text-xs text-red-700">{t(record.error.message)}</p>}
    </section>
  )
}
