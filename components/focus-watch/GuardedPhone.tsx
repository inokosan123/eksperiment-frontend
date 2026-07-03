import { useEffect } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { C } from '@/constants/tokens';
import FocusWatchLottie from './FocusWatchLottie';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const RING_RADIUS = 45;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// Little app tiles for the web fallback phone — the section-card palette.
const TILE_COLORS = [
  '#F5CDD3', '#F0E3B8', '#C8E6DD',
  '#DDD5ED', '#E9E7E1', '#F5CDD3',
  '#C8E6DD', '#DDD5ED', '#F0E3B8',
  '#E9E7E1', '#F0E3B8', '#F5CDD3',
];
const TILE_XS = [40, 47.5, 55];
const TILE_YS = [30, 38, 46, 54];

function WebPhoneFallback({ diameter, sealed }: { diameter: number; sealed: boolean }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={diameter} height={diameter} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
        <Rect x="34" y="21" width="32" height="58" rx="8" fill="#FFFFFF" stroke="#57534E" strokeWidth="2.1" />
        <Line x1="46" y1="26.5" x2="54" y2="26.5" stroke="#D6D3D1" strokeWidth="1.5" strokeLinecap="round" />
        <Line x1="45" y1="74" x2="55" y2="74" stroke="#E7E5E0" strokeWidth="1.5" strokeLinecap="round" />
        {!sealed &&
          TILE_YS.map((y, row) =>
            TILE_XS.map((x, col) => (
              <Rect
                key={`${row}-${col}`}
                x={x} y={y} width="5.2" height="5.2" rx="1.7"
                fill={TILE_COLORS[row * 3 + col]}
              />
            ))
          )}
        {sealed && (
          <>
            <Circle cx="50" cy="47" r="11" fill={C.gold} opacity="0.13" />
            <Line x1="50" y1="38.5" x2="50" y2="56" stroke={C.gold} strokeWidth="2.5" strokeLinecap="round" />
            <Line x1="43.5" y1="44.5" x2="56.5" y2="44.5" stroke={C.gold} strokeWidth="2.5" strokeLinecap="round" />
          </>
        )}
      </Svg>
    </View>
  );
}

// The Focus centerpiece: breathing gold halo + slow pulse waves around a
// Lottie heart — the living iPhone while all is quiet, the check shield
// while a watch stands guard. With `progress`, a golden ring of time
// closes around it.
export default function GuardedPhone({
  diameter = 150,
  sealed = false,
  progress,
}: {
  diameter?: number;
  sealed?: boolean;
  progress?: SharedValue<number>;
}) {
  const breath = useSharedValue(0);
  const pulse1 = useSharedValue(0);
  const pulse2 = useSharedValue(0);
  const ignite = useSharedValue(1);
  const seal = useSharedValue(sealed ? 1 : 0);
  const showRing = !!progress;

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

  useEffect(() => {
    seal.value = withTiming(sealed ? 1 : 0, {
      duration: 650,
      easing: Easing.inOut(Easing.quad),
    });
  }, [sealed, seal]);

  // One-shot flash when the ring of time first appears — the watch ignites.
  useEffect(() => {
    if (showRing) {
      ignite.value = 0;
      ignite.value = withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) });
    }
  }, [showRing, ignite]);

  const glowProps = useAnimatedProps(() => ({
    opacity: (0.06 + breath.value * 0.08) * (0.4 + seal.value * 0.6),
  }));
  const haloProps = useAnimatedProps(() => ({
    opacity: (0.03 + breath.value * 0.05) * (0.4 + seal.value * 0.6),
  }));
  const pulse1Props = useAnimatedProps(() => ({
    opacity: (1 - pulse1.value) * (0.08 + seal.value * 0.13),
    r: 38 + pulse1.value * 9,
  }));
  const pulse2Props = useAnimatedProps(() => ({
    opacity: (1 - pulse2.value) * (0.06 + seal.value * 0.1),
    r: 38 + pulse2.value * 10,
  }));
  const igniteProps = useAnimatedProps(() => ({
    opacity: (1 - ignite.value) * 0.5,
    r: 38 + ignite.value * 16,
  }));
  const progressProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - (progress ? progress.value : 0)),
  }));

  const lottieSize = Math.round(diameter * (sealed ? 0.56 : 0.72));

  return (
    <View style={{ width: diameter, height: diameter }}>
      <Svg width={diameter} height={diameter} viewBox="0 0 100 100">
        <AnimatedCircle cx="50" cy="50" r="46" fill={C.gold} animatedProps={haloProps} />
        <AnimatedCircle cx="50" cy="50" r="34" fill={C.gold} animatedProps={glowProps} />
        <AnimatedCircle cx="50" cy="50" fill="none" stroke={C.gold} strokeWidth="0.8" animatedProps={pulse1Props} />
        <AnimatedCircle cx="50" cy="50" fill="none" stroke={C.gold} strokeWidth="0.5" animatedProps={pulse2Props} />

        {showRing && (
          <>
            <AnimatedCircle cx="50" cy="50" fill="none" stroke={C.gold} strokeWidth="1" animatedProps={igniteProps} />
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

      {Platform.OS === 'web' ? (
        <WebPhoneFallback diameter={diameter} sealed={sealed} />
      ) : (
        <View style={s.lottieWrap} pointerEvents="none">
          {sealed ? (
            <FocusWatchLottie
              name="check-shield"
              mode="loop"
              speed={0.85}
              style={{ width: lottieSize, height: lottieSize }}
            />
          ) : (
            <FocusWatchLottie
              name="iphone"
              mode="periodic"
              restMs={4500}
              style={{ width: lottieSize, height: lottieSize }}
            />
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  lottieWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
