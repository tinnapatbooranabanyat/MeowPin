import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, ExternalLink, ImageOff, Trash2 } from 'lucide-react'
import { useI18n } from '../../hooks/useI18n'
import { deleteCatPhoto, fetchPhotoReports, setPhotoReportStatus } from '../../lib/api'
import { PHOTO_REPORT_REASONS, timeAgo } from '../../lib/cat'
import { confirmAction } from '../../lib/dialogs'
import type { PhotoReport } from '../../types'

/** รูปที่ถูกรายงาน — ลบรูป หรือปิดรายงานถ้าไม่มีปัญหา (รูปหลักลบได้ด้วยการลบหมุด) */
export function PhotoReportsList({ status, onOpenCat }: { status: 'open' | 'resolved'; onOpenCat: (catId: string) => void }) {
  const { t, lang } = useI18n()
  const queryClient = useQueryClient()
  const reports = useQuery({ queryKey: ['photoReports', status], queryFn: () => fetchPhotoReports(status) })
  const refresh = () => {
    for (const key of ['photoReports', 'catPhotos', 'adminCounts']) queryClient.invalidateQueries({ queryKey: [key] })
  }
  const resolve = useMutation({
    mutationFn: (ids: string[]) => setPhotoReportStatus(ids, status === 'open' ? 'resolved' : 'open'),
    onSuccess: refresh,
  })
  const remove = useMutation({
    mutationFn: (r: PhotoReport) => deleteCatPhoto(r.catId, r.photoRef),
    onSuccess: refresh,
  })

  if (reports.isPending) return <p className="py-8 text-center text-sm text-stone-500">{t('กำลังโหลด…')}</p>
  // รวมรายงานของรูปเดียวกัน — รูปที่ถูกรายงานหลายคนขึ้นก่อน
  const groups = Object.values(
    (reports.data ?? []).reduce<Record<string, PhotoReport[]>>((acc, r) => {
      ;(acc[`${r.catId}:${r.photoRef}`] ??= []).push(r)
      return acc
    }, {}),
  ).sort((a, b) => b.length - a.length)
  if (!groups.length) return <p className="py-8 text-center text-sm text-stone-500">{t('ไม่มีรูปที่ถูกรายงาน')}</p>

  return (
    <ul className="flex flex-col gap-3">
      {groups.map((group) => {
        const first = group[0]
        const main = first.photoRef === 'main'
        return (
          <li key={`${first.catId}:${first.photoRef}`} className="flex gap-3 rounded-2xl p-3 ring-1 ring-stone-200">
            <div className="size-24 shrink-0 overflow-hidden rounded-xl bg-stone-200">
              {first.photoUrl ? (
                <img src={first.photoUrl} alt="" loading="lazy" className="size-full object-cover" />
              ) : (
                <div className="flex size-full items-center justify-center text-stone-400">
                  <ImageOff size={24} aria-label={t('รูปถูกลบแล้ว')} />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-stone-500">
                {t(main ? 'รูปหลักของน้อง{cat}' : 'รูปในอัลบั้มของน้อง{cat}', { cat: first.catName ?? '' })}
                {first.uploaderName && <> · {t('รูปจาก {name}', { name: first.uploaderName })}</>}
              </p>
              <ul className="mt-1 flex flex-col gap-0.5 text-xs text-stone-600">
                {group.map((r) => (
                  <li key={r.id}>
                    <span className="font-medium text-red-700">{t(PHOTO_REPORT_REASONS[r.reason] ?? r.reason)}</span>
                    {r.details && <> — {r.details}</>} · {r.reporterName ?? t('ผู้ใช้')} · {timeAgo(r.createdAt, lang)}
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {!main && first.photoUrl && (
                  <button
                    type="button"
                    disabled={remove.isPending}
                    onClick={async () =>
                      (await confirmAction({ title: t('ลบรูปนี้?'), message: t('รูปจะหายจากอัลบั้มของน้อง'), confirmLabel: t('ลบรูป'), tone: 'danger' })) &&
                      remove.mutate(first)
                    }
                    className="flex items-center gap-1 rounded-full bg-red-600 px-3 py-1 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    {t('ลบรูป')}
                  </button>
                )}
                <button
                  type="button"
                  disabled={resolve.isPending}
                  onClick={() => resolve.mutate(group.map((r) => r.id))}
                  className="flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50 disabled:opacity-60"
                >
                  <CheckCircle2 size={14} aria-hidden="true" />
                  {t(status === 'open' ? 'ไม่มีปัญหา ปิดรายงาน' : 'เปิดรายงานอีกครั้ง')}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenCat(first.catId)}
                  className="flex items-center gap-1 rounded-full px-3 py-1 text-sm text-stone-700 ring-1 ring-stone-300 hover:bg-stone-100"
                >
                  <ExternalLink size={14} aria-hidden="true" />
                  {t('เปิดหมุด')}
                </button>
              </div>
              {main && <p className="mt-1.5 text-xs text-stone-500">{t('รูปหลักลบแยกไม่ได้ ถ้ารูปมีปัญหาให้ลบหมุดจากหน้าน้อง')}</p>}
              {remove.error && <p className="mt-1.5 text-xs text-red-700">{t(remove.error.message)}</p>}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
