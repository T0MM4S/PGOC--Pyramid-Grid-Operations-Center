import { cityNodes } from "../data/cityNodes";

const NODE_IDS  = cityNodes.map(n => n.id);
const TITLE_MAP = {};
cityNodes.forEach(n => { TITLE_MAP[n.id] = n.title; });

const RISK_FACTOR_POOL = [
  "Consumption {pct}% below historical baseline",
  "Meter communication pattern matches known tamper signature",
  "Zone deviates 3.2σ from similar consumption profiles",
  "Irregular nighttime usage inconsistent with declared profile",
  "Geographic clustering with nearby flagged customers",
  "Sudden drop in reported load after meter reset event",
  "Repeated zero-consumption anomalies in billing cycle",
  "Reverse current flow detected on feeder line",
];

function riskLevelFromScore(score) {
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 30) return "MEDIUM";
  return "LOW";
}

function pickFactors(deviationPct, count = 2) {
  const pool = [...RISK_FACTOR_POOL];
  const picked = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    let f = pool.splice(idx, 1)[0];
    f = f.replace("{pct}", Math.abs(Math.round(deviationPct)));
    picked.push(f);
  }
  return picked;
}

const nodeState = {};
NODE_IDS.forEach(id => {
  const expected     = Math.floor(220 + Math.random() * 480);
  const consumption  = Math.round(expected * (0.85 + Math.random() * 0.3));
  const deviationPct = ((expected - consumption) / expected) * 100;
  const riskScore     = Math.floor(10 + Math.random() * 25);
  nodeState[id] = {
    expectedKwh: expected,
    consumptionKwh: consumption,
    deviationPct,
    riskScore,
    riskLevel: riskLevelFromScore(riskScore),
    anomalyType: "NONE",
    riskFactors: [],
    inspectionStatus: "NOT_FLAGGED",
    lastUpdate: Date.now(),
  };
});

function drift(current, min, max, maxDelta) {
  const d = (Math.random() - 0.5) * maxDelta * 2;
  return Math.max(min, Math.min(max, current + d));
}

const eventLog = [];
function pushEvent(nodeId, message, level) {
  const entry = { id: Date.now() + Math.random(), nodeId, message, level, time: Date.now() };
  eventLog.unshift(entry);
  if (eventLog.length > 12) eventLog.pop();
  window.dispatchEvent(new CustomEvent("cityEvent", { detail: entry }));
}
export function getEventLog() { return [...eventLog]; }

// ── Startup pre-flagging ─────────────────────────────────────────────
// A few zones are deterministically seeded above LOW so the demo always
// opens with a believable threat picture that matches the NTL ALERTS panel.
const PREFLAGGED = [
  { id: "blloku",            level: "CRITICAL", score: 88 },
  { id: "rinia-park",        level: "HIGH",     score: 67 },
  { id: "tirana-university", level: "HIGH",     score: 62 },
  { id: "national-library",  level: "MEDIUM",   score: 44 },
  { id: "grand-park",        level: "MEDIUM",   score: 37 },
];

function applyRiskProfile(s, level, score) {
  // Drive reported consumption below expected so the deviation justifies the flag
  const dropFactor = level === "CRITICAL" ? 0.45 : level === "HIGH" ? 0.6 : 0.78;
  s.consumptionKwh = Math.round(s.expectedKwh * dropFactor);
  s.deviationPct   = ((s.expectedKwh - s.consumptionKwh) / s.expectedKwh) * 100;
  s.riskScore      = score;
  s.riskLevel      = level;
  if (level === "HIGH" || level === "CRITICAL") {
    s.anomalyType      = s.deviationPct > 30
      ? (level === "CRITICAL" ? "METER_TAMPERING" : "ILLEGAL_CONNECTION")
      : "CONSUMPTION_ANOMALY";
    s.riskFactors      = pickFactors(s.deviationPct, level === "CRITICAL" ? 3 : 2);
    s.inspectionStatus = level === "CRITICAL" ? "INSPECTION_SCHEDULED" : "PENDING_REVIEW";
  } else {
    s.anomalyType      = "CONSUMPTION_ANOMALY";
  }
  s.lastUpdate = Date.now();
}

(function seedStartupRisk() {
  PREFLAGGED.forEach(({ id, level, score }) => {
    if (nodeState[id]) applyRiskProfile(nodeState[id], level, score);
  });

  // For EVERY node that starts above LOW (pre-flagged or seeded MEDIUM by the
  // RNG above), emit one synthetic startup event so the Live Events feed can
  // never read "NO EVENTS YET" while the alerts panel already shows counts.
  const severity = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
  const flagged = NODE_IDS
    .filter(id => nodeState[id].riskLevel !== "LOW")
    .sort((a, b) => (severity[nodeState[a].riskLevel] ?? 3) - (severity[nodeState[b].riskLevel] ?? 3));

  // Push least-severe first so the most-severe entries end up on top (unshift).
  for (let i = flagged.length - 1; i >= 0; i--) {
    const id    = flagged[i];
    const level = nodeState[id].riskLevel;
    const title = TITLE_MAP[id] || id;
    pushEvent(
      id,
      `System initialized — pre-flagged zone detected · ${title} · ${level}`,
      level === "MEDIUM" ? "info" : "warn"
    );
  }
})();

