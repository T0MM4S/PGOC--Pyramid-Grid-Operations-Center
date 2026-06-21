
# PGOC — Pyramid Grid Operations Center

> A 3D holographic **digital twin of Tirana** that uses AI to detect **Non‑Technical Loss (NTL)** — electricity theft, meter tampering, and illegal connections — across the city's distribution grid, on top of a **live technical grid‑telemetry** layer.

Built for the **Innovation4Albania** challenge as an operations console for an **OSHEE‑style** energy distribution operator. The pyramid of Tirana is reimagined as the **Pyramid Command Center (PCC)** — the live hub of a city‑wide grid‑intelligence platform.

---

## What it is

PGOC turns dry meter telemetry into a **living situational‑awareness map**. Instead of an analyst scrolling spreadsheets of consumption data, the whole grid is rendered as a glowing 3D city, and the platform cleanly separates two concerns:

- **Technical layer (live, on the map).** Every monitored zone is a node carrying live grid‑ops telemetry — load, voltage, technical‑loss %, feeder status, transformer temperature.
- **Non‑Technical layer (AI, in the panels & dashboard).** The same zones are scored for **NTL risk** by a detection pipeline, and a Gemini‑powered assistant explains *why* a zone is suspicious and *what to do about it* — in Albanian, in the language a field inspector actually uses.

Critically, the risk numbers are **not random**. A **Python batch pipeline** computes genuine detection features from a labelled monthly consumption dataset, emits static JSON into `public/data/`, and the React app **replays it month‑by‑month** at runtime. So it stays a **front‑end‑only demo at run time** (no backend, no live SCADA hookup) — everything runs from `npm run dev` — while the figures behind it are real, peer‑statistics‑driven detections rather than mock drift.

> ⚖️ **Ethics (non‑negotiable).** Every number is an **inspection priority**, never a theft confirmation. The UI/AI says *"flagged for inspection" / "i dyshuar"*, never *"confirmed theft"*. The HUD badge reads `REPLAY · <MONTH YEAR>` (never "LIVE"), and inspector‑cleared **`FALSE_POSITIVE`** cases are surfaced prominently to demonstrate fairness.

---

## What it's designed to do

1. **Visualize the grid as a digital twin.** 13 zones across central Tirana (Skanderbeg Square, Blloku, Rinia Park, Tirana Tower, the University, the Artificial Lake, etc.) orbit around the Pyramid Command Center on a real 3D basemap with OSM buildings.
2. **Show live technical grid health.** Each node streams synthetic SCADA‑style ops telemetry (load MW, voltage p.u., technical‑loss %, feeder status, transformer °C) — the "technical difficulties" view of the grid.
3. **Detect & rank Non‑Technical Loss.** Each zone carries a `riskScore` (0–100) → `LOW / MEDIUM / HIGH / CRITICAL` (**inspection urgency**, not certainty), computed by the pipeline from peer‑cohort deviation, year‑over‑year change, and deviation persistence.
4. **Quantify the financial bleed.** Estimated annual loss is computed per flagged meter as `(expected_kWh − reported_kWh) × seasonal_tariff[month]`, and aggregated into a city‑wide **Estimated Annual Loss** figure.
5. **Prioritize inspections.** The platform surfaces which zones (and which individual customers within a zone) deserve a field visit first, with statuses like `PENDING_REVIEW`, `INSPECTION_SCHEDULED`, and `FALSE_POSITIVE`.
6. **Explain anomalies in plain language.** Gemini analyzes a zone's peer cohort (same building, same m², same floor → very different consumption) and returns a numbered, inspector‑ready brief: who is suspect, why, the estimated LEK/year loss, and the concrete next step — with a mandatory disclaimer.
7. **Replay history & analyze.** Scrub through monthly frames, and open the **NTL Analytics dashboard** for a PowerBI‑style view of customers, comparisons, suspected vs. detected cases, and model performance.

---

## Key features

