"""ILLUSTRATIVE risk layer for the demo (NOT a trained model).

The score only uses information available on the issue date (past fire activity and season);
it never looks at what happened afterwards, so the "what happened next" replay stays honest.

Builds a plausible 7-day risk score per 25-km cell from the real harmonized history plus
*simulated* weather and human-influence signals generated with a fixed seed. Every number
this script writes is flagged `"source": "simulated"` and is labelled "illustrative" in the UI.
The real model (LightGBM on harmonized history + NASA POWER weather) is future work.

Code written with AI assistance (Claude), reviewed by the team.
"""
import datetime as dt
import json
import os

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "app", "public", "data")
Z = np.load(os.path.join(HERE, "work", "harmonized.npz"))
H, V, Hdep = Z["H_cell"].astype(np.float64), Z["V_cell"].astype(np.float64), Z["H_dep"].astype(np.float64)
cell_dept, cell_lat, cell_lon, cell_ids = Z["cell_dept"], Z["cell_lat"], Z["cell_lon"], Z["cell_ids"]
NC, ND = H.shape
NDEP = Hdep.shape[0]
D0 = dt.date(2000, 11, 1)
dates = [D0 + dt.timedelta(days=i) for i in range(ND)]
NLON = json.load(open(os.path.join(OUT, "harmonized.json")))["meta"]["grid"]["nLon"]
rng = np.random.default_rng(20261115)


def csum(a):
    return np.concatenate([np.zeros((a.shape[0], 1)), np.cumsum(a, axis=1)], axis=1)


cH, cV, cHd = csum(H), csum(V), csum(Hdep)


def win(c, a, b):
    return c[:, b] - c[:, a]


pos = {int(c): i for i, c in enumerate(cell_ids)}
nbrs = []
for c in cell_ids:
    r, q = divmod(int(c), NLON)
    nbrs.append([pos[(r + dr) * NLON + q + dq] for dr in (-1, 0, 1) for dq in (-1, 0, 1)
                 if (dr or dq) and 0 <= q + dq < NLON and ((r + dr) * NLON + q + dq) in pos])

# real seasonal history: share of years (2001-2025) with activity in each week of the year
clim_week = np.zeros((NC, 52))
for w in range(52):
    hits, n = np.zeros(NC), 0
    for y in range(2001, 2026):
        a = (dt.date(y, 1, 1) - D0).days + w * 7
        if a >= 61 and a + 7 <= ND:
            hits += win(cH, a, a + 7) > 0
            n += 1
    clim_week[:, w] = hits / n
# smooth over neighbouring weeks
clim_s = (np.roll(clim_week, 1, 1) + clim_week * 2 + np.roll(clim_week, -1, 1)) / 4
FREQ_CUTS = [0.08, 0.18, 0.32]
clim_levels = ["".join(str(int(v)) for v in np.digitize(clim_s[c], FREQ_CUTS)) for c in range(NC)]

# simulated static human-influence field (smooth, higher towards the south coast)
human = 0.5 + 0.35 * np.tanh((-33.2 - cell_lat) * 1.2) + 0.15 * np.sin(cell_lon * 2.1 + cell_lat * 1.3)
human = np.clip(human + rng.normal(0, 0.05, NC), 0, 1)

GROUPS = ["season", "recent", "neighbors", "dryness", "heat", "humidity", "wind", "human"]
t0 = (dt.date(2024, 1, 7) - D0).days
issue = list(range(t0, ND - 7, 7))
# simulated weather per department: AR(1) processes
dry = np.zeros((len(issue), NDEP))
tmax = np.zeros_like(dry)
rh = np.zeros_like(dry)
wind = np.zeros_like(dry)
state = rng.normal(0, 1, NDEP)
for i, t in enumerate(issue):
    doy = dates[t].timetuple().tm_yday
    summer = np.cos(2 * np.pi * (doy - 15) / 365.25)  # +1 mid January
    state = 0.75 * state + 0.66 * (0.6 * rng.normal(0, 1) + 0.8 * rng.normal(0, 1, NDEP))
    dry[i] = np.clip(9 + 5 * summer + 7 * state, 0, 34).round()
    tmax[i] = (22 + 8 * summer + 1.8 * state + rng.normal(0, 1, NDEP)).round(1)
    rh[i] = np.clip(66 - 9 * summer - 6 * state + rng.normal(0, 3, NDEP), 30, 95).round()
    wind[i] = np.clip(4.2 + 1.3 * rng.normal(0, 1, NDEP) + 0.4 * state, 1, 11).round(1)

