import { Bell, Bug, HeartHandshake, IdCard, Inbox, Info, Languages, LogIn, LogOut, Monitor, MonitorSmartphone, Moon, Pencil, ScrollText, Sun, UserRound } from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useI18n } from '../../hooks/useI18n'
import { useNotifications } from '../../hooks/useNotifications'
import { useTheme, type ThemePref } from '../../hooks/useTheme'
import { skipActiveTransition } from '../../lib/viewTransition'
import type { Lang } from '../../i18n'
import { UserAvatar } from './UserAvatar'

// โลโก้ทั้งหมดอยู่ในไฟล์นี้ — โหลดเฉพาะตอนเปิดดู
const AboutDialog = lazy(() => import('./AboutDialog').then((m) => ({ default: m.AboutDialog })))
const DevicesDialog = lazy(() => import('./DevicesDialog').then((m) => ({ default: m.DevicesDialog })))
const NotificationsDialog = lazy(() => import('./NotificationsDialog').then((m) => ({ default: m.NotificationsDialog })))

interface Props {
  /** จำนวนรายงานที่ยังค้าง (เฉพาะ admin) — โชว์จุดแดงบนรูปโปรไฟล์ */
  pendingReports: number
  onOpenMyProfile: () => void
  onEditProfile: () => void
  onReportBug: () => void
  onOpenAdmin: () => void
  onSupport: () => void
}

const THEMES: { value: ThemePref; label: string; icon: ReactNode }[] = [
  { value: 'light', label: 'สว่าง', icon: <Sun size={15} /> },
  { value: 'dark', label: 'มืด', icon: <Moon size={15} /> },
  { value: 'system', label: 'ตามระบบ', icon: <Monitor size={15} /> },
]

const LANGS: { value: Lang; label: string }[] = [
  { value: 'th', label: 'ไทย' },
  { value: 'en', label: 'English' },
]

