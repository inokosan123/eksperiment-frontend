import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
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

/* ── Registers ────────────────────────────────────────────── */
// Two resting registers, because two resting days are not the same day.
//
//   ash    — nobody ever scheduled anything. Warm parchment, warm ash
//            marks, a warm coal. Gentle; nothing was lost.
//   struck — you set the day aside yourself. That is graver, so it is
//            graphite: a grey field, a black silhouette over a white
//            pool, and the app's oxblood as the single accent. Value
//            contrast does the work here, not tint — which is exactly
//            what the ash register could not do on its own.
export type BankedRegister = 'ash' | 'struck';

export type BankedPalette = {
  surface: readonly [string, string, string];
  buttonSurface: readonly [string, string];
  border: string;
  rule: string;
  line: string;
  hair: string;
  weave: string;
  weaveOpacity: readonly [number, number];
  sparkle: string | null;
  bloomRim: string;
  bloomMid: string;
  bloomHeart: string;
  engraving: string;
  silhouette: string;
  silhouetteOpacity: number;
  glowOuter: string;
  glowMid: string;
  glowHeart: string;
  coreDiscs: readonly [string, string, string];
  ink: string;
  inkSoft: string;
  inkMuted: string;
  stud: string;
  socketStud: string;
  seal: BankedTone;
};

const ASH_PALETTE: BankedPalette = {
  surface: ['#F0E7D4', '#FAF6EC', '#FEFCF7'],
  buttonSurface: ['#F3ECDC', '#FDFBF6'],
  border: '#E4DAC4',
  rule: '#E7DECC',
  line: 'rgba(168,152,119,0.5)',
  hair: 'rgba(168,152,119,0.34)',
  weave: '#A89877',
  weaveOpacity: [0.055, 0.032],
  sparkle: '#D8B77E',
  bloomRim: '#DED2B8',
  bloomMid: '#EFE7D4',
  bloomHeart: '#FBF7EC',
  engraving: '#A89877',
  silhouette: '#A2937A',
  silhouetteOpacity: 0.82,
  glowOuter: 'rgba(222,210,184,0.42)',
  glowMid: 'rgba(239,231,212,0.55)',
  glowHeart: 'rgba(251,247,236,0.92)',
  coreDiscs: ['rgba(216,183,126,0.32)', 'rgba(233,203,145,0.48)', 'rgba(250,230,186,0.6)'],
  ink: '#6C6151',
  inkSoft: 'rgba(122,112,94,0.78)',
  inkMuted: '#8A806D',
  stud: '#D8B77E',
  socketStud: '#D8CDB6',
  seal: 'quiet',
};

const STRUCK_PALETTE: BankedPalette = {
  // Grey, and it keeps its gradient — the field lifts to near-white at the
  // far corner so the card still has light in it.
  surface: ['#D5D5D2', '#EBEBE8', '#FAFAF9'],
  buttonSurface: ['#E3E3E0', '#FAFAF9'],
  border: '#C7C7C2',
  rule: '#D4D4CF',
  line: 'rgba(41,38,35,0.5)',
  hair: 'rgba(41,38,35,0.26)',
  weave: '#3A3733',
  weaveOpacity: [0.045, 0.026],
  // A struck page does not twinkle.
  sparkle: null,
  bloomRim: '#CECECA',
  bloomMid: '#E9E9E6',
  bloomHeart: '#FFFFFF',
  engraving: '#3A3733',
  // The app's near-black, struck nearly solid — this is the element the
  // whole composition hangs on.
  silhouette: '#1C1917',
  silhouetteOpacity: 0.92,
  glowOuter: 'rgba(198,198,194,0.44)',
  glowMid: 'rgba(228,228,224,0.62)',
  glowHeart: 'rgba(255,255,255,0.96)',
  // White, not gold: the silhouette reads as a cut-out held to the light.
  coreDiscs: ['rgba(255,255,255,0.46)', 'rgba(255,255,255,0.7)', 'rgba(255,255,255,0.92)'],
  ink: '#1C1917',
  inkSoft: 'rgba(28,25,23,0.6)',
  inkMuted: '#57534E',
  stud: '#A24351',
  socketStud: '#C4C4BF',
  seal: 'struck',
};

