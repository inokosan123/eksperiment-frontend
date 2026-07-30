import React, { useCallback, useId, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, Ellipse, Line, RadialGradient, Stop } from 'react-native-svg';
import { ChevronRight } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { toHsl } from '@/components/shared/tone';
import { F } from '@/constants/tokens';

/* ─────────────────────────────────────────────────────────────
 * THE SPIRITUAL DOORS.
 *
 * Choosing between Prayer, Scripture, Church and a rule of your own
 * is the most liturgical choice in My Routine, and it was being made
 * on four flat white rows with a borrowed sun, a borrowed book and a
 * borrowed plus sign — a settings list, in a screen full of struck
 * gold and lit parchment.
 *
 * The idea comes from the reader's doors on Holy Scripture: the mark
 * stands IN a pool of light rather than ON a tinted disc. But the
 * doors' own dose could not be carried over, and the first cut that
 * did proved it — there are only ever TWO doors on Scripture, side by
 * side, in two quiet tones. Four full-width plates, each flooded with
 * its own colour corner to corner and ringed by the manuscript's
 * double rule, stopped being a liturgy and became a colour chart with
 * four bullseyes on it.
 *
 * So the dose is inverted here, and that inversion is the design:
 *
 *   · ONE MATERIAL FOR ALL FOUR. Every door is the same warm
 *     parchment. Nothing about the plate says which kind it is.
 *   · THE COLOUR IS ONLY LIGHT. A wash of the subject's tone pools
 *     around the mark and is gone by the middle of the plate, the way
 *     a lamp set beside an object lights the object and not the room.
 *   · ONE RING, NOT THREE. The seat carries a single hairline; the
 *     pool behind it does the rest.
 *   · THE MARK CARRIES THE MEANING — `BeadLoop`, `ScriptureBook` and
 *     `ChurchDome`, the emblems the app already stands on, drawn at 30
 *     so their internal density survives. Below that the Gospel's
 *     tooled frame and the drum's slits are a smudge.
 *
 * The flourish along the far edge is the one thing kept literally
 * from the doors, at half their strength: ruled lines for Scripture
 * because it is text, and a lean for the rest.
 * ───────────────────────────────────────────────────────────── */

/** The mark's seat, and the emblem drawn inside it. */
const SEAT = 54;
const MARK = 30;
const SEAT_LEFT = 14;

export type DoorFlourish = 'lean' | 'counter-lean' | 'ruled';

/** The tone at a chosen lightness, at a chosen share of its own saturation. */
function tone(hex: string, lightness: number, satScale = 1): string {
  const { h, s } = toHsl(hex);
  return `hsl(${Math.round(h)} ${Math.round(s * satScale)}% ${lightness}%)`;
}

/** The same, held at a floor, for the light itself — a near-grey tone would
 *  pool as a smudge rather than as colour. */
function litTone(hex: string, lightness: number, satFloor: number): string {
  const { h, s } = toHsl(hex);
  return `hsl(${Math.round(h)} ${Math.round(Math.max(s, satFloor))}% ${lightness}%)`;
}

function ringColor(hex: string, alpha: number): string {
  const { h, s } = toHsl(hex);
  return `hsla(${Math.round(h)}, ${Math.round(s)}%, 46%, ${alpha})`;
}

function Flourish({ kind, color, w, h }: { kind: DoorFlourish; color: string; w: number; h: number }) {
  if (kind === 'ruled') {
    return (
      <>
        {Array.from({ length: 5 }).map((_, i) => {
          const y = 17 + i * 12;
          return (
            <Line
              key={i}
              x1={w - 84} y1={y} x2={w - 14} y2={y}
              stroke={color} strokeOpacity={0.16 - i * 0.024} strokeWidth={1}
            />
          );
        })}
      </>
    );
  }

  const lean = kind === 'lean' ? -34 : 34;
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => {
        const x = kind === 'lean' ? w + 4 - i * 15 : w - 44 + i * 15;
        return (
          <Line
            key={i}
            x1={x} y1={-6} x2={x + lean} y2={h + 6}
            stroke={color} strokeOpacity={0.15 - i * 0.02} strokeWidth={1}
          />
        );
      })}
    </>
  );
}

export default function SpiritualTypeDoor({
  tint,
  flourish,
  title,
  body,
  Emblem,
  emblemWidth = 1.15,
  onPress,
  anchor,
}: {
  tint: string;
  flourish: DoorFlourish;
  title: string;
  body: string;
  Emblem: React.ComponentType<{ s?: number; c?: string; w?: number }>;
  emblemWidth?: number;
  onPress: () => void;
  /** guided-tour binding, when the tour is pointing at this door */
  anchor?: { ref?: React.Ref<any>; onLayout?: (event: LayoutChangeEvent) => void };
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  // Keyed per instance: two radial gradients sharing an id collide on Android.
  const washId = `spiritual-wash-${useId().replace(/:/g, '')}`;

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize(prev => (
      Math.abs(prev.w - width) < 0.5 && Math.abs(prev.h - height) < 0.5
        ? prev
        : { w: width, h: height }
    ));
    anchor?.onLayout?.(event);
  }, [anchor]);

  const { w, h } = size;
  const ready = w > 0 && h > 0;

  return (
    <TouchableOpacity
      ref={anchor?.ref}
      onLayout={handleLayout}
      onPress={onPress}
      activeOpacity={0.86}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${body}`}
      style={[s.door, { borderColor: tone(tint, 88, 0.55) }]}
    >
      {ready && (
        <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <RadialGradient id={washId} cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.95} />
              <Stop offset="0.42" stopColor={litTone(tint, 88, 46)} stopOpacity={0.55} />
              <Stop offset="1" stopColor={litTone(tint, 88, 46)} stopOpacity={0} />
            </RadialGradient>
          </Defs>

          {/* The lamp set beside the mark: gone by the middle of the plate. */}
          <Ellipse
            cx={SEAT_LEFT + SEAT / 2}
            cy={h / 2}
            rx={124}
            ry={54}
            fill={`url(#${washId})`}
          />

          <Flourish kind={flourish} color={tone(tint, 52, 0.7)} w={w} h={h} />
        </Svg>
      )}

      <View pointerEvents="none" style={s.litEdge} />

      <View style={s.row}>
        <View style={s.seat}>
          <View pointerEvents="none" style={[s.seatRing, { borderColor: ringColor(tint, 0.3) }]} />
          <Emblem s={MARK} c={tone(tint, 32)} w={emblemWidth} />
        </View>

        <View style={s.copy}>
          <Text style={[s.title, { color: tone(tint, 26) }]} numberOfLines={1}>{title}</Text>
          <Text style={s.body} numberOfLines={2}>{body}</Text>
        </View>

        <ChevronRight s={16} c={tone(tint, 66, 0.5)} />
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  door: {
    minHeight: 88,
    borderRadius: 21,
    borderWidth: 1,
    backgroundColor: '#FFFDF8',
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 12,
    elevation: 1,
  },
  litEdge: {
    position: 'absolute',
    top: 1,
    left: 14,
    right: 14,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  seat: {
    width: SEAT,
    height: SEAT,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  seatRing: {
    position: 'absolute',
    width: SEAT,
    height: SEAT,
    borderRadius: SEAT / 2,
    borderWidth: 1,
  },
  copy: { flex: 1, gap: 3 },
  title: {
    fontFamily: F.serifMedium,
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: 0.2,
  },
  body: {
    fontFamily: F.sans,
    fontSize: 11.5,
    lineHeight: 15,
    color: '#8B8378',
  },
});
