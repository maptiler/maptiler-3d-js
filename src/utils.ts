import type { Object3D, PointLight } from "three";

const isPointLight = (object3D: Object3D): object3D is PointLight => {
  return "isPointLight" in object3D && object3D.isPointLight === true;
};

export { isPointLight };
