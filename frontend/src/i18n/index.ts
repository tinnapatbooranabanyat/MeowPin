import { EN } from './en'

export type Lang = 'th' | 'en'
export type TParams = Record<string, string | number>

const STORAGE_KEY = 'meowpin.lang'

// ข้อความภาษาไทยในโค้ดคือ key เลย — ภาษาอังกฤษดึงจาก EN ถ้าไม่มีคำแปลจะแสดงภาษาไทยแทน (ไม่มีวันเป็นช่องว่าง)
function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'th' || saved === 'en') return saved
  } catch {
    // private mode
  }
  return navigator.language.toLowerCase().startsWith('th') ? 'th' : 'en'
}

let current: Lang = initialLang()
const listeners = new Set<() => void>()
document.documentElement.lang = current

export const getLang = () => current

export function subscribeLang(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setLang(next: Lang) {
  current = next
  document.documentElement.lang = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // private mode — แค่ไม่จำ
  }
  listeners.forEach((l) => l())
}

/** dev: เก็บข้อความที่ยังไม่มีคำแปล ดูได้ที่ window.__missingI18n */
const missing = new Set<string>()
if (import.meta.env.DEV) Object.assign(window, { __missingI18n: missing })

export function translate(key: string, params?: TParams, lang: Lang = current): string {
  let text = key
  if (lang === 'en') {
    const en = EN[key]
    if (en === undefined) {
      if (import.meta.env.DEV) missing.add(key)
    } else {
      text = en
    }
  }
  if (params) text = text.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m))
  return text
}
