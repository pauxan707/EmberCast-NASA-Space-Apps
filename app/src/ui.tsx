import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { DB } from './data'
import type { RegionKey } from './config'
import type { Key, Lang } from './i18n'

export interface AppCtx {
  db: DB; lang: Lang; setLang: (l: Lang) => void
  region: RegionKey; setRegion: (r: RegionKey) => void
  t: (k: Key, vars?: Record<string, string | number>) => string
  week: number; setWeek: (w: number) => void
  myZones: string[]; setMyZones: (z: string[]) => void
  route: string; go: (r: string) => void
  simulated: boolean
}
export const Ctx = createContext<AppCtx>(null as unknown as AppCtx)
export const useApp = () => useContext(Ctx)

export const INK = '#17130f'
export const PAPER = '#f2ede3'
// Risk ramp: luminance falls monotonically, so it reads in greyscale and for colour-blind users.
export const LEVELS = [
  { key: 'low', color: '#efe2b8', fg: INK },
  { key: 'moderate', color: '#f1b941', fg: INK },
  { key: 'high', color: '#df6426', fg: INK },
  { key: 'veryhigh', color: '#8c1a12', fg: '#f8f4ec' },
] as const
export const SENSOR = { modis: '#2f8fb3', viirs: '#9a5fd0', harm: '#d93a14' }

function mix(stops: string[], v: number) {
  const x = Math.min(0.999, Math.max(0, v)) * (stops.length - 1)
  const i = Math.floor(x), f = x - i
  const ch = (s: string, k: number) => parseInt(s.slice(1 + k * 2, 3 + k * 2), 16)
  return `rgb(${[0, 1, 2].map((k) => Math.round(ch(stops[i], k) + (ch(stops[i + 1], k) - ch(stops[i], k)) * f)).join(',')})`
}
const DARK = ['#2a0f3d', '#4a0c6b', '#781c6d', '#a52c60', '#cf4446', '#ed6925', '#fb9b06', '#f7d13d', '#fcffa4']
const LIGHT = ['#f4e7b6', '#f5cc5c', '#ee9a33', '#de5f22', '#b8301a', '#7d1711', '#3d0b08']
/** Activity ramp for dark plates (brighter = more). */
export const ramp = (v: number) => (v > 0 ? mix(DARK, v) : '#1d1915')
/** Activity ramp for paper (darker = more). */
export const rampLight = (v: number) => mix(LIGHT, v)

export function fmtDate(d: Date | string, lang: Lang, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  const dd = typeof d === 'string' ? new Date(d + 'T00:00:00Z') : d
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'es-UY', { ...opts, timeZone: 'UTC' }).format(dd)
}
export const fmtNum = (n: number, lang: Lang, digits = 0) =>
  n.toLocaleString(lang === 'en' ? 'en-US' : 'es-UY', { maximumFractionDigits: digits, minimumFractionDigits: digits })

