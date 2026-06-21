export function addCityDots(viewer, Cesium) {
  const centerLon = 19.8215;
  const centerLat = 41.3230;

  // Deterministic grid with offset — no random so it's stable on re-render
  const cols = 22;
  const rows = 16;
  const spanLon = 0.034;
  const spanLat = 0.022;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Offset every other row for hex-grid feel
      const offset = (r % 2) * 0.0008;

      const lon = centerLon - spanLon / 2 + (c / cols) * spanLon + offset;
      const lat = centerLat - spanLat / 2 + (r / rows) * spanLat;

      // Vary size and brightness pseudo-randomly per cell
      const seed  = (r * 31 + c * 17) % 100;
      const size  = seed < 20 ? 3.5 : seed < 60 ? 2.5 : 1.8;
      const alpha = seed < 20 ? 0.95 : seed < 60 ? 0.65 : 0.35;
      const h     = seed < 20 ? 20 + (seed * 1.5) : 5 + (seed * 0.3);

      viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lon, lat, h),
        point: {
          pixelSize: size,
          color: new Cesium.Color(0.75, 0.92, 1.0, alpha),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 0.5,
          scaleByDistance: new Cesium.NearFarScalar(300, 1.4, 3000, 0.3),
        },
      });
    }
  }
}