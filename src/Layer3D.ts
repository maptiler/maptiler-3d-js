import { type Map as MapSDK, type LngLatLike, type CustomRenderMethodInput, LngLat, getVersion } from "@maptiler/sdk";

import { name, version } from "../package.json";

import {
  type AnimationAction,
  type Group,
  type ColorRepresentation,
  type Points,
  type PointsMaterial,
  type AnimationClip,
  Camera,
  Matrix4,
  Mesh,
  Scene,
  PointLight,
  AmbientLight,
  Color,
  AnimationMixer,
  Clock,
  Object3D,
  Vector3,
} from "three";

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

import { getTransformationMatrix, isPointLight } from "./utils";
import {
  type Layer3DOptions,
  type MeshOptions,
  type AddMeshFromURLOptions,
  type CloneMeshOptions,
  type PointLightOptions,
  type Layer3DInternalAPIInterface,
  type Layer3DInternalApiEvent,
  SourceOrientation,
  AltitudeReference,
} from "./types";
import addLayerToWebGLRenderManager, { type WebGLRenderManager } from "./WebGLRenderManager";
import { EPSILON, USE_DEBUG_LOGS } from "./config";
import { Item3D } from "./Item3D";
import {
  getItem3DEventTypesSymbol,
  handleMeshClickMethodSymbol,
  handleMeshDoubleClickMethodSymbol,
  handleMeshMouseEnterMethodSymbol,
  handleMeshMouseLeaveMethodSymbol,
  handleMeshMouseUpSymbol,
  handleMeshMouseDownSymbol,
  prepareRenderMethodSymbol,
  getItem3DDollySymbol,
} from "./symbols";
/**
 * The Layer3D class is the main class for the 3D layer.
 * It is used to add meshes to the layer, and to manage the items in the layer.
 * @example
 * ```ts
  const layer3D = new Layer3D("layer-id");
  map.addLayer(layer3D);

  layer3D.setAmbientLight({ intensity: 2 });
  layer3D.addPointLight("point-light", { intensity: 30 });
  layer3D.modifyPointLight("point-light", { intensity: 100 });

  await layer3D.addMeshFromURL("duck", "./models/Duck.glb", {
    ...state,
    sourceOrientation: SourceOrientation.Y_UP,
  });
```
 */
export class Layer3D implements Layer3DInternalAPIInterface {
  /**
   * The id of the layer, this is used to identify the layer in the map
   */
  public readonly id: string;

  /**
   * The type of the layer, this is used to identify the layer in the map
   * @see {CustomLayerInterface#type} https://maplibre.org/maplibre-gl-js/docs/API/interfaces/CustomLayerInterface/#type
   */
  public readonly type = "custom";
  /**
   * The rendering mode of the layer, this is used to identify the layer in the map
   * @see {CustomLayerInterface#renderingMode} https://maplibre.org/maplibre-gl-js/docs/API/interfaces/CustomLayerInterface/#renderingmode
   */
  public readonly renderingMode: "2d" | "3d" = "3d";

  /**
   * The map instance of the layer
   * @see {MapSDK} https://docs.maptiler.com/sdk-js/api/map/#map
   */
  private map!: MapSDK;

  /**
   * The minimum zoom of the layer
   * @see {CustomLayerInterface#minZoom} https://maplibre.org/maplibre-gl-js/docs/API/interfaces/CustomLayerInterface/#minzoom
   */
  public minZoom: number;
  /**
   * The maximum zoom of the layer
   * @see {CustomLayerInterface#maxZoom} https://maplibre.org/maplibre-gl-js/docs/API/interfaces/CustomLayerInterface/#maxzoom
   */
  public maxZoom: number;

