import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse, Line, Path } from 'react-native-svg';
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

// An open illustrated streak signature: the value and label stay readable,
// while a small tilted trophy turns the metric into a quiet award moment.
// There is deliberately no enclosing badge competing with the parent card.
export function StreakMedallion({ value, size = 74 }: { value: number; size?: number }) {
  const normalizedValue = Math.max(0, Math.trunc(value));
  const displayValue = normalizedValue >= 1_000_000
    ? `${Math.floor(normalizedValue / 1_000_000)}M`
    : normalizedValue >= 1_000
      ? `${Math.floor(normalizedValue / 1_000)}K`
      : String(normalizedValue);
  const extraCharacters = Math.max(0, displayValue.length - 1);
  const digitExpansion = extraCharacters === 0
    ? 0
    : size * 0.28 + Math.max(0, extraCharacters - 1) * size * 0.18;
  const valueFontScale = displayValue.length >= 3 ? 0.59 : 0.63;
  const ornamentSpacing = size * 0.16;
  const dormant = normalizedValue === 0;
  const width = size * 2.05 + digitExpansion + ornamentSpacing;
  const height = size * 0.92;

  return (
    <View style={{ width, height }}>
      <Svg pointerEvents="none" width={width} height={height} style={StyleSheet.absoluteFill}>
        {/* Layered ellipses, darker rim to lightest heart — the inverse of the
            Year in Pixels medallion, so the number sits in the brightest pool. */}
        <Ellipse
          cx={width * 0.48}
          cy={height * 0.5}
          rx={width * 0.48}
          ry={height * 0.48}
          fill="#EBD5A0"
          opacity={0.8}
          transform={`rotate(-5 ${width * 0.48} ${height * 0.5})`}
        />
        <Ellipse
          cx={width * 0.5}
          cy={height * 0.47}
          rx={width * 0.395}
          ry={height * 0.4}
          fill="#F5E5BE"
          opacity={0.85}
          transform={`rotate(4 ${width * 0.5} ${height * 0.47})`}
        />
        <Ellipse
          cx={width * 0.47}
          cy={height * 0.52}
          rx={width * 0.315}
          ry={height * 0.32}
          fill="#FFF8E4"
          opacity={0.95}
          transform={`rotate(-3 ${width * 0.47} ${height * 0.52})`}
        />
        <Path
          d={`M ${size * 0.13} ${height * 0.76} C ${width * 0.36} ${height * 0.95}, ${width * 0.69} ${height * 0.91}, ${width * 0.93} ${height * 0.58}`}
          fill="none"
          stroke={GOLD}
          strokeOpacity={0.3}
          strokeWidth={1.15}
          strokeLinecap="round"
        />
        <Line
          x1={size * 0.73 + digitExpansion}
          y1={height * 0.26}
          x2={size * 0.73 + digitExpansion}
          y2={height * 0.72}
          stroke={GOLD}
          strokeOpacity={0.38}
          strokeWidth={1}
          strokeLinecap="round"
        />
      </Svg>

      <View
        style={[
          medallionStyles.valueWell,
          { left: size * 0.06, width: size * 0.62 + digitExpansion, height },
        ]}
      >
        <Text
          style={[
            medallionStyles.value,
            { fontSize: size * valueFontScale, lineHeight: size * 0.67 },
            dormant && medallionStyles.valueDormant,
          ]}
          numberOfLines={1}
        >
          {displayValue}
        </Text>
      </View>

      <View
        style={[
          medallionStyles.copy,
          { left: size * 0.82 + digitExpansion, top: height * 0.27 },
        ]}
      >
        <Text style={medallionStyles.eyebrow} numberOfLines={1}>
          CURRENT
        </Text>
        <Text style={medallionStyles.label} numberOfLines={1}>
          STREAK
        </Text>
        <View style={medallionStyles.copyRule} />
      </View>

      <View
        pointerEvents="none"
        style={[
          medallionStyles.miniTrophy,
          { right: size * 0.05, top: height * 0.17, width: size * 0.58, height: size * 0.58 },
        ]}
      >
        <View
          style={[
            medallionStyles.miniTrophyGlow,
            { width: size * 0.52, height: size * 0.52, borderRadius: size * 0.26 },
          ]}
        />
        <Image
          source={TROPHY_EMBLEM}
          resizeMode="contain"
          style={{ width: size * 0.45, height: size * 0.45, transform: [{ rotate: '-11deg' }] }}
        />
      </View>

      <View pointerEvents="none" style={[medallionStyles.glint, { right: size * 0.03, top: height * 0.06 }]} />
      <View pointerEvents="none" style={[medallionStyles.glintSmall, { right: size * 0.53, top: height * 0.12 }]} />
    </View>
  );
}

const medallionStyles = StyleSheet.create({
  valueWell: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    width: '100%',
    fontFamily: F.serifSemiBold,
    letterSpacing: -1,
    color: '#4A3820',
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
    fontVariant: ['lining-nums', 'tabular-nums'],
  },
  valueDormant: {
    color: '#9A7F4D',
  },
  copy: {
    position: 'absolute',
    width: 64,
    gap: 1,
    zIndex: 1,
  },
  eyebrow: {
    fontFamily: F.sansBold,
    fontSize: 8.2,
    lineHeight: 10,
    letterSpacing: 1.15,
    color: 'rgba(121,89,30,0.72)',
  },
  label: {
    fontFamily: F.sansBold,
    fontSize: 12,
    lineHeight: 14,
    letterSpacing: 1.3,
    color: '#6F5016',
  },
  copyRule: {
    width: 27,
    height: 1,
    marginTop: 4,
    borderRadius: 1,
    backgroundColor: 'rgba(169,134,63,0.45)',
  },
  miniTrophy: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniTrophyGlow: {
    position: 'absolute',
    backgroundColor: 'rgba(224,190,116,0.3)',
  },
  glint: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 1.5,
    backgroundColor: 'rgba(197,160,89,0.68)',
    transform: [{ rotate: '45deg' }],
  },
  glintSmall: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 1,
    backgroundColor: 'rgba(197,160,89,0.48)',
    transform: [{ rotate: '45deg' }],
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
