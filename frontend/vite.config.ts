import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // ติดตั้งเป็นแอปบนมือถือได้ + เก็บไฟล์ของแอปไว้ในเครื่อง (เปิดเร็วขึ้น และไม่เจอไฟล์ย่อยหายหลัง deploy)
    VitePWA({
      // ไม่โหลดหน้าใหม่เอง (ผู้ใช้อาจกรอกฟอร์มค้างอยู่) — ขึ้นแถบให้กดอัปเดตเอง ดู UpdatePrompt.tsx
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'MeowPin — แผนที่แมวเหมียว',
        short_name: 'MeowPin',
        description: 'ปักหมุดน้องแมวใกล้บ้าน รีวิว และช่วยดูแลน้องแมวด้วยกัน',
        lang: 'th',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#f97316',
        background_color: '#faf7f2',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // รูปตัวอย่างตอนแชร์ลิงก์ใช้แค่ตอน LINE/Facebook มาอ่าน ไม่ต้องเก็บไว้ในเครื่อง
        globIgnores: ['**/og-default.png'],
        // ลิงก์แชร์ (/c/:id) และ Vercel Function ต้องไปถึง server จริง ไม่ใช่หน้าแอปในเครื่อง
        navigateFallbackDenylist: [/^\/api\//, /^\/c\//],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        // รับแจ้งเตือนเด้ง (Web Push) — ดู public/push-sw.js
        importScripts: ['push-sw.js'],
      },
    }),
  ],
})
