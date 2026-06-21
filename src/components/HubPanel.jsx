import { useState, useEffect } from "react";
import { cityNodes } from "../data/cityNodes";
import {
  getAllState, getMonths, getReplayState, goToMonth, pauseReplay, resumeReplay,
  getModelMetrics,
} from "../utils/dataLoader";
import EventFeed from "./EventFeed";
import { can } from "../utils/authStore";

const RISK_COLOR = { LOW: "#00ff88", MEDIUM: "#ffc040", HIGH: "#ff7a30", CRITICAL: "#ff2d2d" };

function CountUpNum({ target, duration = 1000 }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = null, raf;
    const animate = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setVal(Math.floor((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) raf = requestAnimationFrame(animate);
      else setVal(target);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return <>{val.toLocaleString()}</>;
}

export default function HubPanel() {
  const [open, setOpen]       = useState(false);
  const [tick, setTick]       = useState(0);
  const [metrics, setMetrics] = useState(window.__liveMetrics || null);
  const [states, setStates]   = useState(getAllState());
  const [replay, setReplay]   = useState(getReplayState());
  const months                = getMonths();

  // Toggle open on pyramid click
  useEffect(() => {
    const handler = () => {
      if (can("viewHub")) setOpen(o => !o);
    };
    window.addEventListener("pyramidClick", handler);
    return () => window.removeEventListener("pyramidClick", handler);
  }, []);

  // Close automatically when a node is selected on the map
  useEffect(() => {
    const handler = () => setOpen(false);
    window.addEventListener("closeHubPanel", handler);
    return () => window.removeEventListener("closeHubPanel", handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setTick(p => p + 1), 1000);
    const m = (e) => { setMetrics(e.detail); setStates(getAllState()); };
    const r = (e) => setReplay({ index: e.detail.index, label: e.detail.label, total: e.detail.total, paused: e.detail.paused });
    window.addEventListener("metricsUpdate", m);
    window.addEventListener("replayMonth", r);
    return () => {
      clearInterval(t);
      window.removeEventListener("metricsUpdate", m);
      window.removeEventListener("replayMonth", r);
    };
  }, [open]);

  function toggleReplay() {
    if (replay.paused) { resumeReplay(); setReplay(s => ({ ...s, paused: false })); }
    else { pauseReplay(); setReplay(s => ({ ...s, paused: true })); }
  }

  if (!open) return null;

  const critical = metrics?.criticalCount ?? 0;
  const high     = metrics?.highCount ?? 0;
  const pending  = metrics?.pendingCount ?? 0;
  const estLoss  = metrics?.estLossLek ?? 0;
  // Prefer the latest model_metrics.json (updated by the Phase 2/3 ML scripts)
  // so running a model upgrade reflects in the HUD without a full rebuild.
  const accuracy = getModelMetrics()?.modelAccuracy ?? metrics?.modelAccuracy ?? "94.2";

  const sortedNodes = [...cityNodes].sort((a, b) => (states[b.id]?.riskScore ?? 0) - (states[a.id]?.riskScore ?? 0));

  return (
    <div className="hub-panel">
      <div className="hub-panel-header">
        <div>
          <div className="hub-panel-title">▲ NTL COMMAND CENTER</div>
          <div className="hub-panel-sub">AI ENERGY LOSS DETECTION · OSHEE GRID</div>
        </div>
        <button className="hub-panel-close" onClick={() => setOpen(false)}>✕</button>
      </div>

      <div className="hub-metrics">
        <div className="hub-metric">
          <span className="hub-metric-val" style={{ color: "#ff2d2d" }}><CountUpNum target={critical} duration={500} /></span>
          <span className="hub-metric-label">CRITICAL RISK</span>
        </div>
        <div className="hub-metric">
          <span className="hub-metric-val" style={{ color: "#ff7a30" }}><CountUpNum target={high} duration={600} /></span>
          <span className="hub-metric-label">HIGH RISK</span>
        </div>
        <div className="hub-metric">
          <span className="hub-metric-val" style={{ color: "#4db8ff" }}><CountUpNum target={pending} duration={700} /></span>
          <span className="hub-metric-label">PENDING INSPECTION</span>
        </div>
        <div className="hub-metric">
          <span className="hub-metric-val" style={{ color: "#00ff88" }}>{accuracy}%</span>
          <span className="hub-metric-label">MODEL ACCURACY</span>
        </div>
      </div>

      <div className="hub-loss-banner">
        <span className="hub-loss-label">ESTIMATED ANNUAL LOSS DETECTED</span>
        <span className="hub-loss-val"><CountUpNum target={estLoss} duration={1200} /> LEK</span>
      </div>

      {/* ── Historical replay scrubber ───────────────────────── */}
      {months.length > 1 && (
        <div style={{ padding: "8px 14px 10px", borderTop: "1px solid rgba(77,184,255,0.1)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "8px", letterSpacing: "2.5px", color: "#4db8ff", opacity: 0.6 }}>
              HISTORICAL REPLAY · 27-MO BILLING DATA
            </span>
            <span style={{ color: "#ffc040", fontSize: "10px", letterSpacing: "1px", fontWeight: "bold" }}>
              {replay.label || "—"}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              onClick={toggleReplay}
              title={replay.paused ? "Resume replay" : "Pause replay"}
              style={{
                background: "rgba(0,255,255,0.06)", border: "1px solid #00ffff44",
                color: "#00ffff", width: "26px", height: "22px", borderRadius: "2px",
                cursor: "pointer", fontSize: "10px", flexShrink: 0,
                fontFamily: "'Courier New', monospace",
              }}
            >
              {replay.paused ? "▶" : "❚❚"}
            </button>
            <input
              type="range"
              min={0}
              max={months.length - 1}
              value={replay.index}
              onChange={(e) => { goToMonth(Number(e.target.value)); setReplay(s => ({ ...s, paused: true })); }}
              style={{ flex: 1, accentColor: "#00ffff", cursor: "pointer" }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "3px" }}>
            <span style={{ color: "#3a5a8a", fontSize: "8px", letterSpacing: "0.5px" }}>{months[0]?.label}</span>
            <span style={{ color: "#3a5a8a", fontSize: "8px", letterSpacing: "0.5px" }}>{months[months.length - 1]?.label}</span>
          </div>
        </div>
      )}

      <div className="hub-divider" />
      <div className="hub-section-title">LIVE NTL EVENTS</div>
      <div className="hub-events"><EventFeed max={6} /></div>

      <div className="hub-divider" />
      <div className="hub-section-title">ZONES BY RISK SCORE</div>
      <div className="hub-node-list">
        {sortedNodes.map((node, i) => {
          const s = states[node.id];
          const color = RISK_COLOR[s?.riskLevel] || "#00ff88";
          return (
            <div key={node.id} className="hub-node-row" style={{ animationDelay: `${i * 30}ms` }}>
              <span className="hub-node-dot" style={{ color }}>◉</span>
              <span className="hub-node-name">{node.title}</span>
              <span className="hub-node-cat" style={{ color }}>{s?.riskLevel}</span>
              <span className="hub-node-online" style={{ color }}>{s?.riskScore}</span>
            </div>
          );
        })}
      </div>

      <div className="hub-footer">NTL-AI · INNOVATION4ALBANIA · {tick}s SESSION UPTIME</div>
    </div>
  );
}