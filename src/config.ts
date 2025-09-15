/**
 * Whether to use debug logs.
 * @private
 */
export const USE_DEBUG_LOGS: boolean = false;

/**
 * An epsilon to make sure the reference anchor point is not exactly at the center of the viewport, but still very close.
 * This is because ThreeJS light shaders were messed up with reference point in the center.
 * This issue is only happening because we are doing the projection matrix trick, otherwise we wouldn't bother with epsilon
 *
 */
export const EPSILON = 0.01;
