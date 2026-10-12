import { MapPinned, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useUpsertCat } from '../hooks/useCats'
import { useI18n } from '../hooks/useI18n'
import { fetchCat, updateCat } from '../lib/api'
import type { Cat } from '../types'
import { CatForm, type CatFormValues } from './add-cat/CatForm'
import { Modal } from './ui/Modal'

interface Props {
  cat: Cat
  onClose: () => void
  onSaved: (cat: Cat) => void
  onDelete: (cat: Cat) => void
  onMove: (cat: Cat) => void
}

/** แก้รายละเอียดหมุด (คนปักหมุดหรือเจ้าของแพลตฟอร์ม) — รูปแก้ไม่ได้ ตำแหน่งย้ายได้ด้วยปุ่มย้ายหมุด */
export function EditCatDialog({ cat, onClose, onSaved, onDelete, onMove }: Props) {
  const { t } = useI18n()
  const upsertCat = useUpsertCat()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const initial: CatFormValues = {
    name: cat.name,
    furColor: cat.furColor,
    furColorCustom: cat.furColorCustom ?? '',
    breed: cat.breed,
    placeName: cat.placeName,
    description: cat.description,
    ownerStatus: cat.ownerStatus,
    isFriendly: cat.isFriendly,
    isClingy: cat.isClingy,
    isPlayful: cat.isPlayful,
    neutered: cat.neutered,
  }

  const save = async (values: CatFormValues) => {
    setSaving(true)
    setError(null)
    try {
      await updateCat(cat.id, values)
      // โหลดข้อมูลล่าสุดจากฐานข้อมูลมาแสดง
      const fresh = (await fetchCat(cat.id)) ?? { ...cat, ...values, furColorCustom: values.furColorCustom || null }
      upsertCat(fresh)
      onSaved(fresh)
    } catch (e) {
      setError(t(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง'))
      setSaving(false)
    }
  }

  return (
    <Modal title={t('แก้ไขหมุดน้อง{name}', { name: cat.name })} onClose={onClose}>
      <CatForm
        mode="edit"
        initial={initial}
        photoUrl={cat.photoUrl ?? ''}
        catScore={cat.catConfidence}
        catCheck={cat.catCheck}
        verification={cat.verification}
        notices={[]}
        guessedFur={cat.furColor}
        submitting={saving}
        submitError={error}
        onSubmit={save}
      />
      <button
        type="button"
        onClick={() => onMove(cat)}
        disabled={saving}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full py-2.5 text-sm font-medium text-stone-700 ring-1 ring-stone-300 hover:bg-stone-100 disabled:opacity-60"
      >
        <MapPinned size={15} aria-hidden="true" />
        {t('ย้ายตำแหน่งหมุด')}
      </button>
      <p className="mt-3 text-center text-xs text-stone-500">{t('รูปหลักแก้ไม่ได้ ถ้าผิดให้ลบแล้วปักหมุดใหม่')}</p>
      <button
        type="button"
        onClick={() => onDelete(cat)}
        disabled={saving}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full py-2.5 text-sm font-medium text-red-700 ring-1 ring-red-200 hover:bg-red-50 disabled:opacity-60"
      >
        <Trash2 size={15} aria-hidden="true" />
        {t('ลบหมุดนี้')}
      </button>
    </Modal>
  )
}
