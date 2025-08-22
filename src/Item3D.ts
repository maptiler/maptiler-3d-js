import type { AnimationAction, AnimationClip, AnimationMixer, Group, Matrix4, Mesh, Object3D, Points, PointsMaterial } from "three";
import type { Layer3D } from "./Layer3D";
import { Evented, LngLat, type LngLatLike, type Map as MapSDK } from "@maptiler/sdk";
import { AltitudeReference, type AnimationLoopOptions, AnimationLoopOptionsMap, type AnimationMode, type MeshOptions, SourceOrientation } from "./types";
import { getTransformationMatrix } from "./utils";
import type { WebGLRenderManager } from "./WebGLRenderManager";
import { getItem3DEventTypesSymbol } from "./symbols";

export interface Item3DConstructorOptions {
  // the id of the item
  id: string;
  // the three.js mesh, group or object3d that is being rendered
  mesh: Mesh | Group | Object3D | null; 
  // the lngLat of the item
  lngLat: LngLat;
  // the altitude of the item
  altitude: number;
  // the scale of the item
  scale: number;
  // the heading of the item
  heading: number;
  // the source orientation of the item, can be "y-up" or "z-up"
  sourceOrientation: SourceOrientation;
  // the altitude reference of the item, can be "ground" or "sea"
  altitudeReference: AltitudeReference;
  // the url of the item, if the item is a model, this is the url of the model
  url: string | null;
  // the opacity of the item
  opacity: number;
  // the point size of the item
  pointSize: number;
  // the wireframe of the item
  wireframe: boolean;
  // the additional transformation matrix of the item, this is used to apply additional transformations to the item
  additionalTransformationMatrix: Matrix4;
  // the elevation of the item
  elevation: number;
  // the animation mixer of the item
  animationMixer?: AnimationMixer;
  // a map of the animation actions of the item
  animationMap?: Record<string, AnimationAction>;
  // the animation clips of the item
  animationClips?: AnimationClip[];
  // the animation mode of the item, can be "continuous" or "manual"
  // if "continuous", the animation will play continuously
  // if "manual", the animation needs to be manually updated by calling the `updateAnimation` method
  animationMode: AnimationMode;
};

export class Item3D extends Evented {
  public readonly id!: string
  // the Three.js mesh, group or object3d that is being rendered
  public readonly mesh: Mesh | Group | Object3D | null = null;
  // the lngLat of the item
  public lngLat!: LngLat;
  // the elevation of the item is the height of the ground below the model
  public elevation = 0;
  // the altitude of the item, altitude is the height of the model above the ground
  public altitude = 0;
  // the scale of the item
  public scale = 1;
  // the heading of the item, in degrees
  public heading = 0;
  // the source orientation of the item, can be "y-up" or "z-up"
  public sourceOrientation: SourceOrientation = SourceOrientation.Y_UP;
  // the altitude reference of the item, can be "ground" or "sea"
  public altitudeReference: AltitudeReference = AltitudeReference.GROUND;
  // the url of the item, if the item is a model, this is the url of the model
  public readonly url!: string | null;
  // the opacity of the item
  public opacity = 1;
  // whether the item is a wireframe
  public wireframe = false;
  // the animation mixer of the item
  private animationMixer: AnimationMixer | null = null;
  // the animation map of the item
  private animationMap: Record<string, AnimationAction> | null = null;
  // the animation clips of the item
  public animationClips: AnimationClip[] | null = null;
  // the animation mode of the item, can be "continuous" or "manual"
  // if "continuous", the animation will play continuously
  // if "manual", the animation needs to be manually updated by calling the `updateAnimation` method
  public animationMode: AnimationMode = "continuous";
  // the renderer of the item the singleton instance of WebGLRenderManager
  private renderer: WebGLRenderManager;

  // the additional transformation matrix of the item, this is used to apply additional transformations to the item
  public additionalTransformationMatrix!: Matrix4;

  // the map instance of the item
  private map: MapSDK;

  private parentLayer: Layer3D

  private nextUpdateTick: number | null = null;

