import { Eye, Flag, Heart, MapPin, Navigation, Scissors, Share2, ShieldCheck, Trash2, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useI18n } from '../hooks/useI18n'
import { useMapActions } from '../hooks/useMapActions'
import { directionsUrl, FUR_COLORS, NEUTERED, timeAgo, TRAITS, VERIFICATION } from '../lib/cat'
import type { Cat } from '../types'
import { CatAvatar } from './CatAvatar'
import { PawBurst } from './PawBurst'
import { PawRating } from './reviews/PawRating'
import { ReviewSection } from './reviews/ReviewSection'

interface Props {
  cat: Cat
  onSighting: (cat: Cat) => Promise<boolean>
  onShare: (cat: Cat) => void
  onDelete: (cat: Cat) => void
  onReport: (cat: Cat) => void
}

const actionClass =
  'flex flex-1 flex-col items-center gap-1 rounded-2xl py-2.5 text-xs font-medium transition active:scale-95'

export function CatDetails({ cat, onSighting, onShare, onDelete, onReport }: Props) {
  const { isAdmin } = useAuth()
  const { t, lang } = useI18n()
  const { openProfile } = useMapActions()
  const verification = VERIFICATION[cat.verification]
  const traits = TRAITS.filter((trait) => cat[trait.key])
  const [burst, setBurst] = useState(0)

  const sighting = async () => {
    if (await onSighting(cat)) setBurst((n) => n + 1)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-4">
        <CatAvatar cat={cat} className="size-20 shrink-0 rounded-2xl" iconSize={36} />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl text-stone-900">{cat.name}</h2>
          {cat.reviewCount > 0 && (
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-stone-700">
              <span className="font-medium">{cat.pawAvg?.toFixed(1)}</span>
              <PawRating value={cat.pawAvg ?? 0} size={14} />
              <span className="text-stone-500">({cat.reviewCount})</span>
            </p>
          )}
          <p className="mt-0.5 flex items-center gap-1 text-sm text-stone-600">
            <MapPin size={14} className="shrink-0" aria-hidden="true" />
            <span className="truncate">{cat.placeName || t('ไม่ระบุสถานที่')}</span>
          </p>
          <p className="mt-0.5 text-sm text-stone-500">
            {t('แมว{fur} · เจอล่าสุด {when}', {
              fur: t(FUR_COLORS[cat.furColor].label),
              when: timeAgo(cat.lastSeenAt, lang),
            })}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
          <ShieldCheck size={13} aria-hidden="true" />
          {t('แมวจริง {n}%', { n: Math.round(cat.catConfidence * 100) })}
        </span>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${verification.className}`}>
          {t(verification.label)}
        </span>
        <span className="flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-800">
          <Eye size={13} aria-hidden="true" />
          {t('เจอแล้ว {n} ครั้ง', { n: cat.sightings })}
        </span>
      </div>

      <div className="flex gap-2">
        <a
          href={directionsUrl(cat)}
          target="_blank"
          rel="noreferrer"
          className={`${actionClass} bg-orange-500 text-white hover:bg-orange-600`}
        >
          <Navigation size={20} aria-hidden="true" />
          {t('นำทาง')}
        </a>
        <button
          type="button"
          onClick={sighting}
          className={`${actionClass} relative bg-orange-50 text-orange-800 hover:bg-orange-100`}
        >
          <Eye size={20} aria-hidden="true" key={burst} className={burst ? 'animate-wiggle' : undefined} />
          {t('ฉันเจอด้วย')}
          {burst > 0 && <PawBurst key={burst} />}
        </button>
        <button
          type="button"
          onClick={() => onShare(cat)}
          className={`${actionClass} bg-orange-50 text-orange-800 hover:bg-orange-100`}
        >
          <Share2 size={20} aria-hidden="true" />
          {t('แชร์')}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {traits.map((trait) => (
          <span
            key={trait.key}
            className="flex items-center gap-1 rounded-full bg-pink-50 px-2.5 py-1 text-xs font-medium text-pink-800 ring-1 ring-pink-200"
          >
            <Heart size={12} aria-hidden="true" />
            {t(trait.label)}
          </span>
        ))}
        <span
          className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${NEUTERED[cat.neutered].className}`}
        >
          <Scissors size={12} aria-hidden="true" />
          {t(NEUTERED[cat.neutered].short)}
        </span>
      </div>

      <p className="text-[15px] leading-relaxed whitespace-pre-line text-stone-700">
        {cat.description || t('ยังไม่มีคำอธิบาย')}
      </p>

      <div className="flex items-center justify-between gap-2 text-xs text-stone-500">
        <p className="flex min-w-0 items-center gap-1.5">
          <UserRound size={13} className="shrink-0" aria-hidden="true" />
          {cat.createdBy ? (
            <button
              type="button"
              onClick={() => openProfile(cat.createdBy!)}
              className="truncate text-left hover:text-stone-800 hover:underline"
            >
              {t('ปักหมุดโดย {name}', { name: cat.createdByName ?? t('ผู้ใช้') })}
            </button>
          ) : (
            <span className="truncate">{t('ปักหมุดโดย {name}', { name: t('ทีม MeowPin') })}</span>
          )}
        </p>
        <button
          type="button"
          onClick={() => onReport(cat)}
          className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-stone-500 hover:bg-red-50 hover:text-red-700"
        >
          <Flag size={13} aria-hidden="true" />
          {t('รายงานหมุดนี้')}
        </button>
      </div>

      <ReviewSection cat={cat} />

      {isAdmin && (
        <button
          type="button"
          onClick={() => onDelete(cat)}
          className="flex items-center justify-center gap-1.5 rounded-full py-2 text-sm font-medium text-red-700 ring-1 ring-red-200 hover:bg-red-50"
        >
          <Trash2 size={15} aria-hidden="true" />
          {t('ลบหมุดนี้ (เจ้าของแพลตฟอร์ม)')}
        </button>
      )}
    </div>
  )
}
