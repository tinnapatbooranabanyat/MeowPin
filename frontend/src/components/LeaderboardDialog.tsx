import { useQuery } from '@tanstack/react-query'
import { Crown, Globe2, Trophy } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useI18n } from '../hooks/useI18n'
import { useMapActions } from '../hooks/useMapActions'
import { fetchChampion, fetchLeaderboard, fetchZoneBoard, fetchZonesInView, type Bounds } from '../lib/api'
import { bangkokWeek, CATEGORIES, categoryOf, PERIODS, type BoardCategory, type BoardPeriod } from '../lib/leaderboard'
import { provinceLabel, zoneLabel } from '../lib/zones'
import type { ZoneInfo } from '../types'
import { UserAvatar } from './account/UserAvatar'
import { Modal } from './ui/Modal'

const MEDALS = ['bg-amber-400 text-amber-950', 'bg-slate-300 text-slate-900', 'bg-orange-300 text-orange-950']
// เจ้าถิ่นต้องเจอน้องในโซนอย่างน้อยเท่านี้ตัว (ตรงกับ public.zone_mayors)
const MAYOR_MIN = 3
const NATIONWIDE = '__all__'

const chip = (active: boolean) =>
  `flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm ring-1 transition-colors ${
    active ? 'bg-orange-500 font-medium text-white ring-orange-500' : 'bg-surface text-stone-700 ring-stone-300 hover:bg-orange-50'
  }`

