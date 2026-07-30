import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, Line, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { F } from '@/constants/tokens';
import { BANKED, BankedWeave, EmberPulse, LedgerCartouche } from '@/components/shared/BankedEmber';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  type SharedValue,
} from 'react-native-reanimated';
import { useFocusMainMotion } from './focus-main-motion';
import { FocusMedalCoin, FocusMedallion, FOCUS_MEDALLION_RATIO, MEDALLION } from '@/components/focus-watch/FocusMedallion';
import {
  pingPongPhase,
  useContinuousAnimationClock,
} from '@/components/shared/use-continuous-animation-clock';

// The streak card's own language — not an instrument, a small celebration.
// Golden rays burst from behind the medallion, the ground it was struck on
// still carries the rings of the blow, and a constellation of four-point
// sparkles twinkles across the card at their own quiet rhythms.
//
// The emblem was the challenge trophy PNG. It is the focus medallion now, and
// the whole medallion — scalloped rim, struck rings, both ribbon tails — not
// the bare disc, because at this size the card is a display case and the tails
// are what make it read as something awarded rather than as an icon.
//
// TWO METALS. Home's streak card is gold on dawn parchment and nothing else.
// This one is the only surface in the app that carries gold AND the
// medallion's violet: violet is the ground light, the shadow a struck medal
// throws, and the cool half of every sweep; gold is the metal itself. That is
// what keeps the two streak cards recognisably one family without letting
// them become the same card twice.

const GOLD = '#C5A059';

// Sixteen, not twelve: at twelve the blades sit far enough apart to be
// counted, and a corona should be felt.
const RAY_COUNT = 16;

// The deeper gold, for motes over the pale bottom-left where the white gauge
// sits: the pale one is simply not there against it.
const GOLD_DEEP = '#A9782C';

// The medallion's own violet, lifted straight off the emblem so the light
// around it and the metal in it are the same two colours.
const VIOLET = MEDALLION.rim;

// The app's shared four-point sparkle is a fairly round-shouldered star: its
// arms swell to a third of its width before they taper, which at 9pt on a gold
// plate reads as a small flower. This card's stars are drawn a stop sharper —
// the same four-point silhouette with its waist pulled in, so each arm leaves
// the centre as a needle and the mark reads as a GLINT off metal, which is
// what a plate of struck gold should be throwing.
const SPARKLE_PATH = 'M12 0 C12.7 8.2 15.8 11.3 24 12 C15.8 12.7 12.7 15.8 12 24 C11.3 15.8 8.2 12.7 0 12 C8.2 11.3 11.3 8.2 12 0 Z';

/* ── Dust ─────────────────────────────────────────────────── */
// Home's streak card dresses its field with three shapes on one clock: struck
// stars, round motes, and diamonds that never move. Same grammar here, so the
// two streak cards read as one family rather than two treatments — with one
// thing Home does not have. A couple of the stars twinkle SHARP: the breath is
// cubed, so they spike bright and then rest dark for most of the cycle, the
// way a real glint catches. A field where everything breathes at once is a
// pulse; a field where two things spike against a slow breath is a night sky.
type MoteKind = 'star' | 'dot' | 'diamond';
type MoteTone = 'gold' | 'deep' | 'violet';

type MoteSpec = {
  kind: MoteKind;
  size: number;
  style: object;
  tone?: MoteTone;
  cycle?: number;
  delay?: number;
  peak?: number;
  sharp?: boolean;
  still?: boolean;
  /** Survives on a banked card, where only a few slow embers are left. */
  quiet?: boolean;
};

const MOTE_TONES: Record<MoteTone, string> = {
  gold: GOLD,
  deep: GOLD_DEEP,
  violet: VIOLET,
};

