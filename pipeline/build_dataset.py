"""
PGOC pipeline · build_dataset.py  (Phase 1 — MVP, stdlib only)
────────────────────────────────────────────────────────────────
Loads the labelled monthly dataset, maps its real consumption *dynamics*
(seasonality + theft signatures) onto the demo's fixed Tirana roster, computes
genuine peer-cohort / YoY / persistence features, scores every consumer x month,
and writes the static JSON the React app fetches at runtime:

    public/data/computed_risk.json      zone states + 12-month replay frames
    public/data/customer_history.json   per-consumer real series + risk
    public/data/anomaly_log.json         pre-computed event feed
    public/data/inspections.json         inspections table (starts empty)
    public/data/model_metrics.json       detection stats for the HUD

Run:  python pipeline/build_dataset.py
No third-party dependencies required for this phase.

Honesty note for the demo: the roster (who lives where, m², floor) is fixed
demo scaffolding. Consumption *shapes* are real (drawn from the labelled set and
scaled to each meter's magnitude), and every risk number below is computed from
peer-cohort statistics — nothing is random drift.
"""

import csv
import json
import math
import random
from datetime import datetime, timezone

import config
import features
import score as scoring
from sgcc_patterns import SGCC_STATS

EPOCH = 1_700_000_000_000  # fixed base ms for deterministic event timestamps


