import { ExternalLink } from 'lucide-react'
import { useState } from 'react'
import {
  siFastapi,
  siGithub,
  siGooglegemini,
  siGooglemaps,
  siOnnx,
  siPostgresql,
  siPython,
  siReact,
  siReactquery,
  siRender,
  siSupabase,
  siTailwindcss,
  siTensorflow,
  siTypescript,
  siVercel,
  siVite,
  type SimpleIcon,
} from 'simple-icons'
import { useI18n } from '../../hooks/useI18n'
import { Modal } from '../ui/Modal'

const REPO_URL = 'https://github.com/tinnapatbooranabanyat/MeowPin'

interface Tech {
  icon: SimpleIcon
  name: string
  /** ข้อความไทย (เป็น key ของ t()) */
  role: string
}

const STACK: { title: string; items: Tech[] }[] = [
  {
    title: 'หน้าเว็บ (Frontend)',
    items: [
      { icon: siReact, name: 'React 19', role: 'สร้างหน้าตาและการทำงานของแอป' },
      { icon: siTypescript, name: 'TypeScript', role: 'ภาษาที่ใช้เขียนทั้งหน้าเว็บ' },
      { icon: siVite, name: 'Vite', role: 'build และรันตอนพัฒนา' },
      { icon: siTailwindcss, name: 'Tailwind CSS', role: 'ตกแต่งหน้าตา ธีมสว่าง/มืด' },
      { icon: siReactquery, name: 'TanStack Query', role: 'ดึงและแคชข้อมูล' },
      { icon: siGooglemaps, name: 'Google Maps Platform', role: 'แผนที่และค้นหาสถานที่' },
      { icon: siTensorflow, name: 'TensorFlow.js', role: 'เช็กว่าในรูปมีแมวตั้งแต่ในเครื่อง' },
    ],
  },
  {
    title: 'เซิร์ฟเวอร์ (Backend)',
    items: [
      { icon: siPython, name: 'Python', role: 'ภาษาที่ใช้เขียนเซิร์ฟเวอร์' },
      { icon: siFastapi, name: 'FastAPI', role: 'API สำหรับปักหมุด อัปโหลดรูป และงานของ admin' },
      { icon: siOnnx, name: 'ONNX Runtime', role: 'ตรวจรูปแมวซ้ำฝั่งเซิร์ฟเวอร์ (SSD MobileNet)' },
      { icon: siGooglegemini, name: 'Google Gemini', role: 'สรุปรีวิวน้องแมวด้วย AI' },
    ],
  },
  {
    title: 'ฐานข้อมูล',
    items: [
      { icon: siSupabase, name: 'Supabase', role: 'ล็อกอินด้วย Google และเก็บรูป' },
      { icon: siPostgresql, name: 'PostgreSQL + PostGIS', role: 'เก็บหมุด รีวิว และค้นหาตามพื้นที่บนแผนที่' },
    ],
  },
  {
    title: 'Deploy',
    items: [
      { icon: siVercel, name: 'Vercel', role: 'โฮสต์หน้าเว็บ' },
      { icon: siRender, name: 'Render', role: 'โฮสต์เซิร์ฟเวอร์ FastAPI' },
      { icon: siSupabase, name: 'Supabase Cloud', role: 'โฮสต์ฐานข้อมูล (สิงคโปร์)' },
      { icon: siGithub, name: 'GitHub', role: 'เก็บโค้ด และ deploy อัตโนมัติเมื่อ push' },
    ],
  },
]

/** โลโก้สีเข้มมาก (เช่น Vercel, GitHub) จะมองไม่เห็นในธีมมืด — ใช้สีตัวอักษรแทน */
function isTooDark(hex: string) {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.2
}

function BrandIcon({ icon }: { icon: SimpleIcon }) {
  const dark = isTooDark(icon.hex)
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`size-6 ${dark ? 'text-stone-900' : ''}`}>
      <path d={icon.path} fill={dark ? 'currentColor' : `#${icon.hex}`} />
    </svg>
  )
}

export function AboutDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  // รูปปก (ไม่บังคับ) — วางไฟล์ไว้ที่ frontend/public/about/cover.webp ถ้าไม่มีจะซ่อนเอง
  const [hasCover, setHasCover] = useState(true)

  return (
    <Modal title={t('เกี่ยวกับเว็บไซต์')} onClose={onClose} wide>
      {hasCover && (
        <img
          src="/about/cover.webp"
          alt=""
          onError={() => setHasCover(false)}
          className="mb-4 aspect-[2/1] w-full rounded-2xl bg-stone-100 object-cover"
        />
      )}

      <div className="mb-5 flex items-center gap-3">
        <img src="/favicon.svg" alt="" className="size-12 shrink-0" />
        <div>
          <p className="font-display text-lg text-stone-900">MeowPin</p>
          <p className="text-sm text-stone-600">
            {t('แผนที่ชุมชนสำหรับปักหมุดน้องแมวจรและแมวในละแวกบ้าน ให้คนรักแมวช่วยกันบันทึกและดูแล')}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {STACK.map((group) => (
          <section key={group.title}>
            <h3 className="mb-2 text-sm font-medium text-stone-500">{t(group.title)}</h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {group.items.map((item) => (
                <li key={item.name} className="flex items-center gap-3 rounded-2xl bg-stone-50 px-3 py-2.5 ring-1 ring-stone-100">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface shadow-sm ring-1 ring-stone-200">
                    <BrandIcon icon={item.icon} />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium text-stone-900">{item.name}</span>
                    <span className="block text-xs leading-snug text-stone-600">{t(item.role)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <a
        href={REPO_URL}
        target="_blank"
        rel="noreferrer"
        className="mt-5 flex items-center justify-center gap-2 rounded-full border border-stone-300 px-4 py-2.5 font-medium text-stone-800 transition hover:bg-stone-100"
      >
        <BrandIcon icon={siGithub} />
        {t('ดูซอร์สโค้ดบน GitHub')}
        <ExternalLink size={15} aria-hidden="true" />
      </a>
    </Modal>
  )
}
