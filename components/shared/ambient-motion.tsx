import {
  createContext,
  memo,
  use,
  useMemo,
  type ReactNode,
} from 'react';
import {
  useReducedMotion,
  type SharedValue,
} from 'react-native-reanimated';
import { useContinuousAnimationClock } from '@/components/shared/use-continuous-animation-clock';
import { ambientMotionEnabled } from '@/components/shared/ambient-motion-state';

export type AmbientMotionRuntime = {
  enabled: boolean;
  reduceMotion: boolean;
  clock: SharedValue<number>;
};

const AmbientMotionContext = createContext<AmbientMotionRuntime | null>(null);

/**
 * One wall-time animation driver for a visible motion zone.
 *
 * Consumers still keep their own durations and phase offsets; the provider
 * only removes duplicate perpetual timing animations. Because the clock is
 * tied to wall time, pausing a tab or an off-screen zone never restarts the
 * artwork from frame zero when it becomes visible again.
 */
export const AmbientMotionProvider = memo(function AmbientMotionProvider({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const enabled = ambientMotionEnabled(active, reduceMotion);
  const clock = useContinuousAnimationClock(enabled);
  const runtime = useMemo<AmbientMotionRuntime>(
    () => ({ enabled, reduceMotion, clock }),
    [clock, enabled, reduceMotion],
  );

  return (
    <AmbientMotionContext.Provider value={runtime}>
      {children}
    </AmbientMotionContext.Provider>
  );
});

/**
 * Reads the nearest shared motion clock. Components outside a provider keep a
 * safe standalone fallback, which preserves existing behaviour on secondary
 * screens while the four main tabs share their drivers.
 */
export function useAmbientMotion(localActive = true): AmbientMotionRuntime {
  const runtime = use(AmbientMotionContext);
  const fallbackReduceMotion = useReducedMotion();
  const fallbackEnabled = runtime === null
    && ambientMotionEnabled(localActive, fallbackReduceMotion);
  const fallbackClock = useContinuousAnimationClock(fallbackEnabled);

  return useMemo(() => {
    if (runtime) {
      return {
        clock: runtime.clock,
        reduceMotion: runtime.reduceMotion,
        enabled: runtime.enabled && localActive,
      };
    }
    return {
      clock: fallbackClock,
      reduceMotion: fallbackReduceMotion,
      enabled: fallbackEnabled,
    };
  }, [fallbackClock, fallbackEnabled, fallbackReduceMotion, localActive, runtime]);
}
