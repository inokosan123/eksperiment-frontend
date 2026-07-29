import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Reanimated, {
  FadeIn,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Cross, OrthodoxCross } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import { MINE_ACCENT, MINE_BORDER, MINE_INK, MINE_TINT, mineAlpha } from '@/components/prayer/myRuleTone';
import { PRAYER_BOOK_SWITCH_NOTES, type PrayerLanguage } from '@/data/prayers/prayerCatalog';

/* ─────────────────────────────────────────────────────────────
 * MY RULE or ORTHODOX — the Prayer Book's two books, struck the
 * way this app strikes a two-way choice.
 *
 * The grammar is Set as Task's (Spiritual / Challenge) and Focus's
 * (Limit / Blocked): a recessed track, a raised plaque, and — the
 * part worth carrying — the plaque does not merely travel, it
 * CHANGES INTO the book it is selecting.
 *
 *   left   MY RULE   a blank page. Cool light, a plain cross, and
 *                    two faint writing lines where a received book
 *                    would print its text. Nothing is given here;
 *                    the words are yours.
 *
 *   right  ORTHODOX  a received page. Parchment, the Orthodox cross,
 *                    and the manuscript double rule closing it top
 *                    and bottom — the mark of a book that was set
 *                    long before you opened it.
 *
 * One blank page, one printed one; that contrast does the explaining,
 * so neither label has to. Both faces cross-fade on the very value
 * that drives the slide, and pill, faces, emblems and ink all read
 * from that single shared value on the UI thread — no React state
 * moves while the switch is moving.
 * ───────────────────────────────────────────────────────────── */

export type PrayerBookMode = 'mine' | 'orthodox';

// My Rule's cool light comes from myRuleTone, shared with the page this face
// opens — the two must be struck in the same light or they read as two things.
const MINE_DISC = mineAlpha(0.18);
const MINE_HEART = mineAlpha(0.09);

// The received book's gold — the app's own, unchanged.
const ORTH_ACCENT = C.gold;
const ORTH_INK = C.goldDark;
const ORTH_BORDER = 'rgba(197,160,89,0.46)';
const ORTH_RULE = 'rgba(197,160,89,0.55)';
const ORTH_DISC = 'rgba(197,160,89,0.2)';
const ORTH_HEART = 'rgba(197,160,89,0.1)';

const REST_INK = '#A8A29E';

/**
 * The ink the sentence under the track is set in.
 *
 * Each side's own accent taken down to reading weight by the ribbon cards' own
 * formula — hue kept, saturation held at 55, lightness dropped to 32 — which
 * is how every card in this app inks its body copy against its own colour. A
 * neutral grey belonged to neither book; these belong to one each, and both
 * clear the contrast a three-line sentence needs on #FCFCFC.
 */
const MINE_NOTE_INK = '#25507E';   // hsl(211 55% 32%) from MINE_ACCENT
const ORTH_NOTE_INK = '#7E5F25';   // hsl(39 55% 32%) from C.gold

const TRACK_PAD = 4;
const TRACK_GAP = 4;

// The app's one selection spring. Same figures as Set as Task and the task
// frequency seats, so every choice in Anasta settles with the same weight.
const SELECT_SPRING = { damping: 18, stiffness: 235, mass: 0.72 };

/**
 * The emblem, built to the switch's own pattern: a 32 seat, a 28 disc, a 22
 * heart and the glyph over both. Resting it is still itself, only dimmer;
 * chosen, it throws a halo onto the plaque.
 */
function Emblem({
  kind,
  tone,
  motion,
  restingAt,
}: {
  kind: PrayerBookMode;
  tone: { disc: string; heart: string; glyph: string };
  motion: SharedValue<number>;
  /** The motion value at which this emblem is the chosen one. */
  restingAt: 0 | 1;
}) {
  const seatStyle = useAnimatedStyle(() => {
    const on = restingAt === 0 ? 1 - motion.value : motion.value;
    return {
      opacity: 0.55 + on * 0.45,
      transform: [{ scale: 0.965 + on * 0.035 }],
    };
  });
  const glowStyle = useAnimatedStyle(() => {
    const on = restingAt === 0 ? 1 - motion.value : motion.value;
    return { opacity: on };
  });

  return (
    <Reanimated.View style={[s.emblemSeat, seatStyle]}>
      <Reanimated.View style={[s.emblemGlow, glowStyle]} pointerEvents="none" />
      <View style={[s.emblemDisc, { backgroundColor: tone.disc }]} />
      <View style={[s.emblemHeart, { backgroundColor: tone.heart }]} />
      {kind === 'orthodox'
        ? <OrthodoxCross s={17} c={tone.glyph} w={1.5} />
        : <Cross s={16} c={tone.glyph} w={1.7} />}
    </Reanimated.View>
  );
}

