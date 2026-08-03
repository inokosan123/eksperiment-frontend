import {
  memo,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  LayoutChangeEvent, StyleSheet, Text, View,
  type StyleProp, type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { ArrowUpRight } from '@/components/icons/Icons';
import { F } from '@/constants/tokens';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import type { SectionCardIcon } from '@/components/shared/sectionCardData';
import {
  windowedHalfSinePulse,
} from '@/components/shared/use-continuous-animation-clock';
import { continuousAnimationElapsedNow } from '@/components/shared/continuous-animation-time';
import {
  AmbientMotionProvider,
  useAmbientMotion,
} from '@/components/shared/ambient-motion';
import {
  estimateRibbonHeight,
  RIBBON,
  placeRibbonStars,
  ribbonCardRhythm,
  ribbonEmblem,
  type PlacedStar,
} from '@/components/shared/ribbonCardGeometry';
import { scaleReadableLineHeight, useReadableFontScale } from '@/components/shared/typographyScale';

/* ─────────────────────────────────────────────────────────────
 * RIBBON — the section card.
 *
 * The plate runs from near-white at the shoulder to full, saturated
 * colour at the foot, and the emblem is large and unashamed in that
 * colour, bleeding off the right edge. Two constellations kindle on
 * it, on two tempos derived from one continuous tabs clock.
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
 * · EVERY MAIN STACK SHARES ONE CLOCK. So: one wall-clock for the whole tabs
 *   navigator, no per-card fallback clocks while these cards are in the app,
 *   no animated worklets at all on dormant cards, and the whole constellation
 *   in ONE <Svg> rather than eight. Only opacity moves; the plate, gradient
 *   and sheen are drawn once and never animated.
 * ───────────────────────────────────────────────────────────── */

/** How long each constellation stays lit, as a share of its cycle. */
const WINDOW = { shoulder: 0.34, foot: 0.42 } as const;
/** 16 against 10: the two clusters only realign every eighty seconds. */
const PERIOD = { shoulder: 16000, foot: 10000 } as const;

function useMotionSnapshotElapsed(running: boolean) {
  return useMemo(
    () => ({ running, elapsed: continuousAnimationElapsedNow() }),
    [running],
  ).elapsed;
}

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
const AnimatedStar = memo(function AnimatedStar({
  star, clock, color, duration, offset, initialOpacity,
}: {
  star: PlacedStar;
  clock: SharedValue<number>;
  color: string;
  duration: number;
  initialOpacity: number;
  /** where this card sits in the stack's rhythm */
  offset: number;
}) {
  const window = WINDOW[star.clock];
  const animatedProps = useAnimatedProps(() => {
    const on = windowedHalfSinePulse(
      clock.value,
      duration,
      star.phase + offset,
      window,
    );
    return { opacity: on * star.peak };
  });

  return (
    <AnimatedPath
      d={star.d}
      fill={color}
      opacity={initialOpacity}
      animatedProps={animatedProps}
    />
  );
});

const Star = memo(function Star({
  star,
  clock,
  color,
  duration,
  running,
  offset,
}: {
  star: PlacedStar;
  clock: SharedValue<number>;
  color: string;
  duration: number;
  running: boolean;
  offset: number;
}) {
  const frozenElapsed = useMotionSnapshotElapsed(running);
  const frozenOpacity = useMemo(() => (
    windowedHalfSinePulse(
      frozenElapsed,
      duration,
      star.phase + offset,
      WINDOW[star.clock],
    ) * star.peak
  ), [duration, frozenElapsed, offset, star.clock, star.peak, star.phase]);

  if (!running) {
    return <Path d={star.d} fill={color} opacity={frozenOpacity} />;
  }
  return (
    <AnimatedStar
      star={star}
      clock={clock}
      color={color}
      duration={duration}
      initialOpacity={frozenOpacity}
      offset={offset}
    />
  );
});

/** Compatibility alias while card stacks move to local motion zones. */
export const RibbonMotionProvider = memo(function RibbonMotionProvider({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  return (
    <AmbientMotionProvider active={active}>
      {children}
    </AmbientMotionProvider>
  );
});

/** The mark's resting opacity; it kindles 0.16 above this. */
const MARK_REST = 0.26;

type RibbonMarkProps = {
  Decor: SectionCardIcon;
  color: string;
  size: number;
  right: number;
  bottom: number;
  upright?: boolean;
  rest: number;
  running: boolean;
  clock: SharedValue<number>;
  duration: number;
  offset: number;
};

function AnimatedRibbonMark({
  Decor, color, size, right, bottom, upright, rest, clock, duration, offset,
  initialOpacity,
}: Omit<RibbonMarkProps, 'running'> & { initialOpacity: number }) {
  const markStyle = useAnimatedStyle(() => {
    const near = windowedHalfSinePulse(
      clock.value,
      duration,
      0.71 + offset,
      WINDOW.foot,
    );
    return { opacity: rest + near * 0.16 };
  }, [rest]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        s.mark,
        { right, bottom, opacity: initialOpacity },
        upright && s.markUpright,
        markStyle,
      ]}
    >
      <Decor s={size} c={color} w={1.2} />
    </Animated.View>
  );
}

