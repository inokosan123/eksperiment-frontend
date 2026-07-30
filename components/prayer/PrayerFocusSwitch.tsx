import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Reanimated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Cross } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import { MINE_ACCENT, MINE_BORDER, MINE_INK, MINE_TINT, mineAlpha } from '@/components/prayer/myRuleTone';

/* ─────────────────────────────────────────────────────────────
 * CROSS or ICON — what stands in front of you while you pray.
 *
 * WHY THE CHOICE EXISTS. My Rule is written for Christians of every
 * tradition, and a Byzantine icon is not a neutral object: for some
 * traditions it is the natural thing to pray in front of, and for others
 * praying before an image is precisely what they do not do. Putting the
 * icon on the screen and calling it universal would have contradicted
 * the sentence this whole feature is built on.
 *
 * ⚠ SO NEITHER SIDE IS THE LESSER ONE, AND THE NAMES CARRY THAT. They
 * are two objects — CROSS and ICON — not a plain option and a rich one.
 * Nothing here says "simple", "basic" or "no image", because every one
 * of those describes the cross by what it lacks. The cross is the ground
 * every tradition shares and it is the default; the icon is an offer.
 *
 * THE GRAMMAR IS THE APP'S OWN two-kinds plaque — the one Set as Task
 * and the Prayer Book switch are struck from, down to the same recessed
 * track, the same 32/28/22 emblem and the same selection spring. A
 * choice this consequential should not arrive in a control the user has
 * never met.
 *
 * And as in every one of those, THE PLAQUE CHANGES INTO THE THING IT IS
 * SELECTING: sitting left it is bare cool paper, sliding right it
 * becomes the gilded board with its field cut into it. Both faces live
 * on the plaque at once and cross-fade on the very value that drives the
 * slide, so pill, faces, emblems and ink all move on the UI thread and
 * no React state moves while the switch is moving.
 * ───────────────────────────────────────────────────────────── */

export type PrayerFocus = 'cross' | 'icon';

const ICON_ACCENT = C.gold;
const ICON_INK = C.goldDark;
const ICON_BORDER = 'rgba(197,160,89,0.46)';
const ICON_DISC = 'rgba(197,160,89,0.2)';
const ICON_HEART = 'rgba(197,160,89,0.1)';

const CROSS_DISC = mineAlpha(0.18);
const CROSS_HEART = mineAlpha(0.09);

const REST_INK = '#A8A29E';

const TRACK_PAD = 4;
const TRACK_GAP = 4;

/** The app's one selection spring. */
const SELECT_SPRING = { damping: 18, stiffness: 235, mass: 0.72 };

/**
 * The icon side's emblem: the board itself, in miniature.
 *
 * ⚠ NOT a second cross, and not the Orthodox cross. This side is not
 * "the Orthodox option" — it is the oldest surviving image of Christ,
 * offered to anyone — so its mark is the OBJECT: a panel with its field
 * cut into it and a haloed figure standing in it. Marking it with a
 * cross of any kind would have made the switch read as two crosses, and
 * the one difference that matters would have gone missing.
 */
function BoardGlyph({ tone }: { tone: string }) {
  return (
    <View style={[s.board, { borderColor: tone }]}>
      <View style={[s.boardField, { borderColor: tone }]}>
        <View style={[s.boardHalo, { backgroundColor: tone }]} />
      </View>
    </View>
  );
}

/**
 * The emblem, to the switch's own pattern: a 32 seat, a 28 disc, a 22
 * heart and the mark over both. Resting it is still itself, only dimmer;
 * chosen, it throws a halo onto the plaque.
 */