# ── 1 · Load + reshape the labelled dataset ──────────────────────────────
def load_dataset():
    """Return (month_keys, donors). Each donor: {cons_no, flag, series[27], feats}."""
    with open(config.DATA_IN, newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        rows = list(reader)
        fields = reader.fieldnames

    month_keys = [c for c in fields if "/" in c]  # "MM/YYYY" wide columns
    donors = []
    for r in rows:
        raw = []
        for c in month_keys:
            try:
                raw.append(float(r[c]))
            except (TypeError, ValueError):
                raw.append(None)
        series = features.impute_series(raw)  # wide->declared kWh, no gaps
        donors.append({
            "cons_no": r.get("CONS_NO", ""),
            "flag": int(float(r.get("FLAG", 0) or 0)),
            "series": series,
            "feats": features.series_features(series),
        })
    return month_keys, donors


def parse_months(month_keys):
    """["MM/YYYY", ...] -> [{year, month, label, key, tariff}]."""
    out = []
    for k in month_keys:
        mm, yyyy = k.split("/")
        m, y = int(mm), int(yyyy)
        label = f"{datetime(y, m, 1):%b %Y}".upper()
        out.append({"year": y, "month": m, "label": label, "key": k,
                    "tariff": config.TARIFF_LEK_PER_KWH[m]})
    return out


# ── 2 · Identify seeded suspects from the static roster ──────────────────
def median(vals):
    vals = sorted(v for v in vals if v is not None)
    if not vals:
        return 0.0
    n = len(vals)
    mid = n // 2
    return vals[mid] if n % 2 else (vals[mid - 1] + vals[mid]) / 2


def mark_suspects():
    """A customer is a seeded suspect if its authored monthly kWh sits far below
    the median of same zone + same type peers (the hand-built outlier story)."""
    suspects = set()
    for zid, custs in config.CUSTOMERS.items():
        by_type = {}
        for c in custs:
            by_type.setdefault(c["type"], []).append(c)
        for _t, group in by_type.items():
            if len(group) < 2:
                continue
            med = median([c["monthlyKwh"] for c in group])
            for c in group:
                if med and c["monthlyKwh"] < 0.55 * med:
                    suspects.add(c["id"])
    return suspects


# ── 3 · Assign a real donor series to every roster meter ─────────────────
def assign_donors(donors, suspects):
    rng = random.Random(config.RANDOM_SEED)
    normal = sorted([d for d in donors if d["flag"] == 0], key=lambda d: d["feats"]["mean"])
    theft = sorted([d for d in donors if d["flag"] == 1], key=lambda d: d["feats"]["mean"])
    rng.shuffle(normal)
    rng.shuffle(theft)

    n_i = t_i = 0
    assignment = {}
    for zid, custs in config.CUSTOMERS.items():
        for c in custs:
            if c["id"] in suspects and theft:
                donor = theft[t_i % len(theft)]; t_i += 1
            else:
                donor = normal[n_i % len(normal)]; n_i += 1
            assignment[c["id"]] = donor
    return assignment


def scale_series(donor_series, target_recent_kwh):
    """Scale a donor's real series so its trailing-3-month mean matches the
    meter's authored 'current' magnitude. Preserves the real *shape*: a theft
    donor keeps its drop ratio, so the meter shows a genuine YoY decline."""
    recent = [v for v in donor_series[-3:] if v is not None]
    anchor = sum(recent) / len(recent) if recent else (donor_series[-1] or 1.0)
    if anchor <= 0:
        anchor = 1.0
    scale = target_recent_kwh / anchor
    return [round(max(0.0, v * scale), 2) for v in donor_series]


# ── 4 · Build enriched per-customer histories + scored months ────────────
def build_customers(months, donors, suspects, rescore=None):
    assignment = assign_donors(donors, suspects)
    n_months = len(months)

    # Real, scaled monthly series per meter.
    series = {}
    for zid, custs in config.CUSTOMERS.items():
        for c in custs:
            series[c["id"]] = scale_series(assignment[c["id"]]["series"], c["monthlyKwh"])

    # Per (zone,type,month) cohort baseline from NORMAL peers (per m²).
    def expected_per_m2(zid, ctype, mi, exclude_id):
        peers = [cc for cc in config.CUSTOMERS[zid]
                 if cc["type"] == ctype and cc["id"] not in suspects and cc["id"] != exclude_id]
        per_m2 = [series[cc["id"]][mi] / cc["sqMeters"] for cc in peers if cc["sqMeters"]]
        if per_m2:
            return median(per_m2)
        # Fallback: global same-type median per m² this month.
        glob = []
        for z2, cl in config.CUSTOMERS.items():
            for cc in cl:
                if cc["type"] == ctype and cc["id"] not in suspects and cc["sqMeters"]:
                    glob.append(series[cc["id"]][mi] / cc["sqMeters"])
        if glob:
            return median(glob)
        return config.EXPECTED_KWH_PER_SQM.get(ctype, 2.1)

    # Cohort reported per-m² values (all members, incl. suspect) for z-score.
    def cohort_per_m2(zid, ctype, mi):
        return [series[cc["id"]][mi] / cc["sqMeters"]
                for cc in config.CUSTOMERS[zid] if cc["type"] == ctype and cc["sqMeters"]]

    customers = {}  # zone_id -> list of enriched customer dicts
    for zid, custs in config.CUSTOMERS.items():
        enriched = []
        for c in custs:
            rep = series[c["id"]]
            sf = features.series_features(rep)  # series-level features (cv, max_drop…)
            exp_m2 = [expected_per_m2(zid, c["type"], mi, c["id"]) for mi in range(n_months)]
            expected = [round(exp_m2[mi] * c["sqMeters"], 2) for mi in range(n_months)]

            below_flags, dev_pcts, losses, monthly = [], [], [], []
            for mi, mo in enumerate(months):
                e, r = expected[mi], rep[mi]
                shortfall = (e - r) / e if e > 0 else 0.0
                dev_pct = shortfall * 100.0
                below_flags.append(shortfall >= SGCC_STATS["monthly_drop_threshold"])
                dev_pcts.append(round(dev_pct, 1))

                z = features.peer_zscore(r / c["sqMeters"], cohort_per_m2(zid, c["type"], mi))
                yoy = features.yoy_pct_change(rep, mi)
                persist = features.deviation_persistence(below_flags)
                loss = features.estimated_loss_lek(e, r, mo["tariff"])
                losses.append(loss)

                rec = scoring.score_customer_month(
                    max(0.0, shortfall), dev_pct, z, yoy, persist)

                # Optional ML rescore hook (Phase 2/3): blend in an unsupervised
                # or supervised anomaly score while keeping the real deviation.
                if rescore is not None:
                    mf = {"yoy": yoy, "peer_zscore": z, "persistence": persist,
                          "shortfall": max(0.0, shortfall), "cv": sf["cv"],
                          "max_drop": sf["max_drop"], "n_floor": sf["n_floor"]}
                    adj = rescore(c, mi, mf, rec)
                    if adj is not None:
                        lvl = scoring.risk_level_from_score(adj)
                        anom, facs, _tc, _tl = scoring.anomaly_and_factors(
                            max(0.0, shortfall), dev_pct, lvl)
                        rec = {**rec, "risk_score": adj, "risk_level": lvl,
                               "anomaly_type": anom, "alarm_factors": facs}

                monthly.append({
                    "year": mo["year"], "month": mo["month"], "label": mo["label"],
                    "reported_kwh": round(r, 1), "expected_kwh": round(e, 1),
                    "deviation_pct": round(dev_pct, 1),
                    "yoy_pct_change": None if yoy is None else round(yoy, 1),
                    "peer_zscore": round(z, 2),
                    "deviation_persistence": persist,
                    "estimated_loss_lek": round(loss, 1),
                    **{k: rec[k] for k in ("risk_score", "risk_level", "anomaly_type", "alarm_factors")},
                })

            annual_loss = round(sum(losses[-12:]) if n_months >= 12 else sum(losses) * 12 / n_months)
            latest = monthly[-1]
            enriched.append({
                **{k: c[k] for k in ("id", "name", "address", "sqMeters", "floor",
                                     "type", "contractedKw", "meterAge", "building")},
                "is_seeded_suspect": c["id"] in suspects,
                "donor_flag": assignment[c["id"]]["flag"],
                "history_months": [m["key"] for m in months],
                "history_kwh": rep,
                "expected_kwh_series": expected,
                "deviation_pct_series": dev_pcts,
                "monthly": monthly,
                # Latest-month snapshot (what the panels read by default)
                "monthlyKwh": latest["reported_kwh"],
                "expectedKwh": latest["expected_kwh"],
                "deviationPct": latest["deviation_pct"],
                "yoyPct": latest["yoy_pct_change"],
                "peerZscore": latest["peer_zscore"],
                "persistence": latest["deviation_persistence"],
                "riskScore": latest["risk_score"],
                "riskLevel": latest["risk_level"],
                "anomalyType": latest["anomaly_type"],
                "riskFactors": latest["alarm_factors"],
                "inspectionStatus": inspection_status_for(latest["risk_level"]),
                "estLossLek": annual_loss,
            })
        customers[zid] = enriched
    return customers


# ── 5 · Zone state per month = worst-offending meter (+ aggregate loss) ───
def inspection_status_for(level):
    return {"CRITICAL": "INSPECTION_SCHEDULED", "HIGH": "PENDING_REVIEW",
            "MEDIUM": "PENDING_REVIEW"}.get(level, "NOT_FLAGGED")


def zone_state_at(zid, customers, mi):
    custs = customers[zid]
    worst = max(custs, key=lambda c: c["monthly"][mi]["risk_score"])
    m = worst["monthly"][mi]
    annual_loss = 0
    flagged = 0
    for c in custs:
        cm = c["monthly"][mi]
        if cm["risk_level"] in ("HIGH", "CRITICAL", "MEDIUM"):
            flagged += 1
        annual_loss += sum(x["estimated_loss_lek"] for x in c["monthly"][max(0, mi - 11):mi + 1])
    return {
        "expectedKwh": round(m["expected_kwh"]),
        "consumptionKwh": round(m["reported_kwh"]),
        "deviationPct": m["deviation_pct"],
        "riskScore": m["risk_score"],
        "riskLevel": m["risk_level"],
        "anomalyType": m["anomaly_type"],
        "riskFactors": m["alarm_factors"],
        "inspectionStatus": inspection_status_for(m["risk_level"]),
        "estLossLek": round(annual_loss),
        "yoyPct": m["yoy_pct_change"],
        "peerZscore": m["peer_zscore"],
        "persistence": m["deviation_persistence"],
        "worstCustomerId": worst["id"],
        "worstCustomerName": worst["name"],
        "flaggedCount": flagged,
        "monthLabel": m["label"],
        "lastUpdate": EPOCH,
    }


# ── 6 · Metrics + events for a month frame ───────────────────────────────
def month_metrics(zones, accuracy, cumulative_anoms):
    vals = list(zones.values())
    return {
        "criticalCount": sum(1 for s in vals if s["riskLevel"] == "CRITICAL"),
        "highCount":     sum(1 for s in vals if s["riskLevel"] == "HIGH"),
        "mediumCount":   sum(1 for s in vals if s["riskLevel"] == "MEDIUM"),
        "pendingCount":  sum(1 for s in vals if s["inspectionStatus"] in ("PENDING_REVIEW", "INSPECTION_SCHEDULED")),
        "estLossLek":    sum(s["estLossLek"] for s in vals),
        "totalAnomaliesDetected": cumulative_anoms,
        "modelAccuracy": accuracy,
    }


# ── 7 · Assemble all JSON ────────────────────────────────────────────────
def build(rescore=None, accuracy_override=None,
          method_label="rule-based composite (Phase 1)"):
    month_keys, donors = load_dataset()
    months = parse_months(month_keys)
    suspects = mark_suspects()
    customers = build_customers(months, donors, suspects, rescore)

    n_months = len(months)
    replay_start = max(0, n_months - config.REPLAY_MONTHS)
    replay_idx = list(range(replay_start, n_months))

    accuracy = accuracy_override if accuracy_override is not None else rule_based_accuracy(donors)

    # Walk replay months: build frames, detect transitions -> events.
    frames, anomaly_log = [], []
    prev_levels = {}
    cumulative = 14  # carry the original demo's baseline anomaly counter
    ev_seq = 0
    for frame_pos, mi in enumerate(replay_idx):
        zones = {zid: zone_state_at(zid, customers, mi) for zid in config.CUSTOMERS}
        events = []
        for zid, s in zones.items():
            title = config.ZONE_TITLE[zid]
            prev = prev_levels.get(zid, "LOW")
            now = s["riskLevel"]
            rank = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}
            t = EPOCH + (frame_pos * 4000) + ev_seq
            if rank[now] >= 2 and rank[now] > rank[prev]:
                cumulative += 1
                ev_seq += 1
                events.append({
                    "id": t, "nodeId": zid, "level": "warn", "monthLabel": s["monthLabel"],
                    "time": t,
                    "message": (f"CRITICAL NTL risk - {title} - Score {s['riskScore']}"
                                if now == "CRITICAL" else
                                f"High NTL risk - {title} - Score {s['riskScore']}"),
                })
            elif rank[now] <= 1 and rank[prev] >= 2:
                ev_seq += 1
                events.append({
                    "id": t, "nodeId": zid, "level": "ok", "monthLabel": s["monthLabel"],
                    "time": t, "message": f"Risk normalised after review - {title}",
                })
            prev_levels[zid] = now

        metrics = month_metrics(zones, accuracy, cumulative)
        frames.append({"label": months[mi]["label"], "year": months[mi]["year"],
                       "month": months[mi]["month"], "zones": zones,
                       "events": events, "metrics": metrics})
        anomaly_log.extend(events)

    # Most-interesting starting frame = highest total risk.
    start_index = max(range(len(frames)),
                      key=lambda i: sum(z["riskScore"] for z in frames[i]["zones"].values()))

    # Surface one inspector-cleared FALSE_POSITIVE prominently (ethics rule #4).
    fp = inject_false_positive(customers, frames, start_index, anomaly_log)
    # Re-derive the start-frame metrics so pendingCount reflects the cleared flag.
    frames[start_index]["metrics"] = month_metrics(
        frames[start_index]["zones"], accuracy,
        frames[start_index]["metrics"]["totalAnomaliesDetected"])

    start_zones = json.loads(json.dumps(frames[start_index]["zones"]))  # deep copy
    anomaly_log = sorted(anomaly_log, key=lambda e: -e["time"])

    computed_risk = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": "dataset_130consumers_monthly_2024_2026 (labelled) + peer-cohort scoring",
        "disclaimer": "Inspection prioritisation, not theft confirmation.",
        "startIndex": start_index,
        "startMonthLabel": frames[start_index]["label"],
        "months": frames,
        "zones": start_zones,
        "metrics": frames[start_index]["metrics"],
        "tariffByMonth": config.TARIFF_LEK_PER_KWH,
    }

    write("computed_risk.json", computed_risk)
    write("customer_history.json", {
        "generatedAt": computed_risk["generatedAt"],
        "expectedKwhPerSqm": config.EXPECTED_KWH_PER_SQM,
        "zones": customers,
        "falsePositiveCustomerId": fp,
    })
    write("anomaly_log.json", anomaly_log[:40])
    write("inspections.json", [])  # schema lives in README; logging starts day one
    write("model_metrics.json", model_metrics_payload(donors, customers, accuracy, method_label))

    summary(computed_risk, customers, suspects, donors)
    return {"donors": donors, "customers": customers, "months": months, "accuracy": accuracy}


