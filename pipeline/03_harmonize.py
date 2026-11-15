"""Harmonize MODIS and VIIRS active-fire detections for one region (real NASA FIRMS data).

Usage: python pipeline/03_harmonize.py [uy|ca]   (regions are defined in regions.py)

Four steps (see README):
 1. Common schema + quality filter (vegetation fires only, low-confidence dropped).
 2. Common grid and day: count *active 1-km cells per day*, not detections.
 3. Calibration on the shared period (2012-2025): VIIRS/MODIS active-cell ratio per department,
    shrunk towards the national ratio; dispersion gives the uncertainty band.
 4. Output: harmonized daily activity index in "VIIRS-equivalent active cells".

Also runs a temporal hold-out (fit 2012-2018, check 2019-2025) so the calibration is validated.

Code written with AI assistance (Claude), reviewed by the team.
"""
import csv
import datetime as dt
import glob
import json
import os

import numpy as np

from regions import RAW as RAW_ROOT, get_region

R = get_region()
RAW = R["raw_dir"]
OUT = R["out"]

D0 = dt.date(2000, 11, 1)
D1 = dt.date(2025, 12, 31)
ND = (D1 - D0).days + 1
VIIRS_START = (dt.date(2012, 1, 20) - D0).days
AQUA_START = (dt.date(2002, 7, 4) - D0).days
FINE = 0.01  # ~1 km cell used to count "active cells"
COARSE = 0.25  # ~25 km cell used for maps and the risk model
LAT0, LAT1, LON0, LON1 = R["bbox"]
NLAT = int(round((LAT1 - LAT0) / COARSE))
NLON = int(round((LON1 - LON0) / COARSE))

dates = [D0 + dt.timedelta(days=i) for i in range(ND)]
year_of = np.array([d.year for d in dates])
month_of = np.array([d.month for d in dates])


# ---------------------------------------------------------------- step 1: common schema
def load(pattern, sensor):
    rows = []
    stats = {"raw": 0, "kept": 0, "low_conf": 0, "non_veg": 0}
    for path in sorted(glob.glob(os.path.join(RAW, pattern))):
        with open(path, newline="") as f:
            for r in csv.DictReader(f):
                stats["raw"] += 1
                if r.get("type", "0") not in ("0", ""):
                    stats["non_veg"] += 1
                    continue
                c = r["confidence"]
                if sensor == "MODIS":
                    conf = int(float(c))
                    if conf < 30:
                        stats["low_conf"] += 1
                        continue
                    conf_cls = 1 if conf < 80 else 2
                    sat = 0 if r["satellite"] == "Terra" else 1
                else:
                    if c == "l":
                        stats["low_conf"] += 1
                        continue
                    conf_cls = 1 if c == "n" else 2
                    sat = 2
                y, m, d = r["acq_date"].split("-")
                day = (dt.date(int(y), int(m), int(d)) - D0).days
                if day < 0 or day >= ND:
                    continue
                stats["kept"] += 1
                rows.append((day, float(r["latitude"]), float(r["longitude"]), sat, conf_cls,
                             float(r["frp"] or 0), float(r["scan"]), float(r["track"]), int(r["acq_time"]),
                             1 if r["daynight"] == "D" else 0))
    return np.array(rows, dtype=np.float64), stats


modis, st_m = load("modis_*" + R["csv_suffix"], "MODIS")
viirs, st_v = load("viirs-snpp_*" + R["csv_suffix"], "VIIRS")
print("MODIS", st_m, "VIIRS", st_v)


# ---------------------------------------------------------------- geography
def rings_of(geom):
    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    return [np.array(ring) for poly in polys for ring in poly]


def pip(lon, lat, rings):
    inside = np.zeros(lon.shape, dtype=bool)
    for ring in rings:
        x, y = ring[:, 0], ring[:, 1]
        x2, y2 = np.roll(x, -1), np.roll(y, -1)
        for i in range(len(x)):
            if y[i] == y2[i]:
                continue
            cond = (y[i] > lat) != (y2[i] > lat)
            if not cond.any():
                continue
            xin = (x2[i] - x[i]) * (lat - y[i]) / (y2[i] - y[i]) + x[i]
            inside ^= cond & (lon < xin)
    return inside


