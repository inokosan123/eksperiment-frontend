import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  cancelAnimation,
  Easing,
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

/* ─────────────────────────────────────────────────────────────
 * RIBBON — the section card, taken out of the lab.
 *
 * The plate runs from near-white at the shoulder to full,
 * saturated colour at the foot, and the emblem is large and
 * unashamed in that colour, bleeding off the right edge. Two
 * constellations kindle on it, on two clocks that never keep
 * time with each other.
 *
 * Live on Library only for now; Home and Inner still render the
 * original SectionCard, and this file imports nothing from it,
 * so neither can move the other.
 *
 * The rules it is built on:
 *
 * · COLOUR IS LIFTED, NOT WHITENED. Mixing a deep colour toward
 *   white destroys its saturation — the app's green falls from
 *   72% to 30% that way — so every tone is built in HSL with the
 *   hue kept, the saturation held, and only lightness raised.
 *
 * · TYPE IS THE APP'S TYPE. Garamond for the title AND the
 *   sentence, Inter only for the small tracked eyebrow, exactly
 *   as the original card sets them.
 *
 * · SEVEN SHARE A SCREEN, so: two clocks per card and nothing
 *   else; opacity and rotation only, never scale; and the plate,
 *   its gradient and its sheen drawn once and never animated.
 * ───────────────────────────────────────────────────────────── */

const SPARK_PATH =
  'M12 0 C13.2 7.4 16.6 10.8 24 12 C16.6 13.2 13.2 16.6 12 24 C10.8 16.6 7.4 13.2 0 12 C7.4 10.8 10.8 7.4 12 0 Z';

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
 * Library's Bible Notes card is a true neutral (#5B564F, 9% saturation);
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

type StarSpec = {
  right?: number;
  bottom?: number;
  left?: number;
  top?: number;
  size: number;
  phase: number;
  window: number;
  peak: number;
  spin: number;
  /** Sits on the pale shoulder, where white would vanish. */
  onLight?: boolean;
};

const FOOT_WINDOW = 0.42;
const SHOULDER_WINDOW = 0.34;

/* Where a star may stand.
 *
 * The card is 360 wide on a 392pt screen and the type is boxed: the
 * sentence wraps inside x 18–277, the eyebrow ends by x 173 at its
 * longest, the title by x 200, and the arrow holds x 306–350 / y 14–50.
 * That leaves three clean rooms — the right column past x 281, the
 * eighteen-point gutter left of the text, and the pocket beyond the end
 * of the eyebrow. Every star below stands in one of them.
 *
 * ⚠ A foot star is anchored to the BOTTOM, so a large `bottom` lands it
 * near the TOP on a short card — that is how the old set put a star in
 * the title line and half of another off the top edge. The shortest card
 * here is 134 (a two-line sentence), so foot stars keep `bottom` under
 * ~75 and stay below the arrow on every card, not just tall ones.
 */

// Circling the emblem: the three on lighter ground carry the card's own
// tone, the two deepest into the saturated corner carry white.
const FOOT_STARS: StarSpec[] = [
  { right: 68, bottom: 30, size: 11, phase: 0.0, window: FOOT_WINDOW, peak: 0.62, spin: 0.4, onLight: true },
  { right: 30, bottom: 64, size: 9, phase: 0.22, window: FOOT_WINDOW, peak: 0.5, spin: -0.35, onLight: true },
  { right: 58, bottom: 72, size: 12, phase: 0.44, window: FOOT_WINDOW, peak: 0.58, spin: 0.3, onLight: true },
  { right: 14, bottom: 34, size: 10, phase: 0.62, window: FOOT_WINDOW, peak: 0.85, spin: -0.45 },
  { right: 44, bottom: 14, size: 8, phase: 0.8, window: FOOT_WINDOW, peak: 0.9, spin: 0.5 },
];

// The lit shoulder, where the title sits: slower to arrive, slower to go,
// and dark far longer. Phases are deliberately uneven so the gaps between
// arrivals differ and it never keeps time with itself. One star past the
// end of the eyebrow, two down the gutter — the type framed, never touched.
const SHOULDER_STARS: StarSpec[] = [
  { left: 232, top: 20, size: 10, phase: 0.0, window: SHOULDER_WINDOW, peak: 0.58, spin: 0.4 },
  { left: 3, top: 50, size: 12, phase: 0.31, window: SHOULDER_WINDOW, peak: 0.66, spin: -0.35 },
  { left: 4, top: 104, size: 8, phase: 0.66, window: SHOULDER_WINDOW, peak: 0.46, spin: 0.5 },
];

function Star({
  star, clock, color, still,
}: {
  star: StarSpec;
  clock: SharedValue<number>;
  color: string;
  still: boolean;
}) {
  const style = useAnimatedStyle(() => {
    if (still) return { opacity: star.peak * 0.5, transform: [{ rotate: '0deg' }] };
    const p = (clock.value + star.phase) % 1;
    const on = p < star.window ? Math.sin((p / star.window) * Math.PI) : 0;
    return { opacity: on * star.peak, transform: [{ rotate: `${p * 360 * star.spin}deg` }] };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          right: star.right,
          bottom: star.bottom,
          left: star.left,
          top: star.top,
          width: star.size,
          height: star.size,
        },
        style,
      ]}
    >
      <Svg width={star.size} height={star.size} viewBox="0 0 24 24">
        <Path d={SPARK_PATH} fill={color} />
      </Svg>
    </Animated.View>
  );
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

type Props = SectionCardConfig & { onPress?: () => void };

export default function RibbonSectionCard({
  label, title, description, titleColor, arrowBg,
  Decor, decorColor, decorUpright, onPress,
}: Props) {
  const reduceMotion = useReducedMotion();
  const footClock = useClock(reduceMotion, 10000);
  // 16 against 10: the two clusters only realign every eighty seconds.
  const shoulderClock = useClock(reduceMotion, 16000);

  const tint = decorColor ?? titleColor;

  // The emblem's light swells as the wave reaches the two stars nearest it,
  // off the same clock — so the card reads as one system rather than two
  // things moving near each other.
  const markStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { opacity: 0.34 };
    const p = (footClock.value + 0.71) % 1;
    const near = p < FOOT_WINDOW ? Math.sin((p / FOOT_WINDOW) * Math.PI) : 0;
    return { opacity: 0.26 + near * 0.16 };
  });

  return (
    <TouchableOpacity
      onPress={onPress}
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

      {Decor && (
        <Animated.View
          pointerEvents="none"
          style={[s.mark, decorUpright && s.markUpright, markStyle]}
        >
          <Decor s={150} c={deep(tint, 42)} w={1.2} />
        </Animated.View>
      )}

      {FOOT_STARS.map((star, i) => (
        <Star
          key={`foot-${i}`}
          star={star}
          clock={footClock}
          color={star.onLight ? deep(tint, 52) : '#FFFFFF'}
          still={reduceMotion}
        />
      ))}
      {SHOULDER_STARS.map((star, i) => (
        <Star
          key={`shoulder-${i}`}
          star={star}
          clock={shoulderClock}
          color={deep(tint, 50)}
          still={reduceMotion}
        />
      ))}

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
    right: -26,
    bottom: -30,
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
