// การ์ดแชร์ลง story (1080×1920) — วาดในเบราว์เซอร์ เพราะเบราว์เซอร์วาดตัวอักษรไทย (วรรณยุกต์ซ้อน) ได้ถูกต้อง
import type { Cat } from '../types'

const W = 1080
const H = 1920
const ORANGE = '#FF741B'
const INK = '#2B1D14'
const MUTED = '#7A6656'
const CREAM = '#FFF6EE'
const DISPLAY = 'Mitr, "IBM Plex Sans Thai", sans-serif'
const SANS = '"IBM Plex Sans Thai", sans-serif'
const SITE = 'meowpin-th.vercel.app'

type Lang = 'th' | 'en'
const tx = (lang: Lang, th: string, en: string) => (lang === 'en' ? en : th)

async function ensureFonts() {
  try {
    await Promise.all([
      document.fonts.load(`500 64px Mitr`),
      document.fonts.load(`500 40px "IBM Plex Sans Thai"`),
      document.fonts.load(`600 40px "IBM Plex Sans Thai"`),
    ])
  } catch {
    // โหลดฟอนต์ไม่ได้ก็ใช้ฟอนต์ของเครื่อง
  }
}

/** โหลดรูปแบบไม่ทำให้ canvas "ปนเปื้อน" (ต้องอนุญาต CORS) — โหลดไม่ได้คืน null แล้ววาดแบบไม่มีรูป */
async function loadImage(url: string | null | undefined): Promise<ImageBitmap | null> {
  if (!url) return null
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) return null
    return await createImageBitmap(await res.blob())
  } catch {
    return null
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

/** วาดรูปแบบ cover (ครอปให้เต็มกรอบ) */
function drawCover(ctx: CanvasRenderingContext2D, img: ImageBitmap, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height)
  const sw = w / scale
  const sh = h / scale
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h)
}

/** ตัดข้อความให้พอดีความกว้าง */
function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text
  let s = text
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxWidth) s = s.slice(0, -1)
  return `${s}…`
}

