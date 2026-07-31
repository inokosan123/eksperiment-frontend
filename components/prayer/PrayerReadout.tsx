import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import Reanimated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { toHsl } from '@/components/shared/tone';
import { C, F } from '@/constants/tokens';

/* ─────────────────────────────────────────────────────────────
 * THE READING — what the prayer screen's clock says, and how it says it.
 *
 * ⚠ THE SECONDS USED TO SNAP. A figure changing was a bare React text
 * swap once a second: the one thing left on this screen that changed
 * with no transition at all, on a page where the switch withdraws over
 * 620 ms and the play glyph will not even trade places without passing
 * its partner. A stopwatch may snap. A thing you pray in front of for
 * twenty minutes may not.
 *
 * WHAT REPLACES IT, AND WHAT DELIBERATELY DOES NOT
 *
 * ⚠ NO RING, NO ARC, NO TRAVELLING POINT. Those were on this screen and
 * were removed on purpose — a thing that moves asks to be watched, and
 * this is a screen you are meant to look THROUGH. Every handsome timer
 * worth borrowing from puts a ring round its numerals; this one may not,
 * so the motion had to be found somewhere else.
 *
 * It is found INSIDE THE FIGURES:
 *
 *   THE ROLL     a figure that changes rises out of its place while its
 *                successor rises into it. ⚠ PER DIGIT — 12→13 moves one
 *                numeral and 59→00 moves both, because a whole reading
 *                shifting when a single unit turned over is the tell of
 *                type being replaced rather than a clock counting.
 *   THE LANDING  a minute is the unit that means something in a rule, so
 *                the minutes warm as one turns over and settle back. Not
 *                a flash: a slow bloom over a second and a bit, which is
 *                felt at the edge of attention rather than watched.
 *   THE LIGHT    one warm pool behind the whole reading, breathing on
 *                the same value as the light behind the start button, so
 *                the two lit things on the page breathe together rather
 *                than each on its own clock.
 *
 * ⚠ EVERYTHING HERE IS OPACITY, TRANSLATION AND COLOUR — never scale.
 * Scaling small views resamples their bitmaps on Android and this app
 * has been bitten by it before; type is the last thing that can afford
 * it. And the pool is a static vector whose LAYER opacity moves, so
 * react-native-svg is never handed a prop update per frame.
 * ───────────────────────────────────────────────────────────── */

/**
 * How a figure changes places.
 *
 * ⚠ LONGER THAN IT SOUNDS, AND THAT IS THE POINT. At 260 ms this reads as
 * a flip-clock and starts to feel mechanical; at 520 the numeral simply
 * arrives, and a reading you glance at twice a minute never looks busy.
 * It eases OUT only, so the figure settles into its place rather than
 * gathering speed to get there.
 *
 * `travel` is a share of the figure's own line height, never a count of
 * points: the reading is set at four different sizes across the phones
 * and states this screen has, and a fixed rise that reads well at 58
 * looks like a jolt at 38.
 */
const ROLL = { duration: 520, easing: Easing.out(Easing.cubic) } as const;
const ROLL_TRAVEL = 0.34;

/**
 * ⚠ THE TWO FIGURES NEVER OVERLAP AT STRENGTH, which is what stops a roll
 * from being a cross-fade. The one leaving is gone by 55% of the way and
 * the one arriving does not begin until 45%, so there is a tenth in the
 * middle where the cell is nearly empty and then the new numeral rises
 * into it. Two figures at half strength over each other is a smudge —
 * legible as neither, and unmistakably type being replaced.
 *
 * ⚠ AND THEY ARE THE OBJECT EXCHANGE'S OWN NUMBERS. The cross and the
 * icon trade places on exactly this 0.55 / 0.45 handoff. One screen, one
 * idea of how a thing gives way to another thing.
 */
const ROLL_OUT_BY = 0.55;
const ROLL_IN_FROM = 0.45;

/**
 * How far the colon is lifted off the baseline.
 *
 * ⚠ IT WAS READING AS A DECIMAL POINT — `04.17` rather than `04:17` — and
 * had been for as long as this reading has existed. A colon set at 42% of
 * the figures' size and sat on their baseline puts both its dots down in
 * the bottom fifth of the numerals; a clock's colon belongs optically
 * centred between them. A share of the figure size rather than points, so
 * it holds at every size the reading takes.
 */
const COLON_LIFT = 0.22;

/** The minute landing: up quickly, down slowly, gone. */
const BLOOM_UP = { duration: 260, easing: Easing.out(Easing.quad) } as const;
const BLOOM_DOWN = { duration: 900, easing: Easing.inOut(Easing.sin) } as const;

/** The hour's colour, lifted — what the minutes warm to as one lands. */
function litTone(hex: string): string {
  const { h, s } = toHsl(hex);
  return `hsl(${Math.round(h)} ${Math.round(Math.max(s, 62))}% 68%)`;
}

