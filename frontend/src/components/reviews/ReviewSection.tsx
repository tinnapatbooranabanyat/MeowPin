import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { deleteReview, fetchReviews } from '../../lib/api'
import { timeAgo } from '../../lib/cat'
import type { Cat, Review } from '../../types'
import { UserAvatar } from '../account/UserAvatar'
import { PawRating } from './PawRating'
import { ReviewForm } from './ReviewForm'
import { useI18n } from '../../hooks/useI18n'

export function ReviewSection({ cat }: { cat: Cat }) {
  const { t, lang } = useI18n()
  const { userId, isAdmin, requireLogin } = useAuth()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const reviews = useQuery({ queryKey: ['reviews', cat.id], queryFn: () => fetchReviews(cat.id) })
  const mine = reviews.data?.find((r) => r.userId === userId)

  // รีวิวเปลี่ยน → ค่าเฉลี่ยอุ้งเท้าในหมุด/แผงแมวต้องโหลดใหม่ด้วย
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['reviews', cat.id] })
    queryClient.invalidateQueries({ queryKey: ['cats'] })
    queryClient.invalidateQueries({ queryKey: ['cat', cat.id] })
  }

  const startWriting = () => {
    if (requireLogin(t('เข้าสู่ระบบเพื่อรีวิวความน่ารักของ{name}', { name: cat.name }))) setEditing(true)
  }

  const remove = async (review: Review) => {
    if (!window.confirm(t('ลบรีวิวนี้?'))) return
    await deleteReview(review.id)
    refresh()
  }

  const recommendPct = cat.reviewCount ? Math.round((cat.recommendCount / cat.reviewCount) * 100) : 0

  return (
    <section aria-labelledby="reviews-heading" className="flex flex-col gap-3 border-t border-stone-100 pt-4">
      <div className="flex items-center justify-between">
        <h3 id="reviews-heading" className="font-display text-lg text-stone-900">
          {t('รีวิวความน่ารัก')}
        </h3>
        {!editing && (
          <button
            type="button"
            onClick={startWriting}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-orange-700 ring-1 ring-orange-300 hover:bg-orange-50"
          >
            <Pencil size={14} aria-hidden="true" />
            {t(mine ? 'แก้ไขรีวิวของคุณ' : 'เขียนรีวิว')}
          </button>
        )}
      </div>

      {cat.reviewCount > 0 ? (
        <div className="flex items-center gap-4 rounded-2xl bg-orange-50 p-3.5">
          <div className="text-center">
            <p className="font-display text-3xl text-stone-900">{cat.pawAvg?.toFixed(1)}</p>
            <PawRating value={cat.pawAvg ?? 0} size={14} />
          </div>
          <div className="flex-1 text-sm text-stone-700">
            <p>{t('{n} รีวิว', { n: cat.reviewCount })}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <ThumbsUp size={14} className="text-emerald-600" aria-hidden="true" />
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-200">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${recommendPct}%` }} />
              </div>
              <span className="w-24 text-right text-xs">{t('แนะนำ {n}%', { n: recommendPct })}</span>
            </div>
          </div>
        </div>
      ) : (
        !editing && <p className="text-sm text-stone-500">{t('ยังไม่มีรีวิว มาเป็นคนแรกที่บอกว่าน้องน่ารักแค่ไหน')}</p>
      )}

      {editing && (
        <ReviewForm
          catId={cat.id}
          existing={mine}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            refresh()
          }}
        />
      )}

      <ul className="flex flex-col gap-3">
        {reviews.data?.map((review) => (
          <li key={review.id} className="flex gap-3">
            <UserAvatar name={review.author?.displayName} url={review.author?.avatarUrl} className="size-9 text-sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-stone-900">
                  {review.author?.displayName ?? t('ผู้ใช้')}
                  {review.userId === userId && <span className="font-normal text-stone-500"> {t('(คุณ)')}</span>}
                </span>
                <span className="shrink-0 text-xs text-stone-500">{timeAgo(review.createdAt, lang)}</span>
                {(review.userId === userId || isAdmin) && (
                  <button
                    type="button"
                    onClick={() => remove(review)}
                    className="ml-auto rounded-full p-1 text-stone-400 hover:bg-red-50 hover:text-red-600"
                    aria-label={t('ลบรีวิว')}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
              <div className="mt-0.5 flex items-center gap-2">
                <PawRating value={review.paws} size={14} />
                <span
                  className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    review.recommend ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-700'
                  }`}
                >
                  {review.recommend ? <ThumbsUp size={11} /> : <ThumbsDown size={11} />}
                  {t(review.recommend ? 'แนะนำ' : 'ไม่แนะนำ')}
                </span>
              </div>
              {review.comment && <p className="mt-1 text-sm whitespace-pre-wrap text-stone-700">{review.comment}</p>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