function RibbonMark(props: RibbonMarkProps) {
  const {
    Decor, color, size, right, bottom, upright, rest, running, duration, offset,
  } = props;
  const frozenElapsed = useMotionSnapshotElapsed(running);
  const frozenOpacity = useMemo(() => {
    const near = windowedHalfSinePulse(
      frozenElapsed,
      duration,
      0.71 + offset,
      WINDOW.foot,
    );
    return rest + near * 0.16;
  }, [duration, frozenElapsed, offset, rest]);
  if (running) return <AnimatedRibbonMark {...props} initialOpacity={frozenOpacity} />;
  return (
    <View
      pointerEvents="none"
      style={[
        s.mark,
        { right, bottom, opacity: frozenOpacity },
        upright && s.markUpright,
      ]}
    >
      <Decor s={size} c={color} w={1.2} />
    </View>
  );
}

/**
 * Only what the card actually draws.
 *
 * It used to take the whole `SectionCardConfig`, which meant anything wanting
 * this look had to invent an `id`, a `route`, a `bg` and a `border` that were
 * never read. Focus has neither a route nor a card id, and asking it to
 * pretend was the only thing keeping it on the old card. Spreading a full
 * config still works — the extra fields are simply ignored.
 */
export type RibbonCardProps = {
  label: string;
  title: string;
  description?: string;
  titleColor: string;
  arrowBg: string;
  Decor?: SectionCardIcon;
  decorColor?: string;
  decorUpright?: boolean;
  /**
   * Overrides for where the mark sits and how strongly it rests.
   *
   * The default is `ribbonEmblem()`: large, and hanging 17% off the right edge
   * and 20% off the foot. That is right for a mark whose meaning survives being
   * cropped — a star, a cross, an open book — and wrong for one that is a whole
   * object with a bottom, like the prayer rope on the Jesus Prayer card, whose
   * tail and cross are simply cut away. Such a card pulls its mark in off both
   * edges and gives it a little more ink to make up for being smaller.
   *
   * ⚠ Opt-in and per-field. Every card that omits it keeps the lab's geometry
   * to the point, which is the whole reason this is a prop and not an edit to
   * `RIBBON`.
   */
  decorPlacement?: { size?: number; right?: number; bottom?: number; rest?: number };
  /** A live status pill beside the eyebrow — Focus's "PROTECTED", and such. */
  chip?: ReactNode;
  onPress?: () => void;
  /**
   * Where this card sits in its stack. It buys the card its own moment and
   * its own tempo — see `ribbonCardRhythm`. Left out, every card on a screen
   * keeps identical time with every other.
   */
  index?: number;
  /** False keeps the finished design visible but pauses its repeating clocks. */
  active?: boolean;
  /** Lets only the human-facing title and description follow iOS text size. */
  readableCopy?: boolean;
  /** Exact parent width when known, used before native onLayout reports. */
  estimatedWidth?: number;
  /** Reports the card frame to a parent that budgets off-screen motion. */
  onFrameLayout?: (event: LayoutChangeEvent) => void;
  style?: StyleProp<ViewStyle>;
};

type RibbonCardRuntimeProps = RibbonCardProps & {
  clock: SharedValue<number>;
  motionEnabled: boolean;
};

