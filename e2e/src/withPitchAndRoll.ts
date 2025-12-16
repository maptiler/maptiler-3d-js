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
    zoom: 18,
    bearing: 0,
    center: [0, 0],
    pitch: 60,
  });

  window.__map = map;

  await map.onReadyAsync();

  const layer3D = new Layer3D("custom-3D-layer");
  map.addLayer(layer3D);

  layer3D.setAmbientLight({ intensity: 2 });
  map.on("moveend", (e) => console.log(e.target.getCenter()));

  layer3D.addPointLight("point-light", { intensity: 30 });

  const duck = "duck";

  const itemOne = await layer3D.addMeshFromURL(`${duck}-1`, "models/Duck.glb", {
    lngLat: LngLat.convert([-0.001, 0]),
    scale: 20,
    pitch: 20,
    altitude: 10,
    altitudeReference: AltitudeReference.MEAN_SEA_LEVEL,
  });

  const itemTwo = await layer3D.addMeshFromURL(`${duck}-2`, "models/Duck.glb", {
    lngLat: LngLat.convert([0.001, 0]),
    scale: 20,
    pitch: 20,
    altitude: 10,
    altitudeReference: AltitudeReference.MEAN_SEA_LEVEL,
  });

  function advanceAnimation() {
    itemOne.setPitch(itemOne.pitch + 1);
    itemTwo.setRoll(itemTwo.roll + 1);
  }

  window.__layer3D = layer3D;

  window.__pageObjects = {
    advanceAnimation,
    // rafLoop,
    modelID: [`${duck}-1`, `${duck}-2`],
    // animationName,
  };
}

main();
