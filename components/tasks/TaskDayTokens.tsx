import React, { memo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Skip, X } from '@/components/icons/Icons';
import { C } from '@/constants/tokens';

/* ─────────────────────────────────────────────────────────────
 * ONE DAY OF A TASK — the struck tokens.
 *
 * The app already has a flame currency and a coin grammar for it:
 * Home's `FlameTile` in `WeeklyRhythm`, which the My Progress
 * calendar mounts. These are that grammar in the TASK key, built on
 * the same `streak-flame-512.png`, so the two calendars are plainly
 * of one family.
 *
 * ⚠ WHAT IS DELIBERATELY DIFFERENT, AND WHY. Home's day is a
 * PERCENTAGE — many tasks, partly done — so its token is a VESSEL:
 * a dim flame behind, a bright one clipped to the fill, a meniscus
 * riding the top, a minted inner ring and a struck sheen. Five
 * layers, because it has five things to say.
 *
 * A single task's day has none of that. It was done or it was not.
 * So this token is deliberately FLATTER: one warm disc, one whole
 * flame, one soft pool of light under it. No inner ring, no sheen,
 * no gradient stack — those are what made the first cut read as a
 * copy of Home's medal rather than as its quieter cousin. What
 * carries it instead is the flame itself, given more of the coin
 * than Home ever gives it.
 *
 * The four faces:
 *   · DONE     a warm gold disc, the flame at full colour in its own
 *              pool of light — the only token that carries any.
 *   · TODAY    the same coin gone quiet, the flame dimmed to ash.
 *              The day is not spent yet, so it is neither won nor
 *              lost, and it must not look like either.
 *   · SKIPPED  a graphite coin with the skip glyph. Set aside on
 *              purpose, and drawn calmly, because it is not a
 *              failure.
 *   · MISSED   a rose coin with a RED CROSS. The one place the
 *              sheet raises its voice.
 *
 * ⚠ SIZE IS A PROP, and every part scales off it. These are drawn
 * once in a calendar cell and again, smaller, in the legend beneath
 * it — a legend swatch that is a shrunk copy of the real token is
 * the only kind that actually explains it.
 * ───────────────────────────────────────────────────────────── */

export const FLAME_PNG = require('@/assets/images/streak-flame-512.png');

/**
 * The calendar's own token size, and the legend's.
 *
 * 38 is Home's `TILE_SIZE` — this calendar has the same seven columns in the
 * same sheet width, so there was never a reason for its days to be smaller.
 * Every other measurement in the grid derives from this one.
 */
export const DAY_TOKEN = 38;
export const LEGEND_TOKEN = 23;

type TokenProps = { size?: number };

function coinStyle(size: number, borderColor: string) {
  return {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: size >= 26 ? 1.5 : 1.2,
    borderColor,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
  };
}

const flameStyle = (size: number, ratio: number, tint?: string, opacity?: number) => ({
  width: size * ratio,
  height: size * ratio,
  resizeMode: 'contain' as const,
  ...(tint ? { tintColor: tint } : null),
  ...(opacity !== undefined ? { opacity } : null),
});

/* ── DONE ──────────────────────────────────────────────────────────────── */
/**
 * One flat warm disc, and the flame large on it.
 *
 * Home's medal stacks a three-stop gradient, a minted ring, a heart glow and
 * a sheen. This has a single soft fill and one pool of light — and the flame
 * at 0.72 of the coin against Home's 0.66, so what you read is the fire
 * rather than the setting it sits in.
 */
export const DoneToken = memo(function DoneToken({ size = DAY_TOKEN }: TokenProps) {
  const k = size / DAY_TOKEN;
  return (
    <View style={[coinStyle(size, '#E8C77E'), { backgroundColor: '#FDF3DA' }, size >= 26 && t.glow]}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: 21 * k,
          height: 21 * k,
          borderRadius: 10.5 * k,
          backgroundColor: 'rgba(255,246,219,0.95)',
        }}
      />
      <Image key="task-flame-lit" source={FLAME_PNG} style={flameStyle(size, 0.72)} />
    </View>
  );
});

/* ── TODAY ─────────────────────────────────────────────────────────────── */
export const TodayToken = memo(function TodayToken({ size = DAY_TOKEN }: TokenProps) {
  return (
    <View style={[coinStyle(size, '#E0D3B4'), { backgroundColor: '#FBF7EC' }]}>
      <Image key="task-flame-wait" source={FLAME_PNG} style={flameStyle(size, 0.7, '#D8CDB4')} />
    </View>
  );
});

/* ── SKIPPED ───────────────────────────────────────────────────────────── */
export const SkippedToken = memo(function SkippedToken({ size = DAY_TOKEN }: TokenProps) {
  return (
    <View style={[coinStyle(size, '#DAD4C8'), { backgroundColor: '#F2F0EA' }]}>
      <Skip s={size * 0.46} c="#96907F" w={2.4} />
    </View>
  );
});

/* ── MISSED ────────────────────────────────────────────────────────────── */
export const MissedToken = memo(function MissedToken({ size = DAY_TOKEN }: TokenProps) {
  return (
    <View style={[coinStyle(size, '#E4B9C0'), { backgroundColor: '#FBEBEE' }]}>
      {/* The cross, not a rose flame: Home tints its flame for a missed day
          because every day there has a flame of some strength. Here the day
          simply did not happen, and a struck-out coin says so at a glance. */}
      <X s={size * 0.44} c="#BE5C6B" w={2.8} />
    </View>
  );
});

/* ── The days with nothing to say ──────────────────────────────────────── */
export function FutureStud({ size = DAY_TOKEN }: TokenProps) {
  const d = Math.max(4, size * 0.14);
  return <View style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: '#EAE8E2' }} />;
}

export function OffStud({ size = DAY_TOKEN }: TokenProps) {
  const d = Math.max(3.5, size * 0.125);
  return <View style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: '#DEDCD5' }} />;
}

const t = StyleSheet.create({
  glow: {
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.36,
    shadowRadius: 5,
    elevation: 3,
  },
});
