import { useEffect, useMemo, useRef, useState } from 'react'
import { dailyClim, download, idxOf, monthMatrix, monthStats, quantile, season, toCSV, YEARS } from '../data'
import { Card, fmtDate, fmtNum, ramp, SENSOR, Tag, useApp } from '../ui'

const CW = 3, CH = 16
export default function Calendar({ zone }: { zone?: string }) {
  const { db, t, lang, week, go } = useApp()
  const z = db.depts.find((d) => d.id === zone) ?? db.nat
  const [view, setView] = useState<'daily' | 'monthly'>('monthly')
  const [from, setFrom] = useState(2001)
  const [to, setTo] = useState(2025)
  const [blind, setBlind] = useState(false)
  const [hover, setHover] = useState('')
  const canvas = useRef<HTMLCanvasElement>(null)
  const years = YEARS.filter((y) => y >= from && y <= to)
  const wk = db.model.weeks[week]

  const { mat, st, clim, sea, vmax, mmax, totals } = useMemo(() => {
    const mat = monthMatrix(db, z), st = monthStats(mat), clim = dailyClim(db, z)
    const nz = Array.from(z.h).filter((v) => v > 0)
    return { mat, st, clim, sea: season(clim), vmax: nz.length ? quantile(nz, 0.98) : 1, mmax: Math.max(...mat.flat(), 1), totals: mat.map((r) => r.reduce((a, b) => a + b, 0)) }
  }, [db, z])

  useEffect(() => {
    const c = canvas.current
    if (!c || view !== 'daily') return
    c.width = 366 * CW; c.height = years.length * CH
    const g = c.getContext('2d')!
    g.fillStyle = '#0d1218'; g.fillRect(0, 0, c.width, c.height)
    for (let i = 0; i < db.meta.nDays; i++) {
      const r = years.indexOf(db.year[i])
      if (r < 0) continue
      const v = z.h[i]
      g.fillStyle = v > 0 ? ramp(0.12 + 0.88 * Math.sqrt(Math.min(1, v / vmax))) : blind && z.blind[i] === '1' ? '#33414f' : '#131a22'
      g.fillRect(db.doy[i] * CW, r * CH + 1, CW, CH - 2)
    }
  }, [db, z, view, years, vmax, blind])

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const b = e.currentTarget.getBoundingClientRect()
    const doy = Math.floor(((e.clientX - b.left) / b.width) * 366), y = years[Math.floor(((e.clientY - b.top) / b.height) * years.length)]
    if (!y) return
    const i = idxOf(y + '-01-01') + doy
    if (i < 0 || i >= db.meta.nDays || db.year[i] !== y) return setHover('')
    const era = i < db.meta.aquaStart ? 'MODIS Terra' : i < db.meta.viirsStart ? 'MODIS Terra+Aqua' : 'VIIRS + MODIS'
    setHover(`${fmtDate(new Date(Date.UTC(y, 0, 1 + doy)), lang)} · ${fmtNum(z.h[i], lang, 1)} ${t('unit_short')} · ${era}${blind && z.blind[i] === '1' ? ' · ' + t('blind_day') : ''}`)
  }

  const months = Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat(lang, { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, i, 1))))
  const doyDate = (d: number) => fmtDate(new Date(Date.UTC(2023, 0, 1 + d)), lang, { day: 'numeric', month: 'short' })
  // last 30 days vs the same window in previous years
  const cur = sum(z.h, wk.t - 30, wk.t)
  const prev = YEARS.map((_, k) => wk.t - 365 * (k + 1)).filter((a) => a - 30 >= 61).map((a) => sum(z.h, a - 30, a))
  const med = quantile(prev, 0.5)
  const best = totals.indexOf(Math.max(...totals)), calm = totals.indexOf(Math.min(...totals))
  const cmax = Math.max(...clim, 0.001)
  const era = (y: number) => (y < 2003 ? '#56657a' : y < 2012 ? SENSOR.modis : SENSOR.viirs)
  const isAnom = (y: number, m: number) => mat[y][m] > st[m].p90 && mat[y][m] > 1.5 * st[m].median && mat[y][m] >= 5

  return (
    <>
      <div className="sec-h">
        <div><h2>{t('cal_title')}</h2><p>{t('cal_sub')}</p></div>
        <Tag kind="real">{t('real_data')}</Tag>
      </div>
      <div className="toolbar">
        <label>{t('zone')}
          <select value={z.id} onChange={(e) => go('/calendar/' + e.target.value)}>
            <option value="UY">Uruguay</option>
            {db.depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <label>{t('from')}<select value={from} onChange={(e) => setFrom(Math.min(+e.target.value, to))}>{YEARS.map((y) => <option key={y}>{y}</option>)}</select></label>
        <label>{t('to')}<select value={to} onChange={(e) => setTo(Math.max(+e.target.value, from))}>{YEARS.map((y) => <option key={y}>{y}</option>)}</select></label>
        <div className="seg">
          <button className={view === 'monthly' ? 'on' : ''} onClick={() => setView('monthly')}>{t('monthly')}</button>
          <button className={view === 'daily' ? 'on' : ''} onClick={() => setView('daily')}>{t('daily')}</button>
        </div>
        <button className="btn" onClick={() => download(`embercast_${z.id}_${from}-${to}.csv`, toCSV(db, z, Math.max(0, idxOf(from + '-01-01')), idxOf(to + '-12-31')))}>⬇ {t('csv')}</button>
      </div>

      <div className="stats">
        <div><span>{t('st_now')}</span><b>{fmtNum(med >= 1 ? cur / med : cur, lang, 1)}{med >= 1 ? '×' : ''}</b><em>{t('st_now_d', { cur: fmtNum(cur, lang), med: fmtNum(med, lang) })}</em></div>
        <div><span>{t('st_season')}</span><b>{doyDate(sea.start)} – {doyDate(sea.end)}</b><em>{t('st_season_d', { peak: doyDate(sea.peak) })}</em></div>
        <div><span>{t('st_peak')}</span><b>{YEARS[best]}</b><em>{t('st_peak_d', { n: fmtNum(totals[best], lang) })}</em></div>
        <div><span>{t('st_calm')}</span><b>{YEARS[calm]}</b><em>{t('st_peak_d', { n: fmtNum(totals[calm], lang) })}</em></div>
      </div>

      <Card className="cal-card">
        {view === 'monthly' ? (
          <div className="mgrid" role="table">
            <div className="mrow head"><span /><span />{months.map((m) => <b key={m}>{m}</b>)}<b>{t('total')}</b></div>
            {years.map((y) => (
              <div className="mrow" key={y}>
                <span className="yr">{y}</span><i className="era" style={{ background: era(y) }} />
                {mat[y - 2001].map((v, m) => (
                  <span key={m} className={'mc' + (isAnom(y - 2001, m) ? ' anom' : '')} style={{ background: v > 0 ? ramp(0.1 + 0.9 * Math.sqrt(v / mmax)) : '#131a22', color: v / mmax > 0.35 ? '#111' : '#dfe6ee' }}
                    title={`${months[m]} ${y}: ${fmtNum(v, lang)} · ${t('median')}: ${fmtNum(st[m].median, lang)}`}>{fmtNum(v, lang)}</span>
                ))}
                <span className="tot">{fmtNum(totals[y - 2001], lang)}</span>
              </div>
            ))}
            <div className="mrow med"><span className="yr">{t('median')}</span><i />{st.map((s, m) => <span key={m} className="mc">{fmtNum(s.median, lang)}</span>)}<span /></div>
          </div>
        ) : (
          <div className="dgrid">
            <div className="dmonths"><span />{months.map((m) => <b key={m}>{m}</b>)}</div>
            <div className="dbody">
              <div className="dyears">{years.map((y) => <span key={y}><i style={{ background: era(y) }} />{y}</span>)}</div>
              <canvas ref={canvas} onMouseMove={onMove} onMouseLeave={() => setHover('')} style={{ height: years.length * CH }} />
            </div>
            <p className="hover">{hover || t('hover_hint')}</p>
          </div>
        )}
        <div className="cal-leg">
          <div className="legend"><span>{t('less')}</span><span className="rampbar" style={{ background: `linear-gradient(90deg,${[0.1, 0.3, 0.5, 0.75, 1].map(ramp).join(',')})` }} /><span>{t('more')}</span>
            {view === 'monthly' && <span><i className="sq anomk" />{t('anomaly')}</span>}</div>
          <div className="legend"><span><i style={{ background: '#56657a' }} />MODIS Terra × k</span><span><i style={{ background: SENSOR.modis }} />MODIS Terra+Aqua × k</span><span><i style={{ background: SENSOR.viirs }} />VIIRS</span></div>
          {view === 'daily' && <label className="chk"><input type="checkbox" checked={blind} onChange={(e) => setBlind(e.target.checked)} /><i style={{ background: '#33414f' }} />{t('show_blind')} <Tag kind="sim">{t('illustrative')}</Tag></label>}
        </div>
      </Card>

      <Card title={t('season_title')} right={<Tag kind="real">{t('real_data')}</Tag>}>
        <svg viewBox="0 0 732 150" className="chart">
          {sea.start <= sea.end
            ? <rect x={sea.start * 2} y={6} width={(sea.end - sea.start) * 2} height={116} className="season" />
            : <><rect x={0} y={6} width={sea.end * 2} height={116} className="season" /><rect x={sea.start * 2} y={6} width={(366 - sea.start) * 2} height={116} className="season" /></>}
          <path d={'M0 122' + clim.map((v, i) => `L${i * 2} ${122 - (v / cmax) * 110}`).join('') + 'L732 122Z'} fill="url(#climg)" />
          <path d={'M' + clim.map((v, i) => `${i * 2} ${122 - (v / cmax) * 110}`).join('L')} fill="none" stroke="#ffb347" strokeWidth={2} />
          <defs><linearGradient id="climg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff7a2f" stopOpacity=".55" /><stop offset="1" stopColor="#ff7a2f" stopOpacity="0" /></linearGradient></defs>
          {months.map((m, i) => <text key={m} x={i * 61 + 30} y={142} textAnchor="middle" className="ax">{m}</text>)}
          <line x1={(db.doy[wk.t] ?? 0) * 2} x2={(db.doy[wk.t] ?? 0) * 2} y1={6} y2={122} className="nowline" />
        </svg>
        <p className="note">{t('season_note', { zone: z.name, a: doyDate(sea.start), b: doyDate(sea.end) })}</p>
      </Card>
    </>
  )
}
function sum(a: Float32Array, i0: number, i1: number) { let s = 0; for (let i = Math.max(0, i0); i < i1; i++) s += a[i]; return s }
