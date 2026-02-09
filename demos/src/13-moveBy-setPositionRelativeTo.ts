import "@maptiler/sdk/style.css";

import { LngLat, Map, MapStyle, config } from "@maptiler/sdk";
import { addPerformanceStats, setupMapTilerApiKey } from "./demo-utils";
import { AltitudeReference, Layer3D } from "../../src";
import { SourceOrientation } from "../../src/types";
import { ConeGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial } from "three";

const center: [number, number] = [2.3492790851936776, 48.85417501375531];

setupMapTilerApiKey({ config });
addPerformanceStats();

function createAxesMeshes() {
  const directions = ["x", "y", "z"];
  const group = new Group();
  const arrow = new Group();
  
  for (const direction of directions) {
    const arrow = new Group();
    const stem = new Mesh(new CylinderGeometry(0.1, 0.1, 1), new MeshStandardMaterial({ color: 0x000000 }));
    const head = new Mesh(new ConeGeometry(0.2, 1), new MeshStandardMaterial({ color: 0x000000 }));
    arrow.add(stem);
    arrow.add(head);
    arrow.name = direction;
    arrow.rotation.set(direction === "x" ? Math.PI / 2 : 0, direction === "y" ? Math.PI / 2 : 0, direction === "z" ? Math.PI / 2 : 0);
    group.add(arrow);
  }

  return group;
}

async function main() {
  const map = new Map({
    container: document.getElementById("map") as HTMLElement,
    style: MapStyle.SATELLITE.DEFAULT,
    center,
    zoom: 17,
    pitch: 60,
    maxPitch: 85,
    terrainControl: true,
    terrain: true,
    maptilerLogo: true,
    projectionControl: true,
  });

  await map.onReadyAsync();

  const layer3D = new Layer3D("layer3d");
  map.addLayer(layer3D);

  layer3D.setAmbientLight({ intensity: 1 });
  layer3D.addPointLight("point-light", {
    intensity: 30,
    lngLat: center,
    altitude: 100,
    altitudeReference: AltitudeReference.GROUND,
  });

  // First Item3D at center (anchor)
  const anchor = await layer3D.addMesh("anchor", createAxesMeshes(), {
    lngLat: center,
    altitude: 50,
    altitudeReference: AltitudeReference.GROUND,
    scale: 5,
    sourceOrientation: SourceOrientation.Y_UP,
  });

  // Second Item3D: position it relative to anchor, then moveBy to show offset
  layer3D.cloneMesh("anchor", "offset-item");
  const offsetItem = layer3D.getItem3D("offset-item")!;

  // setPositionRelativeTo: place offset-item at anchor, then 30m east and 10m up
  offsetItem.setPositionRelativeTo(
    anchor,
    { x: 30, y: 10, z: 0 },
    "meters",
  );

  // moveBy: move the anchor 20m north and 5m up (from its current position)
  anchor.moveBy({ x: 0, y: 5, z: 20 }, "meters");
}

main();
