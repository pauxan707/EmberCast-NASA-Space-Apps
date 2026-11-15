import { useCallback, useEffect, useMemo, useState } from 'react'
import { CHALLENGE, DEFAULT_REPLAY_DATE, DEFAULT_ZONES, PROJECT_NAME, REPO_URL, TEAM_NAME } from './config'
import { loadDB } from './data'
import type { DB } from './data'
import { tr } from './i18n'
import type { Key, Lang } from './i18n'
import { Ctx, fmtDate } from './ui'
import Home from './pages/Home'
import Report from './pages/Report'
import MapPage from './pages/MapPage'
import Calendar from './pages/Calendar'
import Harmonize from './pages/Harmonize'
import ModelPage from './pages/ModelPage'
import Planner from './pages/Planner'
import Alerts from './pages/Alerts'

const NAV: { r: string; k: Key }[] = [
  { r: '/', k: 'nav_zones' }, { r: '/map', k: 'nav_map' }, { r: '/calendar', k: 'nav_calendar' },
  { r: '/planner', k: 'nav_planner' }, { r: '/harmonization', k: 'nav_harm' }, { r: '/model', k: 'nav_model' }, { r: '/alerts', k: 'nav_alerts' },
]
const TOUR: { r: string; k: Key }[] = [
  { r: '/', k: 'tour_1' }, { r: '/report/top', k: 'tour_2' }, { r: '/map', k: 'tour_3' }, { r: '/calendar', k: 'tour_4' },
  { r: '/harmonization', k: 'tour_5' }, { r: '/model', k: 'tour_6' }, { r: '/planner', k: 'tour_7' },
]
const TOUR_MS = 7500
const getRoute = () => window.location.hash.replace(/^#/, '') || '/'
const store = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* ignore */ } },
}

function Logo() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
      <defs><linearGradient id="lg" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#ff5a1f" /><stop offset="1" stopColor="#ffc857" /></linearGradient></defs>
      <path d="M16 2c1 6 8 8.500 8 16.500A8 8 0 0 1 8 18.500c0-3 1.500-5 3-6.500.3 2.500 1.500 3.700 2.700 4C13 11 14.500 6 16 2z" fill="url(#lg)" />
      <path d="M3 26h26M7 30h18" stroke="#ffc857" strokeWidth="1.6" strokeLinecap="round" opacity=".7" />
    </svg>
  )
}

export default function App() {
  const [db, setDb] = useState<DB | null>(null)
  const [err, setErr] = useState('')
  const [lang, setLangS] = useState<Lang>(() => (store.get('lang') === 'es' ? 'es' : 'en'))
  const [route, setRoute] = useState(getRoute)
  const [week, setWeek] = useState(0)
  const [myZones, setMyZonesS] = useState<string[]>(() => { try { return JSON.parse(store.get('zones') || 'null') || DEFAULT_ZONES } catch { return DEFAULT_ZONES } })
  const [tour, setTour] = useState(-1)

  useEffect(() => {
    loadDB().then((d) => {
      setDb(d)
      setWeek(Math.max(0, d.model.weeks.findIndex((w) => w.date === DEFAULT_REPLAY_DATE)))
    }).catch((e) => setErr(String(e)))
    const h = () => { setRoute(getRoute()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', h)
    return () => window.removeEventListener('hashchange', h)
  }, [])
  const go = useCallback((r: string) => { window.location.hash = r }, [])
  const setLang = (l: Lang) => { setLangS(l); store.set('lang', l); document.documentElement.lang = l }
  const setMyZones = (z: string[]) => { setMyZonesS(z); store.set('zones', JSON.stringify(z)) }
  const t = useCallback((k: Key, vars?: Record<string, string | number>) => tr(lang, k, vars), [lang])

  useEffect(() => {
    if (tour < 0) return
    go(TOUR[tour].r)
    const id = setTimeout(() => setTour((s) => (s + 1 < TOUR.length ? s + 1 : -1)), TOUR_MS)
    return () => clearTimeout(id)
  }, [tour, go])

  const ctx = useMemo(() => db && { db, lang, setLang, t, week, setWeek, myZones, setMyZones, route, go, simulated: db.model.source !== 'real' },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, lang, t, week, myZones, route, go])

  if (err) return <div className="boot">Could not load data: {err}</div>
  if (!db || !ctx) return <div className="boot"><Logo /><span>{PROJECT_NAME}</span></div>

  const seg = route.split('/').filter(Boolean)
  let page
  if (seg[0] === 'report') page = <Report id={seg[1]} />
  else if (seg[0] === 'map') page = <MapPage zone={seg[1]} />
  else if (seg[0] === 'calendar') page = <Calendar zone={seg[1]} />
  else if (seg[0] === 'harmonization') page = <Harmonize />
  else if (seg[0] === 'model') page = <ModelPage />
  else if (seg[0] === 'planner') page = <Planner />
  else if (seg[0] === 'alerts') page = <Alerts />
  else page = <Home onTour={() => setTour(0)} />
  const active = '/' + (seg[0] === 'report' ? '' : seg[0] ?? '')
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
      <main key={route + week} className="page">{page}</main>
      <footer className="foot">
        <div>
          <b>{PROJECT_NAME}</b> · {TEAM_NAME} · NASA Space Apps Challenge 2026 · {CHALLENGE}
          <p>{t('foot_1', { date: fmtDate(wk.date, lang) })}</p>
          <p>{t(ctx.simulated ? 'foot_2' : 'foot_2_real')}</p>
          <p>{t('foot_3')}</p>
        </div>
        <a href={REPO_URL} target="_blank" rel="noreferrer">GitHub ↗</a>
      </footer>
      {tour >= 0 && (
        <div className="tour">
          <div className="tour-bar" key={tour}><i style={{ animationDuration: TOUR_MS + 'ms' }} /></div>
          <span className="tour-n">{tour + 1}/{TOUR.length}</span>
          <p>{t(TOUR[tour].k)}</p>
          <button onClick={() => setTour((s) => (s + 1 < TOUR.length ? s + 1 : -1))}>{t('next')}</button>
          <button className="ghost" onClick={() => setTour(-1)}>✕</button>
        </div>
      )}
    </Ctx.Provider>
  )
}
