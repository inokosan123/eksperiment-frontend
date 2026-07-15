import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient as SvgLinearGradient, Path, Stop } from 'react-native-svg';
import { F } from '@/constants/tokens';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

// The trophy card's own language — not an instrument, a small celebration.
// Golden rays burst from behind the real trophy emblem, and a few four-point
// sparkles twinkle across the card at their own quiet rhythms. The diagonal
// hairline weave ties it to the rest of the tab; everything else is unique
// to the streak.

const TROPHY_EMBLEM = require('@/assets/animations/challenge-trophy-preview.png');
const GOLD = '#C5A059';

const SPARKLE_PATH = 'M12 0 C13.2 7.4 16.6 10.8 24 12 C16.6 13.2 13.2 16.6 12 24 C10.8 16.6 7.4 13.2 0 12 C7.4 10.8 10.8 7.4 12 0 Z';

function Sparkle({
  size,
  delay,
  style,
}: {
  size: number;
  delay: number;
  style: object;
}) {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      t.value = 0.5;
      return;
    }
    t.value = 0;
    t.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.quad) }),
        -1,
        true
      )
    );
    return () => cancelAnimation(t);
  }, [reduceMotion, delay, t]);

  const twinkle = useAnimatedStyle(() => ({
    opacity: 0.14 + t.value * 0.42,
  }));

  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute' }, style, twinkle]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d={SPARKLE_PATH} fill={GOLD} />
      </Svg>
    </Animated.View>
  );
}

// Card-wide backdrop: the shared hairline weave plus the twinkling sparkles.
export function TrophyShineBackdrop() {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const step = 30;
  const lineCount = box.w > 0 ? Math.ceil((box.w + box.h) / step) + 1 : 0;

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={event => {
        const { width, height } = event.nativeEvent.layout;
        setBox({ w: width, h: height });
      }}
    >
      {lineCount > 0 && (
        <Svg width={box.w} height={box.h} style={StyleSheet.absoluteFill}>
          {Array.from({ length: lineCount }).map((_, index) => {
            const offset = index * step;
            return (
              <Line
                key={index}
                x1={offset}
                y1={-4}
                x2={offset - box.h - 8}
                y2={box.h + 4}
                stroke={GOLD}
                strokeOpacity={0.05}
                strokeWidth={1}
              />
            );
          })}
        </Svg>
      )}
      <Sparkle size={13} delay={0} style={{ right: 92, top: 40 }} />
      <Sparkle size={9} delay={900} style={{ right: 14, top: 24 }} />
      <Sparkle size={11} delay={1700} style={{ right: 34, top: 104 }} />
      <Sparkle size={8} delay={2600} style={{ left: 150, top: 30 }} />
    </View>
  );
}

// The streak count struck as a coin: a warm ivory face with a fine gold rim,
// a 24-tick bezel just inside it (the day-clock echo used across the tab) and
// a hairline inner ring framing the serif number.
export function StreakMedallion({ value, size = 74 }: { value: number; size?: number }) {
  const c = size / 2;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: c,
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 5px 14px rgba(122, 94, 36, 0.14)',
      }}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinearGradient id="streakMedalFace" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFEF9" />
            <Stop offset="1" stopColor="#F9EFD5" />
          </SvgLinearGradient>
        </Defs>
        <Circle cx={c} cy={c} r={c - 0.8} fill="url(#streakMedalFace)" stroke="rgba(169,134,63,0.55)" strokeWidth={1} />
        {Array.from({ length: 24 }).map((_, index) => {
          const angle = (index / 24) * Math.PI * 2;
          const strong = index % 6 === 0;
          const r1 = c - (strong ? 6.4 : 5.4);
          const r2 = c - 2.6;
          return (
            <Line
              key={index}
              x1={c + r1 * Math.cos(angle)}
              y1={c + r1 * Math.sin(angle)}
              x2={c + r2 * Math.cos(angle)}
              y2={c + r2 * Math.sin(angle)}
              stroke={GOLD}
              strokeOpacity={strong ? 0.5 : 0.28}
              strokeWidth={strong ? 1.2 : 1}
            />
          );
        })}
        <Circle cx={c} cy={c} r={c - 9} stroke={GOLD} strokeOpacity={0.24} strokeWidth={1} fill="none" />
      </Svg>
      <Text style={medallionStyles.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>
        {value}
      </Text>
    </View>
  );
}

const medallionStyles = StyleSheet.create({
  value: {
    maxWidth: '68%',
    fontFamily: F.serifSemiBold,
    fontSize: 31,
    letterSpacing: -0.4,
    color: '#3D3322',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
});

// The emblem itself: a soft glow disc and a golden ray burst behind the real
// trophy PNG. Rays alternate long/short like a struck medal.
export function RadiantTrophy({ size = 62 }: { size?: number }) {
  const field = size * 1.9;
  const cx = field / 2;
  const inner = size * 0.62;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: size * 1.35,
          height: size * 1.35,
          borderRadius: (size * 1.35) / 2,
          backgroundColor: 'rgba(216,182,114,0.20)',
        }}
      />
      <Svg
        pointerEvents="none"
        width={field}
        height={field}
        style={{ position: 'absolute' }}
      >
        {Array.from({ length: 12 }).map((_, index) => {
          const angle = (index / 12) * Math.PI * 2 - Math.PI / 2;
          const long = index % 2 === 0;
          const r1 = inner;
          const r2 = inner + (long ? size * 0.30 : size * 0.17);
          return (
            <Line
              key={index}
              x1={cx + r1 * Math.cos(angle)}
              y1={cx + r1 * Math.sin(angle)}
              x2={cx + r2 * Math.cos(angle)}
              y2={cx + r2 * Math.sin(angle)}
              stroke={GOLD}
              strokeOpacity={long ? 0.42 : 0.24}
              strokeWidth={long ? 1.7 : 1.3}
              strokeLinecap="round"
            />
          );
        })}
      </Svg>
      <Image source={TROPHY_EMBLEM} style={{ width: size, height: size }} resizeMode="contain" />
    </View>
  );
}
