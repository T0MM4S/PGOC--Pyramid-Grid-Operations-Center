export function addBuildingDots(viewer, Cesium) {

  const ZONES = [
    { lon: 19.8245, lat: 41.3285, rLon: 0.0055, rLat: 0.0035, n: 14, minH: 40, maxH: 98  },
    { lon: 19.8295, lat: 41.3262, rLon: 0.0040, rLat: 0.0028, n: 10, minH: 25, maxH: 55  },
    { lon: 19.8310, lat: 41.3225, rLon: 0.0045, rLat: 0.0030, n: 11, minH: 18, maxH: 42  },
    { lon: 19.8285, lat: 41.3188, rLon: 0.0040, rLat: 0.0028, n:  9, minH: 15, maxH: 38  },
    { lon: 19.8215, lat: 41.3170, rLon: 0.0055, rLat: 0.0030, n: 12, minH: 20, maxH: 52  },
    { lon: 19.8135, lat: 41.3182, rLon: 0.0042, rLat: 0.0030, n:  9, minH: 15, maxH: 36  },
    { lon: 19.8095, lat: 41.3225, rLon: 0.0040, rLat: 0.0032, n: 10, minH: 18, maxH: 44  },
    { lon: 19.8120, lat: 41.3272, rLon: 0.0038, rLat: 0.0028, n:  8, minH: 20, maxH: 48  },
    { lon: 19.8195, lat: 41.3268, rLon: 0.0030, rLat: 0.0022, n:  7, minH: 28, maxH: 62  },
    { lon: 19.8355, lat: 41.3220, rLon: 0.0038, rLat: 0.0025, n:  7, minH: 14, maxH: 32  },
    { lon: 19.8060, lat: 41.3220, rLon: 0.0035, rLat: 0.0025, n:  6, minH: 12, maxH: 28  },
    { lon: 19.8210, lat: 41.3320, rLon: 0.0048, rLat: 0.0030, n:  8, minH: 15, maxH: 36  },
    { lon: 19.8215, lat: 41.3135, rLon: 0.0048, rLat: 0.0028, n:  7, minH: 12, maxH: 30  },
    { lon: 19.8248, lat: 41.3231, rLon: 0.0020, rLat: 0.0014, n:  5, minH: 30, maxH: 70  },
    { lon: 19.8178, lat: 41.3231, rLon: 0.0020, rLat: 0.0014, n:  5, minH: 25, maxH: 60  },
  ];

  ZONES.forEach((z, zi) => {
    for (let i = 0; i < z.n; i++) {
      const s1 = ((zi * 37 + i * 53 + 7)  % 97) / 97;
      const s2 = ((zi * 61 + i * 29 + 13) % 89) / 89;
      const s3 = ((zi * 43 + i * 71 + 3)  % 83) / 83;
      const s4 = ((zi * 19 + i * 47 + 11) % 79) / 79;
      const s5 = ((zi * 67 + i * 11 + 17) % 73) / 73;

      if (s5 < 0.15) continue;

      const angle = s1 * Math.PI * 2;
      const dist  = Math.sqrt(s2) * 0.9 + 0.1;
      const lon   = z.lon + Math.cos(angle) * z.rLon * dist;
      const lat   = z.lat + Math.sin(angle) * z.rLat * dist;
      const h     = z.minH + s4 * (z.maxH - z.minH);

      const isBig = s3 > 0.84;
      const isMid = s3 > 0.55;

      viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lon, lat, h),
        point: {
          pixelSize: isBig ? 6.5 : isMid ? 4.0 : 2.5,
          color: new Cesium.Color(
            isBig ? 1.0  : isMid ? 0.88 : 0.72,
            isBig ? 1.0  : isMid ? 0.96 : 0.91,
            1.0,
            isBig ? 1.0  : isMid ? 0.85 : 0.62
          ),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: isBig ? 2 : 0.8,
          scaleByDistance: new Cesium.NearFarScalar(300, 1.8, 5000, 0.2),
          disableDepthTestDistance: Number.POSITIVE_INFINITY, // always on top
        },
      });
    }
  });
}