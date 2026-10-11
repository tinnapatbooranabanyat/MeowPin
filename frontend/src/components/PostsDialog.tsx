import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, House, ImagePlus, LoaderCircle, LocateFixed, Megaphone, Plus, Search, Trash2 } from 'lucide-react'
import { useRef, useState, type ChangeEvent } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useI18n } from '../hooks/useI18n'
import { useMapActions } from '../hooks/useMapActions'
import { ApiError, createPost, deletePost, fetchCatsInView, fetchPostsInView, resolvePost, type Bounds } from '../lib/api'
import { FUR_COLORS, furLabel, timeAgo } from '../lib/cat'
import { distanceMeters, getCurrentPosition } from '../lib/geo'
import type { CatPost, FurColor, LatLng, PostKind } from '../types'
import { CatAvatar } from './CatAvatar'
import { Modal } from './ui/Modal'

const MATCH_RADIUS_M = 1000

interface Props {
  bounds: Bounds
  onClose: () => void
}

const center = (b: Bounds): LatLng => ({ lat: (b.minLat + b.maxLat) / 2, lng: (b.minLng + b.maxLng) / 2 })

/** ประกาศแมวหาย / หาบ้าน ในกรอบแผนที่ตอนนี้ + ลงประกาศใหม่ */
export function PostsDialog({ bounds, onClose }: Props) {
  const { t } = useI18n()
  const { requireLogin } = useAuth()
  const [kind, setKind] = useState<PostKind>('lost')
  const [creating, setCreating] = useState(false)
  const posts = useQuery({ queryKey: ['posts', bounds], queryFn: () => fetchPostsInView(bounds) })
  const list = (posts.data ?? []).filter((p) => p.kind === kind)

  const tabClass = (active: boolean) =>
    `flex flex-1 items-center justify-center gap-1.5 border-b-2 pb-2 text-[15px] font-medium ${
      active ? 'border-orange-500 text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-700'
    }`

  if (creating) {
    return <CreatePost bounds={bounds} initialKind={kind} onClose={onClose} onDone={() => setCreating(false)} />
  }

  return (
    <Modal title={t('ประกาศแมวหาย / หาบ้าน')} onClose={onClose} wide>
      <div className="mb-4 flex border-b border-stone-200" role="tablist">
        <button type="button" role="tab" aria-selected={kind === 'lost'} onClick={() => setKind('lost')} className={tabClass(kind === 'lost')}>
          <Search size={16} aria-hidden="true" />
          {t('ตามหาแมวหาย')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={kind === 'adoption'}
          onClick={() => setKind('adoption')}
          className={tabClass(kind === 'adoption')}
        >
          <House size={16} aria-hidden="true" />
          {t('หาบ้านให้น้อง')}
        </button>
      </div>

      <button
        type="button"
        onClick={() => requireLogin(t('เข้าสู่ระบบเพื่อลงประกาศ')) && setCreating(true)}
        className="mb-4 flex w-full items-center justify-center gap-1.5 rounded-full bg-orange-500 py-2.5 font-medium text-white hover:bg-orange-600"
      >
        <Plus size={18} aria-hidden="true" />
        {t(kind === 'lost' ? 'ลงประกาศตามหาแมวหาย' : 'ลงประกาศหาบ้านให้น้อง')}
      </button>

      {posts.isPending && <p className="py-8 text-center text-sm text-stone-500">{t('กำลังโหลด…')}</p>}
      {posts.isSuccess && list.length === 0 && (
        <p className="py-8 text-center text-sm text-stone-500">
          {t(kind === 'lost' ? 'ยังไม่มีประกาศแมวหายในแผนที่ตรงนี้' : 'ยังไม่มีประกาศหาบ้านในแผนที่ตรงนี้')}
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {list.map((post) => (
          <PostCard key={post.id} post={post} onClose={onClose} />
        ))}
      </ul>
    </Modal>
  )
}

function PostCard({ post, onClose }: { post: CatPost; onClose: () => void }) {
  const { t, lang } = useI18n()
  const { userId, isAdmin } = useAuth()
  const { openCat } = useMapActions()
  const queryClient = useQueryClient()
  const [copied, setCopied] = useState(false)
  const [showMatches, setShowMatches] = useState(false)
  const mine = post.userId === userId
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['posts'] })
  const resolve = useMutation({ mutationFn: () => resolvePost(post.id), onSuccess: refresh })
  const remove = useMutation({ mutationFn: () => deletePost(post.id), onSuccess: refresh })

  // หมุดแมวสีเดียวกันในรัศมี 1 กม. — อาจเป็นน้องที่หายไป
  const matches = useQuery({
    queryKey: ['postMatches', post.id],
    enabled: showMatches,
    queryFn: async () => {
      const pad = 0.01
      const cats = await fetchCatsInView({
        minLat: post.position.lat - pad,
        maxLat: post.position.lat + pad,
        minLng: post.position.lng - pad,
        maxLng: post.position.lng + pad,
      })
      return cats
        .map((cat) => ({ cat, distance: distanceMeters(post.position, cat.position) }))
        .filter((m) => m.distance <= MATCH_RADIUS_M && m.cat.furColor === post.furColor)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 6)
    },
  })

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(post.contact)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // คัดลอกไม่ได้ ก็ยังเห็นข้อความอยู่
    }
  }

  return (
    <li className="overflow-hidden rounded-2xl ring-1 ring-stone-200">
      <div className="flex gap-3 p-3">
        {post.photoUrl && <img src={post.photoUrl} alt={post.title} className="size-24 shrink-0 rounded-xl object-cover" />}
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 font-medium text-stone-900">
            {post.title}
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                post.kind === 'lost' ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {t(post.kind === 'lost' ? 'แมวหาย' : 'หาบ้าน')}
            </span>
          </p>
          <p className="text-xs text-stone-500">
            {t(furLabel(post))} · {post.userName ?? t('ผู้ใช้')} · {timeAgo(post.createdAt, lang)}
          </p>
          {post.description && <p className="mt-1 line-clamp-3 text-sm text-stone-700">{post.description}</p>}
          <button
            type="button"
            onClick={copy}
            className="mt-2 flex max-w-full items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-800 hover:bg-stone-200"
            title={t('คัดลอกช่องทางติดต่อ')}
          >
            {copied ? <Check size={14} className="text-emerald-600" aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
            <span className="truncate">{post.contact}</span>
          </button>
        </div>
      </div>

      {post.kind === 'lost' && (
        <div className="border-t border-stone-100 px-3 py-2">
          {!showMatches ? (
            <button type="button" onClick={() => setShowMatches(true)} className="text-sm font-medium text-orange-700 hover:underline">
              {t('ดูหมุดแมวสีเดียวกันแถวนั้นที่อาจเป็นน้อง')}
            </button>
          ) : matches.isPending ? (
            <p className="text-sm text-stone-500">{t('กำลังหา…')}</p>
          ) : matches.data?.length ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {matches.data.map(({ cat, distance }) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    onClose()
                    openCat(cat.id)
                  }}
                  className="flex w-20 shrink-0 flex-col items-center gap-1 text-center"
                >
                  <CatAvatar cat={cat} className="size-16 rounded-xl" />
                  <span className="w-full truncate text-xs text-stone-800">{cat.name}</span>
                  <span className="text-[10px] text-stone-500">{t('ห่าง {m} ม.', { m: Math.round(distance) })}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-stone-500">{t('ยังไม่เจอหมุดแมวสีเดียวกันในรัศมี 1 กม.')}</p>
          )}
        </div>
      )}

      {(mine || isAdmin) && (
        <div className="flex gap-2 border-t border-stone-100 px-3 py-2">
          <button
            type="button"
            disabled={resolve.isPending}
            onClick={() => window.confirm(t('ปิดประกาศนี้?')) && resolve.mutate()}
            className="flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50 disabled:opacity-60"
          >
            <Check size={15} aria-hidden="true" />
            {t(post.kind === 'lost' ? 'เจอน้องแล้ว' : 'มีคนรับเลี้ยงแล้ว')}
          </button>
          <button
            type="button"
            disabled={remove.isPending}
            onClick={() => window.confirm(t('ลบประกาศนี้ถาวร?')) && remove.mutate()}
            className="flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-red-700 ring-1 ring-red-200 hover:bg-red-50 disabled:opacity-60"
          >
            <Trash2 size={15} aria-hidden="true" />
            {t('ลบ')}
          </button>
        </div>
      )}
    </li>
  )
}

