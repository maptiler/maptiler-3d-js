import {
  type AnimationAction,
  type AnimationClip,
  type AnimationMixer,
  Box3,
  Box3Helper,
  type BufferAttribute,
  type Group,
  type Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  type Points,
  type PointsMaterial,
  Sphere,
  SphereGeometry,
  Vector3,
} from "three";
import type { Layer3D } from "./Layer3D";
import { Evented, LngLat, type LngLatLike, type Map as MapSDK } from "@maptiler/sdk";
import { math } from "@maptiler/client";
import {
  type AnimationLoopOptions,
  type AnimationMode,
  type CloneMeshOptions,
  type Item3DMeshUIStates,
  type MeshOptions,
  type Item3DMeshUIStateName,
  type Item3DMeshUIStateProperties,
  type Item3DEventTypes,
  type Item3DTransform,
  type Position3D,
  AltitudeReference,
  AnimationLoopOptionsMap,
  SourceOrientation,
  item3DStatePropertiesNames,
} from "./types";
import { convertUnitsToMeters, degreesToRadians, getTransformationMatrix } from "./utils";
import type { WebGLRenderManager } from "./WebGLRenderManager";
import { getItem3DEventTypesSymbol, getItem3DDollySymbol, removeItem3DFromIndexSymbol } from "./symbols";
import { USE_DEBUG_LOGS } from "./config";
import { OBB } from "three/examples/jsm/math/OBB";

const { EARTH_RADIUS } = math;

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
  // the pitch of the item in degrees
  pitch?: number;
  // the roll of the item
  roll?: number;
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
  ["pitch", "setPitch"],
  ["roll", "setRoll"],
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
  ["pitch", 0],
  ["roll", 0],
  ["altitude", 0],
  ["lngLat", new LngLat(0, 0)],
  ["wireframe", false],
  ["pointSize", 1],
  ["elevation", 0],
  ["transform", createDefaultTransform()],
]);

export class Item3D extends Evented {
  /**
   * The id of the item, this is used to identify the item in the layer and set in the constructor
   * when the item is created in the Layer3D class
   * @see {Layer3D#addMesh}
   * @see {Layer3D#getItem3D}
   * @see {Layer3D#addMeshFromUrl}
   */
  public readonly id!: string;
  /**
   * The Three.js mesh, group or object3d that is being rendered
   * @see {Mesh} https://threejs.org/docs/#api/en/objects/Mesh
   * @see {Group} https://threejs.org/docs/#api/en/objects/Group
   * @see {Object3D} https://threejs.org/docs/#api/en/core/Object3D
   */
  public readonly mesh: Mesh | Group | Object3D | null = null;

  /**
   * The dolly of the item, this is used to apply pitch, heading and roll.
   * @see {Object3D} https://threejs.org/docs/#api/en/core/Object3D
   */
  private dolly: Object3D | null = null;

  /**
   * Get the dolly of the item
   * @returns {Object3D | null} The dolly
   */
  [getItem3DDollySymbol](): Object3D | null {
    return this.dolly;
  }

  /**
   * The lngLat of the item
   * @see {LngLat} https://docs.maptiler.com/sdk-js/api/geography/#lnglat
   */
  public lngLat!: LngLat;
  /**
   * Elevation is the height of the model at ground level, this is used to calculate the altitude / transform of the item
   */
  public elevation = 0;
  /**
   * The altitude of the item, altitude is the height of the model above the ground
   */
  public altitude = 0;
  /**
   * The scale of the item [x, y, z].
   */
  public scale: [number, number, number] = [1, 1, 1];

  /**
   * The relative scale of the item, this is used internally in the states. 1.5 == 150% the original scale
   */
  private relativeScale: [number, number, number] = [1, 1, 1];

  /**
   * The heading of the item, in degrees
   */
  public heading = 0;
  /**
   * The pitch of the item, in degrees
   */
  public pitch = 0;

  /**
   * The roll of the item, in degrees
   */
  public roll = 0;
  /**
   * The source orientation of the item, can be "y-up" or "z-up"
   */
  public sourceOrientation: SourceOrientation = SourceOrientation.Y_UP;
  /**
   * The altitude reference of the item, can be "ground" or "sea"
   */
  public altitudeReference: AltitudeReference = AltitudeReference.GROUND;
  /**
   * The url of the item, if the item is a model, this is the url of the model
   */
  public readonly url!: string | null;
  /**
   * The opacity of the item
   */
  public opacity = 1;
  /**
   * Whether the item is rendering as a wireframe
   */
  public wireframe = false;
  /**
   * The point size of the item (if drawing points)
   */
  public pointSize = 1;

