import { useEffect, useRef, useState } from 'react'
import { Drawer } from 'vaul'
import type { Cat } from '../types'
import { CatDetails } from './CatDetails'
import { useI18n } from '../hooks/useI18n'

interface Props {
  cat: Cat | null
  onClose: () => void
  onSighting: (cat: Cat) => Promise<boolean>
  onShare: (cat: Cat) => void
  onDelete: (cat: Cat) => void
  onReport: (cat: Cat) => void
}

// ความสูงแรกพอเห็นรูป + ชื่อ + คะแนน ลากขึ้นดูเต็ม
const SNAP_POINTS = ['400px', 1] as const

// bottom sheet บนมือถือ: ลากขึ้นดูเต็ม ลากลงเพื่อปิด แผนที่ด้านหลังยังใช้งานได้
export function CatSheet({ cat, onClose, onSighting, onShare, onDelete, onReport }: Props) {
  const { t } = useI18n()
  const [snap, setSnap] = useState<number | string | null>(SNAP_POINTS[0])
  // เก็บแมวตัวล่าสุดไว้ระหว่าง animation ปิด
  const [shown, setShown] = useState<Cat | null>(cat)
  const full = snap === SNAP_POINTS[1]
  const scrollRef = useRef<HTMLDivElement>(null)
  // ย่อลงแล้วกลับไปบนสุด (ไม่งั้นส่วนที่เห็นจะค้างอยู่กลางเนื้อหา ไม่เห็นรูปกับชื่อน้อง)
  useEffect(() => {
    if (!full) scrollRef.current?.scrollTo({ top: 0 })
  }, [full])

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
      // เปิดเต็มจอแล้ว: ลากได้เฉพาะที่ขีดด้านบน — ปัดในเนื้อหาเป็นการเลื่อนอ่านล้วนๆ ไม่แย่งกับการลากแผ่น
      handleOnly={full}
    >
      <Drawer.Portal>
        <Drawer.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-30 flex h-full max-h-[94%] flex-col rounded-t-3xl bg-surface shadow-[0_-4px_24px_rgba(0,0,0,0.12)] outline-none"
        >
          {/* ขีดด้านบน: ลากขึ้น/ลง หรือแตะเพื่อขยาย/ย่อ (ไม่ปิดแผ่น) */}
          <div className="flex shrink-0 justify-center py-3">
            <Drawer.Handle
              preventCycle
              onClick={() => setSnap(full ? SNAP_POINTS[0] : SNAP_POINTS[1])}
            />
          </div>
          <Drawer.Title className="sr-only">{shown?.name ?? t('ข้อมูลแมว')}</Drawer.Title>
          <div
            ref={scrollRef}
            className={`min-h-0 flex-1 pb-6 ${full ? 'overflow-y-auto overscroll-contain' : 'overflow-hidden'}`}
            // ยังไม่เต็มจอแล้วกดแท็บ (รีวิว / เกี่ยวกับ) → ขยายให้เต็มก่อน จะได้อ่านได้เลย
            onClickCapture={(e) => {
              if (!full && (e.target as HTMLElement).closest('[role="tab"]')) setSnap(SNAP_POINTS[1])
            }}
          >
            {shown && (
              <CatDetails
                key={shown.id}
                variant="sheet"
                cat={shown}
                onSighting={onSighting}
                onShare={onShare}
                onDelete={onDelete}
                onReport={onReport}
              />
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
