import { useEffect } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
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
const PULSE_PERIOD = 6600;

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

// The Focus centerpiece. A breathing aura, a soft bed of light and three slow
// waves rise from the emblem's own edge, so the Lottie and the circles read
// as one living thing. The aura turns green while protection stands guard,
// and the emblem itself can alternate between the shield and the phone.
export default function GuardedPhone({
  diameter = 150,
  sealed = false,
  progress,
  progressColor = C.gold,
  aura = C.gold,
  face,
}: {
  diameter?: number;
  sealed?: boolean;
  progress?: SharedValue<number>;
  // The ring of time is gold while the day is kept; a broken day mutes it.
  progressColor?: string;
  // Aura color: gold at rest, green while protection is active.
  aura?: string;
  // Which emblem lives inside; defaults follow `sealed`.
  face?: 'shield' | 'phone';
}) {
  const breath = useSharedValue(0);
  const pulse1 = useSharedValue(0);
  const pulse2 = useSharedValue(0);
  const pulse3 = useSharedValue(0);
  const ignite = useSharedValue(1);
  const seal = useSharedValue(sealed ? 1 : 0);
  const showRing = !!progress;
  const shownFace: 'shield' | 'phone' = face ?? (sealed ? 'shield' : 'phone');
  // Under active protection the emblem moves rarely — guarding is a calm
  // state, not a show. The idle gold state keeps its livelier rhythm.
  const guarded = aura !== C.gold;
  const restMs = guarded ? 9000 : 4500;

  useEffect(() => {
    breath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2700, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 2700, easing: Easing.inOut(Easing.quad) })
      ),
      -1
    );
    pulse1.value = withRepeat(
      withTiming(1, { duration: PULSE_PERIOD, easing: Easing.out(Easing.quad) }),
      -1
    );
    pulse2.value = withDelay(
      PULSE_PERIOD / 3,
      withRepeat(withTiming(1, { duration: PULSE_PERIOD, easing: Easing.out(Easing.quad) }), -1)
    );
    pulse3.value = withDelay(
      (PULSE_PERIOD / 3) * 2,
      withRepeat(withTiming(1, { duration: PULSE_PERIOD, easing: Easing.out(Easing.quad) }), -1)
    );
    return () => {
      cancelAnimation(breath);
      cancelAnimation(pulse1);
      cancelAnimation(pulse2);
      cancelAnimation(pulse3);
    };
  }, [breath, pulse1, pulse2, pulse3]);

  useEffect(() => {
    seal.value = withTiming(sealed ? 1 : 0, {
      duration: 650,
      easing: Easing.inOut(Easing.quad),
    });
  }, [sealed, seal]);

  // One-shot flash when the ring of time first appears — the day ignites.
  useEffect(() => {
    if (showRing) {
      ignite.value = 0;
      ignite.value = withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) });
    }
  }, [showRing, ignite]);

  const haloProps = useAnimatedProps(() => ({
    opacity: (0.05 + breath.value * 0.06) * (0.6 + seal.value * 0.4),
  }));
  // The bed of light directly under the emblem — breathes with the halo so
  // the Lottie sits inside the circles instead of floating over them.
  const bedProps = useAnimatedProps(() => ({
    opacity: (0.1 + breath.value * 0.08) * (0.65 + seal.value * 0.35),
    r: 29 + breath.value * 1.6,
  }));
  const pulse1Props = useAnimatedProps(() => ({
    opacity: (1 - pulse1.value) * 0.22 * (0.75 + seal.value * 0.25),
    r: 34 + pulse1.value * 13,
  }));
  const pulse2Props = useAnimatedProps(() => ({
    opacity: (1 - pulse2.value) * 0.17 * (0.75 + seal.value * 0.25),
    r: 34 + pulse2.value * 13,
  }));
  const pulse3Props = useAnimatedProps(() => ({
    opacity: (1 - pulse3.value) * 0.12 * (0.75 + seal.value * 0.25),
    r: 34 + pulse3.value * 13,
  }));
  const igniteProps = useAnimatedProps(() => ({
    opacity: (1 - ignite.value) * 0.5,
    r: 36 + ignite.value * 14,
  }));
  const progressProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - (progress ? progress.value : 0)),
  }));

  // The shield sits a touch lower inside the halo so it feels grounded in
  // the protective ring on real phones.
  const lottieSize = Math.round(diameter * (shownFace === 'shield' ? 0.66 : 0.74));
  const lottieLift = shownFace === 'shield' ? Math.round(diameter * 0.035) : 0;

  return (
    <View style={{ width: diameter, height: diameter }}>
      <Svg width={diameter} height={diameter} viewBox="0 0 100 100">
        <AnimatedCircle cx="50" cy="50" r="46" fill={aura} animatedProps={haloProps} />
        <AnimatedCircle cx="50" cy="50" fill={aura} animatedProps={bedProps} />
        <AnimatedCircle cx="50" cy="50" fill="none" stroke={aura} strokeWidth="1.1" animatedProps={pulse1Props} />
        <AnimatedCircle cx="50" cy="50" fill="none" stroke={aura} strokeWidth="0.9" animatedProps={pulse2Props} />
        <AnimatedCircle cx="50" cy="50" fill="none" stroke={aura} strokeWidth="0.7" animatedProps={pulse3Props} />

        {showRing && (
          <>
            <AnimatedCircle cx="50" cy="50" fill="none" stroke={aura} strokeWidth="1" animatedProps={igniteProps} />
            <Circle cx="50" cy="50" r={RING_RADIUS} fill="none" stroke={C.goldLight} strokeWidth="1.7" />
            <AnimatedCircle
              cx="50"
              cy="50"
              r={RING_RADIUS}
              fill="none"
              stroke={progressColor}
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
        <WebPhoneFallback diameter={diameter} sealed={shownFace === 'shield'} />
      ) : (
        <Animated.View
          key={shownFace}
          entering={FadeIn.duration(700)}
          exiting={FadeOut.duration(320)}
          style={s.lottieWrap}
          pointerEvents="none"
        >
          {shownFace === 'shield' ? (
            <FocusWatchLottie
              name="check-shield"
              mode="periodic"
              restMs={restMs}
              speed={0.8}
              style={{
                width: lottieSize,
                height: lottieSize,
                transform: [{ translateY: lottieLift }],
              }}
            />
          ) : (
            <FocusWatchLottie
              name="iphone"
              mode="periodic"
              restMs={restMs}
              speed={guarded ? 0.85 : 1}
              style={{ width: lottieSize, height: lottieSize }}
            />
          )}
        </Animated.View>
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
