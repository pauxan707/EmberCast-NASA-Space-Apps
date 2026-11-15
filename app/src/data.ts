// Data layer: loads the static JSON produced by /pipeline and derives everything the UI needs.
// Fire record = real NASA FIRMS data, harmonized offline. Risk layer = see model.source.

export interface Zone {
  level: number; score: number; cur30: number; usual30: number; p90: number; contrib: number[]
  dry: number; rain30: number; tmax: number; rh: number; wind: number; blind: number
  hits: number; cells: number; act7: number
}
export interface Week { t: number; date: string; levels: string; actual: string; zones: Zone[] }
export interface Model {
  source: 'simulated' | 'real'
  split: { train: string; valid: string; test: string }
  results: { id: string; prAuc: number; top10: number }[]
  reliability: { level: number; share: number; observed: number }[]
  groupImp: { g: string; gain: number }[]
  groups: string[]
  cells: { lat: number; lon: number; d: number }[]
  climLevels: string[]
  weeks: Week[]
}
export interface Yearly { y: number; modisDet: number; viirsDet: number; modisCells: number; viirsCells: number; harm: number; lo: number; hi: number }
export interface ExamplePoint { s: 'MODIS' | 'VIIRS'; lat: number; lon: number; scan: number; track: number; frp: number; time: number }
export interface Meta {
  start: string; end: string; nDays: number; viirsStart: number; aquaStart: number
  kNat: number; kTNat: number; sdLogYear: number; sdLogMonth: number
  filters: { modis: Record<string, number>; viirs: Record<string, number> }
  holdout: { kFit: number; monthlyR: number; annualMAPE: number; annualMAPEraw: number; totalBiasPct: number; years: number[]; predY: number[]; obsY: number[]; rawY: number[] }
  grid: { lat0: number; lon0: number; size: number; nLat: number; nLon: number }
  region: { key: string; name: string; zones: number }
  bbox: { lat0: number; lat1: number; lon0: number; lon1: number }
  /** Map window (degrees) and the latitude used for the x scale. */
  view: { lonW: number; lonE: number; latS: number; latN: number; kxLat: number }
}
export interface Dept {
  idx: number; id: string; name: string; k: number; kT: number
  m: Uint16Array; v: Uint16Array; h: Float32Array; blind: string
}
export interface GeoFeature { properties: { id: string; name: string }; geometry: { type: string; coordinates: number[][][] | number[][][][] } }
export interface DB {
  meta: Meta; yearly: Yearly[]; ratios: { y: number; r: number }[]
  depts: Dept[]; nat: Dept
  example: { date: string; dept: string; points: ExamplePoint[]; modisDet: number; viirsDet: number; modisCells: number; viirsCells: number; k: number }
  recent: { modis: number[][]; viirs: number[][] }
  model: Model; geo: GeoFeature[]
  year: Uint16Array; month: Uint8Array; doy: Uint16Array
  deptCells: number[][]
}

const DAY = 864e5
let START = Date.UTC(2000, 10, 1)
export const dateOf = (i: number) => new Date(START + i * DAY)
export const isoOf = (i: number) => dateOf(i).toISOString().slice(0, 10)
export const idxOf = (iso: string) => Math.round((Date.parse(iso + 'T00:00:00Z') - START) / DAY)
export const YEARS = Array.from({ length: 25 }, (_, i) => 2001 + i)

export async function loadDB(region: string): Promise<DB> {
  const base = import.meta.env.BASE_URL + 'data/' + region + '/'
  const [h, model, blind, geo] = await Promise.all(
    ['harmonized.json', 'model.json', 'blind.json', 'departments.geojson'].map((f) => fetch(base + f).then((r) => { if (!r.ok) throw new Error(f + ' ' + r.status); return r.json() })),
  )
  const meta: Meta = h.meta
  START = Date.parse(meta.start + 'T00:00:00Z')
  const n = meta.nDays
  const year = new Uint16Array(n), month = new Uint8Array(n), doy = new Uint16Array(n)
  for (let i = 0; i < n; i++) {
    const d = dateOf(i)
    year[i] = d.getUTCFullYear(); month[i] = d.getUTCMonth()
    doy[i] = Math.round((Date.UTC(year[i], month[i], d.getUTCDate()) - Date.UTC(year[i], 0, 1)) / DAY)
  }
  const mk = (idx: number, id: string, name: string, k: number, kT: number): Dept => ({
    idx, id, name, k, kT, m: new Uint16Array(n), v: new Uint16Array(n), h: new Float32Array(n), blind: '',
  })
  const nat = mk(-1, meta.region.key.toUpperCase(), meta.region.name, meta.kNat, meta.kTNat)
  const depts: Dept[] = h.depts.map((d: { id: string; name: string; k: number; kT: number; days: number[][] }, idx: number) => {
    const z = mk(idx, d.id, d.name, d.k, d.kT)
    z.blind = blind.blind[idx]
    for (const [i, m, v, t] of d.days) {
      z.m[i] = m; z.v[i] = v
      const hv = i >= meta.viirsStart ? v : i >= meta.aquaStart ? d.k * m : d.kT * t
      z.h[i] = hv; nat.m[i] += m; nat.v[i] += v; nat.h[i] += hv
    }
    return z
  })
  nat.blind = blind.blind[0]
  const deptCells: number[][] = depts.map(() => [])
  ;(model as Model).cells.forEach((c, i) => deptCells[c.d]?.push(i))
  return { meta, yearly: h.yearly, ratios: h.ratios, depts, nat, example: h.example, recent: h.recent, model, geo: geo.features, year, month, doy, deptCells }
}

