// สร้างข้อมูลสำหรับ QR PromptPay ตามมาตรฐาน EMVCo (Thai QR Payment)
// แอปธนาคารทุกเจ้าในไทยสแกนได้ — ระบุจำนวนเงินไว้ใน QR (ผู้โอนแก้ไม่ได้)

/** เบอร์/เลขบัญชี PromptPay ของทีม — แก้ที่นี่ที่เดียว หรือตั้ง VITE_PROMPTPAY_ID ทับได้ */
export const PROMPTPAY_ID = (import.meta.env.VITE_PROMPTPAY_ID as string | undefined) || '0953935451'

const tlv = (id: string, value: string) => `${id}${String(value.length).padStart(2, '0')}${value}`

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) — ตัวตรวจท้าย QR ตามสเปก */
export function crc16(data: string): string {
  let crc = 0xffff
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
      crc &= 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

function proxyField(target: string): string {
  const digits = target.replace(/\D/g, '')
  if (digits.length >= 15) return tlv('03', digits) // e-Wallet ID
  if (digits.length >= 13) return tlv('02', digits) // เลขบัตรประชาชน / เลขผู้เสียภาษี
  // เบอร์มือถือ: 0812345678 → 0066812345678 (13 หลัก)
  return tlv('01', `0000000000000${digits.replace(/^0/, '66')}`.slice(-13))
}

export function promptPayPayload(target: string, amount?: number): string {
  const fields = [
    tlv('00', '01'), // payload format
    tlv('01', amount ? '12' : '11'), // 12 = QR ใช้ครั้งเดียว (มีจำนวนเงิน), 11 = ใช้ซ้ำได้
    tlv('29', tlv('00', 'A000000677010111') + proxyField(target)), // PromptPay
    tlv('58', 'TH'),
    tlv('53', '764'), // THB
  ]
  if (amount) fields.push(tlv('54', amount.toFixed(2)))
  const data = `${fields.join('')}6304`
  return data + crc16(data)
}

/** 0953935451 → 095-xxx-5451 (แสดงบางส่วน แอปธนาคารจะโชว์ชื่อบัญชีจริงตอนสแกนอยู่แล้ว) */
export function maskPromptPayId(target: string): string {
  const d = target.replace(/\D/g, '')
  if (d.length !== 10) return `${d.slice(0, 3)}…${d.slice(-4)}`
  return `${d.slice(0, 3)}-xxx-${d.slice(-4)}`
}
