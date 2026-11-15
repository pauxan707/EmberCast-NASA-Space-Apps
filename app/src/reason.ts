import { activityRatio } from './data'
import type { Zone } from './data'
import type { Key, Lang } from './i18n'
import { fmtNum } from './ui'

/** One plain-language sentence for a reason group, with the zone's own numbers. */
export function reasonText(t: (k: Key, v?: Record<string, string | number>) => string, g: string, v: number, z: Zone, lang: Lang) {
  const vars = { dry: z.dry, tmax: fmtNum(z.tmax, lang, 1), rh: z.rh, wind: fmtNum(z.wind, lang, 1), ratio: fmtNum(activityRatio(z), lang, 1), rain: z.rain30 }
  return t(`why_${g}_${v >= 0 ? 'up' : 'down'}` as Key, vars)
}
