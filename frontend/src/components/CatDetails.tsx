import { CalendarClock, Cat as CatIcon, CircleHelp, Dna, Eye, Flag, Heart, Home, Images, MapPin, Navigation, Palette, Pencil, Scissors, Share2, ShieldCheck, Sparkles, Trash2, UserRound, X, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useI18n } from '../hooks/useI18n'
import { useCatPhotos } from '../hooks/useCatPhotos'
import { useMapActions } from '../hooks/useMapActions'
import { FUR_COLORS, NEUTERED, OWNER_STATUS, TRAITS, VERIFICATION, breedLabel, directionsUrl, furLabel, timeAgo } from '../lib/cat'
import type { Cat } from '../types'
import { AiSummary } from './AiSummary'
import { CatGallery } from './CatGallery'
import { HelpSection } from './HelpSection'
import { SightingTimes } from './SightingTimes'
import { PawBurst } from './PawBurst'
import { PhotoLightbox } from './PhotoLightbox'
import { PawRating } from './reviews/PawRating'
import { ReviewSection } from './reviews/ReviewSection'
import { TranslatableText } from './TranslatableText'

interface Props {
  cat: Cat
  onSighting: (cat: Cat) => Promise<boolean>
  onShare: (cat: Cat) => void
  onDelete: (cat: Cat) => void
  onReport: (cat: Cat) => void
  /** แผงด้านซ้าย (คอม) มีปุ่มปิดบนรูป / แผ่นด้านล่าง (มือถือ) ปิดด้วยการลาก */
  onClose?: () => void
  variant: 'panel' | 'sheet'
}

type Tab = 'overview' | 'reviews' | 'about'

