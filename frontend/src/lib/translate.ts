import type { Lang } from '../i18n'

// แปลข้อความที่ผู้ใช้เขียน (รีวิว/คำอธิบาย) — ใช้ตัวแปลในเครื่องของเบราว์เซอร์ถ้ามี (Chrome 138+)
// ฟรีและข้อความไม่ออกจากเครื่อง ถ้าไม่มีให้เปิด Google Translate ในแท็บใหม่แทน (ไม่ต้องใช้ API key)

const THAI = /[฀-๿]/g
const LATIN = /[A-Za-z]/g

/** เดาภาษาจากตัวอักษร: ไทยเกิน 20% = th, มีแต่ตัวละติน = en, นอกนั้นไม่แน่ใจ */
export function detectTextLang(text: string): Lang | null {
  const letters = text.replace(/[\s\d\p{P}\p{S}]/gu, '')
  if (letters.length < 2) return null
  const thai = text.match(THAI)?.length ?? 0
  if (thai / letters.length > 0.2) return 'th'
  const latin = text.match(LATIN)?.length ?? 0
  return latin / letters.length > 0.8 ? 'en' : null
}

export function needsTranslation(text: string, uiLang: Lang): boolean {
  const lang = detectTextLang(text)
  return lang !== null && lang !== uiLang
}

export function googleTranslateUrl(text: string, to: Lang): string {
  return `https://translate.google.com/?sl=auto&tl=${to}&text=${encodeURIComponent(text)}&op=translate`
}

// Translator API ยังไม่มีใน type ของ TypeScript — ประกาศเฉพาะส่วนที่ใช้
interface BrowserTranslator {
  translate(text: string): Promise<string>
}
interface TranslatorFactory {
  availability(options: { sourceLanguage: string; targetLanguage: string }): Promise<string>
  create(options: { sourceLanguage: string; targetLanguage: string }): Promise<BrowserTranslator>
}

const factory = (globalThis as unknown as { Translator?: TranslatorFactory }).Translator
const translators = new Map<string, Promise<BrowserTranslator>>()
const cache = new Map<string, string>()

export const hasBrowserTranslator = factory !== undefined

// บางเบราว์เซอร์มี API แต่เรียกแล้วค้าง (ไม่ตอบเลย) — กำหนดเวลาไว้ทุกขั้น เกินแล้วถือว่าแปลไม่ได้
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))])
}

/** คืนคำแปล หรือ null ถ้าเบราว์เซอร์แปลให้ไม่ได้ (ต้องเรียกจากการกดปุ่ม เพราะอาจต้องดาวน์โหลดโมเดลภาษา) */
export async function translateText(text: string, from: Lang, to: Lang): Promise<string | null> {
  if (!factory) return null
  const key = `${from}>${to}:${text}`
  const cached = cache.get(key)
  if (cached) return cached
  try {
    const pair = { sourceLanguage: from, targetLanguage: to }
    if ((await withTimeout(factory.availability(pair), 4000)) === 'unavailable') return null
    const pairKey = `${from}>${to}`
    // ครั้งแรกอาจต้องดาวน์โหลดโมเดลภาษา จึงให้เวลานานกว่า
    if (!translators.has(pairKey)) translators.set(pairKey, withTimeout(factory.create(pair), 30_000))
    const translator = await translators.get(pairKey)!.catch((e) => {
      translators.delete(pairKey)
      throw e
    })
    const result = await withTimeout(translator.translate(text), 15_000)
    cache.set(key, result)
    return result
  } catch {
    return null
  }
}
