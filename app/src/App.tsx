import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CHALLENGE, DEFAULT_REGION, PROJECT_NAME, REGION_KEYS, REGIONS, REPO_URL } from './config'
import type { RegionKey } from './config'
import { loadDB } from './data'
import type { DB } from './data'
import { tr } from './i18n'
import type { Key, Lang } from './i18n'
import { Ctx, fmtDate } from './ui'
import Landing from './pages/Landing'
import Zones from './pages/Zones'
import Report from './pages/Report'
import MapPage from './pages/MapPage'
import Calendar from './pages/Calendar'
import How from './pages/How'
import Harmonize from './pages/Harmonize'
import ModelPage from './pages/ModelPage'
import Planner from './pages/Planner'
import Alerts from './pages/Alerts'

const NAV: { r: string; k: Key }[] = [
  { r: '/', k: 'nav_home' }, { r: '/zones', k: 'nav_zones' }, { r: '/planner', k: 'nav_planner' }, { r: '/map', k: 'nav_map' },
  { r: '/calendar', k: 'nav_calendar' }, { r: '/how', k: 'nav_how' },
]
const TOUR: { r: string; k: Key }[] = [
  { r: '/', k: 'tour_0' }, { r: '/zones', k: 'tour_1' }, { r: '/report/top', k: 'tour_2' }, { r: '/map', k: 'tour_3' },
  { r: '/calendar', k: 'tour_4' }, { r: '/harmonization', k: 'tour_5' }, { r: '/planner', k: 'tour_7' },
]
const TOUR_MS = 7500
const SECTION: Record<string, string> = { report: '/zones', alerts: '/zones', harmonization: '/how', model: '/how' }
const getRoute = () => window.location.hash.replace(/^#/, '') || '/'
const isRegion = (r: string | null): r is RegionKey => !!r && (REGION_KEYS as string[]).includes(r)
// "my zones" are stored per region (Uruguay keeps the original key)
const zonesKey = (r: RegionKey) => (r === DEFAULT_REGION ? 'zones' : 'zones_' + r)
const store = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* ignore */ } },
}

function readZones(r: RegionKey): string[] {
  try { return JSON.parse(store.get(zonesKey(r)) || 'null') || REGIONS[r].zones } catch { return REGIONS[r].zones }
}

