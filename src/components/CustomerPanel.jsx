import { customerData, EXPECTED_KWH_PER_SQM } from "../data/customerData";
import { getZoneCustomers, getExpectedPerSqm } from "../utils/dataLoader";

function getExpected(c, rates) {
  if (typeof c.expectedKwh === "number") return Math.round(c.expectedKwh);
  return Math.round(c.sqMeters * ((rates || EXPECTED_KWH_PER_SQM)[c.type] || 2.1));
}

function getDeviation(c, rates) {
  if (typeof c.deviationPct === "number") return Math.round(c.deviationPct);
  const exp = getExpected(c, rates);
  return Math.round(((exp - c.monthlyKwh) / exp) * 100);
}

function devColor(dev) {
  if (dev > 60) return "#ff2d2d";
  if (dev > 35) return "#ff7a30";
  if (dev > 15) return "#ffc040";
  return "#00ff88";
}

const STATUS_LABEL = {
  NOT_FLAGGED:          "NORMAL",
  PENDING_REVIEW:       "PENDING REVIEW",
  INSPECTION_SCHEDULED: "FLAG FOR FIELD CHECK",
  FALSE_POSITIVE:       "CLEARED · FALSE POSITIVE",
};

// ── Dependency-free 12-month kWh sparkline (matches the HUD aesthetic) ─────
function Sparkline({ values, baseline, color }) {
  const v = (values || []).filter((x) => x != null).slice(-12);
  if (v.length < 2) return null;
  const b = (baseline || []).slice(-v.length);
  const W = 150, H = 30, P = 3;
  const pool = [...v, ...b.filter((x) => x != null)];
  const min = Math.min(...pool), max = Math.max(...pool);
  const range = max - min || 1;
  const x = (i) => P + (i * (W - 2 * P)) / (v.length - 1);
  const y = (val) => H - P - ((val - min) / range) * (H - 2 * P);
  const line = (arr) => arr.map((val, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(val).toFixed(1)}`).join(" ");
  const lastX = x(v.length - 1), lastY = y(v[v.length - 1]);

  return (
    <svg width={W} height={H} style={{ display: "block", overflow: "visible" }}>
      {b.length === v.length && (
        <path d={line(b)} fill="none" stroke="#3a5a8a" strokeWidth="1" strokeDasharray="2 3" opacity="0.7" />
      )}
      <path d={line(v)} fill="none" stroke={color} strokeWidth="1.4" />
      <circle cx={lastX} cy={lastY} r="2.2" fill={color} />
    </svg>
  );
}

export default function CustomerPanel({ nodeId, nodeTitle }) {
  // Prefer the pre-computed enriched cohort (real histories + risk); fall back
  // to the static roster so the panel still renders if the JSON is missing.
  const rates     = getExpectedPerSqm() || EXPECTED_KWH_PER_SQM;
  const customers = getZoneCustomers(nodeId) || customerData[nodeId];
  if (!customers?.length) return null;

  return (
  <div style={{
  position:    "relative",
  width:       "100%",
  flexShrink:  0,
  overflowX:   "hidden",
  background:  "rgba(0,4,22,0.96)",
  border:      "1px solid #0a3060",
  borderTop:   "2px solid #00ffff",
  fontFamily:  "'Courier New', monospace",
  fontSize:    "11px",
  color:       "#a0c8ff",
  padding:     "14px",
  boxSizing:   "border-box",
  boxShadow:   "0 0 30px rgba(0,180,255,0.10)",
}}>

      {/* ── Header ─────────────────────────────────── */}
      <div style={{ marginBottom: "12px" }}>
        <div style={{ color: "#00ffff", fontSize: "12px", letterSpacing: "2px", fontWeight: "bold" }}>
          ◈ CUSTOMER ANALYSIS
        </div>
        <div style={{ color: "#7fb8e6", fontSize: "10.5px", letterSpacing: "1.4px", marginTop: "4px" }}>
          {customers.length} CUSTOMERS · {nodeTitle.toUpperCase()} · PEER COHORT
        </div>
      </div>

      {/* ── Customer rows ───────────────────────────── */}
      {customers.map(c => {
        const expected = getExpected(c, rates);
        const dev      = getDeviation(c, rates);
        const col      = devColor(dev);
        const cleared  = c.inspectionStatus === "FALSE_POSITIVE";
        const suspect  = !cleared && (dev > 50 || c.riskLevel === "HIGH" || c.riskLevel === "CRITICAL");
        const badge    = cleared ? "✓ CLEARED" : suspect ? "⚠ FLAG FOR REVIEW" : "✓ NORMAL";
        const badgeCol = cleared ? "#4db8ff" : col;

        return (
          <div key={c.id} style={{
            borderLeft:    `3px solid ${badgeCol}`,
            paddingLeft:   "10px",
            marginBottom:  "10px",
            paddingBottom: "8px",
            borderBottom:  "1px solid #0a2040",
          }}>
            {/* Name + status */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#ffffff", fontSize: "11px", fontWeight: "bold" }}>
                {c.name}
              </span>
              <span style={{
                color:      badgeCol,
                fontSize:   "9px",
                letterSpacing: "1px",
                background: (suspect || cleared) ? `${badgeCol}18` : "transparent",
                padding:    "1px 5px",
                borderRadius: "2px",
              }}>
                {badge}
              </span>
            </div>

            {/* Address */}
            <div style={{ color: "#5f7fa8", fontSize: "9.5px", marginTop: "3px" }}>
              {c.address}
            </div>

            {/* Stats row */}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px", flexWrap: "wrap", gap: "4px" }}>
              <span style={{ color: "#6f86ad", fontSize: "10px" }}>
                {c.sqMeters}m² · {c.type} · Fl.{c.floor} · {c.meterAge}yr meter
              </span>
              <span style={{ fontSize: "11.5px" }}>
                <span style={{ color: col, fontWeight: "bold" }}>{Math.round(c.monthlyKwh)}</span>
                <span style={{ color: "#405070" }}> / {expected} kWh </span>
                <span style={{ color: col, fontWeight: "bold" }}>
                  {dev > 0 ? `−${dev}%` : `+${Math.abs(dev)}%`}
                </span>
              </span>
            </div>

            {/* 12-month history sparkline (real consumption vs peer baseline) */}
            {Array.isArray(c.history_kwh) && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" }}>
                <Sparkline values={c.history_kwh} baseline={c.expected_kwh_series} color={col} />
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ color: "#5f7fa8", fontSize: "9.5px", letterSpacing: "0.5px" }}>12-MO kWh</span>
                  {typeof c.yoyPct === "number" && (
                    <span style={{ color: c.yoyPct < -15 ? col : "#6f86ad", fontSize: "10px" }}>
                      YoY {c.yoyPct > 0 ? "+" : ""}{Math.round(c.yoyPct)}%
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Inspection status line (surfaces FALSE POSITIVE prominently) */}
            {c.inspectionStatus && c.inspectionStatus !== "NOT_FLAGGED" && (
              <div style={{
                marginTop: "6px", fontSize: "9.5px", letterSpacing: "1px",
                color: cleared ? "#5dc8ff" : badgeCol,
              }}>
                ▸ {STATUS_LABEL[c.inspectionStatus] || c.inspectionStatus.replace(/_/g, " ")}
                {typeof c.estLossLek === "number" && !cleared && c.estLossLek > 0 &&
                  ` · ~${c.estLossLek.toLocaleString()} LEK/vit`}
              </div>
            )}
          </div>
        );
      })}

      <div style={{
        color:       "#34507a",
        fontSize:    "9.5px",
        marginTop:   "12px",
        letterSpacing: "1px",
        textAlign:   "center",
        borderTop:   "1px solid #0a2040",
        paddingTop:  "8px",
        lineHeight:  "1.6",
      }}>
        PRIORITIZIM PËR INSPEKTIM · JO KONSTATIM VJEDHJEJE<br />
        AI peer analysis → open a customer&apos;s <span style={{ color: "#00d4ff" }}>Report</span> in NTL Analytics
      </div>
    </div>
  );
}
