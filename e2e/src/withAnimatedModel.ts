import "@maptiler/sdk/style.css";

import { Map as MapTiler, MapStyle } from "@maptiler/sdk";
import { AltitudeReference, Layer3D } from "../../src/Layer3D";

async function main() {
  const map = new MapTiler({
    container: "map",
    apiKey: "DOESNT_MATTER",
    style: MapStyle.SATELLITE,
    projection: "mercator",
    zoom: 17,
    bearing: 0,
    center: [0, 0],
    pitch: 60,
  });

  //@ts-expect-error
  window.__map = map;

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

  const flamingoID = "flamingo";

  await layer3D.addMeshFromURL(flamingoID, {
    url: "models/Flamingo.glb",
    lngLat: [0, 0],
    heading: 0,
    scale: 1,
    altitude: 10,
    animationMode: "manual",
    altitudeReference: AltitudeReference.MEAN_SEA_LEVEL,
    initialTransform: {
      rotation: {
        x: 0,
        y: Math.PI / 2,
        z: 0,
      },
      offset: {
        x: 0,
        y: 0,
        z: 0,
      },
    },
  });

  const animationNames = layer3D.getAnimationNames(flamingoID);

  const animationName = animationNames[0];

  // const updateSpeed = 0.001;
  layer3D.playAnimation(flamingoID, animationName, "loop");

  function advanceAnimation() {
    map.setBearing(map.getBearing() + 1);
    layer3D.updateAnimation(flamingoID, 0.01);
  }

  //@ts-expect-error
  window.__layer3D = layer3D;

  //@ts-expect-error
  window.__pageObjects = {
    advanceAnimation,
    // rafLoop,
    modelID: flamingoID,
    animationName,
  };
}

main();
