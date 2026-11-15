import { useState } from 'react'
import { PROJECT_TAGLINE } from '../config'
import { activityRatio, confidence, reasons } from '../data'
import type { Zone } from '../data'
import type { Key } from '../i18n'
import { fmtDate, fmtNum, LEVELS, RiskBadge, RiskLegend, Tag, useApp, UyMap } from '../ui'

export function reasonText(t: (k: Key, v?: Record<string, string | number>) => string, g: string, v: number, z: Zone, lang: 'en' | 'es') {
  const up = v >= 0
  const vars = { dry: z.dry, tmax: fmtNum(z.tmax, lang, 1), rh: z.rh, wind: fmtNum(z.wind, lang, 1), ratio: fmtNum(activityRatio(z), lang, 1), rain: z.rain30 }
  return t(`why_${g}_${up ? 'up' : 'down'}` as Key, vars)
}

export default function Home({ onTour }: { onTour: () => void }) {
  const { db, t, lang, week, myZones, go, simulated } = useApp()
  const [all, setAll] = useState(false)
  const wk = db.model.weeks[week]
  const list = db.depts
    .filter((d) => all || myZones.includes(d.id))
    .map((d) => ({ d, z: wk.zones[d.idx] }))
    .sort((a, b) => b.z.level - a.z.level || b.z.score - a.z.score)
  const ho = db.meta.holdout
  return (
    <>
      <section className="hero">
        <div className="hero-l">
          <span className="eyebrow">NASA Space Apps 2026 · Harmonization of MODIS and VIIRS Hot Spots</span>
          <h1>{PROJECT_TAGLINE[lang]}</h1>
          <p className="lead">{t('hero_lead')}</p>
          <div className="cta">
            <button className="primary" onClick={onTour}>▶ {t('watch_demo')}</button>
            <a className="btn" href="#/harmonization">{t('how_harm')}</a>
            <a className="btn" href="#/planner">{t('plan_cta')}</a>
          </div>
          <div className="kpis">
            <div><b>25</b><span>{t('kpi_years')}</span></div>
            <div><b>{fmtNum(ho.annualMAPEraw, lang)}% → {fmtNum(ho.annualMAPE, lang)}%</b><span>{t('kpi_error')}</span></div>
            <div><b>r = {fmtNum(ho.monthlyR, lang, 2)}</b><span>{t('kpi_r')}</span></div>
            <div><b>{fmtNum(db.meta.filters.modis.raw + db.meta.filters.viirs.raw, lang)}</b><span>{t('kpi_det')}</span></div>
          </div>
        </div>
        <div className="hero-map">
          <UyMap fill={(i) => LEVELS[wk.zones[i].level].color + 'cc'} onPick={(i) => go('/report/' + db.depts[i].id)} />
          <div className="hero-cap">
            <span>{t('outlook_for', { date: fmtDate(wk.date, lang) })}</span>
            <Tag kind={simulated ? 'sim' : 'real'}>{t(simulated ? 'illustrative' : 'real_backtest')}</Tag>
          </div>
          <RiskLegend />
        </div>
      </section>

      <section className="sec">
        <div className="sec-h">
          <div>
            <h2>{t('my_zones')}</h2>
            <p>{t('my_zones_sub', { date: fmtDate(wk.date, lang) })}</p>
          </div>
          <div className="seg">
            <button className={!all ? 'on' : ''} onClick={() => setAll(false)}>{t('mine')}</button>
            <button className={all ? 'on' : ''} onClick={() => setAll(true)}>{t('all19')}</button>
          </div>
        </div>
        <div className="zones">
          {list.map(({ d, z }, n) => {
            const top = reasons(db, z).find((r) => r.v > 0) ?? reasons(db, z)[0]
            const ratio = activityRatio(z)
            return (
              <a key={d.id} className="zone" href={'#/report/' + d.id} style={{ ['--lv' as string]: LEVELS[z.level].color, animationDelay: n * 45 + 'ms' }}>
                <div className="zone-top">
                  <h3>{d.name}</h3>
                  <RiskBadge level={z.level} />
                </div>
                <div className="zone-act">
                  <b>{fmtNum(ratio, lang, 1)}×</b>
                  <span>{t('vs_usual')}</span>
                  <div className="meter"><i style={{ width: Math.min(100, (ratio / 4) * 100) + '%' }} /><em style={{ left: '25%' }} /></div>
                </div>
                <p className="zone-why">{reasonText(t, top.g, top.v, z, lang)}</p>
                <div className="zone-foot">
                  <span>{t('confidence')}: <b>{t(`conf_${confidence(z)}` as Key)}</b></span>
                  <span className="go">{t('open_report')} →</span>
                </div>
              </a>
            )
          })}
        </div>
      </section>

      <section className="sec flow">
        <h2>{t('flow_title')}</h2>
        <div className="flow-row">
          {(['flow_1', 'flow_2', 'flow_3', 'flow_4'] as Key[]).map((k, i) => (
            <div key={k} className={'flow-step s' + i}>
              <span>{i + 1}</span><b>{t(k)}</b><p>{t((k + '_d') as Key)}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
