import { type CustomLayerInterface, type Map as MapSDK, MercatorCoordinate, LngLatLike } from "@maptiler/sdk";
import {
  Camera,
  Matrix4,
  Scene,
  WebGLRenderer,
  AxesHelper, Vector3,
  type Mesh,
  Group,
  Object3D,
} from "three";

import { GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

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
  scale: number,
  rotation: Vector3,
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


    this.addItem(
      "some mesh",
      [148.9819, -35.39847], 
      // {
      //   rotation?: Vector3,
      //   scale?: number, 
      //   altitude?: number
      // }
      );
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






  addItem(id: string, position: LngLatLike, options: {rotation?: Vector3, scale?: number, altitude?: number} = {}) {
    // default rotation to go from ThreeJS's "Y up" convention to Maplibre's "Z up" convention by rotating
    // a quarter around X axis
    const rotation = options.rotation ?? new Vector3(Math.PI / 2, 0, 0);
    const scale = options.scale ?? 1;
    const altitude = options.altitude ?? 0;
    const mercatorCoord = MercatorCoordinate.fromLngLat(
      position,
      altitude, // altitude
    );

    const item: Item3D = {
      id,
      mercatorCoord,
      altitude,
      scale,
      rotation,
      // mesh: new AxesHelper( 100 ),
      mesh: null,
    }

    this.items3D.set(id, item);

    // Load the mesh
    const loader = new GLTFLoader();
    loader.load(
      'https://maplibre.org/maplibre-gl-js/docs/assets/34M_17/34M_17.gltf',
      (gltf: GLTF) => {
        const model = gltf.scene;
        item.mesh = model;
        model.scale.set(scale, scale, scale);
        model.rotation.set(rotation.x, rotation.y, rotation.z);
        this.scene.add(model);
      }
    );

  }

}