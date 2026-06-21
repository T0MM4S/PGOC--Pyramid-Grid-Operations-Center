# PGOC · Batch NTL Detection Pipeline

Pre-computes the risk data that drives the PGOC dashboard. Runs **once** (or when
new billing data arrives), emits static JSON into `public/data/`, and the React
app fetches it at runtime. **Zero backend at demo time** — the whole thing runs
from `npm run dev`.

> **Ethics (non-negotiable).** Every number here is an *inspection priority*,
> never a theft confirmation. UI/AI copy says "flagged for inspection" /
> "i dyshuar", never "confirmed theft". `FALSE_POSITIVE` (inspector-cleared) is
> surfaced prominently.

---

## What it does

Loads the labelled monthly dataset (`data/dataset_130consumers_monthly_2024_2026_with_kWh.csv`
— 130 consumers × 27 months, `FLAG` 0/1), maps its **real consumption dynamics**
(seasonality + theft signatures) onto the fixed Tirana roster (13 zones, ~48
meters mirrored from the frontend), and computes genuine detection features:

| feature | meaning |
|---|---|
| `peer_zscore` | z-score vs. same zone + type + month cohort — **primary** detector (implicitly controls for weather/season) |
| `yoy_pct_change` | this month vs. same month last year — sustained drop = tamper signature |
| `deviation_persistence` | consecutive months below the peer baseline |
| `estimated_loss_lek` | `(expected − reported) × seasonal_tariff[month]` |

A transparent composite (`score.py`) maps these to `0–100` →
`LOW / MEDIUM / HIGH / CRITICAL` (**inspection urgency**, not theft certainty).

> The roster (who/where/m²/floor) is fixed demo scaffolding. Consumption
> **shapes** are real (drawn from the labelled set, scaled per meter) and every
> risk number is computed from peer statistics — nothing is random drift.

---

## Run order

```bash
# Phase 1 — MVP (stdlib only, no pip install needed). Always run this.
python pipeline/build_dataset.py

# Phase 2 — Isolation Forest (unsupervised). Validates vs FLAG, updates HUD acc.
pip install -r pipeline/requirements.txt
python pipeline/isolation_forest.py            # validate + update model_metrics
python pipeline/isolation_forest.py --apply    # also blend into displayed risk

# Phase 3 — XGBoost (supervised, SGCC-illustrative) + weather (optional)
python pipeline/xgboost_model.py               # train + CV + update model_metrics
python pipeline/xgboost_model.py --apply       # also blend into displayed risk
python pipeline/weather.py                      # optional Open-Meteo context
```

Re-running `build_dataset.py` resets to the Phase-1 rule-based baseline.

---

## Outputs (`public/data/`)

| file | consumed by | contents |
|---|---|---|
| `computed_risk.json` | `getNodeState` / `getAllState` / `startSimulator` | zone states + 12 monthly replay frames + per-frame metrics |
| `customer_history.json` | `CustomerPanel` | per-meter real 27-month series, expected baseline, risk, status |
| `anomaly_log.json` | `EventFeed` / `getEventLog` | pre-computed event feed (replayed in sequence) |
| `model_metrics.json` | HUD model accuracy | detection method + validated metrics |
| `inspections.json` | (future) | inspections table — **starts empty**, logging from day one |
| `weather_monthly.json` | (optional) | monthly mean temperature context |

The frontend bridge lives in `src/utils/dataLoader.js` (drop-in replacement for
`dataSimulator.jsx`, identical API surface). It **replays** months at 4 s
intervals; the HUD badge reads `REPLAY · <MONTH YEAR>` (never "LIVE"/"SCADA").

---

## Data schema

```
zones             zone_id, name, area_type, lat, lon
consumers         consumer_id, zone_id, consumer_type, building_id,
                  m2, floor, contract_kw, meter_age_years
monthly_readings  consumer_id, year, month, reported_kwh, expected_kwh,
                  yoy_pct_change, peer_zscore, deviation_persistence,
                  risk_score (0-100), risk_level, anomaly_type,
                  alarm_factors[], estimated_loss_lek, inspection_status
tariffs           month (1-12), rate_lek_per_kwh        # src/data/tariffTable.js
inspections       consumer_id, date, outcome, inspector_id, notes   # starts []
```

`inspection_status ∈ { NOT_FLAGGED, PENDING_REVIEW, INSPECTION_SCHEDULED, FALSE_POSITIVE }`.

---

## SGCC calibration caveat

The supervised model captures real theft patterns from the **labelled set
provided** and is calibrated with SGCC-derived signatures (`sgcc_patterns.py`).
It is **illustrative of the production pipeline** — before operational use in
Albania it must be re-calibrated on OSHEE ground truth. Do not present it as a
deployable Albanian fraud model.

## Files

```
config.py           zones + customer roster + seasonal tariff (single source)
sgcc_patterns.py    theft-type signatures + alarm-factor templates
features.py         reshape/impute + yoy / peer_zscore / persistence / loss / series feats
score.py            composite rule-based scoring -> risk level
build_dataset.py    Phase 1 orchestrator (stdlib) -> all JSON
isolation_forest.py Phase 2 unsupervised detector (sklearn)
xgboost_model.py    Phase 3 supervised model (xgboost) -> model.pkl
weather.py          Phase 3 optional Open-Meteo monthly temperature
```