export function bankedPalette(register: BankedRegister): BankedPalette {
  return register === 'struck' ? STRUCK_PALETTE : ASH_PALETTE;
}

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
export function BankedWeave({ palette = ASH_PALETTE }: { palette?: BankedPalette }) {
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
                stroke={palette.weave}
                strokeOpacity={palette.weaveOpacity[0]}
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
                stroke={palette.weave}
                strokeOpacity={palette.weaveOpacity[1]}
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
  line = BANKED.ashLine,
  gem = line,
}: {
  width?: number;
  height?: number;
  line?: string;
  // The one drop of the stamp's ink inside an otherwise engraved frame.
  gem?: string;
}) {
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
  const gemR = Math.max(3, width * 0.055);
  const barOuter = width * 0.19;
  // Held off the gem by a fixed gap so the rule never crowds it at any size.
  const barInner = cx - gemR - 3.5;

  return (
    <Svg pointerEvents="none" width={width} height={height}>
      <Path d={frame} fill="none" stroke={line} strokeWidth={1} strokeLinejoin="round" />
      <Line x1={barOuter} y1={cy} x2={barInner} y2={cy} stroke={line} strokeWidth={1.5} strokeLinecap="round" />
      <Path
        d={`M ${cx} ${cy - gemR} L ${cx + gemR} ${cy} L ${cx} ${cy + gemR} L ${cx - gemR} ${cy} Z`}
        fill={gem}
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
  discs = ASH_PALETTE.coreDiscs,
  style,
}: {
  size?: number;
  // Warm in the ash register, white in the struck one — there the glow is
  // light behind a cut-out rather than a coal under ash.
  discs?: readonly [string, string, string];
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
          { width: size, height: size, borderRadius: size / 2, backgroundColor: discs[0] },
        ]}
      />
      <View
        style={[
          ember.disc,
          { width: size * 0.66, height: size * 0.66, borderRadius: size * 0.33, backgroundColor: discs[1] },
        ]}
      />
      <View
        style={[
          ember.disc,
          { width: size * 0.36, height: size * 0.36, borderRadius: size * 0.18, backgroundColor: discs[2] },
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
// `struck` gives it the app's oxblood, and the entrance to match: the
// stamp FALLS — a fast drop with the app's own spring at the bottom, so
// it overshoots a couple of pixels and thuds home — and at the moment of
// impact a white flash blooms behind it, then settles into a standing
// white glow, light pooled where the plate hit the page. The quiet tone
// simply eases in; a rest was never struck. All of it is translate,
// rotate and opacity — never scale, which resamples small Android views.
export function RestSeal({
  label,
  tone = 'quiet',
  style,
}: {
  label: string;
  tone?: BankedTone;
  style?: ViewStyle;
}) {
  const reduceMotion = useReducedMotion();
  const ink = toneInk(tone);
  const line = toneLine(tone);
  const struck = tone === 'struck';
  const hair = struck ? BANKED.struckHair : BANKED.ashSoft;

  // drop: 0 = raised above the page, 1 = seated. The spring carries it a
  // few px past the seat and back — the thud. flash: 0 = dark, spikes to
  // ~2.6 at impact, settles at 1 = the standing glow.
  const drop = useSharedValue(0);
  const flash = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      drop.value = 1;
      flash.value = struck ? 1 : 0;
      return;
    }
    drop.value = 0;
    flash.value = 0;
    if (struck) {
      drop.value = withDelay(
        420,
        withSpring(1, { damping: 15, stiffness: 160, mass: 1, velocity: 9 }),
      );
      flash.value = withDelay(
        540,
        withSequence(
          withTiming(2.6, { duration: 110, easing: Easing.out(Easing.quad) }),
          withTiming(1, { duration: 720, easing: Easing.out(Easing.cubic) }),
        ),
      );
    } else {
      drop.value = withDelay(260, withTiming(1, { duration: 460, easing: Easing.out(Easing.cubic) }));
    }
    return () => {
      cancelAnimation(drop);
      cancelAnimation(flash);
    };
  }, [drop, flash, reduceMotion, struck]);

  const stampStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, drop.value * 1.6),
    transform: [
      { translateY: interpolate(drop.value, [0, 1], [struck ? -22 : -8, 0]) },
      { rotate: `${interpolate(drop.value, [0, 1], [struck ? -11 : -6.5, -4])}deg` },
    ],
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flash.value * 0.34,
  }));

  return (
    <Reanimated.View pointerEvents="none" style={[seal.wrap, style, stampStyle]}>
      {/* Impact light — a white bloom behind the plate that flares when the
          stamp lands and stays on as a soft standing glow. */}
      {struck && (
        <Reanimated.View style={[seal.flashWrap, flashStyle]}>
          <View style={[seal.flashDisc, seal.flashOuter]} />
          <View style={[seal.flashDisc, seal.flashMid]} />
          <View style={[seal.flashDisc, seal.flashHeart]} />
        </Reanimated.View>
      )}

      <View style={seal.wingGroup}>
        <View style={[seal.serif, { backgroundColor: hair }]} />
        <View style={[seal.wing, { backgroundColor: hair }]} />
      </View>

      <View style={[seal.plaque, { borderColor: line }, struck ? seal.plaqueStruck : null]}>
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
    </Reanimated.View>
  );
}

const seal = StyleSheet.create({
  // The tilt lives in the animated transform, not here — the strike
  // rotates through it and lands at −4°.
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  flashWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flashDisc: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
  },
  flashOuter: {
    width: 210,
    height: 66,
    borderRadius: 33,
    opacity: 0.42,
  },
  flashMid: {
    width: 150,
    height: 48,
    borderRadius: 24,
    opacity: 0.6,
  },
  flashHeart: {
    width: 96,
    height: 34,
    borderRadius: 17,
    opacity: 0.75,
  },
  // The struck plate sits on white paper, not on a wash — the stamp is a
  // thing pressed onto the page, so it carries its own plate.
  plaqueStruck: {
    backgroundColor: 'rgba(255,255,255,0.66)',
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

/* ── Struck light ─────────────────────────────────────────── */
// The white light a struck card is held under. Grey on its own is a
// closed drawer; grey with light falling on it is a page on a desk. A
// soft white wash pours from the top edge and dies out by two thirds
// down, and a white hairline rim runs just inside the card's border —
// the edge a plate catches when lit from above.
export function StruckLight({ radius = 24 }: { radius?: number }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['rgba(255,255,255,0.5)', 'rgba(255,255,255,0.16)', 'rgba(255,255,255,0)']}
        locations={[0, 0.4, 0.66]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[light.rim, { borderRadius: Math.max(0, radius - 1) }]} />
    </View>
  );
}

const light = StyleSheet.create({
  rim: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
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
