"""
PGOC pipeline · feature engineering
─────────────────────────────────────
Pure functions (stdlib only) for the per-consumer x month features described in
the brief, plus the collapsed per-consumer series features used by the Phase 2
Isolation Forest and Phase 3 XGBoost models.

    yoy_pct_change        (this_month - same_month_last_year) / last_year * 100
    peer_zscore           z-score of reported vs. same zone+type+month cohort
    deviation_persistence consecutive months flagged below the peer baseline
    estimated_loss_lek    (expected - reported) * tariff_rate_that_month
"""

import math
import statistics


# ── kWh reshape + impute (stdlib analogue of the pandas melt+interpolate) ──
def impute_series(values):
    """Fill missing readings (None / NaN) using linear interpolation, then fall
    back to the consumer's median for any leading/trailing gaps. Never returns
    a None so downstream math is always safe.
    """
    vals = [None if (v is None or (isinstance(v, float) and math.isnan(v))) else float(v) for v in values]
    n = len(vals)
    known = [v for v in vals if v is not None]
    if not known:
        return [0.0] * n
    med = statistics.median(known)

    # Linear interpolation between known anchors.
    out = list(vals)
    i = 0
    while i < n:
        if out[i] is None:
            j = i
            while j < n and out[j] is None:
                j += 1
            left = out[i - 1] if i > 0 else None
            right = out[j] if j < n else None
            if left is not None and right is not None:
                step = (right - left) / (j - i + 1)
                for k in range(i, j):
                    out[k] = left + step * (k - i + 1)
            else:
                fill = left if left is not None else right if right is not None else med
                for k in range(i, j):
                    out[k] = fill
            i = j
        else:
            i += 1
    return [round(v, 2) for v in out]


# ── Per-consumer × month features ────────────────────────────────────────
def yoy_pct_change(values, idx, lag=12):
    """Year-over-year % change at month `idx` vs. the same month `lag` ago.

    Positive = consumption grew, negative = dropped. A sustained negative YoY in
    one consumer that the cohort does not share is a tamper signature.
    """
    if idx < lag:
        return None
    prev = values[idx - lag]
    if prev is None or prev == 0:
        return None
    return (values[idx] - prev) / prev * 100.0


def peer_zscore(value, cohort_values):
    """z-score of `value` against its peer cohort. Negative = below peers.

    Cohort = same zone + consumer type + month (peers share weather/season, so
    this implicitly controls for both — the brief's primary detector).
    """
    peers = [v for v in cohort_values if v is not None]
    if len(peers) < 2:
        return 0.0
    mu = statistics.mean(peers)
    sd = statistics.pstdev(peers)
    if sd == 0:
        return 0.0
    return (value - mu) / sd


def deviation_persistence(below_flags):
    """Count of consecutive trailing months flagged below the peer baseline."""
    count = 0
    for flag in reversed(below_flags):
        if flag:
            count += 1
        else:
            break
    return count


def estimated_loss_lek(expected_kwh, reported_kwh, tariff_rate):
    """Monetary value of the unbilled shortfall for one month (never negative)."""
    shortfall = max(0.0, expected_kwh - reported_kwh)
    return shortfall * tariff_rate


# ── Collapsed per-consumer series features (for the ML phases) ────────────
def _skew(values):
    n = len(values)
    if n < 3:
        return 0.0
    mu = statistics.mean(values)
    sd = statistics.pstdev(values)
    if sd == 0:
        return 0.0
    return sum(((v - mu) / sd) ** 3 for v in values) / n


def series_features(values):
    """Collapse a consumer's monthly series into the engineered feature vector
    (magnitude, dispersion, theft-signature features). Mirrors the user's
    XGBoost sketch: mean/std/cv/min/max/skew/n_floor/max_drop/max_spike.
    """
    vals = [v for v in values if v is not None]
    if not vals:
        return {k: 0.0 for k in
                ("mean", "std", "cv", "min", "max", "skew", "n_floor", "max_drop", "max_spike")}
    mean = statistics.mean(vals)
    std = statistics.pstdev(vals)
    pct_changes = []
    for a, b in zip(vals, vals[1:]):
        if a not in (0, None):
            pct_changes.append((b - a) / a)
    return {
        "mean":      round(mean, 3),
        "std":       round(std, 3),
        "cv":        round(std / mean, 4) if mean else 0.0,
        "min":       round(min(vals), 3),
        "max":       round(max(vals), 3),
        "skew":      round(_skew(vals), 4),
        "n_floor":   sum(1 for v in vals if v <= max(10.0, mean * 0.08)),  # near-zero "tamper floor" months
        "max_drop":  round(min(pct_changes), 4) if pct_changes else 0.0,
        "max_spike": round(max(pct_changes), 4) if pct_changes else 0.0,
    }