// THE CONSTELLATION.
//
// The old dust was scattered for a different card: it had a diamond sitting
// against the MEDAL STREAK kicker with a dot overlapping it, a star in the
// header's gap, and marks down both flanks at heights that were open card then
// and are now the plaque's edge and the medal's mount. Dust that touches type
// or crosses a mounted edge does not read as light — it reads as specks on the
// lens.
//
// Rules this set is built on, and they are the design:
//   · nothing within reach of type, the plaque, the mount, the strip or the
//     bar — dust lives in the AIR between the objects, never on them;
//   · the four gutters that are genuinely empty on this composition: above
//     and beside the plaque, the wedge under the medal, the two outer margins
//     beside the week strip, and the band under the gauge;
//   · sizes fall as they leave the light: the biggest star sits top-left where
//     the plate is deepest, the smallest motes sit in the lit right half;
//   · one tone rule — pale gold in the deep left, DEEP gold anywhere the plate
//     has gone pale, violet only where the mounted objects' own shadow falls,
//     so the dust belongs to the two metals the card is already made of.
const MEDAL_DUST: MoteSpec[] = [
  /* The top band, ABOVE the plaque and clear of both header texts: the kicker
     ends around x 150 and the calendar link begins around x 215, and this band
     sits under both of them rather than beside either. */
  { kind: 'star', size: 9, style: { left: 20, top: 44 }, cycle: 2900, peak: 0.4, sharp: true, quiet: true },
  { kind: 'dot', size: 2.5, style: { left: 46, top: 34 }, still: true, peak: 0.24 },
  // Set on the plaque's own axis rather than floating between it and the
  // kicker: at 40 the diamond sat in the 8pt of card between the two and read
  // as a speck caught in a seam.
  { kind: 'diamond', size: 3.5, style: { left: 172, top: 36 }, tone: 'violet', still: true, peak: 0.3 },

  /* The wedge between the plaque and the mount — the emptiest gutter on the
     card, and the one the eye crosses on its way from the count to the medal. */
  { kind: 'star', size: 7, style: { left: 196, top: 96 }, cycle: 3400, delay: 900, peak: 0.32 },
  { kind: 'dot', size: 2, style: { left: 214, top: 118 }, still: true, peak: 0.2 },

  /* The left margin, running down past the plaque to the strip. Deep gold:
     this flank is where the plate is palest below the plaque. */
  { kind: 'dot', size: 3, style: { left: 7, top: 104 }, tone: 'deep', still: true, peak: 0.28, quiet: true },
  { kind: 'star', size: 6, style: { left: 16, top: 152 }, tone: 'violet', cycle: 4200, delay: 1700, peak: 0.28 },

  /* Under the mount, in the wedge between it and the headline. */
  { kind: 'diamond', size: 3, style: { right: 34, top: 148 }, tone: 'deep', still: true, peak: 0.26, quiet: true },
  { kind: 'star', size: 7.5, style: { right: 13, top: 168 }, tone: 'deep', cycle: 2600, delay: 2400, peak: 0.36, sharp: true },

  /* The two outer margins beside the week strip, which is inset from the
     card's edges — these sit in that inset, never over a mark. */
  { kind: 'dot', size: 2.5, style: { left: 6, bottom: 108 }, tone: 'deep', cycle: 5600, delay: 3100, peak: 0.22, quiet: true },
  { kind: 'diamond', size: 2.5, style: { right: 7, bottom: 112 }, tone: 'deep', still: true, peak: 0.22 },

  /* The band under the gauge — the card's last inch of plate. Anchored to the
     BOTTOM so a rest day, which drops the week strip and shortens the card,
     keeps its constellation. */
  { kind: 'star', size: 6, style: { left: 30, bottom: 8 }, tone: 'deep', cycle: 3800, delay: 1200, peak: 0.24 },
  { kind: 'dot', size: 2, style: { left: 74, bottom: 13 }, tone: 'deep', still: true, peak: 0.18 },
  { kind: 'diamond', size: 3, style: { right: 46, bottom: 9 }, tone: 'deep', still: true, peak: 0.22, quiet: true },
];

// THE GROUND, and what it learned the hard way.
//
// Concentric rings spreading from behind the medal were tried here — the shock
// a struck ground keeps. On the screen they were scratches: arcs crossing the
// week strip and cutting straight through the medal's own halo, so the eye
// read them as a rendering fault rather than as a ripple. Two circular
// families cannot share one surface when one of them is the subject.
//
// So the ground goes back to being a ground: Home's single gold rake, at
// Home's step and Home's weight, and nothing else drawn on it. What gives this
// card its own face is not a pattern — it is the VALUE of the field, the
// violet the medal is struck on, and the deeper gold pooled under the white
// instrument at its foot. Ornament was never the missing thing; contrast was.
const RAKE_STEP = 30;

function MoteShape({ kind, size, color }: { kind: MoteKind; size: number; color: string }) {
  return kind === 'star' ? (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={SPARKLE_PATH} fill={color} />
    </Svg>
  ) : (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: kind === 'dot' ? size / 2 : size * 0.16,
        backgroundColor: color,
        transform: kind === 'diamond' ? [{ rotate: '45deg' }] : undefined,
      }}
    />
  );
}

// Where a still mote sits, and where an animated one is parked when motion is
// off: a sharp mote spends most of its cycle dark, so its resting value is
// lower than the midpoint a breathing one settles at.
function moteRest(spec: MoteSpec, slow: boolean) {
  const peak = (spec.peak ?? 0.3) * (slow ? 0.5 : 1);
  return (slow ? 0.07 : 0.1) + peak * (spec.sharp ? 0.3 : 0.5);
}

