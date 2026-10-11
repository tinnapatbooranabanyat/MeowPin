import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './components/auth/AuthProvider.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

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
