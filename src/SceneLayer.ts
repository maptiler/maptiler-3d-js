import { type CustomLayerInterface, type Map as MapSDK, MercatorCoordinate, type LngLatLike, type CustomRenderMethodInput, LngLat, LngLat } from "@maptiler/sdk";
import {
  Camera,
  Matrix4,
  Scene,
  WebGLRenderer, AxesHelper,
  Vector3,
  Mesh,
  type Group,
  type Object3D,
  // AmbientLight,
  Quaternion,
  // PointLight,
  // DoubleSide,
  // PlaneGeometry,
  MeshBasicMaterial,
  // MeshPhongMaterial,
  SphereGeometry,
  PointLight,
  MeshPhongMaterial,
  MeshLambertMaterial,
  // DirectionalLight,
} from "three";

import { type GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { USDZLoader } from "three/examples/jsm/loaders/USDZLoader";

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
};

export type Item3D = {
  id: string;
  mercatorCoord: MercatorCoordinate;
  lngLat: LngLat;
  altitude: number;
  rotation: Quaternion;
  mesh: Mesh | AxesHelper | Group | Object3D | null;
};

export class SceneLayer implements CustomLayerInterface {
  public id: string;
  public readonly type = "custom";
  public renderingMode: "2d" | "3d" = "3d";
  public minZoom: number;
  public maxZoom: number;
  public scene!: Scene;
  public renderer!: WebGLRenderer;
  public map!: MapSDK;
  private camera!: Camera;
  private antialias: boolean;
  private items3D = new Map<string, Item3D>();
  private sceneOrigin: LngLat | null = null;
  private sceneOriginMercator: MercatorCoordinate | null = null;


  constructor(id: string, options: SceneLayerOptions = {}) {
    this.type = "custom";
    this.id = id;
    this.initScene();
    this.minZoom = options.minZoom ?? 0;
    this.maxZoom = options.maxZoom ?? 22;
    this.antialias = options.antiaslias ?? true;
  }

  private initScene() {
    this.camera = new Camera();
    this.camera.matrixWorldAutoUpdate = false;
    this.scene = new Scene();
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

    // TESTING
    this.testAddingMeshes();
  }

  onRemove?(_map: MapSDK, _gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    this.scene.clear();
  }

  render(_gl: WebGLRenderingContext | WebGL2RenderingContext, matrix: Mat4, _options: CustomRenderMethodInput) {
    if (!this.sceneOrigin) return;
    if (!this.isInZoomRange()) return;

    this.reposition();

    const offsetFromCenterElevation = this.map.queryTerrainElevation(this.sceneOrigin) || 0;
    const sceneOriginMercator = MercatorCoordinate.fromLngLat(this.sceneOrigin, offsetFromCenterElevation);

    const sceneTransform = {
      translateX: sceneOriginMercator.x,
      translateY: sceneOriginMercator.y,
      translateZ: sceneOriginMercator.z,
      scale: sceneOriginMercator.meterInMercatorCoordinateUnits()
    };

    const m = new Matrix4().fromArray(matrix);
    const l = new Matrix4()
      .makeTranslation(sceneTransform.translateX, sceneTransform.translateY, sceneTransform.translateZ)
      .scale(new Vector3(sceneTransform.scale, -sceneTransform.scale, sceneTransform.scale));

    this.camera.projectionMatrix = m.multiply(l);
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    this.map.triggerRepaint(); // TODO test without
  }

 
  private reposition() {
    if (!this.sceneOrigin || !this.sceneOriginMercator) return;

    // Doing it at render time rather than init time in case this has changed.
    // TODO: maybe debounce that.
    const sceneElevation = this.map.queryTerrainElevation(this.sceneOrigin) || 0;

    for (const [_itemId, item] of this.items3D) {
      // Get the elevation of the terrain at the location of the item
      const itemElevationAtPosition = this.map.queryTerrainElevation(item.lngLat) || 0;
      const itemUpShift = itemElevationAtPosition - sceneElevation + item.altitude;
      const {dEastMeter: itemEast, dNorthMeter: itemNorth} = calculateDistanceMercatorToMeters(this.sceneOriginMercator, item.mercatorCoord);
      item.mesh?.position.set(itemEast, itemNorth, itemUpShift);

      console.log(item.mesh?.position);
      
    }

  }












