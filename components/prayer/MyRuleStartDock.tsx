import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Play } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { toHsl } from '@/components/shared/tone';
import { C, F } from '@/constants/tokens';
import { MINE_ACCENT } from '@/components/prayer/myRuleTone';

/* ─────────────────────────────────────────────────────────────
 * START PRAYER, My Rule's side — the same action as the Orthodox
 * one, and deliberately not the same object.
 *
 * The Orthodox button FLOATS: a lozenge of gold hanging over a page
 * of received text, struck with a manuscript double rule and two
 * diamonds. Its beauty is ornament.
 *
 * This one DOCKS. It is a bar the width of the page, sitting on the
 * bottom edge under a scrim the content scrolls away beneath, and its
 * beauty is restraint — the western half of the book, drawn the way
 * that half is drawn everywhere else on this screen:
 *
 * · ONE quiet gradient down the plate, not three stops across it.
 * · ONE white hairline on the top edge. No inner rules, no diamonds,
 *   no rim; nothing is engraved on this side.
 * · A THIN RING holding the play mark — the dial from the card above,
 *   in miniature. Not a filled disc: the ring is what this rule's
 *   instrument actually looks like, and the two should rhyme.
 * · Serif, sentence case. Tracked capitals are this screen's labels.
 *
 * ⚠ The scrim is part of the dock, not the screen. A docked bar with
 * type scrolling out from under it needs the page to fade into it, or
 * the last line of the list appears to be cut in half by a floating
 * slab.
 * ───────────────────────────────────────────────────────────── */

function lit(hex: string, lightness: number, satFloor = 60): string {
  const { h, s } = toHsl(hex);
  const sat = s < 14 ? s : Math.max(s, satFloor);
  return `hsl(${Math.round(h)} ${Math.round(sat)}% ${lightness}%)`;
}

function deep(hex: string, lightness: number, satFloor = 55): string {
  const { h, s } = toHsl(hex);
  const sat = s < 14 ? s : Math.max(s, satFloor);
  return `hsl(${Math.round(h)} ${Math.round(sat)}% ${lightness}%)`;
}

/** How far the page fades into the dock above it. */
export const MY_RULE_DOCK_SCRIM = 36;

export default function MyRuleStartDock({
  label = 'Start Prayer',
  bottomInset,
  onPress,
}: {
  label?: string;
  /** The safe-area inset; the bar sits just clear of it. */
  bottomInset: number;
  onPress: () => void;
}) {
  const tint = MINE_ACCENT;
  const palette = useMemo(() => ({
    top: lit(tint, 52),
    bottom: deep(tint, 36),
    shadow: deep(tint, 40),
  }), [tint]);

  return (
    <View
      style={[s.dock, { paddingBottom: Math.max(bottomInset, 10) + 8 }]}
      pointerEvents="box-none"
    >
      {/* The page fading into the bar, so nothing is guillotined by it. */}
      <LinearGradient
        colors={['rgba(252,252,252,0)', C.bg]}
        style={[s.scrim, { height: MY_RULE_DOCK_SCRIM }]}
        pointerEvents="none"
      />
      <View style={[s.floor, { bottom: 0 }]} pointerEvents="none" />

      <TouchableOpacity
        activeOpacity={0.9}
        haptic="medium"
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[s.shadow, { shadowColor: palette.shadow }]}
      >
        <LinearGradient
          colors={[palette.top, palette.bottom]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={s.bar}
        >
          <View pointerEvents="none" style={s.litEdge} />

          {/* The dial, in miniature: a hairline ring with the mark inside it. */}
          <View style={s.ring}>
            <View style={s.ringNudge}>
              <Play s={11} c="#FFFFFF" />
            </View>
          </View>

          <Text style={s.label} numberOfLines={1}>{label}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    justifyContent: 'flex-end',
  },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: '100%' },
  // Under the scrim's gradient, the page colour runs solid to the screen's
  // edge — otherwise the safe-area strip shows the list through it.
  floor: { position: 'absolute', left: 0, right: 0, top: 0, backgroundColor: C.bg },
  shadow: {
    borderRadius: 22,
    borderCurve: 'continuous',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.26,
    shadowRadius: 14,
    elevation: 6,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    minHeight: 56,
    borderRadius: 22,
    borderCurve: 'continuous',
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  litEdge: {
    position: 'absolute',
    top: 0.5,
    left: 26,
    right: 26,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  ring: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A play triangle is optically left-heavy; a point of nudge centres it.
  ringNudge: { marginLeft: 1.5 },
  label: {
    fontFamily: F.serifSemiBold,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: 0.3,
    color: '#FFFFFF',
  },
});
