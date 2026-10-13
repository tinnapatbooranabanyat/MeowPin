import { useEffect, useRef, useState, type TouchEvent } from 'react'
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
// ตอนเต็มจอ ปัดลงจากบนสุดของเนื้อหา: เกินเท่านี้ = ย่อ / เกินเท่านี้ = ปิดการ์ด (พิกเซล)
const PULL_COLLAPSE = 70
const PULL_CLOSE = 200

// bottom sheet บนมือถือ: ลากขึ้นดูเต็ม ลากลงเพื่อปิด (ตอนเต็มจอ ปัดลงจากบนสุดของเนื้อหาได้เลย) แผนที่ด้านหลังยังใช้งานได้
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

  // ปัดลงเพื่อย่อ/ปิด (ตอนเต็มจอ เลื่อนอยู่บนสุดแล้ว) — ขยับเนื้อหาตามนิ้วให้รู้ว่ากำลังจะย่อ
  const pull = useRef<{ startY: number; dy: number } | null>(null)
  const setPullOffset = (dy: number, animate = false) => {
    const el = scrollRef.current
    if (!el) return
    el.style.transition = animate ? 'transform 0.25s ease' : 'none'
    el.style.transform = dy ? `translateY(${dy * 0.5}px)` : ''
  }
  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    // เริ่มปัดตอนที่เนื้อหาอยู่บนสุดเท่านั้น (ไม่งั้นเป็นการเลื่อนอ่านปกติ)
    pull.current = full && (scrollRef.current?.scrollTop ?? 0) <= 0 ? { startY: e.touches[0].clientY, dy: 0 } : null
  }
  const onTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    const p = pull.current
    if (!p) return
    const dy = e.touches[0].clientY - p.startY
    // ปัดขึ้น หรือเนื้อหาเลื่อนไปแล้ว → เป็นการอ่านต่อ เลิกนับ
    if (dy < 0 || (scrollRef.current?.scrollTop ?? 0) > 0) {
      pull.current = null
      setPullOffset(0, true)
      return
    }
    p.dy = dy
    setPullOffset(dy)
  }
  const onTouchEnd = () => {
    const dy = pull.current?.dy ?? 0
    pull.current = null
    setPullOffset(0, true)
    if (dy > PULL_CLOSE) onClose()
    else if (dy > PULL_COLLAPSE) setSnap(SNAP_POINTS[0])
  }

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
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onTouchCancel={onTouchEnd}
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
