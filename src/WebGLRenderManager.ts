/**
 * @module WebGLRenderManager
 * This module provides a manager for orchestrating the rendering of multiple 3D layers
 * on a MapTiler Map using THREE.js. It handles the creation of a single WebGLRenderer,
 * manages scenes, cameras, and animation loops for multiple layers, and integrates
 * into the MapTiler SDK's custom layer interface.
 */
import type { CustomLayerInterface, CustomRenderMethodInput, Map as MapSDK } from "@maptiler/sdk";
import type { Camera, Scene } from "three";
import { WebGLRenderer } from "three";
import type { Layer3D } from "./Layer3D";

/**
 * Manages the WebGL rendering for all 3D layers on the map.
 * This class is responsible for setting up the THREE.js WebGLRenderer,
 * adding and removing layers, and running the animation loop.
 * It ensures that all 3D content is rendered by a single ThreeJS renderer.
 */
export class WebGLRenderManager {
  /**
   * The MapTiler SDK Map instance.
   * @type {MapSDK}
   */
  private map: MapSDK;

  /**
   * The WebGL rendering context.
   * @type {WebGL2RenderingContext | WebGLRenderingContext}
   */
  private gl: WebGL2RenderingContext | WebGLRenderingContext;

  /**
   * A map of animation loops, keyed by a unique ID.
   * These loops are executed on every frame.
   * @type {Map<string, () => void>}
   */
  private animationLoops: Map<string, () => void> = new Map();

  /**
   * A map storing data for each 3D layer, including the layer instance,
   * its THREE.js scene, and camera.
   * @type {Map<string, { layer: Layer3D; scene: Scene; camera: Camera }>}
   */
  private layerData: Map<
    string,
    {
      layer: Layer3D;
      scene: Scene;
      camera: Camera;
    }
  > = new Map();

  /**
   * The THREE.js WebGL renderer.
   * @type {WebGLRenderer}
   */
  private renderer: WebGLRenderer;

  /**
   * The custom layer that integrates the WebGLRenderManager with the MapTiler SDK.
   * @type {WebGLManagerLayer}
   */
  private webGLManagerLayer: WebGLManagerLayer;

  /**
   * Constructs a new WebGLRenderManager.
   * @param {object} options - The options for initialization.
   * @param {MapSDK} options.map - The MapTiler SDK map instance.
   * @param {WebGL2RenderingContext | WebGLRenderingContext} options.gl - The WebGL rendering context from the map.
   */
  constructor({
    map,
    gl,
  }: {
    map: MapSDK;
    gl: WebGL2RenderingContext | WebGLRenderingContext;
  }) {
    if (!gl) {
      throw new Error("A WebGL or WebGL2 context is required to initialize the WebGLRenderManager");
    }

    this.gl = gl;

    if (!map) {
      throw new Error("A MapTiler SDK instance is required to initialize the WebGLRenderManager");
    }

    this.map = map;

    this.renderer = new WebGLRenderer({
      canvas: this.map.getCanvas(),
      context: this.gl,
      antialias: true,
      powerPreference: "high-performance",
    });

    this.renderer.autoClear = false;

    this.webGLManagerLayer = new WebGLManagerLayer(this);

    if (!this.map.getLayer(this.webGLManagerLayer.id)) {
      this.map.addLayer(this.webGLManagerLayer);
    }

    this.animate = this.animate.bind(this);

    this.renderer.setAnimationLoop(this.animate);
  }

  /**
   * Adds a 3D layer to be managed and rendered.
   * @param {Layer3D} layer - The 3D layer to add.
   * @param {Scene} scene - The THREE.js scene associated with the layer.
   * @param {Camera} camera - The THREE.js camera associated with the layer.
   * @returns {this} The instance of the WebGLRenderManager.
   */
  handleAddLayer(layer: Layer3D, scene: Scene, camera: Camera) {
    this.layerData.set(layer.id, {
      layer,
      scene,
      camera,
    });

    return this;
  }

  /**
   * Disposes of a layer's resources and removes it from the manager.
   * If it's the last layer, it cleans up the renderer and removes the manager layer from the map.
   * @param {string} layerID - The ID of the layer to dispose of.
   */
  dispose(layerID: string) {
    this.layerData.delete(layerID);

    if (this.layerData.size === 0) {
      this.renderer.dispose();
      this.map.removeLayer(this.webGLManagerLayer.id);
    }
  }

