export default function KpiTile({ value, label, color, className = "" }) {
  return (
    <div className={`pgoc-kpi-tile ${className}`.trim()}>
      <span className="pgoc-kpi" style={{ color }}>{value}</span>
      <span className="pgoc-label">{label}</span>
    </div>
  );
}
