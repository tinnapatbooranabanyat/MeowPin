// แจ้ง error ไป Sentry — เปิดเฉพาะเมื่อตั้ง VITE_SENTRY_DSN (ไม่ตั้ง = ไม่โหลดไลบรารีเลย แอปไม่หนักขึ้น)
const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined

type SentryModule = typeof import('@sentry/react')
let sentry: Promise<SentryModule | null> | null = null

export function initMonitoring(): void {
  if (!DSN || sentry) return
  sentry = import('@sentry/react')
    .then((Sentry) => {
      Sentry.init({
        dsn: DSN,
        environment: import.meta.env.MODE,
        // ไม่ส่งข้อมูลส่วนตัว (IP, cookie) และไม่เก็บการทำงานของหน้าเว็บ — เอาแค่ error
        sendDefaultPii: false,
        tracesSampleRate: 0,
        // error จากส่วนขยายเบราว์เซอร์/เน็ตหลุดไม่ใช่บั๊กของเรา
        ignoreErrors: ['ResizeObserver loop', 'Failed to fetch', 'Load failed', 'NetworkError'],
      })
      return Sentry
    })
    .catch(() => null)
}

export function reportError(error: unknown, context?: Record<string, unknown>): void {
  void sentry?.then((Sentry) => Sentry?.captureException(error, context ? { extra: context } : undefined))
}
