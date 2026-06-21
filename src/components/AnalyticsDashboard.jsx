// ── PGOC · AnalyticsDashboard.jsx ─────────────────────────────────────────
// Modern, interactive dark-mode NTL (Non-Technical Loss) intelligence overlay.
// This is the HOME of all non-technical / loss-detection analytics — the map
// itself shows live *technical* grid telemetry, while this dashboard holds the
// model-driven NTL story (KPI tiles, risk donut, detection trend, loss by zone,
// peer comparison + a searchable, segmented customer table with per-consumer
// 2-year AI reports).
//
// Mirrors the HubPanel open/close contract: toggles on the `analyticsClick`
// window event, closes on ✕ / Esc. All charts are hand-rolled inline SVG / CSS
// — no charting libraries (React 19 peer constraints).
//
// ETHICS: never "theft"/"thief". Customers are "flagged for inspection",
// "suspected", "pending review". The cleared / false-positive case is surfaced
// as a fairness example. Every AI output carries the inspection-priority
// disclaimer (handled in aiExplainer.jsx).

import { useState, useEffect, useMemo, useRef } from "react";
import {
  getAllCustomers, getMonthlyMetrics, getModelMetrics, getZoneCustomers,
} from "../utils/dataLoader";
import { can } from "../utils/authStore";
import { explainConsumerReport, buildPeerComparison } from "../utils/aiExplainer";

// ── Dashboard palette (scoped to this overlay) ──────────────────────────────
const ACCENT = "#00d4ff";
const RISK    = { LOW: "#00d4ff", MEDIUM: "#f59e0b", HIGH: "#f97316", CRITICAL: "#ef4444" };
const RISK_SEV = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
const GROW_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

const STATUS_META = {
  NOT_FLAGGED:          { label: "NORMAL",         color: "#4db8ff" },
  PENDING_REVIEW:       { label: "PENDING REVIEW", color: "#f59e0b" },
  FLAGGED:              { label: "FLAGGED",        color: "#f97316" },
  INSPECTION_SCHEDULED: { label: "FIELD CHECK",    color: "#f97316" },
  CLEARED:              { label: "CLEARED",        color: "#00d4ff" },
  FALSE_POSITIVE:       { label: "FALSE POSITIVE", color: "#5dc8ff" },
};

const TYPE_SHORT = { RESIDENTIAL: "RES", COMMERCIAL: "COM", OFFICE: "OFF", PUBLIC: "PUB" };
const FLAG_STATUSES     = new Set(["FLAGGED", "PENDING_REVIEW", "INSPECTION_SCHEDULED"]);
const PENDING_STATUSES  = new Set(["PENDING_REVIEW", "INSPECTION_SCHEDULED"]);

const clearedOf   = (c) => c.inspectionStatus === "FALSE_POSITIVE" || c.inspectionStatus === "CLEARED";
const fpOf        = (c) => c.inspectionStatus === "FALSE_POSITIVE";
const suspectedOf = (c) => !clearedOf(c) && (c.riskLevel === "HIGH" || c.riskLevel === "CRITICAL" || FLAG_STATUSES.has(c.inspectionStatus));
const pendingOf   = (c) => PENDING_STATUSES.has(c.inspectionStatus);

// ── Formatters ─────────────────────────────────────────────────────────────
const fmtInt = (n) => Math.round(n || 0).toLocaleString();
function fmtCompact(n) {
  const v = Math.abs(n || 0);
  if (v >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return `${Math.round(n || 0)}`;
}
const trim = (s, n) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s || "");

function devDisplay(dev) {
  const d = Math.round(dev || 0);
  return d > 0 ? `−${d}%` : `+${Math.abs(d)}%`;
}
function devColor(dev) {
  if (dev > 55) return RISK.CRITICAL;
  if (dev > 30) return RISK.HIGH;
  if (dev > 15) return RISK.MEDIUM;
  return "#00d4ff";
}

// ── Count-up number (cubic ease, restarts on mount) ─────────────────────────
function CountUp({ target, duration = 900, decimals = 0, suffix = "", prefix = "", compact = false }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = null, raf;
    const tgt = Number(target) || 0;
    const animate = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setVal((1 - Math.pow(1 - p, 3)) * tgt);
      if (p < 1) raf = requestAnimationFrame(animate);
      else setVal(tgt);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  const shown = compact
    ? fmtCompact(val)
    : (decimals > 0 ? val.toFixed(decimals) : Math.round(val).toLocaleString());
  return <>{prefix}{shown}{suffix}</>;
}

// ── Floating tooltip (shared shape across charts) ───────────────────────────
function useTip() {
  const ref = useRef(null);
  const [tip, setTip] = useState(null);
  const show = (e, content) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setTip({ x: e.clientX - r.left, y: e.clientY - r.top, ...content });
  };
  const hide = () => setTip(null);
  return { ref, tip, show, hide };
}
function TipBox({ tip }) {
  if (!tip) return null;
  return (
    <div className="an-tip" style={{ left: tip.x, top: tip.y }}>
      {tip.title && <div className="an-tip-title">{tip.title}</div>}
      {(tip.rows || []).map((r, i) => (
        <div key={i} className="an-tip-row">
          <span className="an-tip-k">{r.k}</span>
          <span className="an-tip-v" style={{ color: r.color || "#fff" }}>{r.v}</span>
        </div>
      ))}
    </div>
  );
}

