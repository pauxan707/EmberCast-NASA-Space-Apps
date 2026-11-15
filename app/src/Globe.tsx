import { useEffect, useRef, useState } from 'react'
import { REGION_KEYS, REGIONS } from './config'
import { fmtDate, useApp } from './ui'

interface GlobeData { from: string; to: string; n: number; fires: number[]; land: number[][][] }
const RAD = Math.PI / 180
const FIRE = ['#c2401c', '#ee7a26', '#fbb21e', '#fff3a6']
const PHI0 = -14 * RAD // tilt: look slightly from the south

/** Orthographic globe with one week of real MODIS detections worldwide. Drag to turn. */
export default function Globe() {
  const { t, lang, region } = useApp()
  const ref = useRef<HTMLCanvasElement>(null)
  const [meta, setMeta] = useState<GlobeData | null>(null)

  useEffect(() => {
    let alive = true
    fetch(import.meta.env.BASE_URL + 'data/globe.json').then((r) => r.json()).then((d: GlobeData) => { if (alive) setMeta(d) }).catch(() => { /* decorative */ })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    const c = ref.current
    if (!c || !meta) return
    const S = 560, dpr = Math.min(2, window.devicePixelRatio || 1)
    c.width = c.height = S * dpr
    const g = c.getContext('2d')!
    g.scale(dpr, dpr)
    const R = S / 2 - 16, cx = S / 2, cy = S / 2
    const sin0 = Math.sin(PHI0), cos0 = Math.cos(PHI0)
    // returns [x, y, visibility]; hidden points are pushed to the rim so land fills stay clean
    const proj = (lon: number, lat: number, l0: number): [number, number, number] => {
      const l = (lon - l0) * RAD, p = lat * RAD
      const cp = Math.cos(p), sp = Math.sin(p), cl = Math.cos(l)
      const vis = sin0 * sp + cos0 * cp * cl
      let x = cp * Math.sin(l), y = cos0 * sp - sin0 * cp * cl
      if (vis < 0) { const k = Math.hypot(x, y) || 1; x /= k; y /= k }
      return [cx + R * x, cy - R * y, vis]
    }
    const label = t('l_globe_pilot')
    const draw = (l0: number) => {
      g.clearRect(0, 0, S, S)
      const sph = g.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R)
      sph.addColorStop(0, '#2b251f'); sph.addColorStop(1, '#191511')
      g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fillStyle = sph; g.fill()
      g.save(); g.beginPath(); g.arc(cx, cy, R, 0, 7); g.clip()
      // graticule
      g.strokeStyle = 'rgba(242,237,227,.07)'; g.lineWidth = 1
      for (let lon = -180; lon < 180; lon += 30) {
        g.beginPath(); let pen = false
        for (let lat = -90; lat <= 90; lat += 5) { const [x, y, v] = proj(lon, lat, l0); if (v > 0) { if (pen) g.lineTo(x, y); else g.moveTo(x, y); pen = true } else pen = false }
        g.stroke()
      }
      for (let lat = -60; lat <= 60; lat += 30) {
        g.beginPath(); let pen = false
        for (let lon = -180; lon <= 180; lon += 5) { const [x, y, v] = proj(lon, lat, l0); if (v > 0) { if (pen) g.lineTo(x, y); else g.moveTo(x, y); pen = true } else pen = false }
        g.stroke()
      }
      // land
      g.fillStyle = '#3a322a'; g.strokeStyle = 'rgba(242,237,227,.22)'; g.lineWidth = 0.7
      for (const ring of meta.land) {
        let any = false
        g.beginPath()
        for (let i = 0; i < ring.length; i++) {
          const [x, y, v] = proj(ring[i][0], ring[i][1], l0)
          if (v > 0) any = true
          if (i) g.lineTo(x, y); else g.moveTo(x, y)
        }
        if (any) { g.closePath(); g.fill(); g.stroke() }
      }
      // fires
      g.globalCompositeOperation = 'lighter'
      const f = meta.fires
      for (let i = 0; i < f.length; i += 3) {
        const [x, y, v] = proj(f[i], f[i + 1], l0)
        if (v <= 0.03) continue
        const lv = f[i + 2]
        g.globalAlpha = Math.min(1, 0.35 + v) * (0.55 + lv * 0.15)
        g.fillStyle = FIRE[lv]
        const r = 0.9 + lv * 0.45
        g.beginPath(); g.arc(x, y, r, 0, 7); g.fill()
      }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'
      g.restore()
      // rim
      g.beginPath(); g.arc(cx, cy, R, 0, 7); g.strokeStyle = 'rgba(242,237,227,.35)'; g.lineWidth = 1; g.stroke()
      // pilot markers: the region on screen gets the "pilot" label, the others just their name
      for (const k of REGION_KEYS) {
        const [px, py, pv] = proj(REGIONS[k].globe[0], REGIONS[k].globe[1], l0)
        if (pv <= 0.15) continue
        g.strokeStyle = '#f2ede3'; g.lineWidth = 1.2
        g.beginPath(); g.arc(px, py, 9, 0, 7); g.stroke()
        g.beginPath(); g.moveTo(px + 9, py); g.lineTo(px + 34, py); g.stroke()
        g.fillStyle = '#f2ede3'; g.font = "500 11px 'IBM Plex Mono', monospace"; g.textBaseline = 'middle'
        g.fillText(k === region ? label : REGIONS[k].name, px + 39, py)
      }
    }

    let l0 = -38, raf = 0, last = 0, drag = false, lx = 0
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const tick = (ts: number) => {
      if (!drag && !still && last) l0 += ((ts - last) / 1000) * 3.2
      last = ts
      draw(l0)
      raf = requestAnimationFrame(tick)
    }
    draw(l0)
    raf = requestAnimationFrame(tick)
    const down = (e: PointerEvent) => { drag = true; lx = e.clientX; c.setPointerCapture(e.pointerId) }
    const move = (e: PointerEvent) => { if (!drag) return; l0 -= (e.clientX - lx) * 0.35; lx = e.clientX; if (still) draw(l0) }
    const up = () => { drag = false }
    c.addEventListener('pointerdown', down); c.addEventListener('pointermove', move); c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up)
    return () => { cancelAnimationFrame(raf); c.removeEventListener('pointerdown', down); c.removeEventListener('pointermove', move); c.removeEventListener('pointerup', up); c.removeEventListener('pointercancel', up) }
  }, [meta, t, region])

  return (
    <figure className="globe">
      <canvas ref={ref} aria-label={t('l_globe_alt')} />
      {meta && <figcaption>{t('l_globe_cap', { n: meta.n.toLocaleString(lang === 'en' ? 'en-US' : 'es-UY'), from: fmtDate(meta.from, lang, { day: 'numeric', month: 'short' }), to: fmtDate(meta.to, lang) })}</figcaption>}
    </figure>
  )
}
