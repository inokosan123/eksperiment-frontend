import { useCallback, useEffect, useRef } from 'react';

export function viewportMaskChanged(previous: number, next: number): boolean {
  return previous !== next;
}

/**
 * Coalesces high-frequency native scroll samples into one visibility pass per
 * frame. The consumer receives only the latest position; React state remains
 * the consumer's responsibility and should change only when its active mask
 * changes.
 */
export function useViewportMotionBudget(
  onFrame: (scrollY: number) => void,
): (scrollY: number) => void {
  const callbackRef = useRef(onFrame);
  const latestScrollYRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  callbackRef.current = onFrame;

  const schedule = useCallback((scrollY: number) => {
    latestScrollYRef.current = scrollY;
    if (frameRef.current != null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      callbackRef.current(latestScrollYRef.current);
    });
  }, []);

  useEffect(() => () => {
    if (frameRef.current != null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  return schedule;
}
