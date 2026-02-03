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
    intensity: 300,
    decay: 0.1,
    color: "#ffffff",
    altitude: 3000,
  });

  map.on("click", (e) => {
    console.log(e.lngLat);
  });

  const mesh1 = layer3D.addMesh("mesh1", new Mesh(new BoxGeometry(400, 400, 400), new MeshStandardMaterial({ color: "green", metalness: 0.25, roughness: 0.5 })), {
    altitudeReference: AltitudeReference.MEAN_SEA_LEVEL,
    lngLat: [
      center[0] - 0.02,
      center[1],
    ],
  });

  mesh1.modify({
    heading: 45,
    altitude: 1000,
  });

  const mesh2Group = new Group();
  const cube = new Mesh(new BoxGeometry(10, 100, 10), new MeshStandardMaterial({ color: "red", roughness: 0.5 }));
  mesh2Group.add(cube);
  
  const cube2 = new Mesh(new BoxGeometry(100, 10, 10), new MeshStandardMaterial({ color: "red", roughness: 0.5 }));
  cube2.position.y = 50;
  mesh2Group.add(cube2);

  const mesh2Spehere = new Mesh(new SphereGeometry(10, 32, 32), new MeshStandardMaterial({ color: "red", roughness: 0.5 }));
  mesh2Spehere.position.y = 50;
  mesh2Group.add(mesh2Spehere);

  const mesh2 = layer3D.addMesh("mesh2", mesh2Group);

  mesh2.modify({
    lngLat: [
      center[0],
      center[1],
    ],
    scale: 30,
  });

  const mesh3 = layer3D.addMesh("sphere", new Mesh(new SphereGeometry(250, 32, 32), new MeshStandardMaterial({ color: "blue", roughness: 0.5 })), {
    altitudeReference: AltitudeReference.MEAN_SEA_LEVEL,
    lngLat: [
      center[0] + 0.02,
      center[1],
    ],
  });

  mesh3.modify({
    // lngLat: center,
    altitude: 1000,
  });

  let progress = 0;

  const itemLngLat = mesh2.lngLat;


  // Create an external variable 'run' and inject a button for controlling it
  let run = true;

  // Create a button element
  const stopButton = document.createElement('button');
  stopButton.textContent = 'Stop';
  stopButton.style.position = 'absolute';
  stopButton.style.top = '10px';
  stopButton.style.left = '10px';
  stopButton.style.zIndex = '10000';
  stopButton.style.padding = '8px 16px';
  stopButton.style.background = '#222';
  stopButton.style.color = '#fff';
  stopButton.style.border = 'none';
  stopButton.style.borderRadius = '4px';
  stopButton.style.cursor = 'pointer';

  // Append the button to the body
  document.body.appendChild(stopButton);

  // Add a click listener that sets 'run' to false
  stopButton.addEventListener('click', () => {
    run = !run;
  });

  function loop() {
    requestAnimationFrame(loop);
    if (!run) return;
    progress += 0.001;
    if (progress > 1) {
      progress = 0;
    }

    mesh2.modify({
      lngLat: [
        itemLngLat.lng + Math.sin(progress * Math.PI * 2) * 0.02,
        itemLngLat.lat,
      ],
      roll: progress * Math.PI * 100,
    });

    const mesh2IntersectsMesh1 = mesh2.intersects(mesh1, "narrow");
    const mesh2IntersectsMesh3 = mesh2.intersects(mesh3, "narrow");

    if (!mesh2.mesh) return;
  
    if (mesh2IntersectsMesh1) {
      recursivelySetMaterialColor(mesh2.mesh, "green");
    } else if (mesh2IntersectsMesh3) {
      recursivelySetMaterialColor(mesh2.mesh, "blue");
    } else {
      recursivelySetMaterialColor(mesh2.mesh, "red");
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