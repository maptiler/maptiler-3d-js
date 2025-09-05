import type {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  Group,
  Matrix4,
  Mesh,
  Object3D,
  Points,
  PointsMaterial,
} from "three";
import type { Layer3D } from "./Layer3D";
import { Evented, LngLat, type LngLatLike, type Map as MapSDK } from "@maptiler/sdk";
import {
  type AnimationLoopOptions,
  type AnimationMode,
  type Item3DMeshUIStates,
  type MeshOptions,
  type Item3DMeshUIStateName,
  type Item3DMeshUIStateProperties,
  type Item3DEventTypes,
  type Item3DTransform,
  AltitudeReference,
  AnimationLoopOptionsMap,
  SourceOrientation,
  item3DStatePropertiesNames,
} from "./types";
import { getTransformationMatrix } from "./utils";
import type { WebGLRenderManager } from "./WebGLRenderManager";
import { getItem3DEventTypesSymbol } from "./symbols";
import { USE_DEBUG_LOGS } from "./config";

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
  scale: number | [number, number, number];
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
  // the states of the item
  states: Item3DMeshUIStates;

  // custom meta data that the user can add to the item
  userData: Record<string, any>;
}

const item3DStateEventMap = new Map<
  Item3DMeshUIStateName,
  { activate: Item3DEventTypes; deactivate: Item3DEventTypes }
>([
  [
    "hover" as Item3DMeshUIStateName,
    {
      activate: "mouseenter",
      deactivate: "mouseleave",
    },
  ],
  [
    "active" as Item3DMeshUIStateName,
    {
      activate: "mousedown",
      deactivate: "mouseup",
    },
  ],
  [
    "selected" as Item3DMeshUIStateName,
    {
      activate: "click",
      deactivate: "click",
    },
  ],
]);

const item3DSetStatePropertyToMethodMap = new Map<keyof Item3DMeshUIStateProperties, keyof Item3D>([
  ["opacity", "setOpacity"],
  ["scale", "setRelativeScale"],
  ["heading", "setHeading"],
  ["altitude", "setAltitude"],
  ["lngLat", "setLngLat"],
  ["wireframe", "setWireframe"],
  ["pointSize", "setPointSize"],
  ["elevation", "setElevation"],
  ["transform", "setTransform"],
]);

const item3DStateToInstancePropertyMap = new Map([
  ["scale", "relativeScale"],
  ["opacity", "opacity"],
  ["heading", "heading"],
  ["altitude", "altitude"],
  ["lngLat", "lngLat"],
  ["wireframe", "wireframe"],
  ["pointSize", "pointSize"],
  ["elevation", "elevation"],
  ["transform", "transform"],
]);

export const item3DDefaultValuesMap = new Map<keyof Item3DMeshUIStateProperties | "relativeScale", any>([
  ["opacity", 1],
  ["scale", [1, 1, 1]],
  ["relativeScale", [1, 1, 1]],
  ["heading", 0],
  ["altitude", 0],
  ["lngLat", new LngLat(0, 0)],
  ["wireframe", false],
  ["pointSize", 1],
  ["elevation", 0],
  ["transform", createDefaultTransform()],
]);

export class Item3D extends Evented {
  public readonly id!: string;
  // the Three.js mesh, group or object3d that is being rendered
  public readonly mesh: Mesh | Group | Object3D | null = null;
  // the lngLat of the item
  public lngLat!: LngLat;
  // the elevation of the item is the height of the ground below the model
  public elevation = 0;
  // the altitude of the item, altitude is the height of the model above the ground
  public altitude = 0;
  // the scale of the item
  public scale: [number, number, number] = [1, 1, 1];

  // the relative scale of the item, this is the scale of the item relative to the parent layer
  // it used internally for hover and UI states
  private relativeScale: [number, number, number] = [1, 1, 1];

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
  // the point size of the item
  public pointSize = 1;

  // the default state of the item
  public transform: Item3DTransform = createDefaultTransform();

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

  // the parent layer of the item
  private parentLayer: Layer3D;

  // the next update tick of the item
  private nextUpdateTick: number | null = null;

