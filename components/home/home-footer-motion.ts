export type HomeMotionFrame = {
  y: number;
  height: number;
};

type HomeFooterMotionInput = {
  scrollY: number;
  viewportHeight: number;
  footerFrame: HomeMotionFrame;
  weeklyFrame: HomeMotionFrame;
  organizeTop: number;
  organizeFrames: ReadonlyMap<number, HomeMotionFrame>;
  preload?: number;
};

export type HomeFooterMotionState = {
  weeklyActive: boolean;
  organizeMask: number;
};

function isMeasuredFrame(frame: HomeMotionFrame) {
  return Number.isFinite(frame.y) && frame.height > 0;
}

function intersectsViewport(
  top: number,
  height: number,
  viewportTop: number,
  viewportBottom: number,
) {
  return top <= viewportBottom && top + height >= viewportTop;
}

/**
 * Resolves the two independently animated Home footer zones.
 *
 * Keeping this calculation outside React makes the scroll hot path cheap and
 * testable. In particular, the large Your Progress card must stop animating
 * once the user reaches Organize; treating the entire footer as one frame
 * kept both rich sections alive at the same time on Android.
 */
export function getHomeFooterMotionState({
  scrollY,
  viewportHeight,
  footerFrame,
  weeklyFrame,
  organizeTop,
  organizeFrames,
  preload = Math.min(160, viewportHeight * 0.18),
}: HomeFooterMotionInput): HomeFooterMotionState {
  const viewportTop = scrollY - preload;
  const viewportBottom = scrollY + viewportHeight + preload;
  const footerY = footerFrame.y;

  const weeklyTop = footerY + weeklyFrame.y;
  const weeklyActive = isMeasuredFrame(footerFrame)
    && isMeasuredFrame(weeklyFrame)
    && intersectsViewport(
      weeklyTop,
      weeklyFrame.height,
      viewportTop,
      viewportBottom,
    );

  let organizeMask = 0;
  if (isMeasuredFrame(footerFrame) && Number.isFinite(organizeTop)) {
    for (const [index, frame] of organizeFrames) {
      if (!isMeasuredFrame(frame)) continue;
      const top = footerY + organizeTop + frame.y;
      if (intersectsViewport(top, frame.height, viewportTop, viewportBottom)) {
        organizeMask |= 1 << index;
      }
    }
  }

  return { weeklyActive, organizeMask };
}
