import { useCallback, useSyncExternalStore } from 'react'
import { getLang, setLang, subscribeLang, translate, type TParams } from '../i18n'

export function useI18n() {
  const lang = useSyncExternalStore(subscribeLang, getLang)
  const t = useCallback((key: string, params?: TParams) => translate(key, params, lang), [lang])
  return { t, lang, setLang }
}
