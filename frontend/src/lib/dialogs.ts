// หน้าต่างยืนยัน/ถามข้อความของแอปเอง (แทน window.confirm / window.prompt ของเบราว์เซอร์)
// เรียกได้จากทุกที่: if (await confirmAction({ title: ... })) ... — แสดงผลโดย <DialogHost /> ใน App

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  /** danger = ปุ่มยืนยันสีแดง (ลบ ระงับ ฯลฯ) */
  tone?: 'default' | 'danger'
}

export interface PromptOptions extends ConfirmOptions {
  placeholder?: string
  maxLength?: number
}

export type DialogRequest = { id: number } & (
  | { kind: 'confirm'; options: ConfirmOptions; resolve: (ok: boolean) => void }
  | { kind: 'prompt'; options: PromptOptions; resolve: (text: string | null) => void }
)

let nextId = 1

let current: DialogRequest | null = null
const queue: DialogRequest[] = []
const listeners = new Set<() => void>()

const emit = () => listeners.forEach((l) => l())

function push(request: DialogRequest) {
  if (current) queue.push(request)
  else current = request
  emit()
}

/** ปิดหน้าต่างที่แสดงอยู่ แล้วแสดงตัวถัดไปในคิว (ถ้ามี) */
export function settleDialog(value: boolean | string | null) {
  if (!current) return
  const request = current
  current = queue.shift() ?? null
  if (request.kind === 'confirm') request.resolve(value === true)
  else request.resolve(typeof value === 'string' ? value : null)
  emit()
}

export const subscribeDialogs = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
export const getDialog = () => current

export const confirmAction = (options: ConfirmOptions) =>
  new Promise<boolean>((resolve) => push({ id: nextId++, kind: 'confirm', options, resolve }))

/** คืนข้อความที่พิมพ์ (ว่างได้) หรือ null ถ้ากดยกเลิก */
export const promptText = (options: PromptOptions) =>
  new Promise<string | null>((resolve) => push({ id: nextId++, kind: 'prompt', options, resolve }))