  /**
   * The renderer instance of the layer
   * @see {WebGLRenderManager} https://docs.maptiler.com/sdk-js/api/webglrendermanager/#webglrendermanager
   */
  private renderer!: WebGLRenderManager;
  /**
   * The three.js clock instance of the layer. Used internally for animations.
   * @see {Clock} https://threejs.org/docs/#api/en/core/Clock
   */
  public readonly clock = new Clock();
  /**
   * The three.js scene instance of the layer.
   * @see {Scene} https://threejs.org/docs/#api/en/scenes/Scene
   */
  private readonly scene: Scene;
  /**
   * The three.js camera instance of the layer.
   * @see {Camera} https://threejs.org/docs/#api/en/cameras/Camera
   */
  private readonly camera: Camera;
  /**
   * The three.js ambient light instance of the layer.
   * @see {AmbientLight} https://threejs.org/docs/#api/en/lights/AmbientLight
   */
  private readonly ambientLight: AmbientLight;
  /**
   * The map of the items in the layer.
   */

  private readonly items3D = new Map<string, Item3D>();
  /**
   * The callbacks to unsubscribe when the layer is removed.
   * This is used to unsubscribe from internal events.
   * @see {Array} https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array
   */
  private onRemoveCallbacks: Array<() => void> = [];
  /**
   * Whether the elevation needs to be updated.
   * This is used to update the elevation of the items in the layer.
   */
  private isElevationNeedUpdate = false;

  constructor(id: string, options: Layer3DOptions = {}) {
    if (USE_DEBUG_LOGS === true) {
      console.log("[maptiler-3d-js]", "Using MapTiler SDK JS version:", getVersion());
    }

    this.type = "custom";
    this.id = id;

    /**
     * From MapLibre GL JS v5.0.0 current zoom could be negative (for globe projection)
     */
    this.minZoom = options.minZoom ?? Number.NEGATIVE_INFINITY;
    this.maxZoom = options.maxZoom ?? 22;

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
    map.telemetry.registerModule(name, version);

    this.map = map;

    this.renderer = addLayerToWebGLRenderManager({
      map,
      gl,
      layer: this,
      scene: this.scene,
      camera: this.camera,
    });

    const { unsubscribe: unsubscribeOnTerrainAnimationStart } = this.map.on("terrainAnimationStart", () => {
      this.isElevationNeedUpdate = true;
    });

    const { unsubscribe: unsubscribeOnTerrainAnimationStop } = this.map.on("terrainAnimationStop", () => {
      this.isElevationNeedUpdate = false;
    });

    this.onRemoveCallbacks = [unsubscribeOnTerrainAnimationStart, unsubscribeOnTerrainAnimationStop];
  }

  /**
   * Automatically called when the layer is removed. (should not be called manually)
   */
  onRemove?(_map: MapSDK, _gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    this.clear();
    this.renderer.dispose(this.id);

    for (const callback of this.onRemoveCallbacks) {
      callback();
    }

    this.onRemoveCallbacks = [];
  }

  /**
   * Get the map instance of the layer.
   * @returns {MapSDK} The map instance
   */
  public getMapInstance(): MapSDK {
    return this.map;
  }

  /**
   * Get the renderer instance of the layer. This is internally for animations and batch rendering layers.
   * @returns {WebGLRenderManager} The renderer instance
   */
  public getRendererInstance(): WebGLRenderManager {
    return this.renderer;
  }

  /**
   * Handle the click event for a mesh
   * This is used to trigger the `click` event for the item by WebGLRenderManager.
   * @see {WebGLRenderManager#handleMouseClick}
   * @param event - The event data
   * @internal
   */
  [handleMeshClickMethodSymbol](event: Layer3DInternalApiEvent) {
    const item = this.getItem3D(event.meshID);
    // to make sure that the item has a listener and we don't just trigger the event anyway
    if (item?.mesh === event.object && item[getItem3DEventTypesSymbol]().includes("click")) {
      const eventData = {
        intersection: event.intersection,
        lngLat: event.lngLat,
        point: event.point,
        meshID: event.meshID,
        layerID: event.layerID,
        item,
      };
      item.fire("click", eventData);
    }
  }

