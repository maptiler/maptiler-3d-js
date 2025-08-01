import type { CustomLayerInterface, CustomRenderMethodInput, Map as MapSDK } from "@maptiler/sdk";
import type { Camera, Scene } from "three";
import { WebGLRenderer } from "three";
import type { Layer3D } from "./Layer3D";

export class WebGLRenderManager {
  private map: MapSDK;
  private gl: WebGL2RenderingContext | WebGLRenderingContext;

  private layerData: Map<
    string,
    {
      layer: Layer3D;
      scene: Scene;
      camera: Camera;
    }
  > = new Map();

  private renderer: WebGLRenderer;
  private webGLManagerLayer: WebGLManagerLayer;

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
  }

  handleAddLayer(layer: Layer3D, scene: Scene, camera: Camera) {
    this.layerData.set(layer.id, {
      layer,
      scene,
      camera,
    });

    return this;
  }

  dispose(layerID: string) {
    this.layerData.delete(layerID);

    if (this.layerData.size === 0) {
      this.renderer.dispose();
      this.map.removeLayer(this.webGLManagerLayer.id);
    }
  }

  /**
   * Render all layers
   */
  render(options: CustomRenderMethodInput) {
    this.renderer.resetState();
    for (const { layer, scene, camera } of this.layerData.values()) {
      layer.prepareRender(options);
      this.renderer.render(scene, camera);
    }
  }

  clear() {
    this.renderer.clear();
  }
}

let webGLRenderManager: WebGLRenderManager | null = null;

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

export class WebGLManagerLayer implements CustomLayerInterface {
  public readonly id = "webgl-manager-layer";
  public readonly type = "custom";
  public readonly renderingMode = "3d";

  constructor(private webGLRenderManager: WebGLRenderManager) {}

  onAdd() {}
  onRemove() {}
  render(_gl: WebGLRenderingContext | WebGL2RenderingContext, options: CustomRenderMethodInput) {
    this.webGLRenderManager.render(options);
  }
}
