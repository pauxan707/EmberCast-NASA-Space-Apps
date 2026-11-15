import { useState } from 'react'
import { PROJECT_NAME } from '../config'
import { activityRatio, confidence, reasons } from '../data'
import type { Key } from '../i18n'
import { Card, fmtDate, fmtNum, LEVELS, RiskBadge, Tag, useApp, UyMap } from '../ui'
import { reasonText } from './Home'

export default function Alerts() {
  const { db, t, lang, week, myZones, setMyZones } = useApp()
  const [zones, setZones] = useState(myZones)
  const [thr, setThr] = useState(2)
  const [chan, setChan] = useState<'email' | 'whatsapp' | 'telegram'>('whatsapp')
  const [saved, setSaved] = useState(false)
  const wk = db.model.weeks[week]
  const toggle = (id: string) => { setSaved(false); setZones((z) => (z.includes(id) ? z.filter((x) => x !== id) : [...z, id])) }
  const picked = db.depts.filter((d) => zones.includes(d.id)).sort((a, b) => wk.zones[b.idx].score - wk.zones[a.idx].score)
  const firing = picked.filter((d) => wk.zones[d.idx].level >= thr)
  const ex = firing[0] ?? picked[0]
  const z = ex ? wk.zones[ex.idx] : null
  return (
    <>
      <div className="sec-h">
        <div><h2>{t('al_title')}</h2><p>{t('al_sub')}</p></div>
        <Tag kind="sim">{t('al_demo')}</Tag>
      </div>
      <div className="map-grid">
        <Card title={'1 · ' + t('al_zones')} className="map-card">
          <UyMap labels onPick={(i) => toggle(db.depts[i].id)} selected={db.depts.filter((d) => zones.includes(d.id)).map((d) => d.idx)}
            fill={(i) => (zones.includes(db.depts[i].id) ? LEVELS[wk.zones[i].level].color + 'aa' : undefined)} />
          <p className="note">{t('al_zones_d', { n: zones.length })}</p>
        </Card>
        <div className="map-side">
          <Card title={'2 · ' + t('al_thr')}>
            <div className="thr">
              {LEVELS.map((_, i) => <button key={i} className={thr === i ? 'on' : ''} onClick={() => { setThr(i); setSaved(false) }}><RiskBadge level={i} /></button>)}
            </div>
            <p className="note">{t('al_thr_d', { n: firing.length, total: picked.length })}</p>
          </Card>
          <Card title={'3 · ' + t('al_chan')}>
            <div className="seg full">
              {(['whatsapp', 'email', 'telegram'] as const).map((c) => <button key={c} className={chan === c ? 'on' : ''} onClick={() => setChan(c)}>{c === 'email' ? 'Email' : c === 'whatsapp' ? 'WhatsApp' : 'Telegram'}</button>)}
            </div>
            <button className="primary wide" onClick={() => { setMyZones(zones); setSaved(true) }}>{saved ? '✓ ' + t('al_saved') : t('al_save')}</button>
            <p className="note">{t('al_nosend')}</p>
          </Card>
          {z && ex && (
            <Card title={t('al_preview')}>
              <div className={'msg ' + chan}>
                <div className="msg-h"><b>{PROJECT_NAME}</b><span>{fmtDate(wk.date, lang)}</span></div>
                <p><b>{ex.name} · {t('rep_headline', { level: t(`lvl_${LEVELS[z.level].key}` as Key).toUpperCase() })}</b></p>
                <p>{t('msg_act', { ratio: fmtNum(activityRatio(z), lang, 1) })}</p>
                <p>{t('msg_why')} {reasons(db, z).filter((r) => r.v > 0).slice(0, 3).map((r) => reasonText(t, r.g, r.v, z, lang).replace(/\.$/, '').toLowerCase()).join('; ')}.</p>
                <p>{t('confidence')}: {t(`conf_${confidence(z)}` as Key)}.</p>
                <a href={'#/report/' + ex.id}>{t('msg_link')} →</a>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
