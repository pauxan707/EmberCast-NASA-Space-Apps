import { useEffect, useState } from 'react'
import type { Key } from '../i18n'
import { Card, fmtDate, fmtNum, Legend, SENSOR, Tag, useApp } from '../ui'

export default function Harmonize() {
  const { db, t, lang } = useApp()
  const [harm, setHarm] = useState(false)
  const [auto, setAuto] = useState(true)
  const [step, setStep] = useState(0)
  const m = db.meta, ho = m.holdout, ex = db.example
  useEffect(() => {
    if (!auto) return
    const id = setTimeout(() => setHarm(true), 2600)
    return () => clearTimeout(id)
  }, [auto])

  const rawMax = Math.max(...db.yearly.map((y) => y.modisDet + y.viirsDet))
  const hMax = Math.max(...db.yearly.map((y) => y.hi))
  const band = Math.round((Math.exp(m.sdLogYear) - 1) * 100)

  // same-fire example geometry
  const lat0 = Math.min(...ex.points.map((p) => p.lat)) - 0.012, lat1 = Math.max(...ex.points.map((p) => p.lat)) + 0.012
  const lon0 = Math.min(...ex.points.map((p) => p.lon)) - 0.014, lon1 = Math.max(...ex.points.map((p) => p.lon)) + 0.014
  const kx = Math.cos((ex.points[0].lat * Math.PI) / 180)
  const EW = 420, sc = EW / ((lon1 - lon0) * kx), EH = (lat1 - lat0) * sc
  const X = (lon: number) => (lon - lon0) * kx * sc, Y = (lat: number) => (lat1 - lat) * sc
  const gridLat: number[] = [], gridLon: number[] = []
  for (let v = Math.ceil(lat0 * 100) / 100; v < lat1; v += 0.01) gridLat.push(v)
  for (let v = Math.ceil(lon0 * 100) / 100; v < lon1; v += 0.01) gridLon.push(v)
  const cellsOf = (s: string) => [...new Set(ex.points.filter((p) => p.s === s).map((p) => Math.floor(p.lat * 100) + '_' + Math.floor(p.lon * 100)))].map((k) => k.split('_').map(Number))
  const exRows = [
    { k: 'ex_r1', a: ex.modisDet, b: ex.viirsDet, d: 'ex_r1_d' },
    { k: 'ex_r2', a: ex.modisCells, b: ex.viirsCells, d: 'ex_r2_d' },
    { k: 'ex_r3', a: '≈' + fmtNum(ex.modisCells * ex.k, lang, 1), b: ex.viirsCells, d: 'ex_r3_d' },
  ]
  const hoMax = Math.max(...ho.obsY, ...ho.predY)
  const rMin = 1.5, rMax = 3.3
  const rY = (r: number) => 130 - ((r - rMin) / (rMax - rMin)) * 120

  return (
    <>
      <div className="sec-h">
        <div><h2>{t('h_title')}</h2><p>{t('h_sub')}</p></div>
        <Tag kind="real">{t('real_data')}</Tag>
      </div>

      <Card className="jump" title={harm ? t('h_chart_harm') : t('h_chart_raw')} right={
        <div className="seg">
          <button className={!harm ? 'on' : ''} onClick={() => { setAuto(false); setHarm(false) }}>{t('raw')}</button>
          <button className={harm ? 'on' : ''} onClick={() => { setAuto(false); setHarm(true) }}>{t('harmonized')}</button>
        </div>}>
        <div className={'bars' + (harm ? ' is-harm' : '')}>
          {db.yearly.map((y) => {
            const a = harm ? (y.harm / hMax) * 100 : (y.modisDet / rawMax) * 100
            const b = harm ? 0 : (y.viirsDet / rawMax) * 100
            return (
              <div key={y.y} className={'bar' + (y.y === 2012 ? ' mark' : '')} title={harm ? `${y.y}: ${fmtNum(y.harm, lang)} (${fmtNum(y.lo, lang)}–${fmtNum(y.hi, lang)})` : `${y.y}: MODIS ${fmtNum(y.modisDet, lang)} + VIIRS ${fmtNum(y.viirsDet, lang)}`}>
                <div className="col">
                  <i className="v" style={{ height: b + '%', bottom: a + '%' }} />
                  <i className={harm ? 'h' : 'm'} style={{ height: a + '%' }} />
                  {harm && y.y < 2012 && <em className="whisk" style={{ bottom: (y.lo / hMax) * 100 + '%', height: ((y.hi - y.lo) / hMax) * 100 + '%' }} />}
                </div>
                <span>{String(y.y).slice(2)}</span>
              </div>
            )
          })}
          <div className="mark-label" style={{ left: `${(11 / 25) * 100}%` }}>{harm ? t('h_no_jump') : t('h_jump')}</div>
        </div>
        {harm
          ? <Legend items={[{ color: SENSOR.harm, label: t('leg_harm') }, { color: '#fff', label: t('leg_band', { band }) }]} />
          : <Legend items={[{ color: SENSOR.modis, label: t('leg_modis_det') }, { color: SENSOR.viirs, label: t('leg_viirs_det') }]} />}
        <p className="lead small">{harm ? t('h_txt_harm', { k: fmtNum(m.kNat, lang, 2) }) : t('h_txt_raw')}</p>
      </Card>

      <div className="kpis wide">
        <div><b>{fmtNum(ho.annualMAPEraw, lang)}% → {fmtNum(ho.annualMAPE, lang)}%</b><span>{t('kpi_error_long')}</span></div>
        <div><b>r = {fmtNum(ho.monthlyR, lang, 2)}</b><span>{t('kpi_r_long')}</span></div>
        <div><b>× {fmtNum(m.kNat, lang, 2)}</b><span>{t('kpi_k')}</span></div>
        <div><b>± {band}%</b><span>{t('kpi_band')}</span></div>
      </div>

      <Card title={t('ex_title', { date: fmtDate(ex.date, lang), dept: ex.dept })} right={<Tag kind="real">{t('real_data')}</Tag>}>
        <div className="ex">
          <svg viewBox={`0 0 ${EW} ${EH}`} className="ex-svg">
            {gridLat.map((v) => <line key={'a' + v} x1={0} x2={EW} y1={Y(v)} y2={Y(v)} className="gl" />)}
            {gridLon.map((v) => <line key={'o' + v} y1={0} y2={EH} x1={X(v)} x2={X(v)} className="gl" />)}
            {step >= 1 && (['MODIS', 'VIIRS'] as const).map((s) => cellsOf(s).map(([a, b]) => (
              <rect key={s + a + b} x={X(b / 100) + (s === 'MODIS' ? 2 : 5)} y={Y((a + 1) / 100) + (s === 'MODIS' ? 2 : 5)} width={X((b + 1) / 100) - X(b / 100) - (s === 'MODIS' ? 4 : 10)}
                height={Y(a / 100) - Y((a + 1) / 100) - (s === 'MODIS' ? 4 : 10)} className={'acell ' + s} />
            )))}
            {ex.points.map((p, i) => {
              const w = (p.scan / 111.32) * sc, h = (p.track / 110.57) * sc
              return <rect key={i} x={X(p.lon) - w / 2} y={Y(p.lat) - h / 2} width={w} height={h} className={'fp ' + p.s} opacity={step === 0 ? 1 : 0.35} />
            })}
            {ex.points.map((p, i) => <circle key={i} cx={X(p.lon)} cy={Y(p.lat)} r={2.4} fill={p.s === 'MODIS' ? SENSOR.modis : SENSOR.viirs} />)}
            <text x={8} y={EH - 8} className="ax">{t('ex_grid')}</text>
          </svg>
          <div className="ex-side">
            <div className="steps">
              {exRows.map((r, i) => (
                <button key={r.k} className={'exrow' + (step === i ? ' on' : '')} onClick={() => setStep(i)}>
                  <span>{i + 1}. {t(r.k as Key)}</span>
                  <b style={{ color: SENSOR.modis }}>{r.a}</b><b style={{ color: SENSOR.viirs }}>{r.b}</b>
                  <em>{t(r.d as Key, { k: fmtNum(ex.k, lang, 2), sum: ex.modisDet + ex.viirsDet, x: fmtNum(ex.viirsDet / ex.modisDet, lang, 0) })}</em>
                </button>
              ))}
            </div>
            <Legend items={[{ color: SENSOR.modis, label: 'MODIS Aqua · ~1 km' }, { color: SENSOR.viirs, label: 'VIIRS S-NPP · 375 m' }]} />
            <p className="note">{t('ex_note')}</p>
          </div>
        </div>
      </Card>

      <h2 className="h-steps">{t('four_steps')}</h2>
      <div className="grid4">
        {[1, 2, 3, 4].map((n) => (
          <div className="stepcard" key={n}>
            <span>{n}</span>
            <h3>{t(`s${n}_t` as Key)}</h3>
            <p>{t(`s${n}_d` as Key, {
              mraw: fmtNum(m.filters.modis.raw, lang), vraw: fmtNum(m.filters.viirs.raw, lang),
              low: fmtNum(m.filters.modis.low_conf + m.filters.viirs.low_conf, lang), nonveg: fmtNum(m.filters.modis.non_veg + m.filters.viirs.non_veg, lang),
              k: fmtNum(m.kNat, lang, 2), kt: fmtNum(m.kTNat, lang, 1), band,
            })}</p>
          </div>
        ))}
      </div>

      <div className="grid2">
        <Card title={t('val_title')} right={<Tag kind="real">{t('real_data')}</Tag>}>
          <svg viewBox="0 0 420 190" className="chart">
            {ho.years.map((y, i) => {
              const x = 18 + i * 57, h = (v: number) => (v / hoMax) * 140
              return (
                <g key={y}>
                  <rect x={x} y={160 - h(ho.rawY[i])} width={13} height={h(ho.rawY[i])} fill={SENSOR.modis} rx={2} />
                  <rect x={x + 15} y={160 - h(ho.predY[i])} width={13} height={h(ho.predY[i])} fill={SENSOR.harm} rx={2} />
                  <rect x={x + 30} y={160 - h(ho.obsY[i])} width={13} height={h(ho.obsY[i])} fill={SENSOR.viirs} rx={2} />
                  <text x={x + 21} y={176} textAnchor="middle" className="ax">{y}</text>
                </g>
              )
            })}
          </svg>
          <Legend items={[{ color: SENSOR.modis, label: t('val_raw') }, { color: SENSOR.harm, label: t('val_pred') }, { color: SENSOR.viirs, label: t('val_obs') }]} />
          <p className="note">{t('val_txt', { raw: fmtNum(ho.annualMAPEraw, lang), cal: fmtNum(ho.annualMAPE, lang), r: fmtNum(ho.monthlyR, lang, 2), bias: fmtNum(ho.totalBiasPct, lang, 0) })}</p>
        </Card>
        <Card title={t('ratio_title')} right={<Tag kind="real">{t('real_data')}</Tag>}>
          <svg viewBox="0 0 420 160" className="chart">
            <rect x={20} width={390} y={rY(m.kNat * Math.exp(m.sdLogYear))} height={rY(m.kNat * Math.exp(-m.sdLogYear)) - rY(m.kNat * Math.exp(m.sdLogYear))} className="season" />
            <line x1={20} x2={410} y1={rY(m.kNat)} y2={rY(m.kNat)} className="nowline" />
            <path d={'M' + db.ratios.map((r, i) => `${34 + i * 28} ${rY(r.r)}`).join('L')} fill="none" stroke={SENSOR.harm} strokeWidth={2} />
            {db.ratios.map((r, i) => <g key={r.y}><circle cx={34 + i * 28} cy={rY(r.r)} r={3.5} fill={SENSOR.harm} /><text x={34 + i * 28} y={150} textAnchor="middle" className="ax">{String(r.y).slice(2)}</text>
              <text x={34 + i * 28} y={rY(r.r) - 8} textAnchor="middle" className="ax hi">{fmtNum(r.r, lang, 1)}</text></g>)}
          </svg>
          <p className="note">{t('ratio_txt', { k: fmtNum(m.kNat, lang, 2), band })}</p>
        </Card>
      </div>

      <div className="grid2">
        <Card title={t('why_title')}>
          <ul className="ticks">{(['why_1', 'why_2', 'why_3', 'why_4'] as Key[]).map((k) => <li key={k}>{t(k)}</li>)}</ul>
        </Card>
        <Card title={t('cant_title')}>
          <ul className="ticks no">{(['cant_1', 'cant_2', 'cant_3', 'cant_4'] as Key[]).map((k) => <li key={k}>{t(k)}</li>)}</ul>
        </Card>
      </div>
    </>
  )
}
