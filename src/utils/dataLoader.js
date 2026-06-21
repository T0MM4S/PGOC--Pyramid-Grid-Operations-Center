// ── PGOC · dataLoader.js ──────────────────────────────────────────────────
// Drop-in replacement for dataSimulator.jsx. Instead of random drift it loads
// the pre-computed JSON produced by the Python batch pipeline (pipeline/) and
// *replays* 12 months of real historical risk states at demo speed.
//
// The exported surface is IDENTICAL to dataSimulator.jsx so every panel
// (NodePanel, HubPanel, EventFeed, MapViewer) keeps working with zero changes
// to its logic — only the data source changes:
//
//   getNodeState(id) · getAllState() · getEventLog()
//   startSimulator(onUpdate) · stopSimulator() · forceElevate(id)
//
// Plus a few additive helpers used by the replay UI:
//   initDataLoader() · getMonths() · goToMonth(i) · pauseReplay()/resumeReplay()
//   getReplayState() · getZoneCustomers(id) · getModelMetrics()
//
// Honesty: this is a REPLAY of historical billing data, not live SCADA. In
// production the same getNodeState()/startSimulator() contract is fed by live
// AMI telemetry — the UI never knows the difference.

import { cityNodes } from "../data/cityNodes";

const ADVANCE_MS = 4000; // advance one month every 4s for the demo

// zoneId → human title, so flattened customers carry their zone name
const ZONE_TITLE = Object.fromEntries(cityNodes.map((n) => [n.id, n.title]));

let computedRisk = null;
let customerHistory = null;
let anomalyLog = [];
let modelMetrics = null;

let months = [];
let startIndex = 0;
let liveZones = {};      // current snapshot powering the synchronous getters
let currentIndex = 0;
let paused = false;
let ready = false;

let simTimer = null;
let updateCb = null;

// ── Load the pre-computed static JSON (call once, before first render) ─────
export async function initDataLoader() {
  if (ready) return true;
  const base = import.meta.env.BASE_URL || "/";
  const get = (name) => fetch(`${base}data/${name}`).then((r) => {
    if (!r.ok) throw new Error(`${name} → HTTP ${r.status}`);
    return r.json();
  });
  try {
    const [cr, ch, al, mm] = await Promise.all([
      get("computed_risk.json"),
      get("customer_history.json"),
      get("anomaly_log.json").catch(() => []),
      get("model_metrics.json").catch(() => null),
    ]);
    computedRisk   = cr;
    customerHistory = ch;
    anomalyLog     = Array.isArray(al) ? al : [];
    modelMetrics   = mm;
    months         = cr?.months ?? [];
    startIndex     = cr?.startIndex ?? 0;
    currentIndex   = startIndex;
    liveZones      = JSON.parse(JSON.stringify(cr?.zones ?? {}));
    window.__liveMetrics = cr?.metrics ?? null;
    window.__replayMonth = cr?.startMonthLabel ?? null;

    // Seed the feed with the most recent pre-computed anomalies so it is never
    // empty on first paint. Mark them seen so the replay does not duplicate them.
    anomalyLog.slice(0, 8).forEach((e) => {
      if (e && !seenEventIds.has(e.id)) { seenEventIds.add(e.id); eventLog.push(e); }
    });

    ready = true;
  } catch (err) {
    console.error("[dataLoader] could not load pre-computed data:", err);
    ready = false;
  }
  return ready;
}

export function isReady() { return ready; }

// ── Event log (replays the pre-computed anomaly log) ──────────────────────
const eventLog = [];
const seenEventIds = new Set();

function pushEvent(entry) {
  if (!entry || seenEventIds.has(entry.id)) return;
  seenEventIds.add(entry.id);
  eventLog.unshift(entry);
  if (eventLog.length > 12) eventLog.pop();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("cityEvent", { detail: entry }));
  }
}

export function getEventLog() {
  if (eventLog.length) return [...eventLog];
  // Pre-replay fallback so the feed is never empty on first paint.
  return anomalyLog.slice(0, 12);
}

// ── Synchronous state getters (same shape as the old simulator) ───────────
export function getNodeState(id) {
  const s = liveZones[id];
  return s ? { ...s } : null;
}

export function getAllState() { return { ...liveZones }; }