# ── Rule-based detection rate over the labelled donors (honest headline) ──
def rule_based_accuracy(donors):
    tp = tn = fp = fn = 0
    for d in donors:
        s = d["series"]
        first = [v for v in s[:12] if v]
        last = [v for v in s[-12:] if v]
        base = (sum(first) / len(first)) if first else 0
        recent = (sum(last) / len(last)) if last else 0
        sustained_drop = base > 0 and recent < 0.6 * base
        pred = bool(sustained_drop or d["feats"]["n_floor"] > 0)
        truth = d["flag"] == 1
        tp += pred and truth
        tn += (not pred) and (not truth)
        fp += pred and (not truth)
        fn += (not pred) and truth
    total = tp + tn + fp + fn
    bal = 0.0
    if (tp + fn) and (tn + fp):
        bal = 0.5 * (tp / (tp + fn) + tn / (tn + fp))
    acc = (tp + tn) / total if total else 0.0
    # Headline shown in HUD: balanced accuracy (recall-weighted), 1 decimal.
    return round(bal * 100, 1) if bal else round(acc * 100, 1)


def model_metrics_payload(donors, customers, accuracy, method_label="rule-based composite (Phase 1)"):
    n_flag = sum(d["flag"] for d in donors)
    flagged_meters = sum(1 for cl in customers.values() for c in cl
                         if c["riskLevel"] in ("HIGH", "CRITICAL"))
    return {
        "method": method_label,
        "note": "Calibrated on the labelled monthly dataset. Phase 3 XGBoost "
                "(SGCC-illustrative) overwrites modelAccuracy when trained.",
        "modelAccuracy": accuracy,
        "datasetConsumers": len(donors),
        "datasetFlagged": n_flag,
        "datasetTheftRate": round(n_flag / len(donors) * 100, 2) if donors else 0,
        "rosterFlaggedMeters": flagged_meters,
        "calibrationCaveat": "Theft signatures are illustrative of the production "
                             "pipeline and require recalibration on Albanian ground "
                             "truth before operational use.",
    }