- **3D digital twin** of central Tirana (CesiumJS) with a cinematic boot → fly‑in → orbiting camera, bloom glow, and a wireframe "Pyramid Command Center" hub.
- **13 interactive zone nodes**, color‑coded by live risk: `cyan = LOW`, `amber = MEDIUM`, `orange = HIGH`, `red = CRITICAL`. Click a node to fly to it, beam it to the hub, and open its dossier — the selected node **keeps its risk color** and is marked with a white outline ring.
- **Live grid telemetry (technical layer)** — each NodePanel shows a `GRID TELEMETRY · LIVE` section that ticks in real time (`technicalTelemetry.js`), kept conceptually distinct from the AI/NTL (non‑technical) assessment in the same panel.
- **NTL Analytics dashboard** — a **PowerBI‑style, dark‑mode** overlay opened from a glowing **ANALYTICS** orb in the center of the bottom nav: KPI tiles, hand‑rolled SVG charts (risk distribution, est. loss by zone, detection trend, top suspected meters, reported‑vs‑expected), and a searchable/sortable customer table segmented into **All / Suspected / Detected / Cleared+False‑positive**.
- **Historical replay** — `dataLoader.js` replays 12 monthly frames; the Hub has a play/pause + month scrubber, and the HUD badge reads `REPLAY · <MONTH YEAR>`.
- **NodePanel** — per‑zone dossier: risk ring, expected vs. reported kWh, deviation %, YoY %, anomaly type, NTL alarm factors, inspection status — plus the live technical telemetry block.
- **CustomerPanel** — drills into individual customers with **12‑month sparklines** and runs **AI Peer Analysis** (Gemini) to expose the outlier in a cohort of near‑identical neighbors.
- **HubPanel (NTL Command Center)** — city‑wide dashboard: critical/high counts, pending inspections, model accuracy, estimated annual loss, live events, zones ranked by risk, and the replay scrubber.
- **Componentized HUD sidebar** — built from real React components (`hud/SidebarPanel`, `MetricRow`, `SidebarSummaryStrip`) with a `TECHNICAL vs NON‑TECHNICAL` summary strip.
- **Role‑based access (RBAC)** — Operator, Inspector, and Analyst each see a tailored set of tabs/capabilities; the ANALYTICS orb and Hub are gated to `viewHub` (Operator/Analyst).
- **Session persistence** — login survives page reload / Vite HMR via `sessionStorage` (no accidental kick‑back to the login screen mid‑demo).
- **Rotating HUD compass**, signal meter, status tabs, and a keyboard‑driven alert system (`B`).

---

## Technical vs. Non‑Technical — the conceptual split

| | Technical layer | Non‑Technical layer (NTL) |
|---|---|---|
| **Question** | Is the *grid* healthy? | Is *consumption* honest? |
| **Lives in** | The 3D map nodes + `GRID TELEMETRY · LIVE` | NodePanel AI assessment + Analytics dashboard |
| **Signals** | load, voltage, technical‑loss %, feeder status, transformer °C | peer z‑score, YoY change, deviation persistence, estimated loss |
| **Source** | `technicalTelemetry.js` (live synthetic ops feed) | `public/data/*.json` from the Python pipeline (replayed) |

This keeps "live infrastructure status" (always honest, real‑time) separate from "loss detection" (historical, AI‑driven, framed as inspection priority).

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Build / dev server | **Vite 8** + `vite-plugin-cesium` |
| UI | **React 19** |
| 3D / digital twin | **CesiumJS 1.142** (Cesium Ion terrain + OSM Buildings) |
| AI analysis | **Google Gemini** (`gemini-3.5-flash`, REST) — Albanian NTL analyst with ethics guardrails |
| Detection pipeline | **Python** — rule‑based composite (stdlib), **Isolation Forest** (scikit‑learn), **XGBoost** (supervised) |
| Data at runtime | Static JSON in `public/data/`, fetched + **replayed** in‑browser via `dataLoader.js` |
| Charts | Hand‑rolled inline **SVG** (no chart library) |
| Lang/tooling | JavaScript (JSX) + Python, ESLint |

---

## Project structure

