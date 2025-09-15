import type { CustomLayerInterface, CustomRenderMethodInput, LngLat, LngLatLike, Point2D } from "@maptiler/sdk";
import { LoopOnce, LoopPingPong, LoopRepeat, type ColorRepresentation, type Object3D, type Intersection } from "three";
import {
  handleMeshClickMethodSymbol,
  handleMeshMouseEnterMethodSymbol,
  handleMeshMouseLeaveMethodSymbol,
  prepareRenderMethodSymbol,
} from "./symbols";

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
  scale?: number | [number, number, number];

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

  /**
   * Animation mode.
   * Default: `continuous`
   */
  animationMode?: AnimationMode;

  states?: Item3DMeshUIStates;

  userData?: Record<string, any>;
};

/**
 * The name of the state of the item
 * hover: when the mouse is over the item
 * active: when the mouse is down on the item
 */
export type Item3DMeshUIStateName = "default" | "hover" | "active";

export type Item3DTransform = {
  rotation?: {
    x?: number;
    y?: number;
    z?: number;
  };
  translate?: {
    x?: number;
    y?: number;
    z?: number;
  };
};

export type ComputeValueFunction<T> = (currentValue: T) => T;

export type Item3DComputableParameter =
  | number
  | LngLatLike
  | number
  | [number, number, number]
  | Item3DTransform
  | boolean;

export type Item3DMeshUIStateProperties = {
  opacity?: number;
  scale?: number | [number, number, number];
  transform?: Item3DTransform;
  heading?: number;
  altitude?: number;
  lngLat?: LngLatLike;
  wireframe?: boolean;
  pointSize?: number;
  elevation?: number;
  // outlineWidth?: number;
  // outlineColor?: ColorRepresentation;
  // outlineOpacity?: number;
};

export const item3DStatePropertiesNames = [
  "opacity",
  "scale",
  "transform",
  "heading",
  "altitude",
  "lngLat",
  "wireframe",
  "pointSize",
  "elevation",
] as const;

export type Item3DMeshUIStates = {
  [key in Item3DMeshUIStateName]?: Item3DMeshUIStateProperties;
};

export type AddMeshFromURLOptions = MeshOptions & {
  transform?: {
    rotation?: {
      x?: number;
      y?: number;
      z?: number;
    };
    offset?: {
      x?: number;
      y?: number;
      z?: number;
    };
  };
};

export type CloneMeshOptions = AddMeshFromURLOptions;

/**
 * Options for adding a point light
 */
export type PointLightOptions = Omit<GenericObject3DOptions, "id"> & {
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

export const AnimationLoopOptionsMap = {
  once: LoopOnce,
  loop: LoopRepeat,
  pingPong: LoopPingPong,
};

export type AnimationLoopOptions = keyof typeof AnimationLoopOptionsMap;

export type AnimationMode = "continuous" | "manual";

export interface Layer3DInternalApiEvent {
  intersection: Omit<Intersection, "object">;
  object: Object3D;
  meshID: string;
  layerID: string;
  lngLat: LngLat;
  point: Point2D;
}

export type Item3DEventTypes = "click" | "mouseenter" | "mouseleave" | "mousedown" | "mouseup" | "dblclick";

export interface Layer3DInternalApi extends CustomLayerInterface {
  [handleMeshClickMethodSymbol]: (event: Layer3DInternalApiEvent) => void;
  [handleMeshMouseEnterMethodSymbol]: (event: Layer3DInternalApiEvent) => void;
  [handleMeshMouseLeaveMethodSymbol]: (event: Layer3DInternalApiEvent) => void;
  [prepareRenderMethodSymbol]: (options: CustomRenderMethodInput) => void;
}