/* ── One figure, changing places ──────────────────────────────────── */

function DigitCell({
  char,
  ink,
  lineHeight,
  textStyle,
}: {
  char: string;
  ink: StyleProp<TextStyle>;
  lineHeight: number;
  textStyle: StyleProp<TextStyle>;
}) {
  const reduceMotion = useReducedMotion();
  const roll = useSharedValue(1);
  const shownRef = useRef(char);
  // `out` is the figure leaving, `in` the one arriving. ⚠ `out` is the one
  // IN FLOW and therefore the one that sizes the cell — which is safe
  // because the face is set in tabular figures and every numeral has the
  // same advance width, so the box never changes shape as the clock runs.
  const [pair, setPair] = useState({ out: char, in: char });

  useEffect(() => {
    if (shownRef.current === char) return;
    const leaving = shownRef.current;
    shownRef.current = char;

    if (reduceMotion) {
      setPair({ out: char, in: char });
      roll.value = 1;
      return;
    }

    setPair({ out: leaving, in: char });
    roll.value = 0;
    roll.value = withTiming(1, ROLL);
  }, [char, reduceMotion, roll]);

  const travel = lineHeight * ROLL_TRAVEL;

  // Up and away.
  const outStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(1, roll.value / ROLL_OUT_BY),
    transform: [{ translateY: -travel * roll.value }],
  }), [travel]);

  // Up from below into the place just vacated. ⚠ Both rise; nothing sinks,
  // so the pair reads as one continuous movement rather than as a swap.
  const inStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, (roll.value - ROLL_IN_FROM) / (1 - ROLL_IN_FROM)),
    transform: [{ translateY: travel * (1 - roll.value) }],
  }), [travel]);

  return (
    <View style={s.cell}>
      {/* ⚠ The figure that is leaving is hidden from assistive technology.
          It is on the screen for half a second and holds the PREVIOUS
          value the whole time it is there; read aloud, the clock would
          say every reading twice. */}
      <Reanimated.Text
        style={[textStyle, ink, outStyle]}
        allowFontScaling={false}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {pair.out}
      </Reanimated.Text>
      <Reanimated.Text
        style={[textStyle, ink, s.arriving, inStyle]}
        allowFontScaling={false}
      >
        {pair.in}
      </Reanimated.Text>
    </View>
  );
}

/**
 * A run of figures, each changing on its own.
 *
 * Anything that is not a numeral — the colon inside an hours reading —
 * is set plainly and never moves, because a separator that rolled would
 * be announcing a change that did not happen.
 */
function DigitRun({
  ink,
  lineHeight,
  textStyle,
  value,
}: {
  ink: StyleProp<TextStyle>;
  lineHeight: number;
  textStyle: StyleProp<TextStyle>;
  value: string;
}) {
  return (
    <View style={s.run}>
      {value.split('').map((char, index) => (
        /^\d$/.test(char)
          ? (
            <DigitCell
              // ⚠ Keyed by POSITION, not by the character. Keying by value
              // would unmount the cell the moment its figure changed, which
              // is precisely the snap all of this exists to remove.
              key={index}
              char={char}
              ink={ink}
              lineHeight={lineHeight}
              textStyle={textStyle}
            />
          )
          : (
            <Reanimated.Text key={index} style={[textStyle, ink]} allowFontScaling={false}>
              {char}
            </Reanimated.Text>
          )
      ))}
    </View>
  );
}

/* ── The light behind the reading ─────────────────────────────────── */

/**
 * ⚠ IT IS NOT A RING, AND THE DISTINCTION IS THE WHOLE POINT. A hairline
 * around the numerals would be an outline — an edge, a thing drawn, one
 * more object on a page that is trying to hold exactly one. This is a
 * wide soft pool with no edge anywhere in it, lying under the figures the
 * way lamplight lies under what it falls on.
 *
 * ⚠ AND IT IS A SIBLING OF THE READING, NEVER ITS CHILD. The reading is
 * scaled between its resting and running sizes by the seat above; a
 * vector inside it would be scaled with it and resample on Android for
 * the whole of every transition.
 *
 * It breathes on the same shared value as the light behind the start
 * button — one breath in the room, not two.
 */