  /**
   * The registered event types of the item
   * This is make sure that events are only fired for
   * this item and not for any other item in the layer
   * @private
   */
  private registeredEventTypes: string[] = [];

  constructor(parentLayer: Layer3D, options: Item3DConstructorOptions) {
    super();
    this.parentLayer = parentLayer;
    this.map = parentLayer.getMapInstance();
    this.renderer = parentLayer.getRendererInstance();
    Object.assign(this, options as Item3DConstructorOptions);
  }

  /**
   * Register an event listener for the item
   * @param event - The event to listen for
   * @param callback - The callback to call when the event is triggered
   * @returns {Item3D} The item
   */
  public override on(event: string, callback: (event: any) => void) {
    this.registeredEventTypes.push(event);
    return super.on(event, callback);
  }

  /**
   * Unregister an event listener for the item
   * @param event - The event to unregister
   * @param callback - The callback to unregister
   * @returns {Item3D} The item
   */
  public override off(event: string, callback: (event: any) => void) {
    this.registeredEventTypes = this.registeredEventTypes.filter((type) => type !== event);
    return super.off(event, callback);
  }

  /**
   * Get the registered event types of the item. This only used by the Layer3D class to check if an event is registered for this item.
   * @internal
   * @returns {string[]} The registered event types
   */
  [getItem3DEventTypesSymbol](): string[] {
    return this.registeredEventTypes;
  }

  /**
   * Modify the item with a set of options
   * @param options - The options to modify the item with
   * @returns {Item3D} The item
   */
  public modify(options: Partial<MeshOptions>) {
    if (!this.mesh) return this;

    let isTransformNeedUpdate = false;

    if (typeof options.visible === "boolean") {
      this.mesh.visible = options.visible;
    }

    if ("lngLat" in options) {
      this.lngLat = LngLat.convert(options.lngLat as LngLatLike);
      this.elevation = this.map.queryTerrainElevation(this.lngLat) || 0;
    }

    if (typeof options.scale === "number") {
      this.scale = options.scale;
      isTransformNeedUpdate = true;
    }

    if (typeof options.altitude === "number") {
      this.altitude = options.altitude;
    }

    if (typeof options.altitudeReference === "number") {
      this.altitudeReference = options.altitudeReference;
      this.elevation = this.map.queryTerrainElevation(this.lngLat) || 0;
    }

    if (typeof options.heading === "number") {
      this.heading = options.heading;
      isTransformNeedUpdate = true;
    }

    if (isTransformNeedUpdate === true) {
      this.additionalTransformationMatrix = getTransformationMatrix(this.scale, this.heading, this.sourceOrientation);
    }

    if (typeof options.opacity === "number") {
      this.setOpacity(options.opacity);
    }

    if (typeof options.pointSize === "number") {
      this.setPointSize(options.pointSize);
    }

    if (typeof options.wireframe === "boolean") {
      this.setWireframe(options.wireframe);
    }

    this.map.triggerRepaint();

    return this;
  }

  /**
   * Set the lngLat of the item
   * @param lngLat - The lngLat to set
   * @param cueRepaint - Whether to cue a repaint, if false, the repaint will be triggered when only the map is updated
   * @returns {Item3D} The item
   */
  public setLngLat(lngLat: LngLat, cueRepaint = true) {
    this.lngLat = lngLat;
    if (cueRepaint) this.cueUpdate();
    return this;
  }

  /**
   * Set the altitude of the item
   * @param altitude - The altitude to set
   * @param cueRepaint - Whether to cue a repaint, if false, the repaint will be triggered only when the map is updated
   * @returns {Item3D} The item
   */
  public setAltitude(altitude: number, cueRepaint = true) {
    this.altitude = altitude;
    if (cueRepaint) this.cueUpdate();
    return this;
  }

