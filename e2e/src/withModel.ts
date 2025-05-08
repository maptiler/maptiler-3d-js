import "@maptiler/sdk/dist/maptiler-sdk.css";
import { Map as MapTiler, MapStyle, coordinates, LngLat } from "@maptiler/sdk";
import { BoxGeometry, Color, DoubleSide, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";
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

  const layer3d = new Layer3D('layer3d')

  map.addLayer(layer3d)

  layer3d.addPointLight('light', {
      lngLat: LngLat.convert([0.001, 0.001]),
      altitude: 100,
      intensity: 1000,
      decay: 1,
      color: '#ffffff',
    })

  layer3d.addMeshFromURL('duck', 'models/rubber_duck/scene.gltf', {
    lngLat: [0,0],
    altitude: 50,
    altitudeReference: AltitudeReference.GROUND,
    scale: 100,
  })

  //@ts-expect-error
  window.__layer3d = layer3d;
}

main()

