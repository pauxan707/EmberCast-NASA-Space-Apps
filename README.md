# EmberCast

**From 25 years of satellite hot spots to a 7-day fire outlook.**

NASA Space Apps Challenge 2026 · Challenge: *Harmonization of MODIS and VIIRS Hot Spots* · Team **EmberCast** (Montevideo, Uruguay)

**Live demo:** https://pauxan707.github.io/NASA-Space-Apps-Challenge---Harmonization-of-MODIS-and-VIIRS-Hot-Spots/

MODIS and VIIRS have tracked active fires for more than two decades, but their records cannot be compared directly. EmberCast harmonizes them into one burn-activity calendar and, on top of that record, delivers a risk report per zone: already interpreted, always verifiable.

## What is real and what is illustrative

| Part | Status |
|---|---|
| Fire record (MODIS 2000–2025, VIIRS S-NPP 2012–2025, Uruguay) | **Real NASA FIRMS data**, downloaded from the public country archive |
| Harmonization (factors, uncertainty band, hold-out validation, same-fire example) | **Real**, computed by `pipeline/03_harmonize.py` |
| Burn calendar, anomalies, critical period, CSV export, "what happened next" | **Real**, derived from the harmonized record |
| 7-day risk levels, their reasons, model metrics, feature weights | **Illustrative**: generated with a fixed seed on top of the real record (`pipeline/04_simulated_risk.py`). It only uses information available on the issue date (season and past activity), never what happened afterwards. The trained model is the next step |
| Cloud "blind days" | **Illustrative** |
| Alerts | Demo only: nothing is sent, no contact data is requested |

The app shows a permanent ribbon and per-card tags ("Real NASA data" / "Illustrative") so the two are never confused.

## Harmonization in four steps

1. **Common schema.** Both sensors into the same columns; confidence on one scale; low-confidence detections and non-vegetation sources dropped.
2. **Common grid and day.** We count *active 1-km cells per day*, not detections. A detection is an observation, not a fire, and the two sensors' counts are never added.
3. **Calibration on the shared years (2012–2025).** Per department we measure how much more activity VIIRS registers than MODIS, shrinking noisy departments toward the national factor. A separate factor covers the Terra-only months before Aqua.
4. **Output.** A daily activity index per zone in "VIIRS-equivalent active cells", flagged with the sensors that observed it and an uncertainty band before 2012.

Measured on real data (factor fitted on 2012–2018, checked on 2019–2025, which the fit never saw):

- annual cross-sensor error drops from **62% to 14%**
- monthly correlation between harmonized MODIS and VIIRS: **r = 0.98**
- national factor ×2.40, year-to-year spread ±15%

Known limits: it cannot recover small fires MODIS never saw (it estimates them on average), it does not correct overpass times, 2000–2002 is Terra-only and less reliable, and this pilot covers Uruguay with VIIRS S-NPP only.

## What the app does

- **Landing**: what it is and who it is for (prevent, plan, respond), with a globe of real MODIS detections worldwide from the last 7 days and the real 25-year burn calendar.
- **Zones**: reports sorted by risk; the dashboard is the answer, not a map.
- **Report**: level, why, activity vs 25 years, confidence, what to do, links to evidence.
- **Map**: risk grid, real MODIS / VIIRS detections, harmonized activity, and a "reveal what happened next" replay.
- **Burn calendar**: month and day views 2001–2025, anomalies, critical period, CSV download.
- **Planner**: plan a trip, event, field/industrial work or prescribed burn; get a verdict, safer dates and safer places.
- **How it works**: overview, plus **Harmonization** (interactive before/after, a real fire seen by both sensors, validation) and **Risk model** (design, inputs and references; illustrative numbers).
- **Alerts**: subscription flow with a sample message.
- English / Spanish, responsive, guided 1-minute tour.

The demo **replays the FIRMS archive**: pick any week of 2024–2025 in the header and every screen shows what would have been issued that day.

## Run it

```bash
cd app
npm install
npm run dev      # local dev server
npm run build    # static site in app/dist
```

Rebuild the data (Python 3.10+, `numpy`):

```bash
python pipeline/01_download.py        # FIRMS country archive + department boundaries
python pipeline/03_harmonize.py       # harmonization -> app/public/data/harmonized.json
python pipeline/04_simulated_risk.py  # illustrative risk layer -> app/public/data/model.json
python pipeline/05_globe.py           # landing globe: world outline + global MODIS, last 7 days
```

The project name lives in one place: `app/src/config.ts`. All UI copy is in `app/src/i18n.ts`.

## Deploy

The site is fully static (`app/dist`, relative paths). GitHub Pages currently serves the repository root of `main`, so the built site (`index.html`, `assets/`, `data/`, `favicon.svg`) is committed there; after `npm run build`, copy `app/dist/*` to the root. The same build is also on the `gh-pages` branch: if Pages is switched to that branch, the root copies can be removed.

Custom domain (GoDaddy or any registrar): in the repository go to *Settings → Pages → Custom domain* and enter the domain; at the registrar add a `CNAME` record for `www` pointing to `pauxan707.github.io`, and for the apex domain four `A` records to `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`. Then tick *Enforce HTTPS*.

## Data and resources

**NASA**
- [FIRMS](https://firms.modaps.eosdis.nasa.gov/country/) active fire archive: MODIS Collection 6.1 (MCD14ML, Terra and Aqua) and VIIRS S-NPP 375 m (VNP14IMGT). Used: all detections over Uruguay, Nov 2000 – Dec 2025.

**Planned for the real risk model (not loaded in this demo):** NASA POWER (weather), MODIS/VIIRS NDVI and land cover, SMAP soil moisture, Black Marble night lights, GPW population, OpenStreetMap roads and towns.

**Other**
- [FIRMS active fire text files](https://firms.modaps.eosdis.nasa.gov/active_fire/): MODIS C6.1 global detections of the last 7 days, shown on the landing-page globe (snapshot taken 15 Nov 2026).
- World land outline: [Natural Earth](https://www.naturalearthdata.com/) 1:110m (public domain).
- Department boundaries: [geoBoundaries](https://www.geoboundaries.org/) gbOpen URY ADM1 (ODbL, © OpenStreetMap contributors).
- Fonts: Fraunces, IBM Plex Sans, IBM Plex Mono (SIL Open Font License), via Google Fonts.
- Software: React, Vite, TypeScript, Python, NumPy.

## Use of AI

AI tools (Claude, by Anthropic) were used to write and review code for the web app and the data pipeline, and to help edit texts. The idea, the harmonization approach and the product concept are the team's. No AI-generated images, video or audio are used. Source files written with AI assistance say so in their header.

## Disclaimer

Risk means probability of satellite-detectable fire activity in a ~25 km cell. EmberCast is not a real-time alert system and does not replace official warnings. Not endorsed by NASA.