  /**
   * Set the elevation of the item
   * @param elevation - The elevation to set
   * @param cueRepaint - Whether to cue a repaint, if false, the repaint will be triggered only when the map is updated
   * @returns {Item3D} The item
   */
  public setElevation(elevation: number, cueRepaint = true) {
    // elevation is the height of the model at ground level,
    // eg the height of the ground below the model
    this.elevation = elevation;
    if (cueRepaint) this.cueUpdate();
    return this;
  }

  /**
   * Set the scale of the item
   * @param scale - The scale to set
   * @param cueRepaint - Whether to cue a repaint, if false, the repaint will be triggered only when the map is updated
   * @returns {Item3D} The item
   */
  public setScale(scale: number, cueRepaint = true) {
    this.scale = scale;
    this.applyTransformUpdate();
    if (cueRepaint) this.cueUpdate();
    return this;
  }

  /**
   * Set the heading of the item
   * @param heading - The heading to set
   * @param cueRepaint - Whether to cue a repaint, if false, the repaint will be triggered only when the map is updated
   * @returns {Item3D} The item
   */
  public setHeading(heading: number, cueRepaint = true) {
    this.heading = heading;
    this.applyTransformUpdate();
    if (cueRepaint) this.cueUpdate();
    return this;
  }

  /**
   * Set the source orientation of the item
   * @param sourceOrientation - The source orientation to set
   * @param cueRepaint - Whether to cue a repaint, if false, the repaint will be triggered only when the map is updated
   * @returns {Item3D} The item
   */
  public setSourceOrientation(sourceOrientation: SourceOrientation, cueRepaint = true) {
    this.sourceOrientation = sourceOrientation;
    if (cueRepaint) this.cueUpdate();
    return this;
  }

  /**
   * Set the altitude reference of the item
   * @param altitudeReference - The altitude reference to set
   * @param cueRepaint - Whether to cue a repaint, if false, the repaint will be triggered only when the map is updated
   * @returns {Item3D} The item
   */
  public setAltitudeReference(altitudeReference: AltitudeReference, cueRepaint = true) {
    this.altitudeReference = altitudeReference;
    if (cueRepaint) this.cueUpdate();
    return this;
  }

  /**
   * Set the wireframe of the item
   * @param wireframe - whether to set the wireframe of the item
   * @param cueRepaint - Whether to cue a repaint, if false, the repaint will be triggered only when the map is updated
   * @returns {Item3D} The item
   */
  public setWireframe(wireframe: boolean, cueRepaint = true) {
    this.mesh?.traverse((node) => {
      if ("isMesh" in node && node.isMesh === true) {
        const mesh = node as Mesh;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of materials) {
          if ("wireframe" in mat && typeof mat.wireframe === "boolean") mat.wireframe = wireframe;
        }
      }
    });

    if (cueRepaint) this.cueUpdate();

