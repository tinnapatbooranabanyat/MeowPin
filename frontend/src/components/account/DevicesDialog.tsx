import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LogOut, MapPin, Monitor, ShieldCheck, Smartphone, Tablet } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '../../hooks/useI18n'
import type { Lang } from '../../i18n'
import { fetchMySessions, revokeOtherSessions, revokeSession } from '../../lib/api'
import { timeAgo } from '../../lib/cat'
import { parseUserAgent } from '../../lib/userAgent'
import type { DeviceSession } from '../../types'
import { Modal } from '../ui/Modal'

const KIND_ICON = { phone: Smartphone, tablet: Tablet, desktop: Monitor }

function placeName(session: DeviceSession, lang: Lang): string | null {
  let country: string | null = null
  if (session.country) {
    try {
      country = new Intl.DisplayNames([lang], { type: 'region' }).of(session.country) ?? session.country
    } catch {
      country = session.country
    }
  }
  return [session.city, country].filter(Boolean).join(', ') || null
}

export function DevicesDialog({ onClose }: { onClose: () => void }) {
  const { t, lang } = useI18n()
  const queryClient = useQueryClient()
  const sessions = useQuery({ queryKey: ['mySessions'], queryFn: fetchMySessions })
  // กดครั้งแรก = ถามยืนยัน กดซ้ำ = ออกจากระบบจริง
  const [confirming, setConfirming] = useState<string | null>(null)
  const done = () => {
    setConfirming(null)
    queryClient.invalidateQueries({ queryKey: ['mySessions'] })
  }
  const revokeOne = useMutation({ mutationFn: revokeSession, onSuccess: done })
  const revokeOthers = useMutation({ mutationFn: revokeOtherSessions, onSuccess: done })
  const error = revokeOne.error ?? revokeOthers.error
  const others = sessions.data?.filter((s) => !s.isCurrent) ?? []

  return (
    <Modal title={t('อุปกรณ์ที่เข้าสู่ระบบ')} onClose={onClose}>
      <p className="mb-4 flex gap-2 rounded-2xl bg-stone-50 px-3.5 py-3 text-sm text-stone-600 ring-1 ring-stone-100">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
        {t('ถ้าเจออุปกรณ์ที่ไม่ใช่ของคุณ กด "ออกจากระบบ" ที่อุปกรณ์นั้นได้เลย ตำแหน่งเป็นค่าโดยประมาณจาก IP')}
      </p>

      {sessions.isPending && <p className="py-6 text-center text-sm text-stone-500">{t('กำลังโหลด…')}</p>}
      {sessions.isError && (
        <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {t(sessions.error.message)}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {sessions.data?.map((session) => {
          const device = parseUserAgent(session.userAgent)
          const Icon = KIND_ICON[device.kind]
          const name = [device.browser, device.os].filter(Boolean).join(t(' บน ')) || t('อุปกรณ์ที่ไม่รู้จัก')
          const place = placeName(session, lang)
          const isConfirming = confirming === session.id
          return (
            <li key={session.id} className="flex items-start gap-3 rounded-2xl px-3 py-3 ring-1 ring-stone-200">
              <span
                className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
                  session.isCurrent ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-600'
                }`}
              >
                <Icon size={20} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 font-medium text-stone-900">
                  {name}
                  {session.isCurrent && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                      {t('อุปกรณ์นี้')}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-sm text-stone-600">
                  <MapPin size={13} className="shrink-0" aria-hidden="true" />
                  <span className="truncate">
                    {place ?? t('ไม่ทราบตำแหน่ง')}
                    {session.ip && <span className="text-stone-400"> · {session.ip}</span>}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-stone-500">
                  {t('เข้าสู่ระบบ {when}', { when: timeAgo(session.createdAt, lang) })} ·{' '}
                  {session.isCurrent ? t('ใช้งานอยู่ตอนนี้') : t('ใช้งานล่าสุด {when}', { when: timeAgo(session.lastActiveAt, lang) })}
                </p>
              </div>
              {!session.isCurrent && (
                <button
                  type="button"
                  disabled={revokeOne.isPending}
                  onClick={() => (isConfirming ? revokeOne.mutate(session.id) : setConfirming(session.id))}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition disabled:opacity-60 ${
                    isConfirming ? 'bg-red-600 text-white hover:bg-red-700' : 'text-red-700 ring-1 ring-red-200 hover:bg-red-50'
                  }`}
                >
                  {isConfirming ? t('ยืนยัน') : t('ออกจากระบบ')}
                </button>
              )}
            </li>
          )
        })}
      </ul>

      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {t(error.message)}
        </p>
      )}

      {others.length > 1 && (
        <button
          type="button"
          disabled={revokeOthers.isPending}
          onClick={() => (confirming === 'all' ? revokeOthers.mutate() : setConfirming('all'))}
          className={`mt-4 flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 font-medium transition disabled:opacity-60 ${
            confirming === 'all' ? 'bg-red-600 text-white hover:bg-red-700' : 'text-red-700 ring-1 ring-red-200 hover:bg-red-50'
          }`}
        >
          <LogOut size={17} aria-hidden="true" />
          {confirming === 'all'
            ? t('ยืนยันออกจากระบบ {n} อุปกรณ์', { n: others.length })
            : t('ออกจากระบบอุปกรณ์อื่นทั้งหมด')}
        </button>
      )}
    </Modal>
  )
}
