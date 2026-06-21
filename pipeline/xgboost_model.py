"""
PGOC pipeline · Phase 3 — XGBoost (supervised, SGCC-illustrative)
──────────────────────────────────────────────────────────────────
Collapses each consumer's 27-month series into engineered features and trains a
class-imbalance-balanced XGBoost classifier on the FLAG labels with stratified
cross-validation. Reports ROC-AUC + a classification report and writes the
validated metrics into public/data/model_metrics.json (HUD headline).

Optional `--apply` blends each meter's predicted theft probability into the
displayed risk scores and rebuilds the JSON.

    python pipeline/xgboost_model.py          # train + CV + update metrics
    python pipeline/xgboost_model.py --apply  # also rebuild blended JSON

Requires: xgboost, scikit-learn, pandas, numpy, joblib
          (pip install -r pipeline/requirements.txt)

CALIBRATION CAVEAT (state this in the demo): this model learns theft signatures
from the labelled set provided. Production fraud scoring in Albania must be
re-calibrated on OSHEE ground truth before operational use — here it is
*illustrative of the production pipeline*, not a deployable fraud model.
"""

import json
import sys

import config
import features
import build_dataset as bd

try:
    import numpy as np
    import pandas as pd
    import xgboost as xgb
    from sklearn.model_selection import StratifiedKFold, cross_val_predict
    from sklearn.metrics import (roc_auc_score, classification_report,
                                 precision_score, recall_score, balanced_accuracy_score)
    import joblib
except ImportError:
    print("[xgboost_model] xgboost / scikit-learn / pandas not installed.")
    print("  pip install -r pipeline/requirements.txt")
    sys.exit(1)

FEATURE_COLS = ["mean", "std", "cv", "min", "max", "skew", "n_floor", "max_drop", "max_spike"]


def feature_frame(donors):
    rows = [{**features.series_features(d["series"]), "FLAG": d["flag"]} for d in donors]
    df = pd.DataFrame(rows)
    return df[FEATURE_COLS], df["FLAG"].astype(int)


def make_clf(scale_pos_weight):
    return xgb.XGBClassifier(
        objective="binary:logistic", eval_metric="aucpr",
        scale_pos_weight=scale_pos_weight, max_depth=3, n_estimators=300,
        learning_rate=0.05, subsample=0.8, colsample_bytree=0.8,
        random_state=config.RANDOM_SEED, n_jobs=2,
    )


def train_and_validate(donors):
    X, y = feature_frame(donors)
    spw = float((y == 0).sum() / max(1, (y == 1).sum()))  # class imbalance weight
    clf = make_clf(spw)

    cv = StratifiedKFold(5, shuffle=True, random_state=0)
    proba = cross_val_predict(clf, X, y, cv=cv, method="predict_proba")[:, 1]
    pred = (proba > 0.5).astype(int)

    auc = float(roc_auc_score(y, proba)) if len(set(y)) > 1 else None
    report = classification_report(y, pred, zero_division=0)

    clf.fit(X, y)  # final model on all data (for importances + apply/export)
    importance = {FEATURE_COLS[i]: round(float(v), 4)
                  for i, v in enumerate(clf.feature_importances_)}

    metrics = {
        "rocAuc": round(auc, 3) if auc is not None else None,
        "precision": round(float(precision_score(y, pred, zero_division=0)), 3),
        "recall": round(float(recall_score(y, pred, zero_division=0)), 3),
        "balancedAccuracy": round(float(balanced_accuracy_score(y, pred)), 3),
        "scalePosWeight": round(spw, 2),
        "nEstimators": 300, "maxDepth": 3, "cvFolds": 5,
        "featureImportance": importance,
        "features": FEATURE_COLS,
    }
    return clf, metrics, report


def merge_metrics(extra):
    path = config.DATA_OUT / "model_metrics.json"
    data = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    data.update(extra)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def build_apply(clf):
    """Blend each meter's predicted theft probability into the displayed risk."""
    base = bd.build()
    proba_by_id = {}
    for zid, cl in base["customers"].items():
        for c in cl:
            f = features.series_features(c["history_kwh"])
            X = pd.DataFrame([[f[k] for k in FEATURE_COLS]], columns=FEATURE_COLS)
            proba_by_id[c["id"]] = float(clf.predict_proba(X)[0, 1])

    _, metrics, _ = train_and_validate(base["donors"])
    acc = round(metrics["balancedAccuracy"] * 100, 1)

    def rescore(c, mi, mf, rec):
        p = proba_by_id.get(c["id"])
        if p is None:
            return None
        return round(0.5 * rec["risk_score"] + 0.5 * (p * 100.0))

    bd.build(rescore=rescore, accuracy_override=acc,
             method_label="XGBoost blended (Phase 3, SGCC-illustrative)")
    merge_metrics({"xgboost": metrics, "modelAccuracy": acc,
                   "method": "XGBoost blended (Phase 3, SGCC-illustrative)",
                   "calibrationCaveat": "Illustrative of the production pipeline; "
                   "re-calibrate on Albanian ground truth before operational use."})
    print(f"\n[xgboost_model] applied · blended scores rebuilt · accuracy {acc}%")


def main():
    apply = "--apply" in sys.argv
    _, donors = bd.load_dataset()
    clf, metrics, report = train_and_validate(donors)

    joblib.dump(clf, config.PIPELINE_DIR / "model.pkl")
    merge_metrics({
        "xgboost": metrics,
        "modelAccuracy": round(metrics["balancedAccuracy"] * 100, 1),
        "method": "XGBoost (Phase 3, SGCC-illustrative)",
        "calibrationCaveat": "Illustrative of the production pipeline; re-calibrate "
                             "on Albanian ground truth before operational use.",
    })

    print("PGOC · Phase 3 · XGBoost (supervised)")
    print(f"  ROC-AUC          : {metrics['rocAuc']}")
    print(f"  precision/recall : {metrics['precision']} / {metrics['recall']}")
    print(f"  balanced acc     : {metrics['balancedAccuracy']}")
    print(f"  scale_pos_weight : {metrics['scalePosWeight']}")
    print("  top features     : " +
          ", ".join(f"{k}={v}" for k, v in sorted(metrics["featureImportance"].items(),
                                                   key=lambda kv: -kv[1])[:4]))
    print("\nclassification report (cross-validated):\n" + report)
    print(f"  saved model -> {(config.PIPELINE_DIR / 'model.pkl').relative_to(config.ROOT)}")

    if apply:
        build_apply(clf)


if __name__ == "__main__":
    main()