// ── KPI tile ────────────────────────────────────────────────────────────────
function TrendArrow({ trend }) {
  if (!trend || !trend.dir) return null;
  const up = trend.dir === "up";
  // "good" tells whether an increase is positive (green) or negative (red).
  const positive = trend.good ? up : !up;
  return (
    <span className="an-kpi-trend" style={{ color: positive ? "#22c55e" : "#ef4444" }}>
      {up ? "↑" : "↓"}{trend.label ? ` ${trend.label}` : ""}
    </span>
  );
}
function KpiTile({ icon, label, value, sub, color, decimals = 0, prefix = "", suffix = "", compact = false, trend }) {
  return (
    <div className="an-kpi">
      <div className="an-kpi-top">
        <span className="an-kpi-icon" style={{ color }}>{icon}</span>
        <TrendArrow trend={trend} />
      </div>
      <div className="an-kpi-val" style={{ color }}>
        <CountUp target={value} decimals={decimals} prefix={prefix} suffix={suffix} compact={compact} />
      </div>
      <div className="an-kpi-label">{label}</div>
      {sub && <div className="an-kpi-sub">{sub}</div>}
    </div>
  );
}

// ── Risk distribution donut (hand-rolled SVG, hover + legend grid) ──────────
function Donut({ data, total }) {
  const { ref, tip, show, hide } = useTip();
  const [hover, setHover] = useState(-1);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => setMounted(true)); return () => cancelAnimationFrame(r); }, []);

  const segs = data.filter((d) => d.value > 0);
  const R = 58, SW = 24, C = 2 * Math.PI * R, cx = 80, cy = 80;
  const tipFor = (s, pct) => ({ title: s.label, rows: [
    { k: "Meters", v: s.value, color: s.color },
    { k: "Share", v: `${Math.round(pct * 100)}%`, color: "#fff" },
  ] });
  let acc = 0;

  // The dominant level is surfaced in the donut center for instant read.
  const dominant = [...data].sort((a, b) => b.value - a.value)[0];

  return (
    <div className="an-chart-wrap an-donut-card" ref={ref}>
      <svg viewBox="0 0 160 160" className={`an-donut${mounted ? " an-donut-in" : ""}`}>
        <circle r={R} cx={cx} cy={cy} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={SW} />
        {total > 0 && segs.map((s) => {
          const pct = s.value / total;
          const len = pct * C;
          const isHover = hover === s.idx;
          const el = (
            <circle
              key={s.label} r={R} cx={cx} cy={cy} fill="none"
              stroke={s.color} strokeWidth={SW}
              strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc}
              strokeLinecap="butt"
              className="an-donut-seg"
              style={{
                transform: isHover ? "scale(1.05)" : "scale(1)",
                transformOrigin: `${cx}px ${cy}px`,
                opacity: hover === -1 || isHover ? 1 : 0.4,
              }}
              onMouseEnter={(e) => { setHover(s.idx); show(e, tipFor(s, pct)); }}
              onMouseMove={(e) => show(e, tipFor(s, pct))}
              onMouseLeave={() => { setHover(-1); hide(); }}
            />
          );
          acc += len;
          return el;
        })}
        <text x={cx} y={cy - 6} textAnchor="middle" className="an-donut-total">{total}</text>
        <text x={cx} y={cy + 11} textAnchor="middle" className="an-donut-cap">METERS</text>
        {dominant && dominant.value > 0 && (
          <text x={cx} y={cy + 26} textAnchor="middle" className="an-donut-lead" style={{ fill: dominant.color }}>
            {Math.round((dominant.value / total) * 100)}% {dominant.label}
          </text>
        )}
      </svg>
      <div className="an-legend-grid">
        {data.map((s) => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <div key={s.label} className="an-legend-chip"
              style={{ opacity: hover === -1 || hover === s.idx ? 1 : 0.5 }}
              onMouseEnter={() => setHover(s.idx)} onMouseLeave={() => setHover(-1)}>
              <span className="an-legend-dot" style={{ background: s.color }} />
              <span className="an-legend-chip-label">{s.label}</span>
              <span className="an-legend-chip-val" style={{ color: s.color }}>{s.value}</span>
              <span className="an-legend-chip-pct">{pct}%</span>
            </div>
          );
        })}
      </div>
      <TipBox tip={tip} />
    </div>
  );
}

