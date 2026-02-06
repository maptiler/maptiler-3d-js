import "@maptiler/sdk/style.css";

import { LngLat, Map, MapStyle, config } from "@maptiler/sdk";
import { addPerformanceStats, setupMapTilerApiKey } from "./demo-utils";
import { AltitudeReference, Item3D, Layer3D } from "../../src";
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

  const movingItem3D = await layer3D.addMeshFromURL("biplaneOne", "models/Duck.glb", {
    lngLat: center,
    heading: 0,
    scale: 180,
    altitude: 950,
    altitudeReference: AltitudeReference.MEAN_SEA_LEVEL,
  });

  const sphereRightMesh = new Mesh(new SphereGeometry(250, 32, 32), new MeshStandardMaterial({ color: "red", roughness: 0.5 }));
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

  addDebugCheckBox([leftCubeItem3D, movingItem3D, sphereRightItem3D]);

  function loop() {
    requestAnimationFrame(loop);
    progress += 0.0005;
    if (progress > Math.PI * 2) {
      progress = 0;
    }

    leftCubeItem3D.modify({
      heading: 45,
      altitude: 1000,
    });

    movingItem3D.modify({
      lngLat: [
        itemLngLat.lng + Math.sin(progress * Math.PI * 2) * 0.02,
        itemLngLat.lat,
      ],
      heading: progress * Math.PI * 100,
    });


    const mesh2IntersectsMesh1 = movingItem3D.intersects(leftCubeItem3D, "medium");
    const mesh2IntersectsMesh3 = movingItem3D.intersects(sphereRightItem3D, "medium");
  
    if (mesh2IntersectsMesh1) {
      recursivelySetMaterialColor(leftCubeMesh, "green");
      console.log("mesh2IntersectsMesh1");
    } else if (mesh2IntersectsMesh3) {
      recursivelySetMaterialColor(sphereRightMesh, "blue");
      console.log("mesh2IntersectsMesh3");
    } else {
      recursivelySetMaterialColor(leftCubeMesh, "red");
      recursivelySetMaterialColor(sphereRightMesh, "red");
      console.log("no intersection");
    }
  }

  loop();
}

main();

function recursivelySetMaterialColor(mesh: Mesh | Group | Object3D, color: string) {
  if (mesh instanceof Mesh) {
    mesh.material.userData.oldMap = mesh.material.map;
    mesh.material.map = null;
    mesh.material.color.set(color);
  } else if (mesh instanceof Group) {
    mesh.traverse((node) => {
      if (node instanceof Mesh) {
        console.log(node);
        node.material.userData.oldMap = node.material.map;
        node.material.map = null;
        node.material.color.set(color);
      }
    });
  }
}

function addDebugCheckBox(objects: Item3D[]) {
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  const label = document.createElement("label");
  label.style.position = "absolute";
  label.style.top = "10px";
  label.style.left = "10px";
  label.style.zIndex = "1000";
  label.style.background = "rgba(255,255,255,0.7)";
  label.style.padding = "4px 8px";
  label.style.borderRadius = "3px";
  label.style.fontSize = "14px";
  label.appendChild(checkbox);
  label.appendChild(document.createTextNode(" Show debug bounds"));
  checkbox.addEventListener("change", () => {
    objects.forEach((object) => {
      object.debug = checkbox.checked;
    });
  });
  document.body.appendChild(label);
}