import { useQuery } from '@tanstack/react-query'
import { Award } from 'lucide-react'
import { useI18n } from '../../hooks/useI18n'
import { fetchUserStats } from '../../lib/api'
import { computeBadges, TIER_STYLE } from '../../lib/badges'

const TIER_LABEL = { bronze: 'ทองแดง', silver: 'เงิน', gold: 'ทอง' }

/** ตราสัญลักษณ์ในหน้าโปรไฟล์ + เป้าหมายถัดไป (เฉพาะโปรไฟล์ตัวเอง) */
export function BadgeList({ userId, isMe }: { userId: string; isMe: boolean }) {
  const { t } = useI18n()
  const stats = useQuery({ queryKey: ['userStats', userId], queryFn: () => fetchUserStats(userId) })
  if (!stats.data) return null
  const { earned, upcoming } = computeBadges(stats.data)
  if (!earned.length && !isMe) return null

  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-stone-700">
        <Award size={16} className="text-amber-500" aria-hidden="true" />
        {t('ตราสัญลักษณ์')}
      </h3>
      <ul className="flex flex-wrap gap-1.5">
        {earned.map((badge) => (
          <li
            key={badge.key}
            title={
              badge.next
                ? t('{n} {unit} · อีก {left} จะได้ระดับถัดไป', { n: badge.count, unit: t(badge.unit), left: badge.next - badge.count })
                : t('{n} {unit} · ระดับสูงสุดแล้ว', { n: badge.count, unit: t(badge.unit) })
            }
            className={`animate-pop-in rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${TIER_STYLE[badge.tier]}`}
          >
            {t(badge.name)} <span className="opacity-70">· {t(TIER_LABEL[badge.tier])}</span>
          </li>
        ))}
      </ul>
      {isMe && upcoming.length > 0 && (
        <p className="mt-2 text-xs text-stone-500">
          {t('ตราถัดไป: {name} ({count}/{goal} {unit})', {
            name: t(upcoming[0].name),
            count: upcoming[0].count,
            goal: upcoming[0].goal,
            unit: t(upcoming[0].unit),
          })}
        </p>
      )}
    </section>
  )
}