  /**
   * Handle the mouse enter event for a mesh.
   * This is used to trigger the `mouseenter` event for the item by WebGLRenderManager.
   * @internal
   * @private
   * @see {WebGLRenderManager#handleMouseMove}
   * @param event - The event data
   */
  [handleMeshMouseEnterMethodSymbol](event: Layer3DInternalApiEvent) {
    const item = this.getItem3D(event.meshID);
    // to make sure that the item has a listener and we don't just trigger the event anyway
    if (item?.mesh === event.object && item[getItem3DEventTypesSymbol]().includes("mouseenter")) {
      const eventData = {
        intersection: event.intersection,
        lngLat: event.lngLat,
        point: event.point,
        meshID: event.meshID,
        layerID: event.layerID,
        item,
      };
      item.fire("mouseenter", eventData);
    }
  }

  /**
   * Handle the mouse leave event for a mesh.
   * This is used to trigger the `mouseleave` event for the item by WebGLRenderManager.
   * @internal
   * @private
   * @see {WebGLRenderManager#handleMouseMove}
   * @param event - The event data
   */
  [handleMeshMouseLeaveMethodSymbol](event: Layer3DInternalApiEvent) {
    const item = this.getItem3D(event.meshID);
    // to make sure that the item has a listener and we don't just trigger the event anyway
    if (item?.mesh === event.object && item[getItem3DEventTypesSymbol]().includes("mouseleave")) {
      const eventData = {
        intersection: event.intersection,
        lngLat: event.lngLat,
        point: event.point,
        meshID: event.meshID,
        layerID: event.layerID,
        item,
      };
      item.fire("mouseleave", eventData);
    }
  }

  /**
   * Handle the mouse down event for a mesh.
   * This is used to trigger the `mousedown` event for the item by WebGLRenderManager.
   * @internal
   * @private
   * @see {WebGLRenderManager#handleMouseDown}
   * @param event - The event data
   */
  [handleMeshMouseDownSymbol](event: Layer3DInternalApiEvent) {
    const item = this.getItem3D(event.meshID);
    if (item?.mesh === event.object && item[getItem3DEventTypesSymbol]().includes("mousedown")) {
      item.fire("mousedown", event);
    }
  }

  /**
   * Handle the mouse up event for a mesh.
   * This is used to trigger the `mouseup` event for the item by WebGLRenderManager.
   * @internal
   * @private
   * @see {WebGLRenderManager#handleMouseUp}
   * @param event - The event data
   */
  [handleMeshMouseUpSymbol](event: Layer3DInternalApiEvent) {
    const item = this.getItem3D(event.meshID);
    if (item?.mesh === event.object && item[getItem3DEventTypesSymbol]().includes("mouseup")) {
      item.fire("mouseup", event);
    }
  }

  /**
   * Handle the double click event for a mesh.
   * This is used to trigger the `dblclick` event for the item by WebGLRenderManager.
   * @internal
   * @private
   * @see {WebGLRenderManager#handleMouseDoubleClick}
   * @param event - The event data
   */
  [handleMeshDoubleClickMethodSymbol](event: Layer3DInternalApiEvent) {
    const item = this.getItem3D(event.meshID);
    // to make sure that the item has a listener and we don't just trigger the event anyway
    if (item?.mesh === event.object && item[getItem3DEventTypesSymbol]().includes("dblclick")) {
      const eventData = {
        intersection: event.intersection,
        lngLat: event.lngLat,
        point: event.point,
        meshID: event.meshID,
        layerID: event.layerID,
        item,
      };
      item.fire("dblclick", eventData);
    }
  }