export default function PrayerBookSwitch({
  value,
  onChange,
  lang,
}: {
  value: PrayerBookMode;
  onChange: (mode: PrayerBookMode) => void;
  /** The prayer book's language — the sentence under the switch follows it,
   *  exactly as the My Rule page under it already does. */
  lang: PrayerLanguage;
}) {
  const reduceMotion = useReducedMotion();
  const orthodox = value === 'orthodox';
  const motion = useSharedValue(orthodox ? 1 : 0);
  const [trackWidth, setTrackWidth] = useState(0);
  const notes = PRAYER_BOOK_SWITCH_NOTES[lang];

  useEffect(() => {
    const target = orthodox ? 1 : 0;
    motion.value = reduceMotion ? target : withSpring(target, SELECT_SPRING);
  }, [motion, orthodox, reduceMotion]);

  // The plaque is exactly one half wide and travels that half plus the gap —
  // measured, so it lands on the seat rather than near it.
  const half = trackWidth > 0 ? (trackWidth - 2 - TRACK_PAD * 2 - TRACK_GAP) / 2 : 0;
  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: motion.value * (half + TRACK_GAP) }],
    // Cool light under the blank page, gold under the received one.
    shadowColor: interpolateColor(motion.value, [0, 1], [MINE_ACCENT, ORTH_ACCENT]),
  }), [half]);

  const mineFaceStyle = useAnimatedStyle(() => ({ opacity: 1 - motion.value }));
  const orthFaceStyle = useAnimatedStyle(() => ({ opacity: motion.value }));

  // The whole control changes temperature with the choice: the recess is cool
  // stone under the blank page and warm parchment under the received one. The
  // plaque alone changing left the track saying the same thing either way.
  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(motion.value, [0, 1], ['#F1F3F7', '#F5F2EC']),
    borderColor: interpolateColor(motion.value, [0, 1], ['#E2E6EC', '#E8E3D9']),
  }));

  const mineInkStyle = useAnimatedStyle(() => ({
    color: interpolateColor(motion.value, [0, 1], [MINE_INK, REST_INK]),
  }));
  const orthInkStyle = useAnimatedStyle(() => ({
    color: interpolateColor(motion.value, [0, 1], [REST_INK, ORTH_INK]),
  }));

  // The ornament under the track, travelling with the plaque rather than
  // flipping under it.
  const markStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(motion.value, [0, 1], [MINE_ACCENT, ORTH_ACCENT]),
  }));

  return (
    <View>
      <Reanimated.View
        style={[s.track, trackStyle]}
        onLayout={event => setTrackWidth(event.nativeEvent.layout.width)}
        accessibilityRole="radiogroup"
      >
        {/* The plaque. Half the track wide, inset by the track's padding, and
            carrying both pages at once — only their opacity differs. */}
        {half > 0 && (
          <Reanimated.View pointerEvents="none" style={[s.pill, { width: half }, pillStyle]}>
            <Reanimated.View style={[StyleSheet.absoluteFill, mineFaceStyle]}>
              <LinearGradient
                colors={['#FFFFFF', MINE_TINT]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={[s.face, { borderColor: MINE_BORDER }]} />
              {/* A blank page: the writing lines are there, the writing is not. */}
              <View style={[s.writingLine, s.writingLineUpper]} />
              <View style={[s.writingLine, s.writingLineLower]} />
            </Reanimated.View>

            <Reanimated.View style={[StyleSheet.absoluteFill, orthFaceStyle]}>
              <LinearGradient
                colors={['#FFFDF6', '#FBF2DC']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={[s.face, { borderColor: ORTH_BORDER }]} />
              {/* The manuscript double rule, closing the page top and bottom. */}
              <View style={[s.doubleRule, s.doubleRuleTop]}>
                <View style={s.ruleHeavy} />
                <View style={s.ruleFine} />
              </View>
              <View style={[s.doubleRule, s.doubleRuleBottom]}>
                <View style={s.ruleFine} />
                <View style={s.ruleHeavy} />
              </View>
            </Reanimated.View>
          </Reanimated.View>
        )}

        <TouchableOpacity
          style={s.half}
          onPress={() => onChange('mine')}
          activeOpacity={0.86}
          haptic="selection"
          accessibilityRole="radio"
          accessibilityState={{ checked: !orthodox }}
          accessibilityLabel="My Rule. Your own prayer, however you pray it."
        >
          <Emblem
            kind="mine"
            tone={{ disc: MINE_DISC, heart: MINE_HEART, glyph: MINE_ACCENT }}
            motion={motion}
            restingAt={0}
          />
          <Reanimated.Text style={[s.label, mineInkStyle]}>MY RULE</Reanimated.Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.half}
          onPress={() => onChange('orthodox')}
          activeOpacity={0.86}
          haptic="selection"
          accessibilityRole="radio"
          accessibilityState={{ checked: orthodox }}
          accessibilityLabel="Orthodox. The received prayers of the Church."
        >
          <Emblem
            kind="orthodox"
            tone={{ disc: ORTH_DISC, heart: ORTH_HEART, glyph: ORTH_ACCENT }}
            motion={motion}
            restingAt={1}
          />
          <Reanimated.Text style={[s.label, orthInkStyle]}>ORTHODOX</Reanimated.Text>
        </TouchableOpacity>
      </Reanimated.View>

      {/* WHAT THE CHOSEN BOOK IS.
       *
       * Not a caption under a control — the only sentence on this screen that
       * explains the choice, and it was set like fine print: 14.5 grey serif
       * behind a bullet. It is the app's own body size now (16/23, the size
       * every ribbon card sets its sentence in), and it is inked in the side's
       * OWN colour, so the line belongs to the book it describes rather than
       * sitting outside both.
       *
       * The mark is the prayer book's own ornament — the struck diamond from
       * the preview card's rule–diamond–rule — not a bullet. A bullet says
       * "list item"; there is no list, there is one statement.
       *
       * ⚠ The diamond's colour travels on the SAME shared value as the plaque
       * instead of flipping on React state, which is what it did before: the
       * plaque sprang over its half-second while the dot changed instantly.
       * The words themselves cross-fade, since they are replaced rather than
       * recoloured. */}
      <View style={s.note}>
        <Reanimated.View style={[s.noteMark, markStyle]} />
        <Reanimated.Text
          key={value}
          entering={FadeIn.duration(240)}
          style={[s.noteText, { color: orthodox ? ORTH_NOTE_INK : MINE_NOTE_INK }]}
        >
          {notes[orthodox ? 'orthodox' : 'mine']}
        </Reanimated.Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  // The track is recessed so the plaque has something to lift off.
  track: {
    position: 'relative',
    flexDirection: 'row',
    gap: TRACK_GAP,
    padding: TRACK_PAD,
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#E8E3D9',
    backgroundColor: '#F5F2EC',
    overflow: 'hidden',
  },
  pill: {
    position: 'absolute',
    left: TRACK_PAD,
    top: TRACK_PAD,
    bottom: TRACK_PAD,
    borderRadius: 16,
    borderCurve: 'continuous',
    overflow: 'hidden',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 12,
    elevation: 3,
  },
  face: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
  },

  // ── My Rule's blank page ────────────────────────────────────────────────
  writingLine: {
    position: 'absolute',
    left: 18,
    right: 18,
    height: 1,
    backgroundColor: mineAlpha(0.14),
  },
  writingLineUpper: { top: 15 },
  writingLineLower: { bottom: 15 },

  // ── The received page's double rule ─────────────────────────────────────
  doubleRule: {
    position: 'absolute',
    left: 14,
    right: 14,
    gap: 2,
  },
  doubleRuleTop: { top: 9 },
  doubleRuleBottom: { bottom: 9 },
  ruleHeavy: { height: 1.4, backgroundColor: ORTH_RULE },
  ruleFine: { height: 0.7, backgroundColor: 'rgba(197,160,89,0.34)' },

  half: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    zIndex: 1,
  },
  label: {
    fontFamily: F.sansBold,
    fontSize: 11,
    letterSpacing: 1.6,
  },

  emblemSeat: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  emblemDisc: { position: 'absolute', width: 28, height: 28, borderRadius: 14 },
  emblemHeart: { position: 'absolute', width: 22, height: 22, borderRadius: 11 },
  // On a light plaque a halo can only be a whitening — the same way the doors'
  // halo seats lift their emblems off cream.
  emblemGlow: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },

  note: {
    marginTop: 13,
    marginLeft: 4,
    marginRight: 2,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  // The prayer book's own ornament, at the size the preview card strikes it.
  // `marginTop` seats it on the first line's optical centre — a diamond level
  // with the cap height reads as hung from the line rather than set on it.
  noteMark: {
    width: 6,
    height: 6,
    borderRadius: 1,
    marginTop: 8.5,
    opacity: 0.85,
    transform: [{ rotate: '45deg' }],
  },
  noteText: {
    flex: 1,
    fontFamily: F.serif,
    // The app's own body size — what every ribbon card sets its sentence in.
    // 14.5 grey was fine print under a control; this is the one sentence that
    // explains the choice.
    fontSize: 16,
    lineHeight: 23,
  },
});