// ── Replay frame application ──────────────────────────────────────────────
function applyFrame(i) {
  const frame = months[i];
  if (!frame) return;
  currentIndex = i;

  Object.entries(frame.zones || {}).forEach(([id, state]) => {
    liveZones[id] = state;
    if (updateCb) updateCb(id, { ...state });
  });

  (frame.events || []).forEach(pushEvent);

  if (typeof window !== "undefined") {
    window.__liveMetrics = frame.metrics || window.__liveMetrics;
    window.__replayMonth = frame.label;
    window.dispatchEvent(new CustomEvent("metricsUpdate", { detail: frame.metrics }));
    window.dispatchEvent(new CustomEvent("replayMonth", {
      detail: { label: frame.label, index: i, total: months.length, paused },
    }));
  }
}

// ── Same signature as the old startSimulator() — replays months at demo speed
export function startSimulator(onUpdate) {
  updateCb = onUpdate;
  if (simTimer) return () => {};

  currentIndex = startIndex;
  applyFrame(currentIndex); // paint the most-interesting starting month at once

  simTimer = setInterval(() => {
    if (paused) return;
    applyFrame((currentIndex + 1) % (months.length || 1));
  }, ADVANCE_MS);

  return () => { clearInterval(simTimer); simTimer = null; };
}

export function stopSimulator() { clearInterval(simTimer); simTimer = null; }

// ── Replay controls (used by the HubPanel month scrubber) ─────────────────
export function getMonths() {
  return months.map((m, i) => ({ index: i, label: m.label, year: m.year, month: m.month }));
}

export function getReplayState() {
  return { index: currentIndex, label: months[currentIndex]?.label ?? null, total: months.length, paused };
}

export function goToMonth(i) {
  if (i < 0 || i >= months.length) return;
  paused = true;
  applyFrame(i);
}

export function pauseReplay() { paused = true; }
export function resumeReplay() { paused = false; }
export function isPaused() { return paused; }

// ── Customer-level data for CustomerPanel (real 12-month histories) ────────
export function getZoneCustomers(zoneId) {
  return customerHistory?.zones?.[zoneId] ?? null;
}

// Flatten every zone's customer roster into a single array. Each row is
// annotated with its zoneId + human-readable zone title so the Analytics
// dashboard (table + charts) can group/filter without re-joining data.
export function getAllCustomers() {
  const zones = customerHistory?.zones;
  if (!zones) return [];
  const out = [];
  for (const [zoneId, list] of Object.entries(zones)) {
    if (!Array.isArray(list)) continue;
    const zoneTitle = ZONE_TITLE[zoneId] || zoneId;
    for (const c of list) {
      if (c) out.push({ ...c, zoneId, zoneTitle });
    }
  }
  return out;
}

// Per-replay-month aggregate metrics (criticalCount/highCount/pendingCount/
// estLossLek/…) for the detection-trend chart — read-only, never mutates the
// live replay frame (unlike goToMonth).
export function getMonthlyMetrics() {
  return months.map((m, i) => ({
    index: i,
    label: m.label,
    year: m.year,
    month: m.month,
    ...(m.metrics || {}),
  }));
}

export function getExpectedPerSqm() {
  return customerHistory?.expectedKwhPerSqm ?? null;
}

export function getFalsePositiveId() {
  return customerHistory?.falsePositiveCustomerId ?? null;
}

export function getModelMetrics() { return modelMetrics; }

export function getTariffByMonth() { return computedRisk?.tariffByMonth ?? null; }

// ── Manual override kept for parity with the old simulator ────────────────
export function forceElevate(id) {
  const s = liveZones[id];
  if (!s) return;
  s.riskScore = 91;
  s.riskLevel = "CRITICAL";
  s.anomalyType = "METER_TAMPERING";
  s.inspectionStatus = "INSPECTION_SCHEDULED";
  if (updateCb) updateCb(id, { ...s });
  pushEvent({
    id: Date.now() + Math.random(), nodeId: id, level: "warn",
    message: `Manual override - CRITICAL - ${computedRisk?.zones?.[id]?.worstCustomerName ?? id}`,
    time: Date.now(),
  });
}

if (typeof window !== "undefined") window.__forceElevate = forceElevate;
