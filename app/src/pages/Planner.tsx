import { useMemo, useState } from 'react'
import { zoneLevel } from '../data'
import type { Key } from '../i18n'
import { Card, fmtDate, Illus, LEVELS, RiskBadge, RiskGlyph, RiskLegend, Tag, useApp, UyMap } from '../ui'

type Act = 'trip' | 'event' | 'operation' | 'burn'
const ACTS: { id: Act; icon: string; tol: number }[] = [
  { id: 'trip', icon: 'A', tol: 1 }, { id: 'event', icon: 'B', tol: 1 }, { id: 'operation', icon: 'C', tol: 1 }, { id: 'burn', icon: 'D', tol: 0 },
]
const DAY = 864e5
interface Stop { d: number; days: number }

export default function Planner() {
  const { db, t, lang, week } = useApp()
  const wk = db.model.weeks[week]
  const today = Date.parse(wk.date + 'T00:00:00Z')
  const idx = (id: string) => db.depts.findIndex((d) => d.id === id)
  const [act, setAct] = useState<Act>('trip')
  const [stops, setStops] = useState<Stop[]>([{ d: idx('UY-MA'), days: 3 }, { d: idx('UY-RO'), days: 3 }, { d: idx('UY-TT'), days: 2 }])
  const [start, setStart] = useState(4)
  const tol = ACTS.find((a) => a.id === act)!.tol
  const total = stops.reduce((a, s) => a + s.days, 0)

  const evalPlan = (st: Stop[], s0: number) => {
    let off = s0, worst = 0, over = 0, sum = 0
    const rows = st.map((s) => {
      const days = Array.from({ length: s.days }, (_, i) => ({ off: off + i, ...zoneLevel(db, week, s.d, off + i) }))
      off += s.days
      for (const d of days) { worst = Math.max(worst, d.level); if (d.level > tol) over++; sum += d.level }
      return { s, days }
    })
    return { rows, worst, over, sum }
  }
  const plan = useMemo(() => evalPlan(stops, start), [stops, start, week, tol]) // eslint-disable-line react-hooks/exhaustive-deps
  const bestShift = useMemo(() => {
    let best = { s0: start, ...plan }
    for (let s0 = 0; s0 <= 120; s0++) {
      const p = evalPlan(stops, s0)
      if (p.over < best.over || (p.over === best.over && p.sum < best.sum - 0.5 * total && Math.abs(s0 - start) < 90)) best = { s0, ...p }
    }
    return best
  }, [plan]) // eslint-disable-line react-hooks/exhaustive-deps
  const swaps = useMemo(() => plan.rows.map((r, n) => {
    const mx = Math.max(...r.days.map((d) => d.level))
    if (mx <= tol) return null
    const off0 = r.days[0].off
    const alts = db.depts.filter((d) => !stops.some((s) => s.d === d.idx)).map((d) => {
      const ls = r.days.map((_, i) => zoneLevel(db, week, d.idx, off0 + i).level)
      return { d, mx: Math.max(...ls), sum: ls.reduce((a, b) => a + b, 0) }
    }).sort((a, b) => a.mx - b.mx || a.sum - b.sum)
    return alts[0].mx < mx ? { n, from: r.s.d, to: alts[0] } : null
  }).filter(Boolean) as { n: number; from: number; to: { d: (typeof db.depts)[number]; mx: number } }[], [plan]) // eslint-disable-line react-hooks/exhaustive-deps

  const verdict = plan.over === 0 ? (plan.worst === 0 ? 'go' : 'care') : plan.worst - tol >= 2 || plan.over > total / 2 ? 'no' : 'adjust'
  const dstr = (off: number, o?: Intl.DateTimeFormatOptions) => fmtDate(new Date(today + off * DAY), lang, o ?? { day: 'numeric', month: 'short' })
  const toggle = (d: number) => setStops((s) => (s.some((x) => x.d === d) ? (s.length > 1 ? s.filter((x) => x.d !== d) : s) : s.length < 6 ? [...s, { d, days: 2 }] : s))
  const setDays = (n: number, v: number) => setStops((s) => s.map((x, i) => (i === n ? { ...x, days: Math.max(1, Math.min(14, v)) } : x)))
  const move = (n: number, dir: number) => setStops((s) => { const a = [...s]; const j = n + dir; if (j < 0 || j >= a.length) return s; [a[n], a[j]] = [a[j], a[n]]; return a })

  return (
    <>
      <div className="sec-h">
        <div><h2>{t('pl_title')}</h2><p>{t('pl_sub')}</p></div>
        <Illus />
      </div>
      <div className="acts">
        {ACTS.map((a) => (
          <button key={a.id} className={act === a.id ? 'on' : ''} onClick={() => setAct(a.id)}>
            <span>{a.icon}</span><b>{t(`act_${a.id}` as Key)}</b><em>{t(`act_${a.id}_d` as Key)}</em>
          </button>
        ))}
      </div>
      <div className="map-grid plan">
        <Card className="map-card" title={t('pl_pick')}>
          <UyMap labels onPick={toggle} route={stops.map((s) => s.d)}
            fill={(i) => LEVELS[zoneLevel(db, week, i, start + Math.floor(total / 2)).level].color} />
          <RiskLegend />
          <p className="note">{t('pl_map_note', { date: dstr(start + Math.floor(total / 2)) })}</p>
        </Card>
        <div className="map-side">
          <Card title={t('pl_when')}>
            <div className="when">
              <label>{t('pl_start')}
                <input type="date" value={new Date(today + start * DAY).toISOString().slice(0, 10)} min={wk.date}
                  max={new Date(today + 300 * DAY).toISOString().slice(0, 10)}
                  onChange={(e) => { const v = Math.round((Date.parse(e.target.value + 'T00:00:00Z') - today) / DAY); if (v >= 0 && v <= 300) setStart(v) }} />
              </label>
              <input type="range" min={0} max={180} value={Math.min(start, 180)} onChange={(e) => setStart(+e.target.value)} />
              <span className="note">{t('pl_today', { date: fmtDate(wk.date, lang) })}</span>
            </div>
          </Card>
          <div className={'verdict ' + verdict}>
            <div>
              <span>{t(`act_${act}` as Key)} · {dstr(start)} → {dstr(start + total - 1, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              <h3>{t(`v_${verdict}` as Key)}</h3>
              <p>{t(`adv_${act}_${Math.min(plan.worst, 3)}` as Key)}</p>
            </div>
            <RiskBadge level={plan.worst} big />
          </div>
          <Card title={t('pl_itin')}>
            {plan.rows.map((r, n) => (
              <div className="stoprow" key={r.s.d}>
                <div className="stop-h">
                  <span className="num">{n + 1}</span><b>{db.depts[r.s.d].name}</b>
                  <span className="stepper"><button onClick={() => setDays(n, r.s.days - 1)}>−</button>{r.s.days} {t('days')}<button onClick={() => setDays(n, r.s.days + 1)}>+</button></span>
                  <span className="ord"><button onClick={() => move(n, -1)} aria-label="up">↑</button><button onClick={() => move(n, 1)} aria-label="down">↓</button><button onClick={() => toggle(r.s.d)} aria-label="remove">✕</button></span>
                </div>
                <div className="daystrip">
                  {r.days.map((d) => (
                    <div key={d.off} className={d.src + (d.level > tol ? ' over' : '')} title={t(d.src === 'outlook' ? 'src_outlook' : 'src_seasonal')}>
                      <i style={{ background: LEVELS[d.level].color, color: LEVELS[d.level].fg }}><RiskGlyph level={d.level} size={18} /></i><span>{dstr(d.off, { day: 'numeric', month: 'numeric' })}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="legend"><span><i className="sq outlook" />{t('src_outlook')}</span><span><i className="sq seasonal" />{t('src_seasonal')} <Tag kind="real">{t('real_data')}</Tag></span><span><i className="sq overk" />{t('over_tol')}</span></div>
          </Card>
          {(bestShift.s0 !== start || swaps.length > 0) && (
            <Card title={t('pl_sugg')}>
              {bestShift.s0 !== start && (
                <div className="sugg">
                  <p>{t('sg_shift', { date: dstr(bestShift.s0, { day: 'numeric', month: 'long' }), lvl: t(`lvl_${LEVELS[bestShift.worst].key}` as Key).toLowerCase() })}</p>
                  <button className="btn" onClick={() => setStart(bestShift.s0)}>{t('apply')}</button>
                </div>
              )}
              {swaps.map((s) => (
                <div className="sugg" key={s.n}>
                  <p>{t('sg_swap', { from: db.depts[s.from].name, to: s.to.d.name, lvl: t(`lvl_${LEVELS[s.to.mx].key}` as Key).toLowerCase() })}</p>
                  <button className="btn" onClick={() => setStops((st) => st.map((x, i) => (i === s.n ? { ...x, d: s.to.d.idx } : x)))}>{t('apply')}</button>
                </div>
              ))}
            </Card>
          )}
          <p className="note">{t('pl_note')}</p>
        </div>
      </div>
    </>
  )
}
