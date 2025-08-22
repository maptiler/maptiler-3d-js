import "@maptiler/sdk/style.css";
import { Map, MapStyle, config } from "@maptiler/sdk";
import { AltitudeReference, Layer3D } from "../../src";
import GUI from "lil-gui";
import { addPerformanceStats, setupMapTilerApiKey } from "./demo-utils";

setupMapTilerApiKey({ config });
addPerformanceStats();

const map = new Map({
  container: document.getElementById("map") as HTMLElement,
  hash: false,
  // geolocate: true,
  style: MapStyle.DATAVIZ,
  zoom: 17,
  center: [-0.17642900347709656, 51.496198574865645],
  pitch: 60,
  maxPitch: 85,
  terrainControl: true,
  terrain: true,
  terrainExaggeration: 0.001,
  maptilerLogo: true,
});

(async () => {
  await map.onReadyAsync();

  map.setSky({
    "sky-color": "#b2ddfa",
    "horizon-color": "#FFFFFF",
    "fog-color": "#FFFFFF",
    "fog-ground-blend": 0.8,
    "horizon-fog-blend": 0.1,
    "sky-horizon-blend": 0.6,
    "atmosphere-blend": 0.5,
  });

  const layer3D = new Layer3D("custom-3D-layer");
  map.addLayer(layer3D);

  // Increasing the intensity of the ambient light
  layer3D.setAmbientLight({ intensity: 2 });

  // Adding a point light
  layer3D.addPointLight("point-light", { intensity: 30 });

  const gui = new GUI({ width: 400 });

  const meshId = "some-mesh";
  await layer3D.addMeshFromURL(
    meshId,
     // https://sketchfab.com/3d-models/hintze-hall-nhm-london-point-cloud-be909aa8afa545118be6d36397529e2f
    "models/hintze_hall_nhm_london_point_cloud.glb",
    {
      lngLat: [-0.17642900347709656, 51.496198574865645],
      heading: 83.6,
      scale: 1,
      visible: true,
      altitude: 0,
      altitudeReference: AltitudeReference.GROUND,
    },
  );

  const guiObj = {
    opacity: 1,
    pointSize: 1,
    fov: map.transform.fov,
  };

  const item = layer3D.getItem3D(meshId);
  gui.add(guiObj, "opacity", 0, 1).onChange((opacity) => {
    item?.setOpacity(opacity);
  });

  gui.add(guiObj, "pointSize", 0, 20, 0.1).onChange((pointSize) => {
    item?.setPointSize(pointSize);
  });
})();
