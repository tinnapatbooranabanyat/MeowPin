import { Download, LoaderCircle, Share2 } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useI18n } from '../hooks/useI18n'
import { downloadImage, shareImage } from '../lib/shareCard'
import { Modal } from './ui/Modal'

interface Props {
  title: string
  /** วาดการ์ด (เรียกครั้งเดียวตอนเปิด) */
  make: () => Promise<Blob>
  fileName: string
  /** ข้อความที่แนบไปกับรูปตอนแชร์ */
  text: string
  onClose: () => void
  /** ปุ่มเพิ่มเติมใต้ปุ่มแชร์ (เช่น แชร์ลิงก์) */
  extra?: ReactNode
}

/** ดูตัวอย่างการ์ด story แล้วแชร์ (มือถือ) หรือบันทึกรูป */
export function ShareCardDialog({ title, make, fileName, text, onClose, extra }: Props) {
  const { t } = useI18n()
  const [blob, setBlob] = useState<Blob | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let alive = true
    let objectUrl: string | null = null
    make()
      .then((b) => {
        if (!alive) return
        objectUrl = URL.createObjectURL(b)
        setBlob(b)
        setUrl(objectUrl)
      })
      .catch(() => alive && setError(true))
    return () => {
      alive = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- วาดครั้งเดียวตอนเปิด
  }, [])

  const share = async () => {
    if (!blob) return
    if (!(await shareImage(blob, fileName, text))) downloadImage(blob, fileName)
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="flex flex-col items-center gap-4">
        <div className="flex aspect-[9/16] w-full max-w-[260px] items-center justify-center overflow-hidden rounded-2xl bg-stone-100 shadow-md ring-1 ring-stone-200">
          {url ? (
            <img src={url} alt={title} className="size-full animate-fade-in object-cover" />
          ) : error ? (
            <p className="px-4 text-center text-sm text-red-700">{t('สร้างรูปไม่สำเร็จ ลองใหม่อีกครั้ง')}</p>
          ) : (
            <LoaderCircle size={28} className="animate-spin text-orange-500" aria-label={t('กำลังสร้างรูป…')} />
          )}
        </div>
        <div className="flex w-full flex-col gap-2">
          <button
            type="button"
            disabled={!blob}
            onClick={share}
            className="flex h-12 items-center justify-center gap-2 rounded-full bg-orange-500 font-medium text-white hover:bg-orange-600 disabled:opacity-50"
          >
            <Share2 size={18} aria-hidden="true" />
            {t('แชร์ลง story / แอปอื่น')}
          </button>
          <button
            type="button"
            disabled={!blob}
            onClick={() => blob && downloadImage(blob, fileName)}
            className="flex h-11 items-center justify-center gap-2 rounded-full text-sm font-medium text-stone-700 ring-1 ring-stone-300 hover:bg-stone-100 disabled:opacity-50"
          >
            <Download size={16} aria-hidden="true" />
            {t('บันทึกรูป')}
          </button>
          {extra}
        </div>
      </div>
    </Modal>
  )
}
