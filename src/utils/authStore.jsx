// ── PGOC · Auth Store ─────────────────────────────────────
// Role-based auth for 3 user types — demo grade (no backend needed)
// Place in: src/utils/authStore.js

const USERS = {
  operator:  { password: "nexus2026", role: "OPERATOR",  name: "Arben Kola",  clearance: 3 },
  inspector: { password: "field2026", role: "INSPECTOR", name: "Mirela Doci",   clearance: 1 },
  analyst:   { password: "data2026",  role: "ANALYST",   name: "Ergys Lleshi",  clearance: 2 },
};

// Which HUD tabs each role can see
export const ROLE_TABS = {
  OPERATOR:  ["nexus", "neural", "scan", "iot", "uplink", "threat"],
  INSPECTOR: ["nexus", "scan", "iot", "threat"],
  ANALYST:   ["nexus", "neural", "scan", "iot", "uplink"],
};

const ROLE_PERMS = {
  OPERATOR:  ["viewAll"],
  INSPECTOR: ["viewNodePanel", "viewAlerts", "markInspected"],
  ANALYST:   ["viewHub", "viewNodePanel", "viewFinancials", "viewHistory"],
};

// ── Session persistence ──────────────────────────────────
// Persist the session in sessionStorage so a Vite HMR / page reload doesn't
// kick the user back to the boot/login screen. Scoped to the tab (sessionStorage)
// so closing the tab still requires a fresh login — demo-appropriate.
const SESSION_KEY = "pgoc.session";

function persistSession(session) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
  catch { /* storage unavailable — fall back to in-memory only */ }
}

// ── Login ────────────────────────────────────────────────
export function login(username, password) {
  const key  = username.toLowerCase().trim();
  const user = USERS[key];
  if (!user)                    return { success: false, error: "USER NOT FOUND" };
  if (user.password !== password) return { success: false, error: "INVALID CREDENTIALS" };

  const session = {
    username:  key,
    role:      user.role,
    name:      user.name,
    clearance: user.clearance,
    loginTime: Date.now(),
  };

  window.__nexusUser = session;
  persistSession(session);
  // Notify HUD / panels that a user has logged in
  window.dispatchEvent(new CustomEvent("nexusUserLogin", { detail: session }));
  return { success: true, user: session };
}

// ── Restore / logout ─────────────────────────────────────
// Rehydrate a persisted session into window.__nexusUser on app load. Validated
// against the known USERS table so a stale/tampered blob can't grant access.
// Returns the session if valid, else null (and clears the bad entry).
export function restoreSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    const u = s && s.username ? USERS[s.username] : null;
    if (!u || u.role !== s.role) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    window.__nexusUser = s;
    return s;
  } catch {
    return null;
  }
}

export function logout() {
  window.__nexusUser = null;
  try { sessionStorage.removeItem(SESSION_KEY); }
  catch { /* nothing to clear */ }
}

// ── Accessors ────────────────────────────────────────────
export function getUser() { return window.__nexusUser || null; }

export function can(permission) {
  const user  = getUser();
  if (!user) return false;
  const perms = ROLE_PERMS[user.role] || [];
  return perms.includes("viewAll") || perms.includes(permission);
}

// ── Display helpers ──────────────────────────────────────
export function getRoleLabel(role) {
  return {
    OPERATOR:  "ENERGY DISTRIBUTION OPERATOR",
    INSPECTOR: "FIELD INSPECTION TEAM",
    ANALYST:   "ANALYTICAL & OPERATIONS TEAM",
  }[role] || role;
}

export function getRoleColor(role) {
  return { OPERATOR: "#00ff88", INSPECTOR: "#ffc040", ANALYST: "#4db8ff" }[role] || "#ffffff";
}