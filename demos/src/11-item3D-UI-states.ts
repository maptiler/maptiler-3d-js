import "@maptiler/sdk/style.css";

import { LngLat, Map, MapStyle, config } from "@maptiler/sdk";
import { addPerformanceStats, setupMapTilerApiKey } from "./demo-utils";
import { AltitudeReference, Layer3D } from "../../src";
import { Mesh, MeshStandardMaterial, OctahedronGeometry } from "three";

setupMapTilerApiKey({ config });
addPerformanceStats();

const benNevis: [number, number] = [-5.0032930796849096, 56.796620721112916]
const aonachMor: [number, number] = [-4.960101659312182, 56.81639253645723]

const map = new Map({
  container: document.getElementById("map") as HTMLElement,
  style: MapStyle.SATELLITE.DEFAULT,
  center:  [-4.972085952758789, 56.80891387436256],
  maxPitch: 85,
  terrainControl: true,
  terrain: true,
  maptilerLogo: true,
  projectionControl: true,
  zoom: 12.5,
  bearing: 0,
  pitch: 45,
});

const munros =  [
  {
    lngLat: [-5.0032930796849096, 56.796620721112916],
    mesh: new Mesh(
      new OctahedronGeometry(5),
      new MeshStandardMaterial({ color: "red", roughness: 0.5, metalness: 0.5 })
    ),
    name: "Ben Nevis", 
    userData: {
      height: "1344m",
    }
  },
  {
    lngLat: [-4.960101659312182, 56.81639253645723],
    mesh: new Mesh(
      new OctahedronGeometry(5),
      new MeshStandardMaterial({ color: "green", roughness: 0.5, metalness: 0.5 })
    ),
    name: "Aonach Mor", 
    userData: {
      height: "1221m",
    }
  },
  {
    lngLat: [-4.955949783325195, 56.7987164051377],
    mesh: new Mesh(
      new OctahedronGeometry(5),
      new MeshStandardMaterial({ color: "blue", roughness: 0.5, metalness: 0.5 })
    ),
    name: "Aonach Beag", 
    userData: {
      height: "1234m",
    }
  },
  {
    lngLat: [-4.986615, 56.805237],
    mesh: new Mesh(
      new OctahedronGeometry(5),
      new MeshStandardMaterial({ color: "orange", roughness: 0.5, metalness: 0.5 })
    ),

    name: "Carn Mor Dearg", 
    userData: {
      height: "1220m",
    }
  },
]

const info = document.getElementById("event-info") as HTMLElement;

function setInfo(text: string, visible: boolean) {
  // info.style.cursor = visible ? "none" : "default";
  // info.innerHTML = text;
  // info.style.transform = `scale(${visible ? 1 : 0})`;
  // info.style.opacity = visible ? "1" : "0";
}

function handleMouseMove(e: MouseEvent) {
  // info.style.left = `${e.clientX + 24}px`;
  // info.style.top = `${e.clientY - info.clientHeight / 2}px`;
}

window.addEventListener("mousemove", handleMouseMove);

(async () => {
  await map.onReadyAsync();
  

  const layer3D = new Layer3D("custom-3D-layer");
  map.addLayer(layer3D);

  // Increasing the intensity of the ambient light
  layer3D.setAmbientLight({ intensity: 2 });

  // Adding a point light
  layer3D.addPointLight("point-light", { intensity: 30 });
  munros.forEach(shape => {
   const item = layer3D.addMesh(shape.name, shape.mesh, {
      lngLat: new LngLat(shape.lngLat[0], shape.lngLat[1]),
      heading: 0,
      scale: 40,
      altitude: 200,
      opacity: 0.75,
      wireframe: true,
      states: {
        hover: {
          opacity: 1,
          scale: [1.5, 1.5, 1.5],
          wireframe: false,
        },
        active: {
          opacity: 0.5,
          scale: [2, 2, 2],
        }
      }
    });
    item.on("mouseenter", () => {
      setInfo(`${shape.name} - ${shape.userData.height}`, true);
    });
    item.on("mouseleave", () => {
      setInfo("", false);
    });
  });

  let heading = 0;

  
  function loop() {
    requestAnimationFrame(loop);
    map.setBearing(map.getBearing() + 0.05);
    munros.forEach(munro => {
      const item = layer3D.getItem3D(munro.name);
      item?.modify({
        heading: heading,
      });
    });
    
    heading += 0.5;
  }

  loop();

})();
