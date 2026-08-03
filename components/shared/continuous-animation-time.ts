const CONTINUOUS_ANIMATION_EPOCH_MS = Date.now();

/**
 * Returns the same elapsed wall time used by the shared UI-thread clock.
 * Static snapshots use this when motion pauses so they preserve the exact
 * visual phase instead of falling back to an unrelated default frame.
 */
export function continuousAnimationElapsedNow(nowMs = Date.now()) {
  return nowMs - CONTINUOUS_ANIMATION_EPOCH_MS;
}
