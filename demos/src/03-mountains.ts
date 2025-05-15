import "@maptiler/sdk/style.css";
import GUI from "three/examples/jsm/libs/lil-gui.module.min.js";
import { AltitudeReference, Layer3D } from "../../src/Layer3D";
import { LngLat, Map, MapStyle, config } from "@maptiler/sdk";
import { SourceOrientation } from "../../src/types";
import { addPerformanceStats, setupMapTilerApiKey } from "./demo-utils";

setupMapTilerApiKey({ config });
addPerformanceStats();

const TEMPLATE_OBJECT_ID = "template-object";
let currentObjectID: string | undefined;

// https://www.peakbagger.com/peak.aspx?pid=10640
const mountEverestCoordinates: [number, number] = [86.925145, 27.988257];

const mountEverestElevation = 8849;
const state = {
  scale: 1000,
  heading: 0,
  altitude: mountEverestElevation,
  altitudeReference: AltitudeReference.MEAN_SEA_LEVEL,
  wireframe: true,
  lngLat: { lng: mountEverestCoordinates[0], lat: mountEverestCoordinates[1] },
};

function createUI() {
  const gui = new GUI({ width: 400 });

  const actions = {
    addObject: () => {
      currentObjectID = `object-${Math.random()}`;
      layer3D.cloneMesh(TEMPLATE_OBJECT_ID, currentObjectID, {});
      layer3D.modifyMesh(currentObjectID, { wireframe: false });
    },
  };

  gui
    .add(state, "heading", 0, 360, 0.1)
    .onChange((value) => {
      layer3D.modifyMesh(TEMPLATE_OBJECT_ID, { heading: value });
    })
    .name("Heading");

  gui
    .add(state, "altitudeReference", { GROUND: 1, MEAN_SEA_LEVEL: 2 })
    .onChange((value) => {
      layer3D.modifyMesh(TEMPLATE_OBJECT_ID, { altitudeReference: value });

      if (value === AltitudeReference.GROUND) {
        altitudeController.setValue(0);
        console.log(
          map.queryTerrainElevation(new LngLat(state.lngLat.lng, state.lngLat.lat)),
          "!==",
          mountEverestElevation,
        ); // Why?
      }
    })
    .name("Altitude Reference");

  const altitudeController = gui
    .add(state, "altitude", 0, 10000, 1)
    .onChange((value) => {
      layer3D.modifyMesh(TEMPLATE_OBJECT_ID, { altitude: value });
    })
    .name("Altitude");

  gui
    .add(state, "scale", 0, 10000, 1)
    .onChange((value) => {
      layer3D.modifyMesh(TEMPLATE_OBJECT_ID, { scale: value });
    })
    .name("Scale");

  gui.add(actions, "addObject").name("Add Object");

  return gui;
}

createUI();

const mapElement = document.getElementById("map") as HTMLElement;
const map = new Map({
  container: "map",
  style: MapStyle.OUTDOOR.DEFAULT,
  zoom: 14,
  center: mountEverestCoordinates,
  projection: "globe",
  maxPitch: 89,
  terrain: true,
  terrainExaggeration: 1,
  terrainControl: true,
  maptilerLogo: true,
  projectionControl: true,
});

const layer3D = new Layer3D("custom-3D-layer");

(async () => {
  await map.onReadyAsync();

  map.addLayer(layer3D);

  layer3D.setAmbientLight({ intensity: 2 });
  layer3D.addPointLight("point-light", { intensity: 30 });
  layer3D.modifyPointLight("point-light", { intensity: 100 });

  await layer3D.addMeshFromURL(TEMPLATE_OBJECT_ID, "./models/position-indicator--y-up.glb", {
    ...state,
    sourceOrientation: SourceOrientation.Y_UP,
  });

  map.on("mousemove", (e) => {
    if (currentObjectID === undefined) {
      return;
    }

    layer3D.modifyMesh(currentObjectID, { lngLat: e.lngLat });
  });

  map.on("click", (e) => {
    if (currentObjectID === undefined) {
      return;
    }

    layer3D.modifyMesh(currentObjectID, { lngLat: e.lngLat });
    currentObjectID = undefined;
  });
})();
