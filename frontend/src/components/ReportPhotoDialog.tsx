import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useI18n } from '../hooks/useI18n'
import { reportPhoto } from '../lib/api'
import { PHOTO_REPORT_REASONS } from '../lib/cat'
import type { PhotoReportReason } from '../types'
import { Modal } from './ui/Modal'

export function ReportPhotoDialog({ catId, photoRef, onClose }: { catId: string; photoRef: string; onClose: () => void }) {
  const { t } = useI18n()
  const [reason, setReason] = useState<PhotoReportReason | null>(null)
  const [details, setDetails] = useState('')
  const [sent, setSent] = useState(false)
  const send = useMutation({ mutationFn: () => reportPhoto(catId, photoRef, reason!, details.trim()), onSuccess: () => setSent(true) })

  return (
    <Modal title={t('รายงานรูปนี้')} onClose={onClose}>
      {sent ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <p className="text-stone-700">{t('ส่งรายงานแล้ว ผู้ดูแลจะตรวจสอบรูปนี้')}</p>
          <button type="button" onClick={onClose} className="rounded-full px-5 py-2 font-medium text-stone-700 ring-1 ring-stone-300">
            {t('ปิด')}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5" role="radiogroup" aria-label={t('เหตุผล')}>
            {(Object.keys(PHOTO_REPORT_REASONS) as PhotoReportReason[]).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={reason === value}
                onClick={() => setReason(value)}
                className={`rounded-xl px-3.5 py-2.5 text-left text-sm ring-1 ${
                  reason === value ? 'bg-red-50 font-medium text-red-800 ring-red-300' : 'text-stone-700 ring-stone-200 hover:bg-stone-50'
                }`}
              >
                {t(PHOTO_REPORT_REASONS[value])}
              </button>
            ))}
          </div>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={2}
            maxLength={300}
            placeholder={t('รายละเอียดเพิ่มเติม (ไม่บังคับ)')}
            className="w-full resize-none rounded-xl border border-stone-300 bg-surface px-3.5 py-2.5 text-sm text-stone-800 outline-none focus:border-red-400"
          />
          {send.error && <p className="text-sm text-red-700">{t(send.error.message)}</p>}
          <button
            type="button"
            disabled={!reason || send.isPending}
            onClick={() => send.mutate()}
            className="h-11 rounded-full bg-red-600 font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {t('ส่งรายงาน')}
          </button>
        </div>
      )}
    </Modal>
  )
}
