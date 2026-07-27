import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, Ellipse, Line, Path, RadialGradient, Stop } from 'react-native-svg';
import { ArrowUpRight, ChevronRight } from '@/components/icons/Icons';
import { F } from '@/constants/tokens';
import { mixWhite, type LabCard } from './cardLabData';

/* ─────────────────────────────────────────────────────────────
 * THE DESIGNS.
 *
 * Every variant below is a complete, self-contained card: its own
 * markup and its own StyleSheet, sharing nothing with the others
 * and nothing with the real `SectionCard`. Change one and only
 * that one moves.
 *
 * To add a design: copy a whole block — component + its
 * StyleSheet — rename it, edit freely, and add one line to
 * LAB_VARIANTS at the bottom. Nothing else needs touching.
 * ───────────────────────────────────────────────────────────── */

/** Hex → rgba, so a card's own tone can be used at low opacity. */
function withAlpha(hex: string, alpha: number): string {
  const m = hex.replace('#', '');
  const v = m.length === 3 ? m.split('').map(c => c + c).join('') : m;
  const n = parseInt(v, 16);
  if (Number.isNaN(n)) return `rgba(0,0,0,${alpha})`;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/**
 * The reading tone: a card's label colour carried a quarter of the way toward
 * its own title colour.
 *
 * The label colours were picked as accents, and as *text* three of the four
 * fail WCAG AA on their own plate — Challenges worst at 3.30:1 against 4.5
 * required. A quarter-step deepens every card past 4.5 while staying inside
 * its own hue, so the palette is untouched and only the reading changes.
 */
function readingTone(card: LabCard): string {
  const a = parseInt(card.labelColor.replace('#', ''), 16);
  const t = parseInt(card.titleColor.replace('#', ''), 16);
  const k = 0.25;
  const ch = (shift: number) =>
    Math.round((((a >> shift) & 255) * (1 - k)) + (((t >> shift) & 255) * k));
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}

/** Mix two hex colours. Lets a tint be carried toward its own deep tone. */
function mixHex(a: string, b: string, t: number): string {
  const na = parseInt(a.replace('#', ''), 16);
  const nb = parseInt(b.replace('#', ''), 16);
  const ch = (shift: number) =>
    Math.round((((na >> shift) & 255) * (1 - t)) + (((nb >> shift) & 255) * t));
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}

type VariantProps = { card: LabCard };

/* ═══ BTFL ════════════════════════════════════════════════════
 * The one that is allowed to be lovely.
 *
 * THE FRAME IS A REAL BEZEL. Not a line drawn near the edge — a
 * band of material 5 wide, lit along its top and deepening to
 * its foot, with the plate set down INSIDE it. The plate carries
 * the inverse hairlines (shade at its top lip, light at its
 * bottom), which is what a surface recessed into a raised rim
 * actually does to light. Two facing gradients, and the card
 * stops being flat.
 *
 * THE GROUND IS THREE STOPS, NOT TWO. Light gathers at the upper
 * left, passes through the card's own tint, and settles into a
 * deeper tone at the foot — the tint carried a little toward its
 * own title colour, so the richness never leaves the hue.
 *
 * THE MARK IS A WATERMARK, NOT A BUTTON. It was sitting in a
 * raised 42pt disc beside the eyebrow, which made the card's
 * ornament look like a control and left the eyebrow squeezed
 * between two round seats. It is large and low in the plate
 * now, behind the type, and the constellation gathers AROUND
 * it — which is what it was for in the first place. The only
 * seat left is the way out, at the far right, where a seat
 * means something because you can press it.
 *
 * THE SENTENCE IS SET TO BE READ. In Inter, not the serif: this
 * is the line that has to explain the feature to somebody who
 * installed the app ten seconds ago, and it is bigger and
 * plainer than anywhere else on the card for that reason.
 *
 * LONG TITLES WRAP, THEY NEVER SHRINK. A title that gets scaled
 * down to fit is a title that reads as an accident. This one
 * runs the plate's full width, so almost nothing needs a second
 * line — and what does gets one, at full size.
 *
 * AND IT HAS STARS. The app already keeps one: the four-point
 * spark orbiting today's marker on Your Progress and the Focus
 * trophy. Here a small constellation kindles and goes out across
 * the plate — each star on its own phase, so one is always
 * arriving as another dies, and the card is never still and
 * never busy.
 *
 * Two rules the app set, kept exactly:
 *   · NOTHING SCALES. Opacity and rotation only — small views
 *     that scale resample on Android.
 *   · ONE DRIVER. A single clock per card runs the whole
 *     constellation; every star reads it at its own offset.
 * ═════════════════════════════════════════════════════════════ */

// The app's own four-point spark, from RadiantTodayPulse.
const BTFL_SPARK =
  'M12 0 C13.2 7.4 16.6 10.8 24 12 C16.6 13.2 13.2 16.6 12 24 C10.8 16.6 7.4 13.2 0 12 C7.4 10.8 10.8 7.4 12 0 Z';

const BTFL_BEZEL = 5;
const BTFL_R = 26;
const BTFL_PLATE_R = BTFL_R - BTFL_BEZEL;
const BTFL_EXIT = 34;   // the way out, far right

type Star = {
  /** From the plate's right edge and top, in points. */
  right: number;
  top: number;
  size: number;
  /** Where in the shared cycle this one kindles. */
  phase: number;
  /** How much of the cycle it is alight for. */
  window: number;
  peak: number;
  /** Turns per cycle, so the light crawls around its points. */
  spin: number;
};

// The mark sits low at the right, and these ring it: two above, two off its
// shoulders, one below. Scattered across the whole plate they read as dust on
// the type; gathered here they read as light coming off the emblem.
// They ring the mark along its upper shoulder — the arc between where the
// emblem's outline begins and the plate's top right. Spread evenly over the
// plate they read as dust settled on the type; gathered on that arc they read
// as light coming off the emblem, which is what Pavle asked for.
const BTFL_STARS: Star[] = [
  { right: 104, top: 30, size: 12, phase: 0.0, window: 0.3, peak: 0.72, spin: 0.5 },
  { right: 58, top: 20, size: 7, phase: 0.22, window: 0.22, peak: 0.44, spin: -0.6 },
  { right: 24, top: 56, size: 9, phase: 0.42, window: 0.26, peak: 0.5, spin: -0.4 },
  { right: 134, top: 74, size: 10, phase: 0.68, window: 0.28, peak: 0.58, spin: 0.35 },
  { right: 88, top: 108, size: 8, phase: 0.85, window: 0.26, peak: 0.46, spin: 0.45 },
];

// How large the watermark stands, and where its heart sits in the plate.
const BTFL_MARK = 132;

function BtflStar({
  star,
  clock,
  color,
  still,
}: {
  star: Star;
  clock: SharedValue<number>;
  color: string;
  still: boolean;
}) {
  const style = useAnimatedStyle(() => {
    if (still) return { opacity: star.peak * 0.5, transform: [{ rotate: '0deg' }] };
    // Its own place in the shared cycle.
    const p = (clock.value + star.phase) % 1;
    // Alight only inside its window, and there it swells and dies on a sine —
    // so it arrives and leaves rather than blinking.
    const lit = p < star.window ? Math.sin((p / star.window) * Math.PI) : 0;
    return {
      opacity: lit * star.peak,
      transform: [{ rotate: `${p * 360 * star.spin}deg` }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        btfl.star,
        { right: star.right, top: star.top, width: star.size, height: star.size },
        style,
      ]}
    >
      <Svg width={star.size} height={star.size} viewBox="0 0 24 24">
        <Path d={BTFL_SPARK} fill={color} />
      </Svg>
    </Animated.View>
  );
}

export function VariantBtfl({ card }: VariantProps) {
  const reduceMotion = useReducedMotion();
  const ink = readingTone(card);
  const clock = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    clock.value = 0;
    clock.value = withRepeat(
      withTiming(1, { duration: 9000, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(clock);
  }, [clock, reduceMotion]);

  // The bezel's material and the plate's ground, both drawn from the card's
  // own tint so nothing here is a colour the app does not already own.
  const rimTop = mixWhite(card.bg, 0.74);
  const rimFoot = mixHex(card.bg, card.titleColor, 0.17);
  const groundTop = mixWhite(card.bg, 0.6);
  const groundMid = mixWhite(card.bg, 0.14);
  const groundFoot = mixHex(card.bg, card.titleColor, 0.1);

  return (
    // The bezel: a band of material, lit along the top, deepening to its foot.
    <View style={[btfl.bezel, { borderColor: mixHex(card.border, card.titleColor, 0.12) }]}>
      <LinearGradient
        colors={[rimTop, rimFoot]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View pointerEvents="none" style={btfl.bezelLit} />
      <View pointerEvents="none" style={btfl.bezelShade} />

      {/* The plate, set down inside the rim */}
      <View style={[btfl.plate, { borderColor: withAlpha(card.labelColor, 0.26) }]}>
        <LinearGradient
          colors={[groundTop, groundMid, groundFoot]}
          locations={[0, 0.52, 1]}
          start={{ x: 0.08, y: 0 }}
          end={{ x: 0.92, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Recessed, so the light falls the other way: shade at the top lip,
            light along the bottom. This is the whole trick of the depth. */}
        <View pointerEvents="none" style={btfl.plateShade} />
        <View pointerEvents="none" style={btfl.plateLit} />

        {/* The mark, low and large behind the type, with the constellation
            gathered around it. */}
        <View pointerEvents="none" style={btfl.mark}>
          <card.Decor s={BTFL_MARK} c={withAlpha(card.decorColor, 0.11)} w={1.1} />
        </View>

        {BTFL_STARS.map((star, i) => (
          <BtflStar key={i} star={star} clock={clock} color={card.decorColor} still={reduceMotion} />
        ))}

        <View style={btfl.body}>
          {/* The emblem at one end, the way out at the other, the eyebrow
              between them: the two touch targets are a card's width apart. */}
          <View style={btfl.headRow}>
            {/* The eyebrow, set as an engraved line: a short bar in the card's
                own colour, then the words, spaced but no longer shouting. */}
            <View style={[btfl.labelBar, { backgroundColor: withAlpha(card.labelColor, 0.55) }]} />
            <Text style={[btfl.label, { color: card.labelColor }]} numberOfLines={1}>
              {card.label}
            </Text>

            <View style={btfl.headSpacer} />

            <View style={[btfl.exit, { borderColor: withAlpha(card.labelColor, 0.28) }]}>
              <View style={btfl.exitTilt}>
                <ArrowUpRight s={16} c={card.arrowBg} w={2.2} />
              </View>
            </View>
          </View>

          {/* Full width, so a long name almost never needs a second line — and
              when it does it gets one at full size rather than being shrunk. */}
          <View style={btfl.titleBlock}>
            <Text style={[btfl.title, { color: card.titleColor }]} numberOfLines={2}>
              {card.title}
            </Text>
            <LinearGradient
              colors={[withAlpha(card.labelColor, 0.44), withAlpha(card.labelColor, 0.08)]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={btfl.titleRule}
              pointerEvents="none"
            />
          </View>

          <Text style={[btfl.desc, { color: ink }]}>{card.description}</Text>
        </View>
      </View>
    </View>
  );
}

const btfl = StyleSheet.create({
  bezel: {
    position: 'relative',
    borderRadius: BTFL_R,
    borderCurve: 'continuous',
    borderWidth: 1,
    padding: BTFL_BEZEL,
    overflow: 'hidden',
    shadowColor: '#6B5836',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 5,
  },
  bezelLit: {
    position: 'absolute',
    top: 0,
    left: BTFL_R,
    right: BTFL_R,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.96)',
  },
  bezelShade: {
    position: 'absolute',
    bottom: 0,
    left: BTFL_R,
    right: BTFL_R,
    height: 1,
    backgroundColor: 'rgba(74,56,32,0.13)',
  },

  plate: {
    position: 'relative',
    borderRadius: BTFL_PLATE_R,
    borderCurve: 'continuous',
    borderWidth: 1,
    overflow: 'hidden',
  },
  plateShade: {
    position: 'absolute',
    top: 0,
    left: BTFL_PLATE_R,
    right: BTFL_PLATE_R,
    height: 1,
    backgroundColor: 'rgba(74,56,32,0.10)',
  },
  plateLit: {
    position: 'absolute',
    bottom: 0,
    left: BTFL_PLATE_R,
    right: BTFL_PLATE_R,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },

  star: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },

  body: { paddingHorizontal: 19, paddingTop: 13, paddingBottom: 17 },

  headRow: { flexDirection: 'row', alignItems: 'center', columnGap: 9 },
  headSpacer: { flex: 1, minWidth: 16 },
  // A raised seat, lit across its face like every other jewel in this app.
  // Low and to the right, and allowed to run off the plate's foot — a
  // watermark is a thing the card is printed over, not a thing placed on it.
  mark: {
    position: 'absolute',
    // Far enough out that only its shoulder is on the plate: at -18/-26 the
    // emblem's points reached up into the description and crossed the type.
    right: -32,
    bottom: -36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exit: {
    width: BTFL_EXIT,
    height: BTFL_EXIT,
    borderRadius: BTFL_EXIT / 2,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  exitTilt: { transform: [{ rotate: '-15deg' }] },

  // The eyebrow. It was 9.5 at 2.2 tracking in the body ink — small, loose
  // and grey, so it read as a caption that had lost its way rather than as
  // the card's own heading. Bigger, tighter, and in the card's colour.
  label: { fontFamily: F.sansBold, fontSize: 10.5, lineHeight: 13, letterSpacing: 1.5 },
  labelBar: { width: 14, height: 2, borderRadius: 1, flexShrink: 0 },

  titleBlock: { alignSelf: 'flex-start', marginTop: 12 },
  title: {
    fontFamily: F.serifSemiBold,
    fontSize: 28,
    lineHeight: 33,
    letterSpacing: -0.45,
  },
  titleRule: { alignSelf: 'stretch', height: 1, marginTop: 8, borderRadius: 1 },

  // Inter, and larger: this is the line that has to explain the feature to
  // someone who has never seen it.
  desc: { marginTop: 9, fontFamily: F.sans, fontSize: 14.5, lineHeight: 21 },
});

/* ═══ NEW ENGRAVED — THE RAISED PLATE ═════════════════════════
 * Everything the app already knows how to do, on one card.
 *
 * KEPT: the engraved ruling down the edges, the title's serif,
 * and the mark exactly as it is — a large upright watermark held
 * inside the frame.
 *
 * DROPPED: the hatched lines across the back. They are the Focus
 * register, not this one, and a card that has to sit under four
 * different screens cannot borrow another screen's texture.
 *
 * ADDED — the dimension. The app builds objects that catch light:
 * ONE's seal is a disc with the light caught across its face, a
 * lit rim and a glint. That is the quality this plate was only
 * hinting at with the single white line along its top. So the
 * plate is now genuinely raised —
 *
 *   · a dome of light gathering over its upper half, the way
 *     light gathers on a convex surface;
 *   · a foot of shade where it turns away at the bottom;
 *   · a lit edge above and a shade edge below, so the card has
 *     a top and a bottom rather than four identical sides;
 *   · and the outer rule struck as a real groove — a tone line
 *     with light caught just inside it, which is what an
 *     engraved line does in the world.
 *
 * REFINED: the eyebrow drops to 9 so it whispers, and the rule
 * under the title is measured by the title itself — the block
 * shrinks to the word, so the line is exactly as long as the
 * name it underscores, on every card, at every width.
 * ═════════════════════════════════════════════════════════════ */

const NE_R = 24;          // the plate's radius
const NE_OUT = 6;         // the struck groove
const NE_LIT = 7.6;       // the light caught inside it
const NE_IN = 11;         // the whisper rule
const NE_MARK = 64;
const NE_MARK_BOX = 70;
const NE_MARK_INSET = 13;

export function VariantNewEngraved({ card }: VariantProps) {
  const bloomId = `neB_${card.id}`;
  // Ornament keeps the accent colour; anything that has to be read takes the
  // deeper tone, which is what carries every card past WCAG AA.
  const ink = readingTone(card);

  return (
    <View style={[ne.card, { backgroundColor: card.bg, borderColor: card.border }]}>
      {/* The tint, rising toward the mark */}
      <LinearGradient
        colors={[mixWhite(card.bg, 0.06), mixWhite(card.bg, 0.6)]}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0.06 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* The dome — light gathering across the top of a raised surface. This is
          what the single white hairline was reaching for. */}
      <LinearGradient
        colors={['rgba(255,255,255,0.6)', 'rgba(255,255,255,0.14)', 'rgba(255,255,255,0)']}
        locations={[0, 0.52, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={ne.dome}
        pointerEvents="none"
      />

      {/* The foot — where the plate turns away from the light */}
      <LinearGradient
        colors={['rgba(74,56,32,0)', 'rgba(74,56,32,0.075)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={ne.foot}
        pointerEvents="none"
      />

      {/* The light the mark stands in, centred on it exactly */}
      <View pointerEvents="none" style={ne.bloom}>
        <Svg width={150} height={150}>
          <Defs>
            <RadialGradient id={bloomId} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.9} />
              <Stop offset="0.5" stopColor="#FFFDF7" stopOpacity={0.44} />
              <Stop offset="1" stopColor="#FFFBEE" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={75} cy={75} rx={74} ry={74} fill={`url(#${bloomId})`} />
        </Svg>
      </View>

      {/* The mark, unchanged: upright, large, held inside the ruling */}
      <View style={ne.watermark} pointerEvents="none">
        <card.Decor s={NE_MARK} c={card.decorColor} w={1} />
      </View>

      {/* The groove: a struck line with light caught just inside it. A single
          flat line is drawn; a line with a highlight beside it is cut. */}
      <View pointerEvents="none" style={[ne.rule, { borderColor: withAlpha(card.labelColor, 0.3) }]} />
      <View pointerEvents="none" style={ne.ruleLit} />
      <View pointerEvents="none" style={[ne.ruleInner, { borderColor: withAlpha(card.labelColor, 0.13) }]} />

      {/* The plate has a top and a bottom, not four identical sides */}
      <View pointerEvents="none" style={ne.litEdge} />
      <View pointerEvents="none" style={ne.shadeEdge} />

      <View style={ne.body}>
        <View style={ne.labelRow}>
          <View style={[ne.diamond, { backgroundColor: withAlpha(card.labelColor, 0.72) }]} />
          <Text style={[ne.label, { color: ink }]} numberOfLines={1}>
            {card.label}
          </Text>
        </View>

        {/* Title and rule share a block that shrinks to the title, so the line
            is exactly as long as the name above it — measured by the word
            itself rather than set to a number that happens to look close. */}
        <View style={ne.titleBlock}>
          <Text
            style={[ne.title, { color: card.titleColor }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
          >
            {card.title}
          </Text>
          <LinearGradient
            colors={[withAlpha(card.labelColor, 0.42), withAlpha(card.labelColor, 0.1)]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={ne.titleRule}
            pointerEvents="none"
          />
        </View>

        <Text style={[ne.desc, { color: ink }]}>{card.description}</Text>
      </View>
    </View>
  );
}

const ne = StyleSheet.create({
  card: {
    position: 'relative',
    borderRadius: NE_R,
    borderCurve: 'continuous',
    borderWidth: 1,
    overflow: 'hidden',
    // A raised plate casts a little further than a flat one.
    shadowColor: '#6B5836',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.13,
    shadowRadius: 18,
    elevation: 4,
  },

  /* — the dimension — */
  dome: { position: 'absolute', top: 0, left: 0, right: 0, height: 94 },
  foot: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 58 },
  litEdge: {
    position: 'absolute',
    top: 1,
    left: NE_R,
    right: NE_R,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  shadeEdge: {
    position: 'absolute',
    bottom: 1,
    left: NE_R,
    right: NE_R,
    height: 1,
    backgroundColor: 'rgba(74,56,32,0.09)',
  },

  /* — the ruling — R − d, so every corner runs concentric with the plate's — */
  rule: {
    position: 'absolute',
    top: NE_OUT,
    left: NE_OUT,
    right: NE_OUT,
    bottom: NE_OUT,
    borderRadius: NE_R - NE_OUT,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  ruleLit: {
    position: 'absolute',
    top: NE_LIT,
    left: NE_LIT,
    right: NE_LIT,
    bottom: NE_LIT,
    borderRadius: NE_R - NE_LIT,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  ruleInner: {
    position: 'absolute',
    top: NE_IN,
    left: NE_IN,
    right: NE_IN,
    bottom: NE_IN,
    borderRadius: NE_R - NE_IN,
    borderCurve: 'continuous',
    borderWidth: 1,
  },

  /* — the mark — */
  // Centred on it: inset 13 + half of 70 = 48 from the top and right.
  bloom: { position: 'absolute', top: -27, right: -27, width: 150, height: 150 },
  watermark: {
    position: 'absolute',
    top: NE_MARK_INSET,
    right: NE_MARK_INSET,
    width: NE_MARK_BOX,
    height: NE_MARK_BOX,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.14,
  },

  /* — the copy — even margin inside the whisper rule: 13 / 9 / 11 — */
  body: { paddingHorizontal: NE_IN + 13, paddingTop: NE_IN + 9, paddingBottom: NE_IN + 11 },
  labelRow: { flexDirection: 'row', alignItems: 'center', columnGap: 7 },
  diamond: { width: 4.5, height: 4.5, borderRadius: 0.5, transform: [{ rotate: '45deg' }] },
  label: { fontFamily: F.sansBold, fontSize: 9, lineHeight: 11, letterSpacing: 2.2 },

  // Shrinks to the title. The margin is what holds it clear of the mark: the
  // glyph starts 80 from the right edge, less the body's own 24.
  titleBlock: { alignSelf: 'flex-start', marginRight: 56 },
  title: {
    marginTop: 5,
    fontFamily: F.serifSemiBold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.45,
  },
  titleRule: { alignSelf: 'stretch', height: 1, marginTop: 8, borderRadius: 1 },

  desc: { marginTop: 8, fontFamily: F.serif, fontSize: 15.5, lineHeight: 22 },
});

/* ═══ ONE — THE SEAL CARD ═════════════════════════════════════
 * The proposal, rebuilt from the ground up.
 *
 * WHY THE EARLIER ATTEMPTS FELL SHORT. They were a paragraph on
 * a tinted rectangle. No amount of spacing fixes that, because
 * nothing on the card was actually worth looking at — the
 * emblem was a ghost at 12%, which reads as texture, not as an
 * object.
 *
 * WHAT THIS APP ACTUALLY DOES. Every surface Anasta is proud of
 * is a crafted luminous object, not a coloured box: the Your
 * Progress medallion is five stacked rotated ellipses running
 * dark gold to white at the heart, carrying a live arc, a
 * hairline divider and struck glints. The Scripture doors, the
 * flame seals, the Year in Pixels frame — all the same. Light
 * and metal, layered.
 *
 * SO THE EMBLEM BECOMES THE JEWEL. A struck seal: a bloom of
 * light behind it, an outer nimbus, a white disc with the light
 * caught along its face, two rims, a toned core, the section
 * mark, and one glint where the light lands. It sits where the
 * old arrow badge sat, so the eye finds it in the familiar
 * place — but it rewards looking instead of shouting.
 *
 * AND THE TYPE GETS OUT OF ITS WAY. Eyebrow tight above the
 * title, one unit; the sentence below at the card's full width,
 * because only those two short top lines have to clear the
 * seal. One emblem rendered well beats one emblem rendered
 * twice, so the old watermark is gone.
 * ═════════════════════════════════════════════════════════════ */

const SEAL = 62; // nimbus
const DISC = 50;
const CORE = 36;

// The lit quarter of the nimbus: about 80° of its circumference.
const NIMBUS_CIRC = 2 * Math.PI * (SEAL / 2 - 0.5);
const NIMBUS_ARC = NIMBUS_CIRC * (80 / 360);

/**
 * The raked light. Anasta's own texture — the fall of light across the
 * Scripture doors and the daily-task plate, and the weave under the Year in
 * Pixels card. It is what stops a tinted rectangle from reading as a tinted
 * rectangle: at 6% you never see the lines, you only feel the surface.
 * Measured from layout so the rake reaches every corner whatever the copy does.
 */
function OneWeave({ color }: { color: string }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const step = 34;
  const count = box.w > 0 ? Math.ceil((box.w + box.h) / step) + 1 : 0;

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={e => {
        const { width, height } = e.nativeEvent.layout;
        setBox({ w: Math.round(width), h: Math.round(height) });
      }}
    >
      {count > 0 && (
        <Svg width={box.w} height={box.h} style={StyleSheet.absoluteFill}>
          {Array.from({ length: count }).map((_, i) => {
            const x = i * step;
            return (
              <Line
                key={i}
                x1={x}
                y1={-4}
                x2={x - box.h - 8}
                y2={box.h + 4}
                stroke={color}
                strokeOpacity={0.06}
                strokeWidth={1}
              />
            );
          })}
        </Svg>
      )}
    </View>
  );
}

/** The struck seal, layered outward from the light behind it. */
function OneSeal({ card }: VariantProps) {
  const bloomId = `oneB_${card.id}`;

  return (
    <View style={one.sealAnchor} pointerEvents="none">
      {/* The light it stands in — wider than the seal, falling away to nothing */}
      <View style={one.sealBloom}>
        <Svg width={126} height={126}>
          <Defs>
            <RadialGradient id={bloomId} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.95} />
              <Stop offset="0.46" stopColor="#FFFCF2" stopOpacity={0.58} />
              <Stop offset="1" stopColor="#FFF9E9" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={63} cy={63} rx={62} ry={62} fill={`url(#${bloomId})`} />
        </Svg>
      </View>

      {/* Nimbus, and the light on it. A ring drawn evenly all the way round is
          a drawn ring; a ring that brightens where the light falls is a struck
          one. The bright arc sits upper-left, the same quarter the glint on
          the disc comes from, so the seal has one light source. */}
      <Svg width={SEAL} height={SEAL} style={StyleSheet.absoluteFill}>
        <Circle
          cx={SEAL / 2}
          cy={SEAL / 2}
          r={SEAL / 2 - 0.5}
          stroke={withAlpha(card.labelColor, 0.16)}
          strokeWidth={1}
          fill="none"
        />
        <Circle
          cx={SEAL / 2}
          cy={SEAL / 2}
          r={SEAL / 2 - 0.5}
          stroke={withAlpha(card.labelColor, 0.5)}
          strokeWidth={1.3}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${NIMBUS_ARC} ${NIMBUS_CIRC}`}
          transform={`rotate(-168 ${SEAL / 2} ${SEAL / 2})`}
        />
      </Svg>

      {/* The disc, with the light caught across its face */}
      <View style={[one.sealDisc, { borderColor: withAlpha(card.labelColor, 0.36) }]}>
        <LinearGradient
          colors={['#FFFFFF', mixWhite(card.bg, 0.55)]}
          start={{ x: 0.35, y: 0 }}
          end={{ x: 0.65, y: 1 }}
          style={one.sealFace}
        />
        {/* Inner rim: the double ruling this app strikes into every plate */}
        <View style={[one.sealInnerRim, { borderColor: withAlpha(card.labelColor, 0.14) }]} />
        {/* The toned core the mark sits in */}
        <View style={[one.sealCore, { backgroundColor: withAlpha(card.labelColor, 0.1) }]}>
          <card.Decor s={21} c={card.arrowBg} w={1.7} />
        </View>
        {/* One glint, where the light lands */}
        <View style={one.sealGlint} />
      </View>
    </View>
  );
}

export function VariantOne({ card }: VariantProps) {
  return (
    <View style={[one.card, { backgroundColor: card.bg, borderColor: card.border }]}>
      {/* The wash runs almost level and rises toward the seal, so the plate is
          palest where the light actually is. Anasta made this exact correction
          on the Your Progress card: a diagonal sweep lights an empty corner. */}
      <LinearGradient
        colors={[mixWhite(card.bg, 0), mixWhite(card.bg, 0.58)]}
        start={{ x: 0, y: 0.9 }}
        end={{ x: 1, y: 0.12 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <OneWeave color={card.decorColor} />

      {/* The floor wash: the plate stands on warmth instead of stopping at a
          flat bottom edge. The app lays the same glow under its finest cards. */}
      <LinearGradient
        colors={['rgba(197,160,89,0)', 'rgba(197,160,89,0.08)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={one.floor}
        pointerEvents="none"
      />

      <View pointerEvents="none" style={one.litEdge} />

      <OneSeal card={card} />

      <View style={one.body}>
        {/* Eyebrow and title are one unit — 5 apart. Only these two lines have
            to keep clear of the seal. */}
        <View style={one.head}>
          <Text style={[one.label, { color: card.labelColor }]} numberOfLines={1}>
            {card.label}
          </Text>
          <Text
            style={[one.title, { color: card.titleColor }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.88}
          >
            {card.title}
          </Text>
        </View>

        {/* The sentence starts below the seal, so it gets the card's whole
            width instead of a narrow column beside it. */}
        <Text style={[one.desc, { color: card.bodyColor }]}>{card.description}</Text>
      </View>
    </View>
  );
}

const one = StyleSheet.create({
  card: {
    position: 'relative',
    borderRadius: 26,
    borderCurve: 'continuous',
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#2A2118',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.09,
    shadowRadius: 16,
    elevation: 3,
  },
  litEdge: {
    position: 'absolute',
    top: 1,
    left: 24,
    right: 24,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },

  /* — the seal — */
  // Lifted 6, which is what buys the title a normal gap to its sentence: the
  // seal has to finish before the copy starts, so its top sets that gap.
  sealAnchor: {
    position: 'absolute',
    top: 10,
    right: 18,
    width: SEAL,
    height: SEAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealBloom: {
    position: 'absolute',
    width: 126,
    height: 126,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealDisc: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2A2118',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 5,
    elevation: 2,
  },
  sealFace: { ...StyleSheet.absoluteFillObject },
  sealInnerRim: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: 4,
    bottom: 4,
    borderRadius: (DISC - 8) / 2,
    borderWidth: 1,
  },
  sealCore: {
    width: CORE,
    height: CORE,
    borderRadius: CORE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealGlint: {
    position: 'absolute',
    top: 6,
    left: 12,
    width: 13,
    height: 5,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.9)',
    transform: [{ rotate: '-22deg' }],
  },

  /* — the type — */
  body: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 20 },
  // Clears the seal: its 18 inset + 62 width − this 22 padding + a 12 gap.
  head: { paddingRight: 70 },
  // The eyebrow. It was 9.5 at 2.2 tracking in the body ink — small, loose
  // and grey, so it read as a caption that had lost its way rather than as
  // the card's own heading. Bigger, tighter, and in the card's colour.
  label: { fontFamily: F.sansBold, fontSize: 10.5, lineHeight: 13, letterSpacing: 1.5 },
  labelBar: { width: 14, height: 2, borderRadius: 1, flexShrink: 0 },
  title: {
    marginTop: 5,
    fontFamily: F.serifSemiBold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.45,
  },
  // 10, not 17. The seal used to sit lower and pushed the sentence away from
  // its own title; title and sentence are one block and now read as one.
  desc: {
    marginTop: 10,
    fontFamily: F.serif,
    fontSize: 15.5,
    lineHeight: 21.5,
  },
  floor: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 62 },
});

/* ═══ A — CURRENT ═════════════════════════════════════════════
 * A faithful copy of today's SectionCard. This is the baseline
 * every other design is judged against, so it should be left
 * alone: edit the others instead.
 * ═════════════════════════════════════════════════════════════ */

export function VariantCurrent({ card }: VariantProps) {
  return (
    <View style={[a.card, { backgroundColor: card.bg, borderColor: card.border }]}>
      <LinearGradient
        colors={[card.bg, mixWhite(card.bg, 0.78)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={a.watermark} pointerEvents="none">
        <card.Decor s={84} c={card.decorColor} w={1} />
      </View>

      <View style={[a.arrowWrap, { backgroundColor: card.arrowBg }]} pointerEvents="none">
        <View style={a.arrowRotated}>
          <ArrowUpRight s={15} c="#fff" w={2.5} />
        </View>
      </View>

      <View style={a.row}>
        <View style={a.textCol}>
          <Text style={[a.label, { color: card.labelColor }]}>{card.label}</Text>
          <Text style={[a.title, { color: card.titleColor }]}>{card.title}</Text>
          <Text style={[a.desc, { color: card.bodyColor }]}>{card.description}</Text>
        </View>
      </View>
    </View>
  );
}

const a = StyleSheet.create({
  card: {
    position: 'relative',
    borderRadius: 26,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 4,
  },
  watermark: {
    position: 'absolute',
    bottom: -6,
    right: 6,
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.13,
    transform: [{ rotate: '-8deg' }],
  },
  row: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 18 },
  textCol: { maxWidth: '84%', paddingRight: 12 },
  label: {
    fontSize: 10,
    fontFamily: F.sansBold,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    fontFamily: F.serifMedium,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  desc: { fontSize: 16, lineHeight: 23, fontFamily: F.serif },
  arrowWrap: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 4,
  },
  arrowRotated: { transform: [{ rotate: '-15deg' }] },
});

/* ═══ B — ENGRAVED PLATE ══════════════════════════════════════
 * The ornamental register, taken as far as it goes.
 *
 * THE FRAME IS REAL GEOMETRY NOW. A rounded rect inset by d from
 * a parent of radius R has radius R − d, or its corners are not
 * concentric with the card's; both rules were off, so the
 * corners bowed against the edge. And at 3.5 apart, two 1px
 * rules merge into one thick line at arm's length — a double
 * rule needs air between the lines to read as two. They now sit
 * at 6 and 11 with the radii the geometry demands.
 *
 * THE COPY IS FRAMED, NOT CROPPED. The margin inside the ruling
 * ran 14.5 at the sides but 5.5 at the top: the frame nearly
 * touched the eyebrow. It is even now, with the top a shade
 * tighter than the bottom because small caps sit optically
 * higher than a line carrying descenders.
 *
 * THE PLATE IS ENGRAVED, NOT TINTED. Engravers build tone with
 * hatching — parallel lines that crowd where the shade deepens.
 * So the plate is hatched at its base, fading out as it rises
 * into the light pooled under the mark. Light above, tone below,
 * and the surface stops reading as flat colour.
 *
 * THE TYPE HOLDS THE SCALE. Title at 28 to carry a card this
 * important, the sentence at 15.5 over 22 — 1.42 leading, where
 * a serif breathes — and the eyebrow lifted to 10 so it is a
 * whisper rather than a mumble.
 * ═════════════════════════════════════════════════════════════ */

const ENG_R = 24;        // the plate's own radius
const ENG_OUT = 6;       // outer rule inset
const ENG_IN = 11;       // inner rule inset
const ENG_MARK = 64;     // the glyph
const ENG_MARK_BOX = 70;
const ENG_MARK_INSET = 13;

/**
 * Engraver's hatching. Parallel lines crowding toward the base, each one a
 * touch stronger than the last, so the plate carries tone at its foot and
 * rises clean into the light. Measured from layout, so the ramp always ends
 * exactly at the bottom edge whatever the copy does.
 */
function EngHatch({ color }: { color: string }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const step = 6;
  const from = box.h * 0.34;
  const rows: { y: number; o: number }[] = [];

  if (box.h > 0) {
    const span = Math.max(1, box.h - from);
    for (let y = from; y <= box.h; y += step) {
      rows.push({ y, o: 0.01 + ((y - from) / span) * 0.055 });
    }
  }

  return (
    // Held inside the ruling. One rule runs the whole plate: ink stays within
    // the frame, light may spill over it. The hatching is ink.
    <View
      pointerEvents="none"
      style={b.hatch}
      onLayout={e => {
        const { width, height } = e.nativeEvent.layout;
        setBox({ w: Math.round(width), h: Math.round(height) });
      }}
    >
      {rows.length > 0 && (
        <Svg width={box.w} height={box.h} style={StyleSheet.absoluteFill}>
          {rows.map((row, i) => (
            <Line
              key={i}
              x1={0}
              y1={row.y}
              x2={box.w}
              y2={row.y}
              stroke={color}
              strokeOpacity={row.o}
              strokeWidth={1}
            />
          ))}
        </Svg>
      )}
    </View>
  );
}

export function VariantEngraved({ card }: VariantProps) {
  const bloomId = `engB_${card.id}`;
  // Ornament keeps the accent colour; anything that has to be *read* takes the
  // deeper tone.
  const ink = readingTone(card);

  return (
    <View style={[b.card, { backgroundColor: card.bg, borderColor: card.border }]}>
      {/* The wash rises toward the mark, so the plate is palest where the light
          and the emblem actually are. */}
      <LinearGradient
        colors={[mixWhite(card.bg, 0.08), mixWhite(card.bg, 0.7)]}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0.08 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <EngHatch color={card.decorColor} />

      {/* The light the mark stands in, centred on it exactly. */}
      <View pointerEvents="none" style={b.bloom}>
        <Svg width={150} height={150}>
          <Defs>
            <RadialGradient id={bloomId} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.88} />
              <Stop offset="0.5" stopColor="#FFFDF7" stopOpacity={0.42} />
              <Stop offset="1" stopColor="#FFFBEE" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={75} cy={75} rx={74} ry={74} fill={`url(#${bloomId})`} />
        </Svg>
      </View>

      {/* Upright and held inside the inner rule: on a ruled plate a frame the
          ornament crosses reads as broken engraving. */}
      <View style={b.watermark} pointerEvents="none">
        <card.Decor s={ENG_MARK} c={card.decorColor} w={1} />
      </View>

      {/* The double rule, struck in the card's own tone */}
      <View pointerEvents="none" style={[b.rule, { borderColor: withAlpha(card.labelColor, 0.28) }]} />
      <View pointerEvents="none" style={[b.ruleInner, { borderColor: withAlpha(card.labelColor, 0.14) }]} />
      <View pointerEvents="none" style={b.litEdge} />

      <View style={b.body}>
        <View style={b.labelRow}>
          <View style={[b.diamond, { backgroundColor: withAlpha(card.labelColor, 0.7) }]} />
          <Text style={[b.label, { color: ink }]} numberOfLines={1}>
            {card.label}
          </Text>
        </View>

        <Text
          style={[b.title, { color: card.titleColor }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
        >
          {card.title}
        </Text>

        {/* A rule that fades as it runs, rather than a bar that stops dead. */}
        <LinearGradient
          colors={[withAlpha(card.labelColor, 0.38), withAlpha(card.labelColor, 0.04)]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={b.titleRule}
          pointerEvents="none"
        />

        <Text style={[b.desc, { color: ink }]}>{card.description}</Text>
      </View>
    </View>
  );
}

const b = StyleSheet.create({
  card: {
    position: 'relative',
    borderRadius: ENG_R,
    borderCurve: 'continuous',
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#8C7A4F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.11,
    shadowRadius: 16,
    elevation: 3,
  },

  /* — the ruling — */
  // R − d, so the corners run concentric with the plate's own.
  rule: {
    position: 'absolute',
    top: ENG_OUT,
    left: ENG_OUT,
    right: ENG_OUT,
    bottom: ENG_OUT,
    borderRadius: ENG_R - ENG_OUT,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  ruleInner: {
    position: 'absolute',
    top: ENG_IN,
    left: ENG_IN,
    right: ENG_IN,
    bottom: ENG_IN,
    borderRadius: ENG_R - ENG_IN,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  // Spanning the flat of the top edge — where the plate's curve ends.
  litEdge: {
    position: 'absolute',
    top: 1.5,
    left: ENG_R,
    right: ENG_R,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },

  // Just inside the inner rule, clipped to the panel's own corner radius.
  hatch: {
    position: 'absolute',
    top: ENG_IN + 1,
    left: ENG_IN + 1,
    right: ENG_IN + 1,
    bottom: ENG_IN + 1,
    borderRadius: ENG_R - ENG_IN - 1,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },

  /* — the mark — */
  // Centred on the mark: box inset 13 + half of 70 = 48 from top and right.
  bloom: { position: 'absolute', top: -27, right: -27, width: 150, height: 150 },
  watermark: {
    position: 'absolute',
    top: ENG_MARK_INSET,
    right: ENG_MARK_INSET,
    width: ENG_MARK_BOX,
    height: ENG_MARK_BOX,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.14,
  },

  /* — the copy — */
  // Even margin inside the inner rule: 13 at the sides, 9 above, 11 below.
  body: { paddingHorizontal: ENG_IN + 13, paddingTop: ENG_IN + 9, paddingBottom: ENG_IN + 11 },
  labelRow: { flexDirection: 'row', alignItems: 'center', columnGap: 7 },
  diamond: { width: 4.5, height: 4.5, borderRadius: 0.5, transform: [{ rotate: '45deg' }] },
  label: { fontFamily: F.sansBold, fontSize: 10, lineHeight: 12, letterSpacing: 2.2 },
  title: {
    // Close under its own eyebrow — the two are one unit.
    marginTop: 5,
    // Stops where the glyph begins: inset 13 + box 70 − the glyph's 3 of slack
    // inside that box − the body's own 24.
    paddingRight: 56,
    fontFamily: F.serifSemiBold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.45,
  },
  titleRule: { width: 44, height: 1, marginTop: 8, borderRadius: 1 },
  desc: { marginTop: 8, fontFamily: F.serif, fontSize: 15.5, lineHeight: 22 },
});

/* ═══ C — COMPACT ROW ═════════════════════════════════════════
 * The density question. Four full-bleed cards is a long scroll
 * on a small phone; this asks whether the section still reads
 * when each card is a seated icon, a title and one line of copy.
 * ═════════════════════════════════════════════════════════════ */

export function VariantCompact({ card }: VariantProps) {
  return (
    <View style={[c.card, { backgroundColor: mixWhite(card.bg, 0.42), borderColor: card.border }]}>
      <View
        style={[
          c.iconSeat,
          { backgroundColor: '#FFFFFF', borderColor: withAlpha(card.labelColor, 0.3) },
        ]}
      >
        <View style={[c.iconCore, { backgroundColor: withAlpha(card.labelColor, 0.13) }]}>
          <card.Decor s={21} c={card.arrowBg} w={1.7} />
        </View>
      </View>

      <View style={c.copy}>
        <Text style={[c.label, { color: card.labelColor }]} numberOfLines={1}>
          {card.label}
        </Text>
        <Text style={[c.title, { color: card.titleColor }]} numberOfLines={1}>
          {card.title}
        </Text>
        <Text style={[c.desc, { color: card.bodyColor }]} numberOfLines={2}>
          {card.description}
        </Text>
      </View>

      <View style={[c.chevronSeat, { borderColor: withAlpha(card.labelColor, 0.26) }]} pointerEvents="none">
        <ChevronRight s={14} c={card.labelColor} w={2.2} />
      </View>
    </View>
  );
}

const c = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 13,
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 9,
    elevation: 2,
  },
  iconSeat: {
    width: 46,
    height: 46,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconCore: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, minWidth: 0 },
  label: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.9 },
  title: { marginTop: 3, fontFamily: F.serifMedium, fontSize: 19, lineHeight: 23, letterSpacing: -0.2 },
  desc: { marginTop: 2, fontFamily: F.serif, fontSize: 13.5, lineHeight: 17.5 },
  chevronSeat: {
    width: 27,
    height: 27,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});

/* ═══ REGISTRY ════════════════════════════════════════════════ */

export type LabVariant = {
  key: string;
  /** Shown on the switcher. Keep it short — the rail is narrow. */
  label: string;
  Card: (props: VariantProps) => React.ReactElement;
  /** Vertical gap between cards in this design. */
  gap: number;
};

// ONE leads, so the lab opens on the proposal with the baseline one tap away.
export const LAB_VARIANTS: LabVariant[] = [
  { key: 'btfl', label: 'BTFL', Card: VariantBtfl, gap: 11 },
  { key: 'newengraved', label: 'New Engraved', Card: VariantNewEngraved, gap: 10 },
  { key: 'one', label: 'ONE', Card: VariantOne, gap: 10 },
  { key: 'current', label: 'Current', Card: VariantCurrent, gap: 6 },
  { key: 'engraved', label: 'Engraved', Card: VariantEngraved, gap: 10 },
  { key: 'compact', label: 'Compact', Card: VariantCompact, gap: 9 },
];
