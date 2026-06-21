"""
PGOC pipeline · Phase 2 — Isolation Forest (unsupervised)
───────────────────────────────────────────────────────────
Fits an Isolation Forest over the engineered feature space of the labelled
dataset and validates it against the FLAG ground truth (ROC-AUC, precision,
recall, balanced accuracy). The validated accuracy is written into
public/data/model_metrics.json, which the HUD reads as its headline metric.

Optional `--apply` re-scores the displayed roster by blending the unsupervised
anomaly score with the Phase-1 rule score and rebuilds the JSON (this is the
brief's "anomaly scores replace the rule-based scores in computed_risk.json").

    python pipeline/isolation_forest.py          # validate + update metrics
    python pipeline/isolation_forest.py --apply  # also rebuild blended JSON

Requires: scikit-learn, numpy  (pip install -r pipeline/requirements.txt)
This is unsupervised: it needs no labels to run — labels are used only to
*report* how well it would have done.
"""

import json
import sys

import config
import build_dataset as bd

try:
    import numpy as np
    from sklearn.ensemble import IsolationForest
    from sklearn.metrics import roc_auc_score, precision_score, recall_score, balanced_accuracy_score
except ImportError:
    print("[isolation_forest] scikit-learn / numpy not installed.")
    print("  pip install -r pipeline/requirements.txt")
    sys.exit(1)

CONTAMINATION = 0.0855  # SGCC theft prevalence — calibrates the decision threshold


# ── Donor feature matrix (series-level) ──────────────────────────────────
def donor_matrix(donors):
    X, y = [], []
    for d in donors:
        f = d["feats"]
        s = d["series"]
        first = [v for v in s[:12] if v]
        last = [v for v in s[-12:] if v]
        base = (sum(first) / len(first)) if first else 0.0
        recent = (sum(last) / len(last)) if last else 0.0
        yoy_proxy = (recent - base) / base if base else 0.0
        X.append([f["mean"], f["std"], f["cv"], f["min"], f["max"], f["skew"],
                  f["n_floor"], f["max_drop"], f["max_spike"], yoy_proxy])
        y.append(d["flag"])
    return np.array(X, dtype=float), np.array(y, dtype=int)


def validate(donors):
    X, y = donor_matrix(donors)
    iso = IsolationForest(n_estimators=300, contamination=CONTAMINATION, random_state=config.RANDOM_SEED)
    iso.fit(X)
    anomaly = -iso.score_samples(X)            # higher = more anomalous
    pred = (iso.predict(X) == -1).astype(int)  # 1 = flagged anomaly

    metrics = {
        "rocAuc": round(float(roc_auc_score(y, anomaly)), 3) if len(set(y)) > 1 else None,
        "precision": round(float(precision_score(y, pred, zero_division=0)), 3),
        "recall": round(float(recall_score(y, pred, zero_division=0)), 3),
        "balancedAccuracy": round(float(balanced_accuracy_score(y, pred)), 3),
        "contamination": CONTAMINATION,
        "nEstimators": 300,
        "features": ["mean", "std", "cv", "min", "max", "skew", "n_floor",
                     "max_drop", "max_spike", "yoy_proxy"],
    }
    return iso, metrics


# ── Optional: blend unsupervised score into the displayed roster ──────────
def normalize01(v):
    lo, hi = float(v.min()), float(v.max())
    return (v - lo) / (hi - lo) if hi > lo else v * 0.0


def build_apply():
    """Two-pass rebuild: pass 1 (rule-based) to get per-month features, fit an
    IForest on the roster's per-month vectors, then pass 2 blends the score."""
    base = bd.build()  # pass 1 (rule-based) — also writes baseline JSON
    customers = base["customers"]

    rows, keys = [], []
    for zid, cl in customers.items():
        for c in cl:
            for mi, m in enumerate(c["monthly"]):
                rows.append([
                    (m["yoy_pct_change"] or 0.0),
                    m["peer_zscore"],
                    m["deviation_persistence"],
                    max(0.0, m["deviation_pct"]) / 100.0,
                ])
                keys.append((c["id"], mi))
    X = np.array(rows, dtype=float)
    iso = IsolationForest(n_estimators=300, contamination=CONTAMINATION, random_state=config.RANDOM_SEED)
    iso.fit(X)
    score100 = (normalize01(-iso.score_samples(X)) * 100.0)
    iforest_by_key = {keys[i]: float(score100[i]) for i in range(len(keys))}

    _, val = validate(base["donors"])
    acc = round(val["balancedAccuracy"] * 100, 1)

    def rescore(c, mi, mf, rec):
        s = iforest_by_key.get((c["id"], mi))
        if s is None:
            return None
        return round(0.55 * rec["risk_score"] + 0.45 * s)

    bd.build(rescore=rescore, accuracy_override=acc,
             method_label="Isolation Forest blended (Phase 2, unsupervised)")

    # Enrich model_metrics with the full validation block.
    merge_metrics({"isolationForest": val, "modelAccuracy": acc,
                   "method": "Isolation Forest blended (Phase 2, unsupervised)"})
    print(f"\n[isolation_forest] applied · blended scores rebuilt · accuracy {acc}%")


def merge_metrics(extra):
    path = config.DATA_OUT / "model_metrics.json"
    data = {}
    if path.exists():
        data = json.loads(path.read_text(encoding="utf-8"))
    data.update(extra)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def main():
    apply = "--apply" in sys.argv
    if apply:
        build_apply()
        return

    month_keys, donors = bd.load_dataset()
    _, val = validate(donors)
    acc = round(val["balancedAccuracy"] * 100, 1)
    merge_metrics({
        "isolationForest": val,
        "modelAccuracy": acc,
        "method": "Isolation Forest (Phase 2, unsupervised)",
        "note": "Unsupervised anomaly detector validated against FLAG labels. "
                "Run with --apply to blend into the displayed risk scores.",
    })
    print("PGOC · Phase 2 · Isolation Forest")
    print(f"  ROC-AUC          : {val['rocAuc']}")
    print(f"  precision/recall : {val['precision']} / {val['recall']}")
    print(f"  balanced acc     : {val['balancedAccuracy']}  -> modelAccuracy {acc}%")
    print("  model_metrics.json updated (HUD headline). Use --apply to rescore JSON.")


if __name__ == "__main__":
    main()
