import { cityNodes } from "../data/cityNodes";

const CATEGORY_COLOR = {
  landmark:       { r: 0.0,  g: 1.0,  b: 1.0,  hex: "#00ffff" },
  culture:        { r: 0.4,  g: 0.8,  b: 1.0,  hex: "#66ccff" },
  infrastructure: { r: 1.0,  g: 0.75, b: 0.0,  hex: "#ffbf00" },
  zone:           { r: 0.35, g: 1.0,  b: 0.55, hex: "#59ff8c" },
  commercial:     { r: 1.0,  g: 0.4,  b: 0.8,  hex: "#ff66cc" },
  transport:      { r: 0.6,  g: 0.6,  b: 1.0,  hex: "#9999ff" },
};

function getColor(Cesium, category, alpha = 1.0) {
  const c = CATEGORY_COLOR[category] || CATEGORY_COLOR.landmark;
  return new Cesium.Color(c.r, c.g, c.b, alpha);
}

const TERRAIN_BASE = 115;
const PIN_HEIGHT   = 180;

// ── Ground ring constants — identical for every node, never derived ──
// from per-node state, so all 13 sensor rings read the same on screen.
const RING_RADIUS        = 28;   // semiMajor === semiMinor for all nodes
const RING_FILL_ALPHA    = 0.12; // faint fill — a subtle disc, not a blob
const RING_OUTLINE_ALPHA = 0.5;  // crisp thin outline

export function addNodes(viewer, Cesium) {
  cityNodes.forEach((node) => {
    const color      = getColor(Cesium, node.category, 1.0);
    const colorDim   = getColor(Cesium, node.category, RING_OUTLINE_ALPHA);
    const colorFaint = getColor(Cesium, node.category, RING_FILL_ALPHA);

    const nodePos = Cesium.Cartesian3.fromDegrees(node.lon, node.lat, PIN_HEIGHT);
    const basePos = Cesium.Cartesian3.fromDegrees(node.lon, node.lat, TERRAIN_BASE + 2);

    // ── Pin stem ───────────────────────────────────────────────────
    viewer.entities.add({
      polyline: {
        positions: [basePos, nodePos],
        width: 1.5,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.4,
          color: colorDim,
        }),
      },
    });

    // ── Ground ring ────────────────────────────────────────────────
    viewer.entities.add({
      position: basePos,
      ellipse: {
        semiMajorAxis: RING_RADIUS,
        semiMinorAxis: RING_RADIUS,
        material: colorFaint,
        outline: true,
        outlineColor: colorDim,
        outlineWidth: 1,
        height: TERRAIN_BASE + 1,
      },
    });

    // ── Pin head dot — bigger pixelSize for 1900m camera distance ──
    // Node name labels are NOT Cesium scene-labels (the scene bloom pass made
    // them fuzzy). They are rendered as crisp HTML overlays in MapViewer.jsx.
    viewer.entities.add({
      id:       node.id,
      position: nodePos,
      point: {
        pixelSize:    18,                // was 14 — bigger at new distance
        color:        color,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2.5,
        scaleByDistance:          new Cesium.NearFarScalar(400, 1.4, 8000, 0.45),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
  });
}

export function highlightNode(viewer, Cesium, nodeId) {
  const entity = viewer.entities.getById(nodeId);
  if (!entity || !entity.point) return;
  entity.point.pixelSize    = new Cesium.ConstantProperty(26);
  entity.point.outlineWidth = new Cesium.ConstantProperty(4);
  entity.point.color        = new Cesium.ConstantProperty(Cesium.Color.WHITE);
}

export function resetNode(viewer, Cesium, nodeId, category) {
  const entity = viewer.entities.getById(nodeId);
  if (!entity || !entity.point) return;
  const c = CATEGORY_COLOR[category] || CATEGORY_COLOR.landmark;
  entity.point.pixelSize    = new Cesium.ConstantProperty(18);
  entity.point.outlineWidth = new Cesium.ConstantProperty(2.5);
  entity.point.color        = new Cesium.ConstantProperty(
    new Cesium.Color(c.r, c.g, c.b, 1.0)
  );
}