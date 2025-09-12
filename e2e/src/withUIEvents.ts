import "@maptiler/sdk/dist/maptiler-sdk.css";
import { Map as MapTiler, MapStyle, coordinates, LngLat } from "@maptiler/sdk";
import { BoxGeometry, Color, DoubleSide, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";
import { Layer3D } from "../../src/Layer3D";
import { AltitudeReference } from "../../src/types";

async function main() {
  const map = new MapTiler({
    container: "map",
    apiKey: "DOESNT_MATTER",
    style: MapStyle.SATELLITE,
    projection: "mercator",
    zoom: 17,
    bearing: 45,
    center: [0, 0],
    pitch: 60,
  });

  window.__map = map;

  await map.onReadyAsync();

  const layer3d = new Layer3D("layer3d");

  map.addLayer(layer3d);

  layer3d.addPointLight("light", {
    lngLat: LngLat.convert([0.001, 0.001]),
    altitude: 100,
    intensity: 1000,
    decay: 1,
    color: "#ffffff",
  });

  const cubeMesh = new Mesh(new BoxGeometry(10, 10, 10), new MeshStandardMaterial({ color: "red" }));
  const cubeMeshID = "cube";

  const item = layer3d.addMesh(cubeMeshID, cubeMesh, {
    lngLat: LngLat.convert([0, 0]),
    altitude: 100,
    scale: 10,
    altitudeReference: AltitudeReference.GROUND,
  });

  item.on("mouseenter", (e) => {
    console.log("mouseenter");
    item.modify({
      scale: 15,
    });
  });

  item.on("mouseleave", () => {
    console.log("mouseleave");
    item.modify({
      scale: 10,
    });
  });


  const mousedownHandler = () => {
    console.log("mousedown");
    item.modify({
      opacity: 0.5,
    });
  };

  item.on("mousedown", mousedownHandler);

  const mouseupHandler = () => {
    console.log("mouseup");
    item.modify({
      opacity: 1,
    });
    item.off("mousedown", mousedownHandler);
    item.off("mouseup", mouseupHandler);
  };

  item.on("mouseup", mouseupHandler);

  item.on("dblclick", (e) => {
    console.log("dblclick");
    item.modify({
      altitude: 10,
    });
  });

  window.__layer3D = layer3d;

  window.__pageObjects = {
    meshId: cubeMeshID,
  };
}

main();
