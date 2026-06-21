import { useState, useEffect } from "react";
import { cityNodes } from "../data/cityNodes";
import { getNodeState } from "../utils/dataLoader";
import { can } from "../utils/authStore";
import { subscribeTelemetry, TELEMETRY_STATUS_COLOR } from "../utils/technicalTelemetry";
import CustomerPanel from "./CustomerPanel";


const RISK_COLOR = { LOW: "#00ffff", MEDIUM: "#ffc040", HIGH: "#ff7a30", CRITICAL: "#ff2d2d" };
const ANOMALY_LABEL = {
  NONE: "NO ANOMALY", METER_TAMPERING: "METER TAMPERING",
  ILLEGAL_CONNECTION: "ILLEGAL CONNECTION", CONSUMPTION_ANOMALY: "CONSUMPTION ANOMALY",
};

function CountUp({ target, color, animKey }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = null, raf;
    const animate = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / 800, 1);
      setVal((1 - Math.pow(1 - p, 3)) * target);
      if (p < 1) raf = requestAnimationFrame(animate);
      else setVal(target);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [target, animKey]);
  return <span style={{ color }}>{Math.round(val)}</span>;
}

export default function NodePanel() {
  const [node, setNode]           = useState(null);
  const [liveState, setLiveState] = useState(null);
  const [animKey, setAnimKey]     = useState(0);
  const [tele, setTele]           = useState(null);

  useEffect(() => {
    const handler = (e) => {
      if (!e.detail.id) { setNode(null); return; }
      const found = cityNodes.find(n => n.id === e.detail.id);
      if (found) {
        setNode(found);
        setLiveState(getNodeState(found.id));
        setAnimKey(k => k + 1);
      } else setNode(null);
    };
    window.addEventListener("nodeSelected", handler);
    return () => window.removeEventListener("nodeSelected", handler);
  }, []);

  useEffect(() => {
    if (!node) return;
    const handler = () => setLiveState(getNodeState(node.id));
    window.addEventListener("metricsUpdate", handler);
    return () => window.removeEventListener("metricsUpdate", handler);
  }, [node]);

  // Live TECHNICAL telemetry for the selected zone (separate from NTL risk).
  // setState only happens inside the subscription callback (the recommended
  // external-store pattern); the panel is hidden while no node is selected so a
  // stale reading is never shown.
  useEffect(() => {
    if (!node) return;
    const unsub = subscribeTelemetry((all) => setTele(all[node.id] || null));
    return unsub;
  }, [node]);

  if (!node || !liveState) return null;

  const riskColor = RISK_COLOR[liveState.riskLevel] || "#00ffff";
  const statusColor = tele ? (TELEMETRY_STATUS_COLOR[tele.feederStatus] || "#5dc8ff") : "#5dc8ff";
  const voltColor = tele
    ? (tele.voltagePu < 0.95 || tele.voltagePu > 1.05 ? "#ff2d2d"
      : (tele.voltagePu < 0.965 || tele.voltagePu > 1.035 ? "#ffc040" : "#00ff88"))
    : "#ffffff";

  return (
  <>
    <div className="np-panel" style={{ borderLeftColor: riskColor }}>

      <div className="np-header">
        <div>
          <div className="np-title" style={{ color: riskColor }}>{node.title.toUpperCase()}</div>
          <div className="np-type">DISTRIBUTION ZONE · METER CLUSTER</div>
        </div>
        <button className="np-close" onClick={() => {
          setNode(null);
          window.dispatchEvent(new CustomEvent("nodeSelected", { detail: { id: null } }));
        }}>✕</button>
      </div>

      {/* ── GRID TELEMETRY · LIVE (technical ops layer) ───────── */}
      {tele && (
        <div className="np-tele">
          <div className="np-tele-head">
            <span className="np-tele-title">
              <span className="np-tele-live" style={{ background: statusColor }} />
              GRID TELEMETRY · LIVE
            </span>
            <span className="np-tele-status" style={{ color: statusColor, borderColor: `${statusColor}66`, background: `${statusColor}14` }}>
              {tele.feederStatus}
            </span>
          </div>
          <div className="np-tele-grid">
            <div className="np-tele-cell"><span className="np-tele-v">{tele.loadMW}</span><span className="np-tele-k">LOAD MW</span></div>
            <div className="np-tele-cell"><span className="np-tele-v" style={{ color: voltColor }}>{tele.voltagePu.toFixed(3)}</span><span className="np-tele-k">VOLTAGE pu</span></div>
            <div className="np-tele-cell"><span className="np-tele-v">{tele.technicalLossPct}%</span><span className="np-tele-k">TECH LOSS</span></div>
            <div className="np-tele-cell"><span className="np-tele-v">{tele.transformerTempC}°</span><span className="np-tele-k">TX TEMP C</span></div>
            <div className="np-tele-cell"><span className="np-tele-v" style={{ color: tele.outageCount > 0 ? "#ffc040" : "#ffffff" }}>{tele.outageCount}</span><span className="np-tele-k">OUTAGES</span></div>
            <div className="np-tele-cell"><span className="np-tele-v">{tele.feederKv}kV</span><span className="np-tele-k">MV FEEDER</span></div>
          </div>
          <div className="np-tele-note">SYNTHETIC SCADA OPS FEED · TECHNICAL LAYER</div>
        </div>
      )}

      {/* ── AI · NTL ASSESSMENT (non-technical loss) ──────────── */}
      <div className="np-section-label">
        AI · NTL ASSESSMENT <span className="np-section-sub">(NON-TECHNICAL)</span>
      </div>

      <div className="np-risk-row">
        <div className="np-risk-ring" style={{ borderColor: riskColor }}>
          <span className="np-risk-num"><CountUp target={liveState.riskScore} color={riskColor} animKey={animKey} /></span>
        </div>
        <div className="np-risk-info">
          <div className="np-risk-level" style={{ color: riskColor }}>{liveState.riskLevel} RISK</div>
          <div className="np-risk-anomaly">{ANOMALY_LABEL[liveState.anomalyType]}</div>
        </div>
      </div>

      <div className="np-row">
        <span className="np-label">EXPECTED</span>
        <span className="np-val">{liveState.expectedKwh} kWh</span>
      </div>
      <div className="np-row">
        <span className="np-label">REPORTED</span>
        <span className="np-val" style={{ color: liveState.deviationPct > 15 ? "#ff7a30" : "#ffffff" }}>
          {liveState.consumptionKwh} kWh
        </span>
      </div>
      <div className="np-row">
        <span className="np-label">DEVIATION</span>
        <span className="np-val" style={{ color: riskColor }}>
          {liveState.deviationPct > 0 ? "−" : "+"}{Math.abs(Math.round(liveState.deviationPct))}%
        </span>
      </div>
      <div className="np-row">
        <span className="np-label">INSPECTION</span>
        <span className="np-val" style={{ fontSize: "9px" }}>{liveState.inspectionStatus.replace(/_/g, " ")}</span>
      </div>

      {liveState.riskFactors.length > 0 && (
        <div className="np-factors">
          <div className="np-factors-title">NTL ALARM FACTORS</div>
          {liveState.riskFactors.map((f, i) => (
            <div key={i} className="np-factor-row">
              <span className="np-factor-dot" style={{ color: riskColor }}>▸</span>
              <span className="np-factor-text">{f}</span>
            </div>
          ))}
        </div>
      )}

      {can("viewHub") && (
        <button
          className="np-analytics-link"
          onClick={() => window.dispatchEvent(new CustomEvent("analyticsClick"))}
          title="Open the full NTL Analytics dashboard"
        >
          ▦ OPEN IN NTL ANALYTICS
        </button>
      )}

      <div className="np-footer">
        {node.lat.toFixed(4)}° N · {node.lon.toFixed(4)}° E · {node.id}
      </div>

        </div>

    {can("viewFinancials") && (
      <CustomerPanel nodeId={node.id} nodeTitle={node.title} />
    )}
  </>
);
}