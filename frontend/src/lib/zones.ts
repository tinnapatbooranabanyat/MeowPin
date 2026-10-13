import type { ZoneInfo } from '../types'

/** ชื่อโซนตามภาษาของแอป */
export const zoneLabel = (z: Pick<ZoneInfo, 'nameTh' | 'nameEn'>, lang: string) => (lang === 'en' ? z.nameEn : z.nameTh)
export const provinceLabel = (z: Pick<ZoneInfo, 'provinceTh' | 'provinceEn'>, lang: string) => (lang === 'en' ? z.provinceEn : z.provinceTh)
