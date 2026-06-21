export const APP_TITLE    = "PGOC";
export const APP_SUBTITLE = "PYRAMID GRID OPERATIONS CENTER";

export const TABS = [
  { icon: "⊕", label: "OVERVIEW",  id: "nexus"   },
  { icon: "◈", label: "AI MODEL",  id: "neural"  },
  { icon: "⟳", label: "RISK SCAN", id: "scan"    },
  { icon: "⬡", label: "METER MESH",id: "iot"     },
  { icon: "↑", label: "GRID LINK", id: "uplink"  },
  { icon: "⚠", label: "NTL ALERTS",id: "threat"  },
];

export const SIDEBAR_DATA = {
  nexus: {
    title: "GRID OVERVIEW",
    rows: [
      { label: "STATUS",          value: "OPERATIONAL",  color: "#00ff88" },
      { label: "ZONES MONITORED", value: "13 ACTIVE",     color: "#4db8ff" },
      { label: "TOTAL METERS",    value: "4,820",         color: "#4db8ff" },
      { label: "EST. ANNUAL LOSS",value: "18.4M LEK",     color: "#ff7a30" },
      { label: "FLAGGED TODAY",   value: "7",             color: "#ffc040" },
      { label: "LAST SCAN",       value: "0.3s AGO",      color: "#4db8ff" },
    ],
  },
  neural: {
    title: "AI MODEL STATUS",
    rows: [
      { label: "MODEL STATUS",    value: "ACTIVE",       color: "#00ff88" },
      { label: "ANOMALIES FOUND", value: "142",           color: "#ffc040" },
      { label: "MODEL ACCURACY",  value: "94.6%",         color: "#00ff88" },
      { label: "FALSE POSITIVE",  value: "3.2%",          color: "#4db8ff" },
      { label: "LAST RETRAIN",    value: "BATCH BUILD",   color: "#4db8ff" },
    ],
  },
  scan: {
    title: "RISK SCAN",
    rows: [
      { label: "SCAN MODE",      value: "FULL GRID",     color: "#4db8ff" },
      { label: "PROGRESS",       value: "███░░ 68%",     color: "#5dc8ff" },
      { label: "HIGH RISK ZONES",value: "3 FOUND",        color: "#ff7a30" },
      { label: "COVERAGE",       value: "14.2 km²",      color: "#4db8ff" },
      { label: "RESOLUTION",     value: "PER-METER",     color: "#4db8ff" },
      { label: "ETA",            value: "00:01:42",      color: "#4db8ff" },
    ],
  },
  iot: {
    title: "METER MESH",
    rows: [
      { label: "METERS ONLINE",  value: "4,762",         color: "#00ff88" },
      { label: "OFFLINE",        value: "58",             color: "#ff4444" },
      { label: "DATA RATE",      value: "4.8 MB/S",      color: "#4db8ff" },
      { label: "TAMPER SIGNALS", value: "5 DETECTED",    color: "#ffc040" },
      { label: "PROTOCOL",       value: "DLMS/COSEM",    color: "#4db8ff" },
      { label: "SIGNAL",         value: "STRONG",        color: "#00ff88" },
    ],
  },
  uplink: {
    title: "GRID LINK",
    rows: [
      { label: "REPLAY LATENCY", value: "12ms",          color: "#00ff88" },
      { label: "BANDWIDTH",      value: "2.4 GB/S",      color: "#4db8ff" },
      { label: "DATA MODE",      value: "BATCH REPLAY",  color: "#ffc040" },
      { label: "SOURCE",         value: "HISTORICAL AMI", color: "#00ff88" },
      { label: "SERVER",         value: "STATIC JSON",   color: "#00ff88" },
      { label: "LAST PULL",      value: "0.8s AGO",      color: "#4db8ff" },
    ],
  },
  threat: {
    title: "NTL ALERTS",
    rows: [
      { label: "CRITICAL RISK",  value: "1",              color: "#ff2d2d" },
      { label: "HIGH RISK",      value: "2",              color: "#ff7a30" },
      { label: "MEDIUM RISK",    value: "4",              color: "#ffc040" },
      { label: "INSPECTIONS",    value: "3 PENDING",      color: "#4db8ff" },
      { label: "LOSS RECOVERED", value: "2.1M LEK",       color: "#00ff88" },
      { label: "LAST ALERT",     value: "04:12 AGO",      color: "#4db8ff" },
    ],
  },
};

export const LAYERS = [
  { label: "SMART METERS", active: true  },
  { label: "SUBSTATIONS",  active: true  },
  { label: "RISK ZONES",   active: true  },
  { label: "TERRAIN",      active: false },
];

export const TAB_ALERTS = {
  nexus: {
    level: "INFO",
    msg:   "GRID SYNC COMPLETE",
    sub:   "All 13 zones reporting — consumption patterns nominal",
    color: "#4db8ff",
  },
  neural: {
    level: "WARNING",
    msg:   "AI FLAGGED NEW ANOMALY",
    sub:   "Zone consumption deviates 47% from predicted baseline",
    color: "#ffc040",
  },
  scan: {
    level: "INFO",
    msg:   "RISK SCAN IN PROGRESS",
    sub:   "Cross-referencing 4,820 meters against historical profiles",
    color: "#5dc8ff",
  },
  iot: {
    level: "WARNING",
    msg:   "TAMPER SIGNATURE DETECTED",
    sub:   "Meter communication pattern matches known bypass method",
    color: "#ffc040",
  },
  uplink: {
    level: "INFO",
    msg:   "HISTORICAL DATA LINK STABLE",
    sub:   "Replaying 27 months of historical AMI billing data · batch pipeline",
    color: "#00ff88",
  },
  threat: {
    level: "CRITICAL",
    msg:   "HIGH-RISK ZONE IDENTIFIED",
    sub:   "Customer cluster flagged for inspection — est. loss 340K LEK/yr",
    color: "#ff2d2d",
  },
};