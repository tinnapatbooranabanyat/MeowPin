import { Bug, Inbox, Languages, LogIn, LogOut, Monitor, Moon, Pencil, Sun, UserRound } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useI18n } from '../../hooks/useI18n'
import { useTheme, type ThemePref } from '../../hooks/useTheme'
import type { Lang } from '../../i18n'
import { UserAvatar } from './UserAvatar'

interface Props {
  /** จำนวนรายงานที่ยังค้าง (เฉพาะ admin) — โชว์จุดแดงบนรูปโปรไฟล์ */
  pendingReports: number
  onEditProfile: () => void
  onReportBug: () => void
  onOpenAdmin: () => void
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
export function AccountMenu({ pendingReports, onEditProfile, onReportBug, onOpenAdmin }: Props) {
  const { session, profile, email, isAdmin, loading, signInWithGoogle, signOut } = useAuth()
  const { t, lang, setLang } = useI18n()
  const { pref, setThemePref } = useTheme()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', close)
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
        className="relative flex size-12 items-center justify-center rounded-full bg-surface shadow-md ring-1 ring-stone-200 hover:ring-4 hover:ring-orange-100"
      >
        {session ? (
          <UserAvatar name={profile?.displayName} url={profile?.avatarUrl} className="size-10 text-base" />
        ) : (
          <UserRound size={22} className="text-stone-600" />
        )}
        {isAdmin && pendingReports > 0 && (
          <span className="absolute top-0 right-0 size-3 rounded-full bg-red-500 ring-2 ring-surface" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-14 right-0 z-40 w-76 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl bg-surface py-2 shadow-xl ring-1 ring-stone-200"
        >
          {session ? (
            <div className="flex items-center gap-3 border-b border-stone-100 px-4 pt-2 pb-3">
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
            <div className="border-b border-stone-100 px-4 pt-1 pb-3">
              <p className="text-sm text-stone-600">{t('เข้าสู่ระบบเพื่อปักหมุดแมว รีวิว และบันทึกว่าเจอน้อง')}</p>
            </div>
          )}

          {session ? (
            <MenuItem icon={<Pencil size={18} />} onClick={pick(onEditProfile)}>
              {t('แก้ไขโปรไฟล์')}
            </MenuItem>
          ) : (
            <MenuItem icon={<LogIn size={18} />} onClick={pick(signInWithGoogle)} disabled={loading}>
              {t('เข้าสู่ระบบด้วย Google')}
            </MenuItem>
          )}
          {isAdmin && (
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
          )}
          <MenuItem icon={<Bug size={18} />} onClick={pick(onReportBug)}>
            {t('รายงานปัญหา / เสนอไอเดีย')}
          </MenuItem>

          <div className="mt-1 flex flex-col gap-3 border-t border-stone-100 px-4 pt-3 pb-2">
            <Segmented
              label={t('ธีม')}
              icon={pref === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
              options={THEMES.map((o) => ({ ...o, label: t(o.label) }))}
              value={pref}
              onChange={setThemePref}
            />
            <Segmented
              label={t('ภาษา')}
              icon={<Languages size={16} />}
              options={LANGS}
              value={lang}
              onChange={setLang}
            />
          </div>

          {session && (
            <div className="mt-1 border-t border-stone-100 pt-1">
              <MenuItem icon={<LogOut size={18} />} onClick={pick(signOut)}>
                {t('ออกจากระบบ')}
              </MenuItem>
            </div>
          )}
        </div>
      )}
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
      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[15px] text-stone-700 hover:bg-orange-50"
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
  onChange: (value: T) => void
}

function Segmented<T extends string>({ label, icon, options, value, onChange }: SegmentedProps<T>) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-xs font-medium text-stone-500">
        {icon}
        {label}
      </span>
      <div className="flex rounded-full bg-stone-100 p-1" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={`flex flex-1 items-center justify-center gap-1 rounded-full py-1.5 text-sm transition-colors ${
              value === o.value ? 'bg-surface font-medium text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
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
