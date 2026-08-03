import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';
import { Lock } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { F } from '@/constants/tokens';
import { withAlpha } from './GroupSeal';
import type { FocusRuleMode } from './focusLimitBudget';

// Limit or Blocked, struck the way this app strikes a two-way choice.
//
// The grammar comes from Set as Task (Spiritual / Challenge) and is used
// wherever two different KINDS of thing are chosen: a recessed track, a raised
// plaque, and — the part worth carrying — the plaque does not merely travel, it
// CHANGES INTO the thing it is selecting. Sitting left it is a lit rule card:
// the group's own colour on warm cream. Sliding right it becomes a closed one:
// rose parchment under rose ink. Both faces cross-fade on the very value that
// drives the slide, so one gesture carries the whole change — and each carries
// its rail on the edge it is docked against, so the mark mirrors as it travels.
//
// Everything — pill, faces, emblems, ink — reads from a single shared value on
// the UI thread. No React state moves while the switch is moving.

const ROSE = '#A24351';
const ROSE_BORDER = '#E7C4CB';
const ROSE_INK = '#8F3443';

const TRACK_PAD = 4;
const TRACK_GAP = 4;

// The app's one selection spring. Same figures as Set as Task and the task
// frequency seats, so every choice in Anasta settles with the same weight.
const SELECT_SPRING = { damping: 18, stiffness: 235, mass: 0.72 };

// ── The emblems ────────────────────────────────────────────────────────────
// These were two line icons from the same set — a clock and a padlock, each on
// a tinted disc — so the two sides read as "two options" rather than as two
// different KINDS of rule. They are two different instruments now, and each is
// the one this app already uses for that idea:
//
//   Limit   = a dial with a filled arc. The allowance ring the group seal and
//             the capacity seal wear, at emblem scale.
//   Blocked = a beaded wax seal, the mark every standing boundary in Focus
//             carries (Essentials, Always Blocked).
//
// ⚠️ The seal is re-struck here rather than imported from `EssentialsEmblem`.
// `LockSeal` lays its bead crown on a field twice its `size`, so at a legible
// glyph it needs a box half again as wide as this one — its beads scattered
// across the track and collided with the label. This keeps its grammar (halo
// disc, twelve beads with the cardinals heavier, lock over both) and only
// re-proportions it to a 26 field.
const EMBLEM = 26;
const EMBLEM_DISC = 23;
const SEAL_ROSE = '#E14B5A';
const SEAL_ROSE_DEEP = '#A63A4B';

function BlockedSeal() {
  const c = EMBLEM / 2;
  const discRadius = 9;
  const beadRadius = 11.4;
  return (
    <>
      <Svg width={EMBLEM} height={EMBLEM} style={StyleSheet.absoluteFill}>
        <Circle
          cx={c}
          cy={c}
          r={discRadius}
          fill="rgba(225,75,90,0.13)"
          stroke="rgba(198,90,103,0.36)"
          strokeWidth={StyleSheet.hairlineWidth}
        />
        {Array.from({ length: 12 }).map((_, index) => {
          const angle = (index / 12) * Math.PI * 2 - Math.PI / 2;
          const cardinal = index % 3 === 0;
          return (
            <Circle
              key={index}
              cx={c + beadRadius * Math.cos(angle)}
              cy={c + beadRadius * Math.sin(angle)}
              r={cardinal ? 1.15 : 0.8}
              fill={SEAL_ROSE}
              fillOpacity={cardinal ? 0.5 : 0.3}
            />
          );
        })}
      </Svg>
      <Lock s={11.5} c={SEAL_ROSE_DEEP} w={2} />
    </>
  );
}