  /**
   * The main animation loop that runs on every frame.
   * It executes all registered animation callbacks.
   */
  animate() {
    for (const loop of this.animationLoops.values()) {
      loop();
    }
  }

  /**
   * Adds an animation loop for a specific layer.
   * @param {string} animationID - A unique ID for the animation.
   * @param {() => void} callback - The function to call on each animation frame.
   */
  addAnimationLoop(animationID: string, callback: () => void) {
    if (this.animationLoops.has(animationID)) {
      return;
    }

    this.animationLoops.set(animationID, callback);
  }

  /**
   * Removes an animation loop associated with a layer.
   * @param {string} layerID - The ID of the layer whose animation loop should be removed.
   */
  removeAnimationLoop(layerID: string) {
    const layer = this.layerData.get(layerID);
    if (!layer) return;

    this.animationLoops.delete(layerID);
  }

  /**
   * Renders all managed 3D layers. This is called by the `WebGLManagerLayer`.
   * @param {CustomRenderMethodInput} options - The render options provided by the MapTiler SDK.
   */
  render(options: CustomRenderMethodInput) {
    this.renderer.resetState();
    for (const { layer, scene, camera } of this.layerData.values()) {
      layer.prepareRender(options);
      this.renderer.render(scene, camera);
    }
  }

  /**
   * Clears the renderer's buffers.
   */
  clear() {
    this.renderer.clear();
  }
}

/**
 * Singleton instance of the WebGLRenderManager.
 * @type {WebGLRenderManager | null}
 */
let webGLRenderManager: WebGLRenderManager | null = null;

/**
 * Factory function to get the singleton WebGLRenderManager and add a layer to it.
 * If the manager doesn't exist, it creates one.
 * @param {object} options - The options for adding the layer.
 * @param {MapSDK} options.map - The MapTiler SDK map instance.
 * @param {WebGL2RenderingContext | WebGLRenderingContext} options.gl - The WebGL rendering context.
 * @param {Layer3D} options.layer - The 3D layer to add.
 * @param {Scene} options.scene - The THREE.js scene for the layer.
 * @param {Camera} options.camera - The THREE.js camera for the layer.
 * @returns {WebGLRenderManager} The WebGLRenderManager instance.
 */
export default function addLayerToWebGLRenderManager({
  map,
  gl,
  layer,
  scene,
  camera,
}: {
  map: MapSDK;
  gl: WebGL2RenderingContext | WebGLRenderingContext;
  layer: Layer3D;
  scene: Scene;
  camera: Camera;
}) {
  if (!webGLRenderManager) {
    webGLRenderManager = new WebGLRenderManager({
      map,
      gl,
    });
  }

  return webGLRenderManager.handleAddLayer(layer, scene, camera);
}

/**
 * A custom layer for the MapTiler SDK that integrates the WebGLRenderManager
 * into the map's rendering pipeline. This layer's `render` method is called
 * by the map on every frame, which in turn calls the `render` method of the
 * WebGLRenderManager.
 */
export class WebGLManagerLayer implements CustomLayerInterface {
  public readonly id = "webgl-manager-layer";
  public readonly type = "custom";
  public readonly renderingMode = "3d";

  /**
   * Constructs a new WebGLManagerLayer.
   * @param {WebGLRenderManager} webGLRenderManager - The WebGLRenderManager instance to use for rendering.
   */
  constructor(private webGLRenderManager: WebGLRenderManager) {}

  /**
   * Called when the layer is added to the map. (No-op)
   */
  onAdd() {}

  /**
   * Called when the layer is removed from the map. (No-op)
   */
  onRemove() {}

  /**
   * Called by the map to render the layer.
   * @param {WebGLRenderingContext | WebGL2RenderingContext} _gl - The WebGL context (unused).
   * @param {CustomRenderMethodInput} options - The render options from the map.
   */
  render(_gl: WebGLRenderingContext | WebGL2RenderingContext, options: CustomRenderMethodInput) {
    this.webGLRenderManager.render(options);
  }
}
