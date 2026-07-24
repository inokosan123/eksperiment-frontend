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
// rather than merely drained: a clipped-corner cartouche — the same
// corner grammar the medallion's ledger cartouche wears — on its own
// paper plate, pressed between two engraved wings and tilted the way a
// stamp lands from a hand. Both streak cards wear it, so a resting Home
// and a resting Focus are recognizably the same state.
//
// Every line of it is drawn in ONE Svg: View borders and rotated squares
// alias into mush the moment the stamp tilts, while a single vector
// surface rotates clean — even stroke weights, true joins, corner marks
// that sit exactly on the corners they register.
//
// `struck` gives it the app's oxblood, and the entrance to match: the
// stamp FALLS — a fast drop with the app's own spring at the bottom, so
// it overshoots a couple of pixels and thuds home — and at the moment of
// impact a white flash blooms behind it, then settles into a standing
// white glow, light pooled where the plate hit the page. The quiet tone
// simply eases in; a rest was never struck. All of it is translate,
// rotate and opacity — never scale, which resamples small Android views.

function cartouchePath(x: number, y: number, w: number, h: number, cut: number) {
  return [
    `M ${x + cut} ${y}`,
    `H ${x + w - cut}`,
    `L ${x + w} ${y + cut}`,
    `V ${y + h - cut}`,
    `L ${x + w - cut} ${y + h}`,
    `H ${x + cut}`,
    `L ${x} ${y + h - cut}`,
    `V ${y + cut}`,
    'Z',
  ].join(' ');
}

