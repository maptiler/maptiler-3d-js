import "@maptiler/sdk/style.css";

import { type LngLatLike, Map, MapStyle, config, math } from "@maptiler/sdk";
import { addPerformanceStats, setupMapTilerApiKey } from "./demo-utils";
import { AltitudeReference, Item3D, Layer3D } from "../../src";
import GUI from "lil-gui";

setupMapTilerApiKey({ config });
addPerformanceStats();

const lakeNatron: [number, number] = [36.01695746068115, -2.3536069164210653];
const makadikadi: [number, number] = [25.5527055978211, -20.78468929963636];

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
  style: MapStyle.AQUARELLE.VIVID,
  center: lakeNatron,
  maxPitch: 85,
  terrainControl: false,
  terrain: false,
  maptilerLogo: true,
  projectionControl: true,
  zoom: 10,
  bearing: 0,
  pitch: 45,
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

  const flamingoIDOne = "flamingo";
  const flamingoIDTwo = "flamingo-clone";

  await layer3D.addMeshFromURL(flamingoIDOne,
    // Model by https://mirada.com/ for https://experiments.withgoogle.com/3-dreams-of-black
    "models/Flamingo.glb",
    {
    lngLat: lakeNatron,
    heading: 12,
    scale: 100,
    altitude: 5500,
    animationMode: "continuous",
    altitudeReference: AltitudeReference.MEAN_SEA_LEVEL,
    transform: {
      rotation: {
        x: 0,
        y: Math.PI / 2,
        z: 0,
      },
      offset: {
        x: 0,
        y: 0,
        z: -150,
      },
    },
  });


  const fly = "fly!";
  const migrate = "migrate with the flamingo";
  const speed = "migration speed";

  const guiObj = {
    [fly]: false,
    [migrate]: true,
    [speed]: 0.0005,
  };

  const gui = new GUI({ width: 500 });

  gui.add(guiObj, migrate);

  gui.add(guiObj, fly).onChange((play) => {
    if (play) {
      playAnimation();
    }
  });

  gui.add(guiObj, speed, 0, 0.001);

  let progress = 0;

  const animationNames = layer3D.getItem3D(flamingoIDOne)?.getAnimationNames();

  const animationName = animationNames?.[0];

  if (!animationName) {
    throw new Error(`No animation found with name '${animationName}'`);
  }

  layer3D.cloneMesh(flamingoIDOne, flamingoIDTwo, {
    animationMode: "manual",
    transform: {
      offset: {
        x: 0,
        y: 0,
        z: 300,
      },
    },
  })

  layer3D.getItem3D(flamingoIDOne)?.playAnimation(
    animationName,
    "loop",
  );

  layer3D.getItem3D(flamingoIDTwo)?.playAnimation(
    animationName,
    "loop",
  );

  const distance = math.haversineDistanceWgs84(lakeNatron, makadikadi);

  const initialHeading = calculateHeading(makadikadi[1], makadikadi[0], lakeNatron[1], lakeNatron[0]);

  const flamingoOneMesh = layer3D.getItem3D(flamingoIDOne) as Item3D;
  const flamingoTwoMesh = layer3D.getItem3D(flamingoIDTwo) as Item3D;

  flamingoOneMesh.modify({ heading: initialHeading });
  flamingoTwoMesh.modify({ heading: initialHeading });

  function playAnimation() {
    progress += guiObj[speed];

    if (progress > 1) {
      progress = 0;
    }

    const nextPosition = math.haversineIntermediateWgs84(lakeNatron, makadikadi, progress - (guiObj[speed] === 0 ? 0.001 : guiObj[speed])) as LngLatLike;
    const position = math.haversineIntermediateWgs84(lakeNatron, makadikadi, progress) as LngLatLike;

    const roughHeading = calculateHeading(position[1], position[0], nextPosition[1], nextPosition[0]);

    // `updateAnimation` is only needed if you want to control the animation manually
    // to automatically play the animation independently of map updates, set the item
    // animationMode: "continuous"

    flamingoTwoMesh.updateAnimation(guiObj[speed] * 50);

    const distanceFromStart = math.haversineDistanceWgs84(lakeNatron, [position[0], position[1]]);
    const progressPercentage = distanceFromStart / distance;

    flamingoOneMesh.modify({ lngLat: position, heading: roughHeading });
    flamingoTwoMesh.modify({ lngLat: position, heading: roughHeading });

    if (guiObj[migrate]) {
      map.setCenter(position);
      map.setZoom(10 - Math.sin(progressPercentage * Math.PI) * 2);
      map.setBearing(progressPercentage * -45);
    }

    if (guiObj[fly]) {
      requestAnimationFrame(playAnimation);
    }
  }
})();
