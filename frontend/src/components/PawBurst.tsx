import { PawPrint } from 'lucide-react'
import type { CSSProperties } from 'react'

// 7 อุ้งเท้ากระจายออกเป็นพัดครึ่งวงกลมด้านบน + ป้าย "+1" ลอยขึ้น
const PAWS = Array.from({ length: 7 }, (_, i) => {
  const angle = Math.PI * (1.1 + (i / 6) * 0.8) // ~200° ถึง ~340° (ด้านบน)
  const distance = 34 + (i % 2) * 14
  return {
    dx: `${Math.round(Math.cos(angle) * distance)}px`,
    dy: `${Math.round(Math.sin(angle) * distance)}px`,
    rot: `${(i - 3) * 18}deg`,
    delay: `${i * 25}ms`,
  }
})

/** เอฟเฟกต์ตอนบันทึก "ฉันเจอด้วย" สำเร็จ — ใส่ไว้ในปุ่มที่เป็น relative แล้วเปลี่ยน key เพื่อเล่นซ้ำ */
export function PawBurst() {
  return (
    <span className="pointer-events-none absolute inset-0" aria-hidden="true">
      {PAWS.map((p, i) => (
        <PawPrint
          key={i}
          size={14}
          className="absolute top-1/2 left-1/2 animate-paw-burst fill-orange-400 text-orange-500"
          style={{ '--dx': p.dx, '--dy': p.dy, '--rot': p.rot, animationDelay: p.delay } as CSSProperties}
        />
      ))}
      <span className="absolute -top-2 left-1/2 animate-float-up rounded-full bg-orange-500 px-1.5 text-xs font-bold text-white">
        +1
      </span>
    </span>
  )
}
