import "@maptiler/sdk/style.css";

import { LngLat, Map, MapStyle, config } from "@maptiler/sdk";
import { addPerformanceStats, setupMapTilerApiKey } from "./demo-utils";
import { AltitudeReference, Layer3D } from "../../src";
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, SphereGeometry } from "three";

setupMapTilerApiKey({ config });
addPerformanceStats();

const center: [number, number] = [-11.400203704833984, 21.124376760369245];

async function main() {
  const map = new Map({
    container: document.getElementById("map") as HTMLElement,
    style: MapStyle.SATELLITE.DEFAULT,
    center: center,
    maxPitch: 85,
    terrainControl: true,
    terrain: true,
    maptilerLogo: true,
    projectionControl: true,
    zoom: 14,
    bearing: 0,
    pitch: 45,
  });

  await map.onReadyAsync();

  const layer3D = new Layer3D("item3d-intersections");

  map.addLayer(layer3D);

  layer3D.addPointLight("light", {
    lngLat: [
      center[0],
      center[1],
    ],
    intensity: 10,
    decay: 0.1,
    color: "#ffffff",
    altitude: 6000,
  });

  map.on("click", (e) => {
    console.log(e.lngLat);
  });

  const leftCubeMesh = new Mesh(new BoxGeometry(400, 400, 400), new MeshStandardMaterial({ color: "green", metalness: 0.25, roughness: 0.5 }));
  leftCubeMesh.name = "static-cube-1";
  const leftCubeItem3D = layer3D.addMesh("mesh1", leftCubeMesh, {
    altitudeReference: AltitudeReference.MEAN_SEA_LEVEL,
    lngLat: [
      center[0] - 0.02,
      center[1],
    ],
  });

  leftCubeItem3D.modify({
    heading: 45,
    altitude: 1000,
  });

  const movingGroup = new Group();
  const cube = new Mesh(new BoxGeometry(10, 100, 10), new MeshStandardMaterial({ color: "red", roughness: 0.5 }));
  cube.name = "moving-cube-1";
  movingGroup.add(cube);
  
  const cube2 = new Mesh(new BoxGeometry(100, 10, 10), new MeshStandardMaterial({ color: "red", roughness: 0.5 }));
  cube2.position.y = 0;
  cube2.name = "moving-cube-2";
  movingGroup.add(cube2);

  const movingItem3D = await layer3D.addMeshFromURL("biplaneOne", "models/biplane/scene.gltf", {
    lngLat: center,
    heading: 0,
    scale: 180,
    altitude: 950,
    altitudeReference: AltitudeReference.MEAN_SEA_LEVEL,
    transform: {
      rotation: {
        y: Math.PI / 2,
      },
    }
  });

  const sphereRightMesh = new Mesh(new SphereGeometry(250, 32, 32), new MeshStandardMaterial({ color: "blue", roughness: 0.5 }));
  sphereRightMesh.name = "static-sphere";
  const sphereRightItem3D = layer3D.addMesh("sphere", sphereRightMesh, {
    lngLat: [
      center[0] + 0.02,
      center[1],
    ],
    altitude: 1000,
    altitudeReference: AltitudeReference.MEAN_SEA_LEVEL,
  });

  
  const itemLngLat = movingItem3D.lngLat;
  let progress = 0;

  function loop() {
    requestAnimationFrame(loop);
    progress += 0.001;
    if (progress > Math.PI * 2) {
      progress = 0;
    }

    movingItem3D.modify({
      lngLat: [
        itemLngLat.lng + Math.sin(progress * Math.PI * 2) * 0.02,
        itemLngLat.lat,
      ],
      roll: progress * Math.PI * 100,
    });

    const mesh2IntersectsMesh1 = movingItem3D.intersects(leftCubeItem3D, "medium");
    const mesh2IntersectsMesh3 = movingItem3D.intersects(sphereRightItem3D, "medium");

    if (!movingItem3D.mesh) return;
  
    if (mesh2IntersectsMesh1) {
      recursivelySetMaterialColor(leftCubeMesh, "green");
    } else if (mesh2IntersectsMesh3) {
      recursivelySetMaterialColor(sphereRightMesh, "blue");
    } else {
      recursivelySetMaterialColor(leftCubeMesh, "red");
      recursivelySetMaterialColor(sphereRightMesh, "red");
    }
  }

  loop();
}

main();

function recursivelySetMaterialColor(mesh: Mesh | Group | Object3D, color: string) {
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