geo = json.load(open(os.path.join(RAW_ROOT, R["boundary"]), encoding="utf-8"))
feats = sorted(geo["features"], key=lambda f: f["properties"][R["name_prop"]])
dept_names = [f["properties"][R["name_prop"]] for f in feats]
dept_ids = [R["id_prefix"] + f["properties"][R["id_prop"]] for f in feats]
dept_rings = [rings_of(f["geometry"]) for f in feats]
NDEP = len(feats)

# department lookup on a 0.05 deg lattice
LK = 0.05
lk_nlat = int(round((LAT1 - LAT0) / LK))
lk_nlon = int(round((LON1 - LON0) / LK))
glat = LAT0 + (np.arange(lk_nlat) + 0.5) * LK
glon = LON0 + (np.arange(lk_nlon) + 0.5) * LK
LON, LATG = np.meshgrid(glon, glat)
lookup = np.full(LON.shape, -1, dtype=np.int16)
for di, rings in enumerate(dept_rings):
    # only test the lattice block inside the zone's bounding box (same result, much faster)
    allpts = np.concatenate(rings)
    i0 = max(0, int((allpts[:, 1].min() - LAT0) / LK) - 1)
    i1 = min(lk_nlat, int((allpts[:, 1].max() - LAT0) / LK) + 2)
    j0 = max(0, int((allpts[:, 0].min() - LON0) / LK) - 1)
    j1 = min(lk_nlon, int((allpts[:, 0].max() - LON0) / LK) + 2)
    if i1 <= i0 or j1 <= j0:
        continue
    blk = lookup[i0:i1, j0:j1]
    blk[pip(LON[i0:i1, j0:j1], LATG[i0:i1, j0:j1], rings)] = di


def dept_of(lat, lon):
    i = np.clip(((lat - LAT0) / LK).astype(int), 0, lk_nlat - 1)
    j = np.clip(((lon - LON0) / LK).astype(int), 0, lk_nlon - 1)
    return lookup[i, j]


def coarse_of(lat, lon):
    i = ((lat - LAT0) / COARSE).astype(int)
    j = ((lon - LON0) / COARSE).astype(int)
    ok = (i >= 0) & (i < NLAT) & (j >= 0) & (j < NLON)
    return np.where(ok, i * NLON + j, -1)


if R["clip_to_zones"]:
    # the country file covers more than the region: keep only detections inside a zone polygon
    def clip(rows, st):
        inb = (rows[:, 1] >= LAT0) & (rows[:, 1] < LAT1) & (rows[:, 2] >= LON0) & (rows[:, 2] < LON1)
        keep = inb & (dept_of(rows[:, 1], rows[:, 2]) >= 0)
        st["bbox_kept"] = st["kept"]
        st["kept"] = int(keep.sum())
        return rows[keep]

    modis, viirs = clip(modis, st_m), clip(viirs, st_v)
    print("clipped to zones: MODIS", st_m, "VIIRS", st_v)

# coarse cells whose centre is inside the region
clat = LAT0 + (np.arange(NLAT) + 0.5) * COARSE
clon = LON0 + (np.arange(NLON) + 0.5) * COARSE
CLON, CLAT = np.meshgrid(clon, clat)
cell_dept_full = dept_of(CLAT.ravel(), CLON.ravel())
cell_ids = np.where(cell_dept_full >= 0)[0]
cell_index = np.full(NLAT * NLON, -1, dtype=np.int32)
cell_index[cell_ids] = np.arange(len(cell_ids))
NC = len(cell_ids)
print("departments", NDEP, "coarse cells", NC)


