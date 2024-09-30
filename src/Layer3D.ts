import {
  type CustomLayerInterface,
  type Map as MapSDK,
  MercatorCoordinate,
  type LngLatLike,
  type CustomRenderMethodInput,
  LngLat,
} from "@maptiler/sdk";

import {
  Camera,
  Matrix4,
  Scene,
  WebGLRenderer,
  Vector3,
  type Mesh,
  type Group,
  type Object3D,
  Quaternion,
  PointLight,
  type ColorRepresentation,
  AmbientLight,
  Color,
  type Points,
  type PointsMaterial,
} from "three";

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

/**
 * The altitude of a mesh can be relative to the ground surface, or to the mean sea level
 */
export enum AltitudeReference {
  /**
   * Use the ground as a reference point to compute the altitude
   */
  GROUND = 1,

  /**
   * Uses mean sea level as a reference point to compute the altitude
   */
  MEAN_SEA_LEVEL = 2,
}

/**
 * Going from the original 3D space a mesh was created in, to the map 3D space (Z up, right hand)
 */
export enum SourceOrientation {
  /**
   * The mesh was originaly created in a 3D space that uses the x axis as the up direction
   */
  X_UP = 1,

  /**
   * The mesh was originaly created in a 3D space that uses the Y axis as the up direction
   */
  Y_UP = 2,

  /**
   * The mesh was originaly created in a 3D space that uses the Z axis as the up direction
   */
  Z_UP = 3,
}

/**
 * Generic options that apply to both point lights and meshes
 */
export type GenericObject3DOptions = {
  /**
   * Position.
   * Default: `[0, 0]` (Null Island)
   */
  lngLat?: LngLatLike;

  /**
   * Altitude above the reference (in meters).
   * Default: `0` for meshes, or `2000000` for point lights.
   */
  altitude?: number;

  /**
   * Reference to compute and adjust the altitude.
   * Default: `AltitudeReference.GROUND` for meshes and `AltitudeReference.MEAN_SEA_LEVEL` for point lights.
   */
  altitudeReference?: AltitudeReference;

  /**
   * Make the object visible or not.
   * Default: `true`
   */
  visible?: boolean;
};

/**
 * Options to add or modify a mesh
 */
export type MeshOptions = GenericObject3DOptions & {
  /**
   * Rotation to apply to the model to add, as a Quaternion.
   * Default: a rotation of PI/2 around the x axis, to adjust from the default ThreeJS space (right-hand, Y up) to the Maplibre space (right-hand, Z up)
   */
  sourceOrientation?: SourceOrientation;

  /**
   * Scale the mesh by a factor.
   * Default: no scaling added
   */
  scale?: number;

  /**
   * Heading measured in degrees clockwise from true north.
   */
  heading?: number;

  /**
   * Opacity of the mesh
   */
  opacity?: number;

  /**
   * Point size, applicable only to point clouds.
   * Default: 1
   */
  pointSize?: number;

  /**
   * Displays a mesh as wireframe if true (does not apply to point cloud)
   * Default: `false`
   */
  wireframe?: boolean;
};

/**
 * Options for adding a point light
 */
export type PointLightOptions = GenericObject3DOptions & {
  /**
   * Light color.
   * Default: `0xffffff` (white)
   */
  color?: ColorRepresentation;

  /**
   * Intensity of the light.
   * Default: `75`
   */
  intensity?: number;

  /**
   * Decay of the light relative to the distance to the subject.
   * Default: `0.5`
   */
  decay?: number;
};

export type SerializedGenericItem = {
  id: string;
  isLight: boolean;
  lngLat: [number, number];
  altitude: number;
  altitudeReference: AltitudeReference;
  visible: boolean;
  sourceOrientation: SourceOrientation;
};

export type SerializedMesh = SerializedGenericItem & {
  url: string;
  heading: number;
  scale: number;
};