```
=======
PGOC — Pyramid Grid Operations Center

WELCOME !!!!

To access the login page you can use one of the 3 users :
1 username = operator, password = nexus2026,
2 username = analyst, password = data2026,
3 username = inspector, password = field2026.
Go and try yourself 😉

A 3D holographic digital twin of Tirana that uses AI to detect Non‑Technical Loss (NTL) — electricity theft, meter tampering, and illegal connections — across the city's distribution grid, on top of a live technical grid‑telemetry layer.

Built for the Innovation4Albania challenge as an operations console for an OSHEE‑style energy distribution operator. The pyramid of Tirana is reimagined as the Pyramid Command Center (PCC) — the live hub of a city‑wide grid‑intelligence platform.

What it is
PGOC turns dry meter telemetry into a living situational‑awareness map. Instead of an analyst scrolling spreadsheets of consumption data, the whole grid is rendered as a glowing 3D city, and the platform cleanly separates two concerns:

Technical layer (live, on the map). Every monitored zone is a node carrying live grid‑ops telemetry — load, voltage, technical‑loss %, feeder status, transformer temperature.
Non‑Technical layer (AI, in the panels & dashboard). The same zones are scored for NTL risk by a detection pipeline, and a Gemini‑powered assistant explains why a zone is suspicious and what to do about it — in Albanian, in the language a field inspector actually uses.
Critically, the risk numbers are not random. A Python batch pipeline computes genuine detection features from a labelled monthly consumption dataset, emits static JSON into public/data/, and the React app replays it month‑by‑month at runtime. So it stays a front‑end‑only demo at run time (no backend, no live SCADA hookup) — everything runs from npm run dev — while the figures behind it are real, peer‑statistics‑driven detections rather than mock drift.

⚖️ Ethics (non‑negotiable). Every number is an inspection priority, never a theft confirmation. The UI/AI says "flagged for inspection" / "i dyshuar", never "confirmed theft". The HUD badge reads REPLAY · <MONTH YEAR> (never "LIVE"), and inspector‑cleared FALSE_POSITIVE cases are surfaced prominently to demonstrate fairness.

What it's designed to do
Visualize the grid as a digital twin. 13 zones across central Tirana (Skanderbeg Square, Blloku, Rinia Park, Tirana Tower, the University, the Artificial Lake, etc.) orbit around the Pyramid Command Center on a real 3D basemap with OSM buildings.
Show live technical grid health. Each node streams synthetic SCADA‑style ops telemetry (load MW, voltage p.u., technical‑loss %, feeder status, transformer °C) — the "technical difficulties" view of the grid.
Detect & rank Non‑Technical Loss. Each zone carries a riskScore (0–100) → LOW / MEDIUM / HIGH / CRITICAL (inspection urgency, not certainty), computed by the pipeline from peer‑cohort deviation, year‑over‑year change, and deviation persistence.
Quantify the financial bleed. Estimated annual loss is computed per flagged meter as (expected_kWh − reported_kWh) × seasonal_tariff[month], and aggregated into a city‑wide Estimated Annual Loss figure.
Prioritize inspections. The platform surfaces which zones (and which individual customers within a zone) deserve a field visit first, with statuses like PENDING_REVIEW, INSPECTION_SCHEDULED, and FALSE_POSITIVE.
Explain anomalies in plain language. Gemini analyzes a zone's peer cohort (same building, same m², same floor → very different consumption) and returns a numbered, inspector‑ready brief: who is suspect, why, the estimated LEK/year loss, and the concrete next step — with a mandatory disclaimer.
Replay history & analyze. Scrub through monthly frames, and open the NTL Analytics dashboard for a PowerBI‑style view of customers, comparisons, suspected vs. detected cases, and model performance.
Key features
3D digital twin of central Tirana (CesiumJS) with a cinematic boot → fly‑in → orbiting camera, bloom glow, and a wireframe "Pyramid Command Center" hub.
13 interactive zone nodes, color‑coded by live risk: cyan = LOW, amber = MEDIUM, orange = HIGH, red = CRITICAL. Click a node to fly to it, beam it to the hub, and open its dossier — the selected node keeps its risk color and is marked with a white outline ring.
Live grid telemetry (technical layer) — each NodePanel shows a GRID TELEMETRY · LIVE section that ticks in real time (technicalTelemetry.js), kept conceptually distinct from the AI/NTL (non‑technical) assessment in the same panel.
NTL Analytics dashboard — a PowerBI‑style, dark‑mode overlay opened from a glowing ANALYTICS orb in the center of the bottom nav: KPI tiles, hand‑rolled SVG charts (risk distribution, est. loss by zone, detection trend, top suspected meters, reported‑vs‑expected), and a searchable/sortable customer table segmented into All / Suspected / Detected / Cleared+False‑positive.
Historical replay — dataLoader.js replays 12 monthly frames; the Hub has a play/pause + month scrubber, and the HUD badge reads REPLAY · <MONTH YEAR>.
NodePanel — per‑zone dossier: risk ring, expected vs. reported kWh, deviation %, YoY %, anomaly type, NTL alarm factors, inspection status — plus the live technical telemetry block.
CustomerPanel — drills into individual customers with 12‑month sparklines and runs AI Peer Analysis (Gemini) to expose the outlier in a cohort of near‑identical neighbors.
HubPanel (NTL Command Center) — city‑wide dashboard: critical/high counts, pending inspections, model accuracy, estimated annual loss, live events, zones ranked by risk, and the replay scrubber.
Componentized HUD sidebar — built from real React components (hud/SidebarPanel, MetricRow, SidebarSummaryStrip) with a TECHNICAL vs NON‑TECHNICAL summary strip.
Role‑based access (RBAC) — Operator, Inspector, and Analyst each see a tailored set of tabs/capabilities; the ANALYTICS orb and Hub are gated to viewHub (Operator/Analyst).
Session persistence — login survives page reload / Vite HMR via sessionStorage (no accidental kick‑back to the login screen mid‑demo).
Rotating HUD compass, signal meter, status tabs, and a keyboard‑driven alert system (B).
Technical vs. Non‑Technical — the conceptual split
Technical layer	Non‑Technical layer (NTL)
Question	Is the grid healthy?	Is consumption honest?
Lives in	The 3D map nodes + GRID TELEMETRY · LIVE	NodePanel AI assessment + Analytics dashboard
Signals	load, voltage, technical‑loss %, feeder status, transformer °C	peer z‑score, YoY change, deviation persistence, estimated loss
Source	technicalTelemetry.js (live synthetic ops feed)	public/data/*.json from the Python pipeline (replayed)
This keeps "live infrastructure status" (always honest, real‑time) separate from "loss detection" (historical, AI‑driven, framed as inspection priority).

Tech stack
Layer	Technology
Build / dev server	Vite 8 + vite-plugin-cesium
UI	React 19
3D / digital twin	CesiumJS 1.142 (Cesium Ion terrain + OSM Buildings)
AI analysis	Google Gemini (gemini-3.5-flash, REST) — Albanian NTL analyst with ethics guardrails
Detection pipeline	Python — rule‑based composite (stdlib), Isolation Forest (scikit‑learn), XGBoost (supervised)
Data at runtime	Static JSON in public/data/, fetched + replayed in‑browser via dataLoader.js
Charts	Hand‑rolled inline SVG (no chart library)
Lang/tooling	JavaScript (JSX) + Python, ESLint
Project structure
>>>>>>> 5dfcf291e70883a3b072680675319d12fa3e39ce
src/
├─ main.jsx                 # Entry: awaits initDataLoader() then renders <App/>
├─ App.jsx                  # Boot/login gate → MapViewer (session‑persistent)
├─ App.css                  # All HUD / panel / dashboard / label styling
├─ components/
│  ├─ BootSequence.jsx      # Terminal boot + role login
│  ├─ MapViewer.jsx         # Cesium viewer, camera, selection, HTML label layer
│  ├─ NodeLayer.jsx         # Zone pins + ground sensor rings
│  ├─ PyramidLayer.jsx      # Wireframe Pyramid Command Center hub
│  ├─ PulseLayer.jsx        # Expanding hub rings + data‑flow dots
│  ├─ ConnectionLayer / GridLayer / RoadLayer / BuildingDots  # Ambient city detail
│  ├─ HUD.jsx               # Top bar, sidebar, compass, bottom nav + ANALYTICS orb, alerts
│  ├─ NodePanel.jsx         # Per‑zone: LIVE grid telemetry (technical) + AI NTL assessment
│  ├─ CustomerPanel.jsx     # Customer cohort + 12‑month sparklines + AI Peer Analysis
│  ├─ HubPanel.jsx          # NTL Command Center + historical replay scrubber
│  ├─ AnalyticsDashboard.jsx# PowerBI‑style NTL analytics (KPIs, SVG charts, customer table)
│  ├─ EventFeed.jsx         # Live NTL event feed
│  ├─ hud/                  # Componentized sidebar: SidebarPanel, MetricRow, SidebarSummaryStrip
│  └─ ui/                   # Shared primitives: KpiTile, PanelSection, RiskBadge
├─ data/
│  ├─ cityNodes.js          # The 13 monitored zones (lat/lon/category)
│  ├─ customerData.jsx      # Seeded customer roster (fallback)
│  ├─ sgccPatterns.jsx      # SGCC theft‑type signatures (frontend mirror)
│  └─ tariffTable.js        # Seasonal LEK/kWh tariff (mirrors pipeline/config.py)
├─ utils/
│  ├─ dataLoader.js         # ACTIVE data layer: loads public/data JSON + monthly replay
│  ├─ technicalTelemetry.js # Live synthetic grid (technical) telemetry per zone
│  ├─ aiExplainer.jsx       # Gemini prompts (Albanian NTL analyst, ethics guardrails)
│  ├─ authStore.jsx         # Demo RBAC (3 roles) + sessionStorage persistence
│  └─ dataSimulator.jsx     # Legacy random simulator (superseded by dataLoader.js)
├─ config/
│  ├─ hudConfig.jsx         # Titles, tabs, sidebar data, alerts
│  └─ mobileConfig.jsx      # Mobile camera + tab subset
└─ hooks/useMobile.jsx      # Responsive breakpoint hook

pipeline/                   # Python batch pipeline — see pipeline/README.md
└─ build_dataset.py · features.py · score.py · config.py · sgcc_patterns.py
   · isolation_forest.py · xgboost_model.py · weather.py · requirements.txt

public/data/                # Generated static JSON consumed at runtime
└─ computed_risk.json · customer_history.json · anomaly_log.json
   · model_metrics.json · inspections.json
<<<<<<< HEAD
```

