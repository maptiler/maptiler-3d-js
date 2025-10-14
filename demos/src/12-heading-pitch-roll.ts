import "@maptiler/sdk/style.css";

import { LngLat, Map, MapStyle, config, math } from "@maptiler/sdk";
import { addPerformanceStats, setupMapTilerApiKey } from "./demo-utils";
import { AltitudeReference, Layer3D } from "../../src";
import { Mesh, MeshStandardMaterial, OctahedronGeometry, Vector3 } from "three";

const center: [number, number] = [2.3492790851936776, 48.85417501375531];

setupMapTilerApiKey({ config });
addPerformanceStats();

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
    zoom: 12.5,
    bearing: 0,
    pitch: 65,
  });

  await map.onReadyAsync();

  const layer3D = new Layer3D("layer3d");
  map.addLayer(layer3D);

  const LNGLAT_OFFSET = 0.15;
  const PLANE_BASE_ALT = 2200;

  layer3D.addPointLight("point-light", {
    intensity: 20,
    color: "#ffffff",
    lngLat: center.map(num => num + 0.0001) as [number, number],
    altitude: 2000,
    altitudeReference: AltitudeReference.GROUND,
  });

  const biplaneOne = await layer3D.addMeshFromURL("biplaneOne", "models/biplane/scene.gltf", {
    lngLat: center,
    heading: 0,
    scale: 100,
    altitude: PLANE_BASE_ALT,
    altitudeReference: AltitudeReference.GROUND,
    transform: {
      rotation: {
        y: Math.PI / 2,
      },
    }
  });

  layer3D.cloneMesh("biplaneOne", "biplaneTwo");
  const biplaneTwo = layer3D.getItem3D("biplaneTwo")!;

  let progress = 0;
  let speed = 0.001;

  const startLngLat = LngLat.convert(center.map(num => num - LNGLAT_OFFSET) as [number, number]);
  const endLngLat = LngLat.convert(center.map(num => num + LNGLAT_OFFSET) as [number, number]);

  function updateBiPlaneOne() {
    const position = lerpLngLat(startLngLat, endLngLat, progress);
    const nextPosition = lerpLngLat(startLngLat, endLngLat, progress + 0.01);

    const currentAltitude = 2000 * Math.sin(progress * 8) + PLANE_BASE_ALT;
    const nextAltitude = 2000 * Math.sin(progress * 8 + 0.1) + PLANE_BASE_ALT;

    const pitchInRadians = getPitch(currentAltitude, nextAltitude, position.distanceTo(nextPosition));
    const pitch = pitchInRadians * 180 / Math.PI;
    biplaneOne.setPitch(pitch);
    biplaneOne.setAltitude(currentAltitude);

    biplaneOne.setLngLat(position);

    biplaneOne.setHeading(getHeading(startLngLat, endLngLat) * 180 / Math.PI);
    biplaneOne.setRoll(50 * progress * 180 / Math.PI);
  }

  function updateBiPlaneTwo() {
    const position = orbitCenter(center, progress, 0.05);
    const nextPosition = orbitCenter(center, progress + 0.01, 0.05);

    biplaneTwo.setLngLat(position);
    biplaneTwo.setHeading(getHeading(position, nextPosition) * 180 / Math.PI);
    biplaneTwo.setRoll(45);

    const currentAltitude = 2000 * Math.sin(progress * Math.PI * 2) + PLANE_BASE_ALT;
    const nextAltitude = 2000 * Math.sin(progress * Math.PI * 2 + 0.1) + PLANE_BASE_ALT;
    const pitchInRadians = getPitch(currentAltitude, nextAltitude, position.distanceTo(nextPosition));
    const pitch = pitchInRadians * 180 / Math.PI;
    biplaneTwo.setPitch(pitch);
    biplaneTwo.setAltitude(currentAltitude);
  }

  function loop() {
    requestAnimationFrame(loop);

    updateBiPlaneOne();
    updateBiPlaneTwo();

    progress += 0.001;
    if (progress > 1) {
      progress = 0;
    }
  }

  loop();
}

function orbitCenter(center: [number, number], progress: number, radius: number): LngLat {
  return new LngLat(
    center[0] + radius * Math.cos(progress * 2 * Math.PI),
    center[1] + radius * Math.sin(progress * 2 * Math.PI),
  );
}

function lerpLngLat(startLngLat: LngLat, endLngLat: LngLat, progress: number): LngLat {
  return new LngLat(
    startLngLat.lng + (endLngLat.lng - startLngLat.lng) * progress,
    startLngLat.lat + (endLngLat.lat - startLngLat.lat) * progress,
  );
}

function getPitch(startAltitude: number, endAltitude: number, distance: number): number {
  return Math.asin((endAltitude - startAltitude) / distance);
}

function getHeading(startLngLat: LngLat, endLngLat: LngLat): number {
  return Math.atan2(endLngLat.lng - startLngLat.lng, endLngLat.lat - startLngLat.lat);
}


main();