  // the user data of the item
  // this is used to store any custom data that the user wants
  public userData: Record<string, any> = {};

  /**
   * The registered event types of the item
   * This is make sure that events are only fired for
   * this item and not for any other item in the layer
   * @private
   */
  private registeredEventTypes: string[] = [];

  /**
   * A Map of the current states of the item, hover, active, etc.
   * These states are used to modify the item in real time, eg on hover the item can be scaled up, or on selected the item can be highlighted
   */
  private currentStates: Map<Item3DMeshUIStateName, { props: Item3DMeshUIStateProperties; cleanup: () => void }> =
    new Map();

  constructor(parentLayer: Layer3D, { scale, states, ...options }: Item3DConstructorOptions) {
    super();
    this.parentLayer = parentLayer;
    this.map = parentLayer.getMapInstance();
    this.renderer = parentLayer.getRendererInstance();
    this.scale = Array.isArray(scale) ? scale : [scale, scale, scale];

    this.setStates(states);

    Object.assign(this, options as Item3DConstructorOptions);

    this.initDefaultState();
  }

  /**
   * Initialize the default state of the item.
   * This is called when the item is created and sets the default state of the item.
   * @private
   */
  private initDefaultState() {
    const defaultState = item3DStatePropertiesNames.reduce((acc, key) => {
      const accKey = key as keyof Item3DMeshUIStateProperties;

      const value = this.getInitValueForProperty(accKey);

      if (typeof value !== "undefined") {
        (acc as any)[accKey] = value;
      }

      return acc;
    }, {} as Item3DMeshUIStateProperties);

    this.currentStates.set("default", {
      props: defaultState as Item3DMeshUIStateProperties,
      cleanup: () => {},
    });
  }

  /**
   * Register an event listener for the item
   * @param event - The event to listen for
   * @param callback - The callback to call when the event is triggered
   * @returns {Item3D} The item
   */
  public override on(event: Item3DEventTypes, callback: (event: any) => void) {
    this.registeredEventTypes.push(event);
    return super.on(event, callback);
  }

