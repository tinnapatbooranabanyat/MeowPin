import { useInfiniteQuery } from '@tanstack/react-query'
import { Bug, Eye, Flag, ImagePlus, LogIn, MapPinPlus, MapPinX, PawPrint, Pencil, Trash2, X, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '../../hooks/useI18n'
import { ACTIVITY_PAGE_SIZE, fetchActivity } from '../../lib/api'
import { CAT_REPORT_REASONS, timeAgo } from '../../lib/cat'
import { parseUserAgent } from '../../lib/userAgent'
import type { ActivityAction, ActivityEntry, CatReportReason } from '../../types'
import { UserAvatar } from '../account/UserAvatar'

const FILTERS: { key: string; label: string; actions: ActivityAction[] | null }[] = [
  { key: 'all', label: 'ทั้งหมด', actions: null },
  { key: 'sign_in', label: 'การเข้าสู่ระบบ', actions: ['sign_in'] },
  { key: 'cats', label: 'หมุด', actions: ['cat_create', 'cat_delete'] },
  { key: 'reviews', label: 'รีวิว', actions: ['review_create', 'review_update', 'review_delete'] },
  { key: 'photos', label: 'รูป', actions: ['photo_add'] },
  { key: 'sightings', label: 'เจอน้อง', actions: ['sighting'] },
  { key: 'reports', label: 'การรายงาน', actions: ['bug_report', 'cat_report'] },
]

// ข้อความไทยเป็น key ของ t() — {cat} คือชื่อแมว (แทนด้วยปุ่มกดเปิดหมุด)
const ACTIONS: Record<ActivityAction, { icon: LucideIcon; text: string; tone: string }> = {
  sign_in: { icon: LogIn, text: 'เข้าสู่ระบบ', tone: 'bg-sky-100 text-sky-700' },
  cat_create: { icon: MapPinPlus, text: 'ปักหมุด {cat}', tone: 'bg-orange-100 text-orange-700' },
  cat_delete: { icon: MapPinX, text: 'ลบหมุด {cat}', tone: 'bg-red-100 text-red-700' },
  review_create: { icon: PawPrint, text: 'รีวิว {cat}', tone: 'bg-amber-100 text-amber-700' },
  review_update: { icon: Pencil, text: 'แก้รีวิว {cat}', tone: 'bg-amber-100 text-amber-700' },
  review_delete: { icon: Trash2, text: 'ลบรีวิว {cat}', tone: 'bg-stone-200 text-stone-700' },
  photo_add: { icon: ImagePlus, text: 'เพิ่มรูปให้ {cat}', tone: 'bg-emerald-100 text-emerald-700' },
  sighting: { icon: Eye, text: 'กดเจอ {cat}', tone: 'bg-teal-100 text-teal-700' },
  bug_report: { icon: Bug, text: 'ส่งรายงานปัญหา / ไอเดีย', tone: 'bg-violet-100 text-violet-700' },
  cat_report: { icon: Flag, text: 'รายงานหมุด {cat}', tone: 'bg-red-100 text-red-700' },
}

const BUG_CATEGORIES: Record<string, string> = { bug: 'เจอปัญหา / บั๊ก', idea: 'เสนอไอเดีย', other: 'อื่นๆ' }

export function ActivityLog({ onOpenCat }: { onOpenCat: (catId: string) => void }) {
  const { t } = useI18n()
  const [filter, setFilter] = useState('all')
  const [user, setUser] = useState<{ id: string; name: string } | null>(null)
  const actions = FILTERS.find((f) => f.key === filter)?.actions ?? null

  const log = useInfiniteQuery({
    queryKey: ['activity', filter, user?.id ?? null],
    queryFn: ({ pageParam }) => fetchActivity({ actions, userId: user?.id ?? null, page: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.length === ACTIVITY_PAGE_SIZE ? pages.length : undefined),
  })
  const entries = log.data?.pages.flat() ?? []

  return (
    <div>
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={`h-8 shrink-0 rounded-full px-3.5 text-sm ring-1 ${
              filter === f.key ? 'bg-orange-500 text-white ring-orange-500' : 'bg-surface text-stone-700 ring-stone-300'
            }`}
          >
            {t(f.label)}
          </button>
        ))}
      </div>

      {user && (
        <div className="mb-3 flex items-center gap-2 text-sm text-stone-600">
          {t('เฉพาะกิจกรรมของ')}
          <button
            type="button"
            onClick={() => setUser(null)}
            className="flex items-center gap-1 rounded-full bg-stone-100 py-1 pr-2 pl-3 font-medium text-stone-800 hover:bg-stone-200"
          >
            {user.name}
            <X size={14} aria-label={t('ล้างตัวกรอง')} />
          </button>
        </div>
      )}

      {log.isPending && <p className="py-8 text-center text-sm text-stone-500">{t('กำลังโหลด…')}</p>}
      {log.isError && (
        <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {t(log.error.message)}
        </p>
      )}
      {log.isSuccess && entries.length === 0 && (
        <p className="py-8 text-center text-sm text-stone-500">{t('ยังไม่มีกิจกรรม')}</p>
      )}

      <ol className="flex flex-col">
        {entries.map((entry) => (
          <ActivityRow key={entry.id} entry={entry} onOpenCat={onOpenCat} onPickUser={setUser} />
        ))}
      </ol>

      {log.hasNextPage && (
        <button
          type="button"
          onClick={() => log.fetchNextPage()}
          disabled={log.isFetchingNextPage}
          className="mt-3 w-full rounded-full py-2.5 text-sm font-medium text-stone-700 ring-1 ring-stone-300 hover:bg-stone-100 disabled:opacity-60"
        >
          {t(log.isFetchingNextPage ? 'กำลังโหลด…' : 'โหลดเพิ่ม')}
        </button>
      )}
    </div>
  )
}

