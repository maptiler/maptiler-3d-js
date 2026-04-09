import "@maptiler/sdk/style.css";

import { LngLat, Map, MapStyle, MercatorCoordinate, config } from "@maptiler/sdk";
import { addPerformanceStats, setupMapTilerApiKey } from "./demo-utils";
import { AltitudeReference, Item3D, Layer3D } from "../../src";
import { SourceOrientation } from "../../src/types";
import { ConeGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry } from "three";

const center: [number, number] = [2.3501909458823036, 48.85545937027561];

setupMapTilerApiKey({ config });
addPerformanceStats();

function createAxesMeshes() {
  const directions = ["x", "y", "z"];
  const group = new Group();

  for (const direction of directions) {
    const arrow = new Group();
    const color = direction === "x"? 0xff0000 : direction === "y" ? 0x00ff00 : 0x0000ff;
    const stem = new Mesh(new CylinderGeometry(0.1, 0.1, 1), new MeshStandardMaterial({ color: color }));

    stem.position.set(0, 0.5, 0);

    const head = new Mesh(new ConeGeometry(0.2, 1), new MeshStandardMaterial({ color: color }));

    head.position.set(0, 1.5, 0);

    arrow.add(stem);
    arrow.add(head);
    arrow.name = direction;
    arrow.rotation.set(direction === "x" ? Math.PI / 2 : 0, direction === "y" ? Math.PI / 2 : 0, direction === "z" ? Math.PI / 2 : 0);

    group.add(arrow);
  }

  const centralSphere = new Mesh(new SphereGeometry(0.25), new MeshStandardMaterial({ color: 0xffffff }));
  group.add(centralSphere);

  group.scale.set(10, 10, 10);

  return group;
}

const modelAltitude = 200;

async function main() {
  const map = new Map({
    container: document.getElementById("map") as HTMLElement,
    style: MapStyle.SATELLITE.DEFAULT,
    center,
    zoom: 15.5,
    bearing: 6,
    pitch: 46,
    maxPitch: 85,
    projectionControl: true,
    centerClampedToGround: false,
  });

  await map.onReadyAsync();

  const layer3D = new Layer3D("layer3d");
  map.addLayer(layer3D);


  layer3D.setAmbientLight({ intensity: 1 });
  layer3D.addPointLight("point-light", {
    intensity: 30,
    lngLat: center,
    altitude: 1000,
    altitudeReference: AltitudeReference.MEAN_SEA_LEVEL,
  });

  // First Item3D at center (anchor)
  const anchor = layer3D.addMesh("anchor", createAxesMeshes(), {
    lngLat: center,
    altitude: modelAltitude,
    altitudeReference: AltitudeReference.MEAN_SEA_LEVEL,
    scale: 5,
    sourceOrientation: SourceOrientation.Y_UP,
  });

  let mousedown = false;
  let startLngLat = new LngLat(0, 0);

  anchor.on("mousedown", (e) => {
    map.dragPan.disable();
    map.dragRotate.disable();
    mousedown = true;
    startLngLat = e.lngLat;
  });

  // we need to disable the drag pan and rotate when the mouse is up, otherwise the map will continue to pan and rotate when the mouse is released.
  map.on("mouseup", (e) => {
    if (mousedown) {
      mousedown = false;
      map.dragPan.enable();
      map.dragRotate.enable();
    }
  });

  // re-enable the drag pan and rotate when the mouse is up
  anchor.on("mouseup", () => {
    mousedown = false;
    map.dragPan.enable();
    map.dragRotate.enable();
  });

  map.on("mousemove", (e) => {
    if (mousedown) {
      // this is not an exact calculation but will suffice for the purposes of the demo.
      const eventLngLat = e.lngLat;

      const diff = new LngLat(eventLngLat.lng - startLngLat.lng, eventLngLat.lat - startLngLat.lat);
      const newLngLat = new LngLat(anchor.lngLat.lng + diff.lng, anchor.lngLat.lat + diff.lat);

      anchor.setLngLat(newLngLat);
      shadowingAnchor.setPositionRelativeTo(anchor, { x: 100, y: 100, z: 100 }, "meters");

      startLngLat = eventLngLat;
    }
  });

  const shadowingAnchor = anchor.clone();
  shadowingAnchor.setPositionRelativeTo(anchor, { x: 100, y: 100, z: 100 }, "meters");

  addForm({ anchor, shadowingAnchor });
}

main();

function addForm({ anchor, shadowingAnchor }: { anchor: Item3D, shadowingAnchor: Item3D }) {
  const form = document.getElementById("form") as HTMLFormElement;

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    const formData = new FormData(form);
    const x = Number(formData.get("x"));
    const y = Number(formData.get("y"));
    const z = Number(formData.get("z"));
    const units = formData.get("units") as "meters" | "feet" | "km" | "miles" ?? "meters";
    anchor.moveBy({ x, y, z }, units);
    shadowingAnchor.setPositionRelativeTo(anchor, { x: 100, y: 100, z: 100 }, units);
  });
}