export function PrayerReadoutLight({
  breath,
  ignition,
  tint,
  width,
}: {
  breath: SharedValue<number>;
  ignition: SharedValue<number>;
  tint: string;
  width: number;
}) {
  const height = Math.round(width * 0.46);
  const style = useAnimatedStyle(() => ({
    opacity: ignition.value * (0.55 + breath.value * 0.45),
  }));

  return (
    <Reanimated.View
      pointerEvents="none"
      style={[s.light, { width, height, marginLeft: -width / 2, marginTop: -height / 2 }, style]}
      shouldRasterizeIOS
      renderToHardwareTextureAndroid
    >
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id="prayerReadoutPool" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={tint} stopOpacity={0.2} />
            <Stop offset="0.45" stopColor={tint} stopOpacity={0.09} />
            <Stop offset="1" stopColor={tint} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {/* Wider than it is tall, because a circular pool under a line of
            type lights the air above and below it and not the type. */}
        <Ellipse cx={width / 2} cy={height / 2} rx={width / 2} ry={height / 2} fill="url(#prayerReadoutPool)" />
      </Svg>
    </Reanimated.View>
  );
}

/* ── The reading ──────────────────────────────────────────────────── */

export default function PrayerReadout({
  accent,
  ignition,
  main,
  tail,
  timeFont,
}: {
  accent: string;
  ignition: SharedValue<number>;
  /** The minutes — or hours and minutes once there are hours. */
  main: string;
  /** The seconds. */
  tail: string;
  timeFont: number;
}) {
  const reduceMotion = useReducedMotion();
  const bloom = useSharedValue(0);
  const landedRef = useRef(main);
  const lit = useMemo(() => litTone(accent), [accent]);

  const lineHeight = timeFont * 1.12;
  const colonFont = timeFont * 0.42;

  /* ── A minute lands ──────────────────────────────────────────────
   * ⚠ NOT ON THE FIRST READING, and not on a reset. `landedRef` starts
   * holding whatever the reading already says, so a bloom can only ever
   * be caused by a minute actually turning over while somebody prays. */
  useEffect(() => {
    if (landedRef.current === main) return;
    landedRef.current = main;
    if (reduceMotion) return;
    bloom.value = withSequence(withTiming(1, BLOOM_UP), withTiming(0, BLOOM_DOWN));
  }, [bloom, main, reduceMotion]);

  /**
   * The reading's colour: ink at rest, the hour's own colour while the
   * prayer runs — travelling on the ignition rather than switching with
   * React state, which is what the whole screen does.
   *
   * ⚠ THE BLOOM IS COMPOSED ON TOP OF THAT, not substituted for it. The
   * minutes warm FROM whatever colour they are at this instant, so a
   * minute landing during the first second of a prayer blooms out of the
   * ink it is still half-way through leaving.
   */
  const minuteInk = useAnimatedStyle(() => {
    const base = interpolateColor(ignition.value, [0, 1], [C.text, accent]);
    return { color: interpolateColor(bloom.value, [0, 1], [base, lit]) };
  }, [accent, lit]);

  const secondInk = useAnimatedStyle(() => ({
    color: interpolateColor(ignition.value, [0, 1], [C.text, accent]),
  }), [accent]);

  const figure = { fontSize: timeFont, lineHeight };

  return (
    <View style={s.readout}>
      <DigitRun ink={minuteInk} lineHeight={lineHeight} textStyle={[s.timeText, figure]} value={main} />
      <Reanimated.Text
        style={[
          s.colonText,
          secondInk,
          { fontSize: colonFont, transform: [{ translateY: -timeFont * COLON_LIFT }] },
        ]}
        allowFontScaling={false}
      >
        :
      </Reanimated.Text>
      {/* ⚠ The seconds keep their SIZE and give up ink instead. Setting
          them smaller would put the pair on two optical baselines and
          resize the whole reading the moment an hour appeared. */}
      <DigitRun
        ink={secondInk}
        lineHeight={lineHeight}
        textStyle={[s.timeText, s.timeTail, figure]}
        value={tail}
      />
    </View>
  );
}

const s = StyleSheet.create({
  readout: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' },
  run: { flexDirection: 'row', alignItems: 'baseline' },
  // ⚠ No `overflow: hidden`. A counter wheel clips its figures, and
  // clipping Garamond at a fixed height would shave its ascenders; the
  // figures fade as well as move, so there is nothing to hide.
  cell: { position: 'relative' },
  arriving: { position: 'absolute', left: 0, right: 0, textAlign: 'center' },
  timeText: {
    fontFamily: F.serifBold,
    // Tabular figures, so a second turning over does not shove the whole
    // reading sideways — and so a cell sized by one numeral is the right
    // size for every other.
    fontVariant: ['tabular-nums', 'lining-nums'],
    includeFontPadding: false,
  },
  colonText: {
    fontFamily: F.serifBold,
    opacity: 0.3,
    marginHorizontal: 3,
    includeFontPadding: false,
  },
  /**
   * The seconds, lighter than the minutes.
   *
   * A clock face distinguishes the figure you READ from the one that is
   * merely running, and this reading had them at identical weight — two
   * pairs of numerals with a dim colon between, which is a stopwatch.
   */
  timeTail: { opacity: 0.58 },
  light: { position: 'absolute', left: '50%', top: '50%' },
});
