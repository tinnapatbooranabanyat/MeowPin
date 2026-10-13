import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BellRing, CheckCircle2, Eye, Footprints, HeartPulse, LoaderCircle, MapPin, Navigation } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useI18n } from '../hooks/useI18n'
import { confirmHelp, fetchHelpRequests, fetchHelpResponders, renewHelp, requestHelp, resolveHelp, setHelpResponding, unconfirmHelp } from '../lib/api'
import { directionsUrl, HELP_KINDS, timeAgo } from '../lib/cat'
import { distanceMeters, getCurrentPosition, type GpsFix } from '../lib/geo'
import type { Cat, HelpKind, HelpRequest } from '../types'
import { Modal } from './ui/Modal'
import { confirmAction } from '../lib/dialogs'

/** น้องต้องการความช่วยเหลือ: ป้ายแดง + เรื่องที่แจ้งไว้ + ปุ่มแจ้ง/ปิดเรื่อง */
export function HelpSection({ cat }: { cat: Cat }) {
  const { t } = useI18n()
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
    // ['missions']: ยืนยันเรื่องขอความช่วยเหลือนับเป็นภารกิจได้
    for (const key of [['catHelp', cat.id], ['cats'], ['cat', cat.id], ['missions']]) queryClient.invalidateQueries({ queryKey: key })
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
            <ul className="mt-2 flex flex-col gap-2.5 text-sm text-red-900">
              {list.map((r) => (
                <HelpRequestItem key={r.id} cat={cat} request={r} onChange={refresh} />
              ))}
            </ul>
          )}
          <HelpResponders cat={cat} />
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
          <p className="mt-2 text-xs text-red-700/70">{t('เรื่องที่ไม่มีใครยืนยันหรืออัปเดตนาน 14 วันจะปิดเอง')}</p>
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
  const gps = useNearCat(cat)
  const send = useMutation({
    mutationFn: async () => requestHelp(cat.id, kind!, note.trim(), await gps.waitFix()),
    onSuccess: onSent,
  })

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
        <p
          className={`flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm ${
            gps.near ? 'bg-emerald-50 text-emerald-800' : 'bg-stone-50 text-stone-600'
          }`}
        >
          {gps.pending ? (
            <LoaderCircle size={16} className="mt-0.5 shrink-0 animate-spin" aria-hidden="true" />
          ) : (
            <MapPin size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          )}
          {t(
            gps.pending
              ? 'กำลังเช็กว่าคุณอยู่ใกล้น้องไหม…'
              : gps.near
                ? 'คุณอยู่ใกล้น้อง เรื่องนี้จะขึ้นป้าย "แจ้งจากจุดที่เจอน้อง" ให้คนอื่นเชื่อถือมากขึ้น'
                : 'ไม่ได้อยู่ที่น้องตอนนี้ก็แจ้งได้ ถ้าแจ้งตอนอยู่ใกล้น้อง เรื่องจะขึ้นป้าย "แจ้งจากจุดที่เจอน้อง"',
          )}
        </p>
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

// ตรงกับ public.is_near_cat ในฐานข้อมูล (ฝั่งนี้แค่บอกผู้ใช้ล่วงหน้า ฐานข้อมูลเป็นคนตัดสิน)
const NEAR_M = 300
const MAX_ACCURACY_M = 150

/** ขอตำแหน่งตอนเปิดหน้าต่าง — ไม่บังคับ ปฏิเสธก็ยังแจ้งได้ */
function useNearCat(cat: Cat) {
  const [fix, setFix] = useState<GpsFix | null | undefined>(undefined)
  const promise = useRef<Promise<GpsFix | null> | null>(null)
  useEffect(() => {
    let alive = true
    promise.current = getCurrentPosition(10_000)
    promise.current.then((f) => alive && setFix(f))
    return () => {
      alive = false
    }
  }, [])
  return {
    pending: fix === undefined,
    near: isNear(fix ?? null, cat),
    /** ตอนกดส่ง รอ GPS อีกไม่เกิน 3 วิ (ไม่ให้คนแจ้งต้องรอนาน) */
    waitFix: () =>
      Promise.race([promise.current ?? Promise.resolve(null), new Promise<null>((r) => setTimeout(() => r(null), 3000))]),
  }
}

function isNear(fix: GpsFix | null, cat: Cat) {
  return fix !== null && fix.accuracy <= MAX_ACCURACY_M && distanceMeters(fix.position, cat.position) <= NEAR_M
}

