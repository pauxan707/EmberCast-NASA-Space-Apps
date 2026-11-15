"""Download the public NASA FIRMS country archive and zone boundaries for a region.

Usage: python pipeline/01_download.py [uy|ca]

Sources
- NASA FIRMS country yearly summaries (no login):
  https://firms.modaps.eosdis.nasa.gov/country/
  MODIS Collection 6.1 (MCD14ML) 2000-2025, VIIRS S-NPP 375 m (VNP14IMGT) 2012-2025
- Uruguay: geoBoundaries gbOpen URY ADM1 (ODbL, OpenStreetMap contributors)
- California: the United_States country files are streamed and filtered to the California
  bounding box while downloading (only the filtered rows are stored); 58 county boundaries from
  the US Census Bureau TIGERweb service (public domain, US Government work).

Code written with AI assistance (Claude), reviewed by the team.
"""
import json
import os
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor

from regions import RAW, get_region

R = get_region()
os.makedirs(R["raw_dir"], exist_ok=True)
UA = {"User-Agent": "Mozilla/5.0 (research script)"}
BASE = "https://firms.modaps.eosdis.nasa.gov/data/country"
LAT0, LAT1, LON0, LON1 = R["bbox"]


def fetch(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return "cached"
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r, open(dest, "wb") as f:
        f.write(r.read())
    return f"{os.path.getsize(dest)} bytes"


def fetch_bbox(url, dest):
    """Stream a big country CSV and keep only the rows inside the region bounding box."""
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return "cached"
    req = urllib.request.Request(url, headers=UA)
    total = kept = 0
    tmp = dest + ".part"
    with urllib.request.urlopen(req, timeout=300) as r, open(tmp, "wb") as f:
        f.write(r.readline())  # header: latitude,longitude,...
        for line in r:
            total += 1
            a = line.split(b",", 2)
            try:
                lat, lon = float(a[0]), float(a[1])
            except ValueError:
                continue
            if LAT0 <= lat <= LAT1 and LON0 <= lon <= LON1:
                f.write(line)
                kept += 1
    os.replace(tmp, dest)
    return f"{total} rows read, {kept} kept in bbox"


def job(sensor, year):
    src = f"{sensor}_{year}_{R['country']}.csv"
    dest = os.path.join(R["raw_dir"], f"{sensor}_{year}{R['csv_suffix']}")
    url = f"{BASE}/{sensor}/{year}/{src}"
    for attempt in range(3):
        try:
            return src, (fetch_bbox if R["clip_to_zones"] else fetch)(url, dest)
        except Exception as e:  # noqa: BLE001
            err = e
    return src, f"FAILED {err}"


jobs = [("modis", y) for y in range(2000, 2026)] + [("viirs-snpp", y) for y in range(2012, 2026)]
with ThreadPoolExecutor(8) as ex:
    for name, msg in ex.map(lambda j: job(*j), jobs):
        print(name, msg, file=sys.stderr if msg.startswith("FAILED") else sys.stdout, flush=True)

if R["key"] == "uy":
    meta_path = os.path.join(RAW, "geoboundaries_meta.json")
    print("meta", fetch("https://www.geoboundaries.org/api/current/gbOpen/URY/ADM1/", meta_path))
    meta = json.load(open(meta_path, encoding="utf-8"))
    print("adm1", fetch(meta["simplifiedGeometryGeoJSON"], os.path.join(RAW, "ury_adm1.geojson")))
elif R["key"] == "ca":
    url = ("https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1/query"
           "?where=STATE%3D%2706%27&outFields=NAME,BASENAME,GEOID&outSR=4326&maxAllowableOffset=0.003"
           "&geometryPrecision=4&f=geojson")
    print("counties", fetch(url, os.path.join(RAW, R["boundary"])))