function AnimatedMote({
  spec,
  color,
  slow,
  clock,
}: {
  spec: MoteSpec;
  color: string;
  slow: boolean;
  clock: SharedValue<number>;
}) {
  // Banked: the sparks are half as bright and take nearly twice as long.
  const cycle = (spec.cycle ?? 2600) * (slow ? 1.9 : 1);
  const delay = spec.delay ?? 0;
  const sharp = spec.sharp ?? false;
  const floor = slow ? 0.07 : 0.1;
  const reach = (spec.peak ?? 0.3) * (slow ? 0.5 : 1);

  const twinkle = useAnimatedStyle(() => {
    const wave = pingPongPhase(clock.value, cycle, delay);
    return { opacity: floor + (sharp ? wave * wave * wave : wave) * reach };
  });

  return (
    <Animated.View pointerEvents="none" style={[dust.mote, spec.style, twinkle]}>
      <MoteShape kind={spec.kind} size={spec.size} color={color} />
    </Animated.View>
  );
}

function Mote({
  spec,
  color,
  active,
  slow,
  clock,
}: {
  spec: MoteSpec;
  color: string;
  active: boolean;
  slow: boolean;
  clock: SharedValue<number>;
}) {
  if (spec.still || !active) {
    return (
      <View pointerEvents="none" style={[dust.mote, spec.style, { opacity: moteRest(spec, slow) }]}>
        <MoteShape kind={spec.kind} size={spec.size} color={color} />
      </View>
    );
  }
  return <AnimatedMote spec={spec} color={color} slow={slow} clock={clock} />;
}

const dust = StyleSheet.create({
  mote: { position: 'absolute' },
});

/**
 * Card-wide backdrop: the ground the medal was struck on.
 *
 * Live, three grounds are laid over the card's gold in one vector surface,
 * each doing a job the others cannot — the violet haze the signature reads
 * against on the left, the rings of the strike spreading from the medal on
 * the right, and a deeper gold pooled into the bottom-left corner so the
 * white instrument that stands there has something to be white against —
 * and the constellation twinkles above them. Banked, all of it goes: the ash
 * weave takes the field and a handful of slow embers are the only light left.
 *
 * `strike` is where the medal stands — measured in from the card's right edge
 * and down from its top. It places the warm pool the medal is lit by, so it
 * has to agree with the layout above to the pixel; until the card has measured
 * it, the pool is not drawn at all.
 */
