import type { Key } from '../i18n'
import { Card, fmtNum, HowNav, Illus, LEVELS, RiskBadge, Tag, useApp } from '../ui'

const INPUTS: { g: string; src: string; nasa: boolean }[] = [
  { g: 'season', src: 'EmberCast harmonized record (NASA FIRMS: MCD14ML + VNP14IMGT)', nasa: true },
  { g: 'recent', src: 'EmberCast harmonized record', nasa: true },
  { g: 'dryness', src: 'NASA POWER (precipitation)', nasa: true },
  { g: 'heat', src: 'NASA POWER (T2M_MAX, RH2M, WS2M)', nasa: true },
  { g: 'veg', src: 'MODIS/VIIRS NDVI + land cover · SMAP soil moisture', nasa: true },
  { g: 'human', src: 'GPW population · Black Marble night lights · OpenStreetMap', nasa: false },
]
export default function ModelPage() {
  const { db, t, lang, simulated } = useApp()
  const mo = db.model
  const best = Math.max(...mo.results.map((r) => r.top10))
  const gmax = Math.max(...mo.groupImp.map((g) => g.gain))
  return (
    <>
      <HowNav on="model" />
      <div className="sec-h">
        <div><h2>{t('m_title')}</h2><p>{t('m_sub')}</p></div>
        <Illus />
      </div>
      {simulated && <div className="callout">{t('m_callout')}</div>}

      <div className="pipe">
        <div className="pipe-col">
          <div className="pbox modis"><b>MODIS</b><span>2000 →</span></div>
          <div className="pbox viirs"><b>VIIRS</b><span>2012 →</span></div>
        </div>
        <i className="arrow" />
        <div className="pbox harm"><b>{t('p_record')}</b><span>{t('p_record_d')}</span><Tag kind="real">{t('real_data')}</Tag></div>
        <i className="arrow" />
        <div className="pipe-col">
          <div className="pbox"><b>{t('p_cal')}</b><span>{t('p_cal_d')}</span><Tag kind="real">{t('real_data')}</Tag></div>
          <div className="pbox model"><b>{t('p_model')}</b><span>{t('p_model_d')}</span><Illus /></div>
        </div>
        <i className="arrow" />
        <div className="pbox out"><b>{t('p_report')}</b><span>{t('p_report_d')}</span></div>
      </div>

      <div className="grid2">
        <Card title={t('m_predicts')}>
          <p>{t('m_predicts_d')}</p>
          <div className="lvl-row">{LEVELS.map((_, i) => <RiskBadge key={i} level={i} />)}</div>
          <table className="tbl">
            <thead><tr><th>{t('level')}</th><th>{t('rel_share')}</th><th>{t('rel_obs')}</th></tr></thead>
            <tbody>{mo.reliability.map((r) => (
              <tr key={r.level}><td><RiskBadge level={r.level} /></td><td>{fmtNum(r.share * 100, lang)}%</td><td>{fmtNum(r.observed * 100, lang)}%</td></tr>
            ))}</tbody>
          </table>
          <p className="note">{t('rel_note')} <Illus /></p>
        </Card>
        <Card title={t('m_train')}>
          <div className="split">
            <div style={{ flex: 11 }} className="tr"><b>{t('split_train')}</b><span>{mo.split.train}</span></div>
            <div style={{ flex: 1.6 }} className="va"><b>{t('split_valid')}</b><span>{mo.split.valid}</span></div>
            <div style={{ flex: 2.6 }} className="te"><b>{t('split_test')}</b><span>{mo.split.test}</span></div>
          </div>
          <p>{t('m_train_d')}</p>
          <ul className="ticks">
            <li>{t('m_t1')}</li><li>{t('m_t2')}</li><li>{t('m_t3')}</li>
          </ul>
        </Card>
        <Card title={t('m_imp')} right={<Illus />}>
          {mo.groupImp.map((g) => (
            <div className="hbar" key={g.g}><span>{t(`grp_${g.g}` as Key)}</span><div><i style={{ width: (g.gain / gmax) * 100 + '%' }} /></div><b>{fmtNum(g.gain * 100, lang)}%</b></div>
          ))}
          <p className="note">{t('m_imp_note')}</p>
        </Card>
        <Card title={t('m_cmp')} right={<Illus />}>
          {mo.results.map((r, i) => (
            <div className={'hbar' + (i === 0 ? ' best' : '')} key={r.id}><span>{t(`res_${r.id}` as Key)}</span><div><i style={{ width: (r.top10 / best) * 100 + '%' }} /></div><b>{fmtNum(r.top10 * 100, lang)}%</b></div>
          ))}
          <p className="note">{t('m_cmp_note')}</p>
        </Card>
      </div>

      <Card title={t('m_inputs')}>
        <table className="tbl inputs">
          <thead><tr><th>{t('group')}</th><th>{t('variables')}</th><th>{t('source')}</th></tr></thead>
          <tbody>{INPUTS.map((r) => (
            <tr key={r.g}><td><b>{t(`grp_${r.g}` as Key)}</b></td><td>{t(`in_${r.g}` as Key)}</td><td>{r.src} {r.nasa && <Tag kind="info">NASA</Tag>}</td></tr>
          ))}</tbody>
        </table>
        <p className="note">{t('m_inputs_note')}</p>
      </Card>
    </>
  )
}