function Logo() {
  return (
    <svg width="22" height="26" viewBox="0 0 22 26" aria-hidden>
      <path d="M11 1c1 5.200 7.400 7.600 7.400 14.600a7.400 7.400 0 0 1-14.800 0c0-2.900 1.400-4.800 2.800-6.200.3 2.400 1.400 3.500 2.500 3.800C8.300 9.300 9.600 4.700 11 1z" fill="#d93a14" />
      <path d="M0 25h22" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

export default function App() {
  const [db, setDb] = useState<DB | null>(null)
  const [err, setErr] = useState('')
  const [lang, setLangS] = useState<Lang>(() => (store.get('lang') === 'es' ? 'es' : 'en'))
  const [route, setRoute] = useState(getRoute)
  const [week, setWeek] = useState(0)
  const [region, setRegionS] = useState<RegionKey>(() => { const r = store.get('region'); return isRegion(r) ? r : DEFAULT_REGION })
  const [myZones, setMyZonesS] = useState<string[]>(() => readZones(region))
  const cache = useRef(new Map<RegionKey, DB>())
  const [tour, setTour] = useState(-1)

  // load (or reuse) the selected region; the page keeps showing the previous one until the data arrives
  useEffect(() => {
    let alive = true
    const show = (d: DB) => {
      setDb(d)
      setWeek(Math.max(0, d.model.weeks.findIndex((w) => w.date === REGIONS[region].replay)))
      setMyZonesS(readZones(region))
    }
    const hit = cache.current.get(region)
    if (hit) show(hit)
    else loadDB(region).then((d) => { cache.current.set(region, d); if (alive) show(d) }).catch((e) => { if (alive) setErr(String(e)) })
    return () => { alive = false }
  }, [region])
  useEffect(() => {
    const h = () => { setRoute(getRoute()); window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }) }
    window.addEventListener('hashchange', h)
    return () => window.removeEventListener('hashchange', h)
  }, [])
  const go = useCallback((r: string) => { window.location.hash = r }, [])
  const setLang = (l: Lang) => { setLangS(l); store.set('lang', l); document.documentElement.lang = l }
  // region actually on screen (follows the loaded data, not the pending selection)
  const shown = (db?.meta.region.key as RegionKey | undefined) ?? region
  const setMyZones = (z: string[]) => { setMyZonesS(z); store.set(zonesKey(shown), JSON.stringify(z)) }
  const setRegion = (r: RegionKey) => {
    if (r === region) return
    setRegionS(r); store.set('region', r)
    // zone ids in the address belong to the old region
    const s = getRoute().split('/').filter(Boolean)
    if (s[1] && s[1] !== 'top') window.location.hash = '/' + s[0] + (s[0] === 'report' ? '/top' : '')
  }
  const t = useCallback((k: Key, vars?: Record<string, string | number>) =>
    tr(lang, k, { region: REGIONS[shown].name, ...vars }, !!REGIONS[shown].counties), [lang, shown])

  useEffect(() => {
    if (tour < 0) return
    go(TOUR[tour].r)
    const id = setTimeout(() => setTour((s) => (s + 1 < TOUR.length ? s + 1 : -1)), TOUR_MS)
    return () => clearTimeout(id)
  }, [tour, go])

  const ctx = useMemo(() => db && { db, region: shown, setRegion, lang, setLang, t, week, setWeek, myZones, setMyZones, route, go, simulated: db.model.source !== 'real' },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, shown, region, lang, t, week, myZones, route, go])

  if (err) return <div className="boot">Could not load data: {err}</div>
  if (!db || !ctx) return <div className="boot"><Logo /><span>{PROJECT_NAME}</span></div>

  const seg = route.split('/').filter(Boolean)
  let page
  if (seg[0] === 'zones') page = <Zones />
  else if (seg[0] === 'report') page = <Report id={seg[1]} />
  else if (seg[0] === 'map') page = <MapPage zone={seg[1]} />
  else if (seg[0] === 'calendar') page = <Calendar zone={seg[1]} />
  else if (seg[0] === 'how') page = <How />
  else if (seg[0] === 'harmonization') page = <Harmonize />
  else if (seg[0] === 'model') page = <ModelPage />
  else if (seg[0] === 'planner') page = <Planner />
  else if (seg[0] === 'alerts') page = <Alerts />
  else page = <Landing onTour={() => setTour(0)} />
  const landing = !seg[0]
  const active = SECTION[seg[0]] ?? '/' + (seg[0] ?? '')
  const wk = db.model.weeks[week]

  return (
    <Ctx.Provider value={ctx}>
      <div className="ribbon">
        <b>{t('ribbon_poc')}</b>
        <span><i className="dot real" />{t('ribbon_real')}</span>
        <span><i className={'dot ' + (ctx.simulated ? 'sim' : 'real')} />{t(ctx.simulated ? 'ribbon_sim' : 'ribbon_model_real')}</span>
      </div>
      <header className="top">
        <a className="brand" href="#/"><Logo /><span>{PROJECT_NAME}</span></a>
        <nav>
          {NAV.map((n) => <a key={n.r} href={'#' + n.r} className={active === n.r ? 'on' : ''}>{t(n.k)}</a>)}
        </nav>
        <div className="top-r">
          <label className="replay" title={t('region_label')}>
            <span>{t('region_label')}</span>
            <select value={region} onChange={(e) => setRegion(e.target.value as RegionKey)}>
              {REGION_KEYS.map((k) => <option key={k} value={k}>{REGIONS[k].name}</option>)}
            </select>
          </label>
          <label className="replay" title={t('replay_help')}>
            <span>{t('replay')}</span>
            <select value={week} onChange={(e) => setWeek(+e.target.value)}>
              {db.model.weeks.map((w, i) => <option key={i} value={i}>{fmtDate(w.date, lang)}</option>)}
            </select>
          </label>
          <div className="lang" role="group" aria-label="Language">
            {(['en', 'es'] as Lang[]).map((l) => <button key={l} className={lang === l ? 'on' : ''} onClick={() => setLang(l)}>{l.toUpperCase()}</button>)}
          </div>
        </div>
      </header>
      <main key={shown + route + week} className={'page' + (landing ? ' bleed' : '')}>{page}</main>
      <footer className="foot">
        <div className="wrap foot-in">
          <div>
            <b>{PROJECT_NAME}</b> · NASA Space Apps Challenge 2026 · {CHALLENGE}
            <p>{t('foot_1', { date: fmtDate(wk.date, lang) })}</p>
            <p>{t(ctx.simulated ? 'foot_2' : 'foot_2_real')}</p>
            <p>{t('foot_3')}</p>
          </div>
          <a href={REPO_URL} target="_blank" rel="noreferrer">GitHub ↗</a>
        </div>
      </footer>
      {tour >= 0 && (
        <div className="tour">
          <div className="tour-bar" key={tour}><i style={{ animationDuration: TOUR_MS + 'ms' }} /></div>
          <span className="tour-n">{tour + 1}/{TOUR.length}</span>
          <p>{t(TOUR[tour].k)}</p>
          <button onClick={() => setTour((s) => (s + 1 < TOUR.length ? s + 1 : -1))}>{t('next')}</button>
          <button className="ghost" onClick={() => setTour(-1)} aria-label="close">✕</button>
        </div>
      )}
    </Ctx.Provider>
  )
}
