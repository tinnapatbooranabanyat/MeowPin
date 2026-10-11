import { ExternalLink, Languages, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '../hooks/useI18n'
import { detectTextLang, googleTranslateUrl, hasBrowserTranslator, translateText } from '../lib/translate'

interface Props {
  text: string
  className?: string
}

/** ข้อความที่ผู้ใช้เขียน + ปุ่ม "ดูคำแปล" ถ้าเป็นคนละภาษากับภาษาที่เลือกในแอป */
export function TranslatableText({ text, className = '' }: Props) {
  const { t, lang } = useI18n()
  const [translated, setTranslated] = useState<string | null>(null)
  const [showing, setShowing] = useState(false)
  const [loading, setLoading] = useState(false)
  // เบราว์เซอร์แปลให้ไม่ได้ → ให้เป็นลิงก์ที่ผู้ใช้กดเอง (เปิดแท็บใหม่หลัง await จะโดนบล็อก popup)
  const [fallback, setFallback] = useState(!hasBrowserTranslator)
  const source = detectTextLang(text)
  const canTranslate = source !== null && source !== lang

  const translate = async () => {
    if (translated) return setShowing(true)
    if (!source) return
    setLoading(true)
    const result = await translateText(text, source, lang)
    setLoading(false)
    if (result) {
      setTranslated(result)
      setShowing(true)
    } else {
      setFallback(true)
    }
  }

  const linkClass = 'mt-1 flex items-center gap-1 text-xs font-medium text-sky-700 hover:underline'

  return (
    <div>
      <p key={showing ? 'translated' : 'original'} className={`animate-fade-in whitespace-pre-line ${className}`}>
        {showing && translated ? translated : text}
      </p>
      {canTranslate &&
        (fallback && !showing ? (
          <a href={googleTranslateUrl(text, lang)} target="_blank" rel="noopener noreferrer" className={linkClass}>
            <Languages size={13} aria-hidden="true" />
            {t('ดูคำแปลใน Google Translate')}
            <ExternalLink size={11} aria-hidden="true" />
          </a>
        ) : (
          <button
            type="button"
            onClick={showing ? () => setShowing(false) : translate}
            disabled={loading}
            className={linkClass}
          >
            {loading ? (
              <LoaderCircle size={13} className="animate-spin" aria-hidden="true" />
            ) : (
              <Languages size={13} aria-hidden="true" />
            )}
            {loading ? t('กำลังแปล…') : showing ? t('ดูต้นฉบับ') : t('ดูคำแปล')}
          </button>
        ))}
      {showing && translated && <p className="mt-0.5 text-[11px] text-stone-400">{t('แปลอัตโนมัติโดยเบราว์เซอร์')}</p>}
    </div>
  )
}