function background(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#FF9A4D')
  g.addColorStop(0.45, ORANGE)
  g.addColorStop(1, '#E85D0C')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  // ลายอุ้งเท้าจางๆ
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  for (const [cx, cy, s] of [
    [140, 260, 1],
    [930, 520, 0.8],
    [120, 1500, 0.9],
    [960, 1700, 1.1],
  ] as const) {
    ctx.beginPath()
    ctx.ellipse(cx, cy, 70 * s, 60 * s, 0, 0, Math.PI * 2)
    for (const [dx, dy] of [
      [-70, -85],
      [-25, -120],
      [25, -120],
      [70, -85],
    ])
      ctx.ellipse(cx + dx * s, cy + dy * s, 24 * s, 30 * s, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

async function header(ctx: CanvasRenderingContext2D) {
  const logo = await loadImage('/pwa-192.png')
  if (logo) {
    ctx.save()
    roundRect(ctx, 80, 90, 96, 96, 26)
    ctx.clip()
    ctx.drawImage(logo, 80, 90, 96, 96)
    ctx.restore()
  }
  ctx.fillStyle = '#fff'
  ctx.font = `500 60px ${DISPLAY}`
  ctx.textBaseline = 'middle'
  ctx.fillText('MeowPin', 200, 140)
}

function footer(ctx: CanvasRenderingContext2D, lang: Lang) {
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#fff'
  ctx.font = `500 46px ${DISPLAY}`
  ctx.fillText(tx(lang, 'มาตามหาน้องแมวใกล้คุณกัน', 'Find the cats near you'), W / 2, H - 150)
  ctx.font = `500 38px ${SANS}`
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.fillText(SITE, W / 2, H - 92)
  ctx.textAlign = 'left'
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'))
}

function newCanvas() {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  return { canvas, ctx: canvas.getContext('2d')! }
}

/** ช่องรูปน้อง (มีรูป → ครอป / ไม่มี → สีอ่อนกับอุ้งเท้า) */
function catTile(ctx: CanvasRenderingContext2D, img: ImageBitmap | null, name: string, x: number, y: number, size: number) {
  ctx.save()
  roundRect(ctx, x, y, size, size, 36)
  ctx.clip()
  if (img) drawCover(ctx, img, x, y, size, size)
  else {
    ctx.fillStyle = '#FFE3CC'
    ctx.fillRect(x, y, size, size)
  }
  // ชื่อน้องด้านล่าง
  const g = ctx.createLinearGradient(0, y + size - 120, 0, y + size)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, 'rgba(0,0,0,0.6)')
  ctx.fillStyle = g
  ctx.fillRect(x, y + size - 120, size, 120)
  ctx.restore()
  ctx.fillStyle = '#fff'
  ctx.font = `500 38px ${DISPLAY}`
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(fit(ctx, name, size - 48), x + 24, y + size - 28)
}

export interface CollectionCardInput {
  name: string
  avatarUrl: string | null
  cats: number
  zones: number
  completed: number
  mayorZones: string[]
  recentCats: Pick<Cat, 'name' | 'photoUrl'>[]
}

/** การ์ดสมุดสะสม: เจอน้องมาแล้วกี่ตัว + เจ้าถิ่น + รูปน้องล่าสุด */
export async function drawCollectionCard(input: CollectionCardInput, lang: Lang): Promise<Blob> {
  await ensureFonts()
  const { canvas, ctx } = newCanvas()
  background(ctx)
  await header(ctx)

  // แผ่นครีมตรงกลาง
  ctx.fillStyle = CREAM
  roundRect(ctx, 60, 250, W - 120, 1420, 56)
  ctx.fill()

  // รูปโปรไฟล์
  const avatar = await loadImage(input.avatarUrl)
  const ax = W / 2
  const ay = 370
  const r = 90
  ctx.save()
  ctx.beginPath()
  ctx.arc(ax, ay, r, 0, Math.PI * 2)
  ctx.clip()
  if (avatar) drawCover(ctx, avatar, ax - r, ay - r, r * 2, r * 2)
  else {
    ctx.fillStyle = '#FFD3B0'
    ctx.fillRect(ax - r, ay - r, r * 2, r * 2)
    ctx.fillStyle = ORANGE
    ctx.font = `500 96px ${DISPLAY}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(input.name.slice(0, 1).toUpperCase(), ax, ay + 6)
  }
  ctx.restore()
  ctx.lineWidth = 10
  ctx.strokeStyle = '#fff'
  ctx.beginPath()
  ctx.arc(ax, ay, r, 0, Math.PI * 2)
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = INK
  ctx.font = `500 56px ${DISPLAY}`
  ctx.fillText(fit(ctx, input.name, W - 240), W / 2, 530)

  // ตัวเลขใหญ่
  ctx.fillStyle = ORANGE
  ctx.font = `500 180px ${DISPLAY}`
  ctx.fillText(String(input.cats), W / 2, 730)
  ctx.fillStyle = INK
  ctx.font = `500 50px ${DISPLAY}`
  ctx.fillText(tx(lang, 'น้องแมวที่เจอแล้ว', 'cats found'), W / 2, 805)
  ctx.fillStyle = MUTED
  ctx.font = `500 38px ${SANS}`
  ctx.fillText(
    tx(lang, `${input.zones} โซน · เจอครบ ${input.completed} โซน`, `${input.zones} zone${input.zones === 1 ? '' : 's'} · ${input.completed} completed`),
    W / 2,
    865,
  )

  // เจ้าถิ่น
  let y = 905
  if (input.mayorZones.length) {
    ctx.font = `600 36px ${SANS}`
    const label = fit(
      ctx,
      `👑 ${tx(lang, 'เจ้าถิ่น', 'Local Legend of')} ${input.mayorZones.slice(0, 2).join(', ')}${input.mayorZones.length > 2 ? ` +${input.mayorZones.length - 2}` : ''}`,
      W - 280,
    )
    const w = ctx.measureText(label).width + 64
    ctx.fillStyle = '#FDE68A'
    roundRect(ctx, (W - w) / 2, y, w, 72, 36)
    ctx.fill()
    ctx.fillStyle = '#7C4A03'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, W / 2, y + 38)
    ctx.textBaseline = 'alphabetic'
    y += 100
  } else y += 40
  ctx.textAlign = 'left'

  // รูปน้องล่าสุด 2×2
  const recent = input.recentCats.slice(0, 4)
  const imgs = await Promise.all(recent.map((c) => loadImage(c.photoUrl)))
  // พื้นที่ที่เหลือในแผ่นครีม (ล่างสุดที่ 1640) แบ่งเป็น 2×2
  const gap = 24
  const size = Math.min(420, Math.floor((1640 - y - gap) / 2))
  const gx = (W - size * 2 - gap) / 2
  recent.forEach((cat, i) => {
    catTile(ctx, imgs[i], cat.name, gx + (i % 2) * (size + gap), y + Math.floor(i / 2) * (size + gap), size)
  })

  footer(ctx, lang)
  return toBlob(canvas)
}

export interface CatCardInput {
  name: string
  photoUrl?: string
  place: string
  zone: string | null
  sightings: number
  furLabel: string
}

/** การ์ดน้องตัวเดียว: รูปใหญ่ + ชื่อ + ที่อยู่ */
export async function drawCatCard(input: CatCardInput, lang: Lang): Promise<Blob> {
  await ensureFonts()
  const { canvas, ctx } = newCanvas()
  background(ctx)
  await header(ctx)

  const photo = await loadImage(input.photoUrl)
  const px = 60
  const py = 250
  const pw = W - 120
  const ph = 1060
  ctx.save()
  roundRect(ctx, px, py, pw, ph, 56)
  ctx.clip()
  if (photo) drawCover(ctx, photo, px, py, pw, ph)
  else {
    ctx.fillStyle = '#FFE3CC'
    ctx.fillRect(px, py, pw, ph)
  }
  ctx.restore()

  ctx.fillStyle = CREAM
  roundRect(ctx, 60, 1250, W - 120, 420, 56)
  ctx.fill()

  ctx.fillStyle = INK
  ctx.font = `500 96px ${DISPLAY}`
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(fit(ctx, input.name, W - 240), 120, 1390)
  ctx.fillStyle = MUTED
  ctx.font = `500 40px ${SANS}`
  ctx.fillText(fit(ctx, [input.furLabel, input.zone].filter(Boolean).join(' · '), W - 240), 120, 1460)
  if (input.place) ctx.fillText(fit(ctx, `📍 ${input.place}`, W - 240), 120, 1525)
  ctx.fillStyle = ORANGE
  ctx.font = `600 40px ${SANS}`
  ctx.fillText(tx(lang, `มีคนเจอน้องแล้ว ${input.sightings} ครั้ง`, `Spotted ${input.sightings} times`), 120, 1600)

  footer(ctx, lang)
  return toBlob(canvas)
}

/** แชร์รูปผ่านหน้าแชร์ของเครื่อง (มือถือ) — ไม่รองรับคืน false ให้ไปดาวน์โหลดแทน */
export async function shareImage(blob: Blob, fileName: string, text: string): Promise<boolean> {
  const file = new File([blob], fileName, { type: 'image/png' })
  if (!navigator.canShare?.({ files: [file] })) return false
  try {
    await navigator.share({ files: [file], text: `${text} ${SITE}` })
  } catch {
    // ผู้ใช้กดยกเลิก
  }
  return true
}

export function downloadImage(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
