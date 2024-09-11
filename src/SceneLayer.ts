import { type CustomLayerInterface, type Map as MapSDK, MercatorCoordinate, type LngLatLike } from "@maptiler/sdk";
import {
  Camera,
  Matrix4,
  Scene,
  WebGLRenderer,
  type AxesHelper, Vector3,
  type Mesh,
  type Group,
  type Object3D,
  AmbientLight,
  Quaternion,
  DirectionalLight,
  PointLight,
  PointLightHelper,
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
  id: string,
  mercatorCoord: MercatorCoordinate,
  altitude: number,
  rotation: Quaternion,
  mesh: Mesh | AxesHelper | Group | Object3D | null,
}


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
    this.scene = new Scene();

    // Adding ambien light for debugging
    const light = new AmbientLight( 0xFFFFFF, 10 ); // soft white light
    this.scene.add( light );

    // const axisHelper = new AxesHelper(0.25);

    // const mercatorCoordinates = MercatorCoordinate.fromLngLat(
    //   [6.260483, 46.390981], // Leman lake
    //   0, // altitude
    // );

    // axisHelper.position.x = mercatorCoordinates.x;
    // axisHelper.position.y = mercatorCoordinates.y;

    // this.scene.add(axisHelper);
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


  render(_gl: WebGLRenderingContext | WebGL2RenderingContext, matrix: Mat4) {
    // // Render only if in zoom range
    if (!this.isInZoomRange()) return;


    const center = this.map.getCenter();
    const centerAltitude = 0; // to be fetched
    const anchor = MercatorCoordinate.fromLngLat(center, centerAltitude);
    

    const anchorMercatorScale = anchor.meterInMercatorCoordinateUnits();

    const anchorTransform = {
        translateX: anchor.x,
        translateY: anchor.y,
        translateZ: anchor.z,
        scale: new Vector3(anchorMercatorScale, -anchorMercatorScale, anchorMercatorScale),
    };

    // console.log(anchorMercatorScale);
    

    for (const [_itemId, item] of this.items3D) {
      const mercatorCoord = item.mercatorCoord;

      console.log(item);
      

      // applying on each mesh the offset relative to viewport center
      item.mesh?.position.set(
       ( mercatorCoord.x - anchor.x) / anchorMercatorScale,
        (mercatorCoord.y - anchor.y) / -anchorMercatorScale,
        (mercatorCoord.z - anchor.z) / anchorMercatorScale
        );
    }
    

    // Updating the threejs projection matrix so that it uses
    // the 3D point at the center of the viewport as reference (anchor) point,
    // meaning the models/mesh/light will have coordinates relative to this anchor.
    const m = new Matrix4().fromArray(matrix);
    const l = new Matrix4()
      .makeTranslation(
        anchorTransform.translateX,
        anchorTransform.translateY,
        anchorTransform.translateZ
      )
      .scale(anchorTransform.scale)

    this.camera.projectionMatrix = m.multiply(l);
    

    



    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    this.map.triggerRepaint();
  }






  // addItem(id: string, position: LngLatLike, options: {rotation?: Vector3, scale?: number, altitude?: number} = {}) {
  //   // default rotation to go from ThreeJS's "Y up" convention to Maplibre's "Z up" convention by rotating
  //   // a quarter around X axis
  //   const rotation = options.rotation ?? new Vector3(Math.PI / 2, 0, 0);
  //   const scale = options.scale ?? 1;
  //   const altitude = options.altitude ?? 0;
  //   const mercatorCoord = MercatorCoordinate.fromLngLat(
  //     position,
  //     altitude, // altitude
  //   );

  //   const item: Item3D = {
  //     id,
  //     mercatorCoord,
  //     altitude,
  //     rotation,
  //     // mesh: new AxesHelper( 100 ),
  //     mesh: null,
  //   }

  //   this.items3D.set(id, item);

  //   // Load the mesh
  //   const loader = new GLTFLoader();
  //   loader.load(
  //     'https://maplibre.org/maplibre-gl-js/docs/assets/34M_17/34M_17.gltf',
  //     (gltf: GLTF) => {
  //       const model = gltf.scene;
  //       item.mesh = model;
  //       model.scale.set(scale, scale, scale);
  //       model.rotation.set(rotation.x, rotation.y, rotation.z);
  //       this.scene.add(model);
  //     }
  //   );

  // }



  addMesh(
    id: string, 
    mesh: Mesh | Group | Object3D,
    lngLat: LngLatLike,
    options: {
      rotation?: Quaternion,
      altitude?: number
    } = {}) {
      const rotation = options.rotation ?? new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2) // new Vector3(Math.PI / 2, 0, 0);
      const altitude = options.altitude ?? 0;
      const mercatorCoord = MercatorCoordinate.fromLngLat(
        lngLat,
        altitude,
      );

      // mesh.rotation.set(rotation.x, rotation.y, rotation.z);
      mesh.setRotationFromQuaternion(rotation);

      this.scene.add(mesh);

      const item: Item3D = {
        id,
        mercatorCoord,
        altitude,
        rotation,
        mesh,
      }
  
      this.items3D.set(id, item);
  }


  addMeshFromURL(
    id: string, 
    meshURL: string,
    lngLat: LngLatLike,
    options: {
      rotation?: Quaternion,
      altitude?: number,
      scale?: Vector3,
    } = {}
  ) {

    const fileExt = meshURL.trim().toLowerCase().split(".").pop();

    console.log("fileExt>>>>>>>", fileExt);
    

    if (fileExt === "glb" || fileExt === "gltf") {

      const loader = new GLTFLoader();
      loader.load(
        meshURL,
        (meshScene: GLTF) => {
          const model = meshScene.scene;

          console.log(model);
          

          if (options.scale) {
            model.scale.set(options.scale.x, options.scale.y, options.scale.z);
          }

        this.addMesh(id, model, lngLat, options);
        }
      );

    } else if (fileExt === "usdz") {

      const loader = new USDZLoader();

      loader.load(
        meshURL,
        (model: Mesh) => {
          if (options.scale) {
            model.scale.set(options.scale.x, options.scale.y, options.scale.z);
          }

        this.addMesh(id, model, lngLat, options);
        }
      );

    } else {
      throw new Error("Mesh file mush be glTF/glb or USDZ.");
    }



    

  }


  testAddingMeshes() {

    const pointLight = new PointLight(
      0xffffff, // color
      1000000, // intensity
    );

    const pointLightHelper = new PointLightHelper( pointLight, 20 );
    this.scene.add( pointLightHelper );

    // directionalLight.position.set(0, 0, 100);
    // this.scene.add(directionalLight);

    // pointLight.position.set(0, -70, 100).normalize();
            // this.scene.add(pointLight);

    this.addMesh(
      "point light", 
      pointLight,
      [2.29, 48.85],
      {
        altitude: 200
      }
      )

      this.addMesh(
        "point light helper", 
        pointLightHelper,
        [2.29, 48.85],
        {
          altitude: 200
        }
        )

    // const directionalLight2 = new DirectionalLight(0xffffff);
    // directionalLight2.position.set(0, 70, 100).normalize();
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

    const quaternion = new Quaternion();
    const rotationA = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2);
    const rotationB = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 4);

    // Chain the rotations
    quaternion.multiplyQuaternions(rotationA, rotationB);

    this.addMeshFromURL(
      "eiffel",
      "private_models/free__la_tour_eiffel.glb",
      [2.294530547874315, 48.85826142288141], // Paris
      {
        scale: new Vector3(2.2, 2.2, 2.2), // necessary because the sofa is too small (possibly metric system)
        rotation: quaternion,
      }
    );


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