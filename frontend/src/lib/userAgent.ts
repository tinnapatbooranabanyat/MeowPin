export type DeviceKind = 'phone' | 'tablet' | 'desktop'

export interface DeviceInfo {
  kind: DeviceKind
  browser: string | null
  os: string | null
}

const BROWSERS: [RegExp, string][] = [
  [/EdgA?\/|EdgiOS/, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/SamsungBrowser/, 'Samsung Internet'],
  [/\bLine\//, 'LINE'],
  [/FBAN|FBAV/, 'Facebook'],
  [/Instagram/, 'Instagram'],
  [/Firefox|FxiOS/, 'Firefox'],
  [/CriOS|Chrome\//, 'Chrome'],
  [/Safari\//, 'Safari'],
]

/** อ่านชื่อเบราว์เซอร์/ระบบปฏิบัติการแบบคร่าวๆ จาก User-Agent (พอให้ผู้ใช้จำได้ว่าเครื่องไหน) */
export function parseUserAgent(ua: string | null): DeviceInfo {
  if (!ua) return { kind: 'desktop', browser: null, os: null }
  const browser = BROWSERS.find(([re]) => re.test(ua))?.[1] ?? null
  if (/iPad/.test(ua)) return { kind: 'tablet', browser, os: 'iPadOS' }
  if (/iPhone|iPod/.test(ua)) return { kind: 'phone', browser, os: 'iOS' }
  if (/Android/.test(ua)) return { kind: /Mobile/.test(ua) ? 'phone' : 'tablet', browser, os: 'Android' }
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /CrOS/.test(ua)
      ? 'ChromeOS'
      : /Mac OS X|Macintosh/.test(ua)
        ? 'macOS'
        : /Linux/.test(ua)
          ? 'Linux'
          : null
  return { kind: 'desktop', browser, os }
}

/** session_id ใน access token ของ Supabase — ใช้จำว่าเครื่องนี้บันทึกตำแหน่งไปแล้วหรือยัง */
export function sessionIdOf(accessToken: string): string | null {
  try {
    const payload = accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const claims = JSON.parse(atob(payload)) as { session_id?: string }
    return claims.session_id ?? null
  } catch {
    return null
  }
}