// ── Detection trend area+line (crosshair snapping + draw-in animation) ──────
function TrendArea({ points }) {
  const { ref, tip, show, hide } = useTip();
  const [idx, setIdx] = useState(-1);
  if (!points || points.length < 2) return <div className="an-empty">No replay frames</div>;

  const W = 520, H = 210, padL = 30, padR = 16, padT = 16, padB = 28;
  const n = points.length;
  const max = Math.max(...points.map((p) => p.value), 1);
  const niceMax = Math.max(2, Math.ceil(max / 2) * 2);
  const x = (i) => padL + (i * (W - padL - padR)) / (n - 1);
  const y = (v) => padT + (1 - v / niceMax) * (H - padT - padB);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)} ${H - padB} L${x(0).toFixed(1)} ${H - padB} Z`;
  const ticks = [0, niceMax / 2, niceMax];

  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    const frac = (((e.clientX - r.left) / r.width) * W - padL) / (W - padL - padR);
    const i = Math.max(0, Math.min(n - 1, Math.round(frac * (n - 1))));
    setIdx(i);
    const p = points[i];
    show(e, { title: p.label, rows: [
      { k: "Flagged zones", v: p.value, color: ACCENT },
      { k: "Critical", v: p.critical, color: RISK.CRITICAL },
      { k: "High", v: p.high, color: RISK.HIGH },
    ] });
  };

  return (
    <div className="an-chart-wrap" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} className="an-svg"
        onMouseMove={onMove} onMouseLeave={() => { setIdx(-1); hide(); }}>
        <defs>
          <linearGradient id="anTrendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity="0.30" />
            <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} y1={y(t)} x2={W - padR} y2={y(t)} className="an-grid" />
            <text x={padL - 5} y={y(t) + 3} textAnchor="end" className="an-axis">{t}</text>
          </g>
        ))}
        <path d={area} fill="url(#anTrendFill)" className="an-area-in" />
        <path d={line} fill="none" stroke={ACCENT} strokeWidth="2"
          pathLength="1" className="an-line-draw" />
        {idx >= 0 && (
          <line x1={x(idx)} y1={padT} x2={x(idx)} y2={H - padB} className="an-crosshair" />
        )}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.value)} r={idx === i ? 4.5 : 2.6}
              fill="#001022" stroke={ACCENT} strokeWidth="1.6" />
            <text x={x(i)} y={H - padB + 13} textAnchor="middle" className="an-axis">
              {(p.label || "").split(" ")[0].slice(0, 3)}
            </text>
          </g>
        ))}
      </svg>
      <TipBox tip={tip} />
    </div>
  );
}

// ── Horizontal bar list (loss-by-zone / top-suspected) ──────────────────────
function BarList({ rows, max, unit }) {
  const { ref, tip, show, hide } = useTip();
  const [hover, setHover] = useState(-1);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => setMounted(true)); return () => cancelAnimationFrame(r); }, []);
  if (!rows.length) return <div className="an-empty">No data in cohort</div>;
  return (
    <div className="an-chart-wrap an-bars" ref={ref}>
      {rows.map((r, i) => {
        const pct = Math.max(2, (r.value / (max || 1)) * 100);
        const dim = hover !== -1 && hover !== i;
        return (
          <div key={i} className="an-bar-row" style={{ opacity: dim ? 0.5 : 1 }}
            onMouseEnter={(e) => { setHover(i); show(e, { title: r.label, rows: [
              { k: r.tipKey || "Value", v: r.valueLabel, color: r.color },
              ...(r.sub ? [{ k: "Detail", v: r.sub, color: "#cfe" }] : []),
            ] }); }}
            onMouseMove={(e) => show(e, { title: r.label, rows: [
              { k: r.tipKey || "Value", v: r.valueLabel, color: r.color },
              ...(r.sub ? [{ k: "Detail", v: r.sub, color: "#cfe" }] : []),
            ] })}
            onMouseLeave={() => { setHover(-1); hide(); }}>
            <div className="an-bar-head">
              <span className="an-bar-name" title={r.label}>{r.label}</span>
              <span className="an-bar-amt" style={{ color: r.color }}>{r.valueLabel}</span>
            </div>
            <div className="an-bar-track">
              <div className="an-bar-fill"
                style={{
                  width: mounted ? `${pct}%` : "0%",
                  background: r.color,
                  opacity: hover === i ? 1 : 0.78,
                  borderTop: hover === i ? `1px solid ${ACCENT}` : "1px solid transparent",
                  transition: `width 0.6s ${GROW_EASE}, opacity 0.15s ease`,
                }} />
            </div>
            {r.sub && <div className="an-bar-subtxt">{r.sub}</div>}
          </div>
        );
      })}
      {unit && <div className="an-bars-unit">{unit}</div>}
      <TipBox tip={tip} />
    </div>
  );
}

// ── Reported vs Expected grouped bars (SVG, hover + grow-in) ────────────────
function PeerBars({ groups }) {
  const { ref, tip, show, hide } = useTip();
  const [hover, setHover] = useState(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => setMounted(true)); return () => cancelAnimationFrame(r); }, []);
  if (!groups || !groups.length) return <div className="an-empty">No cohort data</div>;

  const W = 360, H = 200, padL = 32, padR = 12, padT = 14, padB = 30;
  const max = Math.max(...groups.flatMap((g) => [g.reported, g.expected]), 1);
  const niceMax = Math.max(50, Math.ceil(max / 50) * 50);
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const groupW = plotW / groups.length;
  const barW = Math.min(22, groupW / 3.2);
  const y = (v) => padT + (1 - v / niceMax) * plotH;
  const ticks = [0, niceMax / 2, niceMax];

  const bar = (key, gx, val, color, label) => {
    const isHover = hover === key;
    const h = H - padB - y(val);
    return (
      <g key={key}>
        <rect x={gx} y={y(val)} width={barW} height={Math.max(0, h)} rx="1.5" fill={color}
          className="an-vbar"
          style={{
            transform: mounted ? "scaleY(1)" : "scaleY(0)",
            transformBox: "fill-box", transformOrigin: "bottom",
            transition: `transform 0.6s ${GROW_EASE}`,
            opacity: hover === null || isHover ? 1 : 0.55,
          }}
          onMouseEnter={(e) => { setHover(key); show(e, { title: label, rows: [{ k: "Avg kWh", v: Math.round(val), color }] }); }}
          onMouseMove={(e) => show(e, { title: label, rows: [{ k: "Avg kWh", v: Math.round(val), color }] })}
          onMouseLeave={() => { setHover(null); hide(); }} />
        {isHover && <rect x={gx} y={y(val)} width={barW} height="2" fill={ACCENT} style={{ pointerEvents: "none" }} />}
      </g>
    );
  };

  return (
    <div className="an-chart-wrap" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} className="an-svg">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} y1={y(t)} x2={W - padR} y2={y(t)} className="an-grid" />
            <text x={padL - 5} y={y(t) + 3} textAnchor="end" className="an-axis">{Math.round(t)}</text>
          </g>
        ))}
        {groups.map((g, i) => {
          const gx = padL + i * groupW + groupW / 2;
          const rx = gx - barW - 2, ex = gx + 2;
          return (
            <g key={g.type}>
              {bar(`${g.type}-rep`, rx, g.reported, ACCENT, `${g.type} · reported`)}
              {bar(`${g.type}-exp`, ex, g.expected, "#1a6fff", `${g.type} · expected (peer)`)}
              <text x={gx} y={H - padB + 13} textAnchor="middle" className="an-axis">
                {TYPE_SHORT[g.type] || g.type.slice(0, 3)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="an-chart-legend">
        <span><span className="an-legend-dot" style={{ background: ACCENT }} /> REPORTED</span>
        <span><span className="an-legend-dot" style={{ background: "#1a6fff" }} /> EXPECTED (PEER)</span>
      </div>
      <TipBox tip={tip} />
    </div>
  );
}

// ── 24-month consumption chart for the Report modal (two series) ────────────
function ConsumptionChart({ months, reported, expected }) {
  const { ref, tip, show, hide } = useTip();
  const [idx, setIdx] = useState(-1);
  if (!months.length) return <div className="an-empty">No 24-month history for this meter</div>;

  const W = 720, H = 260, padL = 38, padR = 16, padT = 18, padB = 34;
  const n = months.length;
  const max = Math.max(...reported, ...expected, 1);
  const niceMax = Math.ceil(max / 50) * 50 || 50;
  const x = (i) => padL + (i * (W - padL - padR)) / (n - 1);
  const y = (v) => padT + (1 - v / niceMax) * (H - padT - padB);
  const path = (arr) => arr.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const repArea = `${path(reported)} L${x(n - 1)} ${H - padB} L${x(0)} ${H - padB} Z`;
  const ticks = [0, niceMax / 2, niceMax];

  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    const frac = (((e.clientX - r.left) / r.width) * W - padL) / (W - padL - padR);
    const i = Math.max(0, Math.min(n - 1, Math.round(frac * (n - 1))));
    setIdx(i);
    const rep = Math.round(reported[i]); const exp = Math.round(expected[i]);
    const dev = exp > 0 ? Math.round(((exp - rep) / exp) * 100) : 0;
    show(e, { title: months[i], rows: [
      { k: "Reported", v: `${rep} kWh`, color: ACCENT },
      { k: "Expected", v: `${exp} kWh`, color: "#94a3b8" },
      { k: "Deviation", v: dev > 0 ? `−${dev}%` : `+${Math.abs(dev)}%`, color: devColor(dev) },
    ] });
  };

  const everyN = Math.ceil(n / 12);
  return (
    <div className="an-chart-wrap" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} className="an-svg"
        onMouseMove={onMove} onMouseLeave={() => { setIdx(-1); hide(); }}>
        <defs>
          <linearGradient id="anRepFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity="0.26" />
            <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} y1={y(t)} x2={W - padR} y2={y(t)} className="an-grid" />
            <text x={padL - 6} y={y(t) + 3} textAnchor="end" className="an-axis">{Math.round(t)}</text>
          </g>
        ))}
        <path d={repArea} fill="url(#anRepFill)" className="an-area-in" />
        <path d={path(expected)} fill="none" stroke="#94a3b8" strokeWidth="1.6"
          strokeDasharray="5 4" pathLength="1" className="an-line-draw an-line-draw-slow" />
        <path d={path(reported)} fill="none" stroke={ACCENT} strokeWidth="2.2"
          pathLength="1" className="an-line-draw" />
        {idx >= 0 && <line x1={x(idx)} y1={padT} x2={x(idx)} y2={H - padB} className="an-crosshair" />}
        {idx >= 0 && (
          <>
            <circle cx={x(idx)} cy={y(reported[idx])} r="4" fill="#001022" stroke={ACCENT} strokeWidth="1.8" />
            <circle cx={x(idx)} cy={y(expected[idx])} r="3.5" fill="#001022" stroke="#94a3b8" strokeWidth="1.6" />
          </>
        )}
        {months.map((m, i) => (i % everyN === 0 ? (
          <text key={i} x={x(i)} y={H - padB + 14} textAnchor="middle" className="an-axis">{m}</text>
        ) : null))}
      </svg>
      <div className="an-chart-legend">
        <span><span className="an-legend-dot" style={{ background: ACCENT }} /> REPORTED kWh</span>
        <span><span className="an-legend-dot" style={{ background: "#94a3b8" }} /> EXPECTED kWh (PEER)</span>
      </div>
      <TipBox tip={tip} />
    </div>
  );
}

// ── Filled risk pill (table) ────────────────────────────────────────────────
function RiskPill({ level }) {
  return <span className="an-pill" style={{ background: RISK[level] || RISK.LOW }}>{level}</span>;
}
function Chip({ text, color }) {
  return <span className="an-chip" style={{ color, background: `${color}1f`, borderColor: `${color}55` }}>{text}</span>;
}

// ── PDF export (dependency-free: print a clean report doc to PDF) ────────────
function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}
function exportReportPdf(c, peer, aiText) {
  const months   = (c.history_months || []).slice(-24);
  const reported = (c.history_kwh || []).slice(-24);
  const expected = (c.expected_kwh_series || []).slice(-24);
  const rows = months.map((m, i) => {
    const r = Math.round(reported[i] ?? 0), e = Math.round(expected[i] ?? 0);
    const d = e > 0 ? Math.round(((e - r) / e) * 100) : 0;
    return `<tr><td>${escapeHtml(m)}</td><td class="r">${r}</td><td class="r">${e}</td><td class="r">${d > 0 ? "-" : "+"}${Math.abs(d)}%</td></tr>`;
  }).join("");
  const peerLine = peer
    ? `Reports <b>${peer.consumerReported} kWh</b> vs peer average <b>${peer.avgReported} kWh</b> (${peer.repVsPeerPct > 0 ? "+" : ""}${peer.repVsPeerPct}% vs peers). Deviation rank #${peer.rank} of ${peer.cohortCount} in zone.`
    : "Insufficient peer data for comparison.";
  const aiHtml = aiText
    ? aiText.split("\n").filter((l) => l.trim()).map((l) => `<p>${escapeHtml(l)}</p>`).join("")
    : "<p><em>AI analysis was not generated for this report.</em></p>";

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>NTL Report — ${escapeHtml(c.name)}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:32px;font-size:12px;}
  h1{font-size:20px;margin:0 0 2px;} h2{font-size:13px;margin:22px 0 8px;border-bottom:1px solid #ccc;padding-bottom:4px;color:#0a558c;}
  .meta{color:#555;font-size:12px;margin-bottom:4px;}
  table{border-collapse:collapse;width:100%;margin-top:6px;} th,td{border:1px solid #ddd;padding:4px 8px;} th{background:#f3f6fb;text-align:left;} td.r,th.r{text-align:right;}
  .peer{background:#f3f9ff;border:1px solid #d6e6f5;padding:10px 12px;border-radius:6px;}
  .ai p{margin:0 0 8px;line-height:1.6;} .disc{margin-top:24px;color:#777;font-size:11px;border-top:1px solid #ccc;padding-top:8px;}
</style></head><body>
  <h1>NTL Consumer Report</h1>
  <div class="meta">${escapeHtml(c.name)} · ${escapeHtml(c.zoneTitle || "")} · ${escapeHtml(c.type)} · ${c.sqMeters} m² · Meter ${escapeHtml(String(c.id))}</div>
  <div class="meta">Risk: <b>${escapeHtml(c.riskLevel)}</b> (score ${c.riskScore}) · Inspection: ${escapeHtml((c.inspectionStatus || "—").replace(/_/g, " "))} · Est. loss: ${typeof c.estLossLek === "number" ? c.estLossLek.toLocaleString() + " LEK/yr" : "n/a"}</div>
  <h2>Peer comparison</h2>
  <div class="peer">${peerLine}</div>
  <h2>AI analysis (Albanian)</h2>
  <div class="ai">${aiHtml}</div>
  <h2>24-month consumption</h2>
  <table><thead><tr><th>Month</th><th class="r">Reported kWh</th><th class="r">Expected kWh</th><th class="r">Deviation</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="disc">PRIORITIZIM PËR INSPEKTIM · JO KONSTATIM VJEDHJEJE — flagged for inspection, not confirmed theft. Generated ${new Date().toLocaleString()}.</div>
</body></html>`;

  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  iframe.contentWindow.focus();
  setTimeout(() => {
    iframe.contentWindow.print();
    setTimeout(() => { try { document.body.removeChild(iframe); } catch { /* already gone */ } }, 1500);
  }, 350);
}

// ── Per-consumer 2-year Report modal ────────────────────────────────────────
function ReportModal({ customer, onClose }) {
  const [ai, setAi] = useState({ loading: true, text: "", error: "" });

  const cohort = useMemo(() => getZoneCustomers(customer.zoneId) || [], [customer]);
  const peer   = useMemo(() => buildPeerComparison(customer, cohort), [customer, cohort]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  useEffect(() => {
    let alive = true;
    setAi({ loading: true, text: "", error: "" });
    explainConsumerReport(customer, cohort)
      .then((res) => { if (!alive) return; res.success ? setAi({ loading: false, text: res.text, error: "" }) : setAi({ loading: false, text: "", error: res.error || "AI unavailable" }); })
      .catch((err) => { if (alive) setAi({ loading: false, text: "", error: String(err?.message || err) }); });
    return () => { alive = false; };
  }, [customer, cohort]);

  const months   = (customer.history_months || []).slice(-24);
  const reported = (customer.history_kwh || []).slice(-24);
  const expected = (customer.expected_kwh_series || []).slice(-24);
  const sMeta = STATUS_META[customer.inspectionStatus] || { label: (customer.inspectionStatus || "—").replace(/_/g, " "), color: "#4db8ff" };

  return (
    <div className="an-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="an-modal" role="dialog" aria-label={`Report · ${customer.name}`}>
        <div className="an-modal-head">
          <div className="an-modal-head-l">
            <div className="an-modal-title">{customer.name} <RiskPill level={customer.riskLevel} /></div>
            <div className="an-modal-meta">
              <span>{customer.zoneTitle}</span><span className="an-dot-sep">·</span>
              <span>{customer.type} · {customer.sqMeters} m²</span><span className="an-dot-sep">·</span>
              <span>METER {customer.id}</span><span className="an-dot-sep">·</span>
              <Chip text={sMeta.label} color={sMeta.color} />
            </div>
          </div>
          <button className="an-close" onClick={onClose} title="Close (Esc)">✕</button>
        </div>

        <div className="an-modal-body">
          {peer && (
            <div className="an-peer-strip">
              <div className="an-peer-cell">
                <span className="an-peer-k">THIS METER</span>
                <span className="an-peer-v" style={{ color: ACCENT }}>{peer.consumerReported} kWh</span>
              </div>
              <div className="an-peer-cell">
                <span className="an-peer-k">PEER AVG · {customer.type}</span>
                <span className="an-peer-v">{peer.avgReported} kWh</span>
              </div>
              <div className="an-peer-cell">
                <span className="an-peer-k">VS PEERS</span>
                <span className="an-peer-v" style={{ color: peer.repVsPeerPct < -10 ? RISK.HIGH : "#cfe3f5" }}>
                  {peer.repVsPeerPct > 0 ? "+" : ""}{peer.repVsPeerPct}%
                </span>
              </div>
              <div className="an-peer-cell">
                <span className="an-peer-k">DEVIATION RANK</span>
                <span className="an-peer-v">#{peer.rank} / {peer.cohortCount}</span>
              </div>
            </div>
          )}

          <div className="an-modal-section-title">24-MONTH ENERGY CONSUMPTION <span className="an-card-unit">reported vs expected · kWh</span></div>
          <ConsumptionChart months={months} reported={reported} expected={expected} />

          <div className="an-modal-section-title" style={{ marginTop: "18px" }}>AI ANALYSIS <span className="an-card-unit">Gemini · peer comparison · shqip</span></div>
          <div className="an-ai-block">
            {ai.loading ? (
              <div className="an-ai-loading"><span className="an-spinner" /> Po analizohet historiku 24-mujor dhe krahasimi me fqinjët…</div>
            ) : ai.error ? (
              <div className="an-ai-error">AI e padisponueshme: {ai.error}</div>
            ) : (
              <div className="an-ai-text">{ai.text}</div>
            )}
          </div>
        </div>

        <div className="an-modal-foot">
          <span className="an-modal-foot-note">PRIORITIZIM PËR INSPEKTIM · JO KONSTATIM VJEDHJEJE</span>
          <div className="an-modal-foot-btns">
            <button className="an-btn an-btn-outline" onClick={() => exportReportPdf(customer, peer, ai.text)} title="Print / save as PDF">⬇ EXPORT PDF</button>
            <button className="an-btn" onClick={onClose}>CLOSE</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Table config ────────────────────────────────────────────────────────────
const TABS = [
  { id: "all",       label: "ALL" },
  { id: "suspected", label: "SUSPECTED" },
  { id: "cleared",   label: "CLEARED / FALSE+" },
];

const COLS = [
  { key: "name",             label: "CUSTOMER",   align: "left",   str: true },
  { key: "zoneTitle",        label: "ZONE",       align: "left",   str: true },
  { key: "type",             label: "TYPE",       align: "left",   str: true },
  { key: "monthlyKwh",       label: "REPORTED",   align: "right" },
  { key: "expectedKwh",      label: "EXPECTED",   align: "right" },
  { key: "deviationPct",     label: "DEV",        align: "right" },
  { key: "yoyPct",           label: "YoY",        align: "right" },
  { key: "riskLevel",        label: "RISK",       align: "center" },
  { key: "inspectionStatus", label: "INSPECTION", align: "left" },
  { key: "estLossLek",       label: "EST. LOSS",  align: "right" },
];

function sortVal(c, key) {
  if (key === "riskLevel") return RISK_SEV[c.riskLevel] ?? 0;
  const v = c[key];
  if (typeof v === "string") return v.toLowerCase();
  return v == null ? -Infinity : v;
}

function deltaTrend(list, key, good) {
  if (!list || list.length < 2) return null;
  const a = list[list.length - 2]?.[key];
  const b = list[list.length - 1]?.[key];
  if (typeof a !== "number" || typeof b !== "number" || a === b) return null;
  return { dir: b > a ? "up" : "down", good };
}

export default function AnalyticsDashboard() {
  const [open, setOpen] = useState(false);
  const [tab, setTab]   = useState("all");
  const [q, setQ]       = useState("");
  const [sort, setSort] = useState({ key: "estLossLek", dir: "desc" });
  const [reportCustomer, setReportCustomer] = useState(null);

  // Toggle on the center-nav analytics button (mirror HubPanel's pyramidClick)
  useEffect(() => {
    const handler = () => { if (can("viewHub")) setOpen((o) => !o); };
    window.addEventListener("analyticsClick", handler);
    return () => window.removeEventListener("analyticsClick", handler);
  }, []);

  // Broadcast open state so the HUD button can reflect it; close the Hub panel
  // when we open so the two big overlays never stack.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("analyticsOpen", { detail: { open } }));
    if (open) window.dispatchEvent(new CustomEvent("closeHubPanel"));
    if (!open) setReportCustomer(null);
  }, [open]);

  // Esc closes the dashboard (but let an open Report modal handle its own Esc).
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape" && !reportCustomer) setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, reportCustomer]);

  const customers = useMemo(() => (open ? getAllCustomers() : []), [open]);
  const mm = getModelMetrics() || {};
  const monthly = useMemo(() => (open ? getMonthlyMetrics() : []), [open]);

  const stats = useMemo(() => {
    const byLevel = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    let highCrit = 0, suspected = 0, pending = 0, cleared = 0, fp = 0, flaggedLoss = 0;
    for (const c of customers) {
      byLevel[c.riskLevel] = (byLevel[c.riskLevel] || 0) + 1;
      if (c.riskLevel === "HIGH" || c.riskLevel === "CRITICAL") highCrit++;
      if (clearedOf(c)) { cleared++; if (fpOf(c)) fp++; }
      if (suspectedOf(c)) { suspected++; flaggedLoss += c.estLossLek || 0; }
      if (pendingOf(c)) pending++;
    }
    return { N: customers.length, byLevel, highCrit, suspected, pending, cleared, fp, flaggedLoss };
  }, [customers]);

  const donutData = useMemo(() => ([
    { label: "LOW",      value: stats.byLevel.LOW,      color: RISK.LOW,      idx: 0 },
    { label: "MEDIUM",   value: stats.byLevel.MEDIUM,   color: RISK.MEDIUM,   idx: 1 },
    { label: "HIGH",     value: stats.byLevel.HIGH,     color: RISK.HIGH,     idx: 2 },
    { label: "CRITICAL", value: stats.byLevel.CRITICAL, color: RISK.CRITICAL, idx: 3 },
  ]), [stats]);

  const lossByZone = useMemo(() => {
    const m = {};
    for (const c of customers) m[c.zoneTitle] = (m[c.zoneTitle] || 0) + (c.estLossLek || 0);
    return Object.entries(m).map(([label, value]) => ({
      label, value, color: RISK.HIGH, valueLabel: `${fmtCompact(value)} LEK`, tipKey: "Est. loss",
    })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [customers]);

  const topMeters = useMemo(() => (
    customers.filter(suspectedOf)
      .sort((a, b) => (b.estLossLek || 0) - (a.estLossLek || 0))
      .slice(0, 8)
      .map((c) => ({
        label: c.name,
        value: c.estLossLek || 0,
        valueLabel: `${fmtCompact(c.estLossLek || 0)} LEK`,
        color: RISK[c.riskLevel] || RISK.HIGH,
        tipKey: "Est. loss",
        sub: `${trim(c.zoneTitle, 18)} · dev ${devDisplay(c.deviationPct)}`,
      }))
  ), [customers]);

  const peerByType = useMemo(() => {
    const agg = {};
    for (const c of customers) {
      const t = c.type || "OTHER";
      (agg[t] = agg[t] || { rep: 0, exp: 0, n: 0 });
      agg[t].rep += c.monthlyKwh || 0;
      agg[t].exp += c.expectedKwh || 0;
      agg[t].n += 1;
    }
    const ORDER = ["RESIDENTIAL", "COMMERCIAL", "OFFICE", "PUBLIC"];
    return Object.entries(agg)
      .map(([type, v]) => ({ type, reported: v.rep / v.n, expected: v.exp / v.n, n: v.n }))
      .sort((a, b) => (ORDER.indexOf(a.type) - ORDER.indexOf(b.type)));
  }, [customers]);

  const trend = useMemo(() => (
    monthly.map((m) => ({
      label: m.label,
      value: (m.criticalCount || 0) + (m.highCount || 0),
      critical: m.criticalCount || 0,
      high: m.highCount || 0,
    }))
  ), [monthly]);

  const filtered = useMemo(() => {
    let rows = customers;
    if (tab === "suspected") rows = rows.filter(suspectedOf);
    else if (tab === "cleared") rows = rows.filter(clearedOf);
    const term = q.trim().toLowerCase();
    if (term) {
      rows = rows.filter((c) =>
        (c.name || "").toLowerCase().includes(term) ||
        (c.zoneTitle || "").toLowerCase().includes(term) ||
        (c.type || "").toLowerCase().includes(term) ||
        (c.address || "").toLowerCase().includes(term));
    }
    const mul = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = sortVal(a, sort.key), bv = sortVal(b, sort.key);
      if (typeof av === "string") return av.localeCompare(bv) * mul;
      return (av - bv) * mul;
    });
  }, [customers, tab, q, sort]);

  function toggleSort(col) {
    setSort((s) => s.key === col.key
      ? { key: col.key, dir: s.dir === "asc" ? "desc" : "asc" }
      : { key: col.key, dir: col.str ? "asc" : "desc" });
  }

  const tabCount = (id) => {
    if (id === "suspected") return stats.suspected;
    if (id === "cleared") return stats.cleared;
    return stats.N;
  };

  if (!open) return null;

  const lossMax  = lossByZone[0]?.value || 1;
  const meterMax = topMeters[0]?.value || 1;
  const accuracy = mm.modelAccuracy ?? 92.1;

  return (
    <div className="an-overlay" role="dialog" aria-label="NTL Analytics">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="an-header">
        <div className="an-title-block">
          <div className="an-title">▦ NTL ANALYTICS</div>
          <div className="an-sub">NON-TECHNICAL LOSS INTELLIGENCE · OSHEE GRID</div>
        </div>
        <div className="an-headmeta">
          <div className="an-meta-item">
            <span className="an-meta-k">MODEL</span>
            <span className="an-meta-v">{mm.method || "rule-based composite"}</span>
          </div>
          <div className="an-meta-item">
            <span className="an-meta-k">ACCURACY</span>
            <span className="an-meta-v" style={{ color: "#22c55e" }}>{accuracy}%</span>
          </div>
          <button className="an-close" onClick={() => setOpen(false)} title="Close (Esc)">✕</button>
        </div>
      </div>

      <div className="an-body">
        {customers.length === 0 ? (
          <div className="an-empty" style={{ padding: "40px" }}>NTL dataset unavailable — run the pipeline.</div>
        ) : (
        <>
          {/* ── KPI tiles ───────────────────────────────────── */}
          <div className="an-kpi-row">
            <KpiTile icon="⚠" label="CRITICAL"             value={stats.byLevel.CRITICAL} color={RISK.CRITICAL} sub="immediate priority" trend={deltaTrend(monthly, "criticalCount", false)} />
            <KpiTile icon="▲" label="HIGH RISK"            value={stats.byLevel.HIGH}     color={RISK.HIGH}     sub="priority risk"     trend={deltaTrend(monthly, "highCount", false)} />
            <KpiTile icon="⚑" label="FLAGGED FOR INSPECTION" value={stats.suspected}      color={RISK.MEDIUM}   sub="suspected cohort" />
            <KpiTile icon="◷" label="PENDING INSPECTIONS"  value={stats.pending}          color={ACCENT}        sub="awaiting field check" trend={deltaTrend(monthly, "pendingCount", false)} />
            <KpiTile icon="◆" label="EST. ANNUAL LOSS"     value={stats.flaggedLoss}      color={RISK.HIGH}     suffix=" LEK" compact sub="flagged meters" trend={deltaTrend(monthly, "estLossLek", false)} />
            <KpiTile icon="◎" label="MODEL ACCURACY"       value={accuracy}               color="#22c55e"       decimals={1} suffix="%" sub="labelled set" trend={deltaTrend(monthly, "modelAccuracy", true)} />
            <KpiTile icon="◉" label="METERS ANALYZED"      value={stats.N}                color={ACCENT}        sub="enriched roster" />
            <KpiTile icon="✓" label="FALSE POSITIVES"      value={stats.fp}               color="#5dc8ff"       sub="cleared · fairness" />
          </div>

          {/* ── Row 2: detection trend (area) + risk donut ──── */}
          <div className="an-row-2">
            <div className="an-card">
              <div className="an-card-title">DETECTION TREND <span className="an-card-unit">flagged zones / month</span></div>
              <TrendArea points={trend} />
            </div>
            <div className="an-card an-card-donut">
              <div className="an-card-title">RISK DISTRIBUTION</div>
              <Donut data={donutData} total={stats.N} />
            </div>
          </div>

          {/* ── Row 3: bar charts side by side ──────────────── */}
          <div className="an-row-3">
            <div className="an-card">
              <div className="an-card-title">EST. ANNUAL LOSS BY ZONE <span className="an-card-unit">LEK</span></div>
              <BarList rows={lossByZone} max={lossMax} />
            </div>
            <div className="an-card">
              <div className="an-card-title">TOP SUSPECTED METERS <span className="an-card-unit">est. loss</span></div>
              <BarList rows={topMeters} max={meterMax} />
            </div>
            <div className="an-card">
              <div className="an-card-title">REPORTED vs EXPECTED kWh <span className="an-card-unit">by type · avg</span></div>
              <PeerBars groups={peerByType} />
            </div>
          </div>

          {/* ── Segmented customer table ─────────────────────── */}
          <div className="an-table-section">
            <div className="an-table-bar">
              <div className="an-tabs">
                {TABS.map((t) => (
                  <button key={t.id}
                    className={`an-tab${tab === t.id ? " active" : ""}`}
                    onClick={() => setTab(t.id)}>
                    {t.label}<span className="an-tab-count">{tabCount(t.id)}</span>
                  </button>
                ))}
              </div>
              <input
                className="an-search" type="text" placeholder="⌕ search name / zone / type…"
                value={q} onChange={(e) => setQ(e.target.value)}
              />
            </div>

            <div className="an-table-scroll">
              <table className="an-table">
                <thead>
                  <tr>
                    {COLS.map((col) => (
                      <th key={col.key}
                        className={`an-th an-${col.align}${sort.key === col.key ? " sorted" : ""}`}
                        onClick={() => toggleSort(col)}>
                        {col.label}
                        <span className="an-sort-ind">{sort.key === col.key ? (sort.dir === "asc" ? "▲" : "▼") : ""}</span>
                      </th>
                    ))}
                    <th className="an-th an-center">REPORT</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const sMeta = STATUS_META[c.inspectionStatus] || { label: (c.inspectionStatus || "—").replace(/_/g, " "), color: "#4db8ff" };
                    const dCol = devColor(c.deviationPct);
                    return (
                      <tr key={`${c.zoneId}-${c.id}`} className={fpOf(c) ? "an-row-cleared" : ""}>
                        <td className="an-left an-name">{c.name}</td>
                        <td className="an-left an-dim">{c.zoneTitle}</td>
                        <td className="an-left an-dim">{c.type}</td>
                        <td className="an-right">{fmtInt(c.monthlyKwh)}</td>
                        <td className="an-right an-dim">{fmtInt(c.expectedKwh)}</td>
                        <td className="an-right" style={{ color: dCol, fontWeight: 700 }}>{devDisplay(c.deviationPct)}</td>
                        <td className="an-right" style={{ color: c.yoyPct < -15 ? RISK.HIGH : "#7fa8d8" }}>
                          {c.yoyPct > 0 ? "+" : ""}{Math.round(c.yoyPct || 0)}%
                        </td>
                        <td className="an-center"><RiskPill level={c.riskLevel} /></td>
                        <td className="an-left"><Chip text={sMeta.label} color={sMeta.color} /></td>
                        <td className="an-right" style={{ color: RISK.HIGH }}>{fmtInt(c.estLossLek)}</td>
                        <td className="an-center">
                          <button className="an-report-btn" onClick={() => setReportCustomer(c)} title={`2-year report · ${c.name}`}>Report</button>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={COLS.length + 1} className="an-empty" style={{ padding: "22px" }}>No customers match this filter.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="an-disclaimer">
            PRIORITIZIM PËR INSPEKTIM · JO KONSTATIM VJEDHJEJE — flagged for inspection, not confirmed theft. Statuses reflect field-review state; cleared / false-positive meters are shown for fairness.
          </div>
        </>
        )}
      </div>

      {reportCustomer && <ReportModal customer={reportCustomer} onClose={() => setReportCustomer(null)} />}
    </div>
  );
}