const SEAL_COLORS = {
  struck: {
    ink: '#A24351',
    frame: 'rgba(162,67,81,0.82)',
    hairline: 'rgba(162,67,81,0.4)',
    wing: 'rgba(162,67,81,0.5)',
    tick: 'rgba(162,67,81,0.5)',
    gem: 'rgba(162,67,81,0.62)',
    plate: 'rgba(255,255,255,0.72)',
    emboss: 'rgba(255,255,255,0.6)',
  },
  quiet: {
    ink: '#8A806D',
    frame: 'rgba(168,152,119,0.68)',
    hairline: 'rgba(168,152,119,0.36)',
    wing: 'rgba(168,152,119,0.48)',
    tick: 'rgba(168,152,119,0.44)',
    gem: 'rgba(168,152,119,0.58)',
    plate: 'rgba(255,255,255,0.42)',
    emboss: 'rgba(255,255,255,0.5)',
  },
} as const;

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
  const struck = tone === 'struck';
  const c = SEAL_COLORS[struck ? 'struck' : 'quiet'];
  const [textBox, setTextBox] = useState({ w: 0, h: 0 });

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

  /* Geometry — everything keys off the measured label. */
  const ready = textBox.w > 0;
  const padH = 15;
  const padV = 6.5;
  const cut = 5.5;
  const margin = 5; // room for corner marks and the emboss line
  const wingGap = 7;
  const wingLine = 25;
  const serifGap = 3;
  const wingTotal = wingGap + wingLine + serifGap + 1.6;
  const plaqueW = textBox.w + padH * 2;
  const plaqueH = textBox.h + padV * 2;
  const svgW = margin * 2 + wingTotal * 2 + plaqueW;
  const svgH = margin * 2 + plaqueH;
  const px = margin + wingTotal;
  const py = margin;
  const cy = margin + plaqueH / 2;
  const gem = 3.2;
  // Corner marks: short strokes parallel to each cut, floated 1.8 off it —
  // the plate's registration, echoing the cut instead of boxing it.
  const off = 1.8;

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

      {/* Invisible measurer — the seal is drawn around the label's box. */}
      <Text
        style={[seal.text, seal.measurer]}
        numberOfLines={1}
        onLayout={event => {
          const { width, height } = event.nativeEvent.layout;
          setTextBox(previous =>
            Math.abs(previous.w - width) < 0.5 && Math.abs(previous.h - height) < 0.5
              ? previous
              : { w: width, h: height });
        }}
      >
        {label}
      </Text>

      {ready && (
        <View style={{ width: svgW, height: svgH, alignItems: 'center', justifyContent: 'center' }}>
          <Svg pointerEvents="none" width={svgW} height={svgH} style={StyleSheet.absoluteFill}>
            {/* Emboss — the impression's lower lip catching the card's
                top-light, drawn under the frame. */}
            <Path
              d={cartouchePath(px, py + 1, plaqueW, plaqueH, cut)}
              fill="none"
              stroke={c.emboss}
              strokeWidth={1.3}
              strokeLinejoin="round"
            />
            {/* Paper plate + main rule, one crisp path. */}
            <Path
              d={cartouchePath(px, py, plaqueW, plaqueH, cut)}
              fill={c.plate}
              stroke={c.frame}
              strokeWidth={1.4}
              strokeLinejoin="round"
            />
            {/* Inner hairline, inset, cuts eased to match. */}
            <Path
              d={cartouchePath(px + 2.4, py + 2.4, plaqueW - 4.8, plaqueH - 4.8, cut - 1.5)}
              fill="none"
              stroke={c.hairline}
              strokeWidth={0.8}
              strokeLinejoin="round"
            />

            {/* Registration marks on the four cuts. */}
            <Line x1={px + cut - off} y1={py - off} x2={px - off} y2={py + cut - off} stroke={c.tick} strokeWidth={1} strokeLinecap="round" />
            <Line x1={px + plaqueW - cut + off} y1={py - off} x2={px + plaqueW + off} y2={py + cut - off} stroke={c.tick} strokeWidth={1} strokeLinecap="round" />
            <Line x1={px + cut - off} y1={py + plaqueH + off} x2={px - off} y2={py + plaqueH - cut + off} stroke={c.tick} strokeWidth={1} strokeLinecap="round" />
            <Line x1={px + plaqueW - cut + off} y1={py + plaqueH + off} x2={px + plaqueW + off} y2={py + plaqueH - cut + off} stroke={c.tick} strokeWidth={1} strokeLinecap="round" />

            {/* Wings: serif cap, engraved line, and a gem seated at the
                plaque's edge — mirrored. */}
            <Line x1={margin + 0.8} y1={cy - 3.5} x2={margin + 0.8} y2={cy + 3.5} stroke={c.wing} strokeWidth={1.6} strokeLinecap="round" />
            <Line x1={margin + 1.6 + serifGap} y1={cy} x2={margin + 1.6 + serifGap + wingLine} y2={cy} stroke={c.wing} strokeWidth={1.2} strokeLinecap="round" />
            <Line x1={svgW - margin - 0.8} y1={cy - 3.5} x2={svgW - margin - 0.8} y2={cy + 3.5} stroke={c.wing} strokeWidth={1.6} strokeLinecap="round" />
            <Line x1={svgW - margin - 1.6 - serifGap - wingLine} y1={cy} x2={svgW - margin - 1.6 - serifGap} y2={cy} stroke={c.wing} strokeWidth={1.2} strokeLinecap="round" />

            {/* Gems flanking the label, inside the plate. */}
            <Path d={`M ${px + 9.5} ${cy - gem} L ${px + 9.5 + gem} ${cy} L ${px + 9.5} ${cy + gem} L ${px + 9.5 - gem} ${cy} Z`} fill={c.gem} />
            <Path d={`M ${px + plaqueW - 9.5} ${cy - gem} L ${px + plaqueW - 9.5 + gem} ${cy} L ${px + plaqueW - 9.5} ${cy + gem} L ${px + plaqueW - 9.5 - gem} ${cy} Z`} fill={c.gem} />
          </Svg>
          {/* translateX rebalances the tracking's trailing space. */}
          <Text style={[seal.text, { color: c.ink, transform: [{ translateX: 1.7 }] }]} numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
    </Reanimated.View>
  );
}

