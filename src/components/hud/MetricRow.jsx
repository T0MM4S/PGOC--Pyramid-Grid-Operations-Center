// MetricRow — a single labelled sidebar metric. Supports a compact "row"
// layout (label + value + optional % StatusBar) and a "kpi" tile variant for
// PowerBI-style highlighted metrics. Uses the shared .pgoc-* readability
// utilities so all sidebar text stays on one crisp typographic scale.

function StatusBar({ value, color }) {
  const pct = parseFloat(value);
  if (Number.isNaN(pct)) return null;
  return (
    <div className="hud-statusbar-track">
      <div
        className="hud-statusbar-fill"
        style={{ width: `${Math.min(pct, 100)}%`, background: color }}
      />
    </div>
  );
}

export default function MetricRow({
  label,
  value,
  color,
  variant = "row",
  showBar = false,
  barValue,
  barColor,
}) {
  if (variant === "kpi") {
    return (
      <div className="hud-metric-tile">
        <span className="pgoc-label">{label}</span>
        <span className="pgoc-kpi" style={{ color }}>{value}</span>
      </div>
    );
  }

  return (
    <div className="hud-data-row">
      <span className="pgoc-label">{label}</span>
      <div className="hud-data-right">
        <span className="pgoc-value" style={{ color }}>{value}</span>
        {showBar && <StatusBar value={barValue ?? value} color={barColor ?? color} />}
      </div>
    </div>
  );
}
