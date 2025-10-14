import "@maptiler/sdk/style.css";

import { type LngLatLike, Map, MapStyle, config, math, Marker } from "@maptiler/sdk";

import { AltitudeReference, Item3D, Layer3D } from "@maptiler/3d";
import GUI from "lil-gui";

const container = document.getElementById("map");

const monuments = [
  {
    lngLat: [ -5.495344591964158, 56.12167816352357],
    name: "Netherlargie Standing Stones",
    description: "Of the six prominent standing stones in the fields, five form a large, extended cross shape aligned from northwest to southeast. These five stones are substantial, each standing nearly 3 meters tall. \n\nThe central stone (C) is the most ornate, featuring 40 cupmarks and 3 cup-and-ring markings. All of the other stones in the alignment are also cup-marked, with only one exception. A sixth, smaller stone is located separately, about 100 meters northwest of the main group.",
    attribution: "Model By MegalithArchive <a href=\"https://sketchfab.com/3d-models/nether-largie-db083b35e1a84c20baffb8381e94222c\">on sketchfab</a>",
    modelUrl: "nether_largie/scene.gltf"
  },
  {
    lngLat: [-5.478574822475512, 56.08587848716941],
    name: "Dunadd Fort",
    description: "Rising from the boggy plains of the Mòine Mhór sits the craggy outcrop of Dunadd Fort the ancient capital and royal power centre of the Gaelic kingdom of Dál Riata. Carved into a rock outcrop at the summit of the fort, is a single, bare human footprint. This life-sized impression was a critical part of the inauguration ceremonies for new kings. By placing his foot into the rock, a new monarch would symbolically bond himself to the land and its people, asserting his right to rule over a maritime kingdom that stretched from western Scotland to parts of Ireland. Situated alongside other significant carvings—a Pictish boar, a rock-cut basin, and an ogham inscription—the footprint marks Dunadd not just as a defensible stronghold, but as the primary place of immense political and spiritual power in early Scotland.",
    attribution: "Model By MegalithArchive <a href=\"https://sketchfab.com/3d-models/dunadd-footprint-72403031b2af4cb190c7529d82e2c085\">on sketchfab</a>",
    modelUrl: "dunadd_footprint"
  },
  {
    lngLat: [-5.4856586726397945, 56.111195623675016],
    name: "Ballymeanoch Standing Stones",
    description: "As part of the rich ritual landscape of Kilmartin Glen, the Ballymeanoch complex features an impressive and deliberate arrangement of prehistoric monuments. The site is dominated by a linear avenue of large standing stones, organised into two parallel rows set on a northwest to southeast alignment. One row consists of four massive stones, graded in height up to 4 metres, while its counterpart has two.\n\nTwo of the central stones in the larger row are notable for their extensive and dense patterns of cup-and-ring marks, suggesting a deep ceremonial significance. Nearby, the remains of a kerbed burial cairn and a large, though now faint, henge monument complete this important ceremonial centre. A fallen stone, pierced with a man-made hole and also decorated with cup marks, once stood with the smaller row and is now located near the cairn.",
    attribution: "Model By MegalithArchive <a href=\"https://sketchfab.com/3d-models/ballymeanoch-stones-b5cec262cbb743a482e446a421c5270f\">on sketchfab</a>",
    modelUrl: "ballymeanoch_stones/scene.gltf"
  },
  {
    lngLat: [-5.486208513023925, 56.13281708579783],
    name: "Kilmartin Church and Graveyard",
    description: "While Kilmartin Glen is renowned for its prehistoric monuments, Kilmartin Church and its graveyard serve as a vital link to the area's early Christian and medieval past. Although the current church was built in 1835, this site has been a centre of continuous worship for well over a thousand years. Its true treasures are the collection of sculpted stones, one of the finest in Scotland.\n\nThe graveyard houses a remarkable collection of late medieval grave slabs, many now protected in a lapidarium. Dating from the 13th to the 18th centuries, these slabs are famous for their intricate carvings depicting West Highland warriors in full armour, detailed claymores, ships, animals, and elaborate Celtic patterns. Also of great importance are two free-standing crosses: a simple yet elegant 9th-century cross and a more detailed medieval crucifix, both testaments to the long history of faith and artistry in the glen.",
    attribution: "Model By MegalithArchive <a href=\"https://sketchfab.com/3d-models/kilmartin-churchyard-1-cross-slab-9d887fca70384920bb9f4eedd644fe18\">on sketchfab</a>",
    modelUrl: "kilmartin_churchyard_1_cross_slab/scene.gltf"
  }
]

const map = new Map({
  container,
  style: MapStyle.AQUARELLE.VIVID,
  center: [-5.5044522, 56.086889],
  maxPitch: 85,
  terrainControl: false,
  terrain: false,
  maptilerLogo: true,
  projectionControl: true,
  zoom: 10,
  bearing: 0,
  pitch: 45,
  apiKey: "SqLhbKYFKAzvhtJpAXOG"
  attributionControl: {
    customAttribution:
      "Model by <a href='https://mirada.com/' target='_blank'>Mirada</a> for <a href='https://experiments.withgoogle.com/3-dreams-of-black' target='_blank'>3 Dreams of Black</a>",
  },
});

const 

(async () => {
  await map.onReadyAsync();

  // const layer3D = new Layer3D("custom-3D-layer");
 

})();
