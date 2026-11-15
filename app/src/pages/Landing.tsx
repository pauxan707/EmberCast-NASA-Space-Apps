import { useEffect, useRef } from 'react'
import type { Key } from '../i18n'
import { quantile, YEARS } from '../data'
import Globe from '../Globe'
import { fmtDate, Gauge, LEVELS, ramp, RiskBadge, useApp } from '../ui'

const CW = 4, CH = 12
export default function Landing({ onTour }: { onTour: () => void }) {
  const { db, t, lang, week } = useApp()
  const canvas = useRef<HTMLCanvasElement>(null)
  const wk = db.model.weeks[week]
  const ranked = [...db.depts].sort((a, b) => wk.zones[b.idx].level - wk.zones[a.idx].level || wk.zones[b.idx].score - wk.zones[a.idx].score)
  const top = ranked[0], tz = wk.zones[top.idx]

  // Cover figure: every day of 25 years, drawn row by row.
  useEffect(() => {
    const c = canvas.current
    if (!c) return
    c.width = 366 * CW; c.height = YEARS.length * CH
    const g = c.getContext('2d')!
    const h = db.nat.h
    const vmax = quantile(Array.from(h).filter((v) => v > 0), 0.985)
    const row = (r: number) => {
      const y = YEARS[r]
      for (let i = 0; i < db.meta.nDays; i++) {
        if (db.year[i] !== y) continue
        g.fillStyle = ramp(h[i] > 0 ? 0.1 + 0.9 * Math.sqrt(Math.min(1, h[i] / vmax)) : 0)
        g.fillRect(db.doy[i] * CW, r * CH, CW, CH - 2)
      }
    }
    let r = 0, raf = 0, last = 0
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const step = (ts: number) => {
      if (still) { for (; r < YEARS.length; r++) row(r); return }
      if (ts - last > 45) { row(r++); last = ts }
      if (r < YEARS.length) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    // if the tab is hidden rAF is throttled: make sure the figure is complete anyway
    const done = setTimeout(() => { for (; r < YEARS.length; r++) row(r) }, 2500)
    return () => { cancelAnimationFrame(raf); clearTimeout(done) }
  }, [db])

  const months = Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat(lang, { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, i, 1))))
  const cases: { n: string; k: string; href: string }[] = [
    { n: '01', k: 'uc1', href: '#/zones' }, { n: '02', k: 'uc2', href: '#/planner' }, { n: '03', k: 'uc3', href: '#/map' },
  ]
  return (
    <>
      <section className="cover plate">
        <div className="wrap cover-top">
          <div>
            <span className="eyebrow">{t('l_eyebrow')}</span>
            <h1>{t('l_h1a')} <em>{t('l_h1b')}</em></h1>
            <p className="lead">{t('l_lead')}</p>
            <div className="cta">
              <a className="primary" href="#/zones">{t('l_cta_zones')} <span>→</span></a>
              <a className="btn" href="#/planner">{t('l_cta_plan')} <span>→</span></a>
              <button className="link" onClick={onTour}>▶ {t('watch_demo')}</button>
            </div>
          </div>
          <Globe />
        </div>
        <figure className="cover-fig wrap">
          <div className="cf-months"><span />{months.map((m) => <b key={m}>{m}</b>)}</div>
          <div className="cf-body">
            <div className="cf-years">{YEARS.map((y) => <span key={y}>{y % 5 === 0 || y === 2001 ? y : ''}</span>)}</div>
            <canvas ref={canvas} aria-label={t('l_fig')} />
          </div>
          <figcaption>{t('l_fig')} <a href="#/calendar">{t('l_fig_a')} →</a></figcaption>
        </figure>
      </section>

      <section className="wrap uses">
        <h2>{t('uc_title')}</h2>
        <div className="uses-grid">
          {cases.map((c) => (
            <a key={c.k} href={c.href} className="use">
              <span className="use-n">{c.n}</span>
              <h3>{t((c.k + '_t') as Key)}</h3>
              <p className="use-who">{t((c.k + '_w') as Key)}</p>
              <p>{t((c.k + '_d') as Key)}</p>
              <b>{t((c.k + '_a') as Key)} →</b>
            </a>
          ))}
        </div>
      </section>

      <section className="wrap week">
        <div className="week-l">
          <span className="eyebrow">{t('l_week', { date: fmtDate(wk.date, lang) })}</span>
          <h2>{t('l_week_top', { zone: top.name })}</h2>
          <p className="lead">{t('rep_headline', { level: lang === 'en' ? t(`lvl_${LEVELS[tz.level].key}` as Key) : t(`lvl_${LEVELS[tz.level].key}` as Key).toLowerCase() })}.</p>
          <div className="cta">
            <a className="primary" href={'#/report/' + top.id}>{t('open_report')} <span>→</span></a>
            <a className="btn" href="#/zones">{t('l_all_zones')} <span>→</span></a>
          </div>
        </div>
        <div className="week-g"><Gauge level={tz.level} size={260} /></div>
        <ol className="week-list">
          {ranked.slice(0, 5).map((d) => (
            <li key={d.id}><a href={'#/report/' + d.id}><span>{d.name}</span><RiskBadge level={wk.zones[d.idx].level} /></a></li>
          ))}
        </ol>
      </section>

      <section className="wrap">
        <div className="howband">
          <div>
            <h2>{t('l_how_t')}</h2>
            <p className="lead">{t('l_how_d')}</p>
          </div>
          <a className="btn" href="#/how">{t('nav_how')} <span>→</span></a>
        </div>
      </section>
    </>
  )
}