const seal = StyleSheet.create({
  // The tilt lives in the animated transform, not here — the strike
  // rotates through it and lands at −4°. minHeight holds the layout
  // steady for the frame the measurer needs.
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
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
  measurer: {
    position: 'absolute',
    opacity: 0,
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

/* ── Banked glint ─────────────────────────────────────────── */
// The light-sweep grammar of the app's cards, kept alive on a resting
// card so it still catches the light — tuned to its register. A wide soft
// halo carries a bright HOT core just ahead of it, five gradient stops
// each with a bright heart and soft falloff, so the sweep reads as a real
// pane of light passing over the card rather than a flat wash.
//   ash    — a warm gold pass over warm parchment (rest days);
//   struck — a cool white pane over the graphite skipped card.
// Everything is opacity + translate/rotate; nothing scales.
export type BankedGlintVariant = 'ash' | 'struck';

const GLINT_WIDE_LOC = [0, 0.32, 0.5, 0.68, 1] as const;
const GLINT_CORE_LOC = [0, 0.4, 0.5, 0.6, 1] as const;

const BANKED_GLINT: Record<BankedGlintVariant, {
  duration: number;
  peak: number;
  corePeak: number;
  wide: readonly [string, string, string, string, string];
  core: readonly [string, string, string, string, string];
}> = {
  ash: {
    duration: 8200,
    peak: 0.82,
    corePeak: 0.68,
    wide: ['rgba(247,238,217,0)', 'rgba(242,228,194,0.38)', 'rgba(246,233,201,0.72)', 'rgba(242,228,194,0.38)', 'rgba(247,238,217,0)'],
    core: ['rgba(255,251,238,0)', 'rgba(253,246,226,0.55)', 'rgba(255,252,241,0.9)', 'rgba(253,246,226,0.55)', 'rgba(255,251,238,0)'],
  },
  struck: {
    duration: 8600,
    peak: 0.8,
    corePeak: 0.78,
    wide: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.32)', 'rgba(255,255,255,0.6)', 'rgba(255,255,255,0.32)', 'rgba(255,255,255,0)'],
    core: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.66)', 'rgba(255,255,255,0.98)', 'rgba(255,255,255,0.66)', 'rgba(255,255,255,0)'],
  },
};

export function BankedGlint({ variant = 'ash' }: { variant?: BankedGlintVariant }) {
  const reduceMotion = useReducedMotion();
  const [w, setW] = useState(0);
  const t = useSharedValue(0);
  const cfg = BANKED_GLINT[variant];

  useEffect(() => {
    if (reduceMotion || w === 0) return;
    t.value = 0;
    t.value = withRepeat(
      withTiming(1, { duration: cfg.duration, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
    return () => cancelAnimation(t);
  }, [reduceMotion, w, t, cfg.duration]);

  const sweep = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.09, 0.36, 0.5, 1], [0, cfg.peak, cfg.peak, 0, 0]),
    transform: [
      { translateX: interpolate(t.value, [0, 0.44, 1], [-140, w + 80, w + 80]) },
      { rotate: '14deg' },
    ],
  }));

  const core = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.11, 0.34, 0.48, 1], [0, cfg.corePeak, cfg.corePeak, 0, 0]),
    transform: [
      { translateX: interpolate(t.value, [0, 0.44, 1], [-90, w + 120, w + 120]) },
      { rotate: '14deg' },
    ],
  }));

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={event => setW(event.nativeEvent.layout.width)}
    >
      {!reduceMotion && w > 0 && (
        <>
          <Reanimated.View style={[glint.band, sweep]}>
            <LinearGradient colors={cfg.wide} locations={GLINT_WIDE_LOC} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={glint.fill} />
          </Reanimated.View>
          <Reanimated.View style={[glint.core, core]}>
            <LinearGradient colors={cfg.core} locations={GLINT_CORE_LOC} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={glint.fill} />
          </Reanimated.View>
        </>
      )}
    </View>
  );
}

const glint = StyleSheet.create({
  band: { position: 'absolute', top: -34, bottom: -34, width: 168 },
  core: { position: 'absolute', top: -34, bottom: -34, width: 60 },
  fill: { flex: 1 },
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
