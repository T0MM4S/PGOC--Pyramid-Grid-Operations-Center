"""
PGOC pipeline · Phase 3 (bonus) — weather context via Open-Meteo
─────────────────────────────────────────────────────────────────
Fetches monthly mean temperature for Tirana across the dataset window and
writes public/data/weather_monthly.json. Heating/cooling degree context helps
explain seasonal consumption swings (so a winter peak is not mistaken for a
spike, and a summer trough is not mistaken for tampering).

Free, no API key. Stdlib only (urllib). Network-dependent and OPTIONAL — it
must never block the MVP, so failures are swallowed with a clear message.

    python pipeline/weather.py
"""

import json
import sys
import urllib.request
from collections import defaultdict

import config

LAT, LON = 41.3275, 19.8189
START, END = "2024-01-01", "2026-03-31"
URL = (
    "https://archive-api.open-meteo.com/v1/archive"
    f"?latitude={LAT}&longitude={LON}&start_date={START}&end_date={END}"
    "&daily=temperature_2m_mean&timezone=Europe%2FTirane"
)


def fetch():
    try:
        with urllib.request.urlopen(URL, timeout=20) as resp:
            data = json.load(resp)
    except Exception as err:  # noqa: BLE001 — optional step, degrade gracefully
        print(f"[weather] skipped (no network / API error): {err}")
        return None

    daily = data.get("daily", {})
    dates = daily.get("time", [])
    temps = daily.get("temperature_2m_mean", [])
    buckets = defaultdict(list)
    for d, t in zip(dates, temps):
        if t is None:
            continue
        y, m, _ = d.split("-")
        buckets[f"{int(m):02d}/{y}"].append(t)

    monthly = {k: round(sum(v) / len(v), 1) for k, v in buckets.items() if v}
    out = {
        "source": "Open-Meteo archive API (ERA5)",
        "location": {"name": "Tirana, AL", "lat": LAT, "lon": LON},
        "unit": "degC",
        "monthlyMeanTemp": monthly,
    }
    path = config.DATA_OUT / "weather_monthly.json"
    config.DATA_OUT.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"[weather] wrote {path.relative_to(config.ROOT)} ({len(monthly)} months)")
    return out


if __name__ == "__main__":
    if fetch() is None:
        sys.exit(0)  # optional — never fail the pipeline
