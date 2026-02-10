import "@maptiler/sdk/style.css";

import { Map as MapTiler, MapStyle, LngLat, math } from "@maptiler/sdk";
import { BoxGeometry, Mesh, MeshStandardMaterial } from "three";
import { Layer3D } from "../../src/Layer3D";
import { AltitudeReference } from "../../src/types";

async function main() {
  const map = new MapTiler({
    container: "map",
    apiKey: "DOESNT_MATTER",
    style: MapStyle.AQUARELLE.VIVID,
    projection: "globe",
    zoom: 19,
    bearing: 0,
    center: [0, 0],
    pitch: 60,
  });

  window.__map = map;

  await map.onReadyAsync();

  const layer3D = new Layer3D("custom-3D-layer-position-relative-to-move-by");

  await map.onReadyAsync();

  map.addLayer(layer3D);

  layer3D.setAmbientLight({ intensity: 2 });
  layer3D.addPointLight("point-light", { intensity: 30 });

  const boxGeometry = new BoxGeometry(20, 20, 20);
  const materialOne = new MeshStandardMaterial({ color: "#00ff00" });

  const itemOne = layer3D.addMesh("item-1", new Mesh(boxGeometry, materialOne), {
    lngLat: LngLat.convert([0, 0]),
    scale: 1,
    altitude: 10,
    altitudeReference: AltitudeReference.MEAN_SEA_LEVEL,
  });

  const itemTwo = itemOne.clone();

  itemTwo.setPositionRelativeTo(itemOne, { x: 40, y: 0, z: 0 })

  window.__layer3D = layer3D;

  window.__pageObjects = {
    itemIDs: ["item-1", "item-2"],
    itemOne,
    itemTwo,
    EARTH_RADIUS: math.EARTH_RADIUS,
  };
}

main();
