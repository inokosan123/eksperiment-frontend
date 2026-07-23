import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import Reanimated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { F } from '@/constants/tokens';

// "Banked ember" — the resting register shared by the app's two streak
// cards: Your Progress on Home and Trophy Streak on Focus.
//
// A banked fire is not an extinguished one. The coals are raked over and
// held overnight, still warm, waiting to be woken. So a dormant card never
// leaves the golden world of an active one: the chroma is pulled back
// toward warm ash, every ornament that spun or swept goes still, the
// instrument faces switch from solid rails to dashed ones — and exactly
// one slow ember keeps breathing underneath, so the card reads as held,
// not dead.

export const BANKED = {
  /* Card surfaces — warm parchment, never a cold gray. */
  surface: ['#F0E7D4', '#FAF6EC', '#FEFCF7'] as const,
  buttonSurface: ['#F3ECDC', '#FDFBF6'] as const,
  border: '#E4DAC4',
  rule: '#E7DECC',

  /* Warm ash — the ink and engraving of a resting card. */
  ash: '#A89877',
  ashLine: 'rgba(168,152,119,0.5)',
  ashSoft: 'rgba(168,152,119,0.34)',

  /* The bloom, cooled from gold to ash but still warm-hued. */
  bloomRim: '#DED2B8',
  bloomMid: '#EFE7D4',
  bloomHeart: '#FBF7EC',

  /* The coal that is still alive. */
  ember: '#D8B77E',
  emberLine: 'rgba(216,183,126,0.62)',

  /* Type. */
  ink: '#6C6151',
  inkSoft: 'rgba(122,112,94,0.78)',
  inkMuted: '#8A806D',

  /* Struck — the app's own oxblood, the ink reserved for an entry that was
     deliberately ruled out. A day nobody scheduled is quiet; a day you
     yourself set aside was an act, and gets stamped for it. */
  struckInk: '#A24351',
  struckLine: 'rgba(162,67,81,0.55)',
  struckHair: 'rgba(162,67,81,0.34)',
  struckWash: 'rgba(162,67,81,0.05)',
} as const;

export type BankedTone = 'quiet' | 'struck';

function toneInk(tone: BankedTone) {
  return tone === 'struck' ? BANKED.struckInk : BANKED.inkMuted;
}

function toneLine(tone: BankedTone) {
  return tone === 'struck' ? BANKED.struckLine : BANKED.ashLine;
}

/* ── Banked weave ─────────────────────────────────────────── */
// The active cards are raked with a single diagonal hairline weave. A
// resting card is raked twice — the second pass coarser, fainter and
// running against the first — so the surface reads as laid paper rather
// than as the same gold field with the colour taken out. It is the
// texture, not the tint, that makes a quiet card look composed.
export function BankedWeave() {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const stepA = 30;
  const stepB = 46;
  const span = box.w + box.h;
  const countA = box.w > 0 ? Math.ceil(span / stepA) + 1 : 0;
  const countB = box.w > 0 ? Math.ceil(span / stepB) + 1 : 0;

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={event => {
        const { width, height } = event.nativeEvent.layout;
        setBox({ w: width, h: height });
      }}
    >
      {countA > 0 && (
        <Svg width={box.w} height={box.h} style={StyleSheet.absoluteFill}>
          {Array.from({ length: countA }).map((_, index) => {
            const offset = index * stepA;
            return (
              <Line
                key={`rake-${index}`}
                x1={offset}
                y1={-4}
                x2={offset - box.h - 8}
                y2={box.h + 4}
                stroke={BANKED.ash}
                strokeOpacity={0.055}
                strokeWidth={1}
              />
            );
          })}
          {Array.from({ length: countB }).map((_, index) => {
            const offset = index * stepB - box.h;
            return (
              <Line
                key={`counter-${index}`}
                x1={offset}
                y1={-4}
                x2={offset + box.h + 8}
                y2={box.h + 4}
                stroke={BANKED.ash}
                strokeOpacity={0.032}
                strokeWidth={1}
              />
            );
          })}
        </Svg>
      )}
    </View>
  );
}

