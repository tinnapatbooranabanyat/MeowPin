import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, HeartPulse, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useI18n } from '../hooks/useI18n'
import { fetchHelpRequests, requestHelp, resolveHelp } from '../lib/api'
import { HELP_KINDS, timeAgo } from '../lib/cat'
import type { Cat, HelpKind } from '../types'
import { Modal } from './ui/Modal'
import { confirmAction } from '../lib/dialogs'

/** น้องต้องการความช่วยเหลือ: ป้ายแดง + เรื่องที่แจ้งไว้ + ปุ่มแจ้ง/ปิดเรื่อง */
export function HelpSection({ cat }: { cat: Cat }) {
  const { t, lang } = useI18n()
  const { userId, isAdmin, requireLogin } = useAuth()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const requests = useQuery({
    queryKey: ['catHelp', cat.id],
    queryFn: () => fetchHelpRequests(cat.id),
    // ไม่มีเรื่องค้างในแผนที่ก็ไม่ต้องโหลด
    enabled: cat.helpKinds.length > 0,
  })
  const refresh = () => {
    for (const key of [['catHelp', cat.id], ['cats'], ['cat', cat.id]]) queryClient.invalidateQueries({ queryKey: key })
  }
  const resolve = useMutation({ mutationFn: () => resolveHelp(cat.id), onSuccess: refresh })

  const list = requests.data ?? []
  const canResolve =
    userId !== null && (isAdmin || cat.createdBy === userId || list.some((r) => r.userId === userId))

  return (
    <>
      {cat.helpKinds.length > 0 && (
        <section className="animate-fade-in rounded-2xl bg-red-50 px-4 py-3 ring-1 ring-red-200">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-red-800">
            <HeartPulse size={16} aria-hidden="true" />
            {t('น้องอาจต้องการความช่วยเหลือ')}
          </h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {cat.helpKinds.map((kind) => (
              <span key={kind} className="rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-medium text-white">
                {t(HELP_KINDS[kind].label)}
              </span>
            ))}
          </div>
          {list.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1.5 text-sm text-red-900">
              {list.map((r) => (
                <li key={r.id}>
                  <span className="font-medium">{t(HELP_KINDS[r.kind].label)}</span>
                  {r.note && <> — {r.note}</>}
                  <span className="text-xs text-red-700/80">
                    {' '}
                    · {r.reporterName ?? t('ผู้ใช้')} · {timeAgo(r.createdAt, lang)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {canResolve && (
            <button
              type="button"
              disabled={resolve.isPending}
              onClick={async () => {
                const ok = await confirmAction({
                  title: t('ปิดเรื่องทั้งหมดของน้อง{name}?', { name: cat.name }),
                  message: t('เช่น พาไปหาหมอแล้ว หรือหายดีแล้ว'),
                  confirmLabel: t('ปิดเรื่อง'),
                })
                if (ok) resolve.mutate()
              }}
              className="mt-3 flex items-center gap-1.5 rounded-full bg-surface px-3.5 py-1.5 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50 disabled:opacity-60"
            >
              {resolve.isPending ? (
                <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle2 size={15} aria-hidden="true" />
              )}
              {t('ช่วยแล้ว / น้องปลอดภัยแล้ว')}
            </button>
          )}
          {resolve.error && <p className="mt-2 text-sm text-red-700">{t(resolve.error.message)}</p>}
        </section>
      )}

      <button
        type="button"
        onClick={() => requireLogin(t('เข้าสู่ระบบเพื่อแจ้งว่าน้องต้องการความช่วยเหลือ')) && setOpen(true)}
        className="flex items-center justify-center gap-1.5 rounded-full py-2 text-sm font-medium text-red-700 ring-1 ring-red-200 transition hover:bg-red-50 active:scale-[0.98]"
      >
        <HeartPulse size={16} aria-hidden="true" />
        {t('แจ้งว่าน้องต้องการความช่วยเหลือ')}
      </button>

      {open && (
        <HelpRequestDialog
          cat={cat}
          onClose={() => setOpen(false)}
          onSent={() => {
            setOpen(false)
            refresh()
          }}
        />
      )}
    </>
  )
}

function HelpRequestDialog({ cat, onClose, onSent }: { cat: Cat; onClose: () => void; onSent: () => void }) {
  const { t } = useI18n()
  const [kind, setKind] = useState<HelpKind | null>(null)
  const [note, setNote] = useState('')
  const send = useMutation({ mutationFn: () => requestHelp(cat.id, kind!, note.trim()), onSuccess: onSent })

  return (
    <Modal title={t('น้อง{name}ต้องการความช่วยเหลือ', { name: cat.name })} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-stone-600">
          {t('หมุดจะขึ้นป้ายสีแดงให้อาสาสมัครและมูลนิธิในพื้นที่เห็น ถ้าน้องอาการหนัก ติดต่อสัตวแพทย์หรือมูลนิธิใกล้บ้านโดยตรงด้วยนะ')}
        </p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('เรื่องที่พบ')}>
          {(Object.keys(HELP_KINDS) as HelpKind[]).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={kind === value}
              onClick={() => setKind(value)}
              className={`h-9 rounded-full px-3.5 text-sm ring-1 transition-colors ${
                kind === value ? 'bg-red-600 text-white ring-red-600' : 'bg-surface text-stone-700 ring-stone-300 hover:bg-red-50'
              }`}
            >
              {t(HELP_KINDS[value].label)}
            </button>
          ))}
        </div>
        {kind && <p className="-mt-2 text-xs text-stone-500">{t(HELP_KINDS[kind].hint)}</p>}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('เล่าอาการที่เห็น เช่น ขาหลังเจ็บ เดินกะเผลก (ไม่บังคับ)')}
          rows={3}
          maxLength={300}
          className="w-full resize-none rounded-xl border border-stone-300 bg-surface px-3.5 py-2.5 text-[15px] text-stone-800 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
        />
        {send.error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            {t(send.error.message)}
          </p>
        )}
        <button
          type="button"
          disabled={!kind || send.isPending}
          onClick={() => send.mutate()}
          className="flex h-12 items-center justify-center gap-2 rounded-full bg-red-600 font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {send.isPending && <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />}
          {t('แจ้งเรื่องนี้')}
        </button>
      </div>
    </Modal>
  )
}
