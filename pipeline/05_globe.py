"""Data for the landing-page globe: world land outline + real global MODIS detections (last 7 days).

Sources
- NASA FIRMS active fire text files (no login): MODIS C6.1 Global, last 7 days
  https://firms.modaps.eosdis.nasa.gov/active_fire/
- Natural Earth 1:110m land (public domain) https://www.naturalearthdata.com/

Code written with AI assistance (Claude), reviewed by the team.
"""
import csv
import io
import json
import os
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "data_raw")
OUT = os.path.join(HERE, "..", "app", "public", "data")
UA = {"User-Agent": "Mozilla/5.0 (research script)"}


def fetch(url, name):
    dest = os.path.join(RAW, name)
    if not os.path.exists(dest):
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180) as r:
            open(dest, "wb").write(r.read())
    return dest


fires_csv = fetch("https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_Global_7d.csv", "modis_global_7d.csv")
land_json = fetch("https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson", "ne_110m_land.geojson")

# one mark per 0.25 deg cell, keeping the strongest fire radiative power
cells, dates = {}, set()
with open(fires_csv, newline="") as f:
    for r in csv.DictReader(f):
        if int(float(r["confidence"])) < 30:
            continue
        dates.add(r["acq_date"])
        k = (round(float(r["longitude"]) * 4), round(float(r["latitude"]) * 4))
        cells[k] = max(cells.get(k, 0.0), float(r["frp"] or 0))
fires = []
for (x, y), frp in cells.items():
    lvl = 0 if frp < 15 else 1 if frp < 50 else 2 if frp < 150 else 3
    fires += [round(x / 4, 2), round(y / 4, 2), lvl]

land = []
for feat in json.load(open(land_json, encoding="utf-8"))["features"]:
    g = feat["geometry"]
    polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
    for poly in polys:
        ring = [[round(p[0], 1), round(p[1], 1)] for p in poly[0]]
        if len(ring) > 3:
            land.append(ring)

out = {"from": min(dates), "to": max(dates), "n": len(cells), "fires": fires, "land": land}
json.dump(out, open(os.path.join(OUT, "globe.json"), "w"), separators=(",", ":"))
print(out["from"], out["to"], "cells", len(cells), "rings", len(land), "bytes", os.path.getsize(os.path.join(OUT, "globe.json")))
