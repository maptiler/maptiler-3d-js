import { type CustomLayerInterface, type Map as MapSDK, MercatorCoordinate, type LngLatLike, type CustomRenderMethodInput, LngLat, CustomRenderMethod } from "@maptiler/sdk";
import {
  Camera,
  Matrix4,
  Scene,
  WebGLRenderer, type AxesHelper,
  Vector3,
  Mesh,
  type Group,
  type Object3D,
  // AmbientLight,
  Quaternion,
  // PointLight,
  // DoubleSide,
  // PlaneGeometry,
  // MeshBasicMaterial,
  // MeshPhongMaterial,
  // SphereGeometry,
  PointLight,
  // MeshPhongMaterial,
  MeshLambertMaterial,
  type ColorRepresentation,
  AmbientLight,
  Color,
  TorusKnotGeometry,
  // DirectionalLight,
} from "three";

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
// import { USDZLoader } from "three/examples/jsm/loaders/USDZLoader";

// export const altitudeReference = {
//   GROUND: 1,
//   MEAN_SEA_LEVEL: 2
// } as const;

export enum AltitudeReference {
  GROUND = 1,
  MEAN_SEA_LEVEL = 2
};


/**
 * Generic options that apply to both point lights and meshes
 */
export type GenericObject3DOptions = {
  /**
   * Position.
   * Default: `[0, 0]` (Null Island)
   */
  lngLat?: LngLatLike,

  /**
   * Altitude above the reference (in meters).
   * Default: `0` for meshes, or `2000000` for point lights.
   */
  altitude?: number,

  /**
   * Reference to compute and adjust the altitude.
   * Default: `altitudeReference.GROUND` for meshes and ``altitudeReference.MEAN_SEA_LEVEL` for point lights.
   */
  altitudeReference?: AltitudeReference,
};


/**
 * Options to add or modify a mesh
 */
export type MeshOptions = GenericObject3DOptions & {
  /**
   * Rotation to apply to the model to add, as a Quaternion.
   * Default: a rotation of PI/2 around the x axis, to adjust from the default ThreeJS space (right-hand, Y up) to the Maplibre space (right-hand, Z up)
   */
  rotation?: Quaternion,

  /**
   * Scale the mesh by a factor.
   * Default: no scaling added
   */
  scale?: number,
};


/**
 * Options for adding a point light
 */
export type PointLightOptions = GenericObject3DOptions & {
  /**
   * Light color.
   * Default: `0xffffff` (white)
   */
  color?: ColorRepresentation,

  /**
   * Intensity of the light.
   * Default: `75`
   */
  intensity?: number,

  /**
   * Decay of the light relative to the distance to the subject.
   * Default: `0.5`
   */
  decay?: number,
};

type Mat4 =
  | [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ]
  | Float32Array;

export type SceneLayerOptions = {
  /**
   * Default: 0
   */
  minZoom?: number;

  /**
   * Default: 22
   */
  maxZoom?: number;

  /**
   * Default: true
   */
  antiaslias?: boolean;

  /**
   * Ambient light color.
   * Default: `0xffffff` (white)
   */
  ambientLightColor?: ColorRepresentation,

  /**
   * Ambient light intensity.
   * Default: `1`
   */
  ambientLightIntensity?: number,
};

export type Item3D = {
  id: string;
  mercatorCoord: MercatorCoordinate;
  lngLat: LngLat;
  altitude: number;
  rotation: Quaternion;
  mesh: Mesh | AxesHelper | Group | Object3D | null;
  altitudeReference: AltitudeReference,
};

export class SceneLayer implements CustomLayerInterface {
  public id: string;
  public readonly type = "custom";
  public renderingMode: "2d" | "3d" = "3d";
  public minZoom: number;
  public maxZoom: number;
  private scene!: Scene;
  private renderer!: WebGLRenderer;
  private map!: MapSDK;
  private camera!: Camera;
  private antialias: boolean;
  private items3D = new Map<string, Item3D>();
  private sceneOrigin: LngLat | null = null;
  private sceneOriginMercator: MercatorCoordinate | null = null;
  private ambientLight!: AmbientLight;


  constructor(id: string, options: SceneLayerOptions = {}) {
    this.type = "custom";
    this.id = id;
    this.minZoom = options.minZoom ?? 0;
    this.maxZoom = options.maxZoom ?? 22;
    this.antialias = options.antiaslias ?? true;

    this.camera = new Camera();
    this.camera.matrixWorldAutoUpdate = false;
    this.scene = new Scene();

    this.ambientLight = new AmbientLight(
      options.ambientLightColor ?? 0xffffff,
      options.ambientLightIntensity ?? 0.5
    );

    this.scene.add(this.ambientLight);
  }


