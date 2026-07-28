import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowUpRight, CalendarCheck } from '@/components/icons/Icons';
import { F } from '@/constants/tokens';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';

/* ─────────────────────────────────────────────────────────────
 * SET AS DAILY TASK — one element, four screens.
 *
 * It sits at the foot of Holy Scripture, under Journal's write
 * cards, above the Prayer Book's categories, and under Ideal Self's
 * summary. It is NOT designed as an object of its own; it is drawn
 * in the language those screens already speak.
 *
 * That language is the app's section card, and it is the same in all
 * four places — Journal's `WriteSectionCard` and Library's Ribbon are
 * built from exactly these parts:
 *
 *   · a pale tinted plate running to white on the diagonal
 *   · a large soft watermark of the card's own mark, bleeding off
 *     the corner at around a tenth of its strength
 *   · a filled arrow orb in the deep tone
 *   · a serif line and a quieter serif line under it
 *
 * So this is that card, compressed into one row. It belongs on every
 * screen because it is made of what every screen is made of.
 *
 * ⚠ WHAT IT IS NOT, AND WHY
 *
 * Two louder versions were built and both were wrong. A near-black
 * plate: ink is already spoken for — it is the Journal streak room's
 * language and `ROUTINE_TASK_ACCENT` in the sheet this very button
 * opens — and on four light screens it read as a hole punched in the
 * page. Then a solid gold fill under a gold glow: correct as the
 * app's action colour in the abstract, but a saturated slab with a
 * shaded coin and drifting sparks is not a thing any of these
 * screens contain, so it sat on them rather than in them.
 *
 * The lesson, recorded so it is not repeated: this button's job is
 * not to announce itself. Solid fills, modelled 3-D marks and
 * moving sparks are the vocabulary of the cards' own decoration,
 * not of a row that lives among them.
 *
 * ⚠ It is still distinct from Scripture's three doors directly above
 * it, which was the original complaint: they carry a manuscript
 * double rule, a haloed icon and a ghost chevron. This has none of
 * those — it has the watermark and the filled orb, which is the
 * card family's grammar, not the door's.
 *
 * ⚠ ONE LOOK, NO VARIANTS, and no tint borrowed from the host. It was
 * once split into 'soft' and 'scripture' and the same button looked
 * like two different buttons depending on where you met it.
 * Everything is drawn inside this file, so no caller can produce a
 * different card by forgetting an argument.
 * ───────────────────────────────────────────────────────────── */

// The gold the section cards already use for this family — Journal's Daily
// Journal card and Library's My Favorites are set in exactly these values.
const PLATE = '#FBF3DE';
const BORDER = '#F0E3B8';
const MARK = '#A9863F';
const TITLE = '#6D4F13';
const SUBTITLE = '#A9863F';
const ARROW_BG = '#8A5A1A';
// A deeper draw of the plate itself — the seat is the paper pressed darker,
// not a new colour laid on it.
const SEAT = '#F3E5C2';
/** Close to the arrow orb's 38, so the two read as a pair. */
const SEAT_SIZE = 42;

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
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[s.card, style]}>
      <LinearGradient
        colors={[PLATE, '#FFFFFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* A pane of light on the shoulder, and the hairline the plate catches
          along its top edge — both are the card family's, and the row was
          missing them. The pane reaches nothing well before any edge, so it
          never rules a line across the plate. */}
      <LinearGradient
        colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
        locations={[0, 0.58]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View pointerEvents="none" style={s.litEdge} />

      {/* The mark, on a seat of the plate pressed darker.
       *
       * The cards carry their watermark bleeding off the bottom-RIGHT, and
       * this row did too at first — but a card is tall enough to keep its
       * arrow at the top and its mark at the foot, while a 72pt row centres
       * the orb straight onto the mark and cuts it in half. So the mark took
       * the far side, where nothing is laid over it.
       *
       * Left as a pale ghost it made that side read empty. Seated, it answers
       * the arrow orb across the row — a soft disc for what this is, a solid
       * one for what it does — and the words sit between them.
       *
       * ⚠ The seat is FILLED, not ringed. Concentric rings around a mark are
       * Scripture's doors, three of which stand directly above this row. */}
      <View style={s.seat} pointerEvents="none">
        <View style={s.seatDisc} />
        <CalendarCheck s={21} c={MARK} w={1.8} />
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
          style={s.subtitle}
          allowFontScaling={false}
          numberOfLines={1}
          maxFontSizeMultiplier={textMaxFontSizeMultiplier}
          adjustsFontSizeToFit
          minimumFontScale={0.82}
        >
          {subtitle}
        </Text>
      </View>

      <View style={s.arrow} pointerEvents="none">
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
    minHeight: 72,
    gap: 14,
    // Between the doors' 19 and the section cards' 28: it is a row of the
    // card family, not a card and not a door.
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: PLATE,
    paddingHorizontal: 16,
    paddingVertical: 14,
    overflow: 'hidden',
    // The section cards' own shadow.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  // `top`/`bottom` rather than a percentage and a negative margin: it centres
  // on whatever height the row settles at, including a scaled font.
  litEdge: {
    position: 'absolute',
    top: 1,
    left: 16,
    right: 16,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  // `top`/`bottom` rather than a percentage and a negative margin: it centres
  // on whatever height the row settles at, including a scaled font.
  seat: {
    position: 'absolute',
    left: 13,
    top: 0,
    bottom: 0,
    width: SEAT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatDisc: {
    position: 'absolute',
    width: SEAT_SIZE,
    height: SEAT_SIZE,
    borderRadius: SEAT_SIZE / 2,
    backgroundColor: SEAT,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    // Clear of the seat, which stands from 13 to 55.
    paddingLeft: 48,
  },
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
    color: SUBTITLE,
  },
  arrow: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: ARROW_BG,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  arrowTilt: { transform: [{ rotate: '-15deg' }] },
});