function RibbonSectionCardContent({
  label, title, description, titleColor, arrowBg,
  Decor, decorColor, decorUpright, decorPlacement, chip, onPress, index = 0,
  estimatedWidth = 326, onFrameLayout, style, clock, motionEnabled,
  readableCopy = false,
}: RibbonCardRuntimeProps) {
  const systemReadableScale = useReadableFontScale();
  const readableScale = readableCopy ? systemReadableScale : 1;
  // Its own moment in the cycle, and its own slightly different length of
  // cycle, derived from the shared tabs clock so it never falls back into
  // step with the card above it or resets after a viewport pause.
  const rhythm = useMemo(() => ribbonCardRhythm(index), [index]);

  const fallbackPlate = useMemo(() => {
    const w = Math.max(240, estimatedWidth);
    return { w, h: estimateRibbonHeight(w, description, readableCopy ? readableScale : undefined) };
  }, [description, estimatedWidth, readableCopy, readableScale]);
  // The exact estimated geometry is usable on the first frame. Native layout
  // only replaces it when the measured plate is materially different, which
  // avoids the previous mount-time geometry commit on normal phone widths.
  const [measuredPlate, setMeasuredPlate] = useState<{ w: number; h: number } | null>(null);
  // How far the eyebrow row actually reaches. A status pill beside the words,
  // or a large system font size, both push it past anything a constant could
  // guess — and the pocket star stands immediately after it.
  const [labelEnd, setLabelEnd] = useState<number | undefined>(undefined);
  const onLabelLayout = useCallback((e: LayoutChangeEvent) => {
    const right = RIBBON.pad + e.nativeEvent.layout.width;
    setLabelEnd(prev => (prev !== undefined && Math.abs(prev - right) < 0.5 ? prev : right));
  }, []);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    const matchesEstimate = Math.abs(fallbackPlate.w - width) < 0.5
      && Math.abs(fallbackPlate.h - height) < 0.5;
    setMeasuredPlate(prev => {
      if (matchesEstimate) return prev === null ? prev : null;
      return prev != null
        && Math.abs(prev.w - width) < 0.5
        && Math.abs(prev.h - height) < 0.5
        ? prev
        : { w: width, h: height };
    });
    onFrameLayout?.(e);
  }, [fallbackPlate.h, fallbackPlate.w, onFrameLayout]);

  const tint = decorColor ?? titleColor;
  const geometryPlate = measuredPlate ?? fallbackPlate;
  const fallbackLabelEnd = useMemo(() => {
    const textEnd = RIBBON.pad + label.length * 8.6 + (chip ? 96 : 0);
    const arrowLeft = geometryPlate.w - RIBBON.arrowInset - RIBBON.arrowSize;
    return Math.min(textEnd, arrowLeft - 8);
  }, [chip, geometryPlate.w, label.length]);
  const resolvedLabelEnd = labelEnd ?? fallbackLabelEnd;
  const stars = useMemo(
    () => placeRibbonStars(geometryPlate.w, geometryPlate.h, resolvedLabelEnd),
    [geometryPlate.h, geometryPlate.w, resolvedLabelEnd],
  );
  const emblem = useMemo(() => {
    const placed = ribbonEmblem(geometryPlate.w, geometryPlate.h);
    return {
      size: decorPlacement?.size ?? placed.size,
      right: decorPlacement?.right ?? placed.right,
      bottom: decorPlacement?.bottom ?? placed.bottom,
    };
  }, [decorPlacement?.bottom, decorPlacement?.right, decorPlacement?.size, geometryPlate.h, geometryPlate.w]);
  const palette = useMemo(() => ({
    border: lit(tint, 74, 62),
    gradient: [lit(tint, 97), lit(tint, 88), lit(tint, 76, 76)] as const,
    mark: deep(tint, 42),
    star: deep(tint, 51),
    label: deep(tint, 36),
    description: deep(tint, 32),
  }), [tint]);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      onLayout={onLayout}
      activeOpacity={0.86}
      style={[s.plate, { borderColor: palette.border }, style]}
    >
      <LinearGradient
        colors={palette.gradient}
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
        <RibbonMark
          Decor={Decor}
          color={palette.mark}
          size={emblem.size}
          right={emblem.right}
          bottom={emblem.bottom}
          upright={decorUpright}
          rest={decorPlacement?.rest ?? MARK_REST}
          running={motionEnabled}
          clock={clock}
          duration={PERIOD.foot * rhythm.stretch}
          offset={rhythm.offset}
        />
      )}

      {/* The whole field — both constellations — in a single surface. */}
      <Svg
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        width={geometryPlate.w}
        height={geometryPlate.h}
      >
        {stars.map((star, i) => (
          <Star
            key={i}
            star={star}
            clock={clock}
            color={star.tone === 'light' ? '#FFFFFF' : palette.star}
            duration={PERIOD[star.clock] * rhythm.stretch}
            running={motionEnabled}
            offset={rhythm.offset}
          />
        ))}
      </Svg>

      {!!onPress && (
        <View style={[s.arrow, { backgroundColor: arrowBg }]} pointerEvents="none">
          <View style={s.arrowTilt}>
            <ArrowUpRight s={15} c="#fff" w={2.5} />
          </View>
        </View>
      )}

      <View style={s.body}>
        <View style={s.labelRow} onLayout={onLabelLayout}>
          <Text style={[s.label, { color: palette.label }]} numberOfLines={1}>{label}</Text>
          {chip}
        </View>
        <Text
          style={[
            s.title,
            readableCopy && {
              fontSize: 28 * readableScale,
              lineHeight: scaleReadableLineHeight(28, 32, readableScale),
            },
            { color: titleColor },
          ]}
        >
          {title}
        </Text>
        {!!description && (
          <Text
            style={[
              s.desc,
              readableCopy && { fontSize: 16 * readableScale, lineHeight: 23 * readableScale },
              { color: palette.description },
            ]}
          >
            {description}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

function RibbonSectionCard(props: RibbonCardProps) {
  const runtime = useAmbientMotion(props.active ?? true);
  return (
    <RibbonSectionCardContent
      {...props}
      clock={runtime.clock}
      motionEnabled={runtime.enabled}
    />
  );
}

export default memo(RibbonSectionCard);

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
  // `flex-start` matters: the row must be as wide as its contents, not as wide
  // as the card, or measuring it tells the geometry nothing.
  labelRow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
    marginBottom: 8,
    maxWidth: '100%',
  },
  label: { flexShrink: 1, fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.4, textTransform: 'uppercase' },
  title: { fontFamily: F.serifMedium, fontSize: 28, lineHeight: 32, letterSpacing: -0.3, marginBottom: 4 },
  desc: { fontFamily: F.serif, fontSize: 16, lineHeight: 23 },
});
