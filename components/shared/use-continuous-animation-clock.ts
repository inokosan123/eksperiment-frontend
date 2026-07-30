import { useEffect } from 'react';
import {
  cancelAnimation,
  Easing,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
export {
  continuousPhase,
  easeInOutQuad,
  halfSinePulse,
  pingPongPhase,
} from '@/components/shared/animation-phase';

const CLOCK_EPOCH_MS = Date.now();
const CLOCK_WINDOW_MS = 10 * 60 * 1000;
const CLOCK_RESYNC_MS = 9 * 60 * 1000;

/**
 * A UI-thread clock that follows elapsed wall time instead of restarting at
 * zero after viewport or tab pauses. A long timing window keeps per-frame JS
 * work at zero; the rare re-anchor happens before the window completes and is
 * visually continuous to within a frame.
 */
export function useContinuousAnimationClock(running: boolean): SharedValue<number> {
  const clock = useSharedValue(Date.now() - CLOCK_EPOCH_MS);

  useEffect(() => {
    const syncToWallClock = () => {
      const elapsed = Date.now() - CLOCK_EPOCH_MS;
      cancelAnimation(clock);
      clock.value = elapsed;
      clock.value = withTiming(elapsed + CLOCK_WINDOW_MS, {
        duration: CLOCK_WINDOW_MS,
        easing: Easing.linear,
      });
    };

    if (!running) {
      cancelAnimation(clock);
      clock.value = Date.now() - CLOCK_EPOCH_MS;
      return;
    }

    syncToWallClock();
    const timer = setInterval(syncToWallClock, CLOCK_RESYNC_MS);
    return () => {
      clearInterval(timer);
      cancelAnimation(clock);
    };
  }, [clock, running]);

  return clock;
}
