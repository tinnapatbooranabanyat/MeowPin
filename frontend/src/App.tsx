import { APIProvider } from '@vis.gl/react-google-maps'
import { useState } from 'react'
import { MapScreen } from './components/MapScreen'
import { getLang } from './i18n'
import { useI18n } from './hooks/useI18n'

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined
// DEMO_MAP_ID ใช้ทดสอบได้ไปก่อน แล้วค่อยเปลี่ยนเป็น Map ID ของเราเองเพื่อแต่งสีแผนที่
const MAP_ID = (import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string | undefined) || 'DEMO_MAP_ID'

function App() {
  const { t } = useI18n()
  // Google Maps โหลดภาษาได้ครั้งเดียว — ชื่อสถานที่บนแผนที่จะเปลี่ยนตามภาษาหลังรีเฟรช
  const [mapLang] = useState(getLang)
  if (!API_KEY) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-stone-600">
        {t('ยังไม่ได้ใส่ VITE_GOOGLE_MAPS_API_KEY ในไฟล์ frontend/.env.local')}
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
