import { useEffect, useRef } from "react";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { addNodes }        from "./NodeLayer";
import { addPyramid }      from "./PyramidLayer";
import { addBuildingDots } from "./BuildingDots";
import { addRoads }        from "./RoadLayer";
import { addPulseLayer }   from "./PulseLayer";
import { cityNodes }       from "../data/cityNodes";
import HUD        from "./HUD";
import NodePanel  from "./NodePanel";
import HubPanel   from "./HubPanel";
import AnalyticsDashboard from "./AnalyticsDashboard";
import { startSimulator, getNodeState } from "../utils/dataLoader";

import {
  MOBILE_CAMERA,
  DESKTOP_CAMERA,
  IS_MOBILE_DEMO,
} from "../config/mobileConfig";

const PYRAMID_LON = 19.821553566427898;
const PYRAMID_LAT = 41.323093839054714;

export default function MapViewer({ onLogout }) {
  const cesiumRef     = useRef(null);
  const labelLayerRef = useRef(null);

  useEffect(() => {
    const token  = import.meta.env.VITE_CESIUM_TOKEN;
    const Cesium = window.Cesium;
    if (!token || !Cesium) return;

    Cesium.Ion.defaultAccessToken = token;

    const viewer = new Cesium.Viewer(cesiumRef.current, {
      animation:            false,
      timeline:             false,
      baseLayerPicker:      false,
      geocoder:             false,
      homeButton:           false,
      sceneModePicker:      false,
      navigationHelpButton: false,
      infoBox:              false,
      selectionIndicator:   false,
      shouldAnimate:        true,
    });

    // ── Dark world ──────────────────────────────────────────
    viewer.imageryLayers.removeAll();
    viewer.scene.globe.baseColor                = new Cesium.Color(0.0, 0.01, 0.06, 1);
    viewer.scene.backgroundColor                = new Cesium.Color(0, 0, 0.02, 1);
    viewer.scene.skyAtmosphere.show             = false;
    viewer.scene.skyBox.show                    = false;
    viewer.scene.sun.show                       = false;
    viewer.scene.moon.show                      = false;
    viewer.scene.globe.showGroundAtmosphere     = false;
    viewer.scene.globe.enableLighting           = false;
    viewer.scene.globe.atmosphereLightIntensity = 0.0;
    viewer.cesiumWidget.creditContainer.style.display = "none";
    viewer.scene.requestRenderMode              = true;

    // ── Bloom ───────────────────────────────────────────────
    try {
      const bloom               = viewer.scene.postProcessStages.bloom;
      bloom.enabled             = true;
      bloom.uniforms.contrast   = 155;
      bloom.uniforms.brightness = -0.13;
      bloom.uniforms.glowOnly   = false;
      bloom.uniforms.delta      = 1.0;
      bloom.uniforms.sigma      = 4.4;
      bloom.uniforms.stepSize   = 9.5;
    } catch (e) { console.warn("Bloom:", e); }

    // ── OSM Buildings ────────────────────────────────────────
    async function loadBuildings() {
      try {
        const buildings = await Cesium.createOsmBuildingsAsync();
        buildings.style = new Cesium.Cesium3DTileStyle({
          color: "color('#1448a0', 0.88)",
        });
        buildings.maximumScreenSpaceError = 8;
        buildings.preloadAncestors        = true;
        buildings.preloadSiblings         = true;
        if (!viewer.isDestroyed()) viewer.scene.primitives.add(buildings);
      } catch (err) { console.error("Buildings:", err); }
    }

    loadBuildings();
    addRoads(viewer, Cesium);
    addBuildingDots(viewer, Cesium);
    addNodes(viewer, Cesium);
    addPyramid(viewer, Cesium);
    addPulseLayer(viewer, Cesium);

    // ── Node selection state (declared early so all closures share it) ──
    let selectedNodeId = null;
    let selectedBeamId = null;

    // ── Risk-color language — shared so selection never destroys it ──
    const RISK_CSS  = { LOW: "#00ffff", MEDIUM: "#ffc040", HIGH: "#ff7a30", CRITICAL: "#ff2d2d" };
    const RISK_SIZE = { LOW: 18, MEDIUM: 19, HIGH: 21, CRITICAL: 25 };
    const riskLevelOf = (id) => getNodeState(id)?.riskLevel || "LOW";
    const riskColorOf = (id) =>
      Cesium.Color.fromCssColorString(RISK_CSS[riskLevelOf(id)] || RISK_CSS.LOW);
    const riskSizeOf  = (id) => RISK_SIZE[riskLevelOf(id)] || 18;

    // Paint the seeded risk colors right away so pre-flagged zones read on
    // the map from the first frame (consistent with the alerts + event feed).
    cityNodes.forEach((n) => {
      const entity = viewer.entities.getById(n.id);
      if (!entity || !entity.point) return;
      entity.point.color     = new Cesium.ConstantProperty(riskColorOf(n.id));
      entity.point.pixelSize = new Cesium.ConstantProperty(riskSizeOf(n.id));
    });

    // ── Live simulator → map color/size feedback ─────────────
    const stopSim = startSimulator((nodeId, state) => {
      const entity = viewer.entities.getById(nodeId);
      if (!entity || !entity.point || nodeId === selectedNodeId) return;

      entity.point.color     = new Cesium.ConstantProperty(
        Cesium.Color.fromCssColorString(RISK_CSS[state.riskLevel] || RISK_CSS.LOW)
      );
      entity.point.pixelSize = new Cesium.ConstantProperty(RISK_SIZE[state.riskLevel] || 18);
    });

    // ── Invisible pyramid hub click target ───────────────────
    viewer.entities.add({
      id: "pyramid-hub",
      position: Cesium.Cartesian3.fromDegrees(PYRAMID_LON, PYRAMID_LAT, 125),
      point: {
        pixelSize:                55,
        color:                    new Cesium.Color(0.0, 0.6, 1.0, 0.01),
        outlineColor:             Cesium.Color.TRANSPARENT,
        outlineWidth:             0,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });

    // ── Camera setup ──────────────────────────────────────────
    const cam = IS_MOBILE_DEMO || window.innerWidth < 768
      ? MOBILE_CAMERA
      : DESKTOP_CAMERA;

    let currentHeading = Cesium.Math.toRadians(20);
    let orbitPaused    = false;
    let orbitCallback  = null;
    let flightToken    = 0;
    let resumeTimer    = null;

    function startOrbit() {
      if (viewer.isDestroyed()) return;
      orbitCallback = () => {
        if (viewer.isDestroyed() || orbitPaused) return;
        currentHeading += cam.speed;
        window.__cameraHeading = currentHeading;
        viewer.camera.lookAt(
          Cesium.Cartesian3.fromDegrees(PYRAMID_LON, PYRAMID_LAT, 0),
          new Cesium.HeadingPitchRange(
            currentHeading,
            Cesium.Math.toRadians(cam.pitch),
            cam.distance
          )
        );
      };
      viewer.clock.onTick.addEventListener(orbitCallback);
    }

    function flyToNodeAndReturn(nodeLon, nodeLat) {
      orbitPaused = true;
      const myToken = ++flightToken;

      if (resumeTimer) {
        clearTimeout(resumeTimer);
        resumeTimer = null;
      }

      viewer.camera.cancelFlight();
      viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);

      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(nodeLon, nodeLat - 0.0035, 480),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch:   Cesium.Math.toRadians(-38),
          roll:    0,
        },
        duration:       1.6,
        easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
        complete: () => {
          if (myToken !== flightToken) return;
          resumeTimer = setTimeout(() => {
            if (viewer.isDestroyed()) return;
            if (myToken !== flightToken) return;
            orbitPaused = false;
          }, 2400);
        },
      });
    }

    // ── Shared helper: clear current node selection visuals ──
    function clearNodeSelection() {
      if (selectedNodeId) {
        const prev = viewer.entities.getById(selectedNodeId);
        if (prev && prev.point) {
          // Return to the node's CURRENT live risk color/size, never a default
          prev.point.pixelSize    = new Cesium.ConstantProperty(riskSizeOf(selectedNodeId));
          prev.point.outlineColor = new Cesium.ConstantProperty(Cesium.Color.WHITE);
          prev.point.outlineWidth = new Cesium.ConstantProperty(2.5);
          prev.point.color        = new Cesium.ConstantProperty(riskColorOf(selectedNodeId));
        }
        selectedNodeId = null;
      }
      if (selectedBeamId) {
        viewer.entities.removeById(selectedBeamId);
        selectedBeamId = null;
      }
    }

    // ── Single click handler ──────────────────────────────────
    const clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    clickHandler.setInputAction((click) => {
      const picked = viewer.scene.pick(click.position);

      if (Cesium.defined(picked) && picked.id && picked.id.id) {
        const entityId = picked.id.id;

        // ── Pyramid hub click ──────────────────────────────
        if (entityId === "pyramid-hub") {
          // Close NodePanel + clear map selection so only Hub is visible
          clearNodeSelection();
          window.dispatchEvent(new CustomEvent("nodeSelected", { detail: { id: null } }));
          window.dispatchEvent(new CustomEvent("pyramidClick"));
          return;
        }

        const node = viewer.entities.getById(entityId);
        if (!node || !node.point) return;

        // Reset any previously selected node
        if (selectedNodeId && selectedNodeId !== entityId) {
          clearNodeSelection();
        }
        if (selectedBeamId) {
          viewer.entities.removeById(selectedBeamId);
          selectedBeamId = null;
        }

        // Highlight selected — KEEP the risk color as fill, signal "selected"
        // with a larger dot + a thick white outline ring (not a white fill).
        selectedNodeId = entityId;
        node.point.color        = new Cesium.ConstantProperty(riskColorOf(entityId));
        node.point.pixelSize    = new Cesium.ConstantProperty(riskSizeOf(entityId) + 8);
        node.point.outlineColor = new Cesium.ConstantProperty(Cesium.Color.WHITE);
        node.point.outlineWidth = new Cesium.ConstantProperty(5);

        // Beam to pyramid apex
        const beamId = `beam-${entityId}`;
        viewer.entities.add({
          id: beamId,
          polyline: {
            positions: [
              node.position.getValue(Cesium.JulianDate.now()),
              Cesium.Cartesian3.fromDegrees(PYRAMID_LON, PYRAMID_LAT, 125),
            ],
            width: 1.5,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.6,
              color: new Cesium.Color(0.3, 0.9, 1.0, 0.7),
            }),
          },
        });
        selectedBeamId = beamId;

        setTimeout(() => {
          if (!viewer.isDestroyed()) viewer.entities.removeById(beamId);
          if (selectedBeamId === beamId) selectedBeamId = null;
        }, 4000);

        // Fly to node
        const pos   = node.position.getValue(Cesium.JulianDate.now());
        const carto = Cesium.Cartographic.fromCartesian(pos);
        flyToNodeAndReturn(
          Cesium.Math.toDegrees(carto.longitude),
          Cesium.Math.toDegrees(carto.latitude)
        );

        // Close Hub panel (if open) so only NodePanel shows, then select node
        window.dispatchEvent(new CustomEvent("closeHubPanel"));
        window.dispatchEvent(new CustomEvent("nodeSelected", { detail: { id: entityId } }));

      } else {
        // Clicked empty space — deselect everything
        clearNodeSelection();
        window.dispatchEvent(new CustomEvent("nodeSelected", { detail: { id: null } }));
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // ── Crisp HTML label overlays ──────────────────────────────
    // Node + hub names are drawn as DOM elements (not Cesium scene-labels) so
    // they stay perfectly sharp — the scene bloom pass used to blur scene text.
    // The same pass also (a) hides labels behind the top bar / bottom nav and
    // (b) suppresses labels that would overlap a higher-priority one, so the
    // close cluster (Mother Teresa Sq / Palace of Culture / Rinia Park) no
    // longer renders an unreadable pile of overlapping text.
    const toWindow =
      Cesium.SceneTransforms.worldToWindowCoordinates?.bind(Cesium.SceneTransforms) ||
      Cesium.SceneTransforms.wgs84ToWindowCoordinates?.bind(Cesium.SceneTransforms);

    const LABEL_TARGETS = cityNodes.map((n) => ({
      id:    n.id,
      title: n.title.toUpperCase(),
      halfW: n.title.length * 3.6 + 11,   // approx half label width in px
      world: Cesium.Cartesian3.fromDegrees(n.lon, n.lat, 180),
    }));

    const labelLayer = labelLayerRef.current;
    const labelEls   = new Map();
    let   pyramidEl  = null;

    if (labelLayer) {
      labelLayer.innerHTML = "";
      LABEL_TARGETS.forEach((t) => {
        const el = document.createElement("div");
        el.className   = "map-node-label";
        el.textContent = t.title;
        el.style.display = "none";
        labelLayer.appendChild(el);
        labelEls.set(t.id, el);
      });

      pyramidEl = document.createElement("div");
      pyramidEl.className = "map-hub-label";
      pyramidEl.innerHTML = `<span class="map-hub-name">PYRAMID OF TIRANA</span><span class="map-hub-sub">PCC</span>`;
      pyramidEl.style.display = "none";
      labelLayer.appendChild(pyramidEl);
    }

    const PYRAMID_WORLD = Cesium.Cartesian3.fromDegrees(PYRAMID_LON, PYRAMID_LAT, 150);

    const labelManager = () => {
      if (viewer.isDestroyed() || !toWindow || !labelLayer) return;
      const scene     = viewer.scene;
      const h         = scene.canvas.clientHeight;
      const topCut    = 56;       // top bar
      const bottomCut = h - 72;   // bottom nav (62px) + breathing room
      const kept      = [];

      // Pyramid hub label always shows and gets first claim on screen space.
      const pWin = toWindow(scene, PYRAMID_WORLD);
      if (pyramidEl) {
        if (pWin) {
          pyramidEl.style.transform =
            `translate(${pWin.x}px, ${pWin.y}px) translate(-50%, -100%)`;
          if (pyramidEl.style.display !== "block") pyramidEl.style.display = "block";
          kept.push({ x: pWin.x, y: pWin.y, halfW: 90 });
        } else if (pyramidEl.style.display !== "none") {
          pyramidEl.style.display = "none";
        }
      }

      // Selected node gets next claim on screen space.
      const ordered = selectedNodeId
        ? [...LABEL_TARGETS].sort((a, b) =>
            a.id === selectedNodeId ? -1 : b.id === selectedNodeId ? 1 : 0)
        : LABEL_TARGETS;

      for (const t of ordered) {
        const el = labelEls.get(t.id);
        if (!el) continue;

        const win        = toWindow(scene, t.world);
        const isSelected = t.id === selectedNodeId;
        let   show       = true;

        if (!win) {
          show = false;
        } else if (!isSelected && (win.y > bottomCut || win.y < topCut)) {
          show = false;
        } else {
          for (const k of kept) {
            if (Math.abs(k.x - win.x) < t.halfW + k.halfW &&
                Math.abs(k.y - win.y) < 17) {
              show = false;
              break;
            }
          }
        }

        if (show && win) {
          kept.push({ x: win.x, y: win.y, halfW: t.halfW });
          el.style.transform =
            `translate(${win.x}px, ${win.y}px) translate(-50%, calc(-100% - 18px))`;
          el.style.borderColor = RISK_CSS[riskLevelOf(t.id)] || RISK_CSS.LOW;
          el.classList.toggle("selected", isSelected);
          if (el.style.display !== "block") el.style.display = "block";
        } else if (el.style.display !== "none") {
          el.style.display = "none";
        }
      }
    };
    viewer.scene.preRender.addEventListener(labelManager);

    // ── Idle node flicker ──────────────────────────────────────
    const allNodeIds  = cityNodes.map(n => n.id);
    const idleFlicker = setInterval(() => {
      if (viewer.isDestroyed()) return;
      const id     = allNodeIds[Math.floor(Math.random() * allNodeIds.length)];
      const entity = viewer.entities.getById(id);
      if (!entity || !entity.point || id === selectedNodeId) return;
      const baseSize = riskSizeOf(id);
      let c = 0;
      const iv = setInterval(() => {
        entity.point.pixelSize = new Cesium.ConstantProperty(c % 2 === 0 ? baseSize + 6 : baseSize);
        c++;
        if (c > 3) { clearInterval(iv); entity.point.pixelSize = new Cesium.ConstantProperty(baseSize); }
      }, 180);
    }, 7000);

    // ── Node pulse from B key ────────────────────────────────
    const pulseHandler = (e) => {
      const entity = viewer.entities.getById(e.detail.id);
      if (!entity || !entity.point) return;
      if (e.detail.id === selectedNodeId) return;
      const baseColor = riskColorOf(e.detail.id);
      const baseSize  = riskSizeOf(e.detail.id);
      let count = 0;
      const interval = setInterval(() => {
        entity.point.pixelSize = new Cesium.ConstantProperty(count % 2 === 0 ? 30 : baseSize);
        entity.point.color     = new Cesium.ConstantProperty(
          count % 2 === 0 ? Cesium.Color.WHITE : baseColor
        );
        count++;
        if (count > 7) {
          clearInterval(interval);
          entity.point.pixelSize = new Cesium.ConstantProperty(baseSize);
          entity.point.color     = new Cesium.ConstantProperty(baseColor);
        }
      }, 200);
    };
    window.addEventListener("pulseNode", pulseHandler);

    // ── Intro: start from space, sweep down, then orbit ──────
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(PYRAMID_LON, PYRAMID_LAT, 14000),
      orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
    });

    const flyTimeout = setTimeout(() => {
      if (viewer.isDestroyed()) return;
      viewer.camera.flyTo({
        // End the descent ~20% higher so the establishing shot hands off to the
        // (now farther) orbit smoothly and shows more of Tirana on load.
        destination: Cesium.Cartesian3.fromDegrees(PYRAMID_LON, PYRAMID_LAT, 2150),
        orientation: {
          heading: Cesium.Math.toRadians(20),
          pitch:   Cesium.Math.toRadians(-55),
          roll:    0,
        },
        duration:       4.5,
        easingFunction: Cesium.EasingFunction.QUINTIC_IN_OUT,
        complete:       startOrbit,
      });
    }, 3500);

    // ── Cleanup ──────────────────────────────────────────────
    return () => {
      clearTimeout(flyTimeout);
      clearTimeout(resumeTimer);
      clearInterval(idleFlicker);
      clickHandler.destroy();
      if (!viewer.isDestroyed()) viewer.scene.preRender.removeEventListener(labelManager);
      if (labelLayer) labelLayer.innerHTML = "";
      window.removeEventListener("pulseNode", pulseHandler);
      if (orbitCallback && !viewer.isDestroyed()) {
        viewer.clock.onTick.removeEventListener(orbitCallback);
      }
      stopSim?.();
      if (!viewer.isDestroyed()) viewer.destroy();
    };

  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <div ref={cesiumRef} style={{ width: "100%", height: "100%" }} />
      <div
        ref={labelLayerRef}
        className="map-label-layer"
        style={{
          position:      "absolute",
          inset:         0,
          overflow:      "hidden",
          pointerEvents: "none",
          zIndex:        5,
        }}
      />
      <HUD onLogout={onLogout} />
      <div className="right-panel-column" style={{
        position:      "fixed",
        top:           "62px",
        right:         "16px",
        // 322 − 12px left padding === 310px of content, so panels keep their
        // width while the left padding leaves room for their glow box-shadow.
        width:         "322px",
        padding:       "4px 0 18px 12px",
        boxSizing:     "border-box",
        // Reserve the top bar (62px) + the 62px bottom nav + a small gap so
        // the bottom-most button (RUN AI PEER ANALYSIS) is always reachable.
        maxHeight:     "calc(100vh - 132px)",
        overflowY:     "auto",
        overflowX:     "hidden",
        zIndex:        10001,
        pointerEvents: "all",
        display:       "flex",
        flexDirection: "column",
        gap:           "6px",
      }}>
        <NodePanel />
      </div>
      <HubPanel />
      <AnalyticsDashboard />
    </div>
  );
}