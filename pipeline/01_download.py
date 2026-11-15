"""Download the public NASA FIRMS country archive for Uruguay and department boundaries.

Sources
- NASA FIRMS country yearly summaries (no login):
  https://firms.modaps.eosdis.nasa.gov/country/
  MODIS Collection 6.1 (MCD14ML) 2000-2025, VIIRS S-NPP 375 m (VNP14IMGT) 2012-2025
- geoBoundaries gbOpen URY ADM1 (ODbL, OpenStreetMap contributors)

Code written with AI assistance (Claude), reviewed by the team.
"""
import json
import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "data_raw")
os.makedirs(RAW, exist_ok=True)
UA = {"User-Agent": "Mozilla/5.0 (research script)"}
BASE = "https://firms.modaps.eosdis.nasa.gov/data/country"


def fetch(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return "cached"
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r, open(dest, "wb") as f:
        f.write(r.read())
    return f"{os.path.getsize(dest)} bytes"


jobs = [("modis", y) for y in range(2000, 2026)] + [("viirs-snpp", y) for y in range(2012, 2026)]
for sensor, year in jobs:
    name = f"{sensor}_{year}_Uruguay.csv"
    try:
        print(name, fetch(f"{BASE}/{sensor}/{year}/{name}", os.path.join(RAW, name)))
    except Exception as e:  # noqa: BLE001
        print(name, "FAILED", e, file=sys.stderr)

meta_path = os.path.join(RAW, "geoboundaries_meta.json")
print("meta", fetch("https://www.geoboundaries.org/api/current/gbOpen/URY/ADM1/", meta_path))
meta = json.load(open(meta_path, encoding="utf-8"))
print("adm1", fetch(meta["simplifiedGeometryGeoJSON"], os.path.join(RAW, "ury_adm1.geojson")))