rows = []
for i, t in enumerate(issue):
    w = min(51, (dates[t].timetuple().tm_yday - 1) // 7)
    season = clim_s[:, w]
    a30 = win(cH, t - 30, t)
    a7 = win(cH, t - 7, t)
    nb = np.array([(a30[l].mean() + 2 * a7[l].mean()) if l else 0 for l in nbrs])
    d = cell_dept
    comp = np.column_stack([
        2.6 * (season - 0.12),
        0.8 * np.tanh(a30 / 4) + 0.8 * np.tanh(a7 / 2) - 0.12,
        0.95 * np.tanh(nb / 3) - 0.10,
        0.022 * (dry[i][d] - 10),
        0.018 * (tmax[i][d] - 24),
        -0.006 * (rh[i][d] - 62),
        0.025 * (wind[i][d] - 4.2),
        0.12 * (human - 0.5),
    ])
    rows.append(comp + rng.normal(0, 0.03, comp.shape))
comp_all = np.array(rows)  # [week, cell, group]
score = 1 / (1 + np.exp(-(comp_all.sum(2) * 2.2 - 1.2)))
cuts = [float(np.percentile(score, p)) for p in (60, 85, 95)]
lvl = np.digitize(score, cuts)

weeks = []
for i, t in enumerate(issue):
    actual = np.minimum(win(cV, t, t + 7), 9).astype(int)
    zones = []
    for dpt in range(NDEP):
        cm = cell_dept == dpt
        zs = float(np.percentile(score[i][cm], 80))
        hot = cm & (score[i] >= zs)
        cur = float(cHd[dpt, t] - cHd[dpt, t - 30])
        prev = [float(cHd[dpt, t - 365 * k] - cHd[dpt, t - 365 * k - 30]) for k in range(1, 26) if t - 365 * k - 30 >= 61]
        zones.append({
            "level": int(np.digitize(zs, cuts)), "score": round(zs, 3),
            "cur30": round(cur, 1), "usual30": round(float(np.median(prev)), 1), "p90": round(float(np.percentile(prev, 90)), 1),
            "contrib": [round(float(v), 2) for v in comp_all[i][hot].mean(0)],
            "dry": int(dry[i][dpt]), "rain30": int(max(0, 110 - 3.2 * dry[i][dpt])), "tmax": float(tmax[i][dpt]),
            "rh": int(rh[i][dpt]), "wind": float(wind[i][dpt]),
            "blind": int(rng.integers(0, 4)),
            "hits": int((actual[cm] > 0).sum()), "cells": int(cm.sum()), "act7": int(win(cV, t, t + 7)[cm].sum()),
        })
    weeks.append({"t": int(t), "date": dates[t].isoformat(),
                  "levels": "".join(str(int(v)) for v in lvl[i]), "actual": "".join(str(int(v)) for v in actual),
                  "zones": zones})

# illustrative cloud mask ("blind days") per department
blind = []
for dpt in range(NDEP):
    doy = np.array([d.timetuple().tm_yday for d in dates])
    p = 0.16 + 0.07 * np.cos(2 * np.pi * (doy - 200) / 365.25)
    b = rng.random(ND) < p
    blind.append("".join("1" if v else "0" for v in b))

out = {
    "source": "simulated",
    "split": {"train": "2012-2022", "valid": "2023", "test": "2024-2025"},
    "results": [  # ILLUSTRATIVE placeholders, not measured
        {"id": "lgbm", "prAuc": 0.41, "top10": 0.47},
        {"id": "lgbm_no_human", "prAuc": 0.37, "top10": 0.43},
        {"id": "logistic", "prAuc": 0.33, "top10": 0.39},
        {"id": "fwi", "prAuc": 0.24, "top10": 0.30},
        {"id": "history", "prAuc": 0.27, "top10": 0.34},
        {"id": "persistence", "prAuc": 0.21, "top10": 0.26},
    ],
    "cuts": cuts, "freqCuts": FREQ_CUTS,
    "reliability": [{"level": 0, "share": 0.6, "observed": 0.03}, {"level": 1, "share": 0.25, "observed": 0.11},
                    {"level": 2, "share": 0.10, "observed": 0.24}, {"level": 3, "share": 0.05, "observed": 0.45}],
    "groupImp": [{"g": "season", "gain": 0.31}, {"g": "dryness", "gain": 0.19}, {"g": "recent", "gain": 0.15},
                 {"g": "human", "gain": 0.12}, {"g": "neighbors", "gain": 0.09}, {"g": "heat", "gain": 0.06},
                 {"g": "humidity", "gain": 0.05}, {"g": "wind", "gain": 0.03}],
    "groups": GROUPS,
    "cells": [{"lat": float(a), "lon": float(b), "d": int(c)} for a, b, c in zip(cell_lat, cell_lon, cell_dept)],
    "climLevels": clim_levels,
    "weeks": weeks,
}
json.dump(out, open(os.path.join(OUT, "model.json"), "w"), separators=(",", ":"))
json.dump({"source": "simulated", "blind": blind}, open(os.path.join(OUT, "blind.json"), "w"), separators=(",", ":"))
lv = np.array([[z["level"] for z in w["zones"]] for w in weeks])
print("weeks", len(weeks), "zone level share", np.bincount(lv.ravel(), minlength=4) / lv.size)
cand = []
for l, w in zip(lv, weeks):
    a = np.array([z["act7"] for z in w["zones"]]); tot = a.sum()
    cand.append((round(float(a[l >= 2].sum() / max(tot, 1)), 2), int(tot), int((l >= 2).sum()), w["date"]))
print("demo weeks (share of next-7d activity in high zones, total, n high zones)")
for c in sorted([c for c in cand if c[1] >= 40 and 4 <= c[2] <= 9], reverse=True)[:8]: print(c)
print({f: os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT)})
