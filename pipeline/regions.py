"""Region configuration shared by the pipeline scripts.

Usage: python pipeline/03_harmonize.py [uy|ca]   (default: uy)

Each region says which FIRMS country archive to read, the bounding box of the 0.25 degree
grid (lat0, lat1, lon0, lon1; multiples of 0.25), the zone boundary file with its id/name
properties, and the output folder under app/public/data/.

Code written with AI assistance (Claude), reviewed by the team.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "data_raw")
WORK = os.path.join(HERE, "work")
DATA = os.path.join(HERE, "..", "app", "public", "data")

REGIONS = {
    "uy": {
        "key": "uy",
        "name": "Uruguay",
        "country": "Uruguay",            # FIRMS country file name
        "raw_dir": RAW,                   # where the yearly CSVs live
        "csv_suffix": "_Uruguay.csv",
        "bbox": (-35.25, -30.0, -58.5, -53.0),
        "boundary": "ury_adm1.geojson",   # geoBoundaries gbOpen URY ADM1 (ODbL)
        "id_prop": "shapeISO",
        "name_prop": "shapeName",
        "id_prefix": "",
        "clip_to_zones": False,           # the country file is already the region
        "recent_max": None,               # keep every 2024-2025 detection for the map
        "recent_decimals": 3,
        "view": (-58.55, -53.0, -35.05, -29.95, 32.6),  # map window lonW, lonE, latS, latN + latitude for the x scale
        "human_lat": -33.2,               # centre of the SIMULATED human-influence gradient
        "summer_doy": 15,                 # peak of the SIMULATED weather season (mid January)
        "work": os.path.join(WORK, "harmonized.npz"),
    },
    "ca": {
        "key": "ca",
        "name": "California",
        "country": "United_States",
        "raw_dir": os.path.join(RAW, "us_ca"),
        "csv_suffix": "_United_States_cabbox.csv",  # filtered to the bbox while downloading
        "bbox": (32.25, 42.25, -124.75, -114.0),
        "boundary": "ca_counties.geojson",  # US Census Bureau TIGERweb (public domain)
        "id_prop": "GEOID",
        "name_prop": "BASENAME",
        "id_prefix": "CA-",
        "clip_to_zones": True,            # drop Nevada / Oregon / Mexico / offshore points
        "recent_max": 60000,              # per sensor, thinned deterministically
        "recent_decimals": 2,
        "view": (-124.6, -113.95, 32.4, 42.15, 37.3),
        "human_lat": 36.0,
        "summer_doy": 205,                # late July
        "work": os.path.join(WORK, "harmonized_ca.npz"),
    },
}


def get_region():
    key = sys.argv[1] if len(sys.argv) > 1 else "uy"
    if key not in REGIONS:
        raise SystemExit(f"unknown region {key!r}; choose one of {sorted(REGIONS)}")
    r = REGIONS[key]
    r["out"] = os.path.join(DATA, key)
    os.makedirs(r["out"], exist_ok=True)
    os.makedirs(WORK, exist_ok=True)
    return r
