// Start this pause at native transitionEnd, not at Finish tap. It gives the
// eye one stable Home frame sequence to reacquire the task row before the
// check, strike and flourish begin together.
export const HOME_POST_TRANSITION_SETTLE_MS = 440;
export const HOME_RETURN_CHECK_DELAY_MS = HOME_POST_TRANSITION_SETTLE_MS;

// The title strike is the longest piece of primary completion motion. A
// challenge celebration belongs to the next visual beat, so it waits for the
// strike and then leaves a small breath before covering Home with confetti.
export const TASK_CHECK_PRIMARY_MOTION_MS = 1_150;
export const CHALLENGE_REVEAL_BREATH_MS = 150;
export const TASK_CHECK_TO_CHALLENGE_POPUP_MS =
  TASK_CHECK_PRIMARY_MOTION_MS + CHALLENGE_REVEAL_BREATH_MS;
export const DIRECT_CHECK_TO_CHALLENGE_POPUP_MS =
  TASK_CHECK_TO_CHALLENGE_POPUP_MS;
export const DIRECT_COMPLETION_SETTLE_MS = 180;
export const RECOVERED_CHALLENGE_POPUP_DELAY_MS = 260;
export const NEXT_CHALLENGE_POPUP_GAP_MS = 420;

type ReturnTiming = {
  queuedAt: number;
  delayMs: number;
  settledAt?: number;
};

/**
 * A settled routed completion is measured from native transitionEnd so Home
 * always receives the full recognition pause. The queued timestamp remains a
 * fallback for legacy/direct events that do not carry native settle metadata.
 */
export function remainingReturnCheckDelayMs(
  completions: ReturnTiming[],
  now = Date.now(),
) {
  if (completions.length === 0) return HOME_POST_TRANSITION_SETTLE_MS;
  const notBefore = Math.max(...completions.map(item => (
    item.settledAt
      ? item.settledAt + HOME_POST_TRANSITION_SETTLE_MS
      : item.queuedAt + item.delayMs
  )));
  if (completions.every(item => item.settledAt != null)) {
    return Math.max(0, notBefore - now);
  }
  return Math.max(HOME_POST_TRANSITION_SETTLE_MS, notBefore - now);
}

/**
 * A direct Home tap already played the task check feedback optimistically.
 * Only the remaining quiet beat before the trophy overlay is needed.
 */
export function remainingDirectPopupDelayMs(
  feedbackPlayedAt: number,
  now = Date.now(),
) {
  return Math.max(
    DIRECT_COMPLETION_SETTLE_MS,
    feedbackPlayedAt + DIRECT_CHECK_TO_CHALLENGE_POPUP_MS - now,
  );
}
