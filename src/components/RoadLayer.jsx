const ROADS = [];
export function addRoads(viewer, Cesium) {
  ROADS.forEach(({ coords, width, glow, opacity }) => {

    const positions = coords.map(([lon, lat]) =>
      Cesium.Cartesian3.fromDegrees(lon, lat, 0)
    );

    viewer.entities.add({
      polyline: {
        positions,
        width:    width * 1.4,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: glow * 0.7,
          color:     new Cesium.Color(0.15, 0.65, 1.0, opacity * 0.65),
        }),
        clampToGround: true,
      },
    });

  });
}