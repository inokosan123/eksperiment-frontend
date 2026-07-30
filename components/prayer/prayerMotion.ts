import { useEffect } from 'react';
import {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

/* ─────────────────────────────────────────────────────────────
 * THE ONE VALUE THE PRAYER SCREEN LIGHTS FROM.
 *
 * Pressing start is not four changes that happen to coincide — it is one
 * change with four faces: the object grows, the room deepens, the
 * reading warms, the button takes its light. So they all read from a
 * single ignition rather than each keeping a copy, which would agree
 * today and drift the first time one curve was tuned.
 *
 * ⚠ IT LIVES HERE RATHER THAN IN A COMPONENT because the component it
 * used to live in — the orbit — has been removed. A shared value owned
 * by whichever piece of the screen happened to be written first is a
 * dependency waiting to be surprised by a redesign.
 *
 * THE CURVES ARE NOT SYMMETRIC, and that is the whole feel of it.
 * Kindling is slow and eases out, the way something coming to life
 * settles; going back to rest is quicker and eases at both ends, the way
 * a lamp turned down does. A prayer beginning should feel like an
 * arrival and pausing should feel like a breath, and one shared duration
 * cannot give both.
 * ───────────────────────────────────────────────────────────── */

export const IGNITION_MS = 760;
export const RESTING_MS = 380;

export function useIgnition(running: boolean): SharedValue<number> {
  const ignition = useSharedValue(running ? 1 : 0);

  useEffect(() => {
    ignition.value = withTiming(running ? 1 : 0, {
      duration: running ? IGNITION_MS : RESTING_MS,
      easing: running ? Easing.out(Easing.cubic) : Easing.inOut(Easing.quad),
    });
  }, [ignition, running]);

  return ignition;
}

/**
 * The reading's own colour, travelling rather than switching.
 *
 * The digits used to flip to the accent the instant `running` changed
 * while everything around them eased — the tell of a colour driven by
 * React state instead of by the same animation as its surroundings.
 */
export function useReadoutInk(ignition: SharedValue<number>, from: string, to: string) {
  return useAnimatedStyle(() => ({
    color: interpolateColor(ignition.value, [0, 1], [from, to]),
  }), [from, to]);
}