export type SerializedPointLight = SerializedGenericItem & {
  color: string; // hex string
  intensity: number;
  decay: number;
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

export type Layer3DOptions = {
  /**
   * Bellow this zoom level, the meshes are not visible
   * Default: 0
   */
  minZoom?: number;

  /**
   * Beyond this zoom level, the meshes are not visible.
   * Default: 22
   */
  maxZoom?: number;

  /**
   * Default: true
   */
  antialias?: boolean;

  /**
   * Ambient light color.
   * Default: `0xffffff` (white)
   */
  ambientLightColor?: ColorRepresentation;

  /**
   * Ambient light intensity.
   * Default: `1`
   */
  ambientLightIntensity?: number;
};

export type Item3D = {
  id: string;
  mercatorCoord: MercatorCoordinate;
  lngLat: LngLat;
  altitude: number;
  heading: number;
  sourceOrientation: SourceOrientation;
  mesh: Mesh | Group | Object3D | null;
  altitudeReference: AltitudeReference;
  isLight: boolean;
  url: string | null;
  opacity: number;
  pointSize: number;
  wireframe: boolean;
};

export class Layer3D implements CustomLayerInterface {
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

  constructor(id: string, options: Layer3DOptions = {}) {
    this.type = "custom";
    this.id = id;
    this.minZoom = options.minZoom ?? 0;
    this.maxZoom = options.maxZoom ?? 22;
    this.antialias = options.antialias ?? true;

    this.camera = new Camera();
    this.camera.matrixWorldAutoUpdate = false;
    this.scene = new Scene();

    this.ambientLight = new AmbientLight(options.ambientLightColor ?? 0xffffff, options.ambientLightIntensity ?? 0.5);

    this.scene.add(this.ambientLight);
  }

  /**
   * Tells if the meshes should be displayed, based on the zoom range provided as layer options
   */
  private isInZoomRange(): boolean {
    const z = this.map.getZoom();
    return z >= this.minZoom && z <= this.maxZoom;
  }

  /**
   * Automatically called when the layer is added. (should not be called manually)
   */
  onAdd?(map: MapSDK, gl: WebGL2RenderingContext): void {
    this.map = map;
    this.renderer = new WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl,
      antialias: this.antialias,
    });

    this.renderer.autoClear = false;
  }

  /**
   * Automatically called when the layer is removed. (should not be called manually)
   */
  onRemove?(_map: MapSDK, _gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    this.clear();
    this.renderer.dispose();
  }

  /**
   * Automaticaly called by the rendering engine. (should not be called manually)
   */
  render(_gl: WebGLRenderingContext | WebGL2RenderingContext, matrix: Mat4, _options: CustomRenderMethodInput) {
    if (!this.isInZoomRange()) return;
    if (this.items3D.size === 0) return;

    const mapCenter = this.map.getCenter();
    this.sceneOrigin = new LngLat(mapCenter.lng + 0.01, mapCenter.lat + 0.01);
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
  }

  /**
   * Adjust the settings of the ambient light
   */
  setAmbientLight(options: { color?: ColorRepresentation; intensity?: number } = {}) {
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
    const sceneElevation = this.map.queryTerrainElevation(this.sceneOrigin) || 0;
    const targetElevation = this.map.getCameraTargetElevation();

    for (const [_itemId, item] of this.items3D) {
      // Get the elevation of the terrain at the location of the item
      const itemElevationAtPosition = this.map.queryTerrainElevation(item.lngLat) || 0;

      let itemUpShift = itemElevationAtPosition - sceneElevation + item.altitude;

      if (item.altitudeReference === AltitudeReference.MEAN_SEA_LEVEL) {
        const actualItemAltitude = targetElevation + itemElevationAtPosition;
        itemUpShift -= actualItemAltitude / terrainExag;
      }

      const { dEastMeter: itemEast, dNorthMeter: itemNorth } = calculateDistanceMercatorToMeters(
        this.sceneOriginMercator,
        item.mercatorCoord,
      );
      item.mesh?.position.set(itemEast, itemNorth, itemUpShift);
    }
  }

  /**
   * Add an existing mesh to the map, with options.
   */
  addMesh(id: string, mesh: Mesh | Group | Object3D, options: MeshOptions = {}) {
    this.throwUniqueID(id);

    const sourceOrientation = options.sourceOrientation ?? SourceOrientation.Y_UP;
    const sourceOrientationQuaternion = sourceOrientationToQuaternion(sourceOrientation);
    const altitude = options.altitude ?? 0;
    const lngLat = options.lngLat ?? [0, 0];
    const mercatorCoord = MercatorCoordinate.fromLngLat(lngLat, altitude);
    const heading = options.heading ?? 0;
    const headingQuaternion = headingToQuaternion(heading);
    const visible = options.visible ?? true;
    const opacity = options.opacity ?? 1;
    const pointSize = options.pointSize ?? 1;
    const wireframe = options.wireframe ?? false;

    if (opacity !== 1) {
      this.setMeshOpacity(mesh, opacity, false);
    }

    if (options.scale) {
      mesh.scale.set(options.scale, options.scale, options.scale);
    }

    if ("pointSize" in options) {
      this.setMeshPointSize(mesh, pointSize);
    }

    if ("wireframe" in options) {
      this.setMeshWireframe(mesh, wireframe);
    }

    mesh.visible = visible;
    mesh.setRotationFromQuaternion(headingQuaternion.multiply(sourceOrientationQuaternion));
    this.scene.add(mesh);

    const item: Item3D = {
      id,
      mercatorCoord,
      lngLat: LngLat.convert(lngLat),
      altitude,
      sourceOrientation,
      heading,
      mesh,
      altitudeReference: options.altitudeReference ?? AltitudeReference.GROUND,
      isLight: "isLight" in mesh && mesh.isLight === true,
      url: mesh.userData._originalUrl ?? null,
      opacity: opacity,
      pointSize: pointSize,
      wireframe: wireframe,
    };

    this.items3D.set(id, item);
    this.map.triggerRepaint();
  }

  /**
   * Creates a payload that serializes an item (point light or mesh)
   */
  // private serializeItem(id: string): SerializedMesh | SerializedPointLight {
  //   const item = this.items3D.get(id);
  //   if (!item) throw new Error(`No item with ID ${id}.`);
  //   if (!item.mesh) throw new Error(`The item with ID ${id} exists but does not contain any mesh object.`);
  //   if (!item.mesh.userData._originalUrl) throw new Error(`The mesh of the item ${id} was not loaded from a URL.`);

  //   if (item.isLight) {
  //     const mesh = (item.mesh as PointLight);

  //     return {
  //       id: item.id,
  //       lngLat: item.lngLat.toArray(),
  //       altitude: item.altitude,
  //       altitudeReference: item.altitudeReference,
  //       visible: item.mesh.visible,
  //       sourceOrientation: item.sourceOrientation,
  //       heading: item.heading,
  //       isLight: item.isLight,
  //       color: mesh.color.getHexString(),
  //       intensity: mesh.intensity,
  //       decay: mesh.decay,
  //     } as SerializedPointLight

  //   }

  //   return {
  //     id: item.id,
  //     lngLat: item.lngLat.toArray(),
  //     altitude: item.altitude,
  //     altitudeReference: item.altitudeReference,
  //     visible: item.mesh.visible,
  //     sourceOrientation: item.sourceOrientation,
  //     scale: item.mesh.scale.x,
  //     heading: item.heading,
  //     isLight: item.isLight,
  //     url: item.url,
  //   } as SerializedMesh;
  // }

  /**
   * Modify an existing mesh. The provided options will overwrite
   * their current state, the omited ones will remain the same.
   */
  modifyMesh(id: string, options: MeshOptions) {
    const item = this.items3D.get(id);
    if (!item) return;
    if (!item.mesh) return;

    if (typeof options.scale === "number") {
      item?.mesh?.scale.set(options.scale, options.scale, options.scale);
    }

    let adjustMercator = false;
    if (typeof options.altitude === "number") {
      item.altitude = options.altitude;
      adjustMercator = true;
    }

    if ("lngLat" in options) {
      item.lngLat = LngLat.convert(options.lngLat as LngLatLike);
      adjustMercator = true;
    }

    if (typeof options.altitudeReference === "number") {
      item.altitudeReference = options.altitudeReference;
    }

    if (adjustMercator) {
      item.mercatorCoord = MercatorCoordinate.fromLngLat(item.lngLat, item.altitude);
    }

    if (typeof options.visible === "boolean") {
      item.mesh.visible = options.visible;
    }

    let quaternionNeedsUpdate = false;

    if ("altitudeReference" in options) {
      item.altitudeReference = options.altitudeReference as AltitudeReference;
      quaternionNeedsUpdate = true;
    }

    if (typeof options.heading === "number") {
      quaternionNeedsUpdate = true;
      item.heading = options.heading;
    }

    if (quaternionNeedsUpdate) {
      const sourceOrientationQuaternion = sourceOrientationToQuaternion(item.sourceOrientation);
      const headingQuaternion = headingToQuaternion(item.heading);
      item.mesh.setRotationFromQuaternion(headingQuaternion.multiply(sourceOrientationQuaternion));
    }

    if (typeof options.opacity === "number") {
      this.setMeshOpacity(item.mesh, options.opacity, false);
    }

    if (typeof options.pointSize === "number") {
      this.setMeshPointSize(item.mesh, options.pointSize);
    }

    if (typeof options.wireframe === "boolean") {
      this.setMeshWireframe(item.mesh, options.wireframe);
    }

    this.map.triggerRepaint();
  }

  /**
   *
   * Clone an existing mesh. Extra options can be provided to overwrite the clone configuration
   */
  cloneMesh(sourceId: string, id: string, options: MeshOptions) {
    this.throwUniqueID(id);
    const sourceItem = this.items3D.get(sourceId);
    if (!sourceItem) return;
    if (!sourceItem.mesh) return;

    // Cloning the source item options and overwriting some with the provided options
    const cloneOptions: MeshOptions = {
      lngLat: sourceItem.lngLat,
      altitude: sourceItem.altitude,
      altitudeReference: sourceItem.altitudeReference,
      visible: sourceItem.mesh.visible,
      sourceOrientation: sourceItem.sourceOrientation,
      scale: sourceItem.mesh.scale.x,
      heading: sourceItem.heading,
      ...options,
    };

    this.addMesh(id, sourceItem.mesh.clone(), cloneOptions);
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
      item.lngLat = LngLat.convert(options.lngLat as LngLatLike);
      adjustMercator = true;
    }

    if ("altitudeReference" in options && typeof options.altitudeReference === "number") {
      item.altitudeReference = options.altitudeReference;
    }

    if (adjustMercator) {
      item.mercatorCoord = MercatorCoordinate.fromLngLat(item.lngLat, item.altitude);
    }

    if ("visible" in options && typeof options.visible === "boolean") {
      mesh.visible = options.visible;
    }

    this.map.triggerRepaint();
  }

  /**
   * Load a GLTF file from its URL and add it to the map
   */
  async addMeshFromURL(id: string, meshURL: string, options: MeshOptions = {}) {
    this.throwUniqueID(id);

    const fileExt = meshURL.trim().toLowerCase().split(".").pop();

    if (!(fileExt === "glb" || fileExt === "gltf")) {
      throw new Error("Mesh files must be glTF/glb.");
    }

    const loader = new GLTFLoader();
    const gltfContent = await loader.loadAsync(meshURL);
    const mesh = gltfContent.scene;
    mesh.userData._originalUrl = meshURL;
    this.addMesh(id, mesh, options);
  }

  /**
   * Remove all the meshes and point lights of the scene.
   */
  clear() {
    for (const [k, _item] of this.items3D) {
      this.removeMesh(k);
    }
  }

  /**
   * Remove a mesh from the scene using its ID.
   */
  removeMesh(id: string) {
    const item = this.items3D.get(id);

    if (!item) {
      throw new Error(`Mesh with ID ${id} does not exist.`);
    }

    const mesh = item?.mesh;

    if (mesh) {
      // Removing the mesh from the scene
      this.scene.remove(mesh);

      // Traversing the tree of this Object3D/Group/Mesh
      // and find all the sub nodes that are THREE.Mesh
      // so that we can dispose (aka. free GPU memory) of their material and geometries
      mesh.traverse((node) => {
        if ("isMesh" in node && node.isMesh === true) {
          const mesh = node as Mesh;
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const mat of materials) {
            mat.dispose();
          }

          mesh.geometry.dispose();
        }
      });
    }

    // Removing the item from the index.
    this.items3D.delete(id);
    this.map.triggerRepaint();
  }

  /**
   * Traverse a Mesh/Group/Object3D to modify the opacities of the all the materials it finds
   */
  private setMeshOpacity(obj: Mesh | Group | Object3D | Points, opacity: number, forceRepaint = false) {
    obj.traverse((node) => {
      if (("isMesh" in node && node.isMesh === true) || ("isPoints" in node && node.isPoints === true)) {
        const mesh = node as Mesh;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of materials) {
          mat.opacity = opacity;
          mat.transparent = true;
        }
      }
    });

    if (forceRepaint) this.map.triggerRepaint();
  }

  /**
   * If a mesh is a point cloud, it defines the size of the points
   */
  private setMeshPointSize(obj: Mesh | Group | Object3D | Points, size: number, forceRepaint = false) {
    obj.traverse((node) => {
      if ("isPoints" in node && node.isPoints === true) {
        const mesh = node as Points;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of materials) {
          (mat as PointsMaterial).size = size;
        }
      }
    });

    if (forceRepaint) this.map.triggerRepaint();
  }

  /**
   * If a mesh can be rendered as wireframe, then the option is toggled according to the wireframe param
   */
  private setMeshWireframe(obj: Mesh | Group | Object3D, wireframe: boolean, forceRepaint = false) {
    obj.traverse((node) => {
      if ("isMesh" in node && node.isMesh === true) {
        const mesh = node as Mesh;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of materials) {
          if ("wireframe" in mat && typeof mat.wireframe === "boolean") mat.wireframe = wireframe;
        }
      }
    });

    if (forceRepaint) this.map.triggerRepaint();
  }

  /**
   * If a mesh is a point cloud, it defines the size of the points
   */
  private setMeshPointSize(obj: Mesh | Group | Object3D | Points, size: number, forceRepaint = false) {
    obj.traverse((node) => {
      if ("isPoints" in node && node.isPoints === true) {
        const mesh = node as Points;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of materials) {
          (mat as PointsMaterial).size = size;
        }
      }
    });

    if (forceRepaint) this.map.triggerRepaint();
  }

  /**
   * If a mesh can be rendered as wireframe, then the option is toggled according to the wireframe param
   */
  private setMeshWireframe(obj: Mesh | Group | Object3D, wireframe: boolean, forceRepaint = false) {
    obj.traverse((node) => {
      if ("isMesh" in node && node.isMesh === true) {
        const mesh = node as Mesh;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of materials) {
          if ("wireframe" in mat && typeof mat.wireframe === "boolean") mat.wireframe = wireframe;
        }
      }
    });

    if (forceRepaint) this.map.triggerRepaint();
  }

  /**
   * Adding a point light. The default options are mimicking the sun:
   * lngLat: `[0, 0]` (null island)
   * altitude: `2_000_000` meters
   * altitudeReference: `AltitudeReference.MEAN_SEA_LEVEL`
   * color: `0xffffff` (white)
   * intensity: `75`
   * decay: `0.2`
   */
  addPointLight(id: string, options: PointLightOptions = {}) {
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
      throw new Error(`Mesh IDs are unique. A mesh or light with the id "${id}" already exist.`);
    }
  }
}

function calculateDistanceMercatorToMeters(
  from: MercatorCoordinate,
  to: MercatorCoordinate,
): { dEastMeter: number; dNorthMeter: number } {
  const mercatorPerMeter = from.meterInMercatorCoordinateUnits();
  // mercator x: 0=west, 1=east
  const dEast = to.x - from.x;
  const dEastMeter = dEast / mercatorPerMeter;
  // mercator y: 0=north, 1=south
  const dNorth = from.y - to.y;
  const dNorthMeter = dNorth / mercatorPerMeter;
  return { dEastMeter, dNorthMeter };
}

function sourceOrientationToQuaternion(so: SourceOrientation | undefined): Quaternion {
  // Most models and 3D environments are Y up (right hand), so we use this as a default
  const yUp = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2);
  switch (so) {
    case SourceOrientation.X_UP:
      return new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -Math.PI / 2);
    case SourceOrientation.Z_UP:
      return new Quaternion();
    default:
      return yUp;
  }
}

function headingToQuaternion(heading: number): Quaternion {
  return new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), (-heading * Math.PI) / 180);
}
