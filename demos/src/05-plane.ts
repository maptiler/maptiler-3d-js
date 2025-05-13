import "@maptiler/sdk/style.css";
import { Map, MapStyle, config } from "@maptiler/sdk";
import { addPerformanceStats, setupMapTilerApiKey } from "./demo-utils";
import { AltitudeReference, Layer3D } from "../../src/Layer3D";
import GUI from "lil-gui";

setupMapTilerApiKey({ config });
addPerformanceStats();

const map = new Map({
  container: document.getElementById("map") as HTMLElement,
  hash: true,
  // geolocate: true,
  style: MapStyle.OUTDOOR.DARK,
  zoom: 11,
  center: [7.22, 46.18],
  pitch: 60,
  maxPitch: 85,
  terrainControl: true,
  terrain: true,
  maptilerLogo: true,
});

(async () => {
  await map.onReadyAsync();

  map.setSky({
    "sky-color": "#0C2E4B",
    "horizon-color": "#09112F",
    "fog-color": "#09112F",
    "fog-ground-blend": 0.5,
    "horizon-fog-blend": 0.1,
    "sky-horizon-blend": 1.0,
    "atmosphere-blend": 0.5,
  });

  const layer3D = new Layer3D("custom-3D-layer");
  map.addLayer(layer3D);

  // Increasing the intensity of the ambient light
  layer3D.setAmbientLight({ intensity: 2 });

  // Adding a point light
  layer3D.addPointLight("point-light", { intensity: 30 });

  const gui = new GUI({ width: 400 });

  // Adding a mesh of a plane.

  const guiObj = {
    projection: "mercator",
    heading: 0,
    scale: 1,
    altitude: 3000,
    opacity: 1,
    wireframe: false,
    altitudeReference: "MEAN_SEA_LEVEL",
    removePlane: () => {
      layer3D.removeMesh(originalPlaneID);
    },
  };

  const originalPlaneID = "plane";
  await layer3D.addMeshFromURL(originalPlaneID, "models/plane_a340.glb", {
    scale: guiObj.scale,
    altitude: guiObj.altitude,
    altitudeReference: AltitudeReference.MEAN_SEA_LEVEL,
    wireframe: guiObj.wireframe,
  });

  let planeCanMove = false;

  // Adding mesh of a plane
  map.on("mousemove", (e) => {
    if (!planeCanMove) return;

    layer3D.modifyMesh(originalPlaneID, { lngLat: e.lngLat });
  });

  map.on("click", (e) => {
    planeCanMove = !planeCanMove;
  });

  gui
    .add(guiObj, "projection", ["mercator", "globe"])
    .onChange((projection) => {
      switch (projection) {
        case "mercator":
          map.enableMercatorProjection();
          break;

        case "globe":
          map.enableGlobeProjection();
          break;

        default:
          throw new Error("Unsupported projection");
      }
    });

  gui.add(guiObj, "heading", 0, 360, 0.1).onChange((heading) => {
    layer3D.modifyMesh(originalPlaneID, { heading });
  });

  gui.add(guiObj, "scale", 0.01, 1000, 0.01).onChange((scale) => {
    layer3D.modifyMesh(originalPlaneID, { scale });
  });

  gui.add(guiObj, "altitude", 0, 10000, 1).onChange((altitude) => {
    layer3D.modifyMesh(originalPlaneID, { altitude });
  });

  gui.add(guiObj, "opacity", 0, 1).onChange((opacity) => {
    layer3D.modifyMesh(originalPlaneID, { opacity });
  });

  gui
    .add(guiObj, "altitudeReference", ["MEAN_SEA_LEVEL", "GROUND"])
    .onChange((altRef: keyof AltitudeReference) => {
      const altitudeReference = AltitudeReference[altRef]
      layer3D.modifyMesh(originalPlaneID, {
        altitudeReference,
      });
    });

  gui.add(guiObj, "wireframe").onChange((wireframe) => {
    layer3D.modifyMesh(originalPlaneID, { wireframe });
  });

  gui.add(guiObj, "removePlane");
})();
