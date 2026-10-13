import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type ChangeEvent } from 'react'
import { ApiError, uploadCatPhoto } from '../lib/api'
import { UPLOAD_ACCEPT } from '../lib/device'
import { confirmAction } from '../lib/dialogs'
import { getCurrentPosition } from '../lib/geo'
import { compressPhoto } from '../lib/photo'
import type { Cat } from '../types'
import { useAuth } from './useAuth'
import { useI18n } from './useI18n'
import { useRefreshMissions } from './useMissions'

const MAX_FILES = 6

/** เพิ่มรูปเข้าอัลบั้มของน้อง โดยไม่ต้องเขียนรีวิว — คืนปุ่มเปิดเลือกรูป + input ที่ต้องวางไว้ในหน้า */
export function useAddCatPhotos(cat: Cat) {
  const { t, lang } = useI18n()
  const { requireLogin } = useAuth()
  const queryClient = useQueryClient()
  const refreshMissions = useRefreshMissions()
  const inputRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  const pick = () => {
    if (progress) return
    if (!requireLogin(t('เข้าสู่ระบบเพื่อเพิ่มรูปน้อง{name}', { name: cat.name }))) return
    // เรียกใน gesture เดียวกับที่ผู้ใช้กด ไม่งั้น Safari บล็อกหน้าต่างเลือกไฟล์
    inputRef.current?.click()
  }

  const upload = async (files: File[]) => {
    setMessage(null)
    setProgress({ done: 0, total: files.length })
    let added = 0
    let lastError: string | null = null
    // ตำแหน่งตอนนี้ (ไม่บังคับ) — อยู่ใกล้น้องถึงจะนับเข้าสมุดสะสม
    const fix = await getCurrentPosition(8000)
    for (const [i, file] of files.entries()) {
      try {
        const photo = await compressPhoto(file)
        try {
          await uploadCatPhoto(cat.id, photo, undefined, false, fix)
          added++
        } catch (err) {
          if (!(err instanceof ApiError && err.code === 'not_cat')) throw err
          // ระบบไม่แน่ใจว่าเป็นแมว → ให้ผู้ใช้ยืนยันเอง (ผู้ดูแลตรวจอีกที)
          const ok = await confirmAction({
            title: t('ระบบไม่แน่ใจว่ารูปนี้เป็นแมว'),
            message: t('ถ้าเป็นน้องแมวจริงๆ กดยืนยันเพื่ออัปโหลด ผู้ดูแลจะตรวจอีกที'),
            confirmLabel: t('เป็นแมวจริง อัปโหลดเลย'),
          })
          if (ok) {
            await uploadCatPhoto(cat.id, photo, undefined, true, fix)
            added++
          }
        }
      } catch (err) {
        lastError =
          err instanceof ApiError && lang === 'en' && err.messageEn
            ? err.messageEn
            : t(err instanceof Error ? err.message : 'อัปโหลดรูปไม่สำเร็จ ลองใหม่อีกครั้ง')
      }
      setProgress({ done: i + 1, total: files.length })
    }
    setProgress(null)
    if (added) {
      queryClient.invalidateQueries({ queryKey: ['catPhotos', cat.id] })
      refreshMissions()
    }
    if (lastError) setMessage({ tone: 'error', text: lastError })
    else if (added) setMessage({ tone: 'ok', text: t('เพิ่มรูปแล้ว {n} รูป ขอบคุณที่แชร์นะ', { n: added }) })
  }

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])].slice(0, MAX_FILES)
    e.target.value = ''
    if (files.length) void upload(files)
  }

  const input = <input ref={inputRef} type="file" accept={UPLOAD_ACCEPT} multiple hidden onChange={onChange} />

  return { pick, input, progress, message }
}
