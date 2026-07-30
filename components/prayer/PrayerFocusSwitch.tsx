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
import Svg, { Circle, Path } from 'react-native-svg';
import { Cross } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import { MINE_ACCENT, MINE_BORDER, MINE_INK, MINE_TINT, mineAlpha } from '@/components/prayer/myRuleTone';

/* ─────────────────────────────────────────────────────────────
 * CROSS or JESUS — what stands in front of you while you pray.
 *
 * WHY THE CHOICE EXISTS. My Rule is written for Christians of every
 * tradition, and a Byzantine icon is not a neutral object: for some
 * traditions it is the natural thing to pray in front of, and for others
 * praying before an image is precisely what they do not do. Putting the
 * icon on the screen and calling it universal would have contradicted
 * the sentence this whole feature is built on.
 *
 * ⚠ SO NEITHER SIDE IS THE LESSER ONE, AND THE NAMES CARRY THAT. They
 * are two things — CROSS and JESUS — not a plain option and a rich one.
 * Nothing here says "simple", "basic" or "no image", because every one
 * of those describes the cross by what it lacks. The cross is the ground
 * every tradition shares and it is the default; the icon is an offer.
 *
 * ⚠ AND THE SECOND NAME IS JESUS, NOT "ICON". "Icon" names the MEDIUM, a
 * painted board — the one word most likely to give a Protestant reader
 * pause, and it describes the object rather than who is on it. Both
 * sides of this switch are Christ: one is His cross, one is His face.
 * Naming Him says so, and it stops the choice reading as a choice
 * between traditions, which is the one thing it must never look like.
 *
 * THE GRAMMAR IS THE APP'S OWN two-kinds plaque — the one Set as Task
 * and the Prayer Book switch are struck from, down to the recessed
 * track, the emblem's 32 / 28 / 22 proportions and the one selection
 * spring. A choice this consequential should not arrive in a control the
 * user has never met.
 *
 * ⚠ IT IS DRAWN SMALLER THAN ITS SIBLINGS, AND AS ONE PIECE. This plaque
 * stands directly above the object the whole screen is for, and at the
 * shared 52-point band it took the height of a section card. So the band
 * is 44 and the emblem, the discs, the halo, the glyphs and both radii
 * are scaled with it — a band shortened without its contents is not a
 * smaller plaque, it is a squashed one.
 *
 * And as in every one of those, THE PLAQUE CHANGES INTO THE THING IT IS
 * SELECTING — but by TEMPERATURE, not by ornament: cool stone on the
 * left, warm parchment on the right. Both faces live on the plaque at
 * once and cross-fade on the very value that drives the slide, so pill,
 * faces, emblems and ink all move on the UI thread and no React state
 * moves while it is moving.
 *
 * ⚠ THE JESUS FACE ONCE DREW A GILT BAND AROUND A CUT FIELD — a
 * miniature of a framed board. The icon it selects has no frame any
 * more; it stands unframed in the lamp and fades into the page at its
 * edges. A plaque drawing a frame would promise an object the screen
 * does not contain.
 *
 * ⚠ BOTH FACES ARE MADE OF THE APP'S PLATE MATERIAL, not of flat tint.
 * Each runs three stops on the diagonal from near-white at the shoulder
 * to real colour at the foot, carries a pane of light and a lit hairline
 * along its top edge. A two-stop wash ending in white was the flattest
 * surface on a screen full of modelled ones, and it fell away into the
 * track instead of lifting off it.
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
 * The Jesus side's emblem: the cruciform halo.
 *
 * The nimbus with a cross inscribed in it is the one mark Christian art
 * puts on Christ and on no one else — every other saint's halo is plain
 * — and it is the mark carried by the icon this side opens, painted
 * around His head in the sixth century.
 *
 * ⚠ IT REPLACED A MINIATURE OF THE BOARD, which was the wrong idea twice
 * over: at seventeen points a tiny panel outline is unreadable, and it
 * named the MEDIUM rather than the person, which is exactly what
 * renaming this side away from "Icon" was meant to stop.
 *
 * ⚠ AND IT IS NOT A SECOND CROSS, despite carrying one. The silhouette
 * decides that: the other side is a bare figure with four arms, this one
 * is a RING. They read apart instantly at any size, and the pair is
 * better for the rhyme — His cross on one side, His face's halo on the
 * other, the same cross inside a circle of glory.
 */
