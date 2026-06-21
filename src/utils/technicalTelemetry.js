// ── PGOC · technicalTelemetry.js ──────────────────────────────────────────
// LIVE *technical* grid telemetry for the map nodes. This is the honest
// "technical difficulties" layer — synthetic SCADA-style ops metrics (load,
// voltage, technical line loss, feeder status, transformer temp, outages) that
// genuinely tick live. It is intentionally SEPARATE from the NTL / theft
// analytics: the map reads as a live technical ops view, while non-technical
// loss (NTL) intelligence lives in the Analytics dashboard + AI assessment.
//
// Design: each zone gets a DETERMINISTIC baseline (seeded from its id, so a
// feeder always has the same character) plus small, bounded, mean-reverting
// live jitter on a ~3s interval. Consumers either subscribe() or listen to the
// `techTelemetry` window CustomEvent.

import { cityNodes } from "../data/cityNodes";

const TICK_MS = 3000; // refresh live telemetry every 3s

// ── Seeded PRNG so baselines are stable per zone across reloads ────────────
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const r1 = (v) => Math.round(v * 10) / 10;
const r3 = (v) => Math.round(v * 1000) / 1000;

// Rough per-category load envelopes (MW) so a stadium/tower draws more than a
// park — purely cosmetic realism for the ops view.
const CATEGORY_LOAD = {
  infrastructure: [4.5, 9.5],
  landmark:       [2.5, 6.0],
  culture:        [2.0, 5.0],
  zone:           [1.5, 4.5],
};

const base  = {}; // deterministic character per zone
const state = {}; // current live numeric values (mean-revert toward base)

for (const n of cityNodes) {
  const rnd = mulberry32(hashStr(n.id));
  const [lmin, lmax] = CATEGORY_LOAD[n.category] || [2, 6];
  base[n.id] = {
    loadMW:           lmin + rnd() * (lmax - lmin),
    voltagePu:        0.985 + rnd() * 0.03,   // 0.985 – 1.015 pu
    technicalLossPct: 3.5 + rnd() * 4.3,      // 3.5 – 7.8 %
    transformerTempC: 46 + rnd() * 22,        // 46 – 68 °C
    outageBase:       rnd() < 0.18 ? 1 : 0,
    healthBias:       rnd(),                  // some feeders lean DEGRADED
    feederKv:         rnd() < 0.5 ? 10 : 20,  // 10kV / 20kV MV feeder
  };
  state[n.id] = {
    loadMW:           base[n.id].loadMW,
    voltagePu:        base[n.id].voltagePu,
    technicalLossPct: base[n.id].technicalLossPct,
    transformerTempC: base[n.id].transformerTempC,
  };
}

function step() {
  for (const n of cityNodes) {
    const b = base[n.id];
    const s = state[n.id];
    // Mean-reverting blend toward baseline + small noise → smooth live wander.
    s.loadMW = clamp(s.loadMW * 0.7 + (b.loadMW + (Math.random() - 0.5) * 1.2) * 0.3, 0.3, 13);
    s.voltagePu = clamp(s.voltagePu * 0.7 + (b.voltagePu + (Math.random() - 0.5) * 0.02) * 0.3, 0.93, 1.07);
    s.technicalLossPct = clamp(
      s.technicalLossPct * 0.75 + (b.technicalLossPct + (Math.random() - 0.5) * 1.0) * 0.25,
      2, 12,
    );
    s.transformerTempC = clamp(
      s.transformerTempC * 0.8 +
        (b.transformerTempC + (s.loadMW - b.loadMW) * 2 + (Math.random() - 0.5) * 2) * 0.2,
      30, 96,
    );
  }
}

function deriveStatus(s, b) {
  if (s.voltagePu < 0.95 || s.voltagePu > 1.05 || s.transformerTempC > 82) return "FAULT";
  if (
    s.technicalLossPct > 7.2 ||
    s.transformerTempC > 70 ||
    s.voltagePu < 0.965 ||
    s.voltagePu > 1.035 ||
    b.healthBias > 0.82
  )
    return "DEGRADED";
  return "NOMINAL";
}

function frame() {
  const out = {};
  for (const n of cityNodes) {
    const b = base[n.id];
    const s = state[n.id];
    const outageCount = b.outageBase + (Math.random() < 0.04 ? 1 : 0);
    out[n.id] = {
      zoneId:           n.id,
      title:            n.title,
      loadMW:           r1(s.loadMW),
      voltagePu:        r3(s.voltagePu),
      technicalLossPct: r1(s.technicalLossPct),
      transformerTempC: Math.round(s.transformerTempC),
      outageCount,
      feederKv:         b.feederKv,
      feederStatus:     deriveStatus(s, b),
      updatedAt:        Date.now(),
    };
  }
  return out;
}

let current = frame(); // populated immediately so getters work pre-tick
let timer   = null;
const subs  = new Set();

function emit() {
  step();
  current = frame();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("techTelemetry", { detail: current }));
  }
  subs.forEach((cb) => {
    try { cb(current); } catch (e) { console.warn("[techTelemetry] subscriber:", e); }
  });
}

export function startTechTelemetry() {
  if (timer) return;
  timer = setInterval(emit, TICK_MS);
}

export function stopTechTelemetry() {
  if (timer) { clearInterval(timer); timer = null; }
}

// Subscribe to live updates. Starts the shared interval on the first listener
// and stops it when the last one unsubscribes — keeps it lightweight.
export function subscribeTelemetry(cb) {
  subs.add(cb);
  startTechTelemetry();
  cb(current); // fire once immediately with the latest snapshot
  return () => {
    subs.delete(cb);
    if (subs.size === 0) stopTechTelemetry();
  };
}

export function getZoneTelemetry(id) { return current[id] || null; }
export function getAllTelemetry()     { return { ...current }; }

export const TELEMETRY_STATUS_COLOR = {
  NOMINAL:  "#00ff88",
  DEGRADED: "#ffc040",
  FAULT:    "#ff2d2d",
};