/** Four rising bars; the first level+1 are solid. Inherits the text colour. */
export function RiskGlyph({ level, size = 18 }: { level: number; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden className="glyph">
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={1.5 + i * 4} y={12.5 - i * 3.4} width={2.6} height={4 + i * 3.4}
          fill={i <= level ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={0.8} opacity={i <= level ? 1 : 0.45} />
      ))}
    </svg>
  )
}
export function RiskBadge({ level, big }: { level: number; big?: boolean }) {
  const { t } = useApp()
  return (
    <span className={'badge' + (big ? ' big' : '')}>
      <i style={{ background: LEVELS[level].color, color: LEVELS[level].fg }}><RiskGlyph level={level} size={big ? 22 : 14} /></i>
      {t(`lvl_${LEVELS[level].key}` as Key)}
    </span>
  )
}
/** Fire-danger dial, like the roadside signs. */
export function Gauge({ level, size = 180 }: { level: number; size?: number }) {
  const cx = 90, cy = 88, R = 80, r = 50
  const pt = (rad: number, a: number) => `${(cx + rad * Math.cos(a)).toFixed(2)} ${(cy - rad * Math.sin(a)).toFixed(2)}`
  const a = Math.PI - (level + 0.5) * (Math.PI / 4)
  return (
    <svg width={size} height={size * 0.56} viewBox="0 0 180 100" className="gauge" role="img" aria-label={`risk level ${level + 1} of 4`}>
      {LEVELS.map((l, i) => {
        const a0 = Math.PI - i * (Math.PI / 4), a1 = Math.PI - (i + 1) * (Math.PI / 4)
        return <path key={i} d={`M${pt(R, a0)}A${R} ${R} 0 0 1 ${pt(R, a1)}L${pt(r, a1)}A${r} ${r} 0 0 0 ${pt(r, a0)}Z`} fill={l.color} className={i === level ? 'on' : ''} />
      })}
      <line x1={cx} y1={cy} x2={cx + (R - 8) * Math.cos(a)} y2={cy - (R - 8) * Math.sin(a)} className="needle" />
      <circle cx={cx} cy={cy} r={7} className="hub" />
    </svg>
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

// ---------------------------------------------------------------- region SVG map
// The projection comes from the region's map window (meta.view in harmonized.json).
const W = 520
function projection(db: DB) {
  const v = db.meta.view
  const KX = Math.cos((v.kxLat * Math.PI) / 180)
  const S = W / ((v.lonE - v.lonW) * KX)
  return {
    H: (v.latN - v.latS) * S,
    px: (lon: number) => (lon - v.lonW) * KX * S,
    py: (lat: number) => (v.latN - lat) * S,
    cw: db.meta.grid.size * KX * S, ch: db.meta.grid.size * S, half: db.meta.grid.size / 2,
  }
}
/** Zone names are drawn on the map only when there are few zones (19 departments yes, 58 counties no). */
const MAX_LABELS = 25

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
  return useMemo(() => { const { px, py } = projection(db); return db.depts.map((d) => {
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
  }) }, [db])
}
let mapSeq = 0
export function UyMap({ fill, cellFill, onPick, onCell, selected = [], points, route, labels, className = '' }: MapProps) {
  const { db } = useApp()
  const geo = useGeo()
  const maskId = useMemo(() => 'uym' + ++mapSeq, [])
  const { H: MAP_H, px, py, cw, ch: chh, half } = useMemo(() => projection(db), [db])
  return (
    <svg viewBox={`0 0 ${W} ${MAP_H}`} className={'uymap ' + className} role="img" aria-label={'Map of ' + db.meta.region.name}>
      {cellFill && <defs><mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={W} height={MAP_H}>{geo.map((g, i) => <path key={i} d={g.path} fill="#fff" />)}</mask></defs>}
      {geo.map((g, i) => (
        <path key={i} d={g.path} className={'dept' + (onPick ? ' pick' : '')} style={fill?.(i) ? { fill: fill(i) } : undefined}
          onClick={onPick ? () => onPick(i) : undefined}>
          <title>{db.depts[i].name}</title>
        </path>
      ))}
      {cellFill && (
        <g mask={`url(#${maskId})`}>
          {db.model.cells.map((c, i) => {
            const col = cellFill(i)
            return col ? <rect key={i} x={px(c.lon - half)} y={py(c.lat + half)} width={cw + 0.4} height={chh + 0.4} fill={col}
              className={onCell ? 'cell pick' : 'cell'} onClick={onCell ? () => onCell(i) : undefined} /> : null
          })}
        </g>
      )}
      {cellFill && geo.map((g, i) => <path key={i} d={g.path} className="dept-line" />)}
      {selected.map((i) => <path key={i} d={geo[i].path} className="dept-sel" />)}
      {points?.map((p, i) => (
        <circle key={i} cx={px(p.lon)} cy={py(p.lat)} r={p.r ?? 1.6} fill={p.ring ? 'none' : p.color} stroke={p.ring ? p.color : 'none'} strokeWidth={1.1} />
      ))}
      {route && route.length > 1 && (
        <polyline className="route" points={route.map((i) => `${geo[i].cx},${geo[i].cy}`).join(' ')} />
      )}
      {labels && geo.length <= MAX_LABELS && geo.map((g, i) => <text key={i} x={g.cx} y={g.cy + 3} className="dept-label" textAnchor="middle">{db.depts[i].name}</text>)}
      {route?.map((i, n) => (
        <g key={n} transform={`translate(${geo[i].cx},${geo[i].cy - 13})`}>
          <circle r={9} className="stop" /><text className="stop-n" textAnchor="middle" dy={3.6}>{n + 1}</text>
        </g>
      ))}
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
      {LEVELS.map((l, i) => <span key={i}><i style={{ background: l.color }} />{t(`lvl_${l.key}` as Key)}</span>)}
    </div>
  )
}
/** Sub-navigation shared by the "How it works" pages. */
export function HowNav({ on }: { on: 'how' | 'harmonization' | 'model' }) {
  const { t } = useApp()
  return (
    <nav className="subnav">
      <a href="#/how" className={on === 'how' ? 'on' : ''}>{t('how_tab_over')}</a>
      <a href="#/harmonization" className={on === 'harmonization' ? 'on' : ''}>{t('nav_harm')}</a>
      <a href="#/model" className={on === 'model' ? 'on' : ''}>{t('nav_model')}</a>
    </nav>
  )
}
