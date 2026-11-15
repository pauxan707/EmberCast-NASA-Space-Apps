import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { DB } from './data'
import type { Key, Lang } from './i18n'

export interface AppCtx {
  db: DB; lang: Lang; setLang: (l: Lang) => void
  t: (k: Key, vars?: Record<string, string | number>) => string
  week: number; setWeek: (w: number) => void
  myZones: string[]; setMyZones: (z: string[]) => void
  route: string; go: (r: string) => void
  simulated: boolean
}
export const Ctx = createContext<AppCtx>(null as unknown as AppCtx)
export const useApp = () => useContext(Ctx)

export const LEVELS = [
  { key: 'low', color: '#3fb6a8' },
  { key: 'moderate', color: '#f2c14e' },
  { key: 'high', color: '#f5853f' },
  { key: 'veryhigh', color: '#e63946' },
] as const
export const SENSOR = { modis: '#5cc8ff', viirs: '#c792ff', harm: '#ffb347' }
// Sequential, colour-blind-safe ramp (inferno-like) for activity.
const RAMP = ['#1b0c41', '#4a0c6b', '#781c6d', '#a52c60', '#cf4446', '#ed6925', '#fb9b06', '#f7d13d', '#fcffa4']
export function ramp(v: number): string {
  if (!(v > 0)) return '#131a22'
  const x = Math.min(0.999, Math.max(0, v)) * (RAMP.length - 1)
  const i = Math.floor(x), f = x - i
  const a = RAMP[i], b = RAMP[i + 1]
  const ch = (s: string, k: number) => parseInt(s.slice(1 + k * 2, 3 + k * 2), 16)
  return `rgb(${[0, 1, 2].map((k) => Math.round(ch(a, k) + (ch(b, k) - ch(a, k)) * f)).join(',')})`
}

export function fmtDate(d: Date | string, lang: Lang, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  const dd = typeof d === 'string' ? new Date(d + 'T00:00:00Z') : d
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'es-UY', { ...opts, timeZone: 'UTC' }).format(dd)
}
export const fmtNum = (n: number, lang: Lang, digits = 0) =>
  n.toLocaleString(lang === 'en' ? 'en-US' : 'es-UY', { maximumFractionDigits: digits, minimumFractionDigits: digits })

export function RiskGlyph({ level, size = 18 }: { level: number; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={1 + i * 4.3} y={13 - i * 3.6} width={3.1} height={4 + i * 3.6} rx={1}
          fill={i <= level ? LEVELS[level].color : 'rgba(255,255,255,.14)'} />
      ))}
    </svg>
  )
}
export function RiskBadge({ level, big }: { level: number; big?: boolean }) {
  const { t } = useApp()
  return (
    <span className={'badge' + (big ? ' big' : '')} style={{ color: LEVELS[level].color, borderColor: LEVELS[level].color + '66', background: LEVELS[level].color + '1c' }}>
      <RiskGlyph level={level} size={big ? 26 : 16} />
      {t(`lvl_${LEVELS[level].key}` as Key)}
    </span>
  )
}
export function Tag({ kind, children }: { kind: 'real' | 'sim' | 'info'; children: ReactNode }) {
  return <span className={'tag ' + kind}>{children}</span>
}
export function Illus() {
  const { t, simulated } = useApp()
  return simulated ? <Tag kind="sim">{t('illustrative')}</Tag> : <Tag kind="real">{t('real_backtest')}</Tag>
}
export function Card({ title, right, children, className = '' }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={'card ' + className}>
      {(title || right) && <header className="card-h"><h3>{title}</h3><div className="card-r">{right}</div></header>}
      {children}
    </section>
  )
}

// ---------------------------------------------------------------- Uruguay SVG map
const W = 520, KX = Math.cos((32.6 * Math.PI) / 180), LON0 = -58.55, LAT1 = -29.95
const S = W / ((-53.0 - LON0) * KX)
export const MAP_H = (35.05 + LAT1) * S
export const px = (lon: number) => (lon - LON0) * KX * S
export const py = (lat: number) => (LAT1 - lat) * S

