import { ArrowLeft, Download, HeartHandshake, QrCode } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useI18n } from '../hooks/useI18n'
import { maskPromptPayId, PROMPTPAY_ID, promptPayPayload } from '../lib/promptpay'
import { Modal } from './ui/Modal'

const PRESETS = [5, 10, 20] as const
const MAX_AMOUNT = 50_000

type Choice = (typeof PRESETS)[number] | 'custom'

const baht = (n: number) => `฿${n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function SupportDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  const [choice, setChoice] = useState<Choice>(10)
  const [custom, setCustom] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [qr, setQr] = useState<{ amount: number; image: string } | null>(null)
  const [generating, setGenerating] = useState(false)

  const generate = async (e: FormEvent) => {
    e.preventDefault()
    // เช็กจากข้อความที่พิมพ์ ไม่ใช่ตัวเลข — 0.29 * 100 ใน JS ได้ 28.999… จะปฏิเสธยอดที่ถูกต้อง
    if (choice === 'custom' && !/^\d+(\.\d{1,2})?$/.test(custom.trim()))
      return setError(t(/\.\d{3,}$/.test(custom.trim()) ? 'ใส่ทศนิยมได้ไม่เกิน 2 ตำแหน่ง' : 'ใส่จำนวนเงินอย่างน้อย 1 บาท'))
    const amount = choice === 'custom' ? Number(custom.trim()) : choice
    if (amount < 1) return setError(t('ใส่จำนวนเงินอย่างน้อย 1 บาท'))
    if (amount > MAX_AMOUNT) return setError(t('จำนวนเงินสูงสุด {n} บาท', { n: MAX_AMOUNT.toLocaleString() }))
    setGenerating(true)
    try {
      // โหลดไลบรารีวาด QR เฉพาะตอนใช้
      const QRCode = await import('qrcode')
      const image = await QRCode.toDataURL(promptPayPayload(PROMPTPAY_ID, amount), {
        width: 640,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#ffffff' },
      })
      setQr({ amount, image })
    } catch {
      setError(t('สร้าง QR ไม่สำเร็จ ลองใหม่อีกครั้ง'))
    } finally {
      setGenerating(false)
    }
  }

  const chipClass = (active: boolean) =>
    `h-12 rounded-2xl text-[15px] font-medium ring-1 transition active:scale-95 ${
      active ? 'bg-orange-500 text-white ring-orange-500' : 'bg-surface text-stone-800 ring-stone-300 hover:bg-orange-50'
    }`

  return (
    <Modal title={t('สนับสนุนทีม MeowPin')} onClose={onClose}>
      {qr ? (
        <div className="flex animate-pop-in flex-col items-center gap-3 text-center">
          <p className="text-sm text-stone-600">{t('สแกนด้วยแอปธนาคารใดก็ได้ จำนวนเงินถูกใส่ไว้ใน QR แล้ว')}</p>
          {/* QR ต้องอยู่บนพื้นขาวเสมอ (แม้ธีมมืด) แอปธนาคารถึงจะสแกนติดง่าย */}
          <div className="rounded-3xl bg-white p-3 shadow-md ring-1 ring-stone-200">
            <img src={qr.image} alt={t('QR PromptPay จำนวน {amount}', { amount: baht(qr.amount) })} className="size-60" />
          </div>
          <p className="font-display text-3xl text-stone-900">{baht(qr.amount)}</p>
          <p className="text-sm text-stone-500">PromptPay · {maskPromptPayId(PROMPTPAY_ID)}</p>
          <p className="text-xs text-stone-500">{t('ตรวจชื่อบัญชีในแอปธนาคารให้ตรงก่อนกดโอน')}</p>
          <div className="mt-1 flex w-full gap-2">
            <button
              type="button"
              onClick={() => setQr(null)}
              className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full font-medium text-stone-700 ring-1 ring-stone-300 hover:bg-stone-50"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              {t('เปลี่ยนจำนวนเงิน')}
            </button>
            <a
              href={qr.image}
              download={`meowpin-promptpay-${qr.amount}.png`}
              className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-orange-500 font-medium text-white transition active:scale-95 hover:bg-orange-600"
            >
              <Download size={16} aria-hidden="true" />
              {t('บันทึกรูป QR')}
            </a>
          </div>
        </div>
      ) : (
        <form onSubmit={generate} className="flex flex-col gap-4" noValidate>
          <div className="flex items-start gap-3 rounded-2xl bg-orange-50 p-3.5">
            <HeartHandshake size={22} className="mt-0.5 shrink-0 text-orange-600" aria-hidden="true" />
            <p className="text-sm text-stone-700">
              {t('ทุกบาทช่วยเป็นค่าเซิร์ฟเวอร์และค่าแผนที่ ให้ MeowPin เปิดให้ทุกคนใช้ฟรีต่อไปได้ ขอบคุณที่ช่วยกันดูแลน้องแมวนะ')}
            </p>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium text-stone-700">{t('เลือกจำนวนเงิน')}</legend>
            <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label={t('เลือกจำนวนเงิน')}>
              {PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={choice === n}
                  onClick={() => {
                    setChoice(n)
                    setError(null)
                  }}
                  className={chipClass(choice === n)}
                >
                  ฿{n}
                </button>
              ))}
              <button
                type="button"
                role="radio"
                aria-checked={choice === 'custom'}
                onClick={() => {
                  setChoice('custom')
                  setError(null)
                }}
                className={chipClass(choice === 'custom')}
              >
                {t('กำหนดเอง')}
              </button>
            </div>
          </fieldset>

          {choice === 'custom' && (
            <label className="flex animate-fade-up flex-col gap-1.5">
              <span className="text-sm font-medium text-stone-700">{t('จำนวนเงิน (บาท)')}</span>
              <div className="flex items-center rounded-xl border border-stone-300 bg-surface px-3.5 focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-200">
                <span className="text-stone-500">฿</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={1}
                  max={MAX_AMOUNT}
                  step="0.01"
                  value={custom}
                  autoFocus
                  onChange={(e) => {
                    setCustom(e.target.value)
                    setError(null)
                  }}
                  placeholder="50"
                  aria-invalid={error !== null}
                  className="w-full bg-transparent px-2 py-2.5 text-[15px] text-stone-800 outline-none placeholder:text-stone-400"
                />
              </div>
            </label>
          )}

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={generating}
            className="flex h-12 items-center justify-center gap-2 rounded-full bg-orange-500 font-medium text-white transition active:scale-95 hover:bg-orange-600 disabled:opacity-70"
          >
            <QrCode size={18} aria-hidden="true" />
            {generating ? t('กำลังสร้าง QR…') : t('สร้าง QR PromptPay')}
          </button>
          <p className="-mt-2 text-center text-xs text-stone-500">PromptPay · {maskPromptPayId(PROMPTPAY_ID)}</p>
        </form>
      )}
    </Modal>
  )
}
