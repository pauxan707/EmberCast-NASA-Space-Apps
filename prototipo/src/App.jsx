import { useEffect, useState } from 'react'
import { LEVELS, getZones, getHeatmap, getForecast } from './api'

const iso = (n = 0) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
const TRAMO = { modelo: 'Modelo', pronostico: 'Pronóstico', climatologia: 'Lo habitual' }
const Badge = ({ level }) => <span className={`badge l${level}`}>{LEVELS[level].toUpperCase()}</span>

export default function App() {
  const [zones, setZones] = useState([])
  const [mapDate, setMapDate] = useState(iso())
  const [map, setMap] = useState(null)
  const [fc, setFc] = useState({ zoneId: 'paysandu-norte', from: iso(0), to: iso(7) })
  const [res, setRes] = useState(null)
  const [who, setWho] = useState('personas')
  const [sub, setSub] = useState(false)

  useEffect(() => { getZones().then(setZones) }, [])
  useEffect(() => { getHeatmap(mapDate).then(setMap) }, [mapDate])
  useEffect(() => { if (fc.to >= fc.from) getForecast(fc.zoneId, fc.from, fc.to).then(setRes) }, [fc])
  const set = (k) => (e) => setFc({ ...fc, [k]: e.target.value })

  return (
    <main>
      <section className="col">
        <h1>Mis zonas</h1>
        {zones.map((z) => (
          <article className="card" key={z.id}>
            <div className="row"><b>{z.name}</b><Badge level={z.level} /></div>
            <p>{z.reasons}</p>
            <small>Confianza: {z.confidence}</small>
          </article>
        ))}
        <small>Datos de ejemplo: el backend está simulado.</small>
      </section>

      <section className="col">
        <div className="row">
          <h2>Mapa de calor</h2>
          <label>Fecha<input type="date" value={mapDate} onChange={(e) => setMapDate(e.target.value)} /></label>
        </div>
        <div className="grid" style={{ gridTemplateColumns: `repeat(${map?.cols || 9}, 1fr)` }}>
          {map?.cells.map((l, i) => <i key={i} className={`l${l}`} title={`Riesgo ${LEVELS[l].toLowerCase()}`} />)}
        </div>
        <div className="legend">{LEVELS.map((n, i) => <span key={n}><i className={`sw l${i}`} />{n}</span>)}</div>
      </section>

      <section className="col panel">
        <h2>Pronóstico</h2>
        <label>Zona
          <select value={fc.zoneId} onChange={set('zoneId')}>{zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</select>
        </label>
        <div className="row2">
          <label>Desde<input type="date" value={fc.from} onChange={set('from')} /></label>
          <label>Hasta<input type="date" min={fc.from} value={fc.to} onChange={set('to')} /></label>
        </div>
        {res && fc.to >= fc.from && (
          <>
            <div className="result">
              <small>Riesgo en el período</small>
              <strong>{LEVELS[res.level].toUpperCase()}</strong>
              <div className="days">
                {res.days.map((d) => <div key={d.date} className={`day l${d.level}`}>{d.date.slice(8)}<small>{TRAMO[d.tramo]}</small></div>)}
              </div>
              {res.alternative && <p><b>Zona con menos riesgo en esas fechas:</b> {res.alternative.name} ({LEVELS[res.alternative.level].toLowerCase()}).</p>}
            </div>
            <div className="model">
              <div className="row"><b>Predicción del modelo</b><small>Confianza: {res.model.confidence}</small></div>
              <p>{res.model.headline}</p>
              <ul>{res.model.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
              <div className="tabs" role="group" aria-label="Recomendaciones para">
                <button className={who === 'personas' ? 'on' : ''} aria-pressed={who === 'personas'} onClick={() => setWho('personas')}>Personas</button>
                <button className={who === 'instituciones' ? 'on' : ''} aria-pressed={who === 'instituciones'} onClick={() => setWho('instituciones')}>Instituciones</button>
              </div>
              <p><b>Qué hacer:</b> {res.model.advice[who]}</p>
              <small>Modelo entrenado sobre el registro armonizado de MODIS y VIIRS. En este prototipo la predicción es simulada.</small>
            </div>
          </>
        )}
        <button className="sub" onClick={() => setSub(!sub)}>{sub ? 'Aviso activado (demo)' : 'Avisarme cuando el riesgo sea alto'}</button>
      </section>
    </main>
  )
}