  /**
   * The default state of the item, used for UI states
   * @type {Item3DTransform}
   */
  public transform: Item3DTransform = createDefaultTransform();

  /**
   * The animation mixer of the item
   * @type {AnimationMixer | null}
   */
  private animationMixer: AnimationMixer | null = null;
  /**
   * The animation map of the item
   */
  private animationMap: Record<string, AnimationAction> | null = null;
  /**
   * The animation clips of the item
   * @see {AnimationClip} https://threejs.org/docs/#api/en/animation/AnimationClip
   */
  public animationClips: AnimationClip[] | null = null;
  /**
   * The animation mode of the item, can be "continuous" or "manual"
   * if "continuous", the animation will play continuously
   * if "manual", the animation needs to be manually updated by calling the `updateAnimation` method
   */
  public animationMode: AnimationMode = "continuous";

  /**
   * When true, renders bounding boxes and bounding spheres for each internal mesh (for debugging).
   */
  public get debug(): boolean {
    return this._debug;
  }
  public set debug(value: boolean) {
    if (this._debug === value) return;
    this._debug = value;
    this.updateDebugHelpers();
  }
  private _debug = false;

  /** Debug helpers (box/sphere) added as children of meshes when debug is true. */
  private debugHelpers: Object3D[] = [];

  /**
   * The renderer of the item the singleton instance of WebGLRenderManager
   */
  private renderer: WebGLRenderManager;

  /**
   * The additional transformation matrix of the item, this is used to apply additional transformations to the item
   */
  public additionalTransformationMatrix!: Matrix4;

  /**
   * The map instance of the item
   */
  private map: MapSDK;

  /**
   * The parent layer of the item
   */
  private parentLayer: Layer3D;

  /**
   * The next update tick of the item
   */
  private nextUpdateTick: number | null = null;

  /**
   * Custom user data of the item
   * This can be used to store any custom data that the user wants
   */
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

    this.initLocalOBB();

    this.initDefaultState();

    this.applyTransformUpdate();
    this.createDollyForMesh();

    this.updateGroupBoundsIfNeeded();

