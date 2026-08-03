import React, { memo, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import {
  buildTallyRuns,
  tallyUnit,
  type DayOutcome,
  type TallyRun,
} from '@/components/home/day-tally-layout';

/**
 * The day's tally, sitting beside the tasks title.
 *
 * It used to be one gold bar reading a percentage. Two things were wrong with
 * that on this screen: the date strip above and the week band below both speak
 * in cells, so a smooth bar was the one continuous thing among them; and a
 * percentage hid the shape of the day — a skipped task simply left the sum,
 * visible only in the all-skipped case, when the whole bar went black.
 *
 * So it is a WELL with one seat per task, and it fills. Consecutive tasks of
 * the same outcome fuse into a single struck band — the move the streak strip
 * already makes — creased at each seat by a fold, so the band stays countable
 * without being cut into tiles. What is not done yet stays empty well: the
 * tally therefore reads as the day filling rather than as a bar sliding, and
 * a skipped task keeps its own seat instead of leaving the sum.
 *
 * No number is written on it. The status line under the title already owns the
 * arithmetic, and this is the shape of the day, which that sentence cannot say.
 *
 * Cost, since this rides Home: no Lottie, no SVG, no loop, nothing ambient. A
 * run is two gradients; there are rarely more than three. Everything that
 * moves is a shared value, so a whole day of change costs zero per-frame JS,
 * and every motion is one-shot — the tally settles and then rests.
 */

export type { DayOutcome };

const WIDTH = 112;
const HEIGHT = 8;
const RADIUS = HEIGHT / 2;
/** Below this a seat is too narrow to be worth creasing. */
const MIN_CREASE_SEAT = 7;

/**
 * Each band is lit from above: bright along the crown, deepening to the foot,
 * so it sits IN the well rather than on it. Gold for a task kept, warm stone
 * for one set aside, and the app's near-black for a day struck out entirely.
 */
const BAND: Record<'done' | 'skipped', readonly [string, string]> = {
  done: ['#DCBC77', '#BE9749'],
  skipped: ['#B0AA9E', '#8C8578'],
};
const STRUCK_BAND = ['#34302B', '#1B1816'] as const;

/** The well: shaded under its own lip at the top, catching light at the foot. */
const WELL = ['#E7E1D2', '#F5F1E7'] as const;
const WELL_LIP = 'rgba(122,101,60,0.13)';
const WELL_FOOT = 'rgba(255,255,255,0.75)';

/** The fold — a cut with light caught along it, as every rule in the app is. */
const FOLD_CUT = 'rgba(116,96,56,0.24)';
const FOLD_LIGHT = 'rgba(255,255,255,0.5)';
/** The light along a band's crown, the same one every raised plate wears. */
const CROWN = 'rgba(255,255,255,0.62)';

const ENTER = { duration: 420, easing: Easing.out(Easing.cubic) } as const;
const SETTLE = { damping: 18, stiffness: 215, mass: 0.7 } as const;

/* ── The well ────────────────────────────────────────────────
 * Drawn once, under everything: the recess the day is struck into, with a
 * seat crease at every task boundary so an unfilled day still shows its
 * length. The creases run the full rail — the bands are laid over them and
 * carry their own, so one seam serves both states.
 * ───────────────────────────────────────────────────────────── */

const Well = memo(function Well({ seats, unit }: { seats: number; unit: number }) {
  return (
    <>
      <LinearGradient
        colors={WELL}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={s.wellLip} />
      <View pointerEvents="none" style={s.wellFoot} />
      {unit >= MIN_CREASE_SEAT
        && Array.from({ length: Math.max(0, seats - 1) }, (_, i) => (
          <Fold key={i} left={(i + 1) * unit} />
        ))}
    </>
  );
});

/** A cut with its catch-light, the app's rule reduced to one seat boundary. */
const Fold = memo(function Fold({ left }: { left: number }) {
  return (
    <View pointerEvents="none" style={[s.fold, { left }]}>
      <View style={s.foldCut} />
      <View style={s.foldLight} />
    </View>
  );
});

/* ── A band ──────────────────────────────────────────────────
 * One run of same-outcome tasks, struck into the well as a single object.
 * Two gradients: its own tone, and the struck tone over it at whatever
 * opacity the day's blackout has reached, so a struck day is one movement
 * across the whole tally rather than each band deciding for itself.
 * ───────────────────────────────────────────────────────────── */

function Band({
  outcome,
  count,
  x,
  w,
  unit,
  struck,
  reduceMotion,
}: TallyRun & { unit: number; struck: SharedValue<number>; reduceMotion: boolean }) {
  const width = useSharedValue(reduceMotion ? w : 0);
  const left = useSharedValue(x);
  const sheen = useSharedValue(0);
  const drawn = useRef(false);
  const settled = useRef(false);

  useEffect(() => {
    if (reduceMotion) {
      width.value = w;
      left.value = x;
      drawn.current = true;
      return;
    }
    if (!drawn.current) {
      drawn.current = true;
      left.value = x;
      // Delay by where the band sits, so the tally is written on from the
      // left in one sweep instead of every band opening at once.
      width.value = withDelay(60 + (x / WIDTH) * 240, withTiming(w, ENTER));
      return;
    }
    width.value = withSpring(w, SETTLE);
    left.value = withSpring(x, SETTLE);
  }, [w, x, reduceMotion, width, left]);

  // When a band takes in a newly resolved task it catches the light once —
  // the quiet knock that says the tally moved. Opacity, not scale: the well
  // clips, so anything that grew past 8pt would simply not be seen. It must
  // not fire on the first pass, or every band would flash on every entry to
  // Home; the sweep is the arrival, this is only for what changes after.
  useEffect(() => {
    if (!settled.current) {
      settled.current = true;
      return;
    }
    if (reduceMotion) return;
    sheen.value = withSequence(
      withTiming(1, { duration: 110, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 420, easing: Easing.inOut(Easing.quad) }),
    );
  }, [count, outcome, reduceMotion, sheen]);

  const shell = useAnimatedStyle(() => ({ left: left.value, width: width.value }));
  const blackout = useAnimatedStyle(() => ({ opacity: struck.value }));
  const flash = useAnimatedStyle(() => ({ opacity: sheen.value * 0.45 }));

  if (outcome === 'pending') return null;

  return (
    <Reanimated.View style={[s.band, shell]}>
      <LinearGradient
        colors={BAND[outcome]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Reanimated.View style={[StyleSheet.absoluteFill, blackout]}>
        <LinearGradient
          colors={STRUCK_BAND}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Reanimated.View>
      <View pointerEvents="none" style={s.crown} />
      {/* The band carries the seat folds it covers, so the seam runs
          unbroken from empty well through struck band and out again. */}
      {unit >= MIN_CREASE_SEAT
        && Array.from({ length: count - 1 }, (_, i) => (
          <Fold key={i} left={(i + 1) * unit} />
        ))}
      <Reanimated.View pointerEvents="none" style={[s.sheen, flash]} />
    </Reanimated.View>
  );
}

const MemoBand = memo(Band);

function DayTally({ outcomes, allSkipped }: { outcomes: DayOutcome[]; allSkipped: boolean }) {
  const reduceMotion = useReducedMotion();
  const runs = useMemo(() => buildTallyRuns(outcomes, WIDTH), [outcomes]);
  const unit = tallyUnit(outcomes.length, WIDTH);

  // One value carries the whole tally to black, so a struck day arrives as a
  // single movement rather than each band deciding for itself.
  const struck = useSharedValue(allSkipped ? 1 : 0);
  useEffect(() => {
    struck.value = reduceMotion
      ? (allSkipped ? 1 : 0)
      : withTiming(allSkipped ? 1 : 0, { duration: 540, easing: Easing.inOut(Easing.cubic) });
  }, [allSkipped, reduceMotion, struck]);

  return (
    <View style={s.rail}>
      <Well seats={outcomes.length} unit={unit} />
      {runs.map((run, i) => (
        <MemoBand
          key={i}
          {...run}
          unit={unit}
          struck={struck}
          reduceMotion={reduceMotion}
        />
      ))}
    </View>
  );
}

export default memo(DayTally);

const s = StyleSheet.create({
  rail: {
    width: WIDTH,
    height: HEIGHT,
    borderRadius: RADIUS,
    // The rail rounds the ends, so every band inside can be a plain
    // rectangle and two neighbours still meet on a straight seam.
    overflow: 'hidden',
    backgroundColor: WELL[1],
  },
  wellLip: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 1,
    backgroundColor: WELL_LIP,
  },
  wellFoot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 1,
    backgroundColor: WELL_FOOT,
  },
  band: { position: 'absolute', top: 0, bottom: 0, overflow: 'hidden' },
  crown: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 1,
    backgroundColor: CROWN,
  },
  fold: { position: 'absolute', top: 0, bottom: 0, width: 2, flexDirection: 'row' },
  foldCut: { width: StyleSheet.hairlineWidth, backgroundColor: FOLD_CUT },
  foldLight: { width: StyleSheet.hairlineWidth, backgroundColor: FOLD_LIGHT },
  sheen: { ...StyleSheet.absoluteFillObject, backgroundColor: '#FFFFFF' },
});
