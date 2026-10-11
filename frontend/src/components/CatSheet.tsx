import { useState } from 'react'
import { Drawer } from 'vaul'
import type { Cat } from '../types'
import { CatDetails } from './CatDetails'
import { useI18n } from '../hooks/useI18n'

interface Props {
  cat: Cat | null
  onClose: () => void
  onSighting: (cat: Cat) => void
  onShare: (cat: Cat) => void
  onDelete: (cat: Cat) => void
  onReport: (cat: Cat) => void
}

const SNAP_POINTS = ['340px', 1] as const

// bottom sheet บนมือถือ: ลากขึ้นดูเต็ม ลากลงเพื่อปิด แผนที่ด้านหลังยังใช้งานได้
export function CatSheet({ cat, onClose, onSighting, onShare, onDelete, onReport }: Props) {
  const { t } = useI18n()
  const [snap, setSnap] = useState<number | string | null>(SNAP_POINTS[0])
  // เก็บแมวตัวล่าสุดไว้ระหว่าง animation ปิด
  const [shown, setShown] = useState<Cat | null>(cat)

  // เปลี่ยนตัวใหม่ → อัปเดตระหว่าง render และกลับไปที่ความสูงเริ่มต้น
  if (cat && cat !== shown) {
    if (cat.id !== shown?.id) setSnap(SNAP_POINTS[0])
    setShown(cat)
  }

  return (
    <Drawer.Root
      open={cat !== null}
      onOpenChange={(open) => !open && onClose()}
      modal={false}
      snapPoints={[...SNAP_POINTS]}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
    >
      <Drawer.Portal>
        <Drawer.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-30 flex h-full max-h-[94%] flex-col rounded-t-3xl bg-surface shadow-[0_-4px_24px_rgba(0,0,0,0.12)] outline-none"
        >
          <div className="mx-auto mt-3 mb-4 h-1.5 w-10 shrink-0 rounded-full bg-stone-300" />
          <Drawer.Title className="sr-only">{shown?.name ?? t('ข้อมูลแมว')}</Drawer.Title>
          <div className={`px-5 pb-8 ${snap === 1 ? 'overflow-y-auto' : 'overflow-hidden'}`}>
            {shown && <CatDetails cat={shown} onSighting={onSighting} onShare={onShare} onDelete={onDelete} onReport={onReport} />}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
