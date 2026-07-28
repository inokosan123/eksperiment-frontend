import { useCallback, useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { ArrowUpRight } from '@/components/icons/Icons';
import { F } from '@/constants/tokens';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import type { SectionCardConfig } from '@/components/shared/sectionCardData';
import {
  placeRibbonStars,
  ribbonCardRhythm,
  ribbonEmblem,
  type PlacedStar,
} from '@/components/shared/ribbonCardGeometry';

/* ─────────────────────────────────────────────────────────────
 * RIBBON — the section card.
 *
 * The plate runs from near-white at the shoulder to full, saturated
 * colour at the foot, and the emblem is large and unashamed in that
 * colour, bleeding off the right edge. Two constellations kindle on
 * it, on two clocks that never keep time with each other.
 *
 * The rules it is built on:
 *
 * · COLOUR IS LIFTED, NOT WHITENED. Mixing a deep colour toward white
 *   destroys its saturation — the app's green falls from 72% to 30%
 *   that way — so every tone is built in HSL with the hue kept, the
 *   saturation held, and only lightness raised.
 *
 * · TYPE IS THE APP'S TYPE. Garamond for the title AND the sentence,
 *   Inter only for the small tracked eyebrow, exactly as the original
 *   card sets them.
 *
 * · THE PLATE IS MEASURED, NOT ASSUMED. It was drawn in a lab shell
 *   34pt narrower than the real card, and the real card itself swings
 *   110pt between a small phone and a large one. Positions come from
 *   `ribbonCardGeometry`, which resolves them against the measured
 *   plate; that costs one extra render at mount and buys a design
 *   that is provably clean at every size (`tests/ribbon-card.test.ts`)
 *   rather than checked by eye on one device.
 *
 * · SIX SHARE A SCREEN. So: two clocks per card and nothing else, the
 *   whole constellation in ONE <Svg> rather than eight, opacity only,
 *   never scale, and the plate, its gradient and its sheen drawn once
 *   and never animated.
 * ───────────────────────────────────────────────────────────── */

/** How long each constellation stays lit, as a share of its cycle. */
const WINDOW = { shoulder: 0.34, foot: 0.42 } as const;
/** 16 against 10: the two clusters only realign every eighty seconds. */
const PERIOD = { shoulder: 16000, foot: 10000 } as const;

function toHsl(hex: string): { h: number; s: number; l: number } {
  const m = hex.replace('#', '');
  const v = m.length === 3 ? m.split('').map(c => c + c).join('') : m;
  const n = parseInt(v, 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r
    ? (g - b) / d + (g < b ? 6 : 0)
    : max === g
      ? (b - r) / d + 2
      : (r - g) / d + 4;
  return { h: (h / 6) * 360, s: s * 100, l: l * 100 };
}

/**
 * The card's hue at a chosen lightness, with saturation held at or above a
 * floor.
 *
 * The floor is skipped for a colour that has almost none to begin with.
 * Library's Bible Notes card is a true neutral (#5B564F, 7% saturation);
 * forcing it to 70 would invent a hue it never had and turn a grey card
 * gold. A neutral must be allowed to stay neutral.
 */
function lit(hex: string, lightness: number, satFloor = 70): string {
  const { h, s } = toHsl(hex);
  const sat = s < 14 ? s : Math.max(s, satFloor);
  return `hsl(${Math.round(h)} ${Math.round(sat)}% ${lightness}%)`;
}

function deep(hex: string, lightness: number, satFloor = 55): string {
  const { h, s } = toHsl(hex);
  const sat = s < 14 ? s : Math.max(s, satFloor);
  return `hsl(${Math.round(h)} ${Math.round(sat)}% ${lightness}%)`;
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * One spark.
 *
 * It is a <Path> inside the card's single <Svg> rather than an Svg of its
 * own: eight surfaces per card, six cards to a screen, was the one part of
 * this design with a real cost. Its place and its tilt arrive as finished
 * path data, so opacity is the only thing that moves — at eight to twelve
 * points a four-fold spark turning through seventy degrees is not something
 * the eye can find, and giving that up is what lets the whole field share
 * one Svg.
 */
function Star({
  star, clock, color, still, offset,
}: {
  star: PlacedStar;
  clock: SharedValue<number>;
  color: string;
  still: boolean;
  /** where this card sits in the stack's rhythm */
  offset: number;
}) {
  const window = WINDOW[star.clock];
  const animatedProps = useAnimatedProps(() => {
    if (still) return { opacity: star.peak * 0.5 };
    const p = (clock.value + star.phase + offset) % 1;
    const on = p < window ? Math.sin((p / window) * Math.PI) : 0;
    return { opacity: on * star.peak };
  });

  return <AnimatedPath d={star.d} fill={color} animatedProps={animatedProps} />;
}

function useClock(reduceMotion: boolean, duration: number) {
  const clock = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    clock.value = 0;
    clock.value = withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(clock);
  }, [clock, duration, reduceMotion]);
  return clock;
}

type Props = SectionCardConfig & {
  onPress?: () => void;
  /**
   * Where this card sits in its stack. It buys the card its own moment and
   * its own tempo — see `ribbonCardRhythm`. Left out, every card on a screen
   * keeps identical time with every other.
   */
  index?: number;
};

export default function RibbonSectionCard({
  label, title, description, titleColor, arrowBg,
  Decor, decorColor, decorUpright, onPress, index = 0,
}: Props) {
  const reduceMotion = useReducedMotion();
  // Its own moment in the cycle, and its own slightly different length of
  // cycle, so it never falls back into step with the card above it.
  const rhythm = ribbonCardRhythm(index);
  const footClock = useClock(reduceMotion, PERIOD.foot * rhythm.stretch);
  const shoulderClock = useClock(reduceMotion, PERIOD.shoulder * rhythm.stretch);

  // The plate's own size. Nothing decorative can be placed until it is known,
  // and everything decorative follows from it.
  const [plate, setPlate] = useState({ w: 0, h: 0 });
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setPlate(prev =>
      Math.abs(prev.w - width) < 0.5 && Math.abs(prev.h - height) < 0.5
        ? prev
        : { w: width, h: height });
  }, []);

  const tint = decorColor ?? titleColor;
  const measured = plate.w > 0 && plate.h > 0;
  const stars = measured ? placeRibbonStars(plate.w, plate.h) : [];
  const emblem = measured ? ribbonEmblem(plate.w, plate.h) : null;

  // The emblem's light swells as the wave reaches the two stars nearest it,
  // off the same clock — so the card reads as one system rather than two
  // things moving near each other.
  const markStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { opacity: 0.34 };
    const p = (footClock.value + 0.71 + rhythm.offset) % 1;
    const near = p < WINDOW.foot ? Math.sin((p / WINDOW.foot) * Math.PI) : 0;
    return { opacity: 0.26 + near * 0.16 };
  });

  return (
    <TouchableOpacity
      onPress={onPress}
      onLayout={onLayout}
      activeOpacity={0.86}
      style={[s.plate, { borderColor: lit(tint, 74, 62) }]}
    >
      <LinearGradient
        colors={[lit(tint, 97), lit(tint, 88), lit(tint, 76, 76)]}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View pointerEvents="none" style={s.litEdge} />

      {/* A pane of light gathered at the shoulder, drawn once and left still.
          It runs corner to corner and reaches transparent well before any
          edge: a fading layer that stops mid-card draws a hard line across
          it as cleanly as if you had ruled one. */}
      <LinearGradient
        colors={['rgba(255,255,255,0.5)', 'rgba(255,255,255,0)']}
        locations={[0, 0.55]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {Decor && emblem && (
        <Animated.View
          pointerEvents="none"
          style={[
            s.mark,
            { right: emblem.right, bottom: emblem.bottom },
            decorUpright && s.markUpright,
            markStyle,
          ]}
        >
          <Decor s={emblem.size} c={deep(tint, 42)} w={1.2} />
        </Animated.View>
      )}

      {/* The whole field — both constellations — in a single surface. */}
      {measured && (
        <Svg
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          width={plate.w}
          height={plate.h}
        >
          {stars.map((star, i) => (
            <Star
              key={i}
              star={star}
              clock={star.clock === 'foot' ? footClock : shoulderClock}
              color={star.tone === 'light' ? '#FFFFFF' : deep(tint, 51)}
              still={reduceMotion}
              offset={rhythm.offset}
            />
          ))}
        </Svg>
      )}

      <View style={[s.arrow, { backgroundColor: arrowBg }]} pointerEvents="none">
        <View style={s.arrowTilt}>
          <ArrowUpRight s={15} c="#fff" w={2.5} />
        </View>
      </View>

      <View style={s.body}>
        <Text style={[s.label, { color: deep(tint, 36) }]}>{label}</Text>
        <Text style={[s.title, { color: titleColor }]}>{title}</Text>
        <Text style={[s.desc, { color: deep(tint, 32) }]}>{description}</Text>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  plate: {
    position: 'relative',
    borderRadius: 26,
    borderCurve: 'continuous',
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
    // The app's own card shadow — Habits, Journal and the original section
    // card all sit on this one.
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 4,
  },
  litEdge: {
    position: 'absolute',
    top: 1,
    left: 24,
    right: 24,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  mark: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-8deg' }],
  },
  // The Cross reads as broken when tilted, so it stands square.
  markUpright: { transform: [{ rotate: '0deg' }] },
  arrow: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  arrowTilt: { transform: [{ rotate: '-15deg' }] },
  body: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 18, maxWidth: '82%' },
  label: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.4, textTransform: 'uppercase', marginBottom: 8 },
  title: { fontFamily: F.serifMedium, fontSize: 28, lineHeight: 32, letterSpacing: -0.3, marginBottom: 4 },
  desc: { fontFamily: F.serif, fontSize: 16, lineHeight: 23 },
});
