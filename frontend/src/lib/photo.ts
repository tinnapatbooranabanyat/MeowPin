import imageCompression from 'browser-image-compression'
import exifr from 'exifr'
import type { FurColor, LatLng } from '../types'

export interface PhotoMeta {
  position: LatLng | null
  takenAt: Date | null
  /** มีช่อง GPS ในรูปแต่ค่าถูกล้างเป็น 0 — มือถือ/เบราว์เซอร์ลบตำแหน่งออกตอนเลือกรูป */
  gpsRedacted: boolean
}

/** อ่าน GPS และเวลาที่ถ่ายจาก EXIF — ต้องอ่านจากไฟล์ต้นฉบับก่อนบีบอัด เพราะการบีบอัดจะลบ EXIF ทิ้ง */
export async function readPhotoMeta(file: File): Promise<PhotoMeta> {
  try {
    // ต้องใช้ exifr.gps() แยก — ถ้าใช้ parse แบบ pick จะไม่ได้ latitude/longitude ที่แปลงแล้ว
    const [gps, data, rawGps] = await Promise.all([
      exifr.gps(file).catch(() => undefined),
      exifr.parse(file, ['DateTimeOriginal']).catch(() => undefined),
      exifr.parse(file, { gps: true, exif: false, translateValues: false, reviveValues: false }).catch(() => undefined),
    ])
    const lat = gps?.latitude
    const lng = gps?.longitude
    const valid = Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)
    const takenAt = data?.DateTimeOriginal instanceof Date ? data.DateTimeOriginal : null
    const hasGpsTags = !!rawGps && Object.keys(rawGps).some((key) => key.startsWith('GPS'))
    return { position: valid ? { lat: lat!, lng: lng! } : null, takenAt, gpsRedacted: !valid && hasGpsTags }
  } catch {
    return { position: null, takenAt: null, gpsRedacted: false }
  }
}

/** ย่อรูปเป็น WebP ไม่เกิน 1280px — ได้ไฟล์เล็กและไม่มี EXIF ติดไป (กันพิกัดบ้านคนถ่ายหลุด) */
export function compressPhoto(file: File): Promise<File> {
  return imageCompression(file, {
    maxSizeMB: 0.4,
    maxWidthOrHeight: 1280,
    fileType: 'image/webp',
    // worker ของไลบรารีโหลดสคริปต์จาก CDN ภายนอก จึงปิดไว้
    useWebWorker: false,
  })
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('โหลดรูปไม่สำเร็จ'))
    img.src = src
  })
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  h *= 60
  return [h, s, l]
}

type Bbox = [x: number, y: number, width: number, height: number]

/** เดาสีขนจากพิกเซลกลางกรอบที่เจอแมว — เป็นแค่ค่าเริ่มต้นให้ผู้ใช้แก้ได้ */
export function guessFurColor(img: HTMLImageElement, bbox?: Bbox): FurColor {
  const [x, y, w, h] = bbox ?? [0, 0, img.naturalWidth, img.naturalHeight]
  const size = 40
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return 'orange'
  // ใช้แค่ 60% ตรงกลางกรอบ เพื่อตัดพื้นหลังออก
  ctx.drawImage(img, x + w * 0.2, y + h * 0.2, w * 0.6, h * 0.6, 0, 0, size, size)
  const { data } = ctx.getImageData(0, 0, size, size)

  // เดาได้แค่สีพื้นฐาน (สีผสมอย่างขาวดำ/กระดองเต่าเดาจากพิกเซลไม่แม่น ให้ผู้ใช้เลือกเอง)
  const counts: Record<Extract<FurColor, 'orange' | 'black' | 'white' | 'gray' | 'tabby'>, number> = {
    orange: 0,
    black: 0,
    white: 0,
    gray: 0,
    tabby: 0,
  }
  for (let i = 0; i < data.length; i += 4) {
    const [hue, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2])
    if (l < 0.22) counts.black++
    else if (l > 0.78 && s < 0.25) counts.white++
    else if (s < 0.15) counts.gray++
    else if (hue >= 10 && hue <= 50 && s > 0.25 && l > 0.25) counts.orange++
    else counts.tabby++
  }

  const share = (key: keyof typeof counts) => counts[key] / (size * size)
  if (share('orange') > 0.12 && share('black') > 0.12 && share('white') > 0.12) return 'calico'
  if (share('black') > 0.5) return 'black'
  if (share('white') > 0.5) return 'white'
  // แมวส้มจริงมีเงาและขนอกสีอ่อนปนเยอะ จึงใช้เกณฑ์ 30% แทนการหาค่ามากสุด
  if (share('orange') >= 0.3) return 'orange'
  return (Object.keys(counts) as (keyof typeof counts)[]).reduce((a, b) => (counts[b] > counts[a] ? b : a))
}
