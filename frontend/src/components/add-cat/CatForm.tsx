import { Check, LoaderCircle, ShieldCheck, Sparkles } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { FUR_COLORS, NEUTERED, TRAITS, VERIFICATION } from '../../lib/cat'
import type { CatTraits, FurColor, Neutered, Verification } from '../../types'
import { useI18n } from '../../hooks/useI18n'

export interface CatFormValues extends CatTraits {
  name: string
  furColor: FurColor
  placeName: string
  description: string
  hasOwner: boolean
}

interface Props {
  photoUrl: string
  catScore: number
  verification: Verification
  notices: string[]
  guessedFur: FurColor
  submitting: boolean
  submitError: string | null
  onSubmit: (values: CatFormValues) => void
}

const inputClass =
  'w-full rounded-xl border border-stone-300 bg-surface px-3.5 py-2.5 text-[15px] text-stone-800 outline-none placeholder:text-stone-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-200'

export function CatForm({
  photoUrl,
  catScore,
  verification,
  notices,
  guessedFur,
  submitting,
  submitError,
  onSubmit,
}: Props) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [furColor, setFurColor] = useState<FurColor>(guessedFur)
  const [placeName, setPlaceName] = useState('')
  const [description, setDescription] = useState('')
  const [hasOwner, setHasOwner] = useState(false)
  const [traits, setTraits] = useState({ isFriendly: false, isClingy: false, isPlayful: false })
  const [neutered, setNeutered] = useState<Neutered>('unknown')
  const [nameError, setNameError] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return
    if (!name.trim()) {
      setNameError(true)
      return
    }
    onSubmit({
      name: name.trim(),
      furColor,
      placeName: placeName.trim(),
      description: description.trim(),
      hasOwner,
      ...traits,
      neutered,
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div className="relative overflow-hidden rounded-2xl bg-stone-100">
        <img src={photoUrl} alt={t('รูปแมวที่จะปักหมุด')} className="aspect-[4/3] w-full object-cover" />
        <div className="absolute bottom-2 left-2 flex flex-wrap gap-1.5">
          <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
            <ShieldCheck size={13} aria-hidden="true" />
            {t('แมวจริง {n}%', { n: Math.round(catScore * 100) })}
          </span>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${VERIFICATION[verification].className}`}>
            {t(VERIFICATION[verification].label)}
          </span>
        </div>
      </div>

      {notices.map((notice) => (
        <p key={notice} className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
          {notice}
        </p>
      ))}

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-stone-700">{t('ชื่อน้องแมว')}</span>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setNameError(false)
          }}
          placeholder={t('ส้มจี๊ด')}
          maxLength={40}
          aria-invalid={nameError}
          className={`${inputClass} ${nameError ? 'border-red-400' : ''}`}
        />
        {nameError && <span className="text-sm text-red-600">{t('ตั้งชื่อให้น้องก่อน ไม่รู้ชื่อก็ตั้งเองได้เลย')}</span>}
      </label>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-stone-700">
          {t('สีขน')}
          <span className="flex items-center gap-0.5 text-xs font-normal text-stone-500">
            <Sparkles size={12} aria-hidden="true" /> {t('เดาจากรูปให้แล้ว แก้ได้')}
          </span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(FUR_COLORS) as FurColor[]).map((color) => (
            <button
              key={color}
              type="button"
              aria-pressed={furColor === color}
              onClick={() => setFurColor(color)}
              className={`flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm ring-1 transition-colors ${
                furColor === color
                  ? 'bg-orange-500 text-white ring-orange-500'
                  : 'bg-surface text-stone-700 ring-stone-300 hover:bg-orange-50'
              }`}
            >
              <span
                className="size-3.5 rounded-full ring-1 ring-black/10"
                style={{ background: FUR_COLORS[color].bg }}
                aria-hidden="true"
              />
              {t(FUR_COLORS[color].label)}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium text-stone-700">{t('นิสัยน้อง (เลือกได้หลายข้อ)')}</legend>
        <div className="flex flex-wrap gap-2">
          {TRAITS.map((trait) => {
            const on = traits[trait.key]
            return (
              <button
                key={trait.key}
                type="button"
                role="checkbox"
                aria-checked={on}
                title={t(trait.hint)}
                onClick={() => setTraits((prev) => ({ ...prev, [trait.key]: !prev[trait.key] }))}
                className={`flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm ring-1 transition-colors ${
                  on ? 'bg-pink-500 text-white ring-pink-500' : 'bg-surface text-stone-700 ring-stone-300 hover:bg-pink-50'
                }`}
              >
                {on && <Check size={14} aria-hidden="true" />}
                {t(trait.label)}
              </button>
            )
          })}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium text-stone-700">{t('ทำหมันหรือยัง')}</legend>
        <div className="flex gap-2" role="radiogroup" aria-label={t('ทำหมันหรือยัง')}>
          {(Object.keys(NEUTERED) as Neutered[]).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={neutered === value}
              onClick={() => setNeutered(value)}
              className={`h-9 flex-1 rounded-full text-sm ring-1 transition-colors ${
                neutered === value
                  ? 'bg-teal-600 text-white ring-teal-600'
                  : 'bg-surface text-stone-700 ring-stone-300 hover:bg-teal-50'
              }`}
            >
              {t(NEUTERED[value].label)}
            </button>
          ))}
        </div>
        <span className="text-xs text-stone-500">{t('แมวที่ทำหมันผ่านโครงการมักถูกตัดปลายหูข้างหนึ่งเป็นสัญลักษณ์')}</span>
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-stone-700">{t('เจอที่ไหน')}</span>
        <input
          value={placeName}
          onChange={(e) => setPlaceName(e.target.value)}
          placeholder={t('หน้าเซเว่น ซอย 5')}
          maxLength={80}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-stone-700">{t('เล่าเกี่ยวกับน้อง')}</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('นิสัย จุดสังเกต ช่วงเวลาที่มักเจอ')}
          rows={3}
          maxLength={500}
          className={`${inputClass} resize-none`}
        />
      </label>

      <label className="flex items-start gap-3 rounded-xl bg-stone-50 p-3.5">
        <input
          type="checkbox"
          checked={hasOwner}
          onChange={(e) => setHasOwner(e.target.checked)}
          className="mt-0.5 size-4.5 accent-orange-500"
        />
        <span className="text-sm text-stone-700">
          <span className="font-medium">{t('น้องน่าจะมีเจ้าของ / อยู่ในบ้านคน')}</span>
          <span className="block text-stone-500">{t('เบลอตำแหน่งบนแผนที่ประมาณ 50–100 ม. เพื่อความเป็นส่วนตัวของเจ้าของ')}</span>
        </span>
      </label>

      {submitError && (
        <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {submitError}
        </p>
      )}

      <button
        type="submit"
        aria-busy={submitting}
        className="flex h-12 items-center justify-center gap-2 rounded-full bg-orange-500 font-medium text-white shadow-md hover:bg-orange-600 aria-busy:opacity-80"
      >
        {submitting && <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />}
        {submitting ? t('กำลังบันทึก…') : t('ปักหมุดแมว')}
      </button>
      {submitting && (
        <p className="-mt-2 text-center text-xs text-stone-500">{t('ถ้า server เพิ่งตื่นจากโหมดพัก อาจใช้เวลาสักครู่')}</p>
      )}
    </form>
  )
}