  private isInZoomRange(): boolean {
    const z = this.map.getZoom();
    return z >= this.minZoom && z <= this.maxZoom;
  }


  onAdd?(map: MapSDK, gl: WebGL2RenderingContext): void {
    this.map = map;
    this.renderer = new WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl,
      antialias: this.antialias,
    });

    this.renderer.autoClear = false;

    // this.map.on("move", () => {
    //   console.log("---- MOVE");
      
    // })

    // TESTING
    this.testAddingMeshes();
  }

  
  onRemove?(_map: MapSDK, _gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    this.scene.clear();
  }


  render(_gl: WebGLRenderingContext | WebGL2RenderingContext, matrix: Mat4, _options: CustomRenderMethodInput) {
    // console.log("RENDER");
    if (!this.isInZoomRange()) return;
    if (this.items3D.size === 0) return;

    const mapCenter = this.map.getCenter();
    this.sceneOrigin = new LngLat(mapCenter.lng + 0.01, mapCenter.lat + 0.01)
    // this.sceneOrigin = new LngLat(mapCenter.lng, mapCenter.lat)
    const offsetFromCenterElevation = this.map.queryTerrainElevation(this.sceneOrigin) || 0;
    this.sceneOriginMercator = MercatorCoordinate.fromLngLat(this.sceneOrigin, offsetFromCenterElevation);

    // Adjust all the meshes and light according to the relative center of the scene
    this.reposition();

    const sceneScale = this.sceneOriginMercator.meterInMercatorCoordinateUnits();

    const m = new Matrix4().fromArray(matrix);
    const l = new Matrix4()
      .makeTranslation(this.sceneOriginMercator.x, this.sceneOriginMercator.y, this.sceneOriginMercator.z)
      .scale(new Vector3(sceneScale, -sceneScale, sceneScale));

    this.camera.projectionMatrix = m.multiply(l);
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    
    // repainting all the time makes the idle event to never happen
    // this.map.triggerRepaint();
  }


  /**
   * Adjust the settings of the ambient light
   */
  setAmbientLight(options: {color?: ColorRepresentation, intensity?: number} = {}) {
    if (typeof options.intensity === "number") {
      this.ambientLight.intensity = options.intensity;
    }

    if ("color" in options) {
      this.ambientLight.color = new Color(options.color as ColorRepresentation);
    }
  }

 
  /**
   * Adjust the position of all meshes and light relatively to the center of the scene
   */
  private reposition() {
    if (!this.sceneOrigin || !this.sceneOriginMercator) return;
    const terrainExag = this.map.getTerrainExaggeration();    
    const sceneElevation = (this.map.queryTerrainElevation(this.sceneOrigin) || 0);
    const targetElevation = this.map.getCameraTargetElevation();

    for (const [_itemId, item] of this.items3D) {
      // Get the elevation of the terrain at the location of the item
      const itemElevationAtPosition = (this.map.queryTerrainElevation(item.lngLat) || 0);

      let itemUpShift = itemElevationAtPosition - sceneElevation + item.altitude;

      if (item.altitudeReference === AltitudeReference.MEAN_SEA_LEVEL) {
        const actualItemAltitude = targetElevation + itemElevationAtPosition;
        itemUpShift -= actualItemAltitude / terrainExag;
      }

      const {dEastMeter: itemEast, dNorthMeter: itemNorth} = calculateDistanceMercatorToMeters(this.sceneOriginMercator, item.mercatorCoord);
      item.mesh?.position.set(itemEast, itemNorth, itemUpShift);
    }
  }


  /**
   * Add an existing mesh to the map
   */
  addMesh(
    id: string,
    mesh: Mesh | Group | Object3D,
    options: MeshOptions = {},
  ) {
    this.throwUniqueID(id);

    const rotation = options.rotation ?? new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2);
    const altitude = options.altitude ?? 0;
    const lngLat = options.lngLat ?? [0, 0];
    const mercatorCoord = MercatorCoordinate.fromLngLat(lngLat, altitude);

    if (options.scale) {
      mesh.scale.set(options.scale, options.scale, options.scale);
    }

    // mesh.rotation.set(rotation.x, rotation.y, rotation.z);
    mesh.setRotationFromQuaternion(rotation);

    this.scene.add(mesh);

    const item: Item3D = {
      id,
      mercatorCoord,
      lngLat: lngLatLikeToLngLat(lngLat),
      altitude,
      rotation,
      mesh,
      altitudeReference: options.altitudeReference ?? AltitudeReference.GROUND,
    };
    
    this.items3D.set(id, item);
    this.map.triggerRepaint();
  }


  modifyMesh(id: string, options: MeshOptions) {
    const item = this.items3D.get(id);
    if (!item) return;
    if (!item.mesh) return;

    if ("scale" in options && typeof options.scale === "number") {
      item?.mesh?.scale.set(options.scale, options.scale, options.scale);
    }

    let adjustMercator = false;
    if ("altitude" in options && typeof options.altitude === "number") {
      item.altitude = options.altitude;
      adjustMercator = true;
    }

    if ("lngLat" in options) {
      item.lngLat = lngLatLikeToLngLat(options.lngLat as LngLatLike);
      adjustMercator = true;
    }

    if ("rotation" in options) {
      const rotation = options.rotation as Quaternion;
      item.rotation = rotation;
      item.mesh.setRotationFromQuaternion(rotation);
    }

    if ("altitudeReference" in options && typeof options.altitudeReference === "number") {
      item.altitudeReference = options.altitudeReference;
    }

    if (adjustMercator) {
      item.mercatorCoord = MercatorCoordinate.fromLngLat(item.lngLat, item.altitude);
    }

    this.map.triggerRepaint();
  }


  modifyPointLight(id: string, options: PointLightOptions) {
    const item = this.items3D.get(id);
    if (!item) return;
    if (!item.mesh) return;

    // Not a light?
    if (!("isLight" in item.mesh && item.mesh.isLight === true)) return;

    const mesh = item.mesh as PointLight;

    if ("decay" in options && typeof options.decay === "number") {
      mesh.decay = options.decay;
    }

    if ("intensity" in options && typeof options.intensity === "number") {
      mesh.intensity = options.intensity;
    }

    if ("color" in options) {
      mesh.color.set(new Color(options.color)); // TODO: not optimal to call a constructor every time
    }

    let adjustMercator = false;
    if ("altitude" in options && typeof options.altitude === "number") {
      item.altitude = options.altitude;
      adjustMercator = true;
    }

    if ("lngLat" in options) {
      item.lngLat = lngLatLikeToLngLat(options.lngLat as LngLatLike);
      adjustMercator = true;
    }

    if ("rotation" in options) {
      const rotation = options.rotation as Quaternion;
      item.rotation = rotation;
      item.mesh.setRotationFromQuaternion(rotation);
    }

    if ("altitudeReference" in options && typeof options.altitudeReference === "number") {
      item.altitudeReference = options.altitudeReference;
    }

    if (adjustMercator) {
      item.mercatorCoord = MercatorCoordinate.fromLngLat(item.lngLat, item.altitude);
    }

    this.map.triggerRepaint();
  }


  /**
   * Load a GLTF file from its URL and add it to the map
   */
  async addMeshFromURL(
    id: string,
    meshURL: string,
    options: MeshOptions = {},
  ) {
    this.throwUniqueID(id);

    const fileExt = meshURL.trim().toLowerCase().split(".").pop();

    if (!(fileExt === "glb" || fileExt === "gltf")) {
      throw new Error("Mesh files must be glTF/glb.");
    }

    const loader = new GLTFLoader();
    const gltfContent = await loader.loadAsync(meshURL);
    this.addMesh(id, gltfContent.scene, options);
  }


  /**
   * Adding a point light. The default options are mimicking the sun:
   * lngLat: `[0, 0]` (null island)
   * altitude: `2_000_000` meters
   * altitudeReference: `altitudeReference.MEAN_SEA_LEVEL`
   * color: `0xffffff` (white)
   * intensity: `75`
   * decay: `0.2`
   */
  addPointLight(
    id: string,
    options: PointLightOptions = {}
  ) {
    this.throwUniqueID(id);

    const pointLight = new PointLight(
      options.color ?? 0xffffff, // color
      options.intensity ?? 75, // intensity
      0, // distance (0 = no limit)
      options.decay ?? 0.2, // decay
    );

    this.addMesh(id, pointLight, {
      lngLat: options.lngLat ?? [0, 0],
      altitude: options.altitude ?? 2000000,
      altitudeReference: options.altitudeReference ?? AltitudeReference.MEAN_SEA_LEVEL,
    });
  }


  /**
   * Throw an error if a mesh with such ID already exists
   */
  private throwUniqueID(id: string) {
    if (this.items3D.has(id)) {
      throw new Error(`Mesh IDs are unique. A mesh or light with the id "${id}" already exist.`)
    }
  }




  async testAddingMeshes() {
    this.setAmbientLight({intensity: 100})

    const torusGeometry = new TorusKnotGeometry( 10, 3, 100, 16 ); 
    const torusMaterial = new MeshLambertMaterial( { color: 0xff0000 } ); 
    const torusKnot = new Mesh( torusGeometry, torusMaterial );

    this.addMesh("torus", torusKnot,
    {
      lngLat: [2.294530547874315 + 0.1, 48.85826142288141], // Paris
      scale: 5, // necessary because the sofa is too small (possibly metric system)
      // rotation: quaternion,
      altitudeReference: AltitudeReference.GROUND,
    })


    // this.addMesh("torus2", torusKnot.clone(),
    // {
    //   lngLat: [2.294530547874315, 48.85826142288141 + 0.1], // Paris
    //   scale: 10, // necessary because the sofa is too small (possibly metric system)
    //   // rotation: quaternion,
    // })


    // this.addMesh("axes", new AxesHelper(100),
    // {
    //   lngLat: [2.294530547874315, 48.85826142288141], // Paris
    //   // scale: 10, // necessary because the sofa is too small (possibly metric system)
    //   rotation: new Quaternion(),
    // })




    // const quaternion = new Quaternion();
    // const rotationA = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2);
    // const rotationB = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 4);

    // Chain the rotations
    // quaternion.multiplyQuaternions(rotationA, rotationB);

    // await this.addMeshFromURL(
    //   "eiffel",
    //   // "private_models/free__la_tour_eiffel.glb",
    //   "private_models/SheenChair.glb",
    //   // "https://maplibre.org/maplibre-gl-js/docs/assets/34M_17/34M_17.gltf",
    //   {
    //     lngLat: [2.294530547874315, 48.85826142288141], // Paris
    //     scale: 2.2, // necessary because the sofa is too small (possibly metric system)
    //     rotation: quaternion,
    //   }
    // );

    // await this.addMeshFromURL(
    //   "chair",
    //   // "private_models/free__la_tour_eiffel.glb",
    //   "private_models/SheenChair.glb",
    //   // "https://maplibre.org/maplibre-gl-js/docs/assets/34M_17/34M_17.gltf",
    //   {
    //     lngLat: [2.294530547874315, 48.85826142288141], // Paris
    //     scale: 10, // necessary because the sofa is too small (possibly metric system)
    //     // rotation: quaternion,
    //   }
    // );

    // console.log("DEBUG03");
    


    // await this.addMeshFromURL(
    //   "eiffel2",
    //   // "private_models/free__la_tour_eiffel.glb",
    //   "https://maplibre.org/maplibre-gl-js/docs/assets/34M_17/34M_17.gltf",
    //   {
    //     lngLat: [2.294530547874315, 48.85826142288141 - 0.01], // Paris
    //     scale: 10, // necessary because the sofa is too small (possibly metric system)
    //     // rotation: quaternion,
    //   }
    // );


    // await this.addMeshFromURL(
    //   "car",
    //   // "private_models/free__la_tour_eiffel.glb",
    //   "private_models/SheenChair.glb",
    //   {
    //     lngLat: [2.294530547874315, 48.85826142288141 - 0.01], // Paris
    //     scale: 10, // necessary because the sofa is too small (possibly metric system)
    //     // rotation: new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI),
    //   }
    // );

   

    // this.addPointLight("light1", {
    //   lngLat: [-130, 40],
    //   altitude: 2000000,
    //   // rotation: new Quaternion(),
    //   intensity: 50
    // });

    // this.addPointLight("light2", {
    //   lngLat: [130, 40],
    //   altitude: 2000000,
    //   // rotation: new Quaternion(),
    //   intensity: 50
    // });

    this.map.on("click", (e) => {
      console.log("click", e);
      this.modifyMesh("torus", {lngLat: e.lngLat, altitude: 2000})
    })


  }
}