# ---------------------------------------------------------------- step 2: active cells per day
def active_cells(rows):
    """Unique (day, 1-km cell) pairs -> daily counts per department, per coarse cell, national."""
    day = rows[:, 0].astype(np.int64)
    fi = np.floor(rows[:, 1] / FINE).astype(np.int64) + 100000
    fj = np.floor(rows[:, 2] / FINE).astype(np.int64) + 100000
    key = (day * 1_000_000 + fi) * 1_000_000 + fj
    _, first = np.unique(key, return_index=True)
    r = rows[first]
    day = r[:, 0].astype(np.int64)
    dep = dept_of(r[:, 1], r[:, 2])
    cc = coarse_of(r[:, 1], r[:, 2])
    ci = np.where(cc >= 0, cell_index[np.clip(cc, 0, None)], -1)
    nat = np.bincount(day, minlength=ND).astype(np.float32)
    by_dep = np.zeros((NDEP, ND), dtype=np.float32)
    ok = dep >= 0
    np.add.at(by_dep, (dep[ok], day[ok]), 1)
    by_cell = np.zeros((NC, ND), dtype=np.float32)
    ok = ci >= 0
    np.add.at(by_cell, (ci[ok], day[ok]), 1)
    return nat, by_dep, by_cell


M_nat, M_dep, M_cell = active_cells(modis)
T_nat, T_dep, T_cell = active_cells(modis[modis[:, 3] == 0])
V_nat, V_dep, V_cell = active_cells(viirs)
det_m = np.bincount(modis[:, 0].astype(int), minlength=ND)
det_v = np.bincount(viirs[:, 0].astype(int), minlength=ND)

# ---------------------------------------------------------------- step 3: calibration
ov = np.arange(ND) >= VIIRS_START
SHRINK = 200.0


def factors(mask, m_nat, m_dep):
    k_nat = V_nat[mask].sum() / m_nat[mask].sum()
    k_dep = (V_dep[:, mask].sum(1) + k_nat * SHRINK) / (m_dep[:, mask].sum(1) + SHRINK)
    return float(k_nat), k_dep


k_nat, k_dep = factors(ov, M_nat, M_dep)
kT_nat, kT_dep = factors(ov, T_nat, T_dep)
k_cell = k_dep[cell_dept_full[cell_ids]]
kT_cell = kT_dep[cell_dept_full[cell_ids]]

years_ov = list(range(2012, 2026))
ratios = []
for y in years_ov:
    mk = ov & (year_of == y)
    ratios.append(float(V_nat[mk].sum() / max(M_nat[mk].sum(), 1)))
sd_log_year = float(np.std(np.log(ratios), ddof=1))

# monthly dispersion at department level (months with enough signal)
logs = []
for y in years_ov:
    for mth in range(1, 13):
        mk = ov & (year_of == y) & (month_of == mth)
        mm, vv = M_dep[:, mk].sum(1), V_dep[:, mk].sum(1)
        good = (mm >= 5) & (vv > 0)
        logs += list(np.log(vv[good] / (k_dep[good] * mm[good])))
sd_log_month = float(np.std(logs))

# temporal hold-out: fit 2012-2018, check 2019-2025
fit = ov & (year_of <= 2018)
chk = year_of >= 2019
kf_nat, kf_dep = factors(fit, M_nat, M_dep)
pred_m, obs_m, pred_y, obs_y, raw_y = [], [], [], [], []
for y in range(2019, 2026):
    py = oy = ry = 0.0
    for mth in range(1, 13):
        mk = (year_of == y) & (month_of == mth)
        p = float((kf_dep[:, None] * M_dep[:, mk]).sum())
        o = float(V_dep[:, mk].sum())
        pred_m.append(p), obs_m.append(o)
        py += p
        oy += o
        ry += float(M_dep[:, mk].sum())
    pred_y.append(py), obs_y.append(oy), raw_y.append(ry)
pred_m, obs_m = np.array(pred_m), np.array(obs_m)
holdout = {
    "fitYears": "2012-2018",
    "checkYears": "2019-2025",
    "kFit": round(kf_nat, 3),
    "monthlyR": round(float(np.corrcoef(pred_m, obs_m)[0, 1]), 3),
    "annualMAPE": round(float(np.mean(np.abs(np.array(pred_y) - np.array(obs_y)) / np.array(obs_y))) * 100, 1),
    "annualMAPEraw": round(float(np.mean(np.abs(np.array(raw_y) - np.array(obs_y)) / np.array(obs_y))) * 100, 1),
    "totalBiasPct": round(float((pred_m.sum() - obs_m.sum()) / obs_m.sum()) * 100, 1),
    "years": list(range(2019, 2026)),
    "predY": [round(v) for v in pred_y],
    "obsY": [round(v) for v in obs_y],
    "rawY": [round(v) for v in raw_y],
}
print("k_nat", k_nat, "kT_nat", kT_nat, "sd_year", sd_log_year, "sd_month", sd_log_month)
print("holdout", holdout)
print("yearly ratios", [round(r, 2) for r in ratios])


