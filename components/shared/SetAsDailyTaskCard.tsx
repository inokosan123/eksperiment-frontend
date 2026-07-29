import { useMemo } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowUpRight, CalendarCheck } from '@/components/icons/Icons';
import { F } from '@/constants/tokens';
import { toHsl } from '@/components/shared/tone';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';

/* ─────────────────────────────────────────────────────────────
 * SET AS DAILY TASK — one element, four screens.
 *
 * It sits at the foot of Holy Scripture, under Journal's write
 * cards, above the Prayer Book's switch, and under Ideal Self's
 * summary. It is NOT designed as an object of its own; it is drawn
 * in the language those screens already speak — the app's section
 * card, compressed into one row.
 *
 * ⚠ THE FAULT THIS PASS FIXES: it was drawn as a WASHED copy of
 * that family rather than as a member of it. A pale plate fading to
 * white, a flat disc of slightly darker paper, a flat orb — the
 * family's shapes with none of the family's material, so on four
 * screens full of lit, modelled surfaces it read as the flattest
 * thing on the page. Shallow is not the same as quiet.
 *
 * So the material is the family's own, exactly:
 *
 *   · THE PLATE IS LIFTED, NOT WHITENED. Three stops on the diagonal,
 *     built in HSL with the hue kept and the saturation held — near
 *     white at the shoulder, real gold at the foot. Mixing gold
 *     toward white was what drained it; `RibbonSectionCard` learnt
 *     this first and every good plate in the app is built this way.
 *   · A HAIRLINE OF LIGHT along the top edge, a pane of light on the
 *     shoulder, and a breath of shade gathering at the foot. Light
 *     comes from the top-left on every surface in this app.
 *   · THE MARK IS STRUCK, NOT PRINTED. A modelled medallion: its own
 *     small gradient, a lit rim standing above it, and a shadow under
 *     it. It answers the arrow orb across the row — a soft mark for
 *     what this is, a solid one for what it does.
 *   · THE ORB IS RIMMED. The white hairline every arrow orb in the
 *     ribbon family wears, and a shadow in the plate's own deep tone.
 *
 * ⚠ WHAT IT IS STILL NOT, AND WHY
 *
 * Two louder versions were built and both were rejected. A near-black
 * plate: ink is already spoken for — it is the Journal streak room's
 * language and `ROUTINE_TASK_ACCENT` in the sheet this very button
 * opens — and on four light screens it read as a hole punched in the
 * page. Then a solid gold fill under a gold glow, with a shaded coin
 * and drifting sparks: correct as the app's action colour in the
 * abstract, but not a thing any of these screens contains, so it sat
 * on them rather than in them.
 *
 * Depth here is bought with LIGHT AND MATERIAL, never with volume:
 * no saturated fill, no moving sparks, no constellation. Those are
 * the vocabulary of the cards' own decoration, not of a row that
 * lives among them.
 *
 * ⚠ IT MUST NOT BECOME A DOOR. Scripture's Checkpoints door stands
 * directly above this row and is also a gold row with a mark left,
 * type centre and a control right. The doors are drawn cream and
 * OUTLINED — a manuscript double rule, a haloed seal of two
 * concentric rings, a ghost chevron. This is drawn FILLED — a lifted
 * plate, a struck medallion, a solid orb. Rings around the mark and
 * rules inside the frame are theirs; they are never borrowed here.
 *
 * ⚠ ONE LOOK, NO VARIANTS, and no tint borrowed from the host. It was
 * once split into 'soft' and 'scripture' and the same button looked
 * like two different buttons depending on where you met it.
 * Everything is drawn inside this file, so no caller can produce a
 * different card by forgetting an argument.
 * ───────────────────────────────────────────────────────────── */

/** The gold this family is set in — Journal's Daily Journal card and Library's
 *  My Favorites are struck in exactly this hue. */
const GOLD = '#A9863F';

/** The ribbon palette's own lift: hue kept, saturation held, lightness raised. */
function lit(hex: string, lightness: number, satFloor = 70): string {
  const { h, s } = toHsl(hex);
  const sat = s < 14 ? s : Math.max(s, satFloor);
  return `hsl(${Math.round(h)} ${Math.round(sat)}% ${lightness}%)`;
}

function deep(hex: string, lightness: number, satFloor = 55): string {
  const { h, s } = toHsl(hex);
  const sat = s < 14 ? s : Math.max(s, satFloor);
  return `hsl(${Math.round(h)} ${Math.round(sat)}% ${lightness}%)`;
}

const TITLE = '#6D4F13';
const ARROW_BG = '#8A5A1A';

/** The medallion against the orb's 38: near enough to read as its answer. */
const MARK_SIZE = 44;
const ORB_SIZE = 38;

type Props = {
  onPress: () => void;
  title?: string;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
  textMaxFontSizeMultiplier?: number;
};

