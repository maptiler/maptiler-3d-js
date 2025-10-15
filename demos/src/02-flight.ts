import "@maptiler/sdk/style.css";

import { type LngLatLike, Map, MapStyle, config, math } from "@maptiler/sdk";
import { addPerformanceStats, setupMapTilerApiKey } from "./demo-utils";
import { AltitudeReference, Layer3D } from "../../src";
import GUI from "lil-gui";

// const newYorkCity: [number, number] = [-73.98918779556983, 40.74072950731568];
// const capeTown: [number, number] = [18.428021658130994, -33.913973526198134];
// const melbourne: [number, number] = [144.84097472271193, -37.94589718135184];

setupMapTilerApiKey({ config });
addPerformanceStats();

const paris: [number, number] = [2.3120283730734648, 48.8556923989924];
const ankara: [number, number] = [32.866609260522345, 39.959329480757354];

function calculateHeading(lat1, lon1, lat2, lon2) {
  const φ1 = math.toRadians(lat1);
  const φ2 = math.toRadians(lat2);
  const Δλ = math.toRadians(lon2 - lon1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  let θ = Math.atan2(y, x);
  θ = math.toDegrees(θ);
  return ((θ + 360) % 360) + 90; // Normalize to 0–360 and add 90 degrees
}

const map = new Map({
  container: document.getElementById("map") as HTMLElement,
  style: MapStyle.STREETS.DARK,
  zoom: 9,
  center: paris,
  maxPitch: 85,
  terrainControl: true,
  terrain: false,
  maptilerLogo: true,
  terrainExaggeration: 0.001,
  projectionControl: true,
});

(async () => {
  await map.onReadyAsync();

  map.setSky({
    "sky-color": "#0C2E4B",
    "horizon-color": "#09112F",
    "fog-color": "#09112F",
    "fog-ground-blend": 0.5,
    "horizon-fog-blend": 0.1,
    "sky-horizon-blend": 1.0,
    "atmosphere-blend": 0.5,
  });

  const layer3D = new Layer3D("custom-3D-layer");
  map.addLayer(layer3D);

  // Increasing the intensity of the ambient light
  layer3D.setAmbientLight({ intensity: 2 });

  // Adding a point light
  layer3D.addPointLight("point-light", { intensity: 30 });

  const originalPlaneID = "plane";
  await layer3D.addMeshFromURL(originalPlaneID, "models/plane_a340.glb", {
    lngLat: paris,
    heading: 12,
    scale: 5,
    altitude: 5000,
    altitudeReference: AltitudeReference.MEAN_SEA_LEVEL,
  });

  const guiObj = {
    play: false,
    tackFlight: true,
    speed: 0.0001,
  };

  const gui = new GUI({ width: 500 });

  gui.add(guiObj, "tackFlight");

  gui.add(guiObj, "play").onChange((play) => {
    if (play) {
      playAnimation();
    }
  });

  gui.add(guiObj, "speed", 0, 0.001);

  let progress = 0;

  function playAnimation() {
    progress += guiObj.speed;

    if (progress > 1) {
      progress = 0;
    }

    const nextPosition = math.haversineIntermediateWgs84(paris, ankara, progress - guiObj.speed) as LngLatLike;
    const position = math.haversineIntermediateWgs84(paris, ankara, progress) as LngLatLike;

    const roughHeading = calculateHeading(position[1], position[0], nextPosition[1], nextPosition[0]);

    layer3D.getItem3D(originalPlaneID)?.modify({ lngLat: position, heading: roughHeading });

    if (guiObj.tackFlight) {
      map.setCenter(position);
      // map.setBearing(360 * progress * 2);
    }

    if (guiObj.play) {
      requestAnimationFrame(playAnimation);
    }
  }
})();
