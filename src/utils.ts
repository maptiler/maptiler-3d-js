import type { GlobeTransform } from "maplibre-gl/src/geo/projection/globe_transform";
import type { Object3D, PointLight } from "three";

const isGlobeTransform = (transform: object): transform is GlobeTransform => {
  if ("isGlobeRendering" in transform) {
    return true;
  }

  return false;
};

const isPointLight = (object3D: Object3D): object3D is PointLight => {
  return "isPointLight" in object3D && object3D.isPointLight === true;
};

export { isGlobeTransform, isPointLight };