export function TrophyShineBackdrop({
  muted = false,
  strike,
}: {
  muted?: boolean;
  strike?: { right: number; top: number; crest: number };
}) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const reduceMotion = useReducedMotion();
  const mainMotionEnabled = useFocusMainMotion();
  const motionEnabled = mainMotionEnabled && !reduceMotion;
  const clock = useContinuousAnimationClock(motionEnabled);
  const laid = !muted && box.w > 0;
  const rakeCount = laid ? Math.ceil((box.w + box.h) / RAKE_STEP) + 1 : 0;
  const moteColor = (spec: MoteSpec) => muted ? BANKED.ember : MOTE_TONES[spec.tone ?? 'gold'];
  const specs = muted ? MEDAL_DUST.filter(spec => spec.quiet) : MEDAL_DUST;

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={event => {
        const { width, height } = event.nativeEvent.layout;
        setBox(current => current.w === width && current.h === height
          ? current
          : { w: width, h: height });
      }}
    >
      {/* Resting, the struck field gives way to the counter-raked ash weave —
          laid paper instead of a drained gold plate. */}
      {muted && <BankedWeave />}
      {laid && (
        <Svg width={box.w} height={box.h} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="medalHaze" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={VIOLET} stopOpacity={0.1} />
              <Stop offset="0.52" stopColor={VIOLET} stopOpacity={0.045} />
              <Stop offset="1" stopColor={VIOLET} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="medalFoot" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#C79245" stopOpacity={0.7} />
              <Stop offset="0.44" stopColor="#D9AC60" stopOpacity={0.4} />
              <Stop offset="1" stopColor="#EBCD95" stopOpacity={0} />
            </RadialGradient>
            {/* The far corner: the same gold, held back — the light on this
                card falls from the left, so the right foot is where the ground
                is thinning out rather than a second source of shade. */}
            <RadialGradient id="medalFootFar" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#CE9C4C" stopOpacity={0.44} />
              <Stop offset="0.46" stopColor="#DDB068" stopOpacity={0.26} />
              <Stop offset="1" stopColor="#EBCD95" stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="medalLight" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FFF9E6" stopOpacity={0.88} />
              <Stop offset="0.42" stopColor="#FFF2CE" stopOpacity={0.5} />
              <Stop offset="1" stopColor="#FCE9BC" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          {/* The ground the signature reads against. The card's gold runs
              deep at the left and pale at the right, where the medal stands
              in its own warm pool — so the left is where a cool haze can
              live, and the number's bloom finally has something to be
              bright AGAINST. Bled in from off the edge: a pool with a
              visible rim on this surface would be a second medallion. */}
          <Ellipse cx={-8} cy={62} rx={box.w * 0.66} ry={142} fill="url(#medalHaze)" />
          {/* THE FOOT — the card's dark ground, and the only place the deep
              gold is spent. The gauge that ends the card is a WHITE bar, and a
              white bar laid on cream is a bar you have to look for.

              It began as a single pool banked into the bottom-LEFT corner, and
              it stopped by the middle of the card — which left the bar's own
              right half, the tolerance zone and the essentials cap, standing on
              pale plate again. So the foot runs the whole width now: the deep
              pool still sits in the left corner, where the reading starts and
              the empty track is widest, and a second, shallower one carries it
              out to the right corner so the instrument is on ground from end to
              end. Both are kept low, passing under the bar rather than over the
              gold marks above it, and short enough that the week strip stands
              on light plate. */}
          <Ellipse
            cx={box.w * -0.04}
            cy={box.h + 12}
            rx={box.w * 0.56}
            ry={124}
            fill="url(#medalFoot)"
          />
          <Ellipse
            cx={box.w * 1.02}
            cy={box.h + 22}
            rx={box.w * 0.5}
            ry={104}
            fill="url(#medalFootFar)"
          />
          {/* The warm pool the medal is lit by, seated exactly on it. */}
          {strike && (
            <Circle
              cx={box.w - strike.right}
              cy={strike.top}
              r={strike.crest * 1.5}
              fill="url(#medalLight)"
            />
          )}
          {/* Home's rake, at Home's step and weight — the grain of the plate,
              and the only thing drawn on this ground. */}
          {Array.from({ length: rakeCount }).map((_, index) => {
            const offset = index * RAKE_STEP;
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
      {specs.map((spec, index) => (
        <Mote
          key={index}
          spec={spec}
          color={moteColor(spec)}
          active={motionEnabled}
          slow={muted}
          clock={clock}
        />
      ))}
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

  // WHERE THE LIGHT GOES, which took three tries.
  //
  // It began centred on the middle of the whole signature — and the number
  // sits in the left fifth of it, so the light pooled in open card BESIDE the
  // reading and read as a smudge. Moved onto the numeral it fell off the
  // card's left edge instead, because a pool wide enough to carry the caption
  // is wider than the numeral has room for on its left.
  //
  // A pool cannot be centred in two places, but a pool and its BRIGHTEST POINT
  // can be: the shape is centred over the signature as a whole, so it holds
  // number and caption and clears both card edges, while the gradient's focus
  // sits back over the numeral. The light is where the figure is; the glow is
  // where the words are.
  const bloomX = width * 0.49;

  // The plaque the reading is mounted on, in the bloom canvas's coordinates
  // (which begin 0.15 of a width left of the signature and 0.45 of a height
  // above it). It opens a little left of the numeral and closes just past the
  // caption, so both stand ON it and neither sits on its rim.
  const plaque = {
    x: width * 0.15 - size * 0.11,
    y: height * 0.45 + 4,
    w: size * 0.93 + digitExpansion + 72,
    h: height - 8,
    r: 20,
  };

  /** The stud's whole field — coin, its seat of light, and its cast shadow. */
  const studBox = size * 0.5;

  return (
    <View style={{ width, height }}>
      {/* The bloom the reading stands in.

          It used to be one graded pool, because an earlier attempt at three
          flat ellipses left three visible rims — a beige ring around the
          number instead of light under it. The answer was never fewer
          layers, it was MORE of them, rotated: Home's reading sits in four
          struck rims laid flat and turned against each other, so the fall
          from dark metal to pale reads as the steps of a minted face and no
          single edge is ever findable. Same construction here, one register
          further: the violet is worked INTO the fall rather than parked
          behind it, so it runs violet → gold → white and the heart under the
          number is the brightest thing on the card.

          The violet is two GRADED layers, never a flat fill. A flat lilac
          ellipse behind gold rims is a bruise with a findable rim — the exact
          failure the single pool was introduced to escape. So: a RING of
          haze, clear at its own centre and violet only where it passes
          outside the gold, which reads as light bending round metal; and a
          small pool set low and left of the number, where the shadow actually
          falls, since the medal stands to the right and the light comes with
          it. Its own canvas, wide and tall enough that no layer is ever cut
          off at an edge. */}
      <Svg
        pointerEvents="none"
        width={width * 1.3}
        height={height * 1.9}
        style={{ position: 'absolute', left: -width * 0.15, top: -height * 0.45 }}
      >
        <Defs>
          {/* Focus back over the numeral; the ellipse it fills is centred over
              the signature. `r` runs past 50% so the falloff reaches the
              caption end rather than dying halfway across it. */}
          <RadialGradient id="signatureBloom" cx="34%" cy="50%" r="62%">
            <Stop offset="0" stopColor={banked ? BANKED.bloomHeart : '#FFFFFF'} stopOpacity={banked ? 0.7 : 1} />
            <Stop offset="0.44" stopColor={banked ? BANKED.bloomMid : '#FFFAEC'} stopOpacity={banked ? 0.42 : 0.92} />
            <Stop offset="0.76" stopColor={banked ? BANKED.bloomRim : '#FCF0D2'} stopOpacity={banked ? 0.2 : 0.5} />
            <Stop offset="1" stopColor={banked ? BANKED.bloomRim : '#F8E9C2'} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {banked ? (
          // A resting reading keeps its single cooled pool.
          <Ellipse
            cx={bloomX}
            cy={height * 0.96}
            rx={width * 0.46}
            ry={height * 0.5}
            fill="url(#signatureBloom)"
          />
        ) : (
          <>
            {/* THE PLAQUE.

                Light was the right idea and a pool was the wrong shape for it.
                Every version of that pool — one graded ellipse, four struck
                rims, a tight bloom with its focus moved — came out as a pale
                lozenge with a findable edge, floating in the gold. Because a
                soft-edged blob on a plate is what a smudge looks like; there is
                no lighting of it that fixes the fact that it has no reason to
                stop where it stops.

                So it stops for a reason. The reading is MOUNTED, in the same
                pale material and with the same gold hairline as the medal
                beside it — and the card becomes what it should always have
                been: two presented objects on a gold plate, a plaque that
                carries the count and a medal that carries the day. The edge is
                now the point instead of the flaw. */}
            {/* Straight down, and faint. Offset sideways as well it smeared a
                mauve fringe along the plaque's left edge, which on a light
                plate reads as dirt rather than as depth. */}
            <Rect
              x={plaque.x}
              y={plaque.y + 3}
              width={plaque.w}
              height={plaque.h}
              rx={plaque.r}
              fill={VIOLET}
              opacity={0.1}
            />
            <Rect
              x={plaque.x}
              y={plaque.y}
              width={plaque.w}
              height={plaque.h}
              rx={plaque.r}
              fill="url(#signatureBloom)"
              stroke="#CBA45F"
              strokeOpacity={0.72}
              strokeWidth={1}
            />
            {/* The white the plaque's upper lip catches, and the violet its
                lower one sits in — the same two rims the mount wears. */}
            <Path
              d={`M ${plaque.x + plaque.r} ${plaque.y + 1.3} H ${plaque.x + plaque.w - plaque.r}`}
              stroke="#FFFFFF"
              strokeOpacity={0.45}
              strokeWidth={1}
              strokeLinecap="round"
            />
            <Path
              d={`M ${plaque.x + plaque.r * 0.8} ${plaque.y + plaque.h - 1}
                  H ${plaque.x + plaque.w - plaque.r * 0.8}`}
              stroke={VIOLET}
              strokeOpacity={0.16}
              strokeWidth={1.4}
              strokeLinecap="round"
            />
          </>
        )}
      </Svg>

      <Svg
        pointerEvents="none"
        width={width * 1.14}
        height={height * 1.12}
        style={{ position: 'absolute', left: -width * 0.07, top: -height * 0.06 }}
      >
        {/* The engraved curve under the number, and the rule that separates
            the figure from its caption. Both used to be flat strokes at a
            constant weight: the curve swung out to the right and simply
            stopped in open card, and the rule was the one hard-edged line
            left on a surface where every other divider now fades. They are
            gradient-stroked now — brightest where they pass under the number,
            gone at both ends — so they read as engraving catching the light
            rather than as ink drawn on top of it. */}
        <Defs>
          {/* Live, the engraving is the one line on the card that touches both
              metals: it leaves the violet shade under the number and comes up
              gold as it swings out into the light. Banked, it keeps the single
              ash stroke of a face with no light to catch. */}
          {banked ? (
            <LinearGradient id="signatureCurve" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={BANKED.ash} stopOpacity={0} />
              <Stop offset="0.3" stopColor={BANKED.ash} stopOpacity={0.44} />
              <Stop offset="0.72" stopColor={BANKED.ash} stopOpacity={0.3} />
              <Stop offset="1" stopColor={BANKED.ash} stopOpacity={0} />
            </LinearGradient>
          ) : (
            <LinearGradient id="signatureCurve" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={VIOLET} stopOpacity={0} />
              <Stop offset="0.24" stopColor={VIOLET} stopOpacity={0.36} />
              <Stop offset="0.52" stopColor={GOLD} stopOpacity={0.38} />
              <Stop offset="0.8" stopColor={GOLD} stopOpacity={0.2} />
              <Stop offset="1" stopColor={GOLD} stopOpacity={0} />
            </LinearGradient>
          )}
          <LinearGradient id="signatureRule" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={banked ? BANKED.ash : GOLD} stopOpacity={0} />
            <Stop offset="0.5" stopColor={banked ? BANKED.ash : GOLD} stopOpacity={0.4} />
            <Stop offset="1" stopColor={banked ? BANKED.ash : GOLD} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {/* The swept engraving under the number belonged to an open reading
            that had nothing to sit on: it gave the figure a base line. On a
            mounted plaque it is a scratch across a finished surface, so it is
            kept only for the resting register, which has no plaque. */}
        {banked && (
          <Path
            d={`M ${size * 0.13 + width * 0.07} ${height * 0.82} C ${width * 0.43} ${height * 1.01}, ${width * 0.76} ${height * 0.97}, ${width * 1.0} ${height * 0.64}`}
            fill="none"
            stroke="url(#signatureCurve)"
            strokeWidth={1.15}
            strokeLinecap="round"
            strokeDasharray="3 5"
          />
        )}
        <Line
          x1={size * 0.73 + digitExpansion + width * 0.07}
          y1={height * 0.32}
          x2={size * 0.73 + digitExpansion + width * 0.07}
          y2={height * 0.78}
          stroke="url(#signatureRule)"
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

      {/* THE STUD — the plaque's own maker's mark, pinned through its
          bottom-right corner.

          A second FULL medallion used to hang here, tilted, forty points from
          the hero: the same five-colour object printed twice on one card, and
          the single thing that most made this surface look cheap. That is not
          what this is. It is the COIN — one violet rim round one gold face,
          the same currency the week strip is paid in — struck small, set at an
          angle, and pinned half over the plaque's edge so it reads as hardware
          holding the plate down rather than as a picture printed on it. The
          angle is what sells it: something laid ON the plaque rather than laid
          OUT with it.

          Everything under it is drawn as one Svg so the shadow follows the
          coin's round edge instead of the square View that carries it. */}
      {!banked && (
        <View
          pointerEvents="none"
          style={[
            medallionStyles.stud,
            {
              // Pinned to the plaque's own bottom-right corner, in the
              // signature's coordinates. The plaque is drawn on a canvas that
              // begins 0.15 of a width to the LEFT of this view and 0.45 of a
              // height above it, so its corner has to be brought back into
              // these coordinates or the stud floats in open card — which is
              // exactly what it did on the first pass. Half the coin hangs
              // past the edge, which is what makes it read as pinned THROUGH
              // the plate rather than resting on it.
              left: plaque.x - width * 0.15 + plaque.w - studBox * 0.62,
              top: plaque.y - height * 0.45 + plaque.h - studBox * 0.56,
              width: studBox,
              height: studBox,
            },
          ]}
        >
          <Svg width={studBox} height={studBox} viewBox="0 0 100 100">
            {/* Cast, not haloed. The stud first got a wide pool of light
                behind it, which on a card whose plaque is ALREADY near-white
                simply bleached the coin into it — a white ring round a pale
                object on a pale plate. What a pinned mark actually needs is
                the opposite: a soft violet shadow thrown down and to the
                right, and nothing else. Drawn as vector so the shadow follows
                the coin's round edge rather than the square view carrying it. */}
            <Circle cx={56} cy={58} r={30} fill={VIOLET} opacity={0.16} />
            <Circle cx={53} cy={55} r={28} fill={VIOLET} opacity={0.14} />
          </Svg>
          <View style={medallionStyles.studTilt}>
            <FocusMedalCoin size={studBox * 0.66} />
          </View>
        </View>
      )}

      <View pointerEvents="none" style={[medallionStyles.glint, { right: size * 0.16, top: height * 0.1 }, banked && medallionStyles.glintBanked]} />
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
  // The caption's own rule, in the shade the reading sits in rather than in
  // the gold everything else on the card is already drawn in — so the violet
  // reaches the type block instead of stopping at the bloom's edge.
  copyRule: {
    width: 27,
    height: 1,
    marginTop: 4,
    borderRadius: 1,
    backgroundColor: 'rgba(138,86,150,0.42)',
  },
  copyRuleBanked: {
    backgroundColor: BANKED.ashLine,
  },
  stud: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  // Struck at an angle, the way a mark is set by hand. Rotation is safe on a
  // vector; it is SCALE that resamples a small Android view.
  studTilt: { position: 'absolute', transform: [{ rotate: '-14deg' }] },
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
// medallion. Rays alternate long/short like a struck medal.
//
// `halo` is the hero dress the Medal Streak card wears — a hairline ring
// around the burst. The old one-revolution-per-minute turn was invisible on
// this symmetrical medal but still occupied a permanent animation slot, so the
// blades stay perfectly still and the LIGHT is what lives: the pool they stand
// in breathes, slow and shallow, so the medal reads as lit rather than as
// printed. That breath is part of the hero dress; the small crests elsewhere
// in Focus keep their still pool and their zero animation cost.
//
// Banked, everything is held: the rays pull back to even stubs, the ring
// breaks into dashes, the emblem cools to ash, and only a slow coal keeps
// glowing behind it.
export function RadiantTrophy({
  size = 62,
  banked = false,
  halo = false,
  stage = false,
}: {
  size?: number;
  banked?: boolean;
  halo?: boolean;
  /** Mounted on its presentation ground — the streak card's hero dress. */
  stage?: boolean;
}) {
  const mainMotionEnabled = useFocusMainMotion();
  const reduceMotion = useReducedMotion();
  const mounted = stage && !banked;
  const breathing = (halo || stage) && !banked && mainMotionEnabled && !reduceMotion;
  const clock = useContinuousAnimationClock(breathing);
  const field = size * 1.9;
  const cx = field / 2;
  const inner = size * 0.62;
  const ringR = inner * 0.92;
  const rayColor = banked ? BANKED.ash : GOLD;
  // The medallion is drawn at `size * 1.18` tall including its ribbon tails, so
  // a mount that holds the whole object needs half of that plus a margin.
  // Sized by eye first, it ran over the card's own header; sized from the
  // artwork it frames the medal with a clear 6pt of card and nothing else.
  const roundelR = size * 0.665;

  // Opacity only — scaling a small view on Android resamples its bitmap.
  const poolBreath = useAnimatedStyle(() => ({
    opacity: breathing ? 0.82 + pingPongPhase(clock.value, 2800) * 0.18 : 1,
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* THE MOUNT — and the reason the card finally has a hero.
          A gold medal on a gold plate under gold light is three of one value:
          every warm thing agrees with every other and nothing steps forward.
          The composition needed the medal to sit on a DIFFERENT value from the
          plate — and the direction matters. A deep violet mount was tried
          first, and it was the wrong one: the medallion is itself violet, so a
          violet ground swallowed its rim and put its whole illustration in
          shadow. Light is the answer. The medal is mounted on near-white, the
          way a struck medal is presented on a pale card: every scallop, ring
          and ribbon reads at full contrast, the blades cross it as real light,
          and the mid-gold plate around it finally has something brighter than
          itself on it. Banked, the mount goes and the medal rests on
          parchment. */}
      {mounted && (
        <Svg pointerEvents="none" width={field} height={field} style={{ position: 'absolute' }}>
          <Defs>
            <RadialGradient id="roundelFace" cx="38%" cy="32%" r="76%">
              <Stop offset="0" stopColor="#FFFFFF" />
              <Stop offset="0.6" stopColor="#FFFAEC" />
              <Stop offset="1" stopColor="#FBEFD2" />
            </RadialGradient>
            <RadialGradient id="roundelHalo" cx="50%" cy="50%" r="50%">
              <Stop offset="0.58" stopColor="#FFFDF4" stopOpacity={0.78} />
              <Stop offset="0.8" stopColor="#FFF6DF" stopOpacity={0.38} />
              <Stop offset="1" stopColor="#FBEED0" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          {/* The mount does not cut a hard circle out of the plate: its own
              light spills past its rim first. */}
          <Circle cx={cx} cy={cx} r={size * 0.79} fill="url(#roundelHalo)" />
          <Circle cx={cx} cy={cx} r={roundelR} fill="url(#roundelFace)" />
          {/* One gold hairline where the pale mount meets the gold plate, and
              the violet the mount's lower edge takes from the medal above it —
              the shadow a raised disc sits in. */}
          <Circle
            cx={cx}
            cy={cx}
            r={roundelR}
            fill="none"
            stroke="#D8B778"
            strokeOpacity={0.55}
            strokeWidth={1}
          />
          <Path
            d={`M ${cx - roundelR * 0.72} ${cx + roundelR * 0.66} A ${roundelR} ${roundelR} 0 0 0 ${cx + roundelR * 0.66} ${cx + roundelR * 0.72}`}
            fill="none"
            stroke={VIOLET}
            strokeOpacity={0.22}
            strokeWidth={2}
            strokeLinecap="round"
          />
          {/* The engraved inner orbit of a struck mount. */}
          <Circle
            cx={cx}
            cy={cx}
            r={roundelR - size * 0.08}
            fill="none"
            stroke={VIOLET}
            strokeOpacity={0.16}
            strokeWidth={1}
            strokeDasharray="2 7"
          />
        </Svg>
      )}

      {/* A flat tinted disc has an edge, and an edge is exactly what a glow
          must not have. This is a real falloff — warm at the medal, gone
          before it reaches the tips of the blades. */}
      <Animated.View pointerEvents="none" style={[{ position: 'absolute' }, poolBreath]}>
        <Svg width={field} height={field}>
          <Defs>
            <RadialGradient id="burstPool" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={banked ? '#CEC1A6' : '#FFF0C4'} stopOpacity={banked ? 0.3 : mounted ? 0.4 : 0.52} />
              <Stop offset="0.5" stopColor={banked ? '#CEC1A6' : '#F7DFA8'} stopOpacity={banked ? 0.15 : 0.2} />
              <Stop offset="1" stopColor={banked ? '#CEC1A6' : '#EFCF8C'} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={cx} cy={cx} r={size * 0.86} fill="url(#burstPool)" />
        </Svg>
      </Animated.View>
      {banked && <EmberPulse size={size * 0.52} active={mainMotionEnabled} />}

      {/* Hairline halo — steady around the burst, dashed once banked. */}
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

      {/* The burst.

          Twelve identical hairline spokes on one circle is a diagram of a
          sunburst, not a sunburst: nothing about it says which way the light
          is going, and at rest it reads as a wheel. What a struck medal
          actually throws is a graded corona — long tapered blades on the
          cardinal axes, shorter ones between them, each one BRIGHTEST WHERE
          IT LEAVES THE MEDAL and gone by its tip. So each ray is a slim
          triangle with its own gradient rather than a stroked line, and the
          set alternates gold and violet so the corona carries the medal's own
          two colours instead of a third.

          Banked, it collapses back to even ash stubs — a resting instrument
          keeps its shape and loses its light. */}
      <View pointerEvents="none" style={{ position: 'absolute' }}>
        <Svg width={field} height={field}>
          <Defs>
            {/* On the pale mount the blades are the medal's own two metals at
                full strength — they finally have something light to be gold
                and violet against. */}
            <LinearGradient id="rayGold" x1="0" y1="1" x2="0" y2="0">
              <Stop offset="0" stopColor={MEDALLION.faceShade} stopOpacity={mounted ? 0.9 : 0.62} />
              <Stop offset="0.45" stopColor={MEDALLION.faceShade} stopOpacity={mounted ? 0.44 : 0.3} />
              <Stop offset="1" stopColor={MEDALLION.faceShade} stopOpacity={0} />
            </LinearGradient>
            <LinearGradient id="rayViolet" x1="0" y1="1" x2="0" y2="0">
              <Stop offset="0" stopColor={MEDALLION.rim} stopOpacity={mounted ? 0.62 : 0.46} />
              <Stop offset="0.45" stopColor={MEDALLION.rim} stopOpacity={mounted ? 0.3 : 0.2} />
              <Stop offset="1" stopColor={MEDALLION.rim} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {Array.from({ length: RAY_COUNT }).map((_, index) => {
            const turn = (index / RAY_COUNT) * 360;
            // Cardinal blades run long; the four between them are stubs, and
            // the eight off-axis ones sit in between — three lengths, so the
            // corona has a rhythm rather than a beat.
            const rank = index % 4 === 0 ? 0 : index % 2 === 0 ? 1 : 2;
            const reach = banked
              ? size * 0.1
              : mounted
                ? rank === 0 ? size * 0.13 : rank === 1 ? size * 0.095 : size * 0.065
                : rank === 0 ? size * 0.38 : rank === 1 ? size * 0.26 : size * 0.17;
            const halfWidth = banked
              ? 0.55
              : rank === 0 ? size * 0.035 : rank === 1 ? size * 0.028 : size * 0.021;
            // Mounted, the corona lives INSIDE the mount: it leaves the disc's
            // own edge and stops short of the rim, so it is light on the pale
            // card rather than spikes sticking out past it.
            const base = mounted ? size * 0.5 : inner + size * 0.015;
            const tip = base + reach;
            const fill = banked
              ? BANKED.ash
              : rank === 2 ? 'url(#rayViolet)' : 'url(#rayGold)';
            return (
              <Path
                key={index}
                // A blade: two points on the base circle, one at the tip.
                d={`M ${cx - halfWidth} ${cx - base} L ${cx + halfWidth} ${cx - base} L ${cx} ${cx - tip} Z`}
                fill={fill}
                fillOpacity={banked ? 0.3 : 1}
                transform={`rotate(${turn} ${cx} ${cx})`}
              />
            );
          })}
        </Svg>
      </View>

      {/* Sized from the square's height rather than its width, so the ribbon
          tails land inside the burst; then a little over, because a medal that
          exactly fits its own halo reads as a sticker rather than as the thing
          the light is coming off. */}
      <FocusMedallion size={size * FOCUS_MEDALLION_RATIO * 1.18} muted={banked} />
    </View>
  );
}
