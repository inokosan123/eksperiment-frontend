import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import LottieFlame from '@/components/journal/LottieFlame';
import { C } from '@/constants/tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const RING_RADIUS = 45;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// The living centerpiece of the Focus tab: the app's Lottie flame inside a
// breathing gold halo with slow pulse waves. When `progress` is provided
// (an active watch), a golden ring of time closes around the flame.
export default function SanctuaryLamp({
  diameter = 150,
  flameSize,
  progress,
}: {
  diameter?: number;
  flameSize?: number;
  progress?: SharedValue<number>;
}) {
  const breath = useSharedValue(0);
  const pulse1 = useSharedValue(0);
  const pulse2 = useSharedValue(0);
  const ignite = useSharedValue(1);
  const showRing = !!progress;
  const flame = flameSize ?? Math.round(diameter * 0.38);

  useEffect(() => {
    breath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2100, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 2100, easing: Easing.inOut(Easing.quad) })
      ),
      -1
    );
    pulse1.value = withRepeat(
      withTiming(1, { duration: 4200, easing: Easing.out(Easing.quad) }),
      -1
    );
    pulse2.value = withDelay(
      2100,
      withRepeat(withTiming(1, { duration: 4200, easing: Easing.out(Easing.quad) }), -1)
    );
    return () => {
      cancelAnimation(breath);
      cancelAnimation(pulse1);
      cancelAnimation(pulse2);
    };
  }, [breath, pulse1, pulse2]);

  // One-shot flash when the ring of time first appears — the watch "ignites".
  useEffect(() => {
    if (showRing) {
      ignite.value = 0;
      ignite.value = withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) });
    }
  }, [showRing, ignite]);

  const glowProps = useAnimatedProps(() => ({
    opacity: 0.07 + breath.value * 0.09,
  }));
  const haloProps = useAnimatedProps(() => ({
    opacity: 0.03 + breath.value * 0.05,
  }));
  const pulse1Props = useAnimatedProps(() => ({
    opacity: (1 - pulse1.value) * 0.2,
    r: 36 + pulse1.value * 10,
  }));
  const pulse2Props = useAnimatedProps(() => ({
    opacity: (1 - pulse2.value) * 0.15,
    r: 36 + pulse2.value * 11,
  }));
  const igniteProps = useAnimatedProps(() => ({
    opacity: (1 - ignite.value) * 0.5,
    r: 38 + ignite.value * 16,
  }));
  const progressProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - (progress ? progress.value : 0)),
  }));

  const flameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breath.value * 0.05 }],
  }));

  return (
    <View style={{ width: diameter, height: diameter }}>
      <Svg width={diameter} height={diameter} viewBox="0 0 100 100">
        {/* Soft outer halo + inner glow — the lamp breathes */}
        <AnimatedCircle cx="50" cy="50" r="46" fill={C.gold} animatedProps={haloProps} />
        <AnimatedCircle cx="50" cy="50" r="33" fill={C.gold} animatedProps={glowProps} />
        {/* Slow pulse waves rolling outward */}
        <AnimatedCircle cx="50" cy="50" fill="none" stroke={C.gold} strokeWidth="0.8" animatedProps={pulse1Props} />
        <AnimatedCircle cx="50" cy="50" fill="none" stroke={C.gold} strokeWidth="0.5" animatedProps={pulse2Props} />

        {showRing && (
          <>
            {/* Ignite flash when a watch begins */}
            <AnimatedCircle cx="50" cy="50" fill="none" stroke={C.gold} strokeWidth="1" animatedProps={igniteProps} />
            {/* Ring of time: track + golden progress arc */}
            <Circle cx="50" cy="50" r={RING_RADIUS} fill="none" stroke={C.goldLight} strokeWidth="1.7" />
            <AnimatedCircle
              cx="50"
              cy="50"
              r={RING_RADIUS}
              fill="none"
              stroke={C.gold}
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeDasharray={`${CIRCUMFERENCE}`}
              animatedProps={progressProps}
              transform="rotate(-90 50 50)"
            />
          </>
        )}
      </Svg>

      <Animated.View style={[s.flameWrap, flameStyle]} pointerEvents="none">
        <LottieFlame size={flame} />
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  flameWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