  /**
   * Prepare the render of the layer. This is called externally by the `WebGLManagerLayer`.
   * This is equivalent to the `render` method in a MapLibre GL JS layer.
   * The difference being it merely prepares state for the render in `WebGLRenderManager`.
   * @see {WebGLRenderManager}
   * @param {CustomRenderMethodInput} options - The render options from the map.
   * @internal
   * @private
   */
  [prepareRenderMethodSymbol](options: CustomRenderMethodInput) {
    if (this.isInZoomRange() === false) {
      console.log("isInZoomRange", this.isInZoomRange());
      return;
    }

    if (this.items3D.size === 0) {
      return;
    }

    if ([0, 1].includes(options.defaultProjectionData.projectionTransition) === false) {
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
      const model = item[getItem3DDollySymbol]();

      if (model !== null) {
        let modelAltitude = item.altitude;

        if (item.altitudeReference === AltitudeReference.GROUND) {
          if (this.isElevationNeedUpdate === true) {
            item.setElevation(this.map.queryTerrainElevation(item.lngLat) || 0);
          }

          modelAltitude += item.elevation;
        }

        /**
         * We are using transformation of scene origin and model for finding relative transofmration of the model to avoid precision issues.
         * Center of the map is used as an origin of the scene.
         */
        const modelMatrixData = this.map.transform.getMatrixForModel(item.lngLat, modelAltitude);
        const modelMatrix = new Matrix4()
          .fromArray(modelMatrixData)
          .multiply(item.additionalTransformationMatrix)
          .premultiply(sceneInverseMatrix);

        model.matrix = modelMatrix;
      }
    }

    /**
     * https://github.com/maplibre/maplibre-gl-js/blob/v5.0.0-pre.8/test/examples/globe-3d-model.html#L130-L143
     * `mainMatrix` contains the transformation matrix for the current active projection.
     */
    const matrix = options.defaultProjectionData.mainMatrix;
    const m = new Matrix4().fromArray(matrix);

    const maplibreMatrix = m.multiply(sceneMatrix);
    this.camera.projectionMatrix.copy(maplibreMatrix);
  }

  /**
   * Render the layer. Normally this method is called by the Map instance on every frame to calculate matrices
   * and update the camera projection matrix.
   * However, this would require a multiple instances of Three.js renderers, which is not optimal.
   * So instead we use the `WebGLManagerLayer` to render the layer and return null.
   * @see {Layer3D#[prepareRenderMethodSymbol]} where all the calculations for the layer are done.
   * @see {WebGLManagerLayer}
   * @returns {null}
   */
  render() {
    return null;
  }

  /**
   * Adjust the settings of the ambient light
   * @param options - The options to set the ambient light with
   * @returns {Layer3D} The layer
   */
  public setAmbientLight(options: { color?: ColorRepresentation; intensity?: number } = {}) {
    if (typeof options.intensity === "number") {
      this.ambientLight.intensity = options.intensity;
    }

    if ("color" in options) {
      this.ambientLight.color = new Color(options.color as ColorRepresentation);
    }
    return this;
  }

  /**
   * Add an existing mesh to the map
   * @param id - The ID of the mesh
   * @param options - The options to add the mesh with
   * @returns {Item3D} The item
   */
  public addMesh(id: string, mesh: Mesh | Group | Object3D, options: MeshOptions = {}) {
    return this.addMeshInternal({
      ...options,
      id,
      mesh,
    });
  }
  /**
   * Add an existing mesh to the map, with options.
   * @param id - The ID of the mesh
   * @param mesh - The mesh to add
   * @param animations - The animations to add
   * @param {MeshOptions} options - The options for the mesh
   * @returns {Layer3D} The layer
   */
  private addMeshInternal({
    id,
    mesh,
    animations,
    ...options
  }: MeshOptions & { id: string; mesh: Mesh | Group | Object3D; animations?: AnimationClip[] }) {
    this.throwUniqueID(id);

    mesh.name = mesh.name ?? id;

    mesh.userData.meshID = id;
    mesh.userData.layerID = this.id;

    const sourceOrientation = options.sourceOrientation ?? SourceOrientation.Y_UP;
    const altitude = options.altitude ?? 0;
    const lngLat = options.lngLat ?? [0, 0];
    const heading = options.heading ?? 0;
    const visible = options.visible ?? true;
    const opacity = options.opacity ?? 1;
    const scale = options.scale ?? [1, 1, 1];
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

    const additionalTransformationMatrix = getTransformationMatrix(
      scale as [number, number, number],
      heading,
      sourceOrientation,
    );
    const elevation = this.map.queryTerrainElevation(lngLat) || 0;

    const mixer = new AnimationMixer(mesh);

    const animationMap = animations
      ? animations.reduce(
          (acc, clip) => {
            acc[clip.name] = mixer.clipAction(clip);
            return acc;
          },
          {} as Record<string, AnimationAction>,
        )
      : {};

    const item = new Item3D(this, {
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
      elevation,
      animationMap,
      animationClips: animations,
      animationMixer: mixer,
      animationMode: options.animationMode ?? "continuous",
      states: options.states ?? {},
      userData: options.userData ?? {},
    });

    this.items3D.set(id, item);

    const dolly = item[getItem3DDollySymbol]();

    // mesh.matrixAutoUpdate = false;
    mesh.visible = visible;

    if (dolly) {
      dolly.matrixAutoUpdate = false;
      dolly.visible = visible;
      this.scene.add(dolly);
    }

    this.map.triggerRepaint();

    return item;
  }

