// ── MOBILE CONFIG ─────────────────────────────────────────
// Toggle this to switch between desktop and mobile demo mode
export const IS_MOBILE_DEMO = false;

export const MOBILE_CAMERA = {
  pitch:    -55,
  distance: 1080,  // +20% zoom-out — more of Tirana visible on load
  speed:    0.0003
};

export const DESKTOP_CAMERA = {
  pitch:    -40,   // less steep — more city visible in fullscreen
  distance: 2520,  // +20% zoom-out — wider establishing view of the grid
  speed:    0.0003
};

export const MOBILE_HUD = {
  showSidebar:      false,
  showBottomNav:    true,
  showCoords:       false,
  compactTopBar:    true,
  sidebarCollapsed: true,
};

export const MOBILE_TABS = ["nexus", "threat", "iot"];