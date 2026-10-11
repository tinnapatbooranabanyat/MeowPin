import { useSyncExternalStore } from 'react'

export type ThemePref = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'meowpin.theme'
const media = window.matchMedia('(prefers-color-scheme: dark)')
const listeners = new Set<() => void>()

function readPref(): ThemePref {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved
  } catch {
    // private mode
  }
  return 'system'
}

let pref: ThemePref = readPref()

const resolve = (p: ThemePref): 'light' | 'dark' => (p === 'system' ? (media.matches ? 'dark' : 'light') : p)

// index.html ใส่ class ให้ก่อนแล้วตอนโหลดหน้า (กันจอกระพริบขาว) ตรงนี้คอยอัปเดตตอนเปลี่ยน
function apply() {
  const dark = resolve(pref) === 'dark'
  document.documentElement.classList.toggle('dark', dark)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#1c1917' : '#f97316')
  listeners.forEach((l) => l())
}

media.addEventListener('change', () => pref === 'system' && apply())
apply()

function setThemePref(next: ThemePref) {
  pref = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // private mode — แค่ไม่จำ
  }
  apply()
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useTheme() {
  const current = useSyncExternalStore(subscribe, () => pref)
  const resolved = useSyncExternalStore(subscribe, () => resolve(pref))
  return { pref: current, resolved, setThemePref }
}