  public getItem3D(id: string): Item3D | null {
    return this.items3D.get(id) ?? null;
  }

  /**
   *
   * Clone an existing mesh. Extra options can be provided to overwrite the clone configuration
   * @param sourceId - The ID of the mesh to clone
   * @param id - The ID of the cloned mesh
   * @param options - The options to clone the mesh with
   */
  cloneMesh(sourceId: string, id: string, options: CloneMeshOptions = {}) {
    this.throwUniqueID(id);
    const sourceItem = this.items3D.get(sourceId);
    if (!sourceItem) return;
    if (!sourceItem.mesh) return;

    // Cloning the source item options and overwriting some with the provided options
    const cloneOptions: Partial<MeshOptions> = {
      lngLat: new LngLat(sourceItem.lngLat.lng, sourceItem.lngLat.lat),
      altitude: sourceItem.altitude,
      altitudeReference: sourceItem.altitudeReference,
      visible: sourceItem.mesh.visible,
      sourceOrientation: sourceItem.sourceOrientation,
      scale: sourceItem.scale,
      heading: sourceItem.heading,
      ...options,
    };

    /**
     * Deep cloning the mesh and its materials (otherwise wireframe and opacity would be shared)
     */
    const clonedObject = sourceItem.mesh.clone(true);

    const gltfContent = clonedObject.getObjectByName(`${sourceId}_gltfContent_scene`);
    if (options.transform && gltfContent) {
      gltfContent.name = `${id}_gltfContent_scene`;
      const { rotation, offset } = options.transform;
      if (rotation) {
        gltfContent.rotation.set(rotation.x ?? 0, rotation.y ?? 0, rotation.z ?? 0);
      }
      if (offset) {
        gltfContent.position.add(new Vector3(offset.x ?? 0, offset.y ?? 0, offset.z ?? 0));
      }
    }

    clonedObject.traverse((child) => {
      if (child instanceof Mesh) {
        if (Array.isArray(child.material)) {
          child.material = child.material.map((mat) => mat.clone());
        } else {
          child.material = child.material.clone();
        }
      }
    });

    this.addMeshInternal({
      ...cloneOptions,
      id,
      mesh: clonedObject,
      ...(sourceItem.animationClips && { animations: sourceItem.animationClips }),
      animationMode: sourceItem.animationMode,
    });
  }

  /**
   * Modify a point light
   * @param id - The ID of the point light
   * @param options - The options to modify the point light with
   */
  public modifyPointLight(id: string, options: PointLightOptions) {
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

    return this;
  }

