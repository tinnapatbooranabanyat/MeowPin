import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Flag, Heart, LoaderCircle, MessageCircle, Send, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useI18n } from '../../hooks/useI18n'
import { addReviewReply, deleteReviewReply, reportReview, setReviewLike } from '../../lib/api'
import { timeAgo } from '../../lib/cat'
import type { Review, ReviewReportReason, ReviewSocial } from '../../types'
import { UserAvatar } from '../account/UserAvatar'
import { TranslatableText } from '../TranslatableText'
import { Modal } from '../ui/Modal'
import { confirmAction } from '../../lib/dialogs'

const REASONS: { value: ReviewReportReason; label: string }[] = [
  { value: 'spam', label: 'สแปม / โฆษณา' },
  { value: 'inappropriate', label: 'หยาบคายหรือไม่เหมาะสม' },
  { value: 'harassment', label: 'กลั่นแกล้งหรือคุกคามคนอื่น' },
  { value: 'false_info', label: 'ข้อมูลเท็จ' },
  { value: 'other', label: 'อื่นๆ' },
]

/** ใต้รีวิวแต่ละอัน: ถูกใจ · ตอบกลับ · รายงาน */
export function ReviewSocialBar({ review, social, catId }: { review: Review; social: ReviewSocial | undefined; catId: string }) {
  const { t, lang } = useI18n()
  const { userId, isAdmin, requireLogin } = useAuth()
  const queryClient = useQueryClient()
  const [showReplies, setShowReplies] = useState(false)
  const [reply, setReply] = useState('')
  const [reporting, setReporting] = useState(false)
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['reviewSocial', catId] })
  const likes = social?.likes ?? 0
  const liked = social?.liked ?? false
  const replies = social?.replies ?? []

  const like = useMutation({ mutationFn: () => setReviewLike(review.id, !liked), onSuccess: refresh })
  const send = useMutation({
    mutationFn: () => addReviewReply(review.id, reply.trim()),
    onSuccess: () => {
      setReply('')
      refresh()
    },
  })
  const removeReply = useMutation({ mutationFn: deleteReviewReply, onSuccess: refresh })

  return (
    <div className="mt-2">
      <div className="flex items-center gap-1 text-xs text-stone-500">
        <button
          type="button"
          disabled={like.isPending || review.userId === userId}
          onClick={() => requireLogin(t('เข้าสู่ระบบเพื่อกดถูกใจรีวิว')) && like.mutate()}
          aria-pressed={liked}
          className={`flex items-center gap-1 rounded-full px-2 py-1 transition hover:bg-stone-100 disabled:cursor-default disabled:hover:bg-transparent ${
            liked ? 'text-red-600' : ''
          }`}
          title={t(review.userId === userId ? 'กดถูกใจรีวิวของตัวเองไม่ได้' : liked ? 'เลิกถูกใจ' : 'ถูกใจ')}
        >
          <Heart size={14} className={liked ? 'fill-current' : ''} aria-hidden="true" />
          {likes > 0 ? likes : t('ถูกใจ')}
        </button>
        <button
          type="button"
          onClick={() => setShowReplies((v) => !v)}
          aria-expanded={showReplies}
          className="flex items-center gap-1 rounded-full px-2 py-1 transition hover:bg-stone-100"
        >
          <MessageCircle size={14} aria-hidden="true" />
          {replies.length > 0 ? t('{n} ความเห็น', { n: replies.length }) : t('ตอบกลับ')}
        </button>
        {review.userId !== userId && (
          <button
            type="button"
            onClick={() => requireLogin(t('เข้าสู่ระบบเพื่อรายงานรีวิว')) && setReporting(true)}
            className="ml-auto flex items-center gap-1 rounded-full px-2 py-1 transition hover:bg-stone-100 hover:text-red-600"
            aria-label={t('รายงานรีวิวนี้')}
          >
            <Flag size={13} aria-hidden="true" />
          </button>
        )}
      </div>

      {showReplies && (
        <div className="mt-1 flex animate-fade-in flex-col gap-2 border-l-2 border-stone-100 pl-3">
          {replies.map((r) => (
            <div key={r.id} className="flex gap-2">
              <UserAvatar name={r.author?.displayName} url={r.author?.avatarUrl} className="size-6 shrink-0 text-[11px]" />
              <div className="min-w-0 flex-1">
                <p className="text-xs">
                  <span className="font-medium text-stone-900">{r.author?.displayName ?? t('ผู้ใช้')}</span>
                  <span className="text-stone-500"> · {timeAgo(r.createdAt, lang)}</span>
                  {(r.userId === userId || isAdmin) && (
                    <button
                      type="button"
                      onClick={async () =>
                        (await confirmAction({ title: t('ลบความเห็นนี้?'), confirmLabel: t('ลบ'), tone: 'danger' })) && removeReply.mutate(r.id)
                      }
                      className="ml-1 inline-flex align-middle text-stone-400 hover:text-red-600"
                      aria-label={t('ลบความเห็น')}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </p>
                <TranslatableText text={r.body} className="text-sm text-stone-700" />
              </div>
            </div>
          ))}
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (!reply.trim() || send.isPending) return
              if (requireLogin(t('เข้าสู่ระบบเพื่อตอบกลับรีวิว'))) send.mutate()
            }}
          >
            <input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              maxLength={500}
              placeholder={t('เขียนความเห็น…')}
              className="h-9 min-w-0 flex-1 rounded-full border border-stone-300 bg-surface px-3.5 text-sm text-stone-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200"
            />
            <button
              type="submit"
              disabled={!reply.trim() || send.isPending}
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50"
              aria-label={t('ส่ง')}
            >
              {send.isPending ? <LoaderCircle size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </form>
          {send.error && <p className="text-xs text-red-700">{t(send.error.message)}</p>}
        </div>
      )}

      {reporting && <ReportReviewDialog reviewId={review.id} onClose={() => setReporting(false)} />}
    </div>
  )
}

function ReportReviewDialog({ reviewId, onClose }: { reviewId: string; onClose: () => void }) {
  const { t } = useI18n()
  const [reason, setReason] = useState<ReviewReportReason | null>(null)
  const [details, setDetails] = useState('')
  const [sent, setSent] = useState(false)
  const send = useMutation({ mutationFn: () => reportReview(reviewId, reason!, details.trim()), onSuccess: () => setSent(true) })

  return (
    <Modal title={t('รายงานรีวิวนี้')} onClose={onClose}>
      {sent ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <p className="text-stone-700">{t('ส่งรายงานแล้ว ผู้ดูแลจะตรวจสอบรีวิวนี้')}</p>
          <button type="button" onClick={onClose} className="rounded-full px-5 py-2 font-medium text-stone-700 ring-1 ring-stone-300">
            {t('ปิด')}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5" role="radiogroup" aria-label={t('เหตุผล')}>
            {REASONS.map((r) => (
              <button
                key={r.value}
                type="button"
                role="radio"
                aria-checked={reason === r.value}
                onClick={() => setReason(r.value)}
                className={`rounded-xl px-3.5 py-2.5 text-left text-sm ring-1 ${
                  reason === r.value ? 'bg-red-50 font-medium text-red-800 ring-red-300' : 'text-stone-700 ring-stone-200 hover:bg-stone-50'
                }`}
              >
                {t(r.label)}
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