function ActivityRow({
  entry,
  onOpenCat,
  onPickUser,
}: {
  entry: ActivityEntry
  onOpenCat: (catId: string) => void
  onPickUser: (user: { id: string; name: string }) => void
}) {
  const { t, lang } = useI18n()
  const meta = ACTIONS[entry.action]
  const Icon = meta.icon
  const { detail } = entry
  const catName = detail.cat_name ?? t('น้องแมว')
  // แยกข้อความตรง {cat} เพื่อทำชื่อแมวเป็นปุ่ม (หมุดที่ถูกลบแล้วกดไม่ได้)
  const [before, after = ''] = t(meta.text, { cat: '\u0000' }).split('\u0000')
  const canOpen = entry.catId && entry.action !== 'cat_delete'

  const extras: string[] = []
  if (detail.paws) extras.push(t('{n} อุ้งเท้า', { n: detail.paws }))
  if (entry.action === 'review_delete' && detail.by_other) extras.push(t('ลบโดย admin'))
  if (detail.category) extras.push(t(BUG_CATEGORIES[detail.category] ?? detail.category))
  if (detail.reason) extras.push(t(CAT_REPORT_REASONS[detail.reason as CatReportReason]?.label ?? detail.reason))
  if (entry.action === 'sign_in') {
    const device = parseUserAgent(detail.user_agent ?? null)
    const name = [device.browser, device.os].filter(Boolean).join(t(' บน '))
    if (name) extras.push(name)
    const place = [detail.city, detail.country].filter(Boolean).join(', ')
    if (place) extras.push(place)
    if (detail.ip) extras.push(detail.ip)
  }

  return (
    <li className="flex gap-3 border-b border-stone-100 py-3 last:border-0">
      <div className="relative shrink-0">
        <UserAvatar name={entry.user?.name} url={entry.user?.avatarUrl} className="size-9 text-sm" />
        <span className={`absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full ring-2 ring-surface ${meta.tone}`}>
          <Icon size={11} aria-hidden="true" />
        </span>
      </div>
      <div className="min-w-0 flex-1 text-sm">
        <p className="text-stone-800">
          {entry.user ? (
            <button
              type="button"
              onClick={() => onPickUser({ id: entry.user!.id, name: entry.user!.name })}
              className="font-medium text-stone-900 hover:underline"
              title={t('ดูเฉพาะกิจกรรมของคนนี้')}
            >
              {entry.user.name}
            </button>
          ) : (
            <span className="font-medium text-stone-500">{t('ผู้ใช้ที่ไม่ได้ล็อกอิน')}</span>
          )}{' '}
          {before}
          {meta.text.includes('{cat}') &&
            (canOpen ? (
              <button type="button" onClick={() => onOpenCat(entry.catId!)} className="font-medium text-orange-700 hover:underline">
                {catName}
              </button>
            ) : (
              <span className="font-medium">{catName}</span>
            ))}
          {after}
        </p>
        {extras.length > 0 && <p className="mt-0.5 truncate text-xs text-stone-500">{extras.join(' · ')}</p>}
      </div>
      <time dateTime={entry.createdAt} className="shrink-0 text-xs text-stone-500" title={new Date(entry.createdAt).toLocaleString(lang)}>
        {timeAgo(entry.createdAt, lang)}
      </time>
    </li>
  )
}