export interface MapProps {
  fill?: (dept: number) => string | undefined
  cellFill?: (cell: number) => string | null
  onPick?: (dept: number) => void
  onCell?: (cell: number) => void
  selected?: number[]
  points?: { lat: number; lon: number; color: string; r?: number; ring?: boolean }[]
  route?: number[]
  labels?: boolean
  className?: string
}
export function useGeo() {
  const { db } = useApp()
  return useMemo(() => db.depts.map((d) => {
    const f = db.geo.find((g) => g.properties.id === d.id)!
    const polys = (f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [f.geometry.coordinates]) as number[][][][]
    let path = '', best: number[][] = []
    for (const poly of polys) for (const ring of poly) {
      if (ring.length > best.length) best = ring
      path += 'M' + ring.map((p) => px(p[0]).toFixed(1) + ' ' + py(p[1]).toFixed(1)).join('L') + 'Z'
    }
    let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9
    for (const p of best) { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); miny = Math.min(miny, p[1]); maxy = Math.max(maxy, p[1]) }
    return { path, cx: px((minx + maxx) / 2), cy: py((miny + maxy) / 2), lon: (minx + maxx) / 2, lat: (miny + maxy) / 2 }
  }), [db])
}
export function UyMap({ fill, cellFill, onPick, onCell, selected = [], points, route, labels, className = '' }: MapProps) {
  const { db } = useApp()
  const geo = useGeo()
  const cw = 0.25 * KX * S, chh = 0.25 * S
  return (
    <svg viewBox={`0 0 ${W} ${MAP_H}`} className={'uymap ' + className} role="img" aria-label="Map of Uruguay">
      <defs>
        
        <filter id="glow"><feGaussianBlur stdDeviation="2.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      {geo.map((g, i) => (
        <path key={i} d={g.path} className={'dept' + (onPick ? ' pick' : '')} fill={fill?.(i) ?? '#18212c'}
          onClick={onPick ? () => onPick(i) : undefined}>
          <title>{db.depts[i].name}</title>
        </path>
      ))}
      {cellFill && (
        <g>
          {db.model.cells.map((c, i) => {
            const col = cellFill(i)
            return col ? <rect key={i} x={px(c.lon - 0.125)} y={py(c.lat + 0.125)} width={cw + 0.4} height={chh + 0.4} fill={col}
              className={onCell ? 'cell pick' : 'cell'} onClick={onCell ? () => onCell(i) : undefined} /> : null
          })}
        </g>
      )}
      {cellFill && <path className="outside" fillRule="evenodd" d={`M-40 -40H${W + 40}V${MAP_H + 40}H-40Z` + geo.map((g) => g.path).join('')} />}
      {cellFill && geo.map((g, i) => <path key={i} d={g.path} className="dept-line" />)}
      {selected.map((i) => <path key={i} d={geo[i].path} className="dept-sel" />)}
      {points?.map((p, i) => (
        <circle key={i} cx={px(p.lon)} cy={py(p.lat)} r={p.r ?? 1.6} fill={p.ring ? 'none' : p.color} stroke={p.ring ? p.color : 'none'} strokeWidth={1} opacity={0.9} />
      ))}
      {route && route.length > 1 && (
        <polyline className="route" points={route.map((i) => `${geo[i].cx},${geo[i].cy}`).join(' ')} />
      )}
      {route?.map((i, n) => (
        <g key={n} transform={`translate(${geo[i].cx},${geo[i].cy})`}>
          <circle r={11} className="stop" /><text className="stop-n" textAnchor="middle" dy={4}>{n + 1}</text>
        </g>
      ))}
      {labels && geo.map((g, i) => <text key={i} x={g.cx} y={g.cy + 3} className="dept-label" textAnchor="middle">{db.depts[i].name}</text>)}
    </svg>
  )
}
export function Legend({ items }: { items: { color: string; label: string; shape?: 'dot' | 'ring' }[] }) {
  return (
    <div className="legend">
      {items.map((it) => (
        <span key={it.label}><i className={it.shape ?? ''} style={it.shape === 'ring' ? { borderColor: it.color } : { background: it.color }} />{it.label}</span>
      ))}
    </div>
  )
}
export function RiskLegend() {
  const { t } = useApp()
  return (
    <div className="legend">
      {LEVELS.map((l, i) => <span key={i}><RiskGlyph level={i} size={14} />{t(`lvl_${l.key}` as Key)}</span>)}
    </div>
  )
}
