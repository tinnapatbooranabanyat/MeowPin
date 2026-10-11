import { useQuery } from '@tanstack/react-query'
import { Crown, Trophy } from 'lucide-react'
import { useI18n } from '../hooks/useI18n'
import { useMapActions } from '../hooks/useMapActions'
import { fetchAreaLeaderboard, type Bounds } from '../lib/api'
import { UserAvatar } from './account/UserAvatar'
import { Modal } from './ui/Modal'

const MEDALS = ['bg-amber-400 text-amber-950', 'bg-slate-300 text-slate-900', 'bg-orange-300 text-orange-950']

/** คนที่ช่วยดูแลน้องในกรอบแผนที่ตอนนี้มากที่สุด (90 วันล่าสุด) */
export function LeaderboardDialog({ bounds, onClose }: { bounds: Bounds; onClose: () => void }) {
  const { t } = useI18n()
  const { openProfile } = useMapActions()
  const board = useQuery({ queryKey: ['leaderboard', bounds], queryFn: () => fetchAreaLeaderboard(bounds) })
  const rows = board.data ?? []

  return (
    <Modal title={t('ทาสแมวแถวนี้')} onClose={onClose}>
      <p className="mb-4 text-sm text-stone-600">
        {t('นับจากน้องแมวที่อยู่ในแผนที่ตอนนี้ 90 วันล่าสุด — ปักหมุด 5 · แจ้งช่วยน้อง 3 · รีวิว 3 · รูป 2 · เจอน้อง 1 · ให้อาหาร 1 คะแนน')}
      </p>
      {board.isPending && <p className="py-8 text-center text-sm text-stone-500">{t('กำลังโหลด…')}</p>}
      {board.isSuccess && rows.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-stone-500">
          <Trophy size={28} aria-hidden="true" />
          {t('แถวนี้ยังไม่มีใครเลย เริ่มปักหมุดหรือกดเจอน้องเป็นคนแรกสิ')}
        </div>
      )}
      <ol className="flex flex-col gap-1">
        {rows.map((row, i) => (
          <li key={row.userId}>
            <button
              type="button"
              onClick={() => {
                onClose()
                openProfile(row.userId)
              }}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-stone-50"
            >
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${MEDALS[i] ?? 'bg-stone-100 text-stone-600'}`}
              >
                {i + 1}
              </span>
              <UserAvatar name={row.name} url={row.avatarUrl} className="size-9 text-sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-stone-900">{row.name}</span>
                {i === 0 && (
                  <span className="flex items-center gap-1 text-xs font-medium text-amber-700">
                    <Crown size={12} aria-hidden="true" />
                    {t('ทาสแมวประจำย่านนี้')}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-sm font-medium text-orange-700">{t('{n} คะแนน', { n: row.points })}</span>
            </button>
          </li>
        ))}
      </ol>
    </Modal>
  )
}
