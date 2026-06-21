"""
PGOC pipeline · composite rule-based scoring
──────────────────────────────────────────────
Combines the engineered features into a transparent 0-100 inspection-priority
score and maps it to LOW / MEDIUM / HIGH / CRITICAL.

The weighting reflects the brief's signal hierarchy:
    peer cohort deviation (primary)  > year-over-year drop > persistence
Peer comparison dominates because it implicitly controls for weather/season
(identical neighbours share the same conditions).

These scores are an *inspection priority*, never a theft confirmation.
"""

from sgcc_patterns import classify_theft_type, build_factors

# Inspection-urgency thresholds — identical to the frontend risk bands.
W_PEER        = 0.60
W_YOY         = 0.22
W_PERSISTENCE = 0.18

PERSISTENCE_SATURATION = 6  # months of sustained shortfall == full confidence


def _clamp(v, lo, hi):
    return max(lo, min(hi, v))


def risk_level_from_score(score):
    if score >= 80:
        return "CRITICAL"
    if score >= 60:
        return "HIGH"
    if score >= 30:
        return "MEDIUM"
    return "LOW"


def peer_component(shortfall_frac, peer_zscore):
    """0-100 from how far below the cohort baseline the consumer sits.

    Blends the robust shortfall fraction (expected-reported)/expected with the
    z-score so a deep collapse *and* a strong statistical outlier both register.
    """
    from_shortfall = _clamp(shortfall_frac, 0.0, 1.0) * 115.0
    from_z = _clamp(-peer_zscore, 0.0, 4.0) / 4.0 * 100.0
    return _clamp(0.70 * from_shortfall + 0.30 * from_z, 0.0, 100.0)


def yoy_component(yoy_pct):
    """0-100 from a sustained year-over-year drop (secondary tamper signature)."""
    if yoy_pct is None or yoy_pct >= 0:
        return 0.0
    return _clamp((-yoy_pct) / 100.0, 0.0, 1.0) * 110.0


def persistence_component(persistence_months):
    return _clamp(persistence_months / PERSISTENCE_SATURATION, 0.0, 1.0) * 100.0


def composite_score(shortfall_frac, peer_zscore, yoy_pct, persistence_months):
    peer = peer_component(shortfall_frac, peer_zscore)
    yoy = yoy_component(yoy_pct)
    pers = persistence_component(persistence_months)
    score = W_PEER * peer + W_YOY * yoy + W_PERSISTENCE * pers
    return round(_clamp(score, 0.0, 100.0)), {
        "peer": round(peer, 1),
        "yoy": round(yoy, 1),
        "persistence": round(pers, 1),
    }


def anomaly_and_factors(shortfall_frac, deviation_pct, risk_level):
    """Pick the theft signature + alarm-factor strings for a scored record."""
    theft = classify_theft_type(shortfall_frac)
    if theft and risk_level in ("MEDIUM", "HIGH", "CRITICAL"):
        return theft["anomaly"], build_factors(theft, deviation_pct), theft["code"], theft["label"]
    if risk_level == "MEDIUM":
        return "CONSUMPTION_ANOMALY", [], None, None
    return "NONE", [], None, None


def score_customer_month(shortfall_frac, deviation_pct, peer_zscore, yoy_pct, persistence_months):
    """Score one consumer for one month. Returns the full risk record fragment."""
    score, components = composite_score(shortfall_frac, peer_zscore, yoy_pct, persistence_months)
    level = risk_level_from_score(score)
    anomaly, factors, tc_code, tc_label = anomaly_and_factors(shortfall_frac, deviation_pct, level)
    return {
        "risk_score": score,
        "risk_level": level,
        "anomaly_type": anomaly,
        "alarm_factors": factors,
        "tc_code": tc_code,
        "tc_label": tc_label,
        "components": components,
    }
