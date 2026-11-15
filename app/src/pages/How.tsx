import type { Key } from '../i18n'
import { fmtNum, HowNav, Illus, Tag, useApp } from '../ui'

export default function How() {
  const { db, t, lang } = useApp()
  const ho = db.meta.holdout
  return (
    <>
      <HowNav on="how" />
      <div className="sec-h">
        <div><h2>{t('how_title')}</h2><p>{t('hero_lead')}</p></div>
      </div>

      <ol className="flow">
        {(['flow_1', 'flow_2', 'flow_3', 'flow_4'] as Key[]).map((k, i) => (
          <li key={k}>
            <span>{String(i + 1).padStart(2, '0')}</span>
            <h3>{t(k)}</h3>
            <p>{t((k + '_d') as Key)}</p>
          </li>
        ))}
      </ol>

      <div className="kpis">
        <div><b>25</b><span>{t('kpi_years')}</span></div>
        <div><b>{fmtNum(ho.annualMAPEraw, lang)}% → {fmtNum(ho.annualMAPE, lang)}%</b><span>{t('kpi_error')}</span></div>
        <div><b>r = {fmtNum(ho.monthlyR, lang, 2)}</b><span>{t('kpi_r')}</span></div>
        <div><b>{fmtNum(db.meta.filters.modis.raw + db.meta.filters.viirs.raw, lang)}</b><span>{t('kpi_det')}</span></div>
      </div>

      <div className="doors">
        <a href="#/harmonization" className="door">
          <Tag kind="real">{t('real_data')}</Tag>
          <h3>{t('nav_harm')}</h3>
          <p>{t('hw_harm_d')}</p>
          <b>{t('hw_open')} →</b>
        </a>
        <a href="#/model" className="door">
          <Illus />
          <h3>{t('nav_model')}</h3>
          <p>{t('hw_model_d')}</p>
          <b>{t('hw_open')} →</b>
        </a>
        <a href="#/calendar" className="door">
          <Tag kind="real">{t('real_data')}</Tag>
          <h3>{t('nav_calendar')}</h3>
          <p>{t('hw_cal_d')}</p>
          <b>{t('hw_open')} →</b>
        </a>
      </div>
    </>
  )
}
