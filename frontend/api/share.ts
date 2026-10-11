// Vercel Function (/c/:id → /api/share?cat=:id): ลิงก์แชร์น้องแมวที่มีรูปตัวอย่างใน LINE/Facebook
// คนกดลิงก์ → ส่งต่อไปหน้าแผนที่ทันที / ระบบของแอปแชทที่มาอ่านลิงก์ → ได้หน้า HTML ที่มีแท็ก Open Graph
declare const process: { env: Record<string, string | undefined> }

// LINE ใช้ "line-poker" อ่านลิงก์ — ห้ามจับแค่ "line" เพราะเบราว์เซอร์ในแอป LINE ของคนจริงก็มีคำนี้
const BOT = /facebookexternalhit|facebot|line-poker|twitterbot|slackbot|discordbot|whatsapp|telegrambot|linkedinbot|googlebot|bingbot|embedly|pinterest|skypeuripreview|kakaotalk|viber/i
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface CatRow {
  name: string
  place_name: string
  description: string
  paw_avg: number | null
  review_count: number
  photo_path: string | null
  help_kinds?: string[]
}

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

async function fetchCat(id: string): Promise<CatRow | null> {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return null
  const base = `${url}/rest/v1/cats_public?id=eq.${id}&select=name,place_name,description,paw_avg,review_count,photo_path`
  // help_kinds มีหลังรัน migration 0011 — ไม่มีก็ลองใหม่แบบไม่ขอคอลัมน์นี้
  for (const query of [`${base},help_kinds`, base]) {
    const res = await fetch(query, { headers: { apikey: key } }).catch(() => null)
    if (res?.ok) {
      const rows = (await res.json()) as CatRow[]
      return rows[0] ?? null
    }
  }
  return null
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const id = url.searchParams.get('cat') ?? ''
  const appUrl = `${url.origin}/${UUID.test(id) ? `?cat=${id}` : ''}`
  const isBot = BOT.test(request.headers.get('user-agent') ?? '')
  if (!UUID.test(id) || !isBot) return Response.redirect(appUrl, 302)

  const cat = await fetchCat(id)
  if (!cat) return Response.redirect(appUrl, 302)

  const api = (process.env.VITE_API_URL ?? '').replace(/\/$/, '')
  const image = cat.photo_path && api ? `${api}/cats/${id}/og.jpg` : `${url.origin}/og-default.png`
  const bits = [
    cat.place_name && `📍 ${cat.place_name}`,
    cat.review_count > 0 && cat.paw_avg !== null && `🐾 ${cat.paw_avg} (${cat.review_count} รีวิว)`,
    cat.help_kinds?.length && '🚑 ต้องการความช่วยเหลือ',
  ].filter(Boolean)
  const description =
    [bits.join(' · '), cat.description].filter(Boolean).join(' — ').replace(/\s+/g, ' ').slice(0, 200) ||
    'มาดูน้องแมวบนแผนที่ MeowPin'
  const title = `น้อง${cat.name} · MeowPin`
  const shareUrl = `${url.origin}/c/${id}`

  const html = `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8" />
<title>${escape(title)}</title>
<meta name="description" content="${escape(description)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="MeowPin" />
<meta property="og:title" content="${escape(title)}" />
<meta property="og:description" content="${escape(description)}" />
<meta property="og:url" content="${escape(shareUrl)}" />
<meta property="og:image" content="${escape(image)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
</head>
<body><a href="${escape(appUrl)}">${escape(title)}</a><script>location.replace(${JSON.stringify(appUrl)})</script></body>
</html>`
  return new Response(html, {
    // ห้าม CDN เก็บไว้: คำตอบต่างกันระหว่าง bot กับคน (คนต้องได้ 302 ไปหน้าแผนที่)
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', vary: 'User-Agent' },
  })
}
