import "@maptiler/sdk/style.css";
import GUI from "lil-gui";
import { AltitudeReference, Layer3D } from "../../src/Layer3D";
import { Map, MapStyle, config } from "@maptiler/sdk";
import { addPerformanceStats, setupMapTilerApiKey } from "./demo-utils";

setupMapTilerApiKey({ config });
addPerformanceStats();

const map = new Map({
  container: document.getElementById("map") as HTMLElement,
  hash: false,
  // geolocate: true,
  style: MapStyle.DATAVIZ.DARK,
  zoom: 15,
  center: [139.401378125492, 35.567323827763786],
  pitch: 60,
  maxPitch: 85,
  terrainControl: true,
  // terrain: true,
  // terrainExaggeration: 0.001,
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
  layer3D.addPointLight("point-light-1", {
    intensity: 30,
    lngLat: [40, 0],
    color: 0xdbf8ff,
    altitude: 1_000_000,
  });
  layer3D.addPointLight("point-light-2", {
    intensity: 30,
    lngLat: [-120, 80],
    color: 0xfff7db,
  });

  const gui = new GUI({ width: 400 });

  const guiObj = {
    heading: 320.5,
    scale: 1,
    altitude: 0.16,
    altitudeReference: "GROUND",
    opacity: 1,
    wireframe: true,
  };

  const meshId = "some-mesh";
  await layer3D.addMeshFromURL(
    meshId,
    // https://sketchfab.com/3d-models/building-f-agu-sagamihara-campus-lod2-3-7d7b0d0d0a454a54aa50528f6483e2c6
    "models/building_f_agu_sagamihara_campus_lod2-3.glb",
    {
      lngLat: [139.401378125492, 35.567323827763786],
      heading: guiObj.heading,
      scale: guiObj.scale,
      visible: true,
      altitude: guiObj.altitude,
      altitudeReference: AltitudeReference.GROUND,
      wireframe: guiObj.wireframe,
    },
  );

  gui.add(guiObj, "heading", 0, 360, 0.1).onChange((heading) => {
    layer3D.modifyMesh(meshId, { heading });
  });

  gui.add(guiObj, "scale", 0.01, 5, 0.01).onChange((scale) => {
    layer3D.modifyMesh(meshId, { scale });
  });

  gui.add(guiObj, "altitude", -100, 100, 0.01).onChange((altitude) => {
    layer3D.modifyMesh(meshId, { altitude });
  });

  gui.add(guiObj, "opacity", 0, 1).onChange((opacity) => {
    layer3D.modifyMesh(meshId, { opacity });
  });

  gui.add(guiObj, "altitudeReference", ["GROUND", "MEAN_SEA_LEVEL"]).onChange((altRef: keyof AltitudeReference) => {
    layer3D.modifyMesh(meshId, {
      altitudeReference: AltitudeReference[altRef],
    });
  });

  gui.add(guiObj, "wireframe").onChange((wireframe) => {
    layer3D.modifyMesh(meshId, { wireframe });
  });
})();