function CruciformHalo({ tone }: { tone: string }) {
  const box = 16;
  const c = box / 2;
  const r = c - 1.1;
  // The bars stop just inside the ring rather than crossing it: a cross
  // drawn over the circle reads as two symbols laid on each other, and
  // one drawn inside it reads as one.
  const arm = r - 0.6;

  return (
    <Svg width={box} height={box}>
      <Circle cx={c} cy={c} r={r} stroke={tone} strokeWidth={1.5} fill="none" />
      <Path
        d={`M${c} ${c - arm}L${c} ${c + arm}M${c - arm} ${c}L${c + arm} ${c}`}
        stroke={tone}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
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
        ? <CruciformHalo tone={tone.glyph} />
        : <Cross s={15} c={tone.glyph} w={1.7} />}
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
            {/* ⚠ THREE STOPS, NOT TWO, AND IT DOES NOT END IN WHITE. The
                face was #FFFFFF into a pale tint — the flattest surface
                on a screen full of modelled ones, and it fell away into
                the track rather than lifting off it. This is the app's
                own plate material: near-white at the shoulder, real
                colour at the foot, so the plaque has a near edge and a
                far one. */}
            <LinearGradient
              colors={['#FFFFFF', MINE_TINT, '#DCE7F3']}
              locations={[0, 0.48, 1]}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            {/* The pane of light on the shoulder, reaching nothing well
                before any edge — a fade that stops mid-plaque rules a
                line across it as cleanly as if one had been drawn. */}
            <LinearGradient
              colors={['rgba(255,255,255,0.6)', 'rgba(255,255,255,0)']}
              locations={[0, 0.55]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={[s.face, { borderColor: MINE_BORDER }]} />
            <View style={s.faceLit} />
          </Reanimated.View>

          <Reanimated.View style={[StyleSheet.absoluteFill, iconFaceStyle]}>
            {/* ⚠ NO GILT BAND, NO FIELD CUT INTO IT. This face was built as
                a miniature of a framed board, and the icon it selects no
                longer has a frame — it stands unframed in the lamp and
                fades into the page at its edges. A plaque that draws a
                frame would be promising an object the screen does not
                contain.

                What carries the side now is TEMPERATURE, which is all it
                ever needed: cool stone on the left, warm parchment here,
                struck from exactly the same material as its opposite so
                neither reads as the decorated one. */}
            <LinearGradient
              colors={['#FFFFFF', '#FBF3E0', '#F3E6CB']}
              locations={[0, 0.48, 1]}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={['rgba(255,255,255,0.6)', 'rgba(255,255,255,0)']}
              locations={[0, 0.55]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={[s.face, { borderColor: ICON_BORDER }]} />
            <View style={s.faceLit} />
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
        <Reanimated.Text style={[s.label, crossInkStyle]}>Cross</Reanimated.Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={s.half}
        onPress={() => onChange('icon')}
        activeOpacity={0.86}
        haptic="selection"
        accessibilityRole="radio"
        accessibilityState={{ checked: icon }}
        accessibilityLabel="Jesus. Pray in front of the sixth-century icon of Christ."
      >
        <Emblem
          kind="icon"
          tone={{ disc: ICON_DISC, heart: ICON_HEART, glyph: ICON_ACCENT }}
          motion={motion}
          restingAt={1}
        />
        <Reanimated.Text style={[s.label, iconInkStyle]}>Jesus</Reanimated.Text>
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
    borderRadius: 17,
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
    borderRadius: 13,
    borderCurve: 'continuous',
    overflow: 'hidden',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 12,
    elevation: 3,
  },
  face: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 13,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  // The hairline of light every lifted plate in this app catches along its
  // top edge. Both faces wear it, so the plaque keeps it through the slide.
  faceLit: {
    position: 'absolute',
    top: 1,
    left: 12,
    right: 12,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },

  /**
   * ⚠ 44, DOWN FROM 52, AND EVERY OTHER FIGURE HERE FOLLOWS IT.
   *
   * The plaque is a control standing above the one thing this screen is
   * for, and at 52 it took the height of a section card. Narrowing it is
   * not only a smaller number: a 32pt emblem in a 44pt band leaves six
   * points of air top and bottom, which reads as crammed, so the emblem,
   * the discs, the halo and both radii are all drawn down with it. A band
   * shortened without its contents is a squashed band.
   */
  half: {
    flex: 1,
    minHeight: 44,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    zIndex: 1,
  },
  /**
   * ⚠ THE SERIF, IN SENTENCE CASE — not tracked sans capitals.
   *
   * CROSS and JESUS were set the way this app sets a LABEL, and these are
   * not labels: MORNING and MEALS name a category, while these two name
   * the cross of Christ and Christ Himself. Capitals shout them, and a
   * name shouted at 11 points beside an emblem is the one register this
   * screen has no room for.
   *
   * The tracking goes with the capitals. Letter-spacing is what makes a
   * short word in caps legible; in a serif at reading size it only pulls
   * the word apart.
   */
  label: {
    fontFamily: F.serifMedium,
    fontSize: 16.5,
    lineHeight: 21,
  },

  // The same 32 / 28 / 22 pattern the app's other plaques are struck to,
  // scaled as one so the proportions survive the narrower band.
  emblemSeat: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  emblemDisc: { position: 'absolute', width: 23, height: 23, borderRadius: 11.5 },
  emblemHeart: { position: 'absolute', width: 18, height: 18, borderRadius: 9 },
  emblemGlow: {
    position: 'absolute',
    width: 33,
    height: 33,
    borderRadius: 16.5,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },

});
