import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Line, Path } from 'react-native-svg';
import { F } from '@/constants/tokens';
import { BANKED, BankedWeave, EmberPulse, LedgerCartouche } from '@/components/shared/BankedEmber';
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
  color = GOLD,
  slow = false,
}: {
  size: number;
  delay: number;
  style: object;
  color?: string;
  slow?: boolean;
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
        withTiming(1, { duration: slow ? 4400 : 2400, easing: Easing.inOut(Easing.quad) }),
        -1,
        true
      )
    );
    return () => cancelAnimation(t);
  }, [reduceMotion, delay, slow, t]);

  // Banked: the sparks are half as bright and take nearly twice as long.
  const twinkle = useAnimatedStyle(() => ({
    opacity: slow ? 0.07 + t.value * 0.19 : 0.14 + t.value * 0.42,
  }));

  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute' }, style, twinkle]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d={SPARKLE_PATH} fill={color} />
      </Svg>
    </Animated.View>
  );
}

// Card-wide backdrop: the shared hairline weave plus the twinkling sparkles.
export function TrophyShineBackdrop({ muted = false }: { muted?: boolean }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const step = 30;
  const lineCount = !muted && box.w > 0 ? Math.ceil((box.w + box.h) / step) + 1 : 0;
  const sparkleColor = muted ? BANKED.ember : GOLD;

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={event => {
        const { width, height } = event.nativeEvent.layout;
        setBox({ w: width, h: height });
      }}
    >
      {/* Resting, the single gold rake gives way to the counter-raked ash
          weave — laid paper instead of a drained gold field. */}
      {muted && <BankedWeave />}
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
      <Sparkle size={13} delay={0} style={{ right: 92, top: 40 }} color={sparkleColor} slow={muted} />
      <Sparkle size={9} delay={900} style={{ right: 14, top: 24 }} color={sparkleColor} slow={muted} />
      <Sparkle size={11} delay={1700} style={{ right: 34, top: 104 }} color={sparkleColor} slow={muted} />
      <Sparkle size={8} delay={2600} style={{ left: 150, top: 30 }} color={sparkleColor} slow={muted} />
    </View>
  );
}

