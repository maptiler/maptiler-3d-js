/**
 * This will be transformed into a script in `mountains.html` file when sdk v3 will be on CDN.
 */

import * as maptilersdk from "@maptiler/sdk";
import * as maptiler3d from "../maptiler-3d";

import "@maptiler/sdk/dist/maptiler-sdk.css";

const apiKey = new URLSearchParams(location.search).get("key") ?? import.meta.env.VITE_MAPTILER_API_KEY;

if (apiKey === null || apiKey === undefined || apiKey === "") {
  alert("Missing URL param with MapTiler API key ?key=XXXXX");
}

maptilersdk.config.apiKey = apiKey;

const mapElement = document.getElementById("map");

if (mapElement === null) {
  throw new Error("Map element not found");
}

const map = new maptilersdk.Map({
  container: mapElement,
  style: maptilersdk.MapStyle.OUTDOOR.DEFAULT,
  zoom: 14,
  center: [86.922623, 27.986065],
  antialias: false,
  projection: "globe",
  maxPitch: 89,
  terrain: true,
  terrainExaggeration: 1.0223,
  terrainControl: true,
  maptilerLogo: true,
});

const layer3D = new maptiler3d.Layer3D("custom-3D-layer");

const TEMPLATE_OBJECT_ID = "template-object";
let currentObjectID: string | undefined = undefined;

const state: maptiler3d.MeshOptions = {
  scale: 1000,
  altitude: 8749,
  heading: 0,
  altitudeReference: maptiler3d.AltitudeReference.MEAN_SEA_LEVEL,
  wireframe: true,
  // https://www.peakbagger.com/peak.aspx?pid=18716
  lngLat: { lng: 86.925812, lat: 27.985087 },
};

const createUI = () => {
  // @ts-expect-error - lil added as script in .html file
  const gui = new lil.GUI({ width: 400 });

  const actions = {
    addObject: () => {
      currentObjectID = `object-${Math.random()}`;
      layer3D.cloneMesh(TEMPLATE_OBJECT_ID, currentObjectID, {});
      layer3D.modifyMesh(currentObjectID, { wireframe: false });
    },
  };

  gui
    .add(state, "heading", 0, 360, 0.1)
    .onChange((heading: number) => {
      layer3D.modifyMesh(TEMPLATE_OBJECT_ID, { heading });
    })
    .name("Heading");
  gui
    .add(state, "altitudeReference", { GROUND: 1, MEAN_SEA_LEVEL: 2 })
    .onChange((value: string) => {
      const altitudeReference =
        value === "MEAN_SEA_LEVEL" ? maptiler3d.AltitudeReference.MEAN_SEA_LEVEL : maptiler3d.AltitudeReference.GROUND;

      layer3D.modifyMesh(TEMPLATE_OBJECT_ID, { altitudeReference });
    })
    .name("Altitude Reference");
  gui
    .add(state, "altitude", 0, 10000, 1)
    .onChange((altitude: number) => {
      layer3D.modifyMesh(TEMPLATE_OBJECT_ID, { altitude });
    })
    .name("Altitude");
  gui
    .add(state, "scale", 0, 10000, 1)
    .onChange((scale: number) => {
      layer3D.modifyMesh(TEMPLATE_OBJECT_ID, { scale });
    })
    .name("Scale");
  gui.add(actions, "addObject").name("Add Object");

  const toggleProjectionButton = gui
    .add(
      {
        changeProjection: () => {
          const currentProjection = map.getProjection().type;

          if (currentProjection === "globe") {
            map.setProjection({ type: "mercator" });
          } else if (currentProjection === "mercator") {
            toggleProjectionButton.name("Activate Globe");
            map.setProjection({ type: "globe" });
            toggleProjectionButton.name("Activate Mercator");
          } else {
            throw new Error(`Unsupported projection: ${currentProjection}`);
          }
        },
      },
      "changeProjection",
    )
    .name("Activate Mercator");

  return gui;
};

createUI();

(async () => {
  await map.onReadyAsync();

  map.addLayer(layer3D);

  layer3D.setAmbientLight({ intensity: 2 });
  layer3D.addPointLight("point-light", { intensity: 30 });
  layer3D.modifyPointLight("point-light", { intensity: 100 });

  await layer3D.addMeshFromURL(TEMPLATE_OBJECT_ID, "models/position-indicator--y-up.glb", {
    ...state,
    sourceOrientation: maptiler3d.SourceOrientation.Y_UP,
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