// หน้าข้อมูลแมวแบบหน้าสถานที่ของ Google Maps: รูปใหญ่ → ชื่อ/คะแนน → แท็บ → ปุ่มกลม
export function CatDetails({ cat, onSighting, onShare, onDelete, onReport, onClose, variant }: Props) {
  const { isAdmin, userId } = useAuth()
  const { editCat } = useMapActions()
  // คนปักหมุดแก้ไข/ลบหมุดตัวเองได้ เจ้าของแพลตฟอร์มทำได้ทุกหมุด
  const canManage = isAdmin || (userId !== null && userId === cat.createdBy)
  const { t, lang } = useI18n()
  const { openProfile } = useMapActions()
  const [tab, setTab] = useState<Tab>('overview')
  const [burst, setBurst] = useState(0)
  const [lightbox, setLightbox] = useState<number | null>(null)
  const [gallery, setGallery] = useState(false)
  const { photos } = useCatPhotos(cat)
  const fur = FUR_COLORS[cat.furColor]
  const traits = TRAITS.filter((trait) => cat[trait.key])
  const breed = breedLabel(cat.breed, lang)

  const sighting = async () => {
    if (await onSighting(cat)) setBurst((n) => n + 1)
  }

  const subtitle = [
    t('แมว{fur}', { fur: t(furLabel(cat)) }),
    cat.ownerStatus !== 'unknown' ? t(OWNER_STATUS[cat.ownerStatus].label) : null,
    breed,
  ]
    .filter(Boolean)
    .join(' · ')

  const pinnedBy = cat.createdBy ? (
    <button
      type="button"
      onClick={() => openProfile(cat.createdBy!)}
      className="text-left font-medium text-stone-800 hover:underline"
    >
      {cat.createdByName ?? t('ผู้ใช้')}
    </button>
  ) : (
    <span className="font-medium text-stone-800">{t('ทีม MeowPin')}</span>
  )

  const tabClass = (active: boolean) =>
    `flex-1 border-b-2 pb-2.5 text-[15px] font-medium transition-colors ${
      active ? 'border-orange-500 text-orange-700' : 'border-transparent text-stone-500 hover:text-stone-800'
    }`

  return (
    <div className="flex flex-col">
      {/* ── รูปใหญ่ ── */}
      <div className={variant === 'sheet' ? 'px-4' : ''}>
        <div
          className={`relative overflow-hidden bg-stone-200 ${
            variant === 'sheet' ? 'h-44 rounded-2xl' : 'h-56'
          }`}
        >
          {cat.photoUrl ? (
            <button type="button" onClick={() => setLightbox(0)} className="block size-full" aria-label={t('ดูรูปเต็ม')}>
              <img src={cat.photoUrl} alt={cat.name} className="size-full animate-fade-in object-cover" />
            </button>
          ) : (
            <div className="flex size-full items-center justify-center" style={{ background: fur.bg, color: fur.fg }}>
              <CatIcon size={64} strokeWidth={1.6} aria-hidden="true" />
            </div>
          )}
          <span
            className={`pointer-events-none absolute bottom-2.5 left-2.5 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur ${
              cat.catCheck === 'user' ? 'bg-amber-400/90 text-amber-950' : 'bg-black/60 text-white'
            }`}
          >
            {cat.catCheck === 'user' ? (
              <CircleHelp size={13} aria-hidden="true" />
            ) : cat.catCheck === 'ai' ? (
              <Sparkles size={13} aria-hidden="true" />
            ) : (
              <ShieldCheck size={13} aria-hidden="true" />
            )}
            {cat.catCheck === 'user'
              ? t('ยังไม่ยืนยันว่าเป็นแมว')
              : cat.catCheck === 'ai'
                ? t('AI ยืนยันว่าเป็นแมว')
                : t('แมวจริง {n}%', { n: Math.round(cat.catConfidence * 100) })}
          </span>
          {photos.length > 1 && (
            <button
              type="button"
              onClick={() => setGallery(true)}
              className="absolute right-2.5 bottom-2.5 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur transition hover:bg-black/75 active:scale-95"
            >
              <Images size={13} aria-hidden="true" />
              {t('รูปทั้งหมด ({n})', { n: photos.length })}
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-black/70 active:scale-90"
              aria-label={t('ปิด')}
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* ── ชื่อ / คะแนน / ประเภท ── */}
      <div className="px-5 pt-4">
        <h2 className="font-display text-2xl leading-tight text-stone-900">{cat.name}</h2>
        {cat.reviewCount > 0 ? (
          <button
            type="button"
            onClick={() => setTab('reviews')}
            className="mt-1 flex items-center gap-1.5 text-sm text-stone-700 hover:underline"
          >
            <span className="font-medium">{cat.pawAvg?.toFixed(1)}</span>
            <PawRating value={cat.pawAvg ?? 0} size={15} />
            <span className="text-stone-500">({cat.reviewCount.toLocaleString()})</span>
          </button>
        ) : (
          <p className="mt-1 text-sm text-stone-500">{t('ยังไม่มีรีวิว')}</p>
        )}
        <p className="mt-0.5 text-sm text-stone-600">{subtitle}</p>
      </div>

      {/* ── แท็บ ── */}
      <div className="mt-3 flex border-b border-stone-200 px-5" role="tablist">
        {(
          [
            ['overview', t('ภาพรวม')],
            ['reviews', cat.reviewCount ? `${t('รีวิว')} (${cat.reviewCount})` : t('รีวิว')],
            ['about', t('เกี่ยวกับ')],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={tabClass(tab === key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div key={tab} className="animate-fade-in px-5 pt-4 pb-6">
        {tab === 'overview' && (
          <div className="flex flex-col gap-4">
            <div className="flex justify-between gap-1">
              <RoundAction
                icon={Navigation}
                label={t('นำทาง')}
                primary
                href={directionsUrl(cat)}
              />
              <RoundAction
                icon={Eye}
                label={t('ฉันเจอด้วย')}
                onClick={sighting}
                iconKey={burst}
                iconClass={burst ? 'animate-wiggle' : undefined}
              >
                {burst > 0 && <PawBurst key={burst} />}
              </RoundAction>
              <RoundAction icon={Share2} label={t('แชร์')} onClick={() => onShare(cat)} />
              {canManage ? (
                <RoundAction icon={Pencil} label={t('แก้ไข')} onClick={() => editCat(cat)} />
              ) : (
                <RoundAction icon={Flag} label={t('รายงาน')} onClick={() => onReport(cat)} />
              )}
            </div>

            <div className="flex flex-col gap-2.5 border-t border-stone-100 pt-4 text-sm text-stone-700">
              <InfoRow icon={MapPin}>{cat.placeName || t('ไม่ระบุสถานที่')}</InfoRow>
              <InfoRow icon={CalendarClock}>
                {t('เจอล่าสุด {when} · เจอแล้ว {n} ครั้ง', { when: timeAgo(cat.lastSeenAt, lang), n: cat.sightings })}
              </InfoRow>
            </div>

            {(traits.length > 0 || cat.neutered !== 'unknown') && (
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
                {cat.neutered !== 'unknown' && (
                  <span
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${NEUTERED[cat.neutered].className}`}
                  >
                    <Scissors size={12} aria-hidden="true" />
                    {t(NEUTERED[cat.neutered].short)}
                  </span>
                )}
              </div>
            )}

            {photos.length > 1 && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-stone-800">{t('รูปภาพ')}</h3>
                  <button type="button" onClick={() => setGallery(true)} className="text-xs font-medium text-orange-700 hover:underline">
                    {t('ดูทั้งหมด ({n})', { n: photos.length })}
                  </button>
                </div>
                <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
                  {photos.slice(0, 8).map((photo, i) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => setLightbox(i)}
                      className="size-24 shrink-0 overflow-hidden rounded-xl bg-stone-200 transition hover:opacity-90 active:scale-95"
                    >
                      <img src={photo.url} alt="" loading="lazy" className="size-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <HelpSection cat={cat} />

            <AiSummary cat={cat} />

            <SightingTimes catId={cat.id} />

            {cat.description ? (
              <TranslatableText text={cat.description} className="text-[15px] leading-relaxed text-stone-700" />
            ) : (
              <p className="text-sm text-stone-500">{t('ยังไม่มีคำอธิบาย')}</p>
            )}

            <p className="flex items-center gap-1.5 text-xs text-stone-500">
              <UserRound size={13} aria-hidden="true" />
              {t('ปักหมุดโดย')} {pinnedBy}
            </p>
          </div>
        )}

        {tab === 'reviews' && <ReviewSection cat={cat} />}

        {tab === 'about' && (
          <div className="flex flex-col">
            <dl className="divide-y divide-stone-100 text-sm">
              <AboutRow icon={Palette} label={t('สีขน')}>
                <span className="flex items-center gap-2">
                  <span
                    className="size-4 rounded-full ring-1 ring-black/10 dark:ring-white/30"
                    style={{ background: fur.bg }}
                    aria-hidden="true"
                  />
                  {t(furLabel(cat))}
                </span>
              </AboutRow>
              <AboutRow icon={Dna} label={t('สายพันธุ์')}>
                {breed ?? t('ไม่ระบุ')}
              </AboutRow>
              <AboutRow icon={Home} label={t('สถานะ')}>
                {t(cat.ownerStatus === 'unknown' ? 'ไม่แน่ใจ' : OWNER_STATUS[cat.ownerStatus].label)}
              </AboutRow>
              <AboutRow icon={Scissors} label={t('ทำหมัน')}>
                {t(NEUTERED[cat.neutered].label)}
              </AboutRow>
              <AboutRow icon={Heart} label={t('นิสัย')}>
                {traits.length ? traits.map((trait) => t(trait.label)).join(', ') : t('ไม่ระบุ')}
              </AboutRow>
              <AboutRow icon={MapPin} label={t('ตำแหน่ง')}>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${VERIFICATION[cat.verification].className}`}>
                  {t(VERIFICATION[cat.verification].label)}
                </span>
              </AboutRow>
              <AboutRow icon={ShieldCheck} label={t('ตรวจว่าเป็นแมว')}>
                {cat.catCheck === 'user'
                  ? t('ผู้ปักหมุดยืนยันเอง (รอผู้ดูแลตรวจ)')
                  : cat.catCheck === 'ai'
                    ? t('AI ช่วยดูแล้วว่าเป็นแมว ({n}%)', { n: Math.round(cat.catConfidence * 100) })
                    : t('ระบบตรวจพบแมว {n}%', { n: Math.round(cat.catConfidence * 100) })}
              </AboutRow>
              <AboutRow icon={UserRound} label={t('ปักหมุดโดย')}>
                {pinnedBy}
              </AboutRow>
            </dl>
            {canManage && (
              <button
                type="button"
                onClick={() => onDelete(cat)}
                className="mt-4 flex items-center justify-center gap-1.5 rounded-full py-2 text-sm font-medium text-red-700 ring-1 ring-red-200 hover:bg-red-50"
              >
                <Trash2 size={15} aria-hidden="true" />
                {userId === cat.createdBy ? t('ลบหมุดนี้') : t('ลบหมุดนี้ (เจ้าของแพลตฟอร์ม)')}
              </button>
            )}
          </div>
        )}
      </div>

      {lightbox !== null && (
        <PhotoLightbox photos={photos} startIndex={lightbox} alt={cat.name} onClose={() => setLightbox(null)} />
      )}
      {gallery && <CatGallery name={cat.name} photos={photos} onClose={() => setGallery(false)} />}
    </div>
  )
}

interface RoundActionProps {
  icon: LucideIcon
  label: string
  primary?: boolean
  href?: string
  onClick?: () => void
  iconKey?: number
  iconClass?: string
  children?: ReactNode
}

/** ปุ่มกลมพร้อมชื่อใต้ปุ่ม แบบแถวปุ่มของ Google Maps */
function RoundAction({ icon: Icon, label, primary, href, onClick, iconKey, iconClass, children }: RoundActionProps) {
  const circle = `relative flex size-12 items-center justify-center rounded-full transition group-active:scale-90 ${
    primary ? 'bg-orange-500 text-white group-hover:bg-orange-600' : 'bg-orange-100 text-orange-700 group-hover:bg-orange-200'
  }`
  const content = (
    <>
      <span className={circle}>
        <Icon size={21} key={iconKey} className={iconClass} aria-hidden="true" />
        {children}
      </span>
      <span className="text-center text-xs leading-tight font-medium text-stone-700">{label}</span>
    </>
  )
  const base = 'group flex w-16 flex-col items-center gap-1.5'
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className={base}>
      {content}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={base}>
      {content}
    </button>
  )
}

function InfoRow({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <p className="flex items-start gap-3">
      <Icon size={18} className="mt-0.5 shrink-0 text-orange-600" aria-hidden="true" />
      <span className="min-w-0">{children}</span>
    </p>
  )
}

function AboutRow({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <Icon size={17} className="shrink-0 text-stone-400" aria-hidden="true" />
      <dt className="w-32 shrink-0 text-stone-500">{label}</dt>
      <dd className="min-w-0 flex-1 text-stone-800">{children}</dd>
    </div>
  )
}
