import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './components/auth/AuthProvider.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

// ลิงก์แชร์ /c/:id ปกติ Vercel ส่งต่อให้แล้ว (api/share.ts) — เผื่อเปิดตรงๆ (เช่นตอนรันในเครื่อง) ก็แปลงเป็น ?cat=
const sharePath = window.location.pathname.match(/^\/c\/([0-9a-f-]{36})\/?$/i)
if (sharePath) window.history.replaceState(null, '', `/?cat=${sharePath[1]}`)

// deploy เวอร์ชันใหม่แล้ว ไฟล์ย่อยของเวอร์ชันเก่า (ที่โหลดตอนกดเปิดหน้าต่างต่างๆ) จะหายไป
// → โหลดหน้าใหม่ให้ได้เวอร์ชันล่าสุด (กันวนไม่จบด้วยการเว้นอย่างน้อย 1 นาที)
window.addEventListener('vite:preloadError', (event) => {
  const key = 'meowpin.reloadedForUpdate'
  try {
    const last = Number(sessionStorage.getItem(key) ?? 0)
    if (Date.now() - last < 60_000) return
    sessionStorage.setItem(key, String(Date.now()))
  } catch {
    // ไม่มี sessionStorage ก็โหลดใหม่ได้
  }
  event.preventDefault()
  window.location.reload()
})

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
