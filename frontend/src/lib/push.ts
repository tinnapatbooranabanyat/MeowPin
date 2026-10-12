import { callBackendJson } from './api'

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '')

export type PushState = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on'

const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent)
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  // service worker มีเฉพาะตอน build จริง (ตอน dev ไม่มี)
  const reg = await navigator.serviceWorker.getRegistration()
  return reg ?? null
}

/** เครื่องนี้รับแจ้งเตือนได้ไหม และเปิดอยู่หรือเปล่า */
export async function getPushState(): Promise<PushState> {
  // iPhone/iPad รับแจ้งเตือนได้เฉพาะตอนติดตั้งแอปลงหน้าจอหลักแล้ว
  if (isIos() && !isStandalone()) return 'needs-install'
  if (!('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  const reg = await registration()
  if (!reg) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  return (await reg.pushManager.getSubscription()) ? 'on' : 'off'
}

function keyToBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

/** ขอสิทธิ์ + สมัครรับแจ้งเตือนบนเครื่องนี้ (ข้อความจะเป็นภาษาที่ส่งมา) */
export async function enablePush(lang: 'th' | 'en'): Promise<PushState> {
  const reg = await registration()
  if (!reg || !API_URL) return 'unsupported'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off'
  const res = await fetch(`${API_URL}/push/public-key`)
  if (!res.ok) throw new Error('ยังไม่ได้ตั้งค่าการแจ้งเตือนบนมือถือที่ server')
  const { key } = (await res.json()) as { key: string }
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(key) }))
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
  await callBackendJson('POST', '/push/subscribe', { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, lang })
  return 'on'
}

export async function disablePush(): Promise<PushState> {
  const reg = await registration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) {
    await callBackendJson('POST', '/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {})
    await sub.unsubscribe()
  }
  return 'off'
}
