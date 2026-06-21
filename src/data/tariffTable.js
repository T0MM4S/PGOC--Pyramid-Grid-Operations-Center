// ── PGOC · Albanian seasonal tariff table ────────────────────────────────
// Replaces the old 14.2 LEK/kWh flat rate. Winter peak (heating load), summer
// trough — anchored around the OSHEE ~14.2 LEK/kWh reference so estimated-loss
// figures stay realistic. Mirrored 1:1 in pipeline/config.py (single source).
//
// Loss math everywhere now uses the rate for the month a reading belongs to:
//   estimated_loss_lek = (expected_kwh − reported_kwh) × rate_for_month
//
// month is 1-12 (Jan..Dec).

export const TARIFF_LEK_PER_KWH = {
  1: 16.5, 2: 16.5, 3: 14.8, 4: 13.2, 5: 12.5, 6: 12.5,
  7: 13.0, 8: 13.0, 9: 13.2, 10: 14.2, 11: 15.4, 12: 16.5,
};

// Reference flat rate kept for any legacy annualised display (≈ yearly mean).
export const TARIFF_FLAT_LEK_PER_KWH = 14.2;

export function tariffForMonth(month) {
  return TARIFF_LEK_PER_KWH[month] ?? TARIFF_FLAT_LEK_PER_KWH;
}

// Annualised LEK loss from a monthly shortfall, using the month's own rate ×12
// as a quick estimate when a full 12-month series is not available.
export function annualLossFromMonthly(shortfallKwh, month) {
  return Math.round(Math.max(0, shortfallKwh) * tariffForMonth(month) * 12);
}
