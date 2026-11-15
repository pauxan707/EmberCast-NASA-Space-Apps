// Single place to rename the project.
export const PROJECT_NAME = 'EmberCast'
export const PROJECT_TAGLINE = {
  en: 'From 25 years of satellite hot spots to a 7-day fire outlook.',
  es: 'De 25 años de focos satelitales a un parte de riesgo a 7 días.',
}
export const CHALLENGE = 'Harmonization of MODIS and VIIRS Hot Spots'
export const REPO_URL = 'https://github.com/pauxan707/EmberCast-NASA-Space-Apps'
// Regions the demo can show. Data for each one lives in public/data/<key>/ (see pipeline/regions.py).
// replay: date the demo opens on (must be one of the weekly issue dates in that region's model.json).
// counties: the zones are counties, so the copy says "county" instead of "department".
// zones: default "my zones"; stops: default planner route; globe: [lon, lat] of the landing-globe marker.
export type RegionKey = 'uy' | 'ca'
export interface RegionCfg { name: string; counties?: boolean; replay: string; zones: string[]; stops: string[]; globe: [number, number] }
export const REGIONS: Record<RegionKey, RegionCfg> = {
  uy: {
    name: 'Uruguay', replay: '2025-08-24',
    zones: ['UY-PA', 'UY-RV', 'UY-TA', 'UY-RO', 'UY-MA', 'UY-CA'],
    stops: ['UY-MA', 'UY-RO', 'UY-TT'], globe: [-56, -32.8],
  },
  ca: {
    name: 'California', counties: true, replay: '2025-09-07',
    // Los Angeles, San Diego, Butte, Shasta, Sonoma, Fresno
    zones: ['CA-06037', 'CA-06073', 'CA-06007', 'CA-06089', 'CA-06097', 'CA-06019'],
    // Sonoma, Mariposa (Yosemite), Los Angeles
    stops: ['CA-06097', 'CA-06043', 'CA-06037'], globe: [-119.5, 37.2],
  },
}
export const REGION_KEYS = Object.keys(REGIONS) as RegionKey[]
export const DEFAULT_REGION: RegionKey = 'uy'
