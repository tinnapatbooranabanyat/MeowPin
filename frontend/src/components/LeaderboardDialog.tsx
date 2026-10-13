import { useQuery } from '@tanstack/react-query'
import { BookOpenCheck, Crown, MapPinned, Trophy } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useI18n } from '../hooks/useI18n'
import { useMapActions } from '../hooks/useMapActions'
import { fetchAreaLeaderboard, fetchZoneBoard, fetchZonesInView, type Bounds } from '../lib/api'
import { provinceLabel, zoneLabel } from '../lib/zones'
import { UserAvatar } from './account/UserAvatar'
import { Modal } from './ui/Modal'

const MEDALS = ['bg-amber-400 text-amber-950', 'bg-slate-300 text-slate-900', 'bg-orange-300 text-orange-950']
// เจ้าถิ่นต้องเจอน้องในโซนอย่างน้อยเท่านี้ตัว (ตรงกับ public.zone_mayors)
const MAYOR_MIN = 3

type Tab = 'zone' | 'points'


/** อันดับ: นักสะสมของแต่ละโซน (เขต/อำเภอ) + แต้มของคนที่ดูแลน้องในกรอบแผนที่ */
export function LeaderboardDialog({ bounds, onClose }: { bounds: Bounds; onClose: () => void }) {
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('zone')
  const tabClass = (active: boolean) =>
    `flex flex-1 items-center justify-center gap-1.5 border-b-2 pb-2.5 text-sm font-medium transition-colors ${
      active ? 'border-orange-500 text-orange-700' : 'border-transparent text-stone-500 hover:text-stone-800'
    }`

  return (
    <Modal title={t('ทาสแมวแถวนี้')} onClose={onClose}>
      <div className="mb-4 flex border-b border-stone-200" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'zone'} onClick={() => setTab('zone')} className={tabClass(tab === 'zone')}>
          <BookOpenCheck size={16} aria-hidden="true" />
          {t('นักสะสมในโซน')}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'points'} onClick={() => setTab('points')} className={tabClass(tab === 'points')}>
          <Trophy size={16} aria-hidden="true" />
          {t('แต้มในพื้นที่')}
        </button>
      </div>
      {tab === 'zone' ? <ZoneTab bounds={bounds} onClose={onClose} /> : <PointsTab bounds={bounds} onClose={onClose} />}
    </Modal>
  )
}

