import { useQueryClient } from '@tanstack/react-query'
import { Camera, RotateCcw } from 'lucide-react'
import { lazy, Suspense, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useI18n } from '../../hooks/useI18n'
import { removeAvatar, updateDisplayName, uploadAvatar } from '../../lib/api'
import { Modal } from '../ui/Modal'
import { UserAvatar } from './UserAvatar'

const MAX_NAME = 40

// ตัว crop รูปโหลดเฉพาะตอนเปลี่ยนรูปโปรไฟล์ ไม่ต้องโหลดตั้งแต่เปิดแอป
const AvatarCropper = lazy(() => import('./AvatarCropper').then((m) => ({ default: m.AvatarCropper })))

export function ProfileDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n()
  const { userId, profile, email } = useAuth()
  const queryClient = useQueryClient()
  const [name, setName] = useState(profile?.displayName ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  // ชื่อ/รูปของเราแสดงอยู่หลายที่ (หมุด รีวิว หน้าโปรไฟล์) → โหลดใหม่ทั้งหมด
  const refreshEverywhere = async () => {
    await queryClient.invalidateQueries({ queryKey: ['profile', userId] })
    for (const key of ['cats', 'cat', 'reviews', 'userProfile']) queryClient.invalidateQueries({ queryKey: [key] })
  }

  const onPickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) setCropFile(file)
  }

  const saveAvatar = async (image: Blob) => {
    if (!userId) return
    await uploadAvatar(userId, image, profile?.avatarPath ?? null)
    await refreshEverywhere()
    setCropFile(null)
  }

  const revertToGooglePhoto = async () => {
    if (!userId || !profile?.avatarPath) return
    setError(null)
    try {
      await removeAvatar(userId, profile.avatarPath)
      await refreshEverywhere()
    } catch (err) {
      setError(t(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ'))
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return setError(t('ใส่ชื่อที่จะแสดงก่อน'))
    if (!userId) return
    setSaving(true)
    try {
      if (trimmed !== profile?.displayName) await updateDisplayName(userId, trimmed)
      await refreshEverywhere()
      onSaved()
    } catch (err) {
      setError(t(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ'))
      setSaving(false)
    }
  }

  if (cropFile) {
    return (
      <Suspense fallback={null}>
        <AvatarCropper file={cropFile} onCancel={() => setCropFile(null)} onCropped={saveAvatar} />
      </Suspense>
    )
  }

  return (
    <Modal title={t('แก้ไขโปรไฟล์')} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="group relative shrink-0 rounded-full"
            aria-label={t('เปลี่ยนรูปโปรไฟล์')}
          >
            <UserAvatar name={name || profile?.displayName} url={profile?.avatarUrl} className="size-20 text-3xl" />
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 text-white opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
              <Camera size={24} aria-hidden="true" />
            </span>
            <span className="absolute -right-1 -bottom-1 flex size-8 items-center justify-center rounded-full bg-orange-500 text-white ring-3 ring-surface transition group-hover:scale-110">
              <Camera size={15} aria-hidden="true" />
            </span>
          </button>
          <div className="flex min-w-0 flex-col items-start gap-1.5 text-sm text-stone-500">
            <p className="max-w-full truncate">{email}</p>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="font-medium text-orange-700 hover:underline"
            >
              {t('อัปโหลดรูปใหม่')}
            </button>
            {profile?.avatarPath && (
              <button
                type="button"
                onClick={revertToGooglePhoto}
                className="flex items-center gap-1 text-stone-600 hover:underline"
              >
                <RotateCcw size={13} aria-hidden="true" />
                {t('กลับไปใช้รูปจาก Google')}
              </button>
            )}
          </div>
          <input ref={fileInput} type="file" accept="image/*" hidden onChange={onPickFile} />
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-stone-700">{t('ชื่อที่แสดง')}</span>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setError(null)
            }}
            maxLength={MAX_NAME}
            placeholder={t('ทาสแมวแห่งบางลำพู')}
            aria-invalid={error !== null}
            className={`w-full rounded-xl border bg-surface px-3.5 py-2.5 text-[15px] text-stone-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200 ${
              error ? 'border-red-400' : 'border-stone-300'
            }`}
          />
          <span className="flex justify-between text-xs text-stone-500">
            <span>{t('ชื่อนี้จะแสดงตอนคุณปักหมุดแมวและเขียนรีวิว')}</span>
            <span>
              {name.length}/{MAX_NAME}
            </span>
          </span>
          {error && <span className="text-sm text-red-600">{error}</span>}
        </label>
        <button
          type="submit"
          disabled={saving}
          className="h-12 rounded-full bg-orange-500 font-medium text-white transition active:scale-95 hover:bg-orange-600 disabled:opacity-70"
        >
          {saving ? t('กำลังบันทึก…') : t('บันทึก')}
        </button>
      </form>
    </Modal>
  )
}