---

## How the detection works (the model)

The risk data is **pre‑computed** by the Python pipeline (`pipeline/`) from a labelled monthly dataset (130 consumers × 27 months, `FLAG` 0/1), whose real consumption dynamics are mapped onto the fixed Tirana roster. For every meter/zone it derives:

- **`peer_zscore`** — z‑score vs. the same zone + customer type + month cohort. **Primary detector** (implicitly controls for weather/season: neighbors in the same building, same m², same floor should consume alike).
- **`yoy_pct_change`** — this month vs. the same month last year. A sustained drop is a classic tamper signature.
- **`deviation_persistence`** — consecutive months below the peer baseline.
- **`estimated_loss_lek`** — `(expected − reported) × seasonal_tariff[month]`.

A transparent composite (`score.py`) maps these to `0–100` → `LOW (<30) / MEDIUM (30–59) / HIGH (60–79) / CRITICAL (80+)`, with an `anomaly_type` (`METER_TAMPERING`, `ILLEGAL_CONNECTION`, `CONSUMPTION_ANOMALY`) and human‑readable **alarm factors**.

Three detector phases share the same UI contract (see `pipeline/README.md`):

1. **Phase 1 — Rule‑based composite** (stdlib only). The shipping default; re‑running `build_dataset.py` resets to this baseline.
2. **Phase 2 — Isolation Forest** (unsupervised, scikit‑learn). Validated against `FLAG`; can blend into the displayed risk with `--apply`.
3. **Phase 3 — XGBoost** (supervised, SGCC‑illustrative). Cross‑validated; reports ROC‑AUC / precision / recall and can `--apply`.

