import { Quaternion, Vector3, Matrix4, type Object3D, type PointLight, MathUtils } from "three";
import { SourceOrientation } from "./types";

const isPointLight = (object3D: Object3D): object3D is PointLight => {
  return "isPointLight" in object3D && object3D.isPointLight === true;
};

const sourceOrientationToQuaternion = (so: SourceOrientation | undefined): Quaternion => {
  const quaternion = new Quaternion();

  switch (so) {
    case SourceOrientation.X_UP:
      quaternion.setFromAxisAngle(new Vector3(0, 0, 1), -Math.PI / 2);
      break;

    case SourceOrientation.Y_UP:
      quaternion.identity();
      break;

    case SourceOrientation.Z_UP:
      quaternion.setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
      break;
  }

  return quaternion;
};

/**
 * Helper function to create a transformation matrix for model and we can apply in single operation.
 */
const getTransformationMatrix = (
  scale: [number, number, number],
  heading: number,
  orientation: SourceOrientation,
): Matrix4 => {
  const scaleMatrix = new Matrix4().makeScale(scale[0], scale[1], scale[2]);
  const orientationMatrix = new Matrix4().makeRotationFromQuaternion(sourceOrientationToQuaternion(orientation));
  const headingMatrix = new Matrix4().makeRotationY(MathUtils.degToRad(-heading));

  return new Matrix4().multiply(scaleMatrix).multiply(orientationMatrix).multiply(headingMatrix);
};

export function filterKeysFromObject<T extends Record<string, any>>(
  obj: T = {} as T,
  keys: (keyof T)[] = [],
): Partial<T> {
  console.log("filterKeysFromObject: keys", keys);
  return keys.reduce(
    (acc, key) => {
      if (obj[key] !== undefined) {
        acc[key] = obj[key];
      }
      return acc;
    },
    {} as Partial<T>,
  );
}

export { isPointLight, getTransformationMatrix };