  /**
   * Unregister an event listener for the item
   * @param event - The event to unregister
   * @param callback - The callback to unregister
   * @returns {Item3D} The item
   */
  public override off(event: Item3DEventTypes, callback: (event: any) => void) {
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
   * A stack of the active states applied.
   * This is used to ensure that the active state fallsback to the last state applied.
   * Eg if the object is hovered ("hover state"), and then the user clicks on it ("active state"), when the mouse comes up
   * the object should revert to the hover state, _not_ to the default state.
   * Think of this as akin to the DOM `classList` property
   * @private
   */
  private activeStates: Item3DMeshUIStateName[] = ["default"];

  /**
   * Set the active state of the item.
   * @param stateName - The name of the state to set
   * @private
   */
  private addActiveState(stateName: Item3DMeshUIStateName) {
    if (this.activeStates.includes(stateName)) {
      return;
    }

    this.activeStates.push(stateName);
  }

  /**
   * Remove the active state of the item.
   * @param name - The name of the state to remove
   * @private
   */
  private removeActiveState(name: Item3DMeshUIStateName) {
    this.activeStates = this.activeStates.filter((state) => state !== name);
  }

  /**
   * Add a state change handler to the item.
   * This method maps the state (eg "hover") to its relevant events (eg "mouseenter", "mouseleave")
   * and applies the state properties to the item via the appropriate methods.
   * @param name - The name of the state to add
   * @param props - The properties of the state
   * @private
   */
  private addItem3DStateChangeHandler(name: Item3DMeshUIStateName, props: Item3DMeshUIStateProperties) {
    const handlerEventNames = item3DStateEventMap.get(name);
    if (!handlerEventNames || name === "default") return () => {};

    /**
     * Set the active state of the item.
     * This is called when the state is activated eg on mouseenter, or on mousedown.
     */
    const commitActiveState = () => {
      this.addActiveState(name);
      const sumOfAllStatesProps = this.activeStates
        .map((name) => [name, this.currentStates.get(name)?.props ?? {}])
        .reduce((acc, stateProps) => {
          Object.assign(acc, stateProps, props);
          return acc;
        }, {} as Item3DMeshUIStateProperties);

      // iterate over the properties, map to the correct method and call it
      for (const [propertyName, propertyValue] of Object.entries(sumOfAllStatesProps)) {
        const propName = propertyName as keyof Item3DMeshUIStateProperties;
        const methodName = item3DSetStatePropertyToMethodMap.get(propName);
        const method = this[methodName as keyof Item3D];

        if (method && typeof propertyValue !== "undefined") {
          // call the method with the property value and cue a repaint
          method.call(this, propertyValue, true);
        } else {
          if (USE_DEBUG_LOGS)
            console.warn(
              `Item3D: Method ${String(methodName)} not found for setting property "${propertyName}" in ${name} state`,
            );
        }
      }
    };

    /**
     * Set the inactive state of the item.
     * This is called when the state is deactivated eg on "mouseleave", or on "mouseup".
     */
    const commitInactiveState = () => {
      this.removeActiveState(name);

      const sumOfAllStates = this.activeStates
        .map((name) => this.currentStates.get(name)?.props ?? {})
        .reduce((acc, stateProps) => {
          Object.assign(acc, stateProps);
          return acc;
        }, {} as Item3DMeshUIStateProperties);

      // iterate over the properties, map to the correct method and call it
      for (const [propertyName, propertyValue] of Object.entries(sumOfAllStates ?? {})) {
        const methodName = item3DSetStatePropertyToMethodMap.get(propertyName as keyof Item3DMeshUIStateProperties);
        const method = this[methodName as keyof Item3D];
        if (method) {
          // call the method with the property value and cue a repaint
          method.call(this, propertyValue, true);
        } else {
          if (USE_DEBUG_LOGS)
            console.warn(
              `Item3D: Method ${String(methodName)} not found for setting property "${propertyName}" in ${name} state`,
            );
        }
      }
    };

    // add the activate event listener
    this.on(handlerEventNames.activate as Item3DEventTypes, commitActiveState);

    // add the deactivate event listener
    this.on(handlerEventNames.deactivate as Item3DEventTypes, commitInactiveState);

    /**
     * Cleanup the state change handler.
     * This is called when the state is removed.
     */
    const cleanup = () => {
      this.off(handlerEventNames.activate as Item3DEventTypes, commitActiveState);
      this.off(handlerEventNames.deactivate as Item3DEventTypes, commitInactiveState);
      commitInactiveState();
    };

    return cleanup;
  }

  /**
   * Maps the state config to the internal state Map, set up handlers and store the state and cleanup function.
   * This is only used on Item3D construction to set the initial states but can be called publicly.
   * @param stateUpdate - The states to set
   * @returns {Item3D} The item
   */
  public setStates(stateUpdate: Item3DMeshUIStates | ((currentState: Item3DMeshUIStates) => Item3DMeshUIStates)) {
    const currentState = Array.from(this.currentStates)
      .map(([name, { props }]) => ({ name, props }))
      .reduce((acc, { name, props }) => {
        acc[name] = props;
        return acc;
      }, {} as Item3DMeshUIStates);

    const states = typeof stateUpdate === "function" ? stateUpdate(currentState) : stateUpdate;

    for (const [name, state] of Object.entries(states)) {
      const cleanup = this.addItem3DStateChangeHandler(name as Item3DMeshUIStateName, state);
      this.currentStates.set(name as Item3DMeshUIStateName, { props: state, cleanup });
    }

    return this;
  }

  /**
   * Get the default value for a property.
   * @param propertyName - The name of the property to get the default value for
   * @returns {any} The default value for the property
   */
  private getInitValueForProperty(propertyName: keyof Item3DMeshUIStateProperties) {
    const internalPropertyName = item3DStateToInstancePropertyMap.get(propertyName) as keyof this;
    const value = this[internalPropertyName];
    if (!value) {
      if (USE_DEBUG_LOGS) console.warn(`Item3D: Property "${String(propertyName)}" not found on item "${this.id}"`);
      return undefined;
    }

    return value;
  }

  /**
   * Add a state to the item.
   * @param name - The name of the state to add
   * @param state - The state to add
   * @returns {Item3D} The item
   */
  public addState(name: Item3DMeshUIStateName, state: Item3DMeshUIStateProperties) {
    const cleanup = this.addItem3DStateChangeHandler(name, state);
    this.currentStates.set(name, { props: state, cleanup });
    return this;
  }

  /**
   * Remove a state from the item and calls the cleanup function.
   * @param name - The name of the state to remove
   * @returns {Item3D} The item
   */
  public removeState(name: Item3DMeshUIStateName) {
    const cleanup = this.currentStates.get(name)?.cleanup;
    if (cleanup) cleanup();
    this.currentStates.delete(name);
    return this;
  }

  /**
   * Set the transform of the item
   * @param transform - The transform to set
   * @returns {Item3D} The item
   */
  public setTransform(transform?: Partial<Item3DTransform>) {
    if (!transform) {
      this.transform = createDefaultTransform();
      return this;
    }

    this.transform = {
      ...this.transform,
      ...transform,
    };

    return this;
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
      this.scale = [options.scale, options.scale, options.scale];
      isTransformNeedUpdate = true;
    }

    if (Array.isArray(options.scale)) {
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
      this.applyTransformUpdate();
    }

    if (typeof options.opacity === "number") {
      this.setOpacity(options.opacity, false);
    }

    if (typeof options.pointSize === "number") {
      this.setPointSize(options.pointSize, false);
    }

    if (typeof options.wireframe === "boolean") {
      this.setWireframe(options.wireframe, false);
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
   * Set the relative scale of the item. The relative scale is the scale of the item relative to it's original scale.
   * This is used internally to scale the item up or down from a state, but can also be called publicly to scale the item.
   * @param scale - The scale to set
   * @param cueRepaint - Whether to cue a repaint, if false, the repaint will be triggered only when the map is updated
   * @returns {Item3D} The item
   */
  public setRelativeScale(scale: number | [number, number, number], cueRepaint = true) {
    if (typeof scale !== "number" && !Array.isArray(scale)) {
      throw new Error("Scale must be a number or an array of three numbers");
    }

    this.relativeScale = (Array.isArray(scale) ? scale : [scale, scale, scale]) as [number, number, number];
    this.applyTransformUpdate();
    if (cueRepaint) this.cueUpdate();
    return this;
  }

  /**
   * Set the absolute scale of the item. The absolute scale is the scale of the item relative to the map.
   * @param scale - The scale to set
   * @param cueRepaint - Whether to cue a repaint, if false, the repaint will be triggered only when the map is updated
   * @returns {Item3D} The item
   */
  public setScale(scale: number | [number, number, number], cueRepaint = true) {
    if (typeof scale !== "number" && !Array.isArray(scale)) {
      throw new Error("Scale must be a number or an array of three numbers");
    }

    this.scale = Array.isArray(scale) ? scale : [scale, scale, scale];

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
  public setWireframe(wireframe?: boolean, cueRepaint = true) {
    const wireframeValue = Boolean(wireframe);
    this.mesh?.traverse((node) => {
      if ("isMesh" in node && node.isMesh === true) {
        const mesh = node as Mesh;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of materials) {
          if ("wireframe" in mat && typeof mat.wireframe === "boolean") {
            mat.wireframe = wireframeValue;
            mat.needsUpdate = true;
          }
        }
      }
    });

    this.wireframe = wireframeValue;

    if (cueRepaint) this.cueUpdate();

    return this;
  }

  /**
   * Apply a transform update to the item
   * @private
   */
  private applyTransformUpdate() {
    const scale = this.relativeScale.map((s, i) => s * this.scale[i]) as [number, number, number];
    this.additionalTransformationMatrix = getTransformationMatrix(scale, this.heading, this.sourceOrientation);
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
          mat.needsUpdate = true;
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

    this.pointSize = size;

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
}

function createDefaultTransform(): Item3DTransform {
  return {
    rotation: {
      x: 0,
      y: 0,
      z: 0,
    },
    translate: {
      x: 0,
      y: 0,
      z: 0,
    },
  };
}