> ⚠️ This is a **hackathon demo**. The roster (who/where/m²/floor) is fixed scaffolding; the consumption **shapes** are real (drawn from the labelled set, scaled per meter) and every risk number is computed from peer statistics. The supervised model is **illustrative of the production pipeline** and must be re‑calibrated on OSHEE ground truth before any operational use. Do not present it as a deployable Albanian fraud model.

---

## Roles & access (demo accounts)

| Username | Password | Role | Sees |
|----------|----------|------|------|
| `operator`  | `nexus2026` | **OPERATOR** | Everything (full grid command, Hub + Analytics) |
| `inspector` | `field2026` | **INSPECTOR** | Node dossiers, alerts, mark‑inspected (no Hub/Analytics) |
| `analyst`   | `data2026`  | **ANALYST** | Hub dashboard, NTL Analytics, financials, AI peer analysis |

> Demo credentials only — defined in `src/utils/authStore.jsx`. No real authentication/backend.

---

## Getting started

### Prerequisites
- Node.js 18+
- A **Cesium Ion** access token
- A **Google Gemini** API key
- *(Optional)* Python 3.10+ — only needed to **regenerate** the detection data; the repo ships with `public/data/*.json` so the app runs without it.

### 1. Install
```bash
npm install
```

### 2. Configure environment
Create a `.env` file in the project root:
```bash
VITE_CESIUM_TOKEN=your_cesium_ion_token
VITE_GEMINI_API_KEY=your_gemini_api_key
```