// ---------------------------------------------------------------- calendar statistics
export function monthMatrix(db: DB, z: Dept): number[][] {
  const out = YEARS.map(() => new Array(12).fill(0))
  for (let i = 0; i < db.meta.nDays; i++) {
    const y = db.year[i] - 2001
    if (y >= 0) out[y][db.month[i]] += z.h[i]
  }
  return out
}
export const quantile = (arr: number[], q: number) => {
  const s = [...arr].sort((a, b) => a - b)
  const p = (s.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p)
  return s[lo] + (s[hi] - s[lo]) * (p - lo)
}
export function monthStats(mat: number[][]) {
  return Array.from({ length: 12 }, (_, m) => {
    const col = mat.map((r) => r[m])
    return { median: quantile(col, 0.5), p90: quantile(col, 0.9), max: Math.max(...col) }
  })
}
/** Mean activity per day of year, smoothed with a 31-day window. */
export function dailyClim(db: DB, z: Dept): number[] {
  const sum = new Array(366).fill(0), cnt = new Array(366).fill(0)
  for (let i = 0; i < db.meta.nDays; i++) if (db.year[i] >= 2001) { sum[db.doy[i]] += z.h[i]; cnt[db.doy[i]]++ }
  const mean = sum.map((s, i) => s / Math.max(cnt[i], 1))
  return mean.map((_, i) => { let a = 0; for (let k = -15; k <= 15; k++) a += mean[(i + k + 366) % 366]; return a / 31 })
}
/** Critical period: contiguous days around the peak where the climatology stays above half the peak. */
export function season(clim: number[]) {
  const peak = clim.indexOf(Math.max(...clim)), thr = clim[peak] * 0.5
  let s = peak, e = peak
  while (clim[(s - 1 + 366) % 366] >= thr && (peak - s + 366) % 366 < 180) s = (s - 1 + 366) % 366
  while (clim[(e + 1) % 366] >= thr && (e - peak + 366) % 366 < 180) e = (e + 1) % 366
  return { start: s, end: e, peak }
}

// ---------------------------------------------------------------- risk helpers
export const weekOfYear = (d: Date) => Math.min(51, Math.floor((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / DAY / 7))
export function cellLevel(db: DB, w: number, cell: number, offset: number): number {
  if (offset < 7) return +db.model.weeks[w].levels[cell]
  const d = new Date(Date.parse(db.model.weeks[w].date + 'T00:00:00Z') + offset * DAY)
  return +db.model.climLevels[cell][weekOfYear(d)]
}
/** Zone level `offset` days after the replay date: model outlook for 7 days, seasonal history beyond. */
export function zoneLevel(db: DB, w: number, dept: number, offset: number): { level: number; src: 'outlook' | 'seasonal' } {
  if (offset < 7) return { level: db.model.weeks[w].zones[dept].level, src: 'outlook' }
  const d = new Date(Date.parse(db.model.weeks[w].date + 'T00:00:00Z') + offset * DAY)
  const wk = weekOfYear(d)
  const ls = db.deptCells[dept].map((c) => +db.model.climLevels[c][wk]).sort((a, b) => a - b)
  return { level: ls[Math.floor((ls.length - 1) * 0.8)] ?? 0, src: 'seasonal' }
}
export const activityRatio = (z: Zone) => (z.usual30 >= 1 ? z.cur30 / z.usual30 : z.cur30 >= 1 ? z.cur30 : 1)
export const confidence = (z: Zone): 'high' | 'medium' | 'low' => (z.blind <= 1 ? 'high' : z.blind <= 3 ? 'medium' : 'low')
export function reasons(db: DB, z: Zone) {
  return db.model.groups.map((g, i) => ({ g, v: z.contrib[i] })).sort((a, b) => Math.abs(b.v) - Math.abs(a.v))
}

// ---------------------------------------------------------------- export
export function toCSV(db: DB, z: Dept, from: number, to: number): string {
  const sd = db.meta.sdLogMonth
  const rows = ['date,zone,modis_active_cells,viirs_active_cells,harmonized_index,index_low,index_high,sensors,calibration_factor']
  for (let i = from; i <= to; i++) {
    const pre = i < db.meta.viirsStart
    const sensors = pre ? (i < db.meta.aquaStart ? 'MODIS-Terra' : 'MODIS-Terra+Aqua') : 'MODIS+VIIRS-SNPP'
    const h = z.h[i]
    rows.push([isoOf(i), z.name, z.m[i], pre ? '' : z.v[i], h.toFixed(2), (pre ? h * Math.exp(-sd) : h).toFixed(2), (pre ? h * Math.exp(sd) : h).toFixed(2), sensors, pre ? (i < db.meta.aquaStart ? z.kT : z.k) : 1].join(','))
  }
  return rows.join('\n')
}
export function download(name: string, text: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}
