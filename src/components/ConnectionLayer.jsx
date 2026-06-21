import { cityNodes } from "../data/cityNodes";

export function addConnections(viewer, Cesium) {
  const pyramidLon = 19.821553566427898;
  const pyramidLat = 41.323093839054714;

  const CATEGORY_COLOR = {
    landmark:       new Cesium.Color(0.0,  1.0,  1.0,  0.28),
    culture:        new Cesium.Color(0.4,  0.8,  1.0,  0.25),
    infrastructure: new Cesium.Color(1.0,  0.75, 0.0,  0.25),
    zone:           new Cesium.Color(0.35, 1.0,  0.55, 0.25),
  };

  cityNodes.forEach((node) => {
    if (node.id === "pyramid") return;
    const col = CATEGORY_COLOR[node.category] || new Cesium.Color(0.2, 0.7, 1.0, 0.25);

    viewer.entities.add({
      polyline: {
        positions: [
          Cesium.Cartesian3.fromDegrees(pyramidLon, pyramidLat, 90),
          Cesium.Cartesian3.fromDegrees(node.lon, node.lat, 50),
        ],
        width:    1.2,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.12,
          color:     col,
        }),
      },
    });
  });
}