"""
PGOC pipeline · SGCC pattern calibration
─────────────────────────────────────────
Python mirror of src/data/sgccPatterns.jsx. The SGCC dataset (State Grid Corp.
of China, 42,372 customers, 2014-2016, FLAG 0/1, ~8.55% theft) is used here
*only* to calibrate detection thresholds and to map a computed deviation onto a
human-readable theft-signature label + alarm factors.

IMPORTANT (ethics): these labels describe a *signature consistent with* a
pattern. They are inspection hypotheses, never confirmations of theft.
"""

# ── Theft-type signatures (IEEE "Wide & Deep CNN for Electricity-Theft") ──
# Keyed by the depth of the consumption collapse vs. the peer baseline.
THEFT_TYPES = {
    "TC1_BYPASS": {
        "label": "METER BYPASS", "code": "TC1", "anomaly": "METER_TAMPERING",
        "min_drop": 0.80, "min_risk": 82,
        "factors": [
            "Consumption {pct}% below peer baseline - consistent with full meter bypass",
            "Near-zero readings on days inconsistent with declared property occupancy",
            "Load-balance discrepancy detected upstream on sub-feeder line",
        ],
    },
    "TC2_ILLEGAL_LOAD": {
        "label": "ILLEGAL CONNECTION", "code": "TC2", "anomaly": "ILLEGAL_CONNECTION",
        "min_drop": 0.45, "min_risk": 65,
        "factors": [
            "Reported load {pct}% below distribution-transformer balance calculation",
            "Phase asymmetry exceeds 12% threshold on sub-feeder - unaccounted load",
            "Irregular off-peak consumption pattern inconsistent with declared use type",
        ],
    },
    "TC4_TAMPER": {
        "label": "METER TAMPERING", "code": "TC4", "anomaly": "METER_TAMPERING",
        "min_drop": 0.30, "min_risk": 60,
        "factors": [
            "Meter communication pattern matches tamper signature database (SGCC-TC4)",
            "Pulse-interval irregularity {pct}% above factory specification variance",
            "Reported consumption {pct}% under same-cohort neighbours of equal m2",
        ],
    },
    "TC3_GRADUAL": {
        "label": "GRADUAL TAMPERING", "code": "TC3", "anomaly": "CONSUMPTION_ANOMALY",
        "min_drop": 0.15, "min_risk": 40,
        "factors": [
            "Consumption trending down {pct}% over rolling window vs. prior year",
            "Slope deviation from peer group in same sub-district",
            "Monthly variance pattern matches SGCC TC3 gradual-tamper profile",
        ],
    },
}

# Ordered most-severe → least so the first matching tier wins.
THEFT_TYPE_ORDER = ["TC1_BYPASS", "TC2_ILLEGAL_LOAD", "TC4_TAMPER", "TC3_GRADUAL"]

# ── Aggregate SGCC statistics (FLAG=1 vs FLAG=0) ──────────────────────────
SGCC_STATS = {
    "theft_prevalence":       0.0855,   # 8.55% of customers flagged in SGCC
    "avg_deviation_from_norm": -0.612,  # thieves consume ~61% less than expected
    "peer_deviation_sigma":    2.0,     # >2 sigma below cohort -> flag
    "monthly_drop_threshold":  0.25,    # >25% sustained MoM/YoY drop -> suspect
    "zero_day_rate":           0.043,
}


def classify_theft_type(deviation_frac):
    """Map a fractional shortfall vs. peer baseline (0..1) to a theft signature.

    deviation_frac = (expected - reported) / expected. Returns the dict from
    THEFT_TYPES, or None when the shortfall is below the gradual-tamper floor.
    """
    for key in THEFT_TYPE_ORDER:
        t = THEFT_TYPES[key]
        if deviation_frac >= t["min_drop"]:
            return t
    return None


def build_factors(theft_type, deviation_pct):
    """Render a theft type's factor templates with the % shortfall filled in."""
    if not theft_type:
        return []
    pct = abs(round(deviation_pct))
    return [f.replace("{pct}", str(pct)) for f in theft_type["factors"]]