export default function SetAsDailyTaskCard({
  onPress,
  title = 'Set as Daily Task',
  subtitle = 'Add to your daily routine',
  style,
  textMaxFontSizeMultiplier = 1.08,
}: Props) {
  const p = useMemo(() => ({
    // 97 → 89 → 80: the shoulder is all but white, the foot is gold that has
    // not been asked to apologise. The old plate ran 93 flat into #FFFFFF.
    plate: [lit(GOLD, 97), lit(GOLD, 90), lit(GOLD, 80, 72)] as const,
    border: lit(GOLD, 76, 62),
    markFace: [lit(GOLD, 96), lit(GOLD, 84, 68)] as const,
    markRim: 'rgba(255,255,255,0.92)',
    markInk: deep(GOLD, 34),
    markShadow: deep(GOLD, 40),
    subtitle: deep(GOLD, 37),
  }), []);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[s.card, { borderColor: p.border }, style]}
    >
      <LinearGradient
        colors={p.plate}
        locations={[0, 0.46, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* The pane of light gathered at the shoulder. It reaches transparent
          well before any edge — a fade that stops mid-plate rules a line
          across it as cleanly as if you had drawn one. */}
      <LinearGradient
        colors={['rgba(255,255,255,0.62)', 'rgba(255,255,255,0)']}
        locations={[0, 0.58]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* And the shade it casts at the foot, so the plate has a near edge and
          a far one instead of lying flat on the screen. */}
      <LinearGradient
        colors={['rgba(109,79,19,0)', 'rgba(109,79,19,0.07)']}
        locations={[0.55, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View pointerEvents="none" style={s.litEdge} />

      {/* THE MARK, STRUCK.
       *
       * A flat disc of paper pressed darker is what stood here, and it was the
       * single flattest part of the row. This is the same disc modelled: a rim
       * of light standing a point proud of it, its own gradient turning over,
       * and a shadow beneath in the plate's deep tone.
       *
       * ⚠ The rim is a lit EDGE, not a ring around the mark. Concentric rings
       * are the seal on Scripture's doors, which stand directly above this. */}
      <View style={s.markWrap} pointerEvents="none">
        <View style={[s.markRim, { backgroundColor: p.markRim }]} />
        <View style={[s.markFace, { shadowColor: p.markShadow }]}>
          <LinearGradient
            colors={p.markFace}
            start={{ x: 0.15, y: 0 }}
            end={{ x: 0.85, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <CalendarCheck s={21} c={p.markInk} w={1.85} />
        </View>
      </View>

      <View style={s.copy}>
        <Text
          style={s.title}
          allowFontScaling={false}
          maxFontSizeMultiplier={textMaxFontSizeMultiplier}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.82}
        >
          {title}
        </Text>
        <Text
          style={[s.subtitle, { color: p.subtitle }]}
          allowFontScaling={false}
          numberOfLines={1}
          maxFontSizeMultiplier={textMaxFontSizeMultiplier}
          adjustsFontSizeToFit
          minimumFontScale={0.82}
        >
          {subtitle}
        </Text>
      </View>

      {/* The orb, with the white hairline every arrow in this family wears and
          a shadow in the plate's own deep gold, so it sits ON the plate rather
          than in it. */}
      <View style={[s.arrow, { shadowColor: p.markShadow }]} pointerEvents="none">
        <LinearGradient
          colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']}
          locations={[0, 0.6]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={s.arrowTilt}>
          <ArrowUpRight s={16} c="#FFFFFF" w={2.5} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    minHeight: 76,
    gap: 14,
    // Between the doors' 19 and the section cards' 28: it is a row of the
    // card family, not a card and not a door.
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: 1,
    // The plate's middle stop, held under the gradient so the row is never
    // briefly a white slab while the gradient rasterises.
    backgroundColor: '#F6E7CC',
    paddingHorizontal: 16,
    paddingVertical: 14,
    overflow: 'hidden',
    // The section cards' own shadow, a touch deeper for the deeper plate.
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.07,
    shadowRadius: 13,
    elevation: 3,
  },
  litEdge: {
    position: 'absolute',
    top: 1,
    left: 18,
    right: 18,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },

  // ── The struck medallion ────────────────────────────────────────────────
  // In flow rather than absolute: the row centres it on whatever height the
  // copy settles at, including a scaled font, without a measured seat.
  markWrap: {
    width: MARK_SIZE,
    height: MARK_SIZE,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A point of light standing proud of the face's top edge. Offset upward by
  // one, so only the top arc of it shows: that is what makes a disc read as
  // pressed out of the plate rather than laid on it.
  markRim: {
    position: 'absolute',
    top: -1,
    width: MARK_SIZE,
    height: MARK_SIZE,
    borderRadius: MARK_SIZE / 2,
  },
  markFace: {
    width: MARK_SIZE,
    height: MARK_SIZE,
    borderRadius: MARK_SIZE / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
    elevation: 2,
  },

  copy: { flex: 1, minWidth: 0 },
  title: {
    fontFamily: F.serifMedium,
    fontSize: 17.5,
    lineHeight: 22,
    color: TITLE,
  },
  subtitle: {
    marginTop: 2,
    fontFamily: F.serif,
    fontSize: 13,
    lineHeight: 17,
  },

  arrow: {
    position: 'relative',
    overflow: 'hidden',
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    backgroundColor: ARROW_BG,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 5,
    elevation: 2,
  },
  arrowTilt: { transform: [{ rotate: '-15deg' }] },
});
