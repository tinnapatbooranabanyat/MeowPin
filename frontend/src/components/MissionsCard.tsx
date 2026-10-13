import { useQuery } from '@tanstack/react-query'
import { Check, ChevronRight, Flame, PartyPopper, Target } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useI18n } from '../hooks/useI18n'
import { useMapActions } from '../hooks/useMapActions'
import { fetchMyMissions } from '../lib/api'
import { bangkokWeek } from '../lib/leaderboard'
import { missionOf } from '../lib/missions'

/** ภารกิจสัปดาห์นี้ (เหมือนกันทุกคน) — กดภารกิจแล้วเปิดตัวกรองบนแผนที่ที่ช่วยหาน้อง */
export function MissionsCard() {
  const { t } = useI18n()
  const { userId, requireLogin } = useAuth()
  const { applyFilter } = useMapActions()
  const missions = useQuery({ queryKey: ['missions', userId], queryFn: fetchMyMissions, staleTime: 30_000 })
  const data = missions.data
  // ยังไม่ได้รัน migration 0029
  if (!data) return null
  const done = data.missions.filter((m) => m.done).length

  return (
    <section className="mb-4 rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 px-4 py-3 ring-1 ring-orange-200">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 font-medium text-stone-900">
          <Target size={17} className="text-orange-600" aria-hidden="true" />
          {t('ภารกิจสัปดาห์นี้')}
        </h3>
        <span className="text-xs text-stone-500">{t('เหลืออีก {n} วัน', { n: bangkokWeek().daysLeft })}</span>
      </div>

      {data.allDone ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-emerald-700">
          <PartyPopper size={16} aria-hidden="true" />
          {t('ทำครบทุกภารกิจแล้ว ได้เหรียญประจำสัปดาห์!')}
        </p>
      ) : (
        <p className="mt-0.5 text-xs text-stone-600">
          {userId ? t('ทำครบ 3 ภารกิจได้เหรียญประจำสัปดาห์ ({done}/3)', { done }) : t('เข้าสู่ระบบเพื่อนับความคืบหน้า')}
        </p>
      )}
      {data.streak > 1 && (
        <p className="mt-1 flex items-center gap-1 text-xs font-medium text-orange-700">
          <Flame size={13} aria-hidden="true" />
          {t('ทำครบติดกัน {n} สัปดาห์', { n: data.streak })}
        </p>
      )}

      <ul className="mt-2.5 flex flex-col gap-2">
        {data.missions.map((m) => {
          const def = missionOf(m.key)
          const Icon = def.icon
          const percent = Math.round((m.progress / m.goal) * 100)
          return (
            <li key={m.key}>
              <button
                type="button"
                onClick={() => {
                  if (!requireLogin(t('เข้าสู่ระบบเพื่อทำภารกิจ'))) return
                  if (def.filter) applyFilter(def.filter)
                }}
                disabled={!def.filter && userId !== null}
                className="flex w-full items-center gap-3 rounded-xl bg-surface px-3 py-2.5 text-left ring-1 ring-orange-100 transition enabled:hover:bg-orange-50 disabled:cursor-default"
              >
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-full ${m.done ? 'bg-emerald-500 text-white' : 'bg-orange-100 text-orange-700'}`}
                >
                  {m.done ? <Check size={18} aria-hidden="true" /> : <Icon size={17} aria-hidden="true" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-medium ${m.done ? 'text-stone-500 line-through' : 'text-stone-900'}`}>{t(def.label, { n: m.goal })}</span>
                  <span className="mt-1 flex items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-orange-100">
                      <span className={`block h-full rounded-full ${m.done ? 'bg-emerald-500' : 'bg-orange-500'}`} style={{ width: `${percent}%` }} />
                    </span>
                    <span className="shrink-0 text-xs text-stone-500">
                      {m.progress}/{m.goal}
                    </span>
                  </span>
                  {!m.done && <span className="mt-0.5 block text-[11px] text-stone-500">{t(def.hint)}</span>}
                </span>
                {def.filter && !m.done && <ChevronRight size={16} className="shrink-0 text-stone-400" aria-hidden="true" />}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
