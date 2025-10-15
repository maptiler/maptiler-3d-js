import "@maptiler/sdk/style.css";

import { Map as MapTiler, MapStyle, LngLat } from "@maptiler/sdk";
import { Layer3D } from "../../src/Layer3D";
import { AltitudeReference, SourceOrientation } from "../../src/types";

async function main() {
  const map = new MapTiler({
    container: "map",
    apiKey: "DOESNT_MATTER",
    style: MapStyle.AQUARELLE.VIVID,
    projection: "globe",
    zoom: 17,
    bearing: 0,
    center: [0, 0],
    pitch: 60,
  });

  window.__map = map;

  await map.onReadyAsync();

  const layer3D = new Layer3D("custom-3D-layer");
  map.addLayer(layer3D);

  // Increasing the intensity of the ambient light
  layer3D.setAmbientLight({ intensity: 2 });
  map.on("moveend", (e) => console.log(e.target.getCenter()));
  // Adding a point light
  layer3D.addPointLight("point-light", { intensity: 30 });

  const flamingoID = "flamingo-1";

  const item3d = await layer3D.addMeshFromURL(
    flamingoID,
    // Model by https://mirada.com/ for https://experiments.withgoogle.com/3-dreams-of-black
    "models/Flamingo.glb",
    {
      lngLat: LngLat.convert([0, 0]),
      heading: 12,
      scale: 1,
      altitude: 10,
      animationMode: "manual",
      altitudeReference: AltitudeReference.MEAN_SEA_LEVEL,
    },
  );

  const animationNames = item3d.getAnimationNames();

  const animationName = animationNames[0];

  item3d.playAnimation(animationName, "loop");

  function advanceAnimation() {
    map.setBearing(map.getBearing() + 1);
    item3d.updateAnimation(0.01);
  }

  window.__layer3D = layer3D;

  window.__pageObjects = {
    advanceAnimation,
    // rafLoop,
    modelID: flamingoID,
    // animationName,
  };
}

main();
