import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, ExternalLink, RotateCcw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '../../hooks/useI18n'
import { deleteCat, fetchBugReports, fetchCatReports, setCatReportsStatus, setReportStatus } from '../../lib/api'
import { CAT_REPORT_REASONS, timeAgo } from '../../lib/cat'
import { photoUrl } from '../../lib/supabase'
import type { BugReport, CatReport } from '../../types'
import { Modal } from '../ui/Modal'
import { ActivityLog } from './ActivityLog'
import { ReviewReportsList } from './ReviewReportsList'
import { UnverifiedCats } from './UnverifiedCats'
import { confirmAction } from '../../lib/dialogs'

type Tab = 'cats' | 'reviews' | 'bugs' | 'unverified' | 'activity'
type Status = 'open' | 'resolved'

const BUG_CATEGORY: Record<BugReport['category'], { label: string; className: string }> = {
  bug: { label: 'บั๊ก', className: 'bg-red-100 text-red-800' },
  idea: { label: 'ไอเดีย', className: 'bg-sky-100 text-sky-800' },
  other: { label: 'อื่นๆ', className: 'bg-stone-200 text-stone-700' },
}

interface Props {
  counts: { catReports: number; bugReports: number } | undefined
  onClose: () => void
  onOpenCat: (catId: string) => void
}

// เห็นได้เฉพาะ admin — RLS ฝั่งฐานข้อมูลกันไว้อีกชั้น คนอื่นเปิดได้ก็จะได้รายการว่าง
export function AdminDialog({ counts, onClose, onOpenCat }: Props) {
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>(counts && counts.catReports === 0 && counts.bugReports > 0 ? 'bugs' : 'cats')
  const [status, setStatus] = useState<Status>('open')

  const tabClass = (active: boolean) =>
    `flex items-center gap-1.5 border-b-2 px-1 pb-2 text-[15px] font-medium ${
      active ? 'border-orange-500 text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-700'
    }`

  return (
    <Modal title={t('จัดการรายงาน')} onClose={onClose} wide>
      <div className="no-scrollbar mb-4 flex gap-5 overflow-x-auto border-b border-stone-200">
        <button type="button" onClick={() => setTab('cats')} className={tabClass(tab === 'cats')}>
          {t('หมุดที่ถูกรายงาน')}
          {!!counts?.catReports && <Badge n={counts.catReports} />}
        </button>
        <button type="button" onClick={() => setTab('reviews')} className={tabClass(tab === 'reviews')}>
          {t('รีวิวที่ถูกรายงาน')}
        </button>
        <button type="button" onClick={() => setTab('bugs')} className={tabClass(tab === 'bugs')}>
          {t('ปัญหา / ไอเดีย')}
          {!!counts?.bugReports && <Badge n={counts.bugReports} />}
        </button>
        <button type="button" onClick={() => setTab('unverified')} className={tabClass(tab === 'unverified')}>
          {t('รอตรวจว่าเป็นแมว')}
        </button>
        <button type="button" onClick={() => setTab('activity')} className={tabClass(tab === 'activity')}>
          {t('กิจกรรม')}
        </button>
      </div>

      <div className={`mb-4 flex gap-2 ${tab === 'activity' || tab === 'unverified' ? 'hidden' : ''}`}>
        {(['open', 'resolved'] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={status === s}
            onClick={() => setStatus(s)}
            className={`h-8 rounded-full px-3.5 text-sm ring-1 ${
              status === s ? 'bg-orange-500 text-white ring-orange-500' : 'bg-surface text-stone-700 ring-stone-300'
            }`}
          >
            {s === 'open' ? t('รอดำเนินการ') : t('จัดการแล้ว')}
          </button>
        ))}
      </div>

      {tab === 'cats' && <CatReportsList status={status} onOpenCat={onOpenCat} />}
      {tab === 'reviews' && <ReviewReportsList status={status} onOpenCat={onOpenCat} />}
      {tab === 'bugs' && <BugReportsList status={status} />}
      {tab === 'unverified' && <UnverifiedCats onOpenCat={onOpenCat} />}
      {tab === 'activity' && <ActivityLog onOpenCat={onOpenCat} />}
    </Modal>
  )
}

function Badge({ n }: { n: number }) {
  return <span className="rounded-full bg-red-500 px-1.5 text-xs leading-5 font-medium text-white">{n}</span>
}

function useRefreshAdmin() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['catReports'] })
    queryClient.invalidateQueries({ queryKey: ['bugReports'] })
    queryClient.invalidateQueries({ queryKey: ['adminCounts'] })
  }
}