### 3. Run
```bash
=======
How the detection works (the model)
The risk data is pre‑computed by the Python pipeline (pipeline/) from a labelled monthly dataset (130 consumers × 27 months, FLAG 0/1), whose real consumption dynamics are mapped onto the fixed Tirana roster. For every meter/zone it derives:

peer_zscore — z‑score vs. the same zone + customer type + month cohort. Primary detector (implicitly controls for weather/season: neighbors in the same building, same m², same floor should consume alike).
yoy_pct_change — this month vs. the same month last year. A sustained drop is a classic tamper signature.
deviation_persistence — consecutive months below the peer baseline.
estimated_loss_lek — (expected − reported) × seasonal_tariff[month].
A transparent composite (score.py) maps these to 0–100 → LOW (<30) / MEDIUM (30–59) / HIGH (60–79) / CRITICAL (80+), with an anomaly_type (METER_TAMPERING, ILLEGAL_CONNECTION, CONSUMPTION_ANOMALY) and human‑readable alarm factors.

Three detector phases share the same UI contract (see pipeline/README.md):

Phase 1 — Rule‑based composite (stdlib only). The shipping default; re‑running build_dataset.py resets to this baseline.
Phase 2 — Isolation Forest (unsupervised, scikit‑learn). Validated against FLAG; can blend into the displayed risk with --apply.
Phase 3 — XGBoost (supervised, SGCC‑illustrative). Cross‑validated; reports ROC‑AUC / precision / recall and can --apply.
⚠️ This is a hackathon demo. The roster (who/where/m²/floor) is fixed scaffolding; the consumption shapes are real (drawn from the labelled set, scaled per meter) and every risk number is computed from peer statistics. The supervised model is illustrative of the production pipeline and must be re‑calibrated on OSHEE ground truth before any operational use. Do not present it as a deployable Albanian fraud model.

Roles & access (demo accounts)
Username	Password	Role	Sees
operator	nexus2026	OPERATOR	Everything (full grid command, Hub + Analytics)
inspector	field2026	INSPECTOR	Node dossiers, alerts, mark‑inspected (no Hub/Analytics)
analyst	data2026	ANALYST	Hub dashboard, NTL Analytics, financials, AI peer analysis
Demo credentials only — defined in src/utils/authStore.jsx. No real authentication/backend.

Getting started
Prerequisites
Node.js 18+
A Cesium Ion access token
A Google Gemini API key
(Optional) Python 3.10+ — only needed to regenerate the detection data; the repo ships with public/data/*.json so the app runs without it.
1. Install
npm install
2. Configure environment
Create a .env file in the project root:

VITE_CESIUM_TOKEN=your_cesium_ion_token
VITE_GEMINI_API_KEY=your_gemini_api_key
3. Run
>>>>>>> 5dfcf291e70883a3b072680675319d12fa3e39ce
npm run dev      # start the dev server (http://localhost:5173)
npm run build    # production build
npm run preview  # preview the production build
npm run lint     # lint
<<<<<<< HEAD
```

