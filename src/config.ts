
export type MapTiler3DModuleConfig = {
  /**
   * Whether to use debug logs.
   */
  USE_DEBUG_LOGS: boolean;
  /**
   * An epsilon to make sure the reference anchor point is not exactly at the center of the viewport, but still very close.
   * This is because ThreeJS light shaders were messed up with reference point in the center.
   * This issue is only happening because we are doing the projection matrix trick, otherwise we wouldn't bother with epsilon
   *
   */
  EPSILON: number;
};

export const config: MapTiler3DModuleConfig = {
  USE_DEBUG_LOGS: false,
  EPSILON: 0.01,
};

