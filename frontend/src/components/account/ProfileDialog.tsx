import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { updateDisplayName } from '../../lib/api'
import { Modal } from '../ui/Modal'
import { UserAvatar } from './UserAvatar'
import { useI18n } from '../../hooks/useI18n'

const MAX_NAME = 40

export function ProfileDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n()
  const { userId, profile, email } = useAuth()
  const queryClient = useQueryClient()
  const [name, setName] = useState(profile?.displayName ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return setError(t('ใส่ชื่อที่จะแสดงก่อน'))
    if (!userId) return
    setSaving(true)
    try {
      await updateDisplayName(userId, trimmed)
      await queryClient.invalidateQueries({ queryKey: ['profile', userId] })
      // ชื่อคนปักหมุด/คนรีวิวในแผงแมวต้องอัปเดตตามด้วย
      queryClient.invalidateQueries({ queryKey: ['cats'] })
      queryClient.invalidateQueries({ queryKey: ['cat'] })
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
      onSaved()
    } catch (err) {
      setError(t(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ'))
      setSaving(false)
    }
  }

  return (
    <Modal title={t('แก้ไขโปรไฟล์')} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <div className="flex items-center gap-4">
          <UserAvatar name={name || profile?.displayName} url={profile?.avatarUrl} className="size-16 text-2xl" />
          <div className="min-w-0 text-sm text-stone-500">
            <p className="truncate">{email}</p>
            <p>{t('รูปโปรไฟล์ใช้จากบัญชี Google')}</p>
          </div>
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
          className="h-12 rounded-full bg-orange-500 font-medium text-white hover:bg-orange-600 disabled:opacity-70"
        >
          {saving ? t('กำลังบันทึก…') : t('บันทึก')}
        </button>
      </form>
    </Modal>
  )
}