/* ── Ledger cartouche ─────────────────────────────────────── */
// What a resting instrument shows where its reading would be. A bare rule
// left the well looking empty — the card's largest element became nothing.
// This is a proper engraved field instead: a clipped-corner frame around a
// ruled blank, big enough to hold the space the number gave up.
export function LedgerCartouche({
  width = 58,
  height = 32,
  tone = 'quiet',
}: {
  width?: number;
  height?: number;
  tone?: BankedTone;
}) {
  const line = toneLine(tone);
  const cut = Math.min(7, height * 0.24);
  const inset = 0.75;
  const frame = [
    `M ${cut} ${inset}`,
    `H ${width - cut}`,
    `L ${width - inset} ${cut}`,
    `V ${height - cut}`,
    `L ${width - cut} ${height - inset}`,
    `H ${cut}`,
    `L ${inset} ${height - cut}`,
    `V ${cut}`,
    'Z',
  ].join(' ');

  const cy = height / 2;
  const cx = width / 2;
  const gem = Math.max(3, width * 0.055);
  const barOuter = width * 0.19;
  // Held off the gem by a fixed gap so the rule never crowds it at any size.
  const barInner = cx - gem - 3.5;

  return (
    <Svg pointerEvents="none" width={width} height={height}>
      <Path d={frame} fill="none" stroke={line} strokeWidth={1} strokeLinejoin="round" />
      <Line x1={barOuter} y1={cy} x2={barInner} y2={cy} stroke={line} strokeWidth={1.5} strokeLinecap="round" />
      <Path
        d={`M ${cx} ${cy - gem} L ${cx + gem} ${cy} L ${cx} ${cy + gem} L ${cx - gem} ${cy} Z`}
        fill={line}
      />
      <Line
        x1={width - barInner}
        y1={cy}
        x2={width - barOuter}
        y2={cy}
        stroke={line}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/* ── Ember pulse ──────────────────────────────────────────── */
// The single living element a dormant card is allowed: a warm coal
// breathing under the ash, slow enough to read as rest rather than
// activity. Concentric discs stand in for a radial falloff.
export function EmberPulse({
  size = 30,
  style,
}: {
  size?: number;
  style?: ViewStyle;
}) {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      t.value = 0.5;
      return;
    }
    t.value = 0;
    t.value = withRepeat(
      withTiming(1, { duration: 5200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(t);
  }, [reduceMotion, t]);

  // Opacity only — scaling a small view on Android resamples its bitmap.
  const breath = useAnimatedStyle(() => ({ opacity: 0.26 + t.value * 0.32 }));

  return (
    <Reanimated.View
      pointerEvents="none"
      style={[ember.stage, { width: size, height: size }, style, breath]}
    >
      <View
        style={[
          ember.disc,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: 'rgba(216,183,126,0.32)' },
        ]}
      />
      <View
        style={[
          ember.disc,
          { width: size * 0.66, height: size * 0.66, borderRadius: size * 0.33, backgroundColor: 'rgba(233,203,145,0.48)' },
        ]}
      />
      <View
        style={[
          ember.disc,
          { width: size * 0.36, height: size * 0.36, borderRadius: size * 0.18, backgroundColor: 'rgba(250,230,186,0.6)' },
        ]}
      />
    </Reanimated.View>
  );
}

const ember = StyleSheet.create({
  stage: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  disc: { position: 'absolute' },
});

/* ── Rest seal ────────────────────────────────────────────── */
// The resting card's focal ornament, and the reason it reads as composed
// rather than merely drained: a double-ruled plaque pressed between two
// engraved wings and tilted a few degrees, the way a stamp lands when a
// hand presses it. Both streak cards wear it, so a resting Home and a
// resting Focus are recognizably the same state.
//
// `struck` gives it the app's oxblood: the entry was ruled out on purpose.
export function RestSeal({
  label,
  tone = 'quiet',
  style,
}: {
  label: string;
  tone?: BankedTone;
  style?: ViewStyle;
}) {
  const ink = toneInk(tone);
  const line = toneLine(tone);
  const struck = tone === 'struck';

  const hair = struck ? BANKED.struckHair : BANKED.ashSoft;

  return (
    <View pointerEvents="none" style={[seal.wrap, style]}>
      <View style={seal.wingGroup}>
        <View style={[seal.serif, { backgroundColor: hair }]} />
        <View style={[seal.wing, { backgroundColor: hair }]} />
      </View>

      <View style={[seal.plaque, { borderColor: line, backgroundColor: struck ? BANKED.struckWash : 'transparent' }]}>
        <View style={[seal.plaqueInner, { borderColor: hair }]}>
          <View style={[seal.diamond, { backgroundColor: line }]} />
          <Text style={[seal.text, { color: ink }]}>{label}</Text>
          <View style={[seal.diamond, { backgroundColor: line }]} />
        </View>
        {/* Registration ticks — the marks a struck plate leaves at its
            corners. They are what separates a stamp from a bordered box. */}
        <View style={[seal.tick, seal.tickTL, { borderColor: line }]} />
        <View style={[seal.tick, seal.tickTR, { borderColor: line }]} />
        <View style={[seal.tick, seal.tickBL, { borderColor: line }]} />
        <View style={[seal.tick, seal.tickBR, { borderColor: line }]} />
      </View>

      <View style={seal.wingGroup}>
        <View style={[seal.wing, { backgroundColor: hair }]} />
        <View style={[seal.serif, { backgroundColor: hair }]} />
      </View>
    </View>
  );
}

const seal = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    transform: [{ rotate: '-4deg' }],
  },
  wingGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  wing: {
    width: 26,
    height: 1,
    borderRadius: 1,
  },
  serif: {
    width: 1,
    height: 7,
    borderRadius: 1,
  },
  plaque: {
    position: 'relative',
    borderWidth: 1,
    borderRadius: 4,
    borderCurve: 'continuous',
    padding: 2.5,
  },
  tick: {
    position: 'absolute',
    width: 5,
    height: 5,
  },
  tickTL: { top: -3.5, left: -3.5, borderLeftWidth: 1, borderTopWidth: 1 },
  tickTR: { top: -3.5, right: -3.5, borderRightWidth: 1, borderTopWidth: 1 },
  tickBL: { bottom: -3.5, left: -3.5, borderLeftWidth: 1, borderBottomWidth: 1 },
  tickBR: { bottom: -3.5, right: -3.5, borderRightWidth: 1, borderBottomWidth: 1 },
  plaqueInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 2,
    borderCurve: 'continuous',
    paddingHorizontal: 11,
    paddingVertical: 4.5,
  },
  diamond: {
    width: 3.5,
    height: 3.5,
    borderRadius: 0.5,
    transform: [{ rotate: '45deg' }],
  },
  text: {
    fontFamily: F.sansBold,
    fontSize: 10.5,
    lineHeight: 13,
    letterSpacing: 3.4,
  },
});

/* ── Ledger rail ──────────────────────────────────────────── */
// The closed-book line that keeps a measuring instrument's slot when
// there is nothing to measure: a caption between two hairlines, capped by
// diamonds, in the same grammar as Home's analytics button.
export function LedgerRail({ label, style }: { label: string; style?: ViewStyle }) {
  return (
    <View pointerEvents="none" style={[rail.wrap, style]}>
      <View style={rail.diamond} />
      <View style={rail.line} />
      <Text style={rail.text}>{label}</Text>
      <View style={rail.line} />
      <View style={rail.diamond} />
    </View>
  );
}

const rail = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  line: { flex: 1, height: 1, borderRadius: 1, backgroundColor: BANKED.ashSoft },
  text: {
    fontFamily: F.sansBold,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 1.9,
    color: BANKED.inkMuted,
  },
  diamond: {
    width: 4,
    height: 4,
    borderRadius: 0.5,
    backgroundColor: BANKED.ashLine,
    transform: [{ rotate: '45deg' }],
  },
});
