import React, { useCallback, useId, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
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
 *   · THE PLATE IS STRUCK IN ITS OWN TONE, corner to corner, so it is
 *     an object under light rather than a white card with a tint on
 *     it — and then a pane of white light is laid over the shoulder.
 *   · THE MARK STILL STANDS IN A POOL OF LIGHT, now brighter, because
 *     it has to lift off a ground that carries colour of its own.
 *   · ONE RING, NOT THREE. The seat carries a single hairline; the
 *     pool behind it does the rest.
 *   · THE MARK CARRIES THE MEANING — `BeadLoop`, `ScriptureBook` and
 *     `ChurchDome`, the emblems the app already stands on, drawn at 30
 *     so their internal density survives. Below that the Gospel's
 *     tooled frame and the drum's slits are a smudge.
 *
 * ⚠ NO RULED FLOURISH. The doors carry leaning lines along their far
 * edge; struck across a full-width plate they stopped reading as a
 * manuscript's ornament and started reading as scratches on the card.
 * The plate's own gradient does that work instead.
 * ───────────────────────────────────────────────────────────── */

/** The mark's seat, and the emblem drawn inside it. */
const SEAT = 54;
const MARK = 30;
const SEAT_LEFT = 14;

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

export default function SpiritualTypeDoor({
  tint,
  title,
  body,
  Emblem,
  emblemWidth = 1.15,
  onPress,
  anchor,
}: {
  tint: string;
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
      style={[s.door, { borderColor: litTone(tint, 78, 42) }]}
    >
      {/* The plate itself, struck in the subject's own tone and running corner
          to corner so it reads as an object under light, not as a tint. */}
      <LinearGradient
        colors={[litTone(tint, 98, 38), litTone(tint, 93, 42), litTone(tint, 87, 46)]}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.ground}
      />

      {ready && (
        <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <RadialGradient id={washId} cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.95} />
              <Stop offset="0.44" stopColor={litTone(tint, 95, 44)} stopOpacity={0.72} />
              <Stop offset="1" stopColor={litTone(tint, 92, 44)} stopOpacity={0} />
            </RadialGradient>
          </Defs>

          {/* The lamp set beside the mark, so the emblem still stands in light
              now that the plate around it carries colour of its own. */}
          <Ellipse
            cx={SEAT_LEFT + SEAT / 2}
            cy={h / 2}
            rx={92}
            ry={50}
            fill={`url(#${washId})`}
          />
        </Svg>
      )}

      {/* The pane of light on the shoulder — transparent well before it ends,
          so it never rules a line across the plate. */}
      <LinearGradient
        colors={['rgba(255,255,255,0.5)', 'rgba(255,255,255,0)']}
        locations={[0, 0.6]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.ground}
      />

      <View pointerEvents="none" style={s.litEdge} />

      <View style={s.row}>
        <View style={s.seat}>
          <View pointerEvents="none" style={[s.seatRing, { borderColor: ringColor(tint, 0.3) }]} />
          <Emblem s={MARK} c={tone(tint, 32)} w={emblemWidth} />
        </View>

        <View style={s.copy}>
          <Text style={[s.title, { color: tone(tint, 24) }]} numberOfLines={1}>{title}</Text>
          <Text style={[s.body, { color: tone(tint, 40, 0.72) }]} numberOfLines={2}>{body}</Text>
        </View>

        <ChevronRight s={16} c={tone(tint, 58, 0.6)} />
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  door: {
    minHeight: 92,
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
  ground: { position: 'absolute', top: 1, left: 1, right: 1, bottom: 1, borderRadius: 19 },
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
    fontFamily: F.serifSemiBold,
    fontSize: 21,
    lineHeight: 25,
    letterSpacing: 0.2,
  },
  // The description is set in the app's quiet voice — Garamond italic, the
  // same face the empty states speak in — not in the interface sans, which
  // read as a settings subtitle under a serif title.
  body: {
    fontFamily: F.serifItalic,
    fontSize: 14,
    lineHeight: 18,
  },
});