    if (this.debug) this.updateDebugHelpers();
  }

  private createDollyForMesh() {
    if (!this.mesh) return;

    const dolly = new Object3D();
    dolly.name = "dolly";

    const pitch = new Object3D();
    pitch.name = "pitch";

    const roll = new Object3D();
    roll.name = "roll";

    if (typeof this.roll === "number") {
      this.setRoll(this.roll, false);
      this.needsUpdateBounds = true;
    }

    if (typeof this.pitch === "number") {
      this.setPitch(this.pitch, false);
      this.needsUpdateBounds = true;
    }

    dolly.add(pitch);
    pitch.add(roll);
    roll.add(this.mesh);

    this.dolly = dolly;
  }

  /** OBBs in each mesh's local space, paired with the mesh for correct world transform. */
  private localOBBs: { mesh: Mesh; obb: OBB }[] = [];

  private initLocalOBB() {
    if (!this.mesh) return;

    this.mesh.traverse((node) => {
      if (node instanceof Mesh && node.geometry?.attributes?.position) {
        // AABB in mesh local space (from geometry), so applyMatrix4(mesh.matrixWorld) later gives correct world OBB
        const localAABB = new Box3().setFromBufferAttribute(node.geometry.attributes.position as BufferAttribute);
        this.localOBBs.push({ mesh: node, obb: new OBB().fromBox3(localAABB) });
      }
    });
  }

  private updateDebugHelpers() {
    // Remove existing helpers
    for (const helper of this.debugHelpers) {
      helper.parent?.remove(helper);
      const withResources = helper as Object3D & {
        geometry?: { dispose: () => void };
        material?: { dispose: () => void } | { dispose: () => void }[];
      };
      if (withResources.geometry?.dispose) withResources.geometry.dispose();
      if (withResources.material) {
        const mat = Array.isArray(withResources.material) ? withResources.material : [withResources.material];
        for (const m of mat) m.dispose();
      }
    }
    this.debugHelpers.length = 0;

    if (!this._debug || !this.mesh) return;

    const localBox = new Box3();
    const localSphere = new Sphere();

    for (const { mesh } of this.localOBBs) {
      const posAttr = mesh.geometry?.attributes?.position;
      if (!posAttr) continue;

      localBox.setFromBufferAttribute(posAttr as BufferAttribute);
      localBox.getBoundingSphere(localSphere);

      const boxHelper = new Box3Helper(localBox.clone(), 0x00ff00);
      mesh.add(boxHelper);
      this.debugHelpers.push(boxHelper);

      const sphereMesh = new Mesh(
        new SphereGeometry(localSphere.radius, 16, 12),
        new MeshBasicMaterial({ wireframe: true, color: 0xff8800 }),
      );
      sphereMesh.position.copy(localSphere.center);
      mesh.add(sphereMesh);
      this.debugHelpers.push(sphereMesh);
    }
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
   * Clone this item and add it to the layer. The cloned item shares the same mesh geometry and animations but has its own materials and transform.
   * @param newId - The ID for the cloned item. If omitted, defaults to `${this.id}-clone`.
   * @param options - Options to override properties on the clone (e.g. lngLat, altitude, transform).
   * @returns The new Item3D instance.
   */
  public clone(newId?: string, options: CloneMeshOptions = {}): Item3D {
    const id = newId ?? `${this.id}-clone`;

    if (!this.mesh) {
      throw new Error(`Item with ID ${this.id} does not have a mesh.`);
    }

    const cloneOptions: Partial<MeshOptions> = {
      lngLat: new LngLat(this.lngLat.lng, this.lngLat.lat),
      altitude: this.altitude,
      altitudeReference: this.altitudeReference,
      visible: this.mesh.visible,
      sourceOrientation: this.sourceOrientation,
      scale: this.scale,
      heading: this.heading,
      ...options,
    };

    const clonedObject = this.mesh.clone(true);

    const gltfContent = clonedObject.getObjectByName(`${this.id}_gltfContent_scene`);
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

    return this.parentLayer.addClonedMesh({
      ...cloneOptions,
      id,
      mesh: clonedObject,
      ...(this.animationClips && { animations: [...this.animationClips].map((clip) => clip.clone()) }),
      animationMode: this.animationMode,
      states: Array.from(this.currentStates.entries()).reduce((acc, [name, { props }]) => {
        acc[name as Item3DMeshUIStateName] = props;
        return acc;
      }, {} as Item3DMeshUIStates),
    });
  }

  /**
   * Get the registered event types of the item. This only used by the Layer3D class to check if an event is registered for this item.
   * @internal
   * @private
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
      this.needsUpdateBounds = true;
      return this;
    }

    this.transform = {
      ...this.transform,
      ...transform,
    };

    this.needsUpdateBounds = true;

    return this;
  }
  /**
   * Modify the item with a set of options
   * @param options - The options to modify the item with
   * @returns {Item3D} The item
   */
  public modify(options: Omit<Partial<MeshOptions>, "states" | "userData">) {
    if (!this.mesh) return this;

    let isTransformNeedUpdate = false;

    if (typeof options.visible === "boolean") {
      this.mesh.visible = options.visible;
    }

    if ("lngLat" in options) {
      this.lngLat = LngLat.convert(options.lngLat as LngLatLike);
      this.elevation = this.map.queryTerrainElevation(this.lngLat) || 0;
      this.needsUpdateBounds = true;
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
      this.needsUpdateBounds = true;
    }

    if (typeof options.altitudeReference === "number") {
      this.altitudeReference = options.altitudeReference;
      this.elevation = this.map.queryTerrainElevation(this.lngLat) || 0;
      this.needsUpdateBounds = true;
    }

    if (typeof options.heading === "number") {
      this.heading = options.heading;
      isTransformNeedUpdate = true;
    }

    if (typeof options.pitch === "number") {
      this.setPitch(options.pitch, false);
      this.needsUpdateBounds = true;
    }

    if (typeof options.roll === "number") {
      this.setRoll(options.roll, false);
      this.needsUpdateBounds = true;
    }

    if (isTransformNeedUpdate === true) {
      this.applyTransformUpdate();
      this.needsUpdateBounds = true;
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

  public remove() {
    const scene = this.dolly?.parent;
    if (this.dolly && scene) {
      // Removing the mesh from the scene
      // Traversing the tree of this Object3D/Group/Mesh
      // and find all the sub nodes that are THREE.Mesh
      // so that we can dispose (aka. free GPU memory) of their material and geometries
      this.dolly.traverse((node) => {
        if ("isMesh" in node && node.isMesh === true) {
          const mesh = node as Mesh;
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const mat of materials) {
            mat.dispose();
          }

          mesh.geometry.dispose();
        }
      });

      scene.remove(this.dolly);
    }

    if (this.parentLayer.getItem3D(this.id)) {
      this.parentLayer[removeItem3DFromIndexSymbol](this.id);
    }
  }

  /**
   * Set the lngLat of the item
   * @param lngLat - The lngLat to set
   * @param cueRepaint - Whether to cue a repaint, if false, the repaint will be triggered when only the map is updated
   * @returns {Item3D} The item
   */
  public setLngLat(lngLat: LngLat, cueRepaint = true) {
    this.lngLat = lngLat;

    this.needsUpdateBounds = true;
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

    this.needsUpdateBounds = true;

    if (cueRepaint) this.cueUpdate();
    return this;
  }

  /**
   * Set the position of the item relative to another Item3D
   * @param item {Item3D | Position3D} - The item to set the position relative to can either be another Item3D or an object representing a 3D position.
   * @param offset - The offset to set the position relative to, can be "x", "y" or "z". where "y" is the altitude offset, "x" is the longitude offset and "z" is the latitude offset
   * @param units - The units of the offset, can be "meters", "feet", "km" or "miles", defaults to "meters"
   * @param cueRepaint - Whether to cue a repaint, if false, the repaint will be triggered only when the map is updated
   * @returns {Item3D} The item
   */
  public setPositionRelativeTo(
    item: Item3D | Position3D,
    offset: { x: number; y: number; z: number },
    units: "meters" | "feet" | "km" | "miles" = "meters",
    cueRepaint = true,
  ) {
    // To avoid flickering / jitter, `cueUpdate` is `false` for both `setLngLat` and `setAltitude` calls
    // We want to avoid a repaint until the final calc is done (if needed)
    const newLngLat = item instanceof Item3D ? item.lngLat : new LngLat(item.lon, item.lat);
    this.setLngLat(new LngLat(newLngLat.lng, newLngLat.lat), false);
    this.setAltitude(item.altitude, false);
    return this.moveBy(offset, units, cueRepaint);
  }

  /**
   * Move the item by a given offset
   * @param offset - The offset to move the item by, can be "x", "y" or "z". where "y" is the altitude offset, "x" is the longitude offset and "z" is the latitude offset
   * @param units - The units of the offset, can be "meters", "feet", "km" or "miles", defaults to "meters"
   * @param cueRepaint - Whether to cue a repaint, if false, the repaint will be triggered only when the map is updated
   * @returns {Item3D} The current instance of Item3D
   */
  public moveBy(
    offset: { x: number; y: number; z: number },
    units: "meters" | "feet" | "km" | "miles" = "meters",
    cueRepaint = true,
  ) {
    const xOffsetInMeters = convertUnitsToMeters(offset.x, units);
    const zOffsetInMeters = convertUnitsToMeters(offset.z, units);
    const altitudeOffsetInMeters = convertUnitsToMeters(offset.y, units);

    const newLat = this.lngLat.lat + (zOffsetInMeters / EARTH_RADIUS) * (180 / Math.PI);

    const newLng =
      this.lngLat.lng +
      (xOffsetInMeters / (EARTH_RADIUS * Math.cos((this.lngLat.lat * Math.PI) / 180))) * (180 / Math.PI);

    this.lngLat = new LngLat(newLng, newLat);
    this.altitude = this.altitude + altitudeOffsetInMeters;
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

    this.needsUpdateBounds = true;

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

    this.needsUpdateBounds = true;

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

    this.needsUpdateBounds = true;

    if (cueRepaint) this.cueUpdate();
    return this;
  }

  /**
   * Set the pitch of the item
   * @param pitch - The pitch to set, in degrees
   * @param cueRepaint - Whether to cue a repaint, if false, the repaint will be triggered only when the map is updated
   * @returns {Item3D} The item
   */
  public setPitch(pitchInDegrees: number, cueRepaint = true) {
    this.pitch = pitchInDegrees;
    const pitchObject = this.dolly?.getObjectByName("pitch");
    if (pitchObject) {
      pitchObject.rotation.x = degreesToRadians(pitchInDegrees);
    }

    this.needsUpdateBounds = true;

    if (cueRepaint) this.cueUpdate();
    return this;
  }

  /**
   * Set the roll of the item
   * @param roll - The roll to set, in degrees
   * @param cueRepaint - Whether to cue a repaint, if false, the repaint will be triggered only when the map is updated
   * @returns {Item3D} The item
   */
  public setRoll(rollInDegrees: number, cueRepaint = true) {
    this.roll = rollInDegrees;
    const rollObject = this.dolly?.getObjectByName("roll");
    if (rollObject) {
      rollObject.rotation.z = degreesToRadians(rollInDegrees);
    }

    this.needsUpdateBounds = true;

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
    this.needsUpdateBounds = true;

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
    this.needsUpdateBounds = true;

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
    this.needsUpdateBounds = true;
  }

  /**
   * Traverse a Mesh/Group/Object3D to modify the opacities of the all the materials it finds
   * @param opacity - The opacity to set
   * @param cueRepaint - whether to cue a repaint, if false, the repaint will be triggered only when the map is updated
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
   * @param animationName - The name of the animation to get
   * @returns {AnimationAction | null} The animation action or null if not found
   */
  public getAnimation(animationName: string): AnimationAction | null {
    if (!this.mesh) return null;
    return this.animationMap?.[animationName] ?? null;
  }

  /**
   * Pause an animation
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
   * @returns {string[]} The names of all the animations of the mesh
   */
  public getAnimationNames(): string[] {
    if (!this.animationMap) return [];

    return Object.keys(this.animationMap ?? {});
  }

  /**
   * Update the animation of a mesh by a delta time
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

  private needsUpdateBounds = false;

  protected bounds = {
    box: new Box3(),
    sphere: new Sphere(),
  };

  /**
   * Check if the item intersects with another item
   * @param item3D - The item to check intersection with
   * @param precision - The precision of the intersection check, can be "low" or "medium". "high" is not supported currently.
   * "low" is the fastest and least accurate check, it only checks the bounding sphere and AABB of the entire group.
   * "medium" is the default check, it does a broad pass first, then checks the OBB of the individual meshes within the group. This is less and less performant as the number of meshes in the group increases.
   * @returns {boolean} True if the items intersect, false otherwise
   */
  public intersects(item3D: Item3D, precision: "low" | "medium" = "medium") {
    if (!["low", "medium"].includes(precision)) {
      throw new Error(`Invalid precision: "${precision}", must be "low" or "medium"`);
    }

    if (!this.mesh || !item3D.mesh) return false;

    // update the bounds for this and the intersected item
    this.updateGroupBoundsIfNeeded(true);
    item3D.updateGroupBoundsIfNeeded(true);

    // check broad intersections
    if (!this.bounds.sphere.intersectsSphere(item3D.bounds.sphere)) return false;
    if (!this.bounds.box.intersectsBox(item3D.bounds.box)) return false;

    // if we have reached here, we have a broad intersection
    // so we can return true if we are using the broad strategy
    if (precision === "low") return true;

    // if not then we need to check narrower intersections
    for (const { mesh: meshA, obb: localOBBA } of this.localOBBs) {
      const worldOBBA = localOBBA.clone().applyMatrix4(meshA.matrixWorld);
      for (const { mesh: meshB, obb: localOBBB } of item3D.localOBBs) {
        const worldOBBB = localOBBB.clone().applyMatrix4(meshB.matrixWorld);
        if (worldOBBA.intersectsOBB(worldOBBB)) return true;
      }
    }

    return false;
  }

  /**
   * Update the intersection bounds of the group if needed
   * @param force - Whether to force the update
   * @private
   */
  protected updateGroupBoundsIfNeeded(force = false) {
    if (!force && this.needsUpdateBounds === false) return;
    if (!this.mesh) return;

    this.bounds.box.setFromObject(this.mesh);

    this.bounds.box.getBoundingSphere(this.bounds.sphere);

    this.needsUpdateBounds = false;
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
