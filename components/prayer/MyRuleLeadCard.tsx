import { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, {
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
import { Cross, Play } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import {
  continuousPhase,
  halfSinePulse,
  useContinuousAnimationClock,
} from '@/components/shared/use-continuous-animation-clock';
import {
  estimateRibbonHeight,
  placeRibbonStars,
  ribbonCardRhythm,
  type PlacedStar,
} from '@/components/shared/ribbonCardGeometry';
import { C, F } from '@/constants/tokens';
import { MINE_ACCENT, mineAlpha } from '@/components/prayer/myRuleTone';

/* ─────────────────────────────────────────────────────────────
 * MY RULE — the card, and the door.
 *
 * Built to `RibbonSectionCard`'s construction value for value, because
 * that is the app's newest and best card and this page had to reach it:
 * colour LIFTED in HSL rather than washed toward white, a three-stop
 * plate running near-white at the shoulder to full colour at the foot,
 * a lit hairline on the top edge, a pane of light on the shoulder, and
 * the two constellations kindling on their own two tempos.
 *
 * Two things it does that no other card in the app does, and both are
 * the reason it is written here instead of spread from the shared one:
 *
 * · ITS EMBLEM IS THE INSTRUMENT. Every ribbon card carries a still
 *   mark bleeding off its corner. This one carries the DIAL — the same
 *   ring, bloom and slow breath the timer behind it runs on. Every
 *   other rule in the book opens a page of prayers, so its preview is
 *   a page; this one opens a dial, so its preview is the dial. The
 *   shared card takes its emblem as a still icon and dims it to a
 *   third, which is right for a watermark and wrong for an instrument.
 *
 * · ITS FOOT IS A PLINTH, NOT AN ARROW. The ribbon cards navigate, so
 *   they wear an arrow orb. This one does not navigate — it STARTS the
 *   rule. So the foot carries a play seat and the words for it, under
 *   a fading fold: the card says what the rule is above the fold and
 *   what pressing it does below. ⚠ A boxed widget dropped at the foot
 *   would be a card inside a card; a plinth divided by a fold is the
 *   app's own way of weighting a card's bottom.
 * ───────────────────────────────────────────────────────────── */

/** How long each constellation stays lit, as a share of its cycle. */
const WINDOW = { shoulder: 0.34, foot: 0.42 } as const;
/** 16 against 10: the two clusters only realign every eighty seconds. */
const PERIOD = { shoulder: 16000, foot: 10000 } as const;

const AnimatedPath = Reanimated.createAnimatedComponent(Path);

function Star({
  star, clock, color, duration, offset, running,
}: {
  star: PlacedStar;
  clock: SharedValue<number>;
  color: string;
  duration: number;
  offset: number;
  running: boolean;
}) {
  const window = WINDOW[star.clock];
  const animatedProps = useAnimatedProps(() => {
    if (!running) return { opacity: star.peak * 0.5 };
    const p = continuousPhase(clock.value, duration, star.phase + offset);
    const on = p < window ? halfSinePulse(p / window) : 0;
    return { opacity: on * star.peak };
  });

  return (
    <AnimatedPath
      d={star.d}
      fill={color}
      opacity={star.peak * 0.5}
      animatedProps={animatedProps}
    />
  );
}

/**
 * The dial at rest — a still of the timer this card opens.
 *
 * Concentric discs rather than a radial gradient: the app's own way of
 * building a glow without SVG, and the only one that stays smooth on Android.
 * It breathes on OPACITY ALONE, the app's standing rule, so small Android
 * views never resample — and the cross at its heart is the plain one, because
 * this rule belongs to every tradition.
 */
function LeadDial({ size, ring, face, cross }: {
  size: number;
  ring: string;
  face: string;
  cross: string;
}) {
  const reduceMotion = useReducedMotion();
  const breath = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      breath.value = 0.5;
      return;
    }
    breath.value = 0;
    breath.value = withRepeat(
      withTiming(1, { duration: 3400, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(breath);
  }, [breath, reduceMotion]);

  // The bloom leads; the ring answers a beat behind it, so the dial is never
  // quite still and never quite moving.
  const bloomStyle = useAnimatedStyle(() => ({ opacity: 0.16 + breath.value * 0.2 }));
  const haloStyle = useAnimatedStyle(() => ({ opacity: 0.08 + breath.value * 0.1 }));
  const ringStyle = useAnimatedStyle(() => ({ opacity: 0.82 - breath.value * 0.28 }));

  const ringSize = size * 0.63;
  const faceSize = size * 0.47;

  return (
    <View style={[s.dial, { width: size, height: size }]} pointerEvents="none">
      <Reanimated.View style={[
        { position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: MINE_ACCENT },
        haloStyle,
      ]} />
      <Reanimated.View style={[
        { position: 'absolute', width: size * 0.81, height: size * 0.81, borderRadius: size * 0.405, backgroundColor: MINE_ACCENT },
        bloomStyle,
      ]} />
      <Reanimated.View style={[
        { position: 'absolute', width: ringSize, height: ringSize, borderRadius: ringSize / 2, borderWidth: 1.3, borderColor: ring },
        ringStyle,
      ]} />
      <View style={[s.dialFace, {
        width: faceSize,
        height: faceSize,
        borderRadius: faceSize / 2,
        backgroundColor: face,
        borderColor: ring,
      }]}>
        <Cross s={faceSize * 0.46} c={cross} w={1.3} />
      </View>
    </View>
  );
}

export default function MyRuleLeadCard({
  eyebrow,
  title,
  description,
  startAction,
  startHint,
  palette,
  onPress,
  cardRef,
  onCardLayout,
  estimatedWidth = 326,
  active = true,
}: {
  eyebrow: string;
  title: string;
  description: string;
  startAction: string;
  startHint: string;
  palette: {
    border: string;
    gradient: readonly [string, string, string];
    star: string;
    ink: string;
    title: string;
    body: string;
    seat: string;
    dialFace: string;
    dialRing: string;
  };
  onPress: () => void;
  cardRef?: React.Ref<View>;
  onCardLayout?: (event: LayoutChangeEvent) => void;
  estimatedWidth?: number;
  active?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const motionEnabled = active && !reduceMotion;
  const clock = useContinuousAnimationClock(motionEnabled);
  const rhythm = useMemo(() => ribbonCardRhythm(0), []);

  // Nothing decorative can be placed until the plate's size is known, and
  // everything decorative follows from it — the ribbon cards' own rule.
  const [plate, setPlate] = useState({ w: 0, h: 0 });
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setPlate(prev => (
      Math.abs(prev.w - width) < 0.5 && Math.abs(prev.h - height) < 0.5
        ? prev
        : { w: width, h: height }
    ));
    onCardLayout?.(event);
  }, [onCardLayout]);

  const measured = plate.w > 0 && plate.h > 0;
  const geometry = measured
    ? plate
    : { w: Math.max(240, estimatedWidth), h: estimateRibbonHeight(Math.max(240, estimatedWidth), description) };
  const stars = useMemo(
    () => placeRibbonStars(geometry.w, geometry.h),
    [geometry.h, geometry.w],
  );

  // The dial answers the plate's height so it is never cramped on a small
  // phone nor lost on a large one.
  const dialSize = Math.round(Math.min(168, Math.max(126, geometry.h * 0.78)));

  return (
    // The guided tour's spotlight measures a plain View — a Touchable cannot
    // carry `collapsable`, and a collapsed host view measures as nothing.
    <View collapsable={false} ref={cardRef}>
    <TouchableOpacity
      onPress={onPress}
      onLayout={handleLayout}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${startAction}. ${startHint}.`}
      style={[s.plate, { borderColor: palette.border }]}
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
          edge: a fading layer that stops mid-card draws a hard line across it
          as cleanly as if you had ruled one. */}
      <LinearGradient
        colors={['rgba(255,255,255,0.5)', 'rgba(255,255,255,0)']}
        locations={[0, 0.55]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* The emblem: the instrument itself, cropped by the corner so it reads
          as larger than the card that holds it. */}
      <View style={s.emblem} pointerEvents="none">
        <LeadDial
          size={dialSize}
          ring={palette.dialRing}
          face={palette.dialFace}
          cross={palette.ink}
        />
      </View>

      {/* Both constellations in ONE surface — eight of them per card was the
          one part of this design with a real cost. */}
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width={geometry.w} height={geometry.h}>
        {stars.map((star, i) => (
          <Star
            key={i}
            star={star}
            clock={clock}
            color={star.tone === 'light' ? '#FFFFFF' : palette.star}
            duration={PERIOD[star.clock] * rhythm.stretch}
            offset={rhythm.offset}
            running={motionEnabled}
          />
        ))}
      </Svg>

      <View style={s.body}>
        <Text style={[s.eyebrow, { color: palette.ink }]} numberOfLines={1}>{eyebrow}</Text>
        <Text style={[s.title, { color: palette.title }]}>{title}</Text>
        <Text style={[s.description, { color: palette.body }]}>{description}</Text>
      </View>

      {/* ── THE PLINTH ─────────────────────────────────────────────────────
          Above the fold the card says what this rule is; below it, what
          pressing it does. The fold is the app's own: a hairline that fades
          at both ends with a white catch-light under it. */}
      <View style={s.fold} pointerEvents="none">
        <LinearGradient
          colors={[mineAlpha(0), mineAlpha(0.3), mineAlpha(0)]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={s.foldLine}
        />
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.85)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={s.foldLight}
        />
      </View>

      <View style={s.plinth}>
        <View style={[s.playSeat, { backgroundColor: palette.seat }]}>
          <View style={s.playNudge}>
            <Play s={13} c="#FFFFFF" />
          </View>
        </View>
        <View style={s.plinthCopy}>
          <Text style={[s.plinthAction, { color: palette.title }]} numberOfLines={1}>
            {startAction}
          </Text>
          <Text style={[s.plinthHint, { color: palette.body }]} numberOfLines={1}>
            {startHint}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  plate: {
    position: 'relative',
    borderRadius: 26,
    borderCurve: 'continuous',
    borderWidth: 1,
    overflow: 'hidden',
    // The app's own card shadow — Habits, Journal and the ribbon cards all
    // sit on this one.
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

  // Off the right edge and clear of the plinth, so the dial never sits behind
  // the words that say what pressing does.
  emblem: { position: 'absolute', right: -30, top: 6 },

  // 62%: the dial runs to the middle of the plate, and a line of type over a
  // breathing bloom is a line of type nobody can read. Russian's lead sentence
  // is the long one — it is what this column has to hold without clipping.
  body: { paddingHorizontal: 18, paddingTop: 17, paddingBottom: 16, maxWidth: '62%' },
  eyebrow: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.4, textTransform: 'uppercase' },
  title: { marginTop: 8, marginBottom: 4, fontFamily: F.serifMedium, fontSize: 28, lineHeight: 32, letterSpacing: -0.3 },
  description: { fontFamily: F.serif, fontSize: 15.5, lineHeight: 22 },

  fold: { marginHorizontal: 14 },
  foldLine: { height: 1 },
  foldLight: { height: 1, marginTop: 0.5 },

  plinth: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: 18,
    paddingTop: 13,
    paddingBottom: 15,
  },
  playSeat: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  // A play triangle is optically left-heavy; a point of nudge centres it.
  playNudge: { marginLeft: 2 },
  plinthCopy: { flex: 1, minWidth: 0 },
  plinthAction: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 1.7 },
  plinthHint: { marginTop: 3, fontFamily: F.serif, fontSize: 13.5, lineHeight: 17 },

  dial: { alignItems: 'center', justifyContent: 'center' },
  dialFace: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});

/** Kept here so the page and the card can never drift apart. */
export const MY_RULE_CARD_TEXT_COLOR = C.text;
