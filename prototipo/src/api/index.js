// Capa de API. Sin VITE_API_URL usa datos simulados; con VITE_API_URL llama al backend real (mismos 3 endpoints).
const BASE = import.meta.env.VITE_API_URL
const MOCK = !BASE
export const LEVELS = ['Bajo', 'Moderado', 'Alto', 'Muy alto']

const ZONES = [
  { id: 'paysandu-norte', name: 'Paysandú norte', base: 2, reasons: '14 días sin lluvia, viento fuerte, vegetación seca.' },
  { id: 'rivera-sur', name: 'Rivera sur', base: 1, reasons: 'Vegetación seca, actividad algo sobre lo habitual.' },
  { id: 'tacuarembo-oeste', name: 'Tacuarembó oeste', base: 0, reasons: 'Lluvias recientes, actividad normal para la época.' },
]
const wait = (v) => new Promise((r) => setTimeout(() => r(v), 250))
const seed = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return ((h >>> 0) % 1000) / 1000 }
const today = () => new Date().toISOString().slice(0, 10)
const diff = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5)
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
const clamp = (n) => Math.max(0, Math.min(3, Math.round(n)))
const dayLevel = (z, date) => clamp(z.base + (seed(z.id + date) - 0.5) * 2.4)
// De dónde sale cada día: modelo (hasta 7 días), pronóstico del clima (hasta 16) o lo habitual de la época.
const tramo = (date) => { const n = diff(today(), date); return n <= 7 ? 'modelo' : n <= 16 ? 'pronostico' : 'climatologia' }
const get = async (path) => (await fetch(BASE + path)).json()

// GET /zones
export async function getZones() {
  if (!MOCK) return get('/zones')
  return wait(ZONES.map((z) => ({ id: z.id, name: z.name, reasons: z.reasons, level: dayLevel(z, today()), confidence: 'media' })))
}

// GET /heatmap?date=YYYY-MM-DD  ->  { cols, rows, cells: [nivel 0..3, ...] }
export async function getHeatmap(date) {
  if (!MOCK) return get(`/heatmap?date=${date}`)
  const cx = 2 + seed(date) * 5, cy = 1 + seed(date + 'y') * 3
  const cells = []
  for (let r = 0; r < 6; r++) for (let c = 0; c < 9; c++) cells.push(clamp(3.4 - Math.hypot(c - cx, r - cy) * 0.9 + seed(`${date}${r}${c}`) - 0.5))
  return wait({ cols: 9, rows: 6, cells })
}

const ADVICE = [
  { personas: 'Sin precauciones especiales.', instituciones: 'Monitoreo habitual de la zona.' },
  { personas: 'Evita las quemas al aire libre.', instituciones: 'Revisar que los recursos de la zona estén disponibles.' },
  { personas: 'No hagas fuego y avisa si ves humo.', instituciones: 'Preparar brigadas y coordinar con bomberos.' },
  { personas: 'Evita encender fuego y consulta antes de ir a la zona.', instituciones: 'Activar la alerta y reforzar la vigilancia.' },
]
const fmt = (d) => d.split('-').reverse().join('/')

// POST /forecast  { zoneId, from, to }
//  -> { level, peakDate, days: [{date, level, tramo}], alternative: {name, level} | null,
//       model: { headline, reasons: [texto], advice: { personas, instituciones }, confidence: 'alta'|'media'|'baja' } }
export async function getForecast(zoneId, from, to) {
  if (!MOCK) return (await fetch(BASE + '/forecast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ zoneId, from, to }) })).json()
  const zone = ZONES.find((z) => z.id === zoneId)
  const days = []
  for (let i = 0; i <= Math.min(diff(from, to), 30); i++) { const date = addDays(from, i); days.push({ date, level: dayLevel(zone, date), tramo: tramo(date) }) }
  const peak = days.reduce((a, b) => (b.level > a.level ? b : a), days[0])
  const worst = (z) => Math.max(...days.map((d) => dayLevel(z, d.date)))
  const alt = ZONES.filter((z) => z.id !== zoneId).map((z) => ({ name: z.name, level: worst(z) })).sort((a, b) => a.level - b.level)[0]
  const tr = new Set(days.map((d) => d.tramo))
  const confidence = tr.has('climatologia') ? 'baja' : tr.has('pronostico') ? 'media' : 'alta'
  const reasons = zone.reasons.replace(/\.$/, '').split(', ').map((r) => r[0].toUpperCase() + r.slice(1))
  if (confidence === 'baja') reasons.push('Parte del período supera los 16 días: se muestra lo habitual de la época, no una predicción.')
  const model = { headline: `Riesgo ${LEVELS[peak.level].toLowerCase()} en ${zone.name} entre el ${fmt(from)} y el ${fmt(to)}, con el punto más alto el ${fmt(peak.date)}.`, reasons, advice: ADVICE[peak.level], confidence }
  return wait({ level: peak.level, peakDate: peak.date, days, alternative: alt.level < peak.level ? alt : null, model })
}
