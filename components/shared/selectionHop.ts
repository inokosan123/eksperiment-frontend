import { useCallback, useEffect } from 'react';
import {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

/* ─────────────────────────────────────────────────────────────
 * THE HOP — how a chosen thing answers being chosen.
 *
 * The Prayer Book's hour row was given this and it is now the app's
 * standard for a row of choices: the one you pick RISES five points and
 * springs back, and everything under your finger gives a little while
 * you hold it.
 *
 * ⚠ ONLY THE ARRIVING ONE HOPS. A row of five bouncing at once is noise
 * rather than delight, and it also says the wrong thing — the event is
 * one thing being chosen, not five things reacting. The value that
 * drives it is only ever started on the way IN.
 *
 * ⚠ AND THE RISE AND THE LANDING ARE NOT THE SAME CURVE. Up is a timed
 * ease-out over 140ms — deliberate, weightless, the lift of something
 * picked up. Down is a spring, underdamped enough to settle rather than
 * stop dead. One curve both ways gives a bounce; two give a gesture.
 *
 * ⚠ THIS FILE OWNS THE NUMBERS, and that is the whole reason it exists.
 * The motion was written inline in the Prayer Book, and a second screen
 * copying five constants out of it is how two rows that are supposed to
 * feel identical end up a frame apart the first time either is tuned.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 *
 * ⚠ IT BRINGS NO GESTURE HANDLER. The Prayer Book drives its press from
 * `Gesture.Tap`, which is right there — it is a plain screen. Some of
 * this app's choice rows live inside Modals, and RNGH inside a Modal
 * takes Android down unless the content is wrapped in its own
 * GestureHandlerRootView. So the press is exposed as two callbacks a
 * `Pressable` can hand over, and the caller keeps whatever touch system
 * it already had. The animation is identical either way; only the thing
 * that starts it differs.
 *
 * ⚠ AND IT DRAWS NOTHING. It returns a value and a transform. Colour,
 * tint, seat and label belong to the row that uses it, because the two
 * rows this serves do not agree about those and should not have to.
 * ───────────────────────────────────────────────────────────── */

/** How the chosen state washes in — colour, tint, whatever the caller drives. */
const SETTLE = { duration: 260, easing: Easing.out(Easing.cubic) } as const;

/** Up: timed and weightless. */
const RISE = { to: -5, duration: 140, easing: Easing.out(Easing.quad) } as const;

/** Down: a spring, underdamped so it settles rather than stops. */
const LAND = { damping: 9, stiffness: 300, mass: 0.6 } as const;

/** The give under a finger. Small enough to be felt and not watched. */
const GIVE = 1.5;
const PRESS_IN = { duration: 90 } as const;
const PRESS_OUT = { duration: 190 } as const;

export function useSelectionHop(active: boolean) {
  const reduceMotion = useReducedMotion();
  /** 0 unchosen, 1 chosen — the caller's own colours ride on this. */
  const on = useSharedValue(active ? 1 : 0);
  const hop = useSharedValue(0);
  const press = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      on.value = active ? 1 : 0;
      return;
    }
    on.value = withTiming(active ? 1 : 0, SETTLE);
    if (!active) return;
    hop.value = withSequence(
      withTiming(RISE.to, { duration: RISE.duration, easing: RISE.easing }),
      withSpring(0, LAND),
    );
  }, [active, hop, on, reduceMotion]);

  const onPressIn = useCallback(() => {
    press.value = withTiming(1, PRESS_IN);
  }, [press]);

  const onPressOut = useCallback(() => {
    press.value = withTiming(0, PRESS_OUT);
  }, [press]);

  /**
   * The hop and the give, on one transform.
   *
   * ⚠ TRANSLATION ONLY — never scale. These are small views carrying
   * vector marks, and scaling a small view on Android resamples its
   * bitmap every frame it is scaling.
   */
  const lift = useAnimatedStyle(() => ({
    transform: [{ translateY: hop.value + press.value * GIVE }],
  }));

  return { on, lift, onPressIn, onPressOut };
}
