import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useI18n } from '../../hooks/useI18n'
import { fetchAllCatsForAdmin, type CatIssues } from '../../lib/api'
import { furLabel, timeAgo } from '../../lib/cat'
import type { Cat } from '../../types'
import { CatAvatar } from '../CatAvatar'

type Problem = { key: string; label: string; tone: string; weight: number; n?: number }

const STALE_DAYS = 30

/** ปัญหาของหมุด เรียงจากหนักไปเบา (weight สูง = ควรดูก่อน) */
function problemsOf(cat: Cat, issues: CatIssues | undefined, now: number): Problem[] {
  const list: Problem[] = []
  if (issues?.reports) list.push({ key: 'reports', label: 'ถูกรายงาน {n} ครั้ง', tone: 'bg-red-100 text-red-800', weight: 5 + issues.reports, n: issues.reports })
  if (issues?.photoReports) list.push({ key: 'photos', label: 'รูปถูกรายงาน {n} ครั้ง', tone: 'bg-red-100 text-red-800', weight: 4 + issues.photoReports, n: issues.photoReports })
  if (cat.catCheck === 'user') list.push({ key: 'unverified', label: 'รอตรวจว่าเป็นแมว', tone: 'bg-amber-100 text-amber-800', weight: 4 })
  if (cat.helpKinds.length) list.push({ key: 'help', label: 'ต้องการความช่วยเหลือ', tone: 'bg-rose-100 text-rose-800', weight: 3 })
  if (issues?.moveRequests) list.push({ key: 'move', label: 'มีคนเสนอย้ายหมุด {n} ครั้ง', tone: 'bg-sky-100 text-sky-800', weight: 2, n: issues.moveRequests })
  if (now - new Date(cat.lastSeenAt).getTime() > STALE_DAYS * 86_400_000)
    list.push({ key: 'stale', label: 'ไม่มีใครเจอเกิน 30 วัน', tone: 'bg-stone-200 text-stone-700', weight: 1 })
  if (!cat.photoUrl) list.push({ key: 'nophoto', label: 'ไม่มีรูป', tone: 'bg-stone-200 text-stone-700', weight: 1 })
  return list
}

/** admin: บันทึกหมุดแมวทั้งหมดในระบบ + กรองเฉพาะหมุดที่มีปัญหา */
export function AllCatsList({ onOpenCat }: { onOpenCat: (catId: string) => void }) {
  const { t, lang } = useI18n()
  const [onlyProblems, setOnlyProblems] = useState(true)
  const [query, setQuery] = useState('')
  const data = useQuery({ queryKey: ['adminAllCats'], queryFn: fetchAllCatsForAdmin, staleTime: 30_000 })
  // เวลา ณ ตอนโหลดข้อมูล (ไม่ต้องคำนวณใหม่ทุก render)
  const loadedAt = data.dataUpdatedAt

  const rows = useMemo(() => {
    if (!data.data) return []
    return data.data.cats.map((cat) => {
      const problems = problemsOf(cat, data.data.issues[cat.id], loadedAt)
      return { cat, problems, weight: problems.reduce((sum, p) => sum + p.weight, 0) }
    })
  }, [data.data, loadedAt])
  const withProblems = rows.filter((r) => r.problems.length > 0)
  const q = query.trim().toLowerCase()
  const shown = (onlyProblems ? [...withProblems].sort((a, b) => b.weight - a.weight) : rows).filter(
    ({ cat }) =>
      !q ||
      cat.name.toLowerCase().includes(q) ||
      cat.placeName.toLowerCase().includes(q) ||
      (cat.createdByName ?? '').toLowerCase().includes(q),
  )

  if (data.isPending) return <p className="py-8 text-center text-sm text-stone-500">{t('กำลังโหลด…')}</p>
  if (data.isError) return <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{t(data.error.message)}</p>

  const chip = (active: boolean) =>
    `h-8 rounded-full px-3.5 text-sm ring-1 ${active ? 'bg-orange-500 text-white ring-orange-500' : 'bg-surface text-stone-700 ring-stone-300'}`

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" aria-pressed={onlyProblems} onClick={() => setOnlyProblems(true)} className={chip(onlyProblems)}>
          {t('มีปัญหา ({n})', { n: withProblems.length })}
        </button>
        <button type="button" aria-pressed={!onlyProblems} onClick={() => setOnlyProblems(false)} className={chip(!onlyProblems)}>
          {t('ทั้งหมด ({n})', { n: rows.length })}
        </button>
        <label className="flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded-full bg-surface px-3 ring-1 ring-stone-300 focus-within:ring-orange-400 sm:max-w-60">
          <Search size={14} className="shrink-0 text-stone-400" aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('ค้นหาชื่อ สถานที่ หรือคนปัก')}
            className="min-w-0 flex-1 bg-transparent text-sm text-stone-800 outline-none placeholder:text-stone-400"
          />
        </label>
      </div>

      {shown.length === 0 && (
        <p className="py-8 text-center text-sm text-stone-500">
          {t(onlyProblems && !q ? 'ไม่มีหมุดที่มีปัญหา 🎉' : 'ไม่เจอหมุดที่ตรงกับคำค้น')}
        </p>
      )}
      <ul className="flex flex-col">
        {shown.map(({ cat, problems }) => (
          <li key={cat.id} className="border-b border-stone-100 last:border-0">
            <button type="button" onClick={() => onOpenCat(cat.id)} className="flex w-full items-center gap-3 rounded-xl px-1 py-2.5 text-left hover:bg-stone-50">
              <CatAvatar cat={cat} className="size-12 shrink-0 rounded-xl" iconSize={20} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-stone-900">{cat.name}</span>
                <span className="block truncate text-xs text-stone-500">
                  {t(furLabel(cat))} · {cat.placeName || t('ไม่ระบุสถานที่')} · {cat.createdByName ?? t('ทีม MeowPin')} ·{' '}
                  {t('เจอล่าสุด {when}', { when: timeAgo(cat.lastSeenAt, lang) })}
                </span>
                {problems.length > 0 && (
                  <span className="mt-1 flex flex-wrap gap-1">
                    {problems.map((p) => (
                      <span key={p.key} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${p.tone}`}>
                        {t(p.label, { n: p.n ?? 0 })}
                      </span>
                    ))}
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
