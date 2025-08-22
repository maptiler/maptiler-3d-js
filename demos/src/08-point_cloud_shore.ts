import "@maptiler/sdk/style.css";
import { Map, MapStyle, config } from "@maptiler/sdk";
import { AltitudeReference, Layer3D } from "../../src";
import GUI from "lil-gui";
import { addPerformanceStats, setupMapTilerApiKey } from "./demo-utils";

setupMapTilerApiKey({ config });
addPerformanceStats();
const map = new Map({
  container: document.getElementById("map") as HTMLElement,
  hash: true,
  // geolocate: true,
  style: MapStyle.STREETS,
  zoom: 15,
  center: [-74.076273, 40.58592],
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
    "models/parque_copan_design_proposal.glb",
    {
      lngLat: [-74.0839886924465, 40.5804232016599],
      scale: 1,
      visible: true,
      altitude: -752,
      altitudeReference: AltitudeReference.GROUND,
    },
  );

  const guiObj = {
    opacity: 1,
    pointSize: 1,
  };

  gui.add(guiObj, "opacity", 0, 1).onChange((opacity) => {
    layer3D.getItem3D(meshId)?.setOpacity(opacity);
  });

  gui.add(guiObj, "pointSize", 0, 20, 0.1).onChange((pointSize) => {
    layer3D.getItem3D(meshId)?.setPointSize(pointSize);
  });
})();
