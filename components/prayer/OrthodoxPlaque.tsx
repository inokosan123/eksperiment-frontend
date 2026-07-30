import { useMemo } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { toHsl } from '@/components/shared/tone';
import { F } from '@/constants/tokens';

/* ─────────────────────────────────────────────────────────────
 * THE PLAQUE — the Orthodox book's one action, wherever it appears.
 *
 * It starts the prayer on the Prayer Book screen and it advances the
 * page inside the reader, and it is deliberately the SAME OBJECT in
 * both places: you press a plaque to enter the rule, and you go on
 * pressing that plaque until it says the rule is finished.
 *
 * ⚠ IT IS NOT A COLOURED BUTTON. Two versions were, and both were
 * wrong the same way: a saturated plate with a pane of light on its
 * upper half, a rim, and a glow beneath. That is a modelled plastic
 * object — it read as lit from behind by something electrical, and it
 * sat ON a screen that is otherwise a printed book.
 *
 * · THE GROUND NEVER CHANGES. One off-white — alabaster, the colour
 *   of a statue rather than of paper — running a shade deeper toward
 *   the foot, the way a stone face falls away from the light.
 *
 * · THE HOUR'S COLOUR IS THE INK, NOT THE FILL. Letters, outer frame
 *   and incised rules take it; the plate does not. So the plaque is
 *   one object across all five hours and only its lettering changes —
 *   which is what a book does and a coloured button cannot.
 *
 * · THE RULES ARE INCISED, NOT PRINTED. Each is a line of the hour's
 *   colour with a white catch-light immediately INSIDE it. That pair
 *   is the whole difference between a line drawn ON a surface and one
 *   cut INTO it, and it is the device the app's cards use for a fold.
 *
 * · TWO STRUCK DIAMONDS flank the words, at the 5.5 and the tilt the
 *   prayer card's ornament uses. Not a play triangle or a chevron:
 *   those are player and browser furniture, and nothing on this page
 *   is pretending to be either.
 *
 * · SERIF, SENTENCE CASE. Tracked capitals are these screens' LABELS
 *   (MORNING, MEALS, ORTH.); a label names a thing, this asks you to
 *   do one, and in a book that is set in the book's own face.
 * ───────────────────────────────────────────────────────────── */

/** Alabaster. The plate is this at every hour, in every language. */
const STONE_TOP = '#FCF9F2';
const STONE_MID = '#F5EFE2';
const STONE_FOOT = '#EBE3D1';

export function plaqueInk(hex: string, lightness: number, satFloor = 46): string {
  const { h, s } = toHsl(hex);
  const sat = s < 14 ? s : Math.max(s, satFloor);
  return `hsl(${Math.round(h)} ${Math.round(sat)}% ${lightness}%)`;
}