function CatReportsList({ status, onOpenCat }: { status: Status; onOpenCat: (catId: string) => void }) {
  const { t, lang } = useI18n()
  const refresh = useRefreshAdmin()
  const queryClient = useQueryClient()
  const reports = useQuery({ queryKey: ['catReports', status], queryFn: () => fetchCatReports(status) })

  // หลายคนรายงานหมุดเดียวกัน → รวมเป็นการ์ดเดียว เรียงตามจำนวนรายงาน
  const groups = Object.values(
    (reports.data ?? []).reduce<Record<string, CatReport[]>>((acc, r) => {
      ;(acc[r.catId] ??= []).push(r)
      return acc
    }, {}),
  ).sort((a, b) => b.length - a.length)

  const toggle = useMutation({
    mutationFn: (catId: string) => setCatReportsStatus(catId, status === 'open' ? 'resolved' : 'open'),
    onSuccess: refresh,
  })
  const remove = useMutation({
    mutationFn: deleteCat,
    onSuccess: () => {
      refresh()
      queryClient.invalidateQueries({ queryKey: ['cats'] })
    },
  })

  if (reports.isPending) return <p className="py-8 text-center text-stone-500">{t('กำลังโหลด…')}</p>
  if (reports.isError) return <p className="py-8 text-center text-red-600">{t(reports.error.message)}</p>
  if (groups.length === 0)
    return (
      <p className="py-8 text-center text-stone-500">
        {status === 'open' ? t('ไม่มีหมุดที่ถูกรายงานค้างอยู่') : t('ยังไม่มีรายงานที่จัดการแล้ว')}
      </p>
    )

  return (
    <ul className="flex flex-col gap-3">
      {groups.map((group) => {
        const first = group[0]
        const img = photoUrl(first.cat?.photoPath ?? null)
        return (
          <li key={first.catId} className="rounded-2xl p-3.5 ring-1 ring-stone-200">
            <div className="flex items-start gap-3">
              {img ? (
                <img src={img} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
              ) : (
                <div className="size-14 shrink-0 rounded-xl bg-stone-200" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-stone-900">{first.cat?.name ?? t('หมุดถูกลบแล้ว')}</p>
                <p className="truncate text-xs text-stone-500">{first.cat?.placeName}</p>
                <span className="mt-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                  {t('ถูกรายงาน {n} ครั้ง', { n: group.length })}
                </span>
              </div>
            </div>

            <ul className="mt-3 flex flex-col gap-2 border-t border-stone-100 pt-3">
              {group.map((r) => (
                <li key={r.id} className="text-sm">
                  <span className="font-medium text-stone-800">{t(CAT_REPORT_REASONS[r.reason].label)}</span>
                  <span className="text-stone-500">
                    {' · '}
                    {r.reporterName ?? t('ผู้ใช้')} · {timeAgo(r.createdAt, lang)}
                  </span>
                  {r.details && <p className="mt-0.5 whitespace-pre-wrap text-stone-700">{r.details}</p>}
                </li>
              ))}
            </ul>

            <div className="mt-3 flex flex-wrap gap-2">
              {first.cat && (
                <button
                  type="button"
                  onClick={() => onOpenCat(first.catId)}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-stone-700 ring-1 ring-stone-300 hover:bg-stone-50"
                >
                  <ExternalLink size={14} aria-hidden="true" />
                  {t('ดูบนแผนที่')}
                </button>
              )}
              <button
                type="button"
                onClick={() => toggle.mutate(first.catId)}
                disabled={toggle.isPending}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-stone-700 ring-1 ring-stone-300 hover:bg-stone-50"
              >
                {status === 'open' ? <CheckCircle2 size={14} /> : <RotateCcw size={14} />}
                {status === 'open' ? t('ตรวจแล้ว ไม่มีปัญหา') : t('เปิดใหม่')}
              </button>
              {first.cat && (
                <button
                  type="button"
                  onClick={async () => {
                    if (await confirmAction({ title: t('ลบหมุด "{name}" ถาวร?', { name: first.cat!.name }), message: t('รีวิวและประวัติการเจอจะหายไปด้วย'), confirmLabel: t('ลบหมุด'), tone: 'danger' }))
                      remove.mutate(first.catId)
                  }}
                  disabled={remove.isPending}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-red-700 ring-1 ring-red-200 hover:bg-red-50"
                >
                  <Trash2 size={14} aria-hidden="true" />
                  {t('ลบหมุด')}
                </button>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function BugReportsList({ status }: { status: Status }) {
  const { t, lang } = useI18n()
  const refresh = useRefreshAdmin()
  const reports = useQuery({ queryKey: ['bugReports', status], queryFn: () => fetchBugReports(status) })
  const toggle = useMutation({
    mutationFn: (r: BugReport) => setReportStatus(r.id, r.status === 'open' ? 'resolved' : 'open'),
    onSuccess: refresh,
  })

  if (reports.isPending) return <p className="py-8 text-center text-stone-500">{t('กำลังโหลด…')}</p>
  if (reports.isError) return <p className="py-8 text-center text-red-600">{t(reports.error.message)}</p>
  if (reports.data.length === 0)
    return (
      <p className="py-8 text-center text-stone-500">
        {status === 'open' ? t('ไม่มีรายงานค้างอยู่') : t('ยังไม่มีรายงานที่จัดการแล้ว')}
      </p>
    )

  return (
    <ul className="flex flex-col divide-y divide-stone-100">
      {reports.data.map((r) => (
        <li key={r.id} className="flex flex-col gap-2 py-3">
          <div className="flex items-center gap-2 text-xs text-stone-500">
            <span className={`rounded-full px-2 py-0.5 font-medium ${BUG_CATEGORY[r.category].className}`}>
              {t(BUG_CATEGORY[r.category].label)}
            </span>
            <span>{r.reporterName ?? t('ไม่ได้ล็อกอิน')}</span>
            <span>·</span>
            <span>{timeAgo(r.createdAt, lang)}</span>
            <button
              type="button"
              onClick={() => toggle.mutate(r)}
              disabled={toggle.isPending}
              className="ml-auto flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-stone-700 ring-1 ring-stone-300 hover:bg-stone-50"
            >
              {r.status === 'open' ? <CheckCircle2 size={14} /> : <RotateCcw size={14} />}
              {r.status === 'open' ? t('แก้แล้ว') : t('เปิดใหม่')}
            </button>
          </div>
          <p className="text-[15px] whitespace-pre-wrap text-stone-800">{r.message}</p>
          {r.pageUrl && <p className="truncate text-xs text-stone-400">{r.pageUrl}</p>}
        </li>
      ))}
    </ul>
  )
}