  /**
   * Load a GLTF file from its URL and add it to the map
   * @param id - The ID of the mesh
   * @param options - The options to add the mesh with
   */
  async addMeshFromURL(id: string, url: string, options: AddMeshFromURLOptions = {}) {
    this.throwUniqueID(id);

    const fileExt = url.trim().toLowerCase().split(".").pop();

    if (!(fileExt === "glb" || fileExt === "gltf")) {
      throw new Error("Mesh files must be glTF/glb.");
    }

    try {
      const loader = new GLTFLoader();
      const gltfContent = await loader.loadAsync(url);
      const mesh = options.transform ? new Object3D() : gltfContent.scene;

      if (options.transform) {
        const { rotation, offset } = options.transform;
        gltfContent.scene.name = `${id}_gltfContent_scene`;

        mesh.add(gltfContent.scene);

        if (rotation) {
          gltfContent.scene.rotation.set(rotation.x ?? 0, rotation.y ?? 0, rotation.z ?? 0);
        }
        if (offset) {
          gltfContent.scene.position.add(new Vector3(offset.x ?? 0, offset.y ?? 0, offset.z ?? 0));
        }
      }

      mesh.userData._originalUrl = url;

      return this.addMeshInternal({
        animations: gltfContent.animations,
        ...options,
        id,
        mesh,
        animationMode: options.animationMode ?? "continuous",
      });
    } catch (error) {
      console.error("Error adding mesh from URL", error);
      throw error;
    }
  }

  /**
   * Remove all the meshes and point lights of the scene.
   * @returns {Layer3D} The layer
   */
  public clear() {
    for (const [k, _item] of this.items3D) {
      this.removeMesh(k);
    }

    return this;
  }

  /**
   * Remove a mesh from the scene using its ID.
   * @param id - The ID of the mesh to remove
   * @returns {Layer3D} The layer
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

    return this;
  }

  /**
   * Traverse a Mesh/Group/Object3D to modify the opacities of the all the materials it finds
   * @param obj - The object to modify the opacities of
   * @param opacity - The opacity to set
   * @param forceRepaint - Whether to force a repaint
   * @returns {Layer3D} The layer
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

    return this;
  }

  /**
   * If a mesh is a point cloud, it defines the size of the points
   * @param obj - The object to modify the point size of
   * @param size - The size to set
   * @param forceRepaint - Whether to force a repaint
   * @returns {Layer3D} The layer
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

    return this;
  }

  /**
   * If a mesh can be rendered as wireframe, then the option is toggled according to the wireframe param
   * @param obj - The object to modify the wireframe of
   * @param wireframe - The wireframe to set
   * @param forceRepaint - Whether to force a repaint
   * @returns {Layer3D} The layer
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

    return this;
  }

  /**
   * Adding a point light. The default options are mimicking the sun:
   * lngLat: `[0, 0]` (null island)
   * altitude: `2_000_000` meters
   * altitudeReference: `AltitudeReference.MEAN_SEA_LEVEL`
   * color: `0xffffff` (white)
   * intensity: `75`
   * decay: `0.2`
   * @param id - The ID of the point light
   * @param options - The options to add the point light with
   * @returns {Layer3D} The layer
   */
  addPointLight(id: string, options: PointLightOptions = {}) {
    this.throwUniqueID(id);

    const pointLight = new PointLight(
      options.color ?? 0xffffff, // color
      options.intensity ?? 75, // intensity
      0, // distance (0 = no limit)
      options.decay ?? 0.2, // decay
    );

    this.addMeshInternal({
      id,
      mesh: pointLight,
      lngLat: options.lngLat ?? [0, 0],
      altitude: options.altitude ?? 2000000,
      altitudeReference: options.altitudeReference ?? AltitudeReference.MEAN_SEA_LEVEL,
    });

    return this;
  }

  /**
   * Throw an error if a mesh with such ID already exists
   * @param id - The ID of the mesh to throw an error for
   */
  private throwUniqueID(id: string) {
    if (this.items3D.has(id)) {
      throw new Error(`Mesh IDs are unique. A mesh or light with the id "${id}" already exist.`);
    }
  }
}