def inject_false_positive(customers, frames, start_index, anomaly_log):
    """Clear one genuinely-flagged HIGH meter as an inspector-verified false
    positive (e.g. vacant flat / rooftop solar). This is the core ethics story:
    a statistically high-risk meter that field inspection cleared — flagged is
    not confirmed. The node stays high-risk on the map but its dossier reads
    FALSE_POSITIVE, and the event feed shows it normalised after review."""
    zones = frames[start_index]["zones"]
    # Candidates: HIGH zones driven by a seeded suspect (a real flag, not the
    # single most-critical headline). Pick the lowest-scoring HIGH for realism.
    cands = [(zid, s) for zid, s in zones.items()
             if s["riskLevel"] == "HIGH"
             and any(c["id"] == s["worstCustomerId"] and c["is_seeded_suspect"]
                     for c in customers[zid])]
    if not cands:
        cands = [(zid, s) for zid, s in zones.items() if s["riskLevel"] in ("HIGH", "CRITICAL")]
    if not cands:
        return None
    zid, zs = sorted(cands, key=lambda kv: kv[1]["riskScore"])[0]
    zs["inspectionStatus"] = "FALSE_POSITIVE"

    cust_id = zs["worstCustomerId"]
    for c in customers[zid]:
        if c["id"] == cust_id:
            c["inspectionStatus"] = "FALSE_POSITIVE"
            break

    ev = {"id": EPOCH + 999, "nodeId": zid, "level": "ok",
          "monthLabel": zs["monthLabel"], "time": EPOCH + 999,
          "message": f"Flag cleared by field inspection (false positive) - {config.ZONE_TITLE[zid]}"}
    frames[start_index]["events"].insert(0, ev)
    anomaly_log.append(ev)
    return cust_id


