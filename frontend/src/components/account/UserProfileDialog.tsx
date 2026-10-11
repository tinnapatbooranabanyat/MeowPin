import { useQuery } from '@tanstack/react-query'
import { CalendarDays, MapPin, Pencil, PawPrint, ThumbsDown, ThumbsUp } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useI18n } from '../../hooks/useI18n'
import { useMapActions } from '../../hooks/useMapActions'
import { fetchProfile, fetchUserCats, fetchUserReviews } from '../../lib/api'
import { furLabel, timeAgo } from '../../lib/cat'
import { CatAvatar } from '../CatAvatar'
import { PawRating } from '../reviews/PawRating'
import { Modal } from '../ui/Modal'
import { BadgeList } from './BadgeList'
import { UserAvatar } from './UserAvatar'

type Tab = 'reviews' | 'cats'

interface Props {
  userId: string
  onClose: () => void
  onEditProfile: () => void
}

// หน้าโปรไฟล์ของผู้ใช้: ประวัติรีวิว + แมวที่ปักหมุด (ดูของคนอื่นได้ด้วย)
export function UserProfileDialog({ userId, onClose, onEditProfile }: Props) {
  const { t, lang } = useI18n()
  const { userId: me } = useAuth()
  const { openCat } = useMapActions()
  const [tab, setTab] = useState<Tab>('reviews')
  const isMe = me === userId

  const profile = useQuery({ queryKey: ['userProfile', userId, 'profile'], queryFn: () => fetchProfile(userId) })
  const reviews = useQuery({ queryKey: ['userProfile', userId, 'reviews'], queryFn: () => fetchUserReviews(userId) })
  const cats = useQuery({ queryKey: ['userProfile', userId, 'cats'], queryFn: () => fetchUserCats(userId) })

  const joined = profile.data
    ? new Date(profile.data.createdAt).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-GB', {
        year: 'numeric',
        month: 'long',
      })
    : ''

  const tabClass = (active: boolean) =>
    `flex flex-1 items-center justify-center gap-1.5 border-b-2 pb-2 text-[15px] font-medium transition-colors ${
      active ? 'border-orange-500 text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-700'
    }`

  const goToCat = (catId: string) => {
    onClose()
    openCat(catId)
  }

  return (
    <Modal title={isMe ? t('โปรไฟล์ของฉัน') : t('โปรไฟล์')} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <UserAvatar
            name={profile.data?.displayName}
            url={profile.data?.avatarUrl}
            className="size-18 animate-pop-in text-3xl"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-xl text-stone-900">{profile.data?.displayName ?? '…'}</p>
            {joined && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-stone-500">
                <CalendarDays size={13} aria-hidden="true" />
                {t('เข้าร่วมเมื่อ {date}', { date: joined })}
              </p>
            )}
            <div className="mt-2 flex gap-2 text-xs">
              <span className="rounded-full bg-orange-100 px-2.5 py-1 font-medium text-orange-800">
                {t('{n} รีวิว', { n: reviews.data?.length ?? 0 })}
              </span>
              <span className="rounded-full bg-sky-100 px-2.5 py-1 font-medium text-sky-800">
                {t('ปักหมุด {n} ตัว', { n: cats.data?.length ?? 0 })}
              </span>
            </div>
          </div>
          {isMe && (
            <button
              type="button"
              onClick={onEditProfile}
              className="flex shrink-0 items-center gap-1.5 self-start rounded-full px-3 py-1.5 text-sm font-medium text-stone-700 ring-1 ring-stone-300 hover:bg-stone-50"
            >
              <Pencil size={14} aria-hidden="true" />
              {t('แก้ไข')}
            </button>
          )}
        </div>

        <BadgeList userId={userId} isMe={isMe} />

        <div className="flex border-b border-stone-200" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'reviews'} onClick={() => setTab('reviews')} className={tabClass(tab === 'reviews')}>
            <PawPrint size={16} aria-hidden="true" />
            {t('ประวัติรีวิว')}
          </button>
          <button type="button" role="tab" aria-selected={tab === 'cats'} onClick={() => setTab('cats')} className={tabClass(tab === 'cats')}>
            <MapPin size={16} aria-hidden="true" />
            {t('แมวที่ปักหมุด')}
          </button>
        </div>

        {tab === 'reviews' && (
          <ul className="flex flex-col gap-2">
            {reviews.isPending && <p className="py-6 text-center text-stone-500">{t('กำลังโหลด…')}</p>}
            {reviews.data?.length === 0 && (
              <p className="py-6 text-center text-sm text-stone-500">
                {isMe ? t('คุณยังไม่ได้รีวิวน้องแมวตัวไหนเลย') : t('ยังไม่มีรีวิว')}
              </p>
            )}
            {reviews.data?.map((r, i) => (
              <li key={r.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                <button
                  type="button"
                  onClick={() => r.cat && goToCat(r.cat.id)}
                  disabled={!r.cat}
                  className="flex w-full gap-3 rounded-2xl p-2.5 text-left ring-1 ring-stone-200 transition hover:bg-orange-50 hover:ring-orange-200 disabled:hover:bg-transparent"
                >
                  {r.cat ? (
                    <CatAvatar cat={r.cat} className="size-12 shrink-0 rounded-xl" iconSize={22} />
                  ) : (
                    <div className="size-12 shrink-0 rounded-xl bg-stone-200" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-stone-900">{r.cat?.name ?? t('หมุดถูกลบแล้ว')}</span>
                      <span className="ml-auto shrink-0 text-xs text-stone-500">{timeAgo(r.createdAt, lang)}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <PawRating value={r.paws} size={13} />
                      <span
                        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          r.recommend ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-700'
                        }`}
                      >
                        {r.recommend ? <ThumbsUp size={11} /> : <ThumbsDown size={11} />}
                        {t(r.recommend ? 'แนะนำ' : 'ไม่แนะนำ')}
                      </span>
                    </div>
                    {r.comment && <p className="mt-1 line-clamp-2 text-sm text-stone-700">{r.comment}</p>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        {tab === 'cats' && (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {cats.isPending && <p className="col-span-full py-6 text-center text-stone-500">{t('กำลังโหลด…')}</p>}
            {cats.data?.length === 0 && (
              <p className="col-span-full py-6 text-center text-sm text-stone-500">
                {isMe ? t('คุณยังไม่ได้ปักหมุดแมวเลย ลองกดค้างบนแผนที่ดูสิ') : t('ยังไม่ได้ปักหมุดแมว')}
              </p>
            )}
            {cats.data?.map((cat, i) => (
              <li key={cat.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                <button
                  type="button"
                  onClick={() => goToCat(cat.id)}
                  className="flex w-full flex-col overflow-hidden rounded-2xl text-left ring-1 ring-stone-200 transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <CatAvatar cat={cat} className="aspect-square w-full" iconSize={36} />
                  <span className="truncate px-2.5 pt-1.5 text-sm font-medium text-stone-900">{cat.name}</span>
                  <span className="truncate px-2.5 pb-2 text-xs text-stone-500">
                    {t(furLabel(cat))} · {timeAgo(cat.lastSeenAt, lang)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