function HelpRequestItem({ cat, request: r, onChange }: { cat: Cat; request: HelpRequest; onChange: () => void }) {
  const { t, lang } = useI18n()
  const { userId, isAdmin, requireLogin } = useAuth()
  const mine = r.userId === userId
  const confirmed = r.confirmations.some((c) => c.userId === userId)
  const count = r.confirmations.length
  const nearCount = r.confirmations.filter((c) => c.nearCat).length
  const canRenew = r.remindedAt !== null && userId !== null && (mine || isAdmin || cat.createdBy === userId)

  const toggle = useMutation({
    mutationFn: async () => (confirmed ? unconfirmHelp(r.id, userId!) : confirmHelp(r.id, await getCurrentPosition(8000))),
    onSuccess: onChange,
  })
  const renew = useMutation({ mutationFn: () => renewHelp(r.id), onSuccess: onChange })

  return (
    <li>
      <p>
        <span className="font-medium">{t(HELP_KINDS[r.kind].label)}</span>
        {r.note && <> — {r.note}</>}
        <span className="text-xs text-red-700/80">
          {' '}
          · {r.reporterName ?? t('ผู้ใช้')} · {timeAgo(r.createdAt, lang)}
        </span>
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
        {r.nearCat && (
          <span className="flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 font-medium text-emerald-700 ring-1 ring-emerald-200">
            <MapPin size={12} aria-hidden="true" />
            {t('แจ้งจากจุดที่เจอน้อง')}
          </span>
        )}
        <span className={count ? 'font-medium text-red-800' : 'text-red-700/70'}>
          {count
            ? nearCount
              ? t('ยืนยันแล้ว {n} คน ({near} คนอยู่ใกล้น้อง)', { n: count, near: nearCount })
              : t('ยืนยันแล้ว {n} คน', { n: count })
            : t('ยังไม่มีใครยืนยัน')}
        </span>
        {!mine && (
          <button
            type="button"
            disabled={toggle.isPending}
            aria-pressed={confirmed}
            onClick={() => requireLogin(t('เข้าสู่ระบบเพื่อยืนยันว่าน้องต้องการความช่วยเหลือ')) && toggle.mutate()}
            className={`ml-auto flex items-center gap-1 rounded-full px-2.5 py-1 font-medium ring-1 transition disabled:opacity-60 ${
              confirmed ? 'bg-red-600 text-white ring-red-600' : 'bg-surface text-red-700 ring-red-200 hover:bg-red-100'
            }`}
            title={t(confirmed ? 'กดอีกครั้งเพื่อยกเลิก' : 'ฉันเห็นน้องเป็นแบบนี้เหมือนกัน')}
          >
            {toggle.isPending ? (
              <LoaderCircle size={13} className="animate-spin" aria-hidden="true" />
            ) : (
              <Eye size={13} aria-hidden="true" />
            )}
            {t(confirmed ? 'ฉันก็เห็น ✓' : 'ฉันก็เห็น')}
          </button>
        )}
      </div>
      {toggle.error && <p className="mt-1 text-xs text-red-700">{t(toggle.error.message)}</p>}
      {canRenew && (
        <div className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">
          <p className="flex items-start gap-1.5">
            <BellRing size={14} className="mt-px shrink-0" aria-hidden="true" />
            {t('ไม่มีความเคลื่อนไหวมา 7 วัน น้องยังต้องการความช่วยเหลือไหม? ถ้าไม่มีใครตอบ เรื่องนี้จะปิดเองใน 7 วัน')}
          </p>
          <button
            type="button"
            disabled={renew.isPending}
            onClick={() => renew.mutate()}
            className="mt-1.5 rounded-full bg-amber-500 px-3 py-1 font-medium text-white hover:bg-amber-600 disabled:opacity-60"
          >
            {t('ยังต้องการความช่วยเหลือ')}
          </button>
          {renew.error && <p className="mt-1 text-red-700">{t(renew.error.message)}</p>}
        </div>
      )}
    </li>
  )
}

/** "ฉันกำลังไปช่วย" — บอกคนอื่นว่ามีคนรับเรื่องแล้ว ไม่ต้องไปซ้ำ (คนที่แจ้งไว้ได้แจ้งเตือน) */
function HelpResponders({ cat }: { cat: Cat }) {
  const { t, lang } = useI18n()
  const { userId, requireLogin } = useAuth()
  const queryClient = useQueryClient()
  const key = ['helpResponders', cat.id]
  const responders = useQuery({ queryKey: key, queryFn: () => fetchHelpResponders(cat.id) })
  const list = responders.data ?? []
  const going = userId !== null && list.some((r) => r.userId === userId)
  const toggle = useMutation({
    mutationFn: () => setHelpResponding(cat.id, userId!, !going),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  })

  return (
    <div className="mt-3 rounded-xl bg-surface px-3 py-2.5 ring-1 ring-red-100">
      <p className="flex items-start gap-1.5 text-sm text-stone-700">
        <Footprints size={15} className="mt-0.5 shrink-0 text-red-600" aria-hidden="true" />
        {list.length ? (
          <span>
            <span className="font-medium text-stone-900">{t('กำลังไปช่วย:')}</span>{' '}
            {list.map((r, i) => (
              <span key={r.userId}>
                {i > 0 && ', '}
                {r.userId === userId ? t('คุณ') : (r.name ?? t('ผู้ใช้'))}
                <span className="text-xs text-stone-500"> ({timeAgo(r.createdAt, lang)})</span>
              </span>
            ))}
          </span>
        ) : (
          <span className="text-stone-500">{t('ยังไม่มีใครบอกว่ากำลังไปช่วย')}</span>
        )}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={toggle.isPending}
          aria-pressed={going}
          onClick={() => requireLogin(t('เข้าสู่ระบบเพื่อบอกว่ากำลังไปช่วยน้อง')) && toggle.mutate()}
          className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 transition disabled:opacity-60 ${
            going ? 'bg-surface text-stone-700 ring-stone-300 hover:bg-stone-100' : 'bg-red-600 text-white ring-red-600 hover:bg-red-700'
          }`}
        >
          {toggle.isPending ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <Footprints size={15} aria-hidden="true" />}
          {t(going ? 'ยกเลิก ไปไม่ได้แล้ว' : 'ฉันกำลังไปช่วย')}
        </button>
        {going && (
          <a
            href={directionsUrl(cat)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium text-sky-700 ring-1 ring-sky-200 hover:bg-sky-50"
          >
            <Navigation size={15} aria-hidden="true" />
            {t('นำทางไปหาน้อง')}
          </a>
        )}
      </div>
      {toggle.error && <p className="mt-1.5 text-xs text-red-700">{t(toggle.error.message)}</p>}
    </div>
  )
}