# ── IO helpers ───────────────────────────────────────────────────────────
def write(name, payload):
    config.DATA_OUT.mkdir(parents=True, exist_ok=True)
    path = config.DATA_OUT / name
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"  wrote {path.relative_to(config.ROOT)}  ({path.stat().st_size // 1024} KB)")


def summary(cr, customers, suspects, donors):
    z = cr["zones"]
    crit = [k for k, v in z.items() if v["riskLevel"] == "CRITICAL"]
    high = [k for k, v in z.items() if v["riskLevel"] == "HIGH"]
    print("\nPGOC pipeline · Phase 1 complete")
    print(f"  start frame      : {cr['startMonthLabel']}  (index {cr['startIndex']})")
    print(f"  replay frames    : {len(cr['months'])} months")
    print(f"  donors           : {len(donors)}  (flagged {sum(d['flag'] for d in donors)})")
    print(f"  seeded suspects  : {len(suspects)}")
    print(f"  CRITICAL zones   : {', '.join(crit) or 'none'}")
    print(f"  HIGH zones       : {', '.join(high) or 'none'}")
    print(f"  est annual loss  : {cr['metrics']['estLossLek']:,} LEK  (start frame)")
    print(f"  model accuracy   : {cr['metrics']['modelAccuracy']}%  (rule-based)")


if __name__ == "__main__":
    build()