// An open illustrated streak signature: the value and label stay readable,
// while a small tilted trophy turns the metric into a quiet award moment.
// There is deliberately no enclosing badge competing with the parent card.
export function StreakMedallion({
  value,
  size = 74,
  banked = false,
}: {
  value: number;
  size?: number;
  banked?: boolean;
}) {
  const normalizedValue = Math.max(0, Math.trunc(value));
  const displayValue = normalizedValue >= 1_000_000
    ? `${Math.floor(normalizedValue / 1_000_000)}M`
    : normalizedValue >= 1_000
      ? `${Math.floor(normalizedValue / 1_000)}K`
      : String(normalizedValue);
  // A held streak is still an earned one — the number keeps its full weight
  // and only the bloom around it cools. A streak of zero on a banked day has
  // nothing to show, so the well takes a ruled entry instead.
  const ruled = banked && normalizedValue === 0;
  const extraCharacters = ruled ? 0 : Math.max(0, displayValue.length - 1);
  const digitExpansion = extraCharacters === 0
    ? 0
    : size * 0.28 + Math.max(0, extraCharacters - 1) * size * 0.18;
  const valueFontScale = displayValue.length >= 3 ? 0.59 : 0.63;
  const ornamentSpacing = size * 0.16;
  const dormant = !banked && normalizedValue === 0;
  const width = size * 2.05 + digitExpansion + ornamentSpacing;
  const height = size * 0.92;

  return (
    <View style={{ width, height }}>
      <Svg
        pointerEvents="none"
        width={width * 1.14}
        height={height * 1.12}
        style={{ position: 'absolute', left: -width * 0.07, top: -height * 0.06 }}
      >
        {/* Layered ellipses, darker rim to lightest heart — the inverse of the
            Year in Pixels medallion, so the number sits in the brightest pool.
            The canvas runs wider than the medallion so the bloom can spread. */}
        <Ellipse
          cx={width * 0.52}
          cy={height * 0.56}
          rx={width * 0.52}
          ry={height * 0.52}
          fill={banked ? BANKED.bloomRim : '#EBD5A0'}
          opacity={0.8}
          transform={`rotate(-5 ${width * 0.52} ${height * 0.56})`}
        />
        <Ellipse
          cx={width * 0.52}
          cy={height * 0.53}
          rx={width * 0.46}
          ry={height * 0.44}
          fill={banked ? BANKED.bloomMid : '#F5E5BE'}
          opacity={0.85}
          transform={`rotate(4 ${width * 0.52} ${height * 0.53})`}
        />
        <Ellipse
          cx={width * 0.49}
          cy={height * 0.57}
          rx={width * 0.42}
          ry={height * 0.39}
          fill={banked ? BANKED.bloomHeart : '#FFF8E4'}
          opacity={0.95}
          transform={`rotate(-3 ${width * 0.49} ${height * 0.57})`}
        />
        {/* The engraved curve under the number, broken into dashes once the
            day can no longer advance the streak. */}
        <Path
          d={`M ${size * 0.13 + width * 0.07} ${height * 0.82} C ${width * 0.43} ${height * 1.01}, ${width * 0.76} ${height * 0.97}, ${width * 1.0} ${height * 0.64}`}
          fill="none"
          stroke={banked ? BANKED.ash : GOLD}
          strokeOpacity={banked ? 0.44 : 0.3}
          strokeWidth={1.15}
          strokeLinecap="round"
          strokeDasharray={banked ? '3 5' : undefined}
        />
        <Line
          x1={size * 0.73 + digitExpansion + width * 0.07}
          y1={height * 0.32}
          x2={size * 0.73 + digitExpansion + width * 0.07}
          y2={height * 0.78}
          stroke={banked ? BANKED.ash : GOLD}
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
        {ruled ? (
          <LedgerCartouche width={size * 0.56} height={size * 0.4} />
        ) : (
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
        )}
      </View>

      <View
        style={[
          medallionStyles.copy,
          { left: size * 0.82 + digitExpansion, top: height * 0.27 },
        ]}
      >
        <Text style={[medallionStyles.eyebrow, banked && medallionStyles.eyebrowBanked]} numberOfLines={1}>
          CURRENT
        </Text>
        <Text style={[medallionStyles.label, banked && medallionStyles.labelBanked]} numberOfLines={1}>
          STREAK
        </Text>
        <View style={[medallionStyles.copyRule, banked && medallionStyles.copyRuleBanked]} />
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
            banked && medallionStyles.miniTrophyGlowBanked,
          ]}
        />
        {/* A tinted Image must never share its key with an untinted one — the
            template render sticks and the emblem comes back painted. */}
        <Image
          key={banked ? 'mini-trophy-ash' : 'mini-trophy-gold'}
          source={TROPHY_EMBLEM}
          resizeMode="contain"
          style={[
            { width: size * 0.45, height: size * 0.45, transform: [{ rotate: '-11deg' }] },
            banked && medallionStyles.miniTrophyBanked,
          ]}
        />
      </View>

      <View pointerEvents="none" style={[medallionStyles.glint, { right: size * 0.03, top: height * 0.06 }, banked && medallionStyles.glintBanked]} />
      <View pointerEvents="none" style={[medallionStyles.glintSmall, { right: size * 0.53, top: height * 0.12 }, banked && medallionStyles.glintBanked]} />
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
  eyebrowBanked: {
    color: BANKED.inkSoft,
  },
  label: {
    fontFamily: F.sansBold,
    fontSize: 12,
    lineHeight: 14,
    letterSpacing: 1.3,
    color: '#6F5016',
  },
  labelBanked: {
    color: BANKED.ink,
  },
  copyRule: {
    width: 27,
    height: 1,
    marginTop: 4,
    borderRadius: 1,
    backgroundColor: 'rgba(169,134,63,0.45)',
  },
  copyRuleBanked: {
    backgroundColor: BANKED.ashLine,
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
  miniTrophyGlowBanked: {
    backgroundColor: 'rgba(198,181,148,0.26)',
  },
  miniTrophyBanked: {
    tintColor: '#C6B594',
    opacity: 0.78,
  },
  glintBanked: {
    backgroundColor: BANKED.ashLine,
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
//
// `halo` is the hero dress the Trophy Streak card wears — a hairline ring
// around the burst, and the burst turning imperceptibly slowly, one
// revolution a minute, the same clock Home's sun keeps. Small inline
// emblems leave it off and stay perfectly still.
//
// Banked, everything is held: the rays pull back to even stubs, the ring
// breaks into dashes, the emblem cools to ash, and only a slow coal keeps
// glowing behind it.
export function RadiantTrophy({
  size = 62,
  banked = false,
  halo = false,
}: {
  size?: number;
  banked?: boolean;
  halo?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const field = size * 1.9;
  const cx = field / 2;
  const inner = size * 0.62;
  const ringR = inner * 0.92;
  const rayColor = banked ? BANKED.ash : GOLD;
  const spin = useSharedValue(0);

  useEffect(() => {
    spin.value = 0;
    if (reduceMotion || banked || !halo) return;
    spin.value = withRepeat(
      withTiming(1, { duration: 60000, easing: Easing.linear }),
      -1,
      false
    );
    return () => cancelAnimation(spin);
  }, [banked, halo, reduceMotion, spin]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: size * 1.35,
          height: size * 1.35,
          borderRadius: (size * 1.35) / 2,
          backgroundColor: banked ? 'rgba(206,193,166,0.22)' : 'rgba(216,182,114,0.20)',
        }}
      />
      {banked && <EmberPulse size={size * 0.52} />}

      {/* Hairline halo — steady while the burst turns, dashed once banked. */}
      {(halo || banked) && (
        <Svg pointerEvents="none" width={field} height={field} style={{ position: 'absolute' }}>
          <Circle
            cx={cx}
            cy={cx}
            r={ringR}
            fill="none"
            stroke={rayColor}
            strokeOpacity={banked ? 0.46 : 0.28}
            strokeWidth={1}
            strokeDasharray={banked ? '3 6' : undefined}
          />
          {/* The outer orbit on a slower dash rhythm — a layered instrument
              face rather than one broken circle. */}
          {banked && (
            <Circle
              cx={cx}
              cy={cx}
              r={ringR + size * 0.22}
              fill="none"
              stroke={rayColor}
              strokeOpacity={0.24}
              strokeWidth={1}
              strokeDasharray="2 9"
            />
          )}
        </Svg>
      )}

      <Animated.View pointerEvents="none" style={[{ position: 'absolute' }, spinStyle]}>
        <Svg width={field} height={field}>
          {Array.from({ length: 12 }).map((_, index) => {
            const angle = (index / 12) * Math.PI * 2 - Math.PI / 2;
            const long = !banked && index % 2 === 0;
            const r1 = inner;
            const r2 = inner + (banked ? size * 0.09 : long ? size * 0.30 : size * 0.17);
            return (
              <Line
                key={index}
                x1={cx + r1 * Math.cos(angle)}
                y1={cx + r1 * Math.sin(angle)}
                x2={cx + r2 * Math.cos(angle)}
                y2={cx + r2 * Math.sin(angle)}
                stroke={rayColor}
                strokeOpacity={banked ? 0.28 : long ? 0.42 : 0.24}
                strokeWidth={banked ? 1 : long ? 1.7 : 1.3}
                strokeLinecap="round"
              />
            );
          })}
        </Svg>
      </Animated.View>

      {/* A tinted Image must never share its key with an untinted one. */}
      <Image
        key={banked ? 'trophy-ash' : 'trophy-gold'}
        source={TROPHY_EMBLEM}
        style={[{ width: size, height: size }, banked && trophyStyles.emblemBanked]}
        resizeMode="contain"
      />
    </View>
  );
}

const trophyStyles = StyleSheet.create({
  emblemBanked: {
    tintColor: '#C6B594',
    opacity: 0.72,
  },
});
