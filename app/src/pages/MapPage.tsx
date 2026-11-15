import { useMemo, useState } from 'react'
import { activityRatio, isoOf } from '../data'
import type { Key } from '../i18n'
import { Card, fmtDate, fmtNum, Illus, Legend, LEVELS, ramp, RiskBadge, RiskLegend, SENSOR, Tag, useApp, UyMap } from '../ui'
import { reasonText } from './Home'

type Base = 'risk' | 'activity'
export default function MapPage({ zone }: { zone?: string }) {
  const { db, t, lang, week, setWeek } = useApp()
  const [base, setBase] = useState<Base>('risk')
  const [showM, setShowM] = useState(false)
  const [showV, setShowV] = useState(true)
  const [reveal, setReveal] = useState(false)
  const [sel, setSel] = useState(() => db.depts.findIndex((d) => d.id === zone))
  const [cell, setCell] = useState(-1)
  const wk = db.model.weeks[week]
  const g = db.meta.grid

  const cellKey = useMemo(() => {
    const m = new Map<string, number>()
    db.model.cells.forEach((c, i) => m.set(Math.floor((c.lat - g.lat0) / g.size) + '_' + Math.floor((c.lon - g.lon0) / g.size), i))
    return m
  }, [db, g])
  const { act, maxAct, ptsM, ptsV, ptsNext } = useMemo(() => {
    const sets = db.model.cells.map(() => new Set<string>())
    const inWin = (r: number[], a: number, b: number) => r[0] >= a && r[0] < b
    for (const r of db.recent.viirs) {
      if (!inWin(r, wk.t - 30, wk.t)) continue
      const i = cellKey.get(Math.floor((r[1] - g.lat0) / g.size) + '_' + Math.floor((r[2] - g.lon0) / g.size))
      if (i !== undefined) sets[i].add(r[0] + '_' + Math.floor(r[1] * 100) + '_' + Math.floor(r[2] * 100))
    }
    const act = sets.map((s) => s.size)
    const mk = (rows: number[][], a: number, b: number, color: string, ring = false) =>
      rows.filter((r) => inWin(r, a, b)).map((r) => ({ lat: r[1], lon: r[2], color, r: ring ? 3.4 : 1.7, ring }))
    return {
      act, maxAct: Math.max(...act, 1),
      ptsM: mk(db.recent.modis, wk.t - 30, wk.t, SENSOR.modis),
      ptsV: mk(db.recent.viirs, wk.t - 30, wk.t, SENSOR.viirs),
      ptsNext: mk(db.recent.viirs, wk.t, wk.t + 7, '#ffffff', true),
    }
  }, [db, wk, cellKey, g])

  const points = [...(showM ? ptsM : []), ...(showV ? ptsV : []), ...(reveal ? ptsNext : [])]
  const z = sel >= 0 ? wk.zones[sel] : null
  const hitCells = [...wk.actual].filter((c) => c !== '0').length
  const hitHigh = [...wk.actual].filter((c, i) => c !== '0' && +wk.levels[i] >= 2).length
  return (
    <>
      <div className="sec-h">
        <div><h2>{t('map_title')}</h2><p>{t('map_sub', { date: fmtDate(wk.date, lang) })}</p></div>
        <div className="slider">
          <button onClick={() => setWeek(Math.max(0, week - 1))} aria-label="previous week">‹</button>
          <input type="range" min={0} max={db.model.weeks.length - 1} value={week} onChange={(e) => setWeek(+e.target.value)} />
          <button onClick={() => setWeek(Math.min(db.model.weeks.length - 1, week + 1))} aria-label="next week">›</button>
          <b>{fmtDate(wk.date, lang)}</b>
        </div>
      </div>
      <div className="map-grid">
        <Card className="map-card">
          <UyMap
            labels
            selected={sel >= 0 ? [sel] : []}
            onPick={(i) => { setSel(i); setCell(-1) }}
            onCell={(i) => { setCell(i); setSel(db.model.cells[i].d) }}
            cellFill={(i) => (base === 'risk' ? LEVELS[+wk.levels[i]].color + 'b8' : act[i] ? ramp(Math.sqrt(act[i] / maxAct)) : '#131a22')}
            points={points}
          />
          {base === 'risk' ? <RiskLegend /> : (
            <div className="legend"><span>{t('less')}</span><span className="rampbar" style={{ background: `linear-gradient(90deg,${[0.05, 0.25, 0.5, 0.75, 1].map(ramp).join(',')})` }} /><span>{t('more')}</span></div>
          )}
        </Card>
        <div className="map-side">
          <Card title={t('layers')}>
            <div className="seg full">
              <button className={base === 'risk' ? 'on' : ''} onClick={() => setBase('risk')}>{t('layer_risk')}</button>
              <button className={base === 'activity' ? 'on' : ''} onClick={() => setBase('activity')}>{t('layer_harm')}</button>
            </div>
            <p className="note">{base === 'risk' ? <>{t('layer_risk_d')} <Illus /></> : <>{t('layer_harm_d')} <Tag kind="real">{t('real_data')}</Tag></>}</p>
            <label className="chk"><input type="checkbox" checked={showV} onChange={(e) => setShowV(e.target.checked)} /><i style={{ background: SENSOR.viirs }} />{t('layer_viirs')} <em>{ptsV.length}</em></label>
            <label className="chk"><input type="checkbox" checked={showM} onChange={(e) => setShowM(e.target.checked)} /><i style={{ background: SENSOR.modis }} />{t('layer_modis')} <em>{ptsM.length}</em></label>
            <p className="note">{t('never_sum')}</p>
            <button className={'primary wide' + (reveal ? ' on' : '')} onClick={() => setReveal(!reveal)}>{reveal ? t('hide_next') : t('reveal_next')}</button>
            {reveal && (
              <div className="note"><Legend items={[{ color: '#fff', label: t('next_legend'), shape: 'ring' }]} />
                <p>{t('reveal_txt', { n: hitCells, high: hitHigh, from: isoOf(wk.t), to: isoOf(wk.t + 6) })}</p></div>
            )}
          </Card>
          {z && (
            <Card title={db.depts[sel].name} right={<RiskBadge level={z.level} />}>
              {cell >= 0 && (
                <p className="note">{t('cell_info', { lat: fmtNum(db.model.cells[cell].lat, lang, 2), lon: fmtNum(db.model.cells[cell].lon, lang, 2), lvl: t(`lvl_${LEVELS[+wk.levels[cell]].key}` as Key), n: act[cell] })}</p>
              )}
              <p><b>{fmtNum(activityRatio(z), lang, 1)}×</b> {t('vs_usual')}</p>
              <p className="zone-why">{reasonText(t, db.model.groups[z.contrib.indexOf(Math.max(...z.contrib))], 1, z, lang)}</p>
              <div className="cta">
                <a className="btn" href={'#/report/' + db.depts[sel].id}>{t('open_report')} →</a>
                <a className="btn" href={'#/calendar/' + db.depts[sel].id}>{t('see_calendar')} →</a>
              </div>
            </Card>
          )}
          {!z && <Card><p className="note">{t('pick_zone')}</p></Card>}
        </div>
      </div>
    </>
  )
}
