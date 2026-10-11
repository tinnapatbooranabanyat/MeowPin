import { useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'

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

function setThemePref(next: ThemePref, origin?: { x: number; y: number }) {
  pref = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // private mode — แค่ไม่จำ
  }
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!document.startViewTransition || reduceMotion) return apply()

  // ถ่ายภาพหน้าจอเดิม → เปลี่ยนธีม (render ให้เสร็จทันทีด้วย flushSync) → เผยธีมใหม่เป็นวงกลมจากจุดที่กด
  const x = origin?.x ?? window.innerWidth / 2
  const y = origin?.y ?? window.innerHeight / 2
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
  const root = document.documentElement
  root.classList.add('theme-transition')
  const transition = document.startViewTransition(() => flushSync(apply))
  transition.ready.then(() =>
    root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 550, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', pseudoElement: '::view-transition-new(root)' },
    ),
  )
  transition.finished.finally(() => root.classList.remove('theme-transition'))
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