# ---------------------------------------------------------------- step 4: harmonized index
def harmonize(v, m, t, k, kt):
    k = np.asarray(k).reshape(-1, 1) if np.ndim(k) else k
    kt = np.asarray(kt).reshape(-1, 1) if np.ndim(kt) else kt
    h = np.where(np.arange(ND) >= VIIRS_START, v, np.where(np.arange(ND) >= AQUA_START, k * m, kt * t))
    return h.astype(np.float32)


H_dep = harmonize(V_dep, M_dep, T_dep, k_dep, kT_dep)
H_cell = harmonize(V_cell, M_cell, T_cell, k_cell, kT_cell)
H_nat = H_dep.sum(0)

np.savez_compressed(
    R["work"],
    H_cell=H_cell, H_dep=H_dep, V_cell=V_cell, M_cell=M_cell,
    cell_ids=cell_ids, cell_dept=cell_dept_full[cell_ids],
    cell_lat=CLAT.ravel()[cell_ids], cell_lon=CLON.ravel()[cell_ids],
)

yearly = []
for y in range(2001, 2026):
    mk = year_of == y
    h = float(H_nat[mk].sum())
    pre = y < 2012
    yearly.append({
        "y": y,
        "modisDet": int(det_m[mk].sum()),
        "viirsDet": int(det_v[mk].sum()),
        "modisCells": int(M_nat[mk].sum()),
        "viirsCells": int(V_nat[mk].sum()),
        "harm": round(h),
        "lo": round(h * np.exp(-sd_log_year)) if pre else round(h),
        "hi": round(h * np.exp(sd_log_year)) if pre else round(h),
    })

depts = []
for di in range(NDEP):
    nz = np.where((M_dep[di] > 0) | (V_dep[di] > 0) | (T_dep[di] > 0))[0]
    sparse = [[int(i), int(M_dep[di, i]), int(V_dep[di, i]), int(T_dep[di, i])] for i in nz]
    depts.append({
        "id": dept_ids[di], "name": dept_names[di],
        "k": round(float(k_dep[di]), 3), "kT": round(float(kT_dep[di]), 3),
        "days": sparse,
    })

# a real example of the same fire seen by both sensors on the same day
best = None
vday = viirs[:, 0].astype(int)
mday = modis[:, 0].astype(int)
BOX = 0.08
vk = {}
for idx in range(len(viirs)):
    if viirs[idx, 9] != 1:
        continue
    key = (vday[idx], int(viirs[idx, 1] / BOX), int(viirs[idx, 2] / BOX))
    vk.setdefault(key, []).append(idx)
mk_ = {}
for idx in range(len(modis)):
    if modis[idx, 9] != 1 or modis[idx, 3] != 1 or mday[idx] < VIIRS_START:
        continue
    key = (mday[idx], int(modis[idx, 1] / BOX), int(modis[idx, 2] / BOX))
    mk_.setdefault(key, []).append(idx)
for key, mi in mk_.items():
    vi = vk.get(key)
    if not vi or not (2 <= len(mi) <= 3) or not (8 <= len(vi) <= 12):
        continue
    vlat, vlon = viirs[vi, 1], viirs[vi, 2]
    if vlat.max() - vlat.min() > 0.035 or vlon.max() - vlon.min() > 0.035:
        continue
    score = viirs[vi, 5].sum()
    if best is None or score > best[0]:
        best = (score, key, mi, vi)
