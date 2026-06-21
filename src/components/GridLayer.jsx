// export function addGrid(viewer, Cesium) {
//   const centerLon = 19.82155;
//   const centerLat = 41.32309;

//   const size = 0.025;
//   const spacing = 0.0015;

//  const color = new Cesium.Color(
//   0.2,
//   0.9,
//   1.0,
//   0.45
// );

//   for (let x = -size; x <= size; x += spacing) {
//     viewer.entities.add({
//       polyline: {
//         positions: [
//           Cesium.Cartesian3.fromDegrees(
//             centerLon + x,
//             centerLat - size,
//             1
//           ),
//           Cesium.Cartesian3.fromDegrees(
//             centerLon + x,
//             centerLat + size,
//             1
//           ),
//         ],
//         width: 2,
//         clampToGround: true,
//         material: color,
//       },
//     });
//   }

//   for (let y = -size; y <= size; y += spacing) {
//     viewer.entities.add({
//       polyline: {
//         positions: [
//           Cesium.Cartesian3.fromDegrees(
//             centerLon - size,
//             centerLat + y,
//             1
//           ),
//           Cesium.Cartesian3.fromDegrees(
//             centerLon + size,
//             centerLat + y,
//             1
//           ),
//         ],
//         width: 2,
//         clampToGround: true,
//         material: color,
//       },
//     });
//   }
// }