import { getVersion, LngLat } from "@maptiler/sdk";
import type { LngLatLike, CustomLayerInterface, CustomRenderMethodInput, Map as MapSDK } from "@maptiler/sdk";

import {
  Camera,
  Matrix4,
  Mesh,
  Scene,
  WebGLRenderer,
  type Group,
  type Object3D,
  PointLight,
  type ColorRepresentation,
  AmbientLight,
  Color,
  type Points,
  type PointsMaterial,
} from "three";

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

import { getTransformationMatrix, isPointLight } from "./utils";
import { SourceOrientation } from "./types";

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
  mesh: Mesh | Group | Object3D | null;
  lngLat: LngLat;
  altitude: number;
  scale: number;
  heading: number;
  sourceOrientation: SourceOrientation;
  altitudeReference: AltitudeReference;
  url: string | null;
  opacity: number;
  pointSize: number;
  wireframe: boolean;
  additionalTransformationMatrix: Matrix4;
};

// An epsilon to make sure the reference anchor point is not exactly at the center of the viewport, but still very close.
// This is because ThreeJS light shaders were messed up with reference point in the center.
// This issue is only happening because we are doing the projection matrix trick, otherwise we wouldn't bother with epsilon
const EPSILON = 0.01;

export class Layer3D implements CustomLayerInterface {
  public readonly id: string;
  public readonly type = "custom";
  public readonly renderingMode: "2d" | "3d" = "3d";
  private map!: MapSDK;

  public minZoom: number;
  public maxZoom: number;
  private antialias: boolean;

  private renderer!: WebGLRenderer;
  private readonly scene: Scene;
  private readonly camera: Camera;
  private readonly ambientLight: AmbientLight;

  private readonly items3D = new Map<string, Item3D>();

