import { AdvancedMarker } from '@vis.gl/react-google-maps'
import { Camera, ImageUp, X } from 'lucide-react'
import { useEffect, useRef, type ChangeEvent } from 'react'
import { useAuth } from '../hooks/useAuth'
import { wakeBackend } from '../lib/api'
import { UPLOAD_ACCEPT } from '../lib/device'
import { PawPin } from './PawPin'
import type { LatLng } from '../types'
import { useI18n } from '../hooks/useI18n'

interface Props {
  position: LatLng
  onClose: () => void
  onCamera: () => void
  onFile: (file: File) => void
}

const LOGIN_REASON = 'เข้าสู่ระบบเพื่อปักหมุดแมวที่คุณเจอ'

// หมุดที่วางจากการกดค้าง + การ์ดเลือกว่าจะถ่ายรูปหรืออัปโหลดรูป (แบบ "Dropped pin" ของ Google Maps)
export function DroppedPin({ position, onClose, onCamera, onFile }: Props) {
  const { t } = useI18n()
  const { requireLogin } = useAuth()
  // input อยู่ที่นี่ (ไม่ใช่ใน flow ที่ lazy-load) เพื่อให้ .click() เกิดใน gesture เดียวกับที่ผู้ใช้กด
  // ไม่งั้น Safari จะบล็อกหน้าต่างเลือกไฟล์
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    wakeBackend()
  }, [])

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) onFile(file)
  }

  return (
    <>
      <AdvancedMarker position={position} zIndex={1000} title={t('จุดที่เลือก')}>
        <span className="block animate-drop-in">
          <PawPin size={44} />
        </span>
      </AdvancedMarker>

      <div
        role="dialog"
        aria-label={t('ปักหมุดแมวตรงนี้')}
        className="absolute inset-x-0 bottom-0 z-30 animate-sheet-up rounded-t-3xl bg-surface md:animate-pop-in p-5 pb-7 shadow-[0_-4px_24px_rgba(0,0,0,0.12)] md:inset-x-auto md:bottom-6 md:left-1/2 md:w-[420px] md:-translate-x-1/2 md:rounded-3xl md:pb-5 md:shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg text-stone-900">{t('ปักหมุดแมวตรงนี้?')}</h2>
            <p className="text-xs text-stone-500 tabular-nums">
              {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mt-1 -mr-1 rounded-full p-1.5 text-stone-500 hover:bg-stone-100"
            aria-label={t('ยกเลิก')}
          >
            <X size={20} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => requireLogin(t(LOGIN_REASON)) && onCamera()}
            className="flex flex-col items-center gap-1.5 rounded-2xl bg-orange-500 py-3.5 font-medium text-white hover:bg-orange-600"
          >
            <Camera size={24} aria-hidden="true" />
            {t('ถ่ายรูปตอนนี้')}
            <span className="text-[11px] font-normal text-orange-100">{t('ยืนยันด้วย GPS')}</span>
          </button>
          <button
            type="button"
            onClick={() => requireLogin(t(LOGIN_REASON)) && fileInput.current?.click()}
            className="flex flex-col items-center gap-1.5 rounded-2xl bg-orange-50 py-3.5 font-medium text-orange-800 ring-1 ring-orange-200 hover:bg-orange-100"
          >
            <ImageUp size={24} aria-hidden="true" />
            {t('อัปโหลดรูป')}
            <span className="text-[11px] font-normal text-orange-700">{t('ใช้ตำแหน่งในรูปถ้ามี')}</span>
          </button>
        </div>
        {/* Android: ไม่จำกัดชนิดไฟล์ → เลือกแอปเองได้ (แกลเลอรี/Files) แทน Photo Picker ที่ลบตำแหน่ง GPS ออกจากรูป */}
        <input ref={fileInput} type="file" accept={UPLOAD_ACCEPT} hidden onChange={onFileChange} />
      </div>
    </>
  )
}