export function plaqueAlpha(hex: string, alpha: number): string {
  const v = hex.replace('#', '');
  const n = Number.parseInt(v.length === 3 ? v.split('').map(c => c + c).join('') : v, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/**
 * ⚠ 25, and the EMERALD hour is what decides it. Green is perceptually far
 * lighter than the other four, so at the 31 that suited amber and violet it
 * came out at 3.5:1 on this stone — under AA for body text. At 25 the worst of
 * the five is 4.96:1 and the best 12.1:1, measured against the plate's
 * mid-tone, and every hour is still plainly its own colour.
 */
const LETTER_LIGHTNESS = 25;

type Size = 'hero' | 'compact';

const SIZES: Record<Size, {
  minHeight: number;
  radius: number;
  padH: number;
  padV: number;
  font: number;
  line: number;
  gap: number;
  diamond: number;
  rule: number;
  ruleCatch: number;
  ruleFine: number;
}> = {
  // The floating action on the Prayer Book screen.
  hero: {
    minHeight: 56, radius: 20, padH: 32, padV: 15,
    font: 18, line: 24, gap: 13, diamond: 5.5,
    rule: 5, ruleCatch: 6, ruleFine: 9,
  },
  // The same object in the reader's foot, where it shares the bar with the
  // page it is turning. The rules come in proportionally, not by the same
  // number of points — at 46 tall a 9pt inset would close the middle up.
  compact: {
    minHeight: 46, radius: 16, padH: 24, padV: 11,
    font: 16, line: 21, gap: 11, diamond: 4.5,
    rule: 4, ruleCatch: 5, ruleFine: 7.5,
  },
};

export default function OrthodoxPlaque({
  accent,
  label,
  onPress,
  onPressIn,
  onPressOut,
  size = 'hero',
  style,
}: {
  /** The hour's own colour — it becomes the ink, never the ground. */
  accent: string;
  label: string;
  onPress: () => void;
  /** Passed through so a caller can drive its own press motion on the way
   *  DOWN. Driving it from `onPress` only ever animates on release, which
   *  reads as a lag rather than as a press. */
  onPressIn?: () => void;
  onPressOut?: () => void;
  size?: Size;
  style?: StyleProp<ViewStyle>;
}) {
  const d = SIZES[size];
  const palette = useMemo(() => ({
    letter: plaqueInk(accent, LETTER_LIGHTNESS),
    diamond: plaqueInk(accent, 34),
    frame: plaqueAlpha(accent, 0.5),
    rule: plaqueAlpha(accent, 0.42),
    ruleFine: plaqueAlpha(accent, 0.22),
  }), [accent]);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      haptic="medium"
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[s.shadow, { borderRadius: d.radius }, style]}
    >
      <View
        style={[s.plaque, {
          borderColor: palette.frame,
          minHeight: d.minHeight,
          borderRadius: d.radius,
          paddingHorizontal: d.padH,
          paddingVertical: d.padV,
        }]}
      >
        <LinearGradient
          colors={[STONE_TOP, STONE_MID, STONE_FOOT]}
          locations={[0, 0.55, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* The light along the top edge of the stone. */}
        <View pointerEvents="none" style={s.litEdge} />

        {/* The incised double rule: the cut, the light caught inside it, and a
            finer cut within. */}
        <View
          pointerEvents="none"
          style={[s.inset, {
            top: d.rule, left: d.rule, right: d.rule, bottom: d.rule,
            borderRadius: d.radius - d.rule,
            borderColor: palette.rule,
          }]}
        />
        {/* ⚠ Immediately INSIDE the cut, never outside it. This one hairline is
            what makes the rule read as incised rather than drawn. */}
        <View
          pointerEvents="none"
          style={[s.inset, {
            top: d.ruleCatch, left: d.ruleCatch, right: d.ruleCatch, bottom: d.ruleCatch,
            borderRadius: d.radius - d.ruleCatch,
            borderColor: 'rgba(255,255,255,0.9)',
          }]}
        />
        <View
          pointerEvents="none"
          style={[s.inset, {
            top: d.ruleFine, left: d.ruleFine, right: d.ruleFine, bottom: d.ruleFine,
            borderRadius: d.radius - d.ruleFine,
            borderColor: palette.ruleFine,
          }]}
        />

        <View style={[s.row, { gap: d.gap }]}>
          <View
            pointerEvents="none"
            style={[s.diamond, {
              width: d.diamond, height: d.diamond, backgroundColor: palette.diamond,
            }]}
          />
          <Text
            style={[s.label, { color: palette.letter, fontSize: d.font, lineHeight: d.line }]}
            numberOfLines={1}
          >
            {label}
          </Text>
          <View
            pointerEvents="none"
            style={[s.diamond, {
              width: d.diamond, height: d.diamond, backgroundColor: palette.diamond,
            }]}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  // Neutral and soft. A coloured glow is what made the old button look
  // electrical; stone is lifted by a shadow, not by light of its own.
  shadow: {
    borderCurve: 'continuous',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 6,
  },
  // A rounded rectangle, not a pill: a pill is an app's action, a plaque is a
  // thing a title is cut into.
  plaque: {
    borderCurve: 'continuous',
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  litEdge: {
    position: 'absolute',
    top: 1,
    left: 22,
    right: 22,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  inset: {
    position: 'absolute',
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  diamond: {
    borderRadius: 1,
    transform: [{ rotate: '45deg' }],
  },
  label: {
    fontFamily: F.serifSemiBold,
    letterSpacing: 0.3,
  },
});
