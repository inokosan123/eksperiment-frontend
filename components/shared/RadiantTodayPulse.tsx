import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Reanimated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

// The living marker for "today" in a streak week band — a warm radiant
// pulse that breathes around the current day's token. Shared by Home
// (Your Progress) and Focus (Trophy Streak) so today reads the same on
// both, and ready for the Journal/Home streak sheets later.
//
// A single flat ring blinking its opacity was a functional marker, not a
// beautiful one. This is a small bloom instead: a soft gold halo built
// from concentric discs (a radial falloff, the app's own glow grammar),
// a crisp inner ring, and a fainter outer ring breathing a touch behind
// it — so the light seems to swell and settle rather than flick on and
// off. Everything animates OPACITY only; nothing scales, so small Android
// views never resample (the app's standing rule).

export default function RadiantTodayPulse({
  size,
  color = '#C5A059',
}: {
  size: number;
  color?: string;
}) {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      t.value = 0.5;
      return;
    }
    t.value = 0;
    t.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(t);
  }, [reduceMotion, t]);

  // The halo swells; the crisp ring brightens with it; the outer hairline
  // trails a little softer, giving the pulse depth without motion.
  const haloStyle = useAnimatedStyle(() => ({ opacity: 0.35 + t.value * 0.65 }));
  const innerStyle = useAnimatedStyle(() => ({ opacity: 0.5 + t.value * 0.45 }));
  const outerStyle = useAnimatedStyle(() => ({ opacity: 0.12 + t.value * 0.32 }));

  const haloOuter = size + 14;
  const haloMid = size + 8;
  const haloInner = size + 2;
  const ringOuter = size + 11;
  const ringInner = size + 5;

  return (
    <View pointerEvents="none" style={pulse.center}>
      {/* Soft gold bloom — concentric discs standing in for a radial glow. */}
      <Reanimated.View style={[pulse.fill, haloStyle]}>
        <View
          style={[
            pulse.disc,
            { width: haloOuter, height: haloOuter, borderRadius: haloOuter / 2, backgroundColor: 'rgba(197,160,89,0.10)' },
          ]}
        />
        <View
          style={[
            pulse.disc,
            { width: haloMid, height: haloMid, borderRadius: haloMid / 2, backgroundColor: 'rgba(226,192,116,0.14)' },
          ]}
        />
        <View
          style={[
            pulse.disc,
            { width: haloInner, height: haloInner, borderRadius: haloInner / 2, backgroundColor: 'rgba(244,220,150,0.18)' },
          ]}
        />
      </Reanimated.View>

      {/* Outer hairline, then the crisp marker ring. */}
      <Reanimated.View
        style={[
          pulse.ring,
          { width: ringOuter, height: ringOuter, borderRadius: ringOuter / 2, borderColor: color, borderWidth: 1 },
          outerStyle,
        ]}
      />
      <Reanimated.View
        style={[
          pulse.ring,
          { width: ringInner, height: ringInner, borderRadius: ringInner / 2, borderColor: color, borderWidth: 1.75 },
          innerStyle,
        ]}
      />
    </View>
  );
}

const pulse = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disc: { position: 'absolute' },
  ring: { position: 'absolute' },
});
