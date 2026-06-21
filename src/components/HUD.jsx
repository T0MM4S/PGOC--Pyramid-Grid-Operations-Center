import { useState, useEffect, useRef } from "react";
import { useMobile } from "../hooks/useMobile";
import {
  APP_TITLE, APP_SUBTITLE, TABS, SIDEBAR_DATA, LAYERS, TAB_ALERTS,
} from "../config/hudConfig";
import { MOBILE_TABS } from "../config/mobileConfig";
import EventFeed from "./EventFeed";
import SidebarPanel from "./hud/SidebarPanel";
import MetricRow from "./hud/MetricRow";
import SidebarSummaryStrip from "./hud/SidebarSummaryStrip";
import { getUser, getRoleColor, ROLE_TABS, can } from "../utils/authStore";

   // ── Live value resolver ──────────────────────────────
function getLiveValue(tabId, label, value, tick, liveStreams) {
  if (label === "DATA STREAMS") return `${liveStreams.toLocaleString()} / SEC`;

  switch (`${tabId}:${label}`) {
    // ── NEXUS ─────────────────────────────────────────────
    case "nexus:LAST SYNC":
      return `${(tick % 9) + 1}s AGO`;
    case "nexus:DATA STREAMS":
      return `${liveStreams.toLocaleString()} / SEC`;

    // ── NEURAL ────────────────────────────────────────────
    case "neural:GPU LOAD":
      return `${58 + (tick * 7) % 14}%`;
    case "neural:INFERENCE":
      return `${10 + (tick * 3) % 8}ms AVG`;
    case "neural:NODES ACTIVE":
      return `${844 + (tick * 5) % 9}`;
    case "neural:ACCURACY":
      return `${(97.1 + (tick % 4) * 0.1).toFixed(1)}%`;

    // ── SCAN ──────────────────────────────────────────────
    case "scan:ETA": {
      const total = Math.max(0, 102 - tick);
      const m = Math.floor(total / 60).toString().padStart(2, "0");
      const s = (total % 60).toString().padStart(2, "0");
      return `00:${m}:${s}`;
    }
    case "scan:PROGRESS": {
      const pct    = Math.min(99, 68 + Math.floor(tick * 0.3));
      const filled = Math.floor(pct / 20);
      return `${"█".repeat(filled)}${"░".repeat(5 - filled)} ${pct}%`;
    }
    case "scan:ANOMALIES":
      return `${3 + (tick % 7 === 0 ? 1 : 0)} FOUND`;

    // ── IOT ───────────────────────────────────────────────
    case "iot:SENSORS":
      return `${1200 + (tick * 3) % 8} ONLINE`;
    case "iot:DATA RATE":
      return `${(4.5 + (tick * 0.1) % 0.8).toFixed(1)} MB/S`;
    case "iot:OFFLINE":
      return `${5 + (tick % 9 === 0 ? 2 : 0)} NODES`;

    // ── UPLINK ────────────────────────────────────────────
    case "uplink:LATENCY":
      return `${10 + (tick * 2) % 7}ms`;
    case "uplink:LAST PULL":
      return `${(tick % 5) + 1}s AGO`;
    case "uplink:BANDWIDTH":
      return `${(2.2 + (tick * 0.05) % 0.5).toFixed(1)} GB/S`;

    // ── THREAT ────────────────────────────────────────────
    case "threat:LAST EVENT": {
      const t = tick + 252;
      return `${Math.floor(t / 60).toString().padStart(2, "0")}:${(t % 60).toString().padStart(2, "0")} AGO`;
    }
    case "threat:SCAN CYCLE":
      return `EVERY ${30 - (tick % 5)}s`;

    default:
      return value;
  }
}

// Which node to pulse per tab when B is pressed
const TAB_NODE_MAP = {
  "NEURAL":    "tirana-tower",
  "DEEP SCAN": "skanderbeg",
  "IOT MESH":  "rinia-park",
  "UPLINK":    "national-library",
  "THREAT":    "tirana-tower",
};

