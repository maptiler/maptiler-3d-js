import "@maptiler/sdk/style.css";

import { LngLat, type LngLatLike, Map, MapStyle, config, math } from "@maptiler/sdk";
import { addPerformanceStats, setupMapTilerApiKey } from "./demo-utils";
import { AltitudeReference, Layer3D } from "../../src";
import GUI from "lil-gui";
import { BoxGeometry, Mesh, MeshBasicMaterial, MeshStandardMaterial, SphereGeometry, TorusGeometry, TorusKnotGeometry, Vector3 } from "three";
import { LTC_Evaluate } from "three/src/nodes/functions/BSDF/LTC.js";
import { FontLoader, TextGeometry } from "three/examples/jsm/Addons.js";

setupMapTilerApiKey({ config });
addPerformanceStats();

const elCapitan: [number, number] = [-119.63553428649902, 37.728162793005595]

const map = new Map({
  container: document.getElementById("map") as HTMLElement,
  style: MapStyle.SATELLITE.DEFAULT,
  center: elCapitan,
  maxPitch: 85,
  terrainControl: true,
  terrain: true,
  maptilerLogo: true,
  projectionControl: true,
  zoom: 14,
  bearing: 0,
  pitch: 45,
});

const shapes: {lngLat: [number, number], mesh: Mesh, name: string, altitude?: number}[] = [
  {
    lngLat: [-119.65308666229248, 37.738277034695685],
      mesh: (
        new Mesh(
          new BoxGeometry(10, 10, 10),
          new MeshStandardMaterial({ color: "red", roughness: 0.5, metalness: 0.5 })
        )
    ),
    name: "box",
    altitude: 120,
  },
  {
    lngLat: [-119.61553573608398, 37.723071209025974],
    mesh: (
      new Mesh(
        new SphereGeometry(10),
        new MeshStandardMaterial({ color: "blue", roughness: 0.5, metalness: 0.5 })
      )
    ),
    name: "sphere",
    altitude: 120,
  },
  {
    lngLat: [-119.63008403778076, 37.735154664553534],
    altitude: 260,
    mesh: (
        new Mesh(
          new TorusGeometry(10, 5, 32, 32),
          new MeshStandardMaterial({ color: "green", roughness: 0.5, metalness: 0.5 })
        )
    ),
    name: "torus"
  },
  {
    lngLat: [-119.65128421783447, 37.72208679574618],
    altitude: 300,
    mesh: (
        new Mesh(
          new TorusKnotGeometry(10, 2, 32, 32),
          new MeshStandardMaterial({ color: "rebeccapurple", roughness: 0.5, metalness: 0.5 })
        )
    ),
    name: "torusKnot"
  },
];

const info = document.getElementById("event-info") as HTMLElement;

function setInfo(text: string) {
  info.innerHTML = text;
}

(async () => {
  await map.onReadyAsync();
  

  const layer3D = new Layer3D("custom-3D-layer");
  map.addLayer(layer3D);

  // Increasing the intensity of the ambient light
  layer3D.setAmbientLight({ intensity: 2 });

  // Adding a point light
  layer3D.addPointLight("point-light", { intensity: 30 });

  shapes.forEach((shape) => {
    const initialScale = 20;

    layer3D.addMesh(shape.name, shape.mesh, {
      lngLat: new LngLat(shape.lngLat[0], shape.lngLat[1]),
      heading: 0,
      scale: initialScale,
      altitude: shape.altitude,
    });
    const mesh = layer3D.getItem3D(shape.name);

    const threeMesh = mesh?.mesh as Mesh;

    const originalMaterial = threeMesh?.material as MeshStandardMaterial;
    const swapMaterial = new MeshBasicMaterial({ color: "dodgerblue" });


    mesh?.on("mouseenter", (event) => {
      const mesh = layer3D.getItem3D(shape.name);
      const threeMesh = mesh?.mesh;
      if (threeMesh && "material" in threeMesh) {
        threeMesh.material = swapMaterial;
      }
      setInfo(`mouseenter! \n
        name: ${shape.name}\n
        lng: ${shape.lngLat[0]} \n
        lat: ${shape.lngLat[1]} \n
        x, y: ${event.point.x}, ${event.point.y} \n
      `);
    });
    mesh?.on("mouseleave", (event) => {
      const mesh = layer3D.getItem3D(shape.name);
      const internalMesh = mesh?.mesh;
      if (internalMesh && "material" in internalMesh) {
        internalMesh.material = originalMaterial;
      }
      setInfo(`mouseleave! \n
        name: ${shape.name}\n
        lng: ${shape.lngLat[0]} \n
        lat: ${shape.lngLat[1]} \n
        x, y: ${event.point.x}, ${event.point.y} \n
      `);
    });
    
    mesh?.on("click", (event) => {
      if (mesh?.scale === initialScale) {
        mesh?.setScale(initialScale * 1.5);
      } else {
        mesh?.setScale(initialScale);
      }
      setInfo(`click! \n
        name: ${shape.name}\n
        lng: ${shape.lngLat[0]} \n
        lat: ${shape.lngLat[1]} \n
        x, y: ${event.point.x}, ${event.point.y} \n
      `);
    });

    mesh?.on("dblclick", (event) => {
      setInfo(`dblclick! \n
        name: ${shape.name}\n
        lng: ${shape.lngLat[0]} \n
        lat: ${shape.lngLat[1]} \n
        x, y: ${event.point.x}, ${event.point.y} \n
      `);
    });
  });

  let heading = 0;


  function loop() {
    requestAnimationFrame(loop);
    map.setBearing(map.getBearing() + 0.05);
    for (const { name: meshName } of shapes) {
      layer3D.getItem3D(meshName)?.modify({
        heading: heading,
      });
    }
    heading += 0.5;
  }

  loop();

})();
