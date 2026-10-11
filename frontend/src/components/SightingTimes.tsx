import { useQuery } from '@tanstack/react-query'
import { Clock } from 'lucide-react'
import { useI18n } from '../hooks/useI18n'
import { fetchSightingHours } from '../lib/api'

// ต้องเจออย่างน้อยเท่านี้ครั้งถึงจะสรุปช่วงเวลา (น้อยกว่านี้ยังบอกอะไรไม่ได้)
const MIN_SIGHTINGS = 3
const WINDOW_HOURS = 3

const PERIODS: [number, string][] = [
  [4, 'เช้ามืด'],
  [6, 'ช่วงเช้า'],
  [11, 'ช่วงกลางวัน'],
  [13, 'ช่วงบ่าย'],
  [16, 'ช่วงเย็น'],
  [19, 'ช่วงค่ำ'],
  [22, 'ช่วงดึก'],
]

function periodOf(hour: number): string {
  let label = 'ช่วงดึก'
  for (const [start, name] of PERIODS) if (hour >= start) label = name
  return label
}

/** ช่วง 3 ชั่วโมงที่เจอน้องบ่อยที่สุด (วนข้ามเที่ยงคืนได้) */
function busiestWindow(counts: number[]): number {
  let best = 0
  let bestSum = -1
  for (let start = 0; start < 24; start++) {
    let sum = 0
    for (let k = 0; k < WINDOW_HOURS; k++) sum += counts[(start + k) % 24]
    if (sum > bestSum) {
      bestSum = sum
      best = start
    }
  }
  return best
}

export function SightingTimes({ catId }: { catId: string }) {
  const { t } = useI18n()
  const hours = useQuery({ queryKey: ['sightingHours', catId], queryFn: () => fetchSightingHours(catId), staleTime: 10 * 60_000 })
  const counts = hours.data ?? []
  const total = counts.reduce((a, b) => a + b, 0)
  if (total < MIN_SIGHTINGS) return null

  const start = busiestWindow(counts)
  const end = (start + WINDOW_HOURS) % 24
  const max = Math.max(...counts)
  const pad = (h: number) => String(h).padStart(2, '0')

  return (
    <section className="rounded-2xl px-4 py-3 ring-1 ring-stone-200">
      <h3 className="flex items-center gap-1.5 text-sm font-medium text-stone-800">
        <Clock size={15} className="text-orange-500" aria-hidden="true" />
        {t('มักเจอน้อง{period} {from}–{to} น.', {
          period: t(periodOf(start + 1)),
          from: `${pad(start)}:00`,
          to: `${pad(end)}:00`,
        })}
      </h3>
      <div className="mt-3 flex h-12 items-end gap-[3px]" role="img" aria-label={t('จำนวนครั้งที่เจอน้องในแต่ละชั่วโมง')}>
        {counts.map((count, hour) => {
          const inWindow = (hour - start + 24) % 24 < WINDOW_HOURS
          return (
            <span
              key={hour}
              title={`${pad(hour)}:00 · ${count}`}
              className={`flex-1 rounded-t-sm ${inWindow ? 'bg-orange-500' : 'bg-stone-200'}`}
              style={{ height: `${Math.max(6, (count / max) * 100)}%` }}
            />
          )
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-stone-500">
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>23</span>
      </div>
      <p className="mt-1 text-xs text-stone-500">{t('จากการกด "เจอน้อง" {n} ครั้งใน 6 เดือนล่าสุด', { n: total })}</p>
    </section>
  )
}