  constructor(id: string, options: Layer3DOptions = {}) {
    console.log("[maptiler-3d-js]", "Using MapTiler SDK JS version:", getVersion());

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
      powerPreference: "high-performance",
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
  render(_gl: WebGLRenderingContext | WebGL2RenderingContext, options: CustomRenderMethodInput) {
    if (this.isInZoomRange() === false) {
      return;
    }

    if (this.items3D.size === 0) {
      return;
    }

    const mapCenter = this.map.getCenter();

    const sceneOrigin = new LngLat(mapCenter.lng + EPSILON, mapCenter.lat + EPSILON);
    const sceneElevation = this.map.queryTerrainElevation(sceneOrigin) || 0;

    /**
     * `getMatrixForModel` returns transformation matrix for current active projection, which can be used to set correct position and orientation of the model.
     */
    const sceneMatrixData = this.map.transform.getMatrixForModel(sceneOrigin, sceneElevation);
    const sceneMatrix = new Matrix4().fromArray(sceneMatrixData);
    const sceneInverseMatrix = sceneMatrix.clone().invert();

    for (const [_, item] of this.items3D) {
      const model = item.mesh;

      if (model !== null) {
        const itemElevation = this.map.queryTerrainElevation(item.lngLat) || 0;
        const modelOrigin = item.lngLat;

        let modelAltitude = item.altitude;

        if (item.altitudeReference === AltitudeReference.GROUND) {
          modelAltitude += itemElevation;
        }

        /**
         * We are using transformation of scene origin and model for finding relative transofmration of the model to avoid precision issues.
         * Center of the map is used as an origin of the scene.
         */
        const modelMatrixData = this.map.transform.getMatrixForModel(modelOrigin, modelAltitude);
        const modelMatrix = new Matrix4()
          .fromArray(modelMatrixData)
          .multiply(item.additionalTransformationMatrix)
          .premultiply(sceneInverseMatrix);

        model.matrix = modelMatrix;
      }
    }

    let defaultProjectionData = options.defaultProjectionData;

    /**
     * Possible a bug.
     * The `defaultProjectionData` seems to be incorrect when the globe projection is used and the zoom is high (and projection is changing to mercator).
     * Waiting for help: https://github.com/maplibre/maplibre-gl-js/issues/5117
     */
    if ("_mercatorTransform" in this.map.transform === true) {
      defaultProjectionData =
        options.defaultProjectionData.projectionTransition === 1
          ? options.defaultProjectionData
          : // @ts-expect-error - Accessing private properties: `_mercatorTransform`
            this.map.transform._mercatorTransform.getProjectionDataForCustomLayer();
    }

    /**
     * https://github.com/maplibre/maplibre-gl-js/blob/v5.0.0-pre.8/test/examples/globe-3d-model.html#L130-L143
     * `mainMatrix` contains the transformation matrix for the current active projection.
     */
    const matrix = defaultProjectionData.mainMatrix;
    const m = new Matrix4().fromArray(matrix);

    this.camera.projectionMatrix = m.multiply(sceneMatrix);
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
   * Add an existing mesh to the map, with options.
   */
  addMesh(id: string, mesh: Mesh | Group | Object3D, options: MeshOptions = {}) {
    this.throwUniqueID(id);

    const sourceOrientation = options.sourceOrientation ?? SourceOrientation.Y_UP;
    const altitude = options.altitude ?? 0;
    const lngLat = options.lngLat ?? [0, 0];
    const heading = options.heading ?? 0;
    const visible = options.visible ?? true;
    const opacity = options.opacity ?? 1;
    const scale = options.scale ?? 1;
    const pointSize = options.pointSize ?? 1;
    const wireframe = options.wireframe ?? false;

    if (opacity !== 1) {
      this.setMeshOpacity(mesh, opacity, false);
    }

    if ("pointSize" in options) {
      this.setMeshPointSize(mesh, pointSize);
    }

    if ("wireframe" in options) {
      this.setMeshWireframe(mesh, wireframe);
    }

    const additionalTransformationMatrix = getTransformationMatrix(scale, heading, sourceOrientation);

    const item: Item3D = {
      id,
      lngLat: LngLat.convert(lngLat),
      altitude,
      scale,
      sourceOrientation,
      heading,
      mesh,
      altitudeReference: options.altitudeReference ?? AltitudeReference.GROUND,
      url: mesh.userData._originalUrl ?? null,
      opacity: opacity,
      pointSize: pointSize,
      wireframe: wireframe,
      additionalTransformationMatrix,
    };

    this.items3D.set(id, item);

    mesh.matrixAutoUpdate = false;
    mesh.visible = visible;
    this.scene.add(mesh);

    this.map.triggerRepaint();
  }

  /**
   * Modify an existing mesh. The provided options will overwrite
   * their current state, the omited ones will remain the same.
   */
  modifyMesh(id: string, options: MeshOptions) {
    const item = this.items3D.get(id);
    if (!item) return;
    if (!item.mesh) return;

    let isTransformNeedUpdate = false;

    if (typeof options.visible === "boolean") {
      item.mesh.visible = options.visible;
    }

    if ("lngLat" in options) {
      item.lngLat = LngLat.convert(options.lngLat as LngLatLike);
    }

    if (typeof options.scale === "number") {
      item.scale = options.scale;
      isTransformNeedUpdate = true;
    }

    if (typeof options.altitude === "number") {
      item.altitude = options.altitude;
    }

    if (typeof options.altitudeReference === "number") {
      item.altitudeReference = options.altitudeReference;
    }

    if (typeof options.heading === "number") {
      item.heading = options.heading;
      isTransformNeedUpdate = true;
    }

    if (isTransformNeedUpdate === true) {
      item.additionalTransformationMatrix = getTransformationMatrix(item.scale, item.heading, item.sourceOrientation);
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
      lngLat: new LngLat(sourceItem.lngLat.lng, sourceItem.lngLat.lat),
      altitude: sourceItem.altitude,
      altitudeReference: sourceItem.altitudeReference,
      visible: sourceItem.mesh.visible,
      sourceOrientation: sourceItem.sourceOrientation,
      scale: sourceItem.scale,
      heading: sourceItem.heading,
      ...options,
    };

    const clonedObject = sourceItem.mesh.clone(true);

    clonedObject.traverse((child) => {
      if (child instanceof Mesh) {
        if (Array.isArray(child.material)) {
          child.material = child.material.map((mat) => mat.clone());
        } else {
          child.material = child.material.clone();
        }
      }
    });

    this.addMesh(id, clonedObject, cloneOptions);
  }

  modifyPointLight(id: string, options: PointLightOptions) {
    const item = this.items3D.get(id);

    if (item === undefined) {
      return;
    }

    if (item.mesh === null || isPointLight(item.mesh) === false) {
      return;
    }

    if ("decay" in options && typeof options.decay === "number") {
      item.mesh.decay = options.decay;
    }

    if ("intensity" in options && typeof options.intensity === "number") {
      item.mesh.intensity = options.intensity;
    }

    if ("color" in options) {
      item.mesh.color.set(new Color(options.color)); // TODO: not optimal to call a constructor every time
    }

    if ("altitude" in options && typeof options.altitude === "number") {
      item.altitude = options.altitude;
    }

    if ("lngLat" in options) {
      item.lngLat = LngLat.convert(options.lngLat as LngLatLike);
    }

    if ("altitudeReference" in options && typeof options.altitudeReference === "number") {
      item.altitudeReference = options.altitudeReference;
    }

    if ("visible" in options && typeof options.visible === "boolean") {
      item.mesh.visible = options.visible;
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