export function lngLatLikeToLngLat(lngLatLike: LngLatLike): LngLat {
  if (!lngLatLike) {
    throw new Error("Invalid LngLatLike object.")
  }

  if (lngLatLike instanceof LngLat) {
    return lngLatLike
  }

  if (Array.isArray(lngLatLike) && lngLatLike.length >= 2) {
    return new LngLat(lngLatLike[0], lngLatLike[1]);
  }

  if (typeof lngLatLike === "object" && "lng" in lngLatLike && "lat" in lngLatLike) {
    return new LngLat(lngLatLike.lng, lngLatLike.lat);
  }

  if (typeof lngLatLike === "object" && "lon" in lngLatLike && "lat" in lngLatLike) {
    return new LngLat(lngLatLike.lon, lngLatLike.lat);
  }

  throw new Error("Invalid LngLatLike object.");
}


function calculateDistanceMercatorToMeters(from: MercatorCoordinate, to: MercatorCoordinate): {dEastMeter: number, dNorthMeter: number} {
  const mercatorPerMeter = from.meterInMercatorCoordinateUnits();
  // mercator x: 0=west, 1=east
  const dEast = to.x - from.x;
  const dEastMeter = dEast / mercatorPerMeter;
  // mercator y: 0=north, 1=south
  const dNorth = from.y - to.y;
  const dNorthMeter = dNorth / mercatorPerMeter;
  return {dEastMeter, dNorthMeter};
}