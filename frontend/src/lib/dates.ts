/** ช่วงวันที่ (เวลาเครื่อง) — from/to เป็นเที่ยงคืนของวันแรก/วันสุดท้าย (รวมวันสุดท้าย) */
export interface DateRange {
  from: Date
  to: Date
}

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
export const sameDay = (a: Date, b: Date) => a.getTime() === b.getTime()

/** ช่วงเวลาสำหรับ query: [from, วันถัดจาก to) */
export function rangeToIso(range: DateRange) {
  return { from: range.from.toISOString(), to: addDays(range.to, 1).toISOString() }
}
