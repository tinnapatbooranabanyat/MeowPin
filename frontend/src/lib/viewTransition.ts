// จำ View Transition ที่กำลังเล่นอยู่ (เปลี่ยนธีม/ภาษา) — ระหว่างเล่น Chrome ส่งทุกคลิกไปที่ <html>
// ปุ่มที่ผู้ใช้กดซ้ำเร็วๆ เลยไม่ทำงาน ต้องข้าม animation แล้วส่งคลิกต่อให้เอง
let active: ViewTransition | null = null

export function startViewTransition(update: () => void): ViewTransition {
  const transition = document.startViewTransition(update)
  active = transition
  transition.finished.finally(() => {
    if (active === transition) active = null
  })
  return transition
}

/** ถ้ามี animation เล่นอยู่: ข้ามให้จบทันที แล้วคืน promise ที่รอจนหน้าจอเป็นของจริงแล้ว */
export function skipActiveTransition(): Promise<void> | null {
  if (!active) return null
  const transition = active
  transition.skipTransition()
  return transition.finished.then(
    () => undefined,
    () => undefined,
  )
}