function Emblem({
  kind,
  tone,
  motion,
  restingAt,
}: {
  kind: PrayerFocus;
  tone: { disc: string; heart: string; glyph: string };
  motion: SharedValue<number>;
  /** The motion value at which this emblem is the chosen one. */
  restingAt: 0 | 1;
}) {
  const seatStyle = useAnimatedStyle(() => {
    const on = restingAt === 0 ? 1 - motion.value : motion.value;
    return { opacity: 0.55 + on * 0.45 };
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
      {kind === 'icon'
        ? <BoardGlyph tone={tone.glyph} />
        : <Cross s={17} c={tone.glyph} w={1.7} />}
    </Reanimated.View>
  );
}

export default function PrayerFocusSwitch({
  value,
  onChange,
}: {
  value: PrayerFocus;
  onChange: (focus: PrayerFocus) => void;
}) {
  const reduceMotion = useReducedMotion();
  const icon = value === 'icon';
  const motion = useSharedValue(icon ? 1 : 0);
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    const target = icon ? 1 : 0;
    motion.value = reduceMotion ? target : withSpring(target, SELECT_SPRING);
  }, [motion, icon, reduceMotion]);

  // The plaque is exactly one half wide and travels that half plus the
  // gap — measured, so it lands on the seat rather than near it.
  const half = trackWidth > 0 ? (trackWidth - 2 - TRACK_PAD * 2 - TRACK_GAP) / 2 : 0;
  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: motion.value * (half + TRACK_GAP) }],
    shadowColor: interpolateColor(motion.value, [0, 1], [MINE_ACCENT, ICON_ACCENT]),
  }), [half]);

  const crossFaceStyle = useAnimatedStyle(() => ({ opacity: 1 - motion.value }));
  const iconFaceStyle = useAnimatedStyle(() => ({ opacity: motion.value }));

  // The whole control changes temperature with the choice: cool stone
  // under the bare side, warm parchment under the gilded one.
  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(motion.value, [0, 1], ['#F1F3F7', '#F5F2EC']),
    borderColor: interpolateColor(motion.value, [0, 1], ['#E2E6EC', '#E8E3D9']),
  }));

  const crossInkStyle = useAnimatedStyle(() => ({
    color: interpolateColor(motion.value, [0, 1], [MINE_INK, REST_INK]),
  }));
  const iconInkStyle = useAnimatedStyle(() => ({
    color: interpolateColor(motion.value, [0, 1], [REST_INK, ICON_INK]),
  }));

  return (
    <Reanimated.View
      style={[s.track, trackStyle]}
      onLayout={event => setTrackWidth(event.nativeEvent.layout.width)}
      accessibilityRole="radiogroup"
    >
      {half > 0 && (
        <Reanimated.View pointerEvents="none" style={[s.pill, { width: half }, pillStyle]}>
          <Reanimated.View style={[StyleSheet.absoluteFill, crossFaceStyle]}>
            <LinearGradient
              colors={['#FFFFFF', MINE_TINT]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={[s.face, { borderColor: MINE_BORDER }]} />
          </Reanimated.View>

          <Reanimated.View style={[StyleSheet.absoluteFill, iconFaceStyle]}>
            {/* The board's own gold, the same three stops the panel on the
                screen is gilded with, so the plaque is a miniature of the
                thing it selects rather than a gold rectangle. */}
            <LinearGradient
              colors={['#F0DDAF', '#DCBE85', '#C4A164']}
              locations={[0, 0.55, 1]}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={[s.face, { borderColor: ICON_BORDER }]} />
            {/* The kovcheg: the field cut into the board, which is what
                makes a panel a panel rather than a picture in a frame. */}
            <View style={s.plaqueField} />
          </Reanimated.View>
        </Reanimated.View>
      )}

      <TouchableOpacity
        style={s.half}
        onPress={() => onChange('cross')}
        activeOpacity={0.86}
        haptic="selection"
        accessibilityRole="radio"
        accessibilityState={{ checked: !icon }}
        accessibilityLabel="Cross. Pray in front of a plain cross."
      >
        <Emblem
          kind="cross"
          tone={{ disc: CROSS_DISC, heart: CROSS_HEART, glyph: MINE_ACCENT }}
          motion={motion}
          restingAt={0}
        />
        <Reanimated.Text style={[s.label, crossInkStyle]}>CROSS</Reanimated.Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={s.half}
        onPress={() => onChange('icon')}
        activeOpacity={0.86}
        haptic="selection"
        accessibilityRole="radio"
        accessibilityState={{ checked: icon }}
        accessibilityLabel="Icon. Pray in front of the sixth-century icon of Christ."
      >
        <Emblem
          kind="icon"
          tone={{ disc: ICON_DISC, heart: ICON_HEART, glyph: ICON_ACCENT }}
          motion={motion}
          restingAt={1}
        />
        <Reanimated.Text style={[s.label, iconInkStyle]}>ICON</Reanimated.Text>
      </TouchableOpacity>
    </Reanimated.View>
  );
}

const s = StyleSheet.create({
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
  plaqueField: {
    position: 'absolute',
    top: 6,
    left: 8,
    right: 8,
    bottom: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(120,88,30,0.22)',
  },

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
  emblemGlow: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },

  // The board, at emblem scale: 84 by 45.5 is the real panel's ratio, and
  // 17 by 9 is as near as it comes at this size.
  board: {
    width: 11,
    height: 19,
    borderRadius: 2.5,
    borderWidth: 1,
    alignItems: 'center',
    paddingTop: 2.5,
  },
  boardField: {
    width: 7,
    height: 13,
    borderRadius: 1.5,
    borderWidth: 0.5,
    opacity: 0.6,
    alignItems: 'center',
    paddingTop: 1.5,
  },
  boardHalo: { width: 4, height: 4, borderRadius: 2 },
});