Log in with one of the demo accounts above to enter the operations center.

### 4. (Optional) Regenerate the detection data
```bash
=======
Log in with one of the demo accounts above to enter the operations center.

4. (Optional) Regenerate the detection data
>>>>>>> 5dfcf291e70883a3b072680675319d12fa3e39ce
python pipeline/build_dataset.py             # Phase 1 — rebuilds public/data/*.json
pip install -r pipeline/requirements.txt     # for the ML phases
python pipeline/isolation_forest.py --apply  # Phase 2 (optional)
python pipeline/xgboost_model.py --apply     # Phase 3 (optional)
<<<<<<< HEAD
```
See **`pipeline/README.md`** for the full run order, outputs, data schema, and ethics notes.

---

## Using the console

- **Click a zone node** → fly‑to + open its dossier (NodePanel): live `GRID TELEMETRY` (technical) on top, the AI **NTL assessment** (non‑technical) below. For Analyst/Operator, the CustomerPanel appears with a **RUN AI PEER ANALYSIS** button.
- **Click the ANALYTICS orb** (center of the bottom nav) → open the **NTL Analytics** dashboard (KPIs, charts, segmented customer table). `Esc` or ✕ closes it.
- **Click the Pyramid (PCC)** → open/close the NTL Command Center, including the **historical replay** scrubber (play/pause + month slider).
- **Bottom tabs** → switch the left sidebar context (Overview, AI Model, Risk Scan, Meter Mesh, Grid Link, NTL Alerts).
- **Press `B`** → trigger the contextual alert for the active tab and pulse the linked zone.
- **EXIT (top‑right)** → log out and return to the boot screen (session is cleared).
- The **compass** (bottom‑left, with live needles) rotates with the orbiting camera heading.

---

## How this improves the city's priorities

Non‑Technical Loss is one of the largest, least‑visible drains on a distribution utility — and on the public purse. PGOC is built around the priorities that matter to a city like Tirana and to OSHEE:

1. **Recover lost revenue → fund the grid.** Every kWh stolen is revenue that can't be reinvested in reliability. By surfacing and quantifying loss in LEK/year per zone, PGOC turns "we think there's theft somewhere" into a ranked, costed worklist. The headline **Estimated Annual Loss** figure makes the business case self‑evident.
2. **Send inspectors where it pays.** Field inspection is expensive and slow. Instead of random sweeps, PGOC prioritizes the **highest‑risk, highest‑loss** zones and customers first, with concrete next steps. This raises hit‑rate and cuts wasted truck‑rolls.
3. **Fairness & trust for honest payers.** Theft inflates technical justifications for tariff increases that punish paying customers. Targeting actual offenders — and visibly clearing **false positives** — protects honest households and strengthens public trust.
4. **Grid safety & reliability.** Illegal connections and meter tampering cause overloads, fire risk, and unplanned outages. Early detection is a safety win, not just a billing one.
5. **Cleaner planning data.** When billed consumption reflects real consumption, demand forecasting, substation loading, and renewable‑integration planning all improve.
6. **From reactive to proactive operations.** A live, explainable command center lets operators act on anomalies within seconds of detection instead of discovering them months later in an audit.

