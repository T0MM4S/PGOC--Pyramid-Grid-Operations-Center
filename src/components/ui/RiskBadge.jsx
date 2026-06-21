// Risk palette — UNCHANGED (matches dashboard/hub). Kept module-local (not
// exported) so this file only exports a component (react-refresh clean).
const RISK_COLOR = {
  LOW: "#00ff88",
  MEDIUM: "#ffc040",
  HIGH: "#ff7a30",
  CRITICAL: "#ff2d2d",
};

export default function RiskBadge({ level, score, size = "md" }) {
  const color = RISK_COLOR[level] || RISK_COLOR.LOW;
  const cls = size === "sm" ? "pgoc-risk-badge pgoc-risk-badge-sm" : "pgoc-risk-badge";

  return (
    <span className={cls} style={{ color, borderColor: `${color}66`, background: `${color}14` }}>
      {score != null && <span className="pgoc-risk-score">{score}</span>}
      <span>{level}</span>
    </span>
  );
}
