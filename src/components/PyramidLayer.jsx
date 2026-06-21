export function addPyramid(viewer, Cesium) {
  const lon = 19.821553566427898;
  const lat = 41.323093839054714;

  const APEX_H     = 120;
  const R_LON      = 0.0016;
  const R_LAT      = 0.00105;
  const NUM_LEVELS = 12;
  const FACE_SEGS  = 7;

  const apex = Cesium.Cartesian3.fromDegrees(lon, lat, APEX_H);
  const CORNER_DEGS = [45, 135, 225, 315];

  const corners = CORNER_DEGS.map((deg) => {
    const rad = Cesium.Math.toRadians(deg);
    return {
      lon: lon + Math.cos(rad) * R_LON,
      lat: lat + Math.sin(rad) * R_LAT,
    };
  });

  const mkGlow = (r, g, b, a, gp) =>
    new Cesium.PolylineGlowMaterialProperty({
      glowPower: gp,
      color: new Cesium.Color(r, g, b, a),
    });

  // ── Main corner ribs — stop at 5m NOT 0 ──────────────────
  corners.forEach((c) => {
    viewer.entities.add({
      polyline: {
        positions: [
          apex,
          Cesium.Cartesian3.fromDegrees(c.lon, c.lat, 5),
        ],
        width: 2.5,
        material: mkGlow(0.05, 0.85, 1.0, 1.0, 0.9),
      },
    });
  });

  // ── Horizontal levels ─────────────────────────────────────
  for (let lvl = 1; lvl <= NUM_LEVELS; lvl++) {
    const t   = lvl / NUM_LEVELS;
    const h   = APEX_H * (1 - t);
    const pts = [...CORNER_DEGS, CORNER_DEGS[0]].map((deg) => {
      const rad = Cesium.Math.toRadians(deg);
      return Cesium.Cartesian3.fromDegrees(
        lon + Math.cos(rad) * R_LON * t,
        lat + Math.sin(rad) * R_LAT * t,
        h
      );
    });

    viewer.entities.add({
      polyline: {
        positions: pts,
        width: lvl === NUM_LEVELS ? 4 : 1.8,
        material: mkGlow(0.05, 0.75, 1.0, 0.8, 0.5),
      },
    });
  }

  // ── Face ribs — stop at 5m NOT 0 ─────────────────────────
  for (let face = 0; face < 4; face++) {
    const c1 = corners[face];
    const c2 = corners[(face + 1) % 4];

    for (let seg = 1; seg < FACE_SEGS; seg++) {
      const t = seg / FACE_SEGS;
      viewer.entities.add({
        polyline: {
          positions: [
            apex,
            Cesium.Cartesian3.fromDegrees(
              c1.lon + (c2.lon - c1.lon) * t,
              c1.lat + (c2.lat - c1.lat) * t,
              5
            ),
          ],
          width: 1.2,
          material: mkGlow(0.1, 0.55, 1.0, 0.45, 0.35),
        },
      });
    }
  }

  // ── Base outline ──────────────────────────────────────────
  const basePts = [...CORNER_DEGS, CORNER_DEGS[0]].map((deg) => {
    const rad = Cesium.Math.toRadians(deg);
    return Cesium.Cartesian3.fromDegrees(
      lon + Math.cos(rad) * R_LON * 1.08,
      lat + Math.sin(rad) * R_LAT * 1.08,
      5
    );
  });

  viewer.entities.add({
    polyline: {
      positions: basePts,
      width: 3,
      material: mkGlow(0.05, 0.85, 1.0, 1.0, 0.8),
    },
  });

  // ── Apex marker ───────────────────────────────────────────
  viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(lon, lat, APEX_H),
    point: {
      pixelSize: 8,
      color: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.CYAN,
      outlineWidth: 3,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });

  // ── Label ─────────────────────────────────────────────────
  // Rendered as a crisp HTML overlay in MapViewer.jsx (see the label layer),
  // so the scene bloom pass no longer blurs the hub title.
}