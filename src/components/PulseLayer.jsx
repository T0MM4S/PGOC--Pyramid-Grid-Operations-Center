export function addPulseLayer(viewer, Cesium) {
  const lon = 19.821553566427898;
  const lat  = 41.323093839054714;

  const startTime = viewer.clock.currentTime.clone();

  // ── 3 staggered expanding rings ───────────────────────────
[0, 2.5, 5].forEach((offsetSec) => {
  const CYCLE   = 7.5;
  const MAX_RAD = 120;
  const MIN_RAD = 28;

  const radius = new Cesium.CallbackProperty((time) => {
    const elapsed = Cesium.JulianDate.secondsDifference(time, startTime);
    const t = ((elapsed + offsetSec) % CYCLE) / CYCLE;

    return MIN_RAD + t * (MAX_RAD - MIN_RAD);
  }, false);

  const color = new Cesium.CallbackProperty((time) => {
    const elapsed = Cesium.JulianDate.secondsDifference(time, startTime);
    const t = ((elapsed + offsetSec) % CYCLE) / CYCLE;

    // Slightly softer opacity
    const a = t < 0.1
      ? t / 0.1 * 0.6
      : 0.6 * (1 - ((t - 0.1) / 0.9));

    return new Cesium.Color(0.15, 0.55, 1.0, a);
  }, false);

  viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(lon, lat, 2),
    ellipse: {
      semiMajorAxis: radius,
      semiMinorAxis: radius,
      material: new Cesium.ColorMaterialProperty(color),
      height: 2,
      outline: false,
    },
  });
});
  // ── Pyramid apex pulse ────────────────────────────────────
  const apexSize = new Cesium.CallbackProperty((time) => {
    const elapsed = Cesium.JulianDate.secondsDifference(time, startTime);
    return 8 + Math.abs(Math.sin(elapsed * 1.2)) * 10;
  }, false);

  const apexColor = new Cesium.CallbackProperty((time) => {
    const elapsed = Cesium.JulianDate.secondsDifference(time, startTime);
    const pulse = 0.75 + Math.abs(Math.sin(elapsed * 1.2)) * 0.25;
    return new Cesium.Color(pulse, pulse, 1.0, 1.0);
  }, false);

  viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(lon, lat, 122),
    point: {
      pixelSize: apexSize,
      color: apexColor,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });

  // ── Data flow dots on connections ─────────────────────────
  const NODES = [
    { lon: 19.8187, lat: 41.3281 }, // Skanderbeg
    { lon: 19.8220, lat: 41.3310 }, // National Library
    { lon: 19.8338, lat: 41.3308 }, // Tirana Tower
    { lon: 19.8165, lat: 41.3183 }, // Blloku
    { lon: 19.8258, lat: 41.3178 }, // Rinia Park
  ];

  NODES.forEach((node, ni) => {
    const FLOW_CYCLE = 3.0 + ni * 0.4;
    const phaseOffset = ni * 0.7;

    for (let dot = 0; dot < 3; dot++) {
      const dotOffset = dot * (FLOW_CYCLE / 3);

      const dotPos = new Cesium.CallbackProperty((time) => {
        const elapsed = Cesium.JulianDate.secondsDifference(time, startTime);
        const t = ((elapsed + phaseOffset + dotOffset) % FLOW_CYCLE) / FLOW_CYCLE;

        // Interpolate from node to pyramid
        const dLon = lon + (node.lon - lon) * (1 - t);
        const dLat = lat + (node.lat - lat) * (1 - t);
        const h    = 55 + Math.sin(t * Math.PI) * 30;

        return Cesium.Cartesian3.fromDegrees(dLon, dLat, h);
      }, false);

      const dotColor = new Cesium.CallbackProperty((time) => {
        const elapsed = Cesium.JulianDate.secondsDifference(time, startTime);
        const t = ((elapsed + phaseOffset + dotOffset) % FLOW_CYCLE) / FLOW_CYCLE;
        const brightness = 0.5 + Math.sin(t * Math.PI) * 0.5;
        return new Cesium.Color(brightness, 1.0, 1.0, brightness);
      }, false);

      viewer.entities.add({
        position: dotPos,
        point: {
          pixelSize: 3.5,
          color: dotColor,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
    }
  });

  // NOTE: The per-node "glow pulse" ellipses were removed — they only
  // covered 5 of the 13 nodes at a large radius (40m) with a bright,
  // animated fill, which made those nodes look like solid glowing stains
  // while the other 8 had only the subtle sensor ring. The single, uniform
  // ground ring is now drawn for every node in NodeLayer.jsx instead.
}