function Compass({ headingDeg }) {
  return (
    <div className="hud-compass">
      <div className="hud-compass-ring">
        <span className="hud-compass-n">N</span>
        <span className="hud-compass-s">S</span>
        <span className="hud-compass-e">E</span>
        <span className="hud-compass-w">W</span>
        <div
          className="hud-compass-needles"
          style={{ transform: `rotate(${-headingDeg}deg)` }}
        >
          <div className="hud-compass-needle-north" />
          <div className="hud-compass-needle-south" />
        </div>
        <div className="hud-compass-center" />
      </div>
      <div className="hud-compass-label">HEADING {Math.round(headingDeg % 360)}°</div>
    </div>
  );
}

// Radar sweep — only shown on DEEP SCAN tab
function ScanRing() {
  return (
    <div className="scan-overlay">
      <div className="scan-ring-outer" />
      <div className="scan-ring-inner" />
      <div className="scan-ping" />
      <div className="scan-sweep" />
      <div className="scan-crosshair-h" />
      <div className="scan-crosshair-v" />
      <div className="scan-dot" />
      <span className="scan-label">DEEP SCAN ACTIVE</span>
    </div>
  );
}

export default function HUD({ onLogout }) {
  const isMobile                  = useMobile();
  const [time, setTime]           = useState(new Date());
  const [activeTab, setActive]    = useState(TABS[0].id);
  const [sidebarOpen, setSidebar] = useState(!isMobile);
  const [tick, setTick]           = useState(0);
  const [alert, setAlert]         = useState(null);
  const [headingDeg, setHeading]  = useState(0);
  const [analyticsActive, setAnalyticsActive] = useState(false);
  const alertTimerRef             = useRef(null);
  const rafRef                    = useRef(null);

  // Reflect the Analytics dashboard open/close state on the center nav button
  useEffect(() => {
    const h = (e) => setAnalyticsActive(!!e.detail?.open);
    window.addEventListener("analyticsOpen", h);
    return () => window.removeEventListener("analyticsOpen", h);
  }, []);

  // Clock + tick
  useEffect(() => {
    const t = setInterval(() => {
      setTime(new Date());
      setTick(p => p + 1);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Smooth compass
  useEffect(() => {
    const loop = () => {
      const h = window.__cameraHeading ?? 0;
      setHeading(h * (180 / Math.PI));
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // B key — show alert + pulse linked node
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== "b" && e.key !== "B") return;

      if (alert) {
        setAlert(null);
        clearTimeout(alertTimerRef.current);
        return;
      }

      const next = TAB_ALERTS[activeTab];
      setAlert(next);
      clearTimeout(alertTimerRef.current);
      alertTimerRef.current = setTimeout(() => setAlert(null), 9000);

      // Pulse the relevant map node
      const nodeId = TAB_NODE_MAP[activeTab];
      if (nodeId) {
        window.dispatchEvent(new CustomEvent("pulseNode", { detail: { id: nodeId } }));
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [alert, activeTab]);

  const timeStr    = time.toTimeString().slice(0, 8);
  const sidebar    = SIDEBAR_DATA[activeTab];
  const liveStreams = 1847 + ((tick * 13) % 47) - 23;
  const nexusUser = getUser();
  const roleTabs  = nexusUser?.role ? (ROLE_TABS[nexusUser.role] ?? []) : TABS.map(t => t.id);
  const visibleTabs = isMobile
  ? TABS.filter(t => MOBILE_TABS.includes(t.id) && roleTabs.includes(t.id))
  : TABS.filter(t => roleTabs.includes(t.id));

  // Center ANALYTICS orb — gated to roles that can view the Hub (matches the
  // pyramid/Hub gating). When shown, the tabs split around it; otherwise the
  // bottom nav renders unchanged.
  const showAnalytics = can("viewHub");
  const mid       = Math.ceil(visibleTabs.length / 2);
  const leftTabs  = visibleTabs.slice(0, mid);
  const rightTabs = visibleTabs.slice(mid);

  const renderTab = ({ icon, label, id }) => (
    <div
      key={id}
      className={`hud-tab${activeTab === id ? " hud-tab-active" : ""}`}
      onClick={() => {
        setActive(id);
        setAlert(null);
        clearTimeout(alertTimerRef.current);
      }}
    >
      <span className="hud-tab-icon">{icon}</span>
      <span className="hud-tab-label">{label}</span>
    </div>
  );

  return (
    <div className={`hud${isMobile ? " hud-mobile" : ""}`}>

      {/* TOP BAR */}
      <div className="hud-topbar">
        <div className="hud-title">
          <span className="hud-title-main">
            {isMobile ? "PGOC" : APP_TITLE}
          </span>
          {!isMobile && (
            <span className="hud-title-sub">{APP_SUBTITLE}</span>
          )}
        </div>
        <div className="hud-topright">
          <div className="hud-clock-block">
            <span className="hud-clock">{timeStr}</span>
          </div>
          <span className="hud-online">
            <span className="hud-online-dot">⬤</span>
            {isMobile ? "" : " SYSTEM ONLINE"}
          </span>
            {/* ── Profile badge + logout ── */}
  {(() => {
    const u = getUser();
    if (!u) return null;
    const color = getRoleColor(u.role);
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: "8px",
        marginLeft: "12px", pointerEvents: "all",
        fontFamily: "'Courier New', monospace",
      }}>
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "flex-end",
          lineHeight: 1.2, fontFamily: "'Courier New', monospace",
        }}>
          <span style={{ color, fontSize: "9px", letterSpacing: "1.5px", fontWeight: "bold" }}>
            {u.role}
          </span>
          <span style={{ color: "#ffffff", fontSize: "9px", letterSpacing: "1px", opacity: 0.7 }}>
            {u.name.trim() || "ON DUTY"}
          </span>
        </div>
        {/* Flat-color square sigil — sharp 2px edges + crisp colored glow,
            matching the rest of the HUD (no gradient orb). */}
        <div style={{
          width: "26px", height: "26px", borderRadius: "2px",
          border: `1px solid ${color}`,
          background: `${color}14`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "12px", fontWeight: "bold", color,
          fontFamily: "'Courier New', monospace",
          boxShadow: `0 0 6px ${color}55`,
        }}>
          {(u.name.trim() || u.role).charAt(0)}
        </div>
        <button
          onClick={onLogout}
          title="Logout"
          style={{
            background: "transparent", border: `1px solid #ff2d2d66`,
            color: "#ff2d2d", fontSize: "9px", letterSpacing: "1px",
            padding: "4px 8px", cursor: "pointer",
            fontFamily: "'Courier New', monospace",
            borderRadius: "2px",
            boxShadow: "0 0 6px rgba(255,45,45,0.25)",
          }}
        >
          EXIT
        </button>
      </div>
         );
        })()}
        </div>
        {isMobile && (
          <button
            className="hud-mobile-toggle"
            onClick={() => setSidebar(o => !o)}
            style={{ pointerEvents: "all" }}
          >
            {sidebarOpen ? "✕" : "☰"}
          </button>
        )}
      </div>

      {/* LEFT SIDEBAR */}
      {(!isMobile || sidebarOpen) && (
        <div className={`hud-sidebar${isMobile ? " hud-sidebar-mobile" : ""}`}>

          {/* Location panel */}
          <SidebarPanel icon="⊙" title="LOCATION">
            <div className="hud-loc-name">TIRANA, ALBANIA</div>
            <div className="hud-loc-coord">41.3275° N</div>
            <div className="hud-loc-coord">19.8189° E</div>
            <div className="hud-loc-tag">PYRAMID HUB · ACTIVE</div>
          </SidebarPanel>

          {/* Technical vs Non-Technical split — map = live technical telemetry,
              dashboard + AI = non-technical (NTL) loss intelligence. */}
          {!isMobile && (
            <SidebarSummaryStrip
              showAnalytics={showAnalytics}
              onAnalyticsClick={() => window.dispatchEvent(new CustomEvent("analyticsClick"))}
            />
          )}

          {!isMobile && (
            <SidebarPanel icon="≣" title="LIVE EVENTS">
              <EventFeed max={4} />
            </SidebarPanel>
          )}

          {/* Dynamic data panel — key triggers fade on tab change */}
          <SidebarPanel icon="◈" title={sidebar.title} className="hud-panel-dynamic">
            {/* key here causes React to remount → CSS animation re-fires */}
            <div className="hud-data-list hud-tab-fade" key={activeTab}>
              {sidebar.rows.map(({ label, value, color, variant }) => (
                <MetricRow
                  key={label}
                  label={label}
                  value={getLiveValue(activeTab, label, value, tick, liveStreams)}
                  color={color}
                  variant={variant === "kpi" ? "kpi" : "row"}
                  showBar={value.includes("%")}
                  barValue={value}
                />
              ))}
            </div>
          </SidebarPanel>

          {/* Layers */}
          {!isMobile && (
            <SidebarPanel icon="◧" title="LAYERS">
              <div className="hud-layer-list">
                {LAYERS.map(({ label, active }) => (
                  <div key={label} className={`hud-layer${active ? " active" : ""}`}>
                    <span className="hud-layer-dot">{active ? "▸" : "·"}</span>
                    <span>{label}</span>
                    {active && <span className="hud-layer-badge">ON</span>}
                  </div>
                ))}
              </div>
            </SidebarPanel>
          )}

          {/* Signal */}
          {!isMobile && (
            <div className="hud-signal">
              <span className="hud-signal-label">SIGNAL</span>
              <div className="hud-signal-bars">
                {[1,2,3,4,5].map(i => (
                  <div
                    key={i}
                    className="hud-signal-bar"
                    style={{ height: `${i * 4 + 4}px`, opacity: i <= 4 ? 1 : 0.2 }}
                  />
                ))}
              </div>
              <span className="hud-signal-val">STRONG</span>
            </div>
          )}

        </div>
      )}

      {/* CORNER BRACKETS */}
      {!isMobile && (
        <>
          <div className="hud-corner hud-corner-tl" />
          <div className="hud-corner hud-corner-bl" />
        </>
      )}

      {/* ALERT */}
      {alert && (
        <div className="hud-alert" key={alert.msg}>
          <div className="hud-alert-bar" style={{ background: alert.color }} />
          <div className="hud-alert-content">
            <div className="hud-alert-level" style={{ color: alert.color }}>
              ⚠ {alert.level}
            </div>
            <div className="hud-alert-msg">{alert.msg}</div>
            <div className="hud-alert-sub">{alert.sub}</div>
          </div>
          <div
            className="hud-alert-close"
            onClick={() => { setAlert(null); clearTimeout(alertTimerRef.current); }}
            style={{ pointerEvents: "all", cursor: "pointer" }}
          >✕</div>
        </div>
      )}

      {/* DEEP SCAN radar overlay */}
      {activeTab === "DEEP SCAN" && !isMobile && <ScanRing />}

      {/* COMPASS */}
      {!isMobile && <Compass headingDeg={headingDeg} />}

      {/* BOTTOM NAV */}
      <div className="hud-bottombar" style={{ pointerEvents: "all" }}>
        {showAnalytics ? (
          <>
            {leftTabs.map(renderTab)}
            <button
              className={`hud-analytics-btn${analyticsActive ? " active" : ""}`}
              onClick={() => window.dispatchEvent(new CustomEvent("analyticsClick"))}
              title="Open NTL Analytics dashboard"
            >
              <span className="hud-analytics-icon">▦</span>
              <span className="hud-analytics-label">ANALYTICS</span>
            </button>
            {rightTabs.map(renderTab)}
          </>
        ) : (
          visibleTabs.map(renderTab)
        )}
      </div>

    </div>
  );
}