function LimitDial({ accent }: { accent: string }) {
  const r = (EMBLEM_DISC - 2.2) / 2;
  const c = EMBLEM / 2;
  const circumference = 2 * Math.PI * r;
  return (
    <Svg width={EMBLEM} height={EMBLEM}>
      <Circle cx={c} cy={c} r={r} fill="none" stroke={accent} strokeOpacity={0.22} strokeWidth={2.2} />
      {/* Two thirds struck: an allowance is a portion of the day, and the arc
          says so before the word does. */}
      <Circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke={accent}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeDasharray={`${circumference * 0.66} ${circumference}`}
        transform={`rotate(-90 ${c} ${c})`}
      />
      <Circle cx={c} cy={c} r={r - 3.4} fill={withAlpha(accent, 0.12)} />
      <Path d={`M${c} ${c - 4.2}V${c}l2.8 1.7`} stroke={accent} strokeWidth={1.9} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

function Emblem({
  kind,
  accent,
  motion,
  restingAt,
}: {
  kind: 'limit' | 'blocked';
  accent: string;
  motion: SharedValue<number>;
  /** The motion value at which this emblem is the chosen one. */
  restingAt: 0 | 1;
}) {
  const seatStyle = useAnimatedStyle(() => {
    const on = restingAt === 0 ? 1 - motion.value : motion.value;
    return {
      // Resting it stays itself, only quieter — greying it would throw away the
      // only thing worth showing.
      opacity: 0.5 + on * 0.5,
      transform: [{ scale: 0.96 + on * 0.04 }],
    };
  });

  return (
    <Animated.View style={[s.emblemSeat, seatStyle]}>
      {kind === 'blocked' ? <BlockedSeal /> : <LimitDial accent={accent} />}
    </Animated.View>
  );
}

export default function FocusRuleSwitch({
  value,
  accent,
  tintBg,
  onChange,
}: {
  value: FocusRuleMode;
  /** The group's own colour — the open plaque is struck in it. */
  accent: string;
  /** The group's card tint, so the plaque is that group's card in miniature. */
  tintBg: string;
  onChange: (mode: FocusRuleMode) => void;
}) {
  const reduceMotion = useReducedMotion();
  const blocked = value === 'blocked';
  const motion = useSharedValue(blocked ? 1 : 0);
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    const target = blocked ? 1 : 0;
    motion.value = reduceMotion ? target : withSpring(target, SELECT_SPRING);
  }, [blocked, motion, reduceMotion]);

  // The plaque is exactly one half wide and travels that half plus the gap —
  // measured, so it lands on the seat rather than near it.
  const half = trackWidth > 0 ? (trackWidth - 2 - TRACK_PAD * 2 - TRACK_GAP) / 2 : 0;
  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: motion.value * (half + TRACK_GAP) }],
    // Gold light under the open plaque, rose under the closed one.
    shadowColor: interpolateColor(motion.value, [0, 1], [accent, ROSE]),
  }), [accent, half]);

  const openFaceStyle = useAnimatedStyle(() => ({ opacity: 1 - motion.value }));
  const closedFaceStyle = useAnimatedStyle(() => ({ opacity: motion.value }));

  const limitInkStyle = useAnimatedStyle(() => ({
    color: interpolateColor(motion.value, [0, 1], [accent, '#A8A29E']),
  }), [accent]);
  const blockedInkStyle = useAnimatedStyle(() => ({
    color: interpolateColor(motion.value, [0, 1], ['#A8A29E', ROSE_INK]),
  }));

  return (
    <View>
      <View
        style={s.track}
        onLayout={event => setTrackWidth(event.nativeEvent.layout.width)}
        accessibilityRole="radiogroup"
      >
        {/* The plaque. Half the track wide, inset by the track's padding, and
            carrying both faces at once — only their opacity differs. */}
        {half > 0 && (
        <Animated.View pointerEvents="none" style={[s.pill, { width: half }, pillStyle]}>
          <Animated.View style={[StyleSheet.absoluteFill, openFaceStyle]}>
            <LinearGradient
              colors={['#FFFEFB', tintBg]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={[s.face, { borderColor: withAlpha(accent, 0.38) }]} />
            {/* The rail rides the plaque's OUTER edge — the side it is docked
                against. Sitting left, that is the left. */}
            <View style={[s.railLeft, { backgroundColor: accent }]} />
          </Animated.View>

          <Animated.View style={[StyleSheet.absoluteFill, closedFaceStyle]}>
            <LinearGradient
              colors={['#FFF8F9', '#FBE9EC']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={[s.face, { borderColor: ROSE_BORDER }]} />
            {/* ⚠️ ONE rail, and on the RIGHT — the closed plaque is docked
                against the track's right end, so that is its outer edge. The
                mark mirrors as the plaque travels, which reads as the plaque
                being seated at that end rather than as two different objects.
                This face used to carry rails on BOTH edges to mean "shut on
                both sides", but the two faces never appear together (the plaque
                slides and crossfades between them), so that could never be read
                as meaning — only as an inconsistency noticed across two
                moments. Rails down both edges are also this app's signature for
                a LIVING challenge card, which is the opposite of a block. */}
            <View style={[s.railRight, { backgroundColor: ROSE }]} />
          </Animated.View>
        </Animated.View>
        )}

        <TouchableOpacity
          style={s.half}
          onPress={() => onChange('limit')}
          activeOpacity={0.86}
          haptic="selection"
          accessibilityRole="radio"
          accessibilityState={{ checked: !blocked }}
          accessibilityLabel="Limit. An allowance, then the shield."
        >
          <Emblem kind="limit" accent={accent} motion={motion} restingAt={0} />
          <Animated.Text style={[s.label, limitInkStyle]}>Limit</Animated.Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.half}
          onPress={() => onChange('blocked')}
          activeOpacity={0.86}
          haptic="selection"
          accessibilityRole="radio"
          accessibilityState={{ checked: blocked }}
          accessibilityLabel="Blocked. Shut for the whole day."
        >
          <Emblem kind="blocked" accent={accent} motion={motion} restingAt={1} />
          <Animated.Text style={[s.label, blockedInkStyle]}>Blocked</Animated.Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// The compact member of this family, measured off `PrayerFocusSwitch`: a 44
// seat and a 26 emblem rather than 52 and 32. This switch is one setting near
// the top of a long scroll, not the subject of its own screen — and with the
// head above now stating the rule in words, the sentence that used to sit under
// the track was the third telling of the same thing.
const PILL_RADIUS = 13;

const s = StyleSheet.create({
  // The track is recessed so the plaque has something to lift off.
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
    borderRadius: PILL_RADIUS,
    borderCurve: 'continuous',
    overflow: 'hidden',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
  },
  face: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: PILL_RADIUS,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  // Mirrored, so each face carries its mark on the edge it is docked against.
  railLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3.5,
    borderTopLeftRadius: PILL_RADIUS,
    borderBottomLeftRadius: PILL_RADIUS,
  },
  railRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 3.5,
    borderTopRightRadius: PILL_RADIUS,
    borderBottomRightRadius: PILL_RADIUS,
  },
  half: {
    flex: 1,
    minHeight: 44,
    borderRadius: PILL_RADIUS,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    zIndex: 1,
  },
  // Serif, to sit with the serif title above rather than as a system label
  // bolted under it.
  label: { fontFamily: F.serifSemiBold, fontSize: 16.5, lineHeight: 20 },

  emblemSeat: { width: EMBLEM, height: EMBLEM, alignItems: 'center', justifyContent: 'center' },
});