let simInterval = null;
let totalAnomaliesDetected = 14;

export function startSimulator(onUpdate) {
  if (simInterval) return () => {};

  simInterval = setInterval(() => {
    const shuffled = [...NODE_IDS].sort(() => Math.random() - 0.5);
    const toUpdate = shuffled.slice(0, 3);

    toUpdate.forEach(id => {
      const s = nodeState[id];
      const title = TITLE_MAP[id] || id;
      const prevLevel = s.riskLevel;

      if (Math.random() < 0.04) {
        s.consumptionKwh = Math.round(s.consumptionKwh * (0.4 + Math.random() * 0.3));
      } else {
        s.consumptionKwh = Math.round(drift(s.consumptionKwh, 50, 900, 18));
      }

      s.deviationPct = ((s.expectedKwh - s.consumptionKwh) / s.expectedKwh) * 100;

      const devMagnitude = Math.min(100, Math.abs(s.deviationPct) * 1.6);
      s.riskScore = Math.round(drift(s.riskScore, 5, 97, 6) * 0.5 + devMagnitude * 0.5);
      s.riskScore = Math.max(3, Math.min(98, s.riskScore));
      s.riskLevel = riskLevelFromScore(s.riskScore);

      if (s.riskLevel === "HIGH" || s.riskLevel === "CRITICAL") {
        s.anomalyType = s.deviationPct > 30
          ? (Math.random() < 0.5 ? "METER_TAMPERING" : "ILLEGAL_CONNECTION")
          : "CONSUMPTION_ANOMALY";
        if (s.riskFactors.length === 0 || prevLevel !== s.riskLevel) {
          s.riskFactors = pickFactors(s.deviationPct, 2 + (s.riskLevel === "CRITICAL" ? 1 : 0));
        }
        if (s.inspectionStatus === "NOT_FLAGGED") {
          s.inspectionStatus = Math.random() < 0.5 ? "PENDING_REVIEW" : "INSPECTION_SCHEDULED";
        }
      } else if (s.riskLevel === "MEDIUM") {
        s.anomalyType = "CONSUMPTION_ANOMALY";
      } else {
        s.anomalyType = "NONE";
        s.riskFactors = [];
        s.inspectionStatus = "NOT_FLAGGED";
      }

      if ((s.riskLevel === "HIGH" || s.riskLevel === "CRITICAL") && Math.random() < 0.12) {
        s.riskScore = Math.floor(10 + Math.random() * 15);
        s.riskLevel = "LOW";
        s.anomalyType = "NONE";
        s.inspectionStatus = "FALSE_POSITIVE";
        pushEvent(id, `✓ Risk cleared after review · ${title}`, "ok");
      } else if (prevLevel !== s.riskLevel && (s.riskLevel === "HIGH" || s.riskLevel === "CRITICAL")) {
        totalAnomaliesDetected++;
        pushEvent(
          id,
          s.riskLevel === "CRITICAL"
            ? `⚠ CRITICAL NTL risk · ${title} · Score ${s.riskScore}`
            : `⚠ High NTL risk · ${title} · Score ${s.riskScore}`,
          "warn"
        );
      }

      s.lastUpdate = Date.now();
      onUpdate(id, { ...s });
    });

    const all          = Object.values(nodeState);
    const criticalCount = all.filter(s => s.riskLevel === "CRITICAL").length;
    const highCount     = all.filter(s => s.riskLevel === "HIGH").length;
    const mediumCount   = all.filter(s => s.riskLevel === "MEDIUM").length;
    const pendingCount  = all.filter(s => s.inspectionStatus === "PENDING_REVIEW" || s.inspectionStatus === "INSPECTION_SCHEDULED").length;
    const estLossLek    = all.reduce((sum, s) => {
      if (s.riskLevel === "HIGH" || s.riskLevel === "CRITICAL") {
        return sum + Math.round((s.expectedKwh - s.consumptionKwh) * 14.2 * 12);
      }
      return sum;
    }, 0);

    window.__liveMetrics = {
      criticalCount, highCount, mediumCount, pendingCount,
      estLossLek,
      totalAnomaliesDetected,
      modelAccuracy: (94.2 + Math.sin(Date.now() / 9000) * 0.6).toFixed(1),
      timestamp: Date.now(),
    };
    window.dispatchEvent(new CustomEvent("metricsUpdate", { detail: window.__liveMetrics }));

  }, 3500);

  return () => { clearInterval(simInterval); simInterval = null; };
}

export function stopSimulator() { clearInterval(simInterval); simInterval = null; }
export function getNodeState(id) { const s = nodeState[id]; return s ? { ...s } : null; }
export function getAllState() { return { ...nodeState }; }

export function forceElevate(id) {
  if (nodeState[id]) {
    const s = nodeState[id];
    s.riskScore = 91;
    s.riskLevel = "CRITICAL";
    s.anomalyType = "METER_TAMPERING";
    s.riskFactors = pickFactors(s.deviationPct, 3);
    s.inspectionStatus = "INSPECTION_SCHEDULED";
    pushEvent(id, `⚠ Manual override · CRITICAL · ${TITLE_MAP[id] || id}`, "warn");
  }
}
if (typeof window !== "undefined") window.__forceElevate = forceElevate;