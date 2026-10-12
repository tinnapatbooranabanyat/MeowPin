import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, ExternalLink, Trash2 } from 'lucide-react'
import { useI18n } from '../../hooks/useI18n'
import { deleteReview, fetchReviewReports, setReviewReportStatus } from '../../lib/api'
import { timeAgo } from '../../lib/cat'

const REASON_LABEL: Record<string, string> = {
  spam: 'สแปม / โฆษณา',
  inappropriate: 'หยาบคายหรือไม่เหมาะสม',
  harassment: 'กลั่นแกล้งหรือคุกคามคนอื่น',
  false_info: 'ข้อมูลเท็จ',
  other: 'อื่นๆ',
}

/** รีวิวที่ถูกรายงาน — ลบรีวิว หรือปิดรายงานถ้าไม่มีปัญหา */
export function ReviewReportsList({ status, onOpenCat }: { status: 'open' | 'resolved'; onOpenCat: (catId: string) => void }) {
  const { t, lang } = useI18n()
  const queryClient = useQueryClient()
  const reports = useQuery({ queryKey: ['reviewReports', status], queryFn: () => fetchReviewReports(status) })
  const refresh = () => {
    for (const key of ['reviewReports', 'reviews', 'adminCounts']) queryClient.invalidateQueries({ queryKey: [key] })
  }
  const resolve = useMutation({
    mutationFn: (ids: string[]) => setReviewReportStatus(ids, status === 'open' ? 'resolved' : 'open'),
    onSuccess: refresh,
  })
  const remove = useMutation({ mutationFn: deleteReview, onSuccess: refresh })

  if (reports.isPending) return <p className="py-8 text-center text-sm text-stone-500">{t('กำลังโหลด…')}</p>
  const groups = Object.values(
    (reports.data ?? []).reduce<Record<string, NonNullable<typeof reports.data>>>((acc, r) => {
      ;(acc[r.reviewId] ??= []).push(r)
      return acc
    }, {}),
  ).sort((a, b) => b.length - a.length)
  if (!groups.length) return <p className="py-8 text-center text-sm text-stone-500">{t('ไม่มีรีวิวที่ถูกรายงาน')}</p>

  return (
    <ul className="flex flex-col gap-3">
      {groups.map((group) => {
        const first = group[0]
        return (
          <li key={first.reviewId} className="rounded-2xl p-3 ring-1 ring-stone-200">
            <p className="text-xs text-stone-500">
              {t('รีวิวของ {name} ที่น้อง{cat}', { name: first.authorName ?? t('ผู้ใช้'), cat: first.catName ?? '' })} ·{' '}
              {t('{n} อุ้งเท้า', { n: first.paws ?? '?' })}
            </p>
            <p className="mt-1 rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-800">{first.comment || t('(ไม่มีข้อความ)')}</p>
            <ul className="mt-2 flex flex-col gap-0.5 text-xs text-stone-600">
              {group.map((r) => (
                <li key={r.id}>
                  <span className="font-medium text-red-700">{t(REASON_LABEL[r.reason] ?? r.reason)}</span>
                  {r.details && <> — {r.details}</>} · {r.reporterName ?? t('ผู้ใช้')} · {timeAgo(r.createdAt, lang)}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={remove.isPending}
                onClick={() => window.confirm(t('ลบรีวิวนี้?')) && remove.mutate(first.reviewId)}
                className="flex items-center gap-1 rounded-full bg-red-600 px-3 py-1 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                <Trash2 size={14} aria-hidden="true" />
                {t('ลบรีวิว')}
              </button>
              <button
                type="button"
                disabled={resolve.isPending}
                onClick={() => resolve.mutate(group.map((r) => r.id))}
                className="flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50 disabled:opacity-60"
              >
                <CheckCircle2 size={14} aria-hidden="true" />
                {t(status === 'open' ? 'ไม่มีปัญหา ปิดรายงาน' : 'เปิดรายงานอีกครั้ง')}
              </button>
              {first.catId && (
                <button
                  type="button"
                  onClick={() => onOpenCat(first.catId!)}
                  className="flex items-center gap-1 rounded-full px-3 py-1 text-sm text-stone-700 ring-1 ring-stone-300 hover:bg-stone-100"
                >
                  <ExternalLink size={14} aria-hidden="true" />
                  {t('เปิดหมุด')}
                </button>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
