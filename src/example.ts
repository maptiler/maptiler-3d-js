import * as maptilersdk from "@maptiler/sdk";
import * as maptiler3d from "./maptiler-3d";

import "@maptiler/sdk/dist/maptiler-sdk.css";

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

maptilersdk.config.apiKey = "b1EV02DxYaWxO1buC5fR";

const mapElement = document.getElementById("map");

if (mapElement === null) {
  throw new Error("Map element not found");
}

// declare global {
// //   const maptilersdk: any;
//   const lil: any;
// }

const map = new maptilersdk.Map({
  container: mapElement,
  style: maptilersdk.MapStyle.OUTDOOR.DARK,
  zoom: 5.5,
  center: [150.16546137527212, -35.017179237129994],

  antialias: true,
  projection: "globe",

  // zoom: 12,
  //   center: [148.9819, -35.3981],
  pitch: 60,
  maxPitch: 85,
  terrainControl: true,
  terrain: true,
  maptilerLogo: true,
});


// map.on("", () => {
// });
map.on("terrainAnimationStart", (event) => {
  console.log("Terrain animation is starting...");
});

map.on("terrainAnimationStop", async (event) => {
    console.log("Terrain animation is stopping...");
//   map.addLayer(customLayer);

  const layer3D = new maptiler3d.Layer3D("custom-3D-layer");
  map.addLayer(layer3D);

  layer3D.setAmbientLight({ intensity: 2 });
  layer3D.addPointLight("point-light", { intensity: 30 });
  const originalPlaneID = "plane";
  await layer3D.addMeshFromURL(originalPlaneID, "demos/models/plane_a340.glb", {
    scale: 1,
    altitude: 1000,
    altitudeReference: maptiler3d.AltitudeReference.MEAN_SEA_LEVEL,
    wireframe: false,
    lngLat: { lng: 148.9819, lat: -35.3981 },
    // lngLat: { lng: 144.9154719027793, lat: -37.86567059795172 },
    // lngLat: {
    //     lng: 54.41641197170392,
    //     lat: 18.658874965114144,
    // }
  });

});

// (async () => {
//   await map.onReadyAsync();

//   map.setSky({
//     "sky-color": "#0C2E4B",
//     "horizon-color": "#09112F",
//     "fog-color": "#09112F",
//     "fog-ground-blend": 0.5,
//     "horizon-fog-blend": 0.1,
//     "sky-horizon-blend": 1.0,
//     "atmosphere-blend": 0.5,
//   });

//   const gui = new lil.GUI({ width: 400 });

//   const guiObj = {
//     heading: 0,
//     scale: 1,
//     altitude: 1000,
//     opacity: 1,
//     wireframe: false,
//     altitudeReference: maptiler3d.AltitudeReference.MEAN_SEA_LEVEL,
//     removePlane: () => {
//       layer3D.removeMesh(originalPlaneID);
//     },
//   };


//   let planeCanMove = false;

//   // Clones of this lantern will be added as we click on the map.
//   // The lantern model that is used for the clone is the latest lantern added,
//   // so that we can benefit from the latest heading we defined
//   map.on("mousemove", (e) => {
//     if (!planeCanMove) return;

//     layer3D.modifyMesh(originalPlaneID, { lngLat: e.lngLat });
//   });

//   map.on("click", (e) => {
//     planeCanMove = !planeCanMove;
//   });

//   // // We can change the heading of the latest lantern added
//   gui.add(guiObj, "heading", 0, 360, 0.1).onChange((heading) => {
//     layer3D.modifyMesh(originalPlaneID, { heading });
//   });

//   gui.add(guiObj, "scale", 0.01, 5, 0.01).onChange((scale) => {
//     layer3D.modifyMesh(originalPlaneID, { scale });
//   });

//   gui.add(guiObj, "altitude", 0, 10000, 1).onChange((altitude) => {
//     layer3D.modifyMesh(originalPlaneID, { altitude });
//   });

//   gui.add(guiObj, "opacity", 0, 1).onChange((opacity) => {
//     layer3D.modifyMesh(originalPlaneID, { opacity });
//   });

//   gui.add(guiObj, "altitudeReference", ["MEAN_SEA_LEVEL", "GROUND"]).onChange((altRef) => {
//     layer3D.modifyMesh(originalPlaneID, { altitudeReference: maptiler3d.AltitudeReference[altRef] });
//   });

//   gui.add(guiObj, "wireframe").onChange((wireframe) => {
//     layer3D.modifyMesh(originalPlaneID, { wireframe });
//   });

//   gui.add(guiObj, "removePlane");
// })();
