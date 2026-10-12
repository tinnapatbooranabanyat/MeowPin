import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MapPinned, X } from 'lucide-react'
import { useI18n } from '../hooks/useI18n'
import { useMapActions } from '../hooks/useMapActions'
import { fetchMoveRequests, rejectMove } from '../lib/api'
import { timeAgo } from '../lib/cat'
import { distanceMeters } from '../lib/geo'
import type { Cat } from '../types'

/** ตำแหน่งใหม่ที่คนอื่นเสนอ — แสดงให้คนปักหมุด/ผู้ดูแลเลือก "ดูและย้าย" หรือ "ไม่ย้าย" */
export function MoveRequests({ cat }: { cat: Cat }) {
  const { t, lang } = useI18n()
  const { moveCat } = useMapActions()
  const queryClient = useQueryClient()
  const requests = useQuery({ queryKey: ['moveRequests', cat.id], queryFn: () => fetchMoveRequests(cat.id) })
  const reject = useMutation({
    mutationFn: rejectMove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['moveRequests', cat.id] }),
  })
  const list = requests.data ?? []
  if (!list.length) return null

  return (
    <section className="animate-fade-in rounded-2xl bg-sky-50 px-4 py-3 ring-1 ring-sky-200">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-sky-900">
        <MapPinned size={16} aria-hidden="true" />
        {t('มีคนเสนอตำแหน่งใหม่ของหมุด ({n})', { n: list.length })}
      </h3>
      <ul className="mt-2 flex flex-col gap-3">
        {list.map((r) => (
          <li key={r.id} className="text-sm text-sky-950">
            <p>
              <span className="font-medium">{r.requesterName ?? t('ผู้ใช้')}</span>
              <span className="text-xs text-sky-800/80">
                {' '}
                · {timeAgo(r.createdAt, lang)} ·{' '}
                {t('ห่างจากหมุดตอนนี้ ~{m} ม.', { m: Math.round(distanceMeters(cat.position, r.position)) })}
              </span>
            </p>
            {r.note && <p className="mt-0.5 text-sky-900">“{r.note}”</p>}
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => moveCat(cat, r)}
                className="flex items-center gap-1 rounded-full bg-sky-600 px-3 py-1 text-xs font-medium text-white hover:bg-sky-700"
              >
                <MapPinned size={13} aria-hidden="true" />
                {t('ดูและย้าย')}
              </button>
              <button
                type="button"
                disabled={reject.isPending}
                onClick={() => reject.mutate(r.id)}
                className="flex items-center gap-1 rounded-full bg-surface px-3 py-1 text-xs font-medium text-stone-700 ring-1 ring-stone-300 hover:bg-stone-100 disabled:opacity-60"
              >
                <X size={13} aria-hidden="true" />
                {t('ไม่ย้าย')}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {reject.error && <p className="mt-2 text-xs text-red-700">{t(reject.error.message)}</p>}
    </section>
  )
}
