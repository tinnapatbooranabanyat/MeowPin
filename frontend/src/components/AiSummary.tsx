import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useI18n } from '../hooks/useI18n'
import { fetchCatSummary, requestCatSummary } from '../lib/api'
import type { Cat } from '../types'

// ต้องตรงกับ backend: สรุปเมื่อมีรีวิวอย่างน้อย 3 รีวิว และอ่านแค่ 30 รีวิวล่าสุด
const MIN_REVIEWS = 3
const MAX_REVIEWS = 30

/** การ์ดสรุปน้องแมวด้วย AI — ไม่มีอะไรจะแสดงก็ซ่อนทั้งการ์ด */
export function AiSummary({ cat }: { cat: Cat }) {
  const { t, lang } = useI18n()
  const queryClient = useQueryClient()
  const queryKey = ['catSummary', cat.id]
  const summary = useQuery({ queryKey, queryFn: () => fetchCatSummary(cat.id), staleTime: 5 * 60_000 })
  const refresh = useMutation({
    mutationFn: () => requestCatSummary(cat.id),
    onSuccess: (fresh) => {
      if (fresh) queryClient.setQueryData(queryKey, fresh)
    },
  })

  const expected = Math.min(cat.reviewCount, MAX_REVIEWS)
  const stale = summary.isSuccess && expected >= MIN_REVIEWS && summary.data?.reviewCount !== expected
  // ขอสรุปใหม่ครั้งเดียวต่อจำนวนรีวิว — backend อาจคืนของเดิม (ติด cooldown) ก็ไม่ขอวนซ้ำ
  const requested = useRef<string | null>(null)
  const { mutate } = refresh
  useEffect(() => {
    const key = `${cat.id}:${expected}`
    if (!stale || requested.current === key) return
    requested.current = key
    mutate()
  }, [stale, cat.id, expected, mutate])

  const data = summary.data
  if (!data) {
    if (!refresh.isPending) return null
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-orange-50 px-4 py-3 text-sm text-orange-800 ring-1 ring-orange-200">
        <Sparkles size={16} className="animate-pulse" aria-hidden="true" />
        {t('AI กำลังสรุปจากรีวิว…')}
      </div>
    )
  }

  return (
    <section className="animate-fade-in rounded-2xl bg-orange-50 px-4 py-3 ring-1 ring-orange-200">
      <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-orange-800">
        <Sparkles size={14} className={refresh.isPending ? 'animate-pulse' : undefined} aria-hidden="true" />
        {t('สรุปโดย AI จาก {n} รีวิว', { n: data.reviewCount })}
      </h3>
      <p className="text-[15px] leading-relaxed text-stone-800">{lang === 'en' ? data.en : data.th}</p>
      <p className="mt-2 text-[11px] text-stone-500">{t('สรุปอัตโนมัติ อาจไม่ถูกต้องทั้งหมด')}</p>
    </section>
  )
}