const inputClass =
  'w-full rounded-xl border border-stone-300 bg-surface px-3.5 py-2.5 text-[15px] text-stone-800 outline-none placeholder:text-stone-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-200'

function CreatePost({
  bounds,
  initialKind,
  onClose,
  onDone,
}: {
  bounds: Bounds
  initialKind: PostKind
  onClose: () => void
  onDone: () => void
}) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)
  const [kind, setKind] = useState<PostKind>(initialKind)
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null)
  const [title, setTitle] = useState('')
  const [furColor, setFurColor] = useState<FurColor>('orange')
  const [furColorCustom, setFurColorCustom] = useState('')
  const [description, setDescription] = useState('')
  const [contact, setContact] = useState('')
  const [position, setPosition] = useState<LatLng>(center(bounds))
  const [usingGps, setUsingGps] = useState(false)
  const [notCat, setNotCat] = useState(false)
  const [confirmCat, setConfirmCat] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pickPhoto = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (photo) URL.revokeObjectURL(photo.url)
    setPhoto({ file, url: URL.createObjectURL(file) })
    setNotCat(false)
    setConfirmCat(false)
  }

  const useMyLocation = async () => {
    setUsingGps(true)
    const fix = await getCurrentPosition()
    setUsingGps(false)
    if (fix) setPosition(fix.position)
    else setError(t('หาตำแหน่งปัจจุบันไม่ได้ ใช้ตำแหน่งกลางแผนที่แทนนะ'))
  }

  const submit = useMutation({
    mutationFn: async () => {
      const { compressPhoto } = await import('../lib/photo')
      await createPost({
        kind,
        photo: await compressPhoto(photo!.file),
        title: title.trim(),
        furColor,
        furColorCustom: furColorCustom.trim(),
        description: description.trim(),
        contact: contact.trim(),
        position,
        confirmCat,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] })
      onDone()
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'not_cat') setNotCat(true)
      setError(t(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง'))
    },
  })

  const canSubmit = photo && title.trim() && contact.trim() && (furColor !== 'other' || furColorCustom.trim()) && (!notCat || confirmCat)

  return (
    <Modal title={t('ลงประกาศ')} onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          setError(null)
          if (canSubmit && !submit.isPending) submit.mutate()
        }}
      >
        <div className="flex gap-2" role="radiogroup" aria-label={t('ประเภทประกาศ')}>
          {(['lost', 'adoption'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={kind === value}
              onClick={() => setKind(value)}
              className={`flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full text-sm ring-1 ${
                kind === value ? 'bg-orange-500 text-white ring-orange-500' : 'bg-surface text-stone-700 ring-stone-300'
              }`}
            >
              {value === 'lost' ? <Megaphone size={16} aria-hidden="true" /> : <House size={16} aria-hidden="true" />}
              {t(value === 'lost' ? 'แมวหาย' : 'หาบ้าน')}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-stone-300 text-stone-500 hover:border-orange-400"
        >
          {photo ? (
            <img src={photo.url} alt="" className="size-full object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-1 text-sm">
              <ImagePlus size={28} aria-hidden="true" />
              {t('เพิ่มรูปน้อง (ต้องมี)')}
            </span>
          )}
        </button>
        <input ref={fileInput} type="file" accept="image/*" hidden onChange={pickPhoto} />

        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} placeholder={t('ชื่อน้อง')} className={inputClass} />

        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(FUR_COLORS) as FurColor[]).map((color) => (
            <button
              key={color}
              type="button"
              aria-pressed={furColor === color}
              onClick={() => setFurColor(color)}
              className={`flex h-8 items-center gap-1 rounded-full px-2.5 text-xs ring-1 ${
                furColor === color ? 'bg-orange-500 text-white ring-orange-500' : 'bg-surface text-stone-700 ring-stone-300'
              }`}
            >
              <span className="size-3 rounded-full ring-1 ring-black/10" style={{ background: FUR_COLORS[color].bg }} aria-hidden="true" />
              {t(FUR_COLORS[color].label)}
            </button>
          ))}
        </div>
        {furColor === 'other' && (
          <input
            value={furColorCustom}
            onChange={(e) => setFurColorCustom(e.target.value)}
            maxLength={30}
            placeholder={t('พิมพ์สีขนของน้อง')}
            className={inputClass}
          />
        )}

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={800}
          placeholder={t(
            kind === 'lost'
              ? 'หายไปเมื่อไหร่ จุดสังเกต ปลอกคอ นิสัย'
              : 'อายุ ทำหมันหรือยัง ฉีดวัคซีนแล้วหรือยัง นิสัย เงื่อนไขการรับเลี้ยง',
          )}
          className={`${inputClass} resize-none`}
        />

        <label className="flex flex-col gap-1">
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            maxLength={100}
            placeholder={t('ช่องทางติดต่อ เช่น LINE ID หรือเบอร์โทร')}
            className={inputClass}
          />
          <span className="text-xs text-stone-500">{t('ทุกคนจะเห็นช่องทางนี้ ใส่เฉพาะที่สะดวกให้ติดต่อ')}</span>
        </label>

        <div className="rounded-xl bg-stone-50 px-3.5 py-2.5 text-sm text-stone-700 ring-1 ring-stone-100">
          <p>
            {t('ตำแหน่ง: {lat}, {lng}', { lat: position.lat.toFixed(4), lng: position.lng.toFixed(4) })}
            <span className="text-xs text-stone-500"> · {t('จะถูกเบลอให้เห็นแค่คร่าวๆ')}</span>
          </p>
          <button
            type="button"
            onClick={useMyLocation}
            disabled={usingGps}
            className="mt-1 flex items-center gap-1 text-sm font-medium text-orange-700 hover:underline disabled:opacity-60"
          >
            {usingGps ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : <LocateFixed size={14} aria-hidden="true" />}
            {t(kind === 'lost' ? 'ใช้ตำแหน่งปัจจุบัน (ถ้าอยู่ตรงที่น้องหาย)' : 'ใช้ตำแหน่งปัจจุบัน')}
          </button>
          <p className="mt-0.5 text-xs text-stone-500">{t('ค่าเริ่มต้นคือจุดกึ่งกลางของแผนที่ตอนนี้')}</p>
        </div>

        {notCat && (
          <label className="flex cursor-pointer items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
            <input type="checkbox" checked={confirmCat} onChange={(e) => setConfirmCat(e.target.checked)} className="mt-0.5 size-4 accent-orange-500" />
            {t('รูปนี้เป็นน้องแมวจริงๆ — ลงประกาศเลย')}
          </label>
        )}
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onDone}
            className="h-12 flex-1 rounded-full font-medium text-stone-700 ring-1 ring-stone-300 hover:bg-stone-100"
          >
            {t('ยกเลิก')}
          </button>
          <button
            type="submit"
            disabled={!canSubmit || submit.isPending}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-orange-500 font-medium text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {submit.isPending && <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />}
            {t('ลงประกาศ')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