In short: **PGOC makes invisible losses visible, costed, explainable, and actionable** — so a city can recover revenue, deploy inspectors efficiently, protect honest customers, and run a safer, better‑planned grid.

---

## Roadmap (production path)

- Swap the replayed JSON for a **live AMI/SCADA** feed behind the same `dataLoader.js` API contract, with the trained classifier scoring in place of the rule‑based baseline.
- Persist inspections and outcomes to close the **feedback loop** (true/false positives → model retraining); `inspections.json` is wired to log from day one.
- Wire the technical‑telemetry layer to real feeder/transformer SCADA points and add geofenced feeder topology + crew dispatch.
- Harden auth (real IdP/SSO) and per‑role audit logging.

---

*PGOC · Pyramid Grid Operations Center — Innovation4Albania · AI Non‑Technical Loss Detection.*
=======
See pipeline/README.md for the full run order, outputs, data schema, and ethics notes.

Using the console
Click a zone node → fly‑to + open its dossier (NodePanel): live GRID TELEMETRY (technical) on top, the AI NTL assessment (non‑technical) below. For Analyst/Operator, the CustomerPanel appears with a RUN AI PEER ANALYSIS button.
Click the ANALYTICS orb (center of the bottom nav) → open the NTL Analytics dashboard (KPIs, charts, segmented customer table). Esc or ✕ closes it.
Click the Pyramid (PCC) → open/close the NTL Command Center, including the historical replay scrubber (play/pause + month slider).
Bottom tabs → switch the left sidebar context (Overview, AI Model, Risk Scan, Meter Mesh, Grid Link, NTL Alerts).
Press B → trigger the contextual alert for the active tab and pulse the linked zone.
EXIT (top‑right) → log out and return to the boot screen (session is cleared).
The compass (bottom‑left, with live needles) rotates with the orbiting camera heading.
How this improves the city's priorities
Non‑Technical Loss is one of the largest, least‑visible drains on a distribution utility — and on the public purse. PGOC is built around the priorities that matter to a city like Tirana and to OSHEE:

Recover lost revenue → fund the grid. Every kWh stolen is revenue that can't be reinvested in reliability. By surfacing and quantifying loss in LEK/year per zone, PGOC turns "we think there's theft somewhere" into a ranked, costed worklist. The headline Estimated Annual Loss figure makes the business case self‑evident.
Send inspectors where it pays. Field inspection is expensive and slow. Instead of random sweeps, PGOC prioritizes the highest‑risk, highest‑loss zones and customers first, with concrete next steps. This raises hit‑rate and cuts wasted truck‑rolls.
Fairness & trust for honest payers. Theft inflates technical justifications for tariff increases that punish paying customers. Targeting actual offenders — and visibly clearing false positives — protects honest households and strengthens public trust.
Grid safety & reliability. Illegal connections and meter tampering cause overloads, fire risk, and unplanned outages. Early detection is a safety win, not just a billing one.
Cleaner planning data. When billed consumption reflects real consumption, demand forecasting, substation loading, and renewable‑integration planning all improve.
From reactive to proactive operations. A live, explainable command center lets operators act on anomalies within seconds of detection instead of discovering them months later in an audit.
In short: PGOC makes invisible losses visible, costed, explainable, and actionable — so a city can recover revenue, deploy inspectors efficiently, protect honest customers, and run a safer, better‑planned grid.

Roadmap (production path)
Swap the replayed JSON for a live AMI/SCADA feed behind the same dataLoader.js API contract, with the trained classifier scoring in place of the rule‑based baseline.
Persist inspections and outcomes to close the feedback loop (true/false positives → model retraining); inspections.json is wired to log from day one.
Wire the technical‑telemetry layer to real feeder/transformer SCADA points and add geofenced feeder topology + crew dispatch.
Harden auth (real IdP/SSO) and per‑role audit logging.
PGOC · Pyramid Grid Operations Center — Innovation4Albania · AI Non‑Technical Loss Detection.
>>>>>>> 5dfcf291e70883a3b072680675319d12fa3e39ce
