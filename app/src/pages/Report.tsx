import { activityRatio, confidence, monthMatrix, monthStats, reasons, zoneLevel } from '../data'
import type { Key } from '../i18n'
import { Card, fmtDate, fmtNum, Illus, LEVELS, RiskBadge, RiskGlyph, Tag, useApp } from '../ui'
import { reasonText } from './Home'

export default function Report({ id }: { id?: string }) {
  const { db, t, lang, week } = useApp()
  const wk = db.model.weeks[week]
  const top = [...db.depts].sort((a, b) => wk.zones[b.idx].score - wk.zones[a.idx].score)[0]
  const d = db.depts.find((x) => x.id === id) ?? top
  const z = wk.zones[d.idx]
  const rs = reasons(db, z)
  const maxc = Math.max(...rs.map((r) => Math.abs(r.v)), 0.01)
  const ratio = activityRatio(z)
  const conf = confidence(z)
  const mat = monthMatrix(db, d), st = monthStats(mat)
  const date = new Date(wk.date + 'T00:00:00Z')
  const yIdx = date.getUTCFullYear() - 2001
  const months = Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat(lang, { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, i, 1))))
  const mmax = Math.max(...st.map((s) => s.p90), ...mat[yIdx], 1)
  const ahead = Array.from({ length: 8 }, (_, i) => zoneLevel(db, week, d.idx, i * 7))
  const blindDays = Array.from({ length: 7 }, (_, i) => d.blind[wk.t - 7 + i] === '1')
  const nb = blindDays.filter(Boolean).length
  return (
    <>
      <a className="back" href="#/">← {t('my_zones')}</a>
      <section className="rep-head" style={{ ['--lv' as string]: LEVELS[z.level].color }}>
        <div>
          <span className="eyebrow">{t('report_for', { date: fmtDate(wk.date, lang) })}</span>
          <h1>{d.name}</h1>
          <p className="lead">{t('rep_headline', { level: t(`lvl_${LEVELS[z.level].key}` as Key).toLowerCase() })} <Illus /></p>
        </div>
        <div className="rep-level">
          <RiskGlyph level={z.level} size={84} />
          <RiskBadge level={z.level} big />
        </div>
      </section>

      <div className="grid2">
        <Card title={t('why')} right={<Illus />}>
          <ul className="why">
            {rs.slice(0, 6).map((r) => (
              <li key={r.g}>
                <span>{reasonText(t, r.g, r.v, z, lang)}</span>
                <div className="why-bar"><i className={r.v >= 0 ? 'up' : 'down'} style={{ width: (Math.abs(r.v) / maxc) * 50 + '%', [r.v >= 0 ? 'left' : 'right']: '50%' }} /></div>
              </li>
            ))}
          </ul>
          <p className="note">{t('why_note')}</p>
        </Card>

        <Card title={t('activity_now')} right={<Tag kind="real">{t('real_data')}</Tag>}>
          <div className="act-big"><b>{fmtNum(ratio, lang, 1)}×</b><span>{t('act_sub')}</span></div>
          <div className="cmp">
            {([['last30', z.cur30, '#ffb347'], ['usual30', z.usual30, '#6b7a8c'], ['p90', z.p90, '#3d4a5a']] as const).map(([k, v, c]) => (
              <div key={k}><span>{t(k as Key)}</span><div className="cmp-bar"><i style={{ width: (v / Math.max(z.cur30, z.p90, 1)) * 100 + '%', background: c }} /></div><b>{fmtNum(v, lang)}</b></div>
            ))}
          </div>
          <p className="note">{t('unit_note')}</p>
          <svg viewBox="0 0 360 110" className="mini">
            {st.map((s, m) => {
              const x = 8 + m * 29, h = (v: number) => (v / mmax) * 78
              return (
                <g key={m}>
                  <rect x={x} y={88 - h(s.p90)} width={22} height={h(s.p90)} fill="#243140" rx={2} />
                  <rect x={x} y={88 - h(s.median)} width={22} height={h(s.median)} fill="#3d4f63" rx={2} />
                  <rect x={x + 7} y={88 - h(mat[yIdx][m])} width={8} height={h(mat[yIdx][m])} fill={m === date.getUTCMonth() ? '#ff7a2f' : '#ffb347'} rx={2}
                    opacity={m <= date.getUTCMonth() ? 1 : 0.25} />
                  <text x={x + 11} y={102} textAnchor="middle" className="ax">{months[m]}</text>
                </g>
              )
            })}
          </svg>
          <div className="legend"><span><i style={{ background: '#ffb347' }} />{date.getUTCFullYear()}</span><span><i style={{ background: '#3d4f63' }} />{t('median_25')}</span><span><i style={{ background: '#243140' }} />{t('p90_25')}</span></div>
        </Card>

        <Card title={t('look_ahead')} right={<Illus />}>
          <div className="ahead">
            {ahead.map((a, i) => (
              <div key={i} className={a.src}>
                <span>{i === 0 ? t('next7') : '+' + i + ' ' + t('wk')}</span>
                <RiskGlyph level={a.level} size={26} />
                <em style={{ color: LEVELS[a.level].color }}>{t(`lvl_${LEVELS[a.level].key}` as Key)}</em>
              </div>
            ))}
          </div>
          <p className="note">{t('ahead_note')}</p>
        </Card>

        <Card title={t('confidence')} right={<Tag kind="sim">{t('illustrative')}</Tag>}>
          <div className="conf"><b className={conf}>{t(`conf_${conf}` as Key)}</b><span>{t('conf_sub', { n: nb })}</span></div>
          <div className="blind-row">
            {blindDays.map((b, i) => <i key={i} className={b ? 'blind' : 'seen'} title={b ? t('blind_day') : t('seen_day')} />)}
          </div>
          <div className="legend"><span><i className="sq seen" />{t('seen_day')}</span><span><i className="sq blind" />{t('blind_day')}</span></div>
          <p className="note">{t('blind_note')}</p>
        </Card>

        <Card title={t('what_to_do')}>
          <p className="advice">{t(`advice_inst_${z.level}` as Key)}</p>
          <p className="note">{t('not_alert')}</p>
        </Card>

        <Card title={t('evidence')} right={<Tag kind="real">{t('real_data')}</Tag>}>
          <p>{t('evidence_txt', { hits: z.hits, cells: z.cells, n: z.act7 })}</p>
          <div className="cta">
            <a className="btn" href={'#/map/' + d.id}>{t('see_map')} →</a>
            <a className="btn" href={'#/calendar/' + d.id}>{t('see_calendar')} →</a>
            <a className="btn" href="#/alerts">{t('subscribe')} →</a>
          </div>
        </Card>
      </div>
    </>
  )
}
