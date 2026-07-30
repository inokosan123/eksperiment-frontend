import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Reanimated, {
  useAnimatedStyle,
  useReducedMotion,
} from 'react-native-reanimated';
import {
  continuousPhase,
  pingPongPhase,
  useContinuousAnimationClock,
} from '@/components/shared/use-continuous-animation-clock';

// The living marker for "today" in a streak week band — a warm radiant
// pulse that breathes around the current day's token. Shared by Home
// (Your Progress) and Focus (Trophy Streak) so today reads the same on
// both, and ready for the Journal/Home streak sheets later.
//
// A single flat ring blinking its opacity was a functional marker, not a
// beautiful one. This is a small living jewel instead:
//   · a soft gold halo built from concentric discs (a radial falloff, the
//     app's own glow grammar), swelling and settling;
//   · a crisp inner ring and a fainter outer hairline, breathing a touch
//     OUT OF PHASE with the halo so there is always something moving;
//   · a single four-point sparkle that slowly orbits the ring and twinkles
//     as it goes — the one spark of life that lifts the whole mark.
// The halo and rings animate OPACITY only; the sparkle ORBITS by rotation.
// Nothing scales, so small Android views never resample (standing rule).

const SPARKLE_PATH =
  'M12 0 C13.2 7.4 16.6 10.8 24 12 C16.6 13.2 13.2 16.6 12 24 C10.8 16.6 7.4 13.2 0 12 C7.4 10.8 10.8 7.4 12 0 Z';

export default function RadiantTodayPulse({
  size,
  color = '#C5A059',
  active = true,
  seated = false,
}: {
  size: number;
  color?: string;
  active?: boolean;
  /**
   * The token this surrounds already wears a rim of its own, so the mark keeps
   * only its outer hairline: a seated token plus two pulse rings is three
   * concentric gold circles on one small cell, which reads as a target rather
   * than as a day in progress.
   */
  seated?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const running = active && !reduceMotion;
  const clock = useContinuousAnimationClock(running);

  // The halo leads; the crisp ring counter-breathes so the mark never sits
  // still; the outer hairline trails soft behind the halo.
  const haloStyle = useAnimatedStyle(() => {
    const breath = running ? pingPongPhase(clock.value, 2000) : 0.5;
    return { opacity: 0.4 + breath * 0.6 };
  });
  const innerStyle = useAnimatedStyle(() => {
    const breath = running ? pingPongPhase(clock.value, 2000) : 0.5;
    return { opacity: 0.9 - breath * 0.4 };
  });
  const outerStyle = useAnimatedStyle(() => {
    const breath = running ? pingPongPhase(clock.value, 2000) : 0.5;
    return { opacity: 0.12 + breath * 0.3 };
  });

  // The sparkle rides the ring, brightest at the far side of its orbit.
  const orbitStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${(running ? continuousPhase(clock.value, 4600) : 0) * 360}deg` }],
  }));
  const sparkleStyle = useAnimatedStyle(() => ({
    opacity: (() => {
      const spin = running ? continuousPhase(clock.value, 4600) : 0;
      return 0.35 + (0.5 + 0.5 * Math.sin(spin * Math.PI * 2)) * 0.6;
    })(),
  }));

  const haloOuter = size + 15;
  const haloMid = size + 9;
  const haloInner = size + 3;
  const ringOuter = size + 10;
  const ringInner = size + 5;

  // The spark rides the crisp inner ring, kept tight so it never wanders
  // into the neighbouring day.
  const orbitR = ringInner / 2;
  const sparkleSize = Math.max(6, size * 0.18);

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
            { width: haloMid, height: haloMid, borderRadius: haloMid / 2, backgroundColor: 'rgba(228,194,118,0.15)' },
          ]}
        />
        <View
          style={[
            pulse.disc,
            { width: haloInner, height: haloInner, borderRadius: haloInner / 2, backgroundColor: 'rgba(246,224,158,0.20)' },
          ]}
        />
      </Reanimated.View>

      {/* Outer hairline, then the crisp marker ring — one ring only where the
          token already carries its own. */}
      <Reanimated.View
        style={[
          pulse.ring,
          {
            width: ringOuter,
            height: ringOuter,
            borderRadius: ringOuter / 2,
            borderColor: color,
            borderWidth: seated ? 1.4 : 1,
          },
          seated ? innerStyle : outerStyle,
        ]}
      />
      {!seated && (
        <Reanimated.View
          style={[
            pulse.ring,
            { width: ringInner, height: ringInner, borderRadius: ringInner / 2, borderColor: color, borderWidth: 1.75 },
            innerStyle,
          ]}
        />
      )}

      {/* The orbiting spark — a four-point sparkle riding the ring. The
          container is centred and rotates; the spark is a centred child
          lifted up by the orbit radius, so it circles the token cleanly. */}
      <Reanimated.View style={[pulse.fill, orbitStyle]}>
        <Reanimated.View style={[{ transform: [{ translateY: -orbitR }] }, sparkleStyle]}>
          <Svg width={sparkleSize} height={sparkleSize} viewBox="0 0 24 24">
            <Path d={SPARKLE_PATH} fill="#FFF3CF" />
          </Svg>
        </Reanimated.View>
      </Reanimated.View>
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