/** อันดับ: เลือกโซน (หรือทั้งประเทศ) × ช่วงเวลา × หมวด + แชมป์สัปดาห์ที่แล้ว */
export function LeaderboardDialog({ bounds, onClose }: { bounds: Bounds; onClose: () => void }) {
  const { t, lang } = useI18n()
  const zones = useQuery({ queryKey: ['zonesInView', bounds], queryFn: () => fetchZonesInView(bounds) })
  const [picked, setPicked] = useState<string | null>(null)
  const [period, setPeriod] = useState<BoardPeriod>('week')
  const [category, setCategory] = useState<BoardCategory>('total')
  const list = zones.data ?? []
  // เริ่มที่โซนที่มีน้องมากที่สุดในแผนที่ตอนนี้ (ไม่มีโซน → ทั้งประเทศ)
  const scopeKey = picked ?? list[0]?.key ?? NATIONWIDE
  const zone = list.find((z) => z.key === scopeKey) ?? null
  const zoneKey = zone?.key ?? null
  const cat = categoryOf(category)
  const week = bangkokWeek()

  const board = useQuery({
    queryKey: ['board', category, period, zoneKey],
    queryFn: () => fetchLeaderboard(category, period, zoneKey),
    enabled: !zones.isPending,
  })
  const champion = useQuery({
    queryKey: ['champion', week.lastWeek, category, zoneKey],
    queryFn: () => fetchChampion(week.lastWeek, category, zoneKey),
    enabled: !zones.isPending && period === 'week',
  })

  return (
    <Modal title={t('ทาสแมวแถวนี้')} onClose={onClose}>
      {/* โซน / ทั้งประเทศ */}
      <div className="mb-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('เลือกโซน')}>
        {list.map((z) => (
          <button key={z.key} type="button" role="radio" aria-checked={z.key === scopeKey} onClick={() => setPicked(z.key)} className={chip(z.key === scopeKey)}>
            {zoneLabel(z, lang)}
          </button>
        ))}
        <button
          type="button"
          role="radio"
          aria-checked={scopeKey === NATIONWIDE}
          onClick={() => setPicked(NATIONWIDE)}
          className={chip(scopeKey === NATIONWIDE)}
        >
          <Globe2 size={14} aria-hidden="true" />
          {t('ทั้งประเทศ')}
        </button>
      </div>

      {zone && <ZoneCard zone={zone} />}

      {/* ช่วงเวลา */}
      <div className="mt-4 flex rounded-full bg-stone-100 p-1" role="radiogroup" aria-label={t('ช่วงเวลา')}>
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            role="radio"
            aria-checked={period === p.key}
            onClick={() => setPeriod(p.key)}
            className={`h-8 flex-1 rounded-full text-sm font-medium transition-colors ${
              period === p.key ? 'bg-surface text-orange-700 shadow-sm' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            {t(p.label)}
          </button>
        ))}
      </div>
      {period === 'week' && (
        <p className="mt-1.5 text-center text-xs text-stone-500">{t('เริ่มใหม่ทุกวันจันทร์ · เหลืออีก {n} วัน', { n: week.daysLeft })}</p>
      )}

      {/* หมวด */}
      {/* ขึ้นบรรทัดใหม่แทนการเลื่อนข้าง — แถวที่เลื่อนข้างได้จะตัดขอบปุ่มด้านบน/ล่าง */}
      <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('หมวด')}>
        {CATEGORIES.map((c) => {
          const Icon = c.icon
          return (
            <button key={c.key} type="button" role="radio" aria-checked={category === c.key} onClick={() => setCategory(c.key)} className={chip(category === c.key)}>
              <Icon size={14} aria-hidden="true" />
              {t(c.label)}
            </button>
          )
        })}
      </div>
      <p className="mt-2 text-xs text-stone-500">{t(cat.hint)}</p>

      {period === 'week' && champion.data && (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
          <Trophy size={16} className="shrink-0 text-amber-600" aria-hidden="true" />
          <span>
            {t('แชมป์สัปดาห์ที่แล้ว:')} <span className="font-medium">{champion.data.name}</span>{' '}
            <span className="text-amber-800/80">
              ({champion.data.score} {t(cat.unit)})
            </span>
          </span>
        </p>
      )}

      <div className="mt-3">
        {(board.isPending || zones.isPending) && <p className="py-8 text-center text-sm text-stone-500">{t('กำลังโหลด…')}</p>}
        {board.isSuccess && (board.data?.length ?? 0) === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-stone-500">
            <Trophy size={28} aria-hidden="true" />
            {t(board.data === null ? 'อันดับแบบใหม่ยังไม่พร้อม (รอรัน migration)' : 'ยังไม่มีใครในช่วงนี้ เป็นคนแรกเลยสิ')}
          </div>
        )}
        <RankList rows={(board.data ?? []).map((r) => ({ ...r, value: `${r.score.toLocaleString()} ${t(cat.unit)}` }))} onClose={onClose} />
      </div>
    </Modal>
  )
}

/** การ์ดโซน: เจอแล้วกี่ตัว + เจ้าถิ่น */
function ZoneCard({ zone }: { zone: ZoneInfo }) {
  const { t, lang } = useI18n()
  const { userId } = useAuth()
  const board = useQuery({ queryKey: ['zoneBoard', zone.key, userId], queryFn: () => fetchZoneBoard(zone.key) })
  const data = board.data
  const mine = data?.mine ?? 0
  const done = data && data.total > 0 && mine >= data.total
  const percent = data && data.total ? Math.round((mine / data.total) * 100) : 0
  const mayor = data?.top[0] && data.top[0].collected >= MAYOR_MIN ? data.top[0] : null

  return (
    <div className="rounded-2xl bg-orange-50 px-4 py-3 ring-1 ring-orange-200">
      <p className="font-display text-lg text-stone-900">{zoneLabel(zone, lang)}</p>
      <p className="text-xs text-stone-600">
        {provinceLabel(zone, lang)}
        {data && <> · {t('น้องในโซนนี้ {n} ตัว', { n: data.total })}</>}
      </p>
      {mayor && (
        <p className="mt-1.5 flex items-center gap-1 text-sm text-amber-800">
          <Crown size={14} aria-hidden="true" />
          {t('เจ้าถิ่น:')} <span className="font-medium">{mayor.name}</span>
          <span className="text-xs text-amber-700/80">({t('{n} ตัว', { n: mayor.collected })})</span>
        </p>
      )}
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
      <p className="mt-2 text-[11px] text-stone-500">
        {t('"เจอ" = ปักหมุด กดเจอ ถ่ายรูป หรือให้อาหารน้องตอนอยู่ที่น้อง นับตัวละครั้ง (รีวิวไม่นับ) · อันดับ 1 ที่เจออย่างน้อย {n} ตัวได้เป็นเจ้าถิ่น', { n: MAYOR_MIN })}
      </p>
    </div>
  )
}

interface RankRow {
  userId: string
  name: string
  avatarUrl: string | null
  value: string
}

function RankList({ rows, onClose }: { rows: RankRow[]; onClose: () => void }) {
  const { openProfile } = useMapActions()
  const { userId } = useAuth()
  return (
    <ol className="flex flex-col gap-1">
      {rows.map((row, i) => (
        <li key={row.userId}>
          <button
            type="button"
            onClick={() => {
              onClose()
              openProfile(row.userId)
            }}
            className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-stone-50 ${row.userId === userId ? 'bg-orange-50 ring-1 ring-orange-200' : ''}`}
          >
            <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${MEDALS[i] ?? 'bg-stone-100 text-stone-600'}`}>
              {i + 1}
            </span>
            <UserAvatar name={row.name} url={row.avatarUrl} className="size-9 text-sm" />
            <span className="min-w-0 flex-1 truncate font-medium text-stone-900">{row.name}</span>
            <span className="shrink-0 text-sm font-medium text-orange-700">{row.value}</span>
          </button>
        </li>
      ))}
    </ol>
  )
}