    return this;
  }

  /**
   * Apply a transform update to the item
   * @private
   */
  private applyTransformUpdate() {
    this.additionalTransformationMatrix = getTransformationMatrix(this.scale, this.heading, this.sourceOrientation);
  }


  /**
   * Traverse a Mesh/Group/Object3D to modify the opacities of the all the materials it finds
   * @param obj - The object to modify the opacities of
   * @param opacity - The opacity to set
   * @param cueRepaint - whether to cue a repaint, if false, the repaint will be triggered when only the map is updated
   * @returns {Layer3D} The layer
   */
  public setOpacity(opacity: number, cueRepaint = true) {
    this.mesh?.traverse((node) => {
      if (("isMesh" in node && node.isMesh === true) || ("isPoints" in node && node.isPoints === true)) {
        const mesh = node as Mesh;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of materials) {
          mat.opacity = opacity;
          mat.transparent = true;
        }
      }
    });

    if (cueRepaint) this.cueUpdate();

    return this;
  }

  /**
   * If a mesh is a point cloud, it defines the size of the points
   * @param obj - The object to modify the point size of
   * @param size - The size to set
   * @param cueRepaint - whether to cue a repaint, if false, the repaint will be triggered when only the map is updated
   * @returns {Layer3D} The layer
   */
  public setPointSize(size: number, cueRepaint = true) {
    this.mesh?.traverse((node) => {
      if ("isPoints" in node && node.isPoints === true) {
        const mesh = node as Points;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of materials) {
          (mat as PointsMaterial).size = size;
        }
      }
    });

    if (cueRepaint) this.cueUpdate();

    return this;
  }


  /**
   * Play an animation
   * @param meshId - The ID of the mesh
   * @param animationName - The name of the animation to play
   * @param {AnimationLoopOptions} loop - The loop type of the animation, can either be "loop", "once" or "pingPong"
   */
  public playAnimation(animationName: string, loop?: AnimationLoopOptions) {
    if (!this.mesh) return;

    const animation = this.animationMap?.[animationName] ?? null;

    if (!animation) return;

    animation.play();
    animation.paused = false;

    if (loop) {
      const loopType = AnimationLoopOptionsMap[loop];
      animation.loop = loopType ?? null;
    }

    if (this.animationMode === "continuous") {
      this.renderer.addAnimationLoop(`${this.parentLayer.id}_${this.id}_${animationName}`, () => this.animate());
    }

    return this;
  }

  /**
   * Get an animation by name
   * @param meshId - The ID of the mesh
   * @param animationName - The name of the animation to get
   * @returns {AnimationAction | null} The animation action or null if not found
   */
  public getAnimation(animationName: string): AnimationAction | null {
    if (!this.mesh) return null;
    return this.animationMap?.[animationName] ?? null;
  }

  /**
   * Pause an animation
   * @param meshId - The ID of the mesh
   * @param animationName - The name of the animation to pause
   */
  public pauseAnimation(animationName: string) {
    if (!this.mesh) return;

    const animation = this.animationMap?.[animationName] ?? null;

    if (!animation) return;

    animation.paused = true;

    return this;
  }

  /**
   * Stop an animation
   * @param meshId - The ID of the mesh
   * @param animationName - The name of the animation to stop
   */
  public stopAnimation(animationName: string) {
    if (!this.animationMap) return;
    if (!this.mesh) return;

    const animation = this.animationMap?.[animationName] ?? null;

    if (!animation) return;
    this.renderer.removeAnimationLoop(`${this.parentLayer.id}_${this.id}_${animationName}`);

    return this;
  }

  /**
   * Get the names of the animations of a mesh
   * @param meshId - The ID of the mesh
   * @returns {string[]} The names of all the animations of the mesh
   */
  public getAnimationNames(): string[] {
    if (!this.animationMap) return [];

    return Object.keys(this.animationMap ?? {});
  }

  /**
   * Update the animation of a mesh by a delta time
   * @param meshId - The ID of the mesh
   * @param delta - The delta time to update the animation by
   */
  public updateAnimation(delta = 0.02) {
    if (!this.mesh) return;
    if (!this.animationMixer) return;
    const mixer = this.animationMixer;

    if (!mixer) return;

    mixer.update(delta);
    this.map.triggerRepaint();
  }

  /**
   * Set the time of an animation to a specific time
   * @param meshId - The ID of the mesh
   * @param time - The time to set the animation to
   */
  public setAnimationTime(time: number) {
    if (!this.mesh) return;
    if (!this.animationMixer) return;
    const mixer = this.animationMixer;
    if (!mixer) return;

    mixer.setTime(time);
    this.map.triggerRepaint();
  }

    /**
   * The callback used to animate the scene
   * @private
   * @param manual - Whether the animation is being called manually or by the renderer
   */
    private animate(manual = false) {
      const delta = manual ? 0.001 : this.parentLayer.clock.getDelta();
      if (this.animationMixer && this.animationMode === "continuous") {
        this.animationMixer.update(delta);
      }
  
      if (this.animationMode === "continuous") {
        this.map.triggerRepaint();
      }
    }

  /**
   * Cue a repaint of the item
   * This used to avoid 
   * @private
   */
    private cueUpdate() {
      if (this.nextUpdateTick) return;

      this.nextUpdateTick = requestAnimationFrame(() => {
        this.map.triggerRepaint();
        this.nextUpdateTick = null;
      });
    }
};
