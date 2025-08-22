import "@maptiler/sdk/style.css";
import { Map, MapStyle, config } from "@maptiler/sdk";
import { addPerformanceStats, setupMapTilerApiKey } from "./demo-utils";
import { AltitudeReference, Layer3D } from "../../src";
import GUI from "lil-gui";

setupMapTilerApiKey({ config });
addPerformanceStats();

const map = new Map({
  container: document.getElementById("map") as HTMLElement,
  // geolocate: true,
  style: MapStyle.OUTDOOR,
  zoom: 18,
  center: [2.340862, 48.8565787],
  pitch: 60,
  maxPitch: 85,
  terrainControl: true,
  terrain: true,
  maptilerLogo: true,
  terrainExaggeration: 0.001,
});

(async () => {
  await map.onReadyAsync();

  const layer3D = new Layer3D("custom-3D-layer");
  map.addLayer(layer3D);

  // Increasing the intensity of the ambient light
  layer3D.setAmbientLight({ intensity: 2 });

  // Adding a point light
  layer3D.addPointLight("point-light", { intensity: 30 });

  const gui = new GUI({ width: 400 });

  // Adding a mesh of a lantern.
  // We make this first mesh invisible because we will only use it to be cloned
  const originalLanternID = "lantern";
  await layer3D.addMeshFromURL(originalLanternID, "models/Lantern.glb", {
    scale: 1,
    visible: false,
  });

  const originalDuckID = "duck";
  await layer3D.addMeshFromURL(originalDuckID, "models/Duck.glb", {
    scale: 1,
    visible: false,
  });

  const originalPlaneID = "plane";
  await layer3D.addMeshFromURL(originalPlaneID, "models/plane_a340.glb", {
    scale: 1,
    visible: false,
    altitude: 0,
    altitudeReference: AltitudeReference.MEAN_SEA_LEVEL,
  });

  const originalDragonID = "dragon";
  await layer3D.addMeshFromURL(originalDragonID, "models/stanford_dragon_pbr.glb", {
    scale: 1,
    visible: false,
  });

  const guiObj = {
    model: originalLanternID,
    heading: 0,
    scale: 1,
    altitude: 0,
  };

  let meshCounter = 0;
  let latestMeshID = originalLanternID;

  // Clones of this mesh will be added as we click on the map.
  // The lantern model that is used for the clone is the latest mesh added,
  // so that we can benefit from the latest heading we defined
  map.on("click", (e) => {
    meshCounter += 1;
    const newCloneID = `${originalLanternID}_${meshCounter}`;
    layer3D.cloneMesh(guiObj.model, newCloneID, {
      lngLat: e.lngLat,
      visible: true,
      heading: guiObj.heading,
      scale: guiObj.scale,
    });
    latestMeshID = newCloneID;
  });

  gui.add(guiObj, "model", [originalLanternID, originalDuckID, originalPlaneID, originalDragonID]);

  // We can change the heading of the latest mesh added
  gui.add(guiObj, "heading", 0, 360, 0.1).onChange((heading) => {
    layer3D.getItem3D(latestMeshID)?.setHeading(heading);
  });

  gui.add(guiObj, "scale", 0.01, 10, 0.01).onChange((scale) => {
    layer3D.getItem3D(latestMeshID)?.setScale(scale);
  });

  gui.add(guiObj, "altitude", -100, 1000, 1).onChange((altitude) => {
    layer3D.getItem3D(latestMeshID)?.setAltitude(altitude);
  });
})();