  addMesh(
    id: string,
    mesh: Mesh | Group | Object3D,
    lngLat: LngLatLike,
    options: {
      rotation?: Quaternion;
      altitude?: number;
    } = {},
  ) {
    const rotation = options.rotation ?? new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2); // new Vector3(Math.PI / 2, 0, 0);
    const altitude = options.altitude ?? 0;
    const mercatorCoord = MercatorCoordinate.fromLngLat(lngLat, altitude);

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
    };


    // The first mesh added defines the anchor point
    if (this.items3D.size === 0) {
      this.sceneOrigin = item.lngLat;
      this.sceneOriginMercator = MercatorCoordinate.fromLngLat(this.sceneOrigin);
    }
    

    this.items3D.set(id, item);
  }

  addMeshFromURL(
    id: string,
    meshURL: string,
    lngLat: LngLatLike,
    options: {
      rotation?: Quaternion;
      altitude?: number;
      scale?: Vector3;
    } = {},
  ) {
    const fileExt = meshURL.trim().toLowerCase().split(".").pop();

    console.log("fileExt>>>>>>>", fileExt);

    if (fileExt === "glb" || fileExt === "gltf") {
      const loader = new GLTFLoader();
      loader.load(meshURL, (meshScene: GLTF) => {
        const model = meshScene.scene;

        console.log(model);

        if (options.scale) {
          model.scale.set(options.scale.x, options.scale.y, options.scale.z);
        }

        this.addMesh(id, model, lngLat, options);
      });
    } else if (fileExt === "usdz") {
      const loader = new USDZLoader();

      loader.load(meshURL, (model: Mesh) => {
        if (options.scale) {
          model.scale.set(options.scale.x, options.scale.y, options.scale.z);
        }

        this.addMesh(id, model, lngLat, options);
      });
    } else {
      throw new Error("Mesh file mush be glTF/glb or USDZ.");
    }
  }

  testAddingMeshes() {
    // const pointLight = new PointLight(
    //   0xffffff, // color
    //   1000, // intensity
    // );

    // pointLight.position.set(10, 40, 0);
    // this.scene.add(pointLight);



    // const directionalLight = new DirectionalLight(0xffffff, 5);
    // directionalLight.position.set(0, -70, 100).normalize();
    // this.scene.add(directionalLight);

    // console.log(directionalLight);

    // const directionalLight2 = new DirectionalLight(0xffffff);
    // directionalLight2.position.set(0, 70, 100).normalize();
    // this.scene.add(directionalLight2);


    

    // this.addMesh(
    //   "point light",
    //   pointLight,
    //   [2.2945, 48.858],
    //   {
    //     altitude: 30,
    //     rotation: new Quaternion(),
    //     // rotation: new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2)
    //   }
    // )

    // const directionalLight2 = new DirectionalLight(0xffffff);
    // directionalLight2.position.set(100, 100, 70).normalize();
    // this.scene.add(directionalLight2);

    // this.addItem(
    //   "some mesh",
    //   [148.9819, -35.39847],
    //   // {
    //   //   rotation?: Vector3,
    //   //   scale?: number,
    //   //   altitude?: number
    //   // }
    //   );

    //   const loader = new GLTFLoader();
    //   loader.load(
    //     // 'https://maplibre.org/maplibre-gl-js/docs/assets/34M_17/34M_17.gltf',
    //     "private_models/tmp_SheenChair.glb",
    //     (gltf: GLTF) => {
    //       const model = gltf.scene;

    //       console.log(model);
    //       model.scale.set(100, 100, 100)

    //       this.addMesh("sofa", model, [148.9819, -35.39847]);
    //     }
    //   );
    // }

    // this.addMeshFromURL(
    //   "sofa",
    //   "private_models/SheenChair.glb",
    //   [2.349172, 48.853848], // Paris
    //   {
    //     scale: new Vector3(100, 100, 100), // necessary because the sofa is too small (possibly metric system)
    //   }
    // );





    // const quaternion = new Quaternion();
    // const rotationA = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2);
    // const rotationB = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 4);

    // // Chain the rotations
    // quaternion.multiplyQuaternions(rotationA, rotationB);

    // this.addMeshFromURL(
    //   "eiffel",
    //   // "private_models/free__la_tour_eiffel.glb",
    //   "https://maplibre.org/maplibre-gl-js/docs/assets/34M_17/34M_17.gltf",
    //   [2.294530547874315, 48.85826142288141], // Paris
    //   {
    //     scale: new Vector3(2.2, 2.2, 2.2), // necessary because the sofa is too small (possibly metric system)
    //     rotation: quaternion,
    //   }
    // );




    // const geometry = new PlaneGeometry(500, 500);
    // const material = new MeshPhongMaterial({ color: 0x555555, side: DoubleSide, specular: 0xffffff, shininess: 1 });
    // const planeA = new Mesh(geometry, material);
    // const planeB = new Mesh(geometry, material);
    // planeB.rotateY(Math.PI / 2);
    // const planeGoup = new Object3D();
    // planeGoup.add(planeA, planeB);

    // this.addMesh(
    //   "some planes",
    //   planeGoup,
    //   [2.294530547874315, 48.85826142288141],
    //   // {
    //   //   rotation?: Vector3,
    //   //   scale?: number,
    //   //   altitude?: number
    //   // }
    // );

    const sphereGeometry = new SphereGeometry(50);
    const sphereMaterial = new MeshLambertMaterial({ color: 0xff0000 });
    const sphere = new Mesh(sphereGeometry, sphereMaterial);

    this.addMesh("sphere", sphere, [2.2945, 48.858], {
      altitude: 0,
      // rotation: new Quaternion(),
    });






    const pointLight = new PointLight(
      0xffffff, // color
      70, // intensity
      0, // distance (0 = no limit)
      0.2, // decay
    );


    this.addMesh("light", pointLight, [0, 0], {
      altitude: 2000000,
      // rotation: new Quaternion(),
    });


    // const sphereLightGeometry = new SphereGeometry(10);
    // const sphereLightMaterial = new MeshBasicMaterial({ color: 0x0000ff });
    // const sphereLight = new Mesh(sphereLightGeometry, sphereLightMaterial);

    this.addMesh("sphereLight", new AxesHelper(100000), [0, 0], {
      altitude: 2000000,
      // rotation: new Quaternion(),
    });


    // this.addMeshFromURL(
    //   "camera",
    //   // "private_models/ToyCar.glb",
    //   "private_models/AntiqueCamera.glb",
    //   [-73.968038, 40.777186], // New York (Central Park)
    //   {
    //     scale: new Vector3(10, 10, 10), // necessary because the sofa
    //   }
    // );

    // this.addMeshFromURL(
    //   "antena",
    //   "https://maplibre.org/maplibre-gl-js/docs/assets/34M_17/34M_17.gltf",
    //   [-0.112638, 51.51], // London
    // );

    // this.addMeshFromURL(
    //   "flying car",
    //   "private_models/fennec_-_rocket_league_car.glb",
    //   [-0.13, 51.51], // London
    //   // {
    //   //   scale: new Vector3(100, 100, 100), // necessary because the sofa
    //   // }
    // );
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