// ปุ่มโปรไฟล์ลอยมุมขวาบน แบบ Google Maps
export function AccountMenu({ pendingReports, onOpenMyProfile, onEditProfile, onReportBug, onOpenAdmin, onSupport }: Props) {
  const { session, profile, email, isAdmin, loading, signInWithGoogle, signOut, openTerms } = useAuth()
  const { t, lang, setLang } = useI18n()
  const { pref, setThemePref } = useTheme()
  const [open, setOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [devicesOpen, setDevicesOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const { unread } = useNotifications()
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return
      // เบราว์เซอร์ที่ยังให้ชั้น animation (เปลี่ยนธีม/ภาษา) รับคลิก — target จะเป็น <html> เช็กจากตำแหน่งที่กดแทน
      const inside = [rootRef.current, menuRef.current].some((el) => {
        const r = el?.getBoundingClientRect()
        return r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
      })
      if (!inside) setOpen(false)
    }
    // คลิกในเมนูระหว่าง animation โดน <html> แทนปุ่ม → ข้าม animation แล้วกดปุ่มตรงตำแหน่งนั้นให้
    const replayClick = (e: globalThis.MouseEvent) => {
      if (e.target !== document.documentElement || !menuRef.current) return
      const r = menuRef.current.getBoundingClientRect()
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return
      const { clientX, clientY } = e
      const press = async () => {
        // คลิกก่อนหน้าที่ส่งต่อไปอาจเพิ่งเริ่ม animation ใหม่ — ข้ามจนไม่เหลือตัวไหนเล่นอยู่
        for (let skip = skipActiveTransition(); skip; skip = skipActiveTransition()) await skip
        const target = document.elementFromPoint(clientX, clientY)?.closest('button')
        if (target && menuRef.current?.contains(target)) target.click()
      }
      press()
    }
    window.addEventListener('click', replayClick)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('click', replayClick)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pick = (action: () => void) => () => {
    setOpen(false)
    action()
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={session ? t('บัญชีของ {name}', { name: profile?.displayName ?? '' }) : t('เมนูบัญชี')}
        className="relative flex size-12 items-center justify-center rounded-full bg-surface shadow-md ring-1 ring-stone-200 transition hover:ring-4 hover:ring-orange-100 active:scale-90"
      >
        {session ? (
          <UserAvatar name={profile?.displayName} url={profile?.avatarUrl} className="size-10 text-base" />
        ) : (
          <UserRound size={22} className="text-stone-600" />
        )}
        {session && unread > 0 && (
          <span
            className="absolute -top-1 -left-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[11px] font-bold text-white ring-2 ring-surface"
            aria-label={t('การแจ้งเตือนใหม่ {n} รายการ', { n: unread })}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
        {isAdmin && pendingReports > 0 && (
          <span className="absolute top-0 right-0 flex size-3" aria-hidden="true">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex size-3 rounded-full bg-red-500 ring-2 ring-surface" />
          </span>
        )}
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute top-14 right-0 z-40 max-h-[calc(100dvh-5.5rem)] w-76 max-w-[calc(100vw-2rem)] origin-top-right animate-pop-in overflow-y-auto overscroll-contain rounded-2xl bg-surface py-2 shadow-xl ring-1 ring-stone-200"
        >
          {session ? (
            <div className="flex items-center gap-3 px-4 pt-2 pb-3">
              <UserAvatar name={profile?.displayName} url={profile?.avatarUrl} className="size-11 text-lg" />
              <div className="min-w-0">
                <p className="truncate font-medium text-stone-900">{profile?.displayName ?? '…'}</p>
                <p className="truncate text-xs text-stone-500">{email}</p>
                {isAdmin && (
                  <span className="mt-1 inline-block rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-800">
                    {t('เจ้าของแพลตฟอร์ม')}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="px-4 pt-1 pb-3">
              <p className="text-sm text-stone-600">{t('เข้าสู่ระบบเพื่อปักหมุดแมว รีวิว และบันทึกว่าเจอน้อง')}</p>
            </div>
          )}

          {session ? (
            <MenuSection title={t('บัญชี')}>
              <MenuItem icon={<Bell size={18} />} onClick={pick(() => setNotificationsOpen(true))}>
                <span className="flex flex-1 items-center justify-between">
                  {t('การแจ้งเตือน')}
                  {unread > 0 && (
                    <span className="rounded-full bg-orange-500 px-1.5 text-xs leading-5 font-medium text-white">{unread}</span>
                  )}
                </span>
              </MenuItem>
              <MenuItem icon={<IdCard size={18} />} onClick={pick(onOpenMyProfile)}>
                {t('โปรไฟล์และประวัติรีวิว')}
              </MenuItem>
              <MenuItem icon={<Pencil size={18} />} onClick={pick(onEditProfile)}>
                {t('แก้ไขโปรไฟล์')}
              </MenuItem>
              <MenuItem icon={<MonitorSmartphone size={18} />} onClick={pick(() => setDevicesOpen(true))}>
                {t('อุปกรณ์ที่เข้าสู่ระบบ')}
              </MenuItem>
            </MenuSection>
          ) : (
            <div className="border-t border-stone-100 py-1">
              <MenuItem icon={<LogIn size={18} />} onClick={pick(signInWithGoogle)} disabled={loading}>
                {t('เข้าสู่ระบบด้วย Google')}
              </MenuItem>
            </div>
          )}

          {isAdmin && (
            <MenuSection title={t('ผู้ดูแลระบบ')}>
              <MenuItem icon={<Inbox size={18} />} onClick={pick(onOpenAdmin)}>
                <span className="flex flex-1 items-center justify-between">
                  {t('จัดการรายงาน')}
                  {pendingReports > 0 && (
                    <span className="rounded-full bg-red-500 px-1.5 text-xs leading-5 font-medium text-white">
                      {pendingReports}
                    </span>
                  )}
                </span>
              </MenuItem>
            </MenuSection>
          )}

          <MenuSection title={t('ช่วยเหลือ')}>
            <MenuItem icon={<Bug size={18} />} onClick={pick(onReportBug)}>
              {t('รายงานปัญหา / เสนอไอเดีย')}
            </MenuItem>
            <MenuItem icon={<HeartHandshake size={18} className="text-orange-500" />} onClick={pick(onSupport)}>
              {t('สนับสนุนทีมงาน')}
            </MenuItem>
          </MenuSection>

          <MenuSection title={t('การแสดงผล')}>
            <div className="flex flex-col gap-3 px-4 pt-1 pb-2">
              <Segmented
                label={t('ธีม')}
                icon={pref === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
                options={THEMES.map((o) => ({ ...o, label: t(o.label) }))}
                value={pref}
                onChange={(value, e) => setThemePref(value, { x: e.clientX, y: e.clientY })}
              />
              <Segmented
                label={t('ภาษา')}
                icon={<Languages size={16} />}
                options={LANGS}
                value={lang}
                onChange={setLang}
              />
            </div>
          </MenuSection>

          {session && (
            <div className="border-t border-stone-100 py-1">
              <MenuItem icon={<LogOut size={18} />} onClick={pick(signOut)}>
                {t('ออกจากระบบ')}
              </MenuItem>
            </div>
          )}

          {/* ลิงก์รองไว้ท้ายเมนูแบบตัวเล็ก (เหมือน Google) ไม่ต้องแย่งที่เมนูหลัก */}
          <div className="flex items-center justify-center gap-1.5 border-t border-stone-100 px-4 pt-2.5 pb-1 text-xs text-stone-500">
            <button type="button" role="menuitem" onClick={pick(openTerms)} className="flex items-center gap-1 rounded hover:text-stone-800 hover:underline">
              <ScrollText size={13} aria-hidden="true" />
              {t('ข้อกำหนดการใช้งาน')}
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              role="menuitem"
              onClick={pick(() => setAboutOpen(true))}
              className="flex items-center gap-1 rounded hover:text-stone-800 hover:underline"
            >
              <Info size={13} aria-hidden="true" />
              {t('เกี่ยวกับเว็บไซต์')}
            </button>
          </div>
        </div>
      )}
      {notificationsOpen && session && (
        <Suspense fallback={null}>
          <NotificationsDialog onClose={() => setNotificationsOpen(false)} />
        </Suspense>
      )}
      {devicesOpen && session && (
        <Suspense fallback={null}>
          <DevicesDialog onClose={() => setDevicesOpen(false)} />
        </Suspense>
      )}
      {aboutOpen && (
        <Suspense fallback={null}>
          <AboutDialog onClose={() => setAboutOpen(false)} />
        </Suspense>
      )}
    </div>
  )
}

function MenuSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={title} className="border-t border-stone-100 py-1">
      <p className="px-4 pt-1.5 pb-0.5 text-xs font-medium text-stone-500">{title}</p>
      {children}
    </div>
  )
}

function MenuItem({
  icon,
  children,
  onClick,
  disabled,
}: {
  icon: ReactNode
  children: ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-3 px-4 py-2 text-left text-[15px] text-stone-700 hover:bg-orange-50"
    >
      <span className="text-stone-500">{icon}</span>
      {children}
    </button>
  )
}

interface SegmentedProps<T extends string> {
  label: string
  icon: ReactNode
  options: { value: T; label: string; icon?: ReactNode }[]
  value: T
  onChange: (value: T, event: MouseEvent<HTMLButtonElement>) => void
}

function Segmented<T extends string>({ label, icon, options, value, onChange }: SegmentedProps<T>) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-xs font-medium text-stone-500">
        {icon}
        {label}
      </span>
      <div className="relative flex rounded-full bg-stone-100 p-1" role="radiogroup" aria-label={label}>
        {/* แถบไฮไลต์ชิ้นเดียวเลื่อนไปหาตัวที่เลือก (ทุกช่องกว้างเท่ากัน) */}
        <span
          aria-hidden="true"
          className="absolute inset-y-1 left-1 rounded-full bg-surface shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.34,1.3,0.64,1)] motion-reduce:transition-none"
          style={{
            width: `calc((100% - 0.5rem) / ${options.length})`,
            transform: `translateX(${Math.max(0, options.findIndex((o) => o.value === value)) * 100}%)`,
          }}
        />
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={(e) => onChange(o.value, e)}
            className={`relative flex flex-1 items-center justify-center gap-1 rounded-full py-1.5 text-sm transition-colors duration-300 ${
              value === o.value ? 'font-medium text-stone-900' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            {o.icon}
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
