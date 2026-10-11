// Vercel Function (/api/geo): เมือง/ประเทศโดยประมาณของคนที่เรียก
// Vercel ใส่ header ตำแหน่งจาก IP มาให้เอง — ไม่ต้องส่ง IP ของผู้ใช้ไปให้บริการอื่น
export function GET(request: Request) {
  const headers = request.headers
  const decode = (value: string | null) => {
    if (!value) return null
    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  }
  return Response.json(
    {
      city: decode(headers.get('x-vercel-ip-city')),
      region: decode(headers.get('x-vercel-ip-country-region')),
      country: headers.get('x-vercel-ip-country'),
    },
    { headers: { 'cache-control': 'no-store' } },
  )
}
