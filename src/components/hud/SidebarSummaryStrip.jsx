export default function SidebarSummaryStrip({ showAnalytics, onAnalyticsClick }) {
  return (
    <div className="hud-intel">
      <div className="hud-intel-cell">
        <span className="hud-intel-k">TECHNICAL</span>
        <span className="hud-intel-v" style={{ color: "#5dc8ff" }}>LIVE · MAP</span>
        <span className="hud-intel-d">load · voltage · feeders</span>
      </div>
      <div
        className={`hud-intel-cell${showAnalytics ? " clickable" : ""}`}
        onClick={showAnalytics ? onAnalyticsClick : undefined}
        title={showAnalytics ? "Open NTL Analytics" : undefined}
        role={showAnalytics ? "button" : undefined}
        tabIndex={showAnalytics ? 0 : undefined}
        onKeyDown={showAnalytics ? (e) => { if (e.key === "Enter") onAnalyticsClick?.(); } : undefined}
      >
        <span className="hud-intel-k">NON-TECHNICAL</span>
        <span className="hud-intel-v" style={{ color: "#ffc040" }}>
          NTL · AI {showAnalytics ? "▦" : ""}
        </span>
        <span className="hud-intel-d">theft-risk analytics</span>
      </div>
    </div>
  );
}
