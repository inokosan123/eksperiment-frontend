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
 * and the Prayer Book switch are struck from, down to the same recessed
 * track, the same 32/28/22 emblem and the same selection spring. A
 * choice this consequential should not arrive in a control the user has
 * never met.
 *
 * And as in every one of those, THE PLAQUE CHANGES INTO THE THING IT IS
 * SELECTING: sitting left it is cool stone lit from the shoulder,
 * sliding right it becomes the icon board — a gilt band around a pale
 * field. Both faces live on the plaque at once and cross-fade on the
 * very value that drives the slide, so pill, faces, emblems and ink all
 * move on the UI thread and no React state moves while it is moving.
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
  const box = 18;
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
            {/* ⚠ IT IS A GILT BAND AROUND A PALE FIELD, NOT A GOLD SLAB.
                Two reasons, and the second is the one that decided it.

                It is what the object actually is: an icon board is a
                raised gold border with the painted field cut down inside
                it — the kovcheg — so a solid gold rectangle is a less
                accurate miniature of the panel than this is, not a more
                striking one.

                And a full gold plaque put dark-gold letters and a gold
                emblem on a gold ground, which is the exact fault this app
                has had to fix twice already. On the pale field the ink has
                something to be gold against. */}
            <LinearGradient
              colors={['#F1DEB2', '#DDBF86', '#C09C5E']}
              locations={[0, 0.55, 1]}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={s.plaqueField}>
              <LinearGradient
                colors={['#FFFDF6', '#FBF4E2', '#F6EBD2']}
                locations={[0, 0.5, 1]}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              {/* The step down into the field: a hairline of shadow at its
                  head, a hairline of light at its foot. Without those two
                  the band is a coloured margin rather than a raised edge,
                  and this stops being a board. */}
              <View style={s.fieldStepTop} />
              <View style={s.fieldStepFoot} />
            </View>
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
        <Reanimated.Text style={[s.label, crossInkStyle]}>CROSS</Reanimated.Text>
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
        <Reanimated.Text style={[s.label, iconInkStyle]}>JESUS</Reanimated.Text>
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
  // The gilt band's width, and therefore the field's inset. 5 against a
  // 52-high plaque is the panel's own proportion, near enough.
  plaqueField: {
    position: 'absolute',
    top: 5,
    left: 5,
    right: 5,
    bottom: 5,
    borderRadius: 11,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  fieldStepTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(92,68,24,0.26)',
  },
  fieldStepFoot: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,250,235,0.5)',
  },
  // The hairline of light every lifted plate in this app catches along its
  // top edge. Both faces wear it, so the plaque keeps it through the slide.
  faceLit: {
    position: 'absolute',
    top: 1,
    left: 14,
    right: 14,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.9)',
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

});
