import { useCallback, useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'
import { getLang, setLang, subscribeLang, translate, type Lang, type TParams } from '../i18n'

/** เปลี่ยนภาษาแบบค่อยๆ เฟด (View Transitions) ถ้าเบราว์เซอร์รองรับ */
function setLangAnimated(next: Lang) {
  if (next === getLang()) return
  if (!document.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setLang(next)
  document.startViewTransition(() => flushSync(() => setLang(next)))
}

export function useI18n() {
  const lang = useSyncExternalStore(subscribeLang, getLang)
  const t = useCallback((key: string, params?: TParams) => translate(key, params, lang), [lang])
  return { t, lang, setLang: setLangAnimated }
}
