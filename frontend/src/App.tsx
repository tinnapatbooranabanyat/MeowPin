import { APIProvider } from '@vis.gl/react-google-maps'
import { useEffect, useState } from 'react'
import { MapScreen } from './components/MapScreen'
import { getLang } from './i18n'
import { useI18n } from './hooks/useI18n'

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined
// DEMO_MAP_ID ใช้ทดสอบได้ไปก่อน แล้วค่อยเปลี่ยนเป็น Map ID ของเราเองเพื่อแต่งสีแผนที่
const MAP_ID = (import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string | undefined) || 'DEMO_MAP_ID'

function App() {
  const { t, lang } = useI18n()
  // Google Maps โหลดภาษาได้ครั้งเดียวต่อหน้า — เปลี่ยนภาษาแล้วต้องโหลดหน้าใหม่ชื่อสถานที่บนแผนที่ถึงจะเปลี่ยน
  // รอให้ข้อความในแอปจางเปลี่ยนเสร็จก่อนค่อยโหลด (กดสลับกลับภายในนั้นก็ไม่โหลด) — มุมกล้องและน้องที่เปิดอยู่จำไว้แล้ว
  const [mapLang] = useState(getLang)
  useEffect(() => {
    if (lang === mapLang || !API_KEY) return
    const timer = window.setTimeout(() => window.location.reload(), 700)
    return () => window.clearTimeout(timer)
  }, [lang, mapLang])
  if (!API_KEY) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-stone-600">
        {t('ยังไม่ได้ตั้งค่า VITE_GOOGLE_MAPS_API_KEY — ในเครื่องใส่ใน frontend/.env.local ส่วนบน Vercel ใส่ที่ Settings → Environment Variables แล้วกด Redeploy')}
      </div>
    )
  }

  return (
    <APIProvider apiKey={API_KEY} language={mapLang} region="TH">
      <MapScreen mapId={MAP_ID} />
    </APIProvider>
  )
}

export default App
