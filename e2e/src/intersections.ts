import "@maptiler/sdk/style.css";

import { Map as MapTiler, MapStyle, LngLat } from "@maptiler/sdk";
import type { Object3D } from "three";
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from "three";
import { Layer3D } from "../../src/Layer3D";
import { AltitudeReference } from "../../src/types";

function recursivelySetMaterialColor(mesh: Mesh | Group | Object3D, color: string) {
  if (!mesh) return;
  if (mesh instanceof Mesh) {
    mesh.material.color.set(color);
  } else if (mesh instanceof Group) {
    mesh.traverse((node) => {
      if (node instanceof Mesh) {
        node.material.color.set(color);
      }
    });
  }
}

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

  const layer3D = new Layer3D("custom-3D-layer-intersections");
  map.addLayer(layer3D);

  layer3D.setAmbientLight({ intensity: 2 });
  layer3D.addPointLight("point-light", { intensity: 30 });

  const boxGeometry = new BoxGeometry(20, 20, 20);
  const materialOne = new MeshStandardMaterial({ color: "#00ff00" });

  const itemOne = layer3D.addMesh("item-1", new Mesh(boxGeometry, materialOne), {
    lngLat: LngLat.convert([-0.001, 0]), // Slightly west of center
    scale: 1,
    altitude: 10,
    altitudeReference: AltitudeReference.MEAN_SEA_LEVEL,
  });

  const itemTwo = await layer3D.addMeshFromURL("item-2", "models/Duck.glb", {
    lngLat: LngLat.convert([0.001, 0]),
    scale: 20,
    altitude: 10,
    heading: 90,
    altitudeReference: AltitudeReference.MEAN_SEA_LEVEL,
  });
  // const itemTwo = layer3D.addMesh("item-2", new Mesh(boxGeometry, materialOne), {
  //   lngLat: LngLat.convert([+0.001, 0]), // Slightly west of center
  //   scale: 1,
  //   altitude: 10,
  //   altitudeReference: AltitudeReference.MEAN_SEA_LEVEL,
  // });

  itemOne.debug = true;
  itemTwo.debug = true;

  window.__layer3D = layer3D;

  window.__pageObjects = {
    itemIDs: ["item-1", "item-2"],
    map,
    itemOne,
    itemTwo,
    recursivelySetMaterialColor,
  };
}

main();