function ZoneTab({ bounds, onClose }: { bounds: Bounds; onClose: () => void }) {
  const { t, lang } = useI18n()
  const { userId } = useAuth()
  const zones = useQuery({ queryKey: ['zonesInView', bounds], queryFn: () => fetchZonesInView(bounds) })
  const [picked, setPicked] = useState<string | null>(null)
  const list = zones.data ?? []
  const zone = list.find((z) => z.key === picked) ?? list[0]
  const board = useQuery({
    queryKey: ['zoneBoard', zone?.key, userId],
    queryFn: () => fetchZoneBoard(zone!.key),
    enabled: Boolean(zone),
  })

  if (zones.isPending) return <p className="py-8 text-center text-sm text-stone-500">{t('กำลังโหลด…')}</p>
  if (!zone)
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-stone-500">
        <MapPinned size={28} aria-hidden="true" />
        {t('แถวนี้ยังไม่มีโซน เลื่อนแผนที่ไปที่ที่มีหมุดน้อง หรือรอสักครู่ ระบบกำลังจัดหมุดเข้าโซน')}
      </div>
    )

  const data = board.data
  const mine = data?.mine ?? 0
  const done = data && data.total > 0 && mine >= data.total
  const percent = data && data.total ? Math.round((mine / data.total) * 100) : 0

  return (
    <div>
      {list.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('เลือกโซน')}>
          {list.map((z) => (
            <button
              key={z.key}
              type="button"
              role="radio"
              aria-checked={z.key === zone.key}
              onClick={() => setPicked(z.key)}
              className={`h-8 rounded-full px-3 text-sm ring-1 ${
                z.key === zone.key ? 'bg-orange-500 font-medium text-white ring-orange-500' : 'bg-surface text-stone-700 ring-stone-300 hover:bg-orange-50'
              }`}
            >
              {zoneLabel(z, lang)}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-2xl bg-orange-50 px-4 py-3 ring-1 ring-orange-200">
        <p className="font-display text-lg text-stone-900">{zoneLabel(zone, lang)}</p>
        <p className="text-xs text-stone-600">
          {provinceLabel(zone, lang)}
          {data && <> · {t('น้องในโซนนี้ {n} ตัว', { n: data.total })}</>}
        </p>
        {userId && data && (
          <div className="mt-2.5">
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium text-stone-800">
                {done ? t('เจอครบทุกตัวแล้ว เก่งมาก!') : t('คุณเจอแล้ว {n} จาก {total} ตัว', { n: mine, total: data.total })}
              </span>
              <span className="text-xs text-stone-500">{percent}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-orange-100" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-orange-500 transition-[width] duration-500" style={{ width: `${percent}%` }} />
            </div>
          </div>
        )}
      </div>

      <p className="mt-3 mb-2 text-xs text-stone-500">
        {t('"เจอ" = ปักหมุด กดเจอ รีวิว ถ่ายรูป หรือให้อาหารน้อง นับตัวละครั้ง · อันดับ 1 ที่เจออย่างน้อย {n} ตัวได้เป็นเจ้าถิ่น', { n: MAYOR_MIN })}
      </p>
      {board.isPending && <p className="py-6 text-center text-sm text-stone-500">{t('กำลังโหลด…')}</p>}
      {data && data.top.length === 0 && <p className="py-6 text-center text-sm text-stone-500">{t('ยังไม่มีใครเจอน้องในโซนนี้ เป็นคนแรกเลยสิ')}</p>}
      <RankList
        rows={(data?.top ?? []).map((r) => ({ ...r, value: t('{n} ตัว', { n: r.collected }) }))}
        crownLabel={(i, row) => (i === 0 && row.collected >= MAYOR_MIN ? t('เจ้าถิ่น{zone}', { zone: zoneLabel(zone, lang) }) : null)}
        onClose={onClose}
      />
    </div>
  )
}

function PointsTab({ bounds, onClose }: { bounds: Bounds; onClose: () => void }) {
  const { t } = useI18n()
  const board = useQuery({ queryKey: ['leaderboard', bounds], queryFn: () => fetchAreaLeaderboard(bounds) })
  const rows = board.data ?? []

  return (
    <div>
      <p className="mb-3 text-sm text-stone-600">
        {t('นับจากน้องในแผนที่ตอนนี้ 90 วันล่าสุด — ช่วยน้องสำเร็จ 8 · ปักหมุด 5 · รีวิว 3 · รูป 2 · ยืนยันเรื่องขอความช่วยเหลือ 1–2 · เจอน้อง 1 · ให้อาหาร 1 คะแนน (เจอ/ให้อาหารตัวเดิมได้วันละครั้ง)')}
      </p>
      {board.isPending && <p className="py-8 text-center text-sm text-stone-500">{t('กำลังโหลด…')}</p>}
      {board.isSuccess && rows.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-stone-500">
          <Trophy size={28} aria-hidden="true" />
          {t('แถวนี้ยังไม่มีใครเลย เริ่มปักหมุดหรือกดเจอน้องเป็นคนแรกสิ')}
        </div>
      )}
      <RankList
        rows={rows.map((r) => ({ ...r, value: t('{n} คะแนน', { n: r.points }) }))}
        crownLabel={(i) => (i === 0 ? t('ทาสแมวประจำย่านนี้') : null)}
        onClose={onClose}
      />
    </div>
  )
}

interface RankRow {
  userId: string
  name: string
  avatarUrl: string | null
  value: string
}

function RankList<T extends RankRow>({
  rows,
  crownLabel,
  onClose,
}: {
  rows: T[]
  crownLabel: (index: number, row: T) => string | null
  onClose: () => void
}) {
  const { openProfile } = useMapActions()
  return (
    <ol className="flex flex-col gap-1">
      {rows.map((row, i) => {
        const crown = crownLabel(i, row)
        return (
          <li key={row.userId}>
            <button
              type="button"
              onClick={() => {
                onClose()
                openProfile(row.userId)
              }}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-stone-50"
            >
              <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${MEDALS[i] ?? 'bg-stone-100 text-stone-600'}`}>
                {i + 1}
              </span>
              <UserAvatar name={row.name} url={row.avatarUrl} className="size-9 text-sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-stone-900">{row.name}</span>
                {crown && (
                  <span className="flex items-center gap-1 text-xs font-medium text-amber-700">
                    <Crown size={12} aria-hidden="true" />
                    {crown}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-sm font-medium text-orange-700">{row.value}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
