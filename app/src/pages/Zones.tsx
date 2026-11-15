import { useState } from 'react'
import { activityRatio, confidence, reasons } from '../data'
import type { Key } from '../i18n'
import { reasonText } from '../reason'
import { fmtDate, fmtNum, Illus, LEVELS, RiskBadge, RiskLegend, useApp, UyMap } from '../ui'

export default function Zones() {
  const { db, t, lang, week, myZones, go } = useApp()
  const [all, setAll] = useState(false)
  const wk = db.model.weeks[week]
  const list = db.depts
    .filter((d) => all || myZones.includes(d.id))
    .map((d) => ({ d, z: wk.zones[d.idx] }))
    .sort((a, b) => b.z.level - a.z.level || b.z.score - a.z.score)
  const shown = new Set(list.map((x) => x.d.idx))
  return (
    <>
      <div className="sec-h">
        <div>
          <h2>{t('my_zones')}</h2>
          <p>{t('my_zones_sub', { date: fmtDate(wk.date, lang) })} <Illus /></p>
        </div>
        <div className="sec-tools">
          <div className="seg">
            <button className={!all ? 'on' : ''} onClick={() => setAll(false)}>{t('mine')}</button>
            <button className={all ? 'on' : ''} onClick={() => setAll(true)}>{t('all19', { n: db.depts.length })}</button>
          </div>
          <a className="btn" href="#/alerts">{t('manage_alerts')} <span>→</span></a>
        </div>
      </div>
      <div className="zones-grid">
        <ol className="zlist">
          {list.map(({ d, z }, n) => {
            const top = reasons(db, z).find((r) => r.v > 0) ?? reasons(db, z)[0]
            return (
              <li key={d.id} style={{ animationDelay: n * 40 + 'ms' }}>
                <a href={'#/report/' + d.id}>
                  <span className="z-n">{String(n + 1).padStart(2, '0')}</span>
                  <div className="z-main">
                    <h3>{d.name}</h3>
                    <p>{reasonText(t, top.g, top.v, z, lang)}</p>
                  </div>
                  <div className="z-act"><b>{fmtNum(activityRatio(z), lang, 1)}×</b><span>{t('vs_usual_short')}</span></div>
                  <div className="z-lvl"><RiskBadge level={z.level} /><span>{t('confidence')}: {t(`conf_${confidence(z)}` as Key)}</span></div>
                  <span className="z-go">→</span>
                </a>
              </li>
            )
          })}
        </ol>
        <aside className="zmap">
          <UyMap labels fill={(i) => (shown.has(i) ? LEVELS[wk.zones[i].level].color : undefined)} onPick={(i) => go('/report/' + db.depts[i].id)} />
          <RiskLegend />
        </aside>
      </div>
    </>
  )
}