example = None
if best:
    _, key, mi, vi = best
    pts = [{"s": "MODIS", "lat": round(modis[i, 1], 5), "lon": round(modis[i, 2], 5), "scan": modis[i, 6],
            "track": modis[i, 7], "frp": modis[i, 5], "time": int(modis[i, 8])} for i in mi]
    pts += [{"s": "VIIRS", "lat": round(viirs[i, 1], 5), "lon": round(viirs[i, 2], 5), "scan": viirs[i, 6],
             "track": viirs[i, 7], "frp": viirs[i, 5], "time": int(viirs[i, 8])} for i in vi]

    def ncell(a):
        return len({(int(np.floor(p["lat"] / FINE)), int(np.floor(p["lon"] / FINE))) for p in a})

    mp = [p for p in pts if p["s"] == "MODIS"]
    vp = [p for p in pts if p["s"] == "VIIRS"]
    dep = int(dept_of(np.array([vp[0]["lat"]]), np.array([vp[0]["lon"]]))[0])
    example = {
        "date": dates[key[0]].isoformat(), "dept": dept_names[dep] if dep >= 0 else R["name"],
        "points": pts, "modisDet": len(mp), "viirsDet": len(vp),
        "modisCells": ncell(mp), "viirsCells": ncell(vp),
        "k": round(float(k_dep[dep]) if dep >= 0 else k_nat, 2),
    }
    print("example", {k: v for k, v in example.items() if k != "points"})

# recent detections for the evidence map (2024-2025)
D_RECENT = (dt.date(2024, 1, 1) - D0).days


RECENT_STEP = {}


def recent(rows, sensor):
    """2024-2025 detections for the map; big regions are thinned (every n-th) and rounded to stay small."""
    r = rows[rows[:, 0] >= D_RECENT]
    nd = R["recent_decimals"]
    step = 1
    if R["recent_max"] and len(r) > R["recent_max"]:
        step = int(np.ceil(len(r) / R["recent_max"]))
        r = r[np.argsort(r[:, 0], kind="stable")][::step]
    RECENT_STEP[sensor] = step
    return [[int(a[0]), round(a[1], nd), round(a[2], nd), round(a[5], 1)] for a in r]


recent_out = {"modis": recent(modis, "modis"), "viirs": recent(viirs, "viirs")}


out = {
    "meta": {
        "start": D0.isoformat(), "end": D1.isoformat(), "nDays": ND,
        "viirsStart": VIIRS_START, "aquaStart": AQUA_START,
        "kNat": round(k_nat, 3), "kTNat": round(kT_nat, 3),
        "sdLogYear": round(sd_log_year, 3), "sdLogMonth": round(sd_log_month, 3),
        "filters": {"modis": st_m, "viirs": st_v},
        "holdout": holdout,
        "grid": {"lat0": LAT0, "lon0": LON0, "size": COARSE, "nLat": NLAT, "nLon": NLON},
        "region": {"key": R["key"], "name": R["name"], "zones": NDEP},
        "bbox": {"lat0": LAT0, "lat1": LAT1, "lon0": LON0, "lon1": LON1},
        "view": dict(zip(("lonW", "lonE", "latS", "latN", "kxLat"), R["view"])),
        "recentStep": RECENT_STEP,
    },
    "yearly": yearly,
    "ratios": [{"y": y, "r": round(r, 3)} for y, r in zip(years_ov, ratios)],
    "depts": depts,
    "example": example,
    "recent": recent_out,
}
json.dump(out, open(os.path.join(OUT, "harmonized.json"), "w"), separators=(",", ":"))


def rnd(c):
    return [rnd(x) for x in c] if isinstance(c[0], list) else [round(c[0], 3), round(c[1], 3)]


for f in feats:
    f["geometry"]["coordinates"] = rnd(f["geometry"]["coordinates"])
    f["properties"] = {"id": R["id_prefix"] + f["properties"][R["id_prop"]], "name": f["properties"][R["name_prop"]]}
json.dump({"type": "FeatureCollection", "features": feats},
          open(os.path.join(OUT, "departments.geojson"), "w", encoding="utf-8"), separators=(",", ":"), ensure_ascii=False)
print("yearly", [(r["y"], r["modisDet"], r["viirsDet"], r["harm"]) for r in yearly])
print("sizes", {f: os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT)})
