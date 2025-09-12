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
    zoom: 18,
    center: [0, 0],
    pitch: 60,
  });

  window.__map = map;

  await map.onReadyAsync();

  const layer3d = new Layer3D("layer3d");

  map.addLayer(layer3d);

  const coordinates = [
    [-1, -1, 0],
    [1, -1, 0],
    [1, 1, 0],
    [-1, 1, 0],
    [-1, -1, 1],
    [1, -1, 1],
    [1, 1, 1],
    [-1, 1, 1],
    [0, 0.5, 0],
  ];

  layer3d.addPointLight("light", {
    lngLat: LngLat.convert([0.001, 0.001]),
    altitude: 100,
    intensity: 1000,
    decay: 1,
    color: "#ffffff",
  });

  coordinates.forEach((coord, i, arr) => {
    const [lng, lat, alt] = coord;
    const colorIndex = coord.reduce((acc, val) => acc + val, 20);
    const color = Object.keys(Color.NAMES)[colorIndex] as keyof typeof Color.NAMES;
    const mesh = new Mesh(
      new BoxGeometry(10, 10, 10),
      new MeshStandardMaterial({ color, metalness: 0.25, roughness: 0.5 }),
    );

    const multiplier = i === arr.length - 1 ? 1 : 0.0005;

    const normalised = [lng, lat].map((n) => n * multiplier) as [number, number];


    const meshID = `cube-${lng}-${lat}-${alt}`;
    const item = layer3d.addMesh(meshID, mesh, {
      lngLat: LngLat.convert(normalised),
      altitude: alt * 50,
      altitudeReference: AltitudeReference.GROUND,
      scale: 1,
    });

    item.modify({
      lngLat: LngLat.convert(normalised),
      heading: i * 10,
    });
  });
}

main();
