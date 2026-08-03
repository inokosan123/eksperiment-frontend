import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import type { Strength } from './dayPlanStore';

// Loose or Strict, struck the way this app strikes a two-way choice.
//
// It was a pair of full-width seats with radio rings — the same control the
// five return practices below it wear. Two different KINDS of decision were
// therefore dressed identically, and the section read as seven interchangeable
// rows. This is a choice between two kinds, so it takes the app's two-kinds
// grammar: a recessed track, and a plaque that changes into the thing it
// selects, exactly as Limit/Blocked does one section above.
//
// ⚠️ The seat list was originally chosen here for a good reason — its own note
// says a track "is wrong when the two answers need a sentence to tell apart",
// and these two do. So the sentence is KEPT: one line under the track, showing
// what the chosen side brings, crossfading as the plaque travels. The sentence
// was never the reason to use seats; showing five of them at once was.
//
// The emblems are one door in two states: Strict is shut, Loose is ajar. Not
// two different objects — the same door, which is exactly what the setting
// decides. A padlock and an open gate were tried and are wrong here: the lock
// already belongs to Blocked one section above, and this choice is not about
// whether there IS a door.
//
// ⚠️ Drawn FLAT — frame plus leaf — because perspective turns to mush at 22pt.
// The leaf swung out past the jamb is what makes "ajar" legible at this size;
// a sliver of light inside the frame reads as a panelled door, and a gable
// reads as a house. Both were rendered and discarded.

const LOOSE = '#9A7526';
const LOOSE_INK = '#7C5D1C';
const ROSE = '#A24351';
const ROSE_INK = '#8F3443';

const TRACK_PAD = 3;
const PILL_RADIUS = 11;
const EMBLEM = 22;

// The app's one selection spring, the same figures every choice settles with.
const SELECT_SPRING = { damping: 18, stiffness: 235, mass: 0.72 };

/**
 * The threshold, in one of its two states. Exported so anywhere that has to
 * SHOW a strength — rather than set one — says it with the same object the
 * switch is struck from.
 */
export function Door({ shut, size = EMBLEM }: { shut: boolean; size?: number }) {
  const ink = shut ? ROSE : LOOSE;
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
      {shut ? (
        <>
          {/* The leaf fills its frame. */}
          <Path
            d="M4.5 3.2h13v15.6h-13z"
            fill={ink}
            fillOpacity={0.13}
            stroke={ink}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
          <Circle cx={14.6} cy={11} r={0.9} fill={ink} />
        </>
      ) : (
        <>
          {/* The frame, standing open… */}
          <Path d="M4.5 3.2h13v15.6h-13z" stroke={ink} strokeWidth={1.5} strokeLinejoin="round" />
          {/* …and the leaf swung out of it. */}
          <Path
            d="M11.6 4.6l4.2-1.1v15l-4.2 1.1z"
            fill={ink}
            fillOpacity={0.16}
            stroke={ink}
            strokeWidth={1.4}
            strokeLinejoin="round"
          />
          <Circle cx={12.9} cy={11} r={0.85} fill={ink} />
        </>
      )}
    </Svg>
  );
}

function Emblem({
  shut,
  motion,
  restingAt,
}: {
  shut: boolean;
  motion: SharedValue<number>;
  restingAt: 0 | 1;
}) {
  const style = useAnimatedStyle(() => {
    const on = restingAt === 0 ? 1 - motion.value : motion.value;
    return {
      opacity: 0.5 + on * 0.5,
      transform: [{ scale: 0.96 + on * 0.04 }],
    };
  });

  return (
    <Animated.View style={[s.emblemSeat, style]}>
      <Door shut={shut} />
    </Animated.View>
  );
}

/**
 * The consequence, written as a run of pieces so the words it turns on can be
 * struck inside the sentence rather than left to be found in it. A `struck`
 * piece is set in the answer's own ink; a plain string is body copy.
 *
 * Two of them, not one: the duration is what you GET and the practice is what
 * it COSTS, and those are the two things the answer is actually about.
 */
export type OutcomeCopy = (string | { struck: string })[];

/** The pieces read back as one sentence, for a screen reader. */
const spoken = (copy: OutcomeCopy) =>
  copy.map(piece => (typeof piece === 'string' ? piece : piece.struck)).join('');

export default function FocusStrengthSwitch({
  value,
  looseDetail,
  strictDetail,
  onChange,
}: {
  value: Strength;
  /** What Loose brings. Differs under a limit and under a block. */
  looseDetail: OutcomeCopy;
  strictDetail: OutcomeCopy;
  onChange: (next: Strength) => void;
}) {
  const reduceMotion = useReducedMotion();
  const strict = value === 'strict';
  const motion = useSharedValue(strict ? 1 : 0);
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    const target = strict ? 1 : 0;
    motion.value = reduceMotion ? target : withSpring(target, SELECT_SPRING);
  }, [motion, reduceMotion, strict]);

  // The plaque is exactly one half wide and travels that half plus the gap.
  const half = trackWidth > 0 ? (trackWidth - 2 - TRACK_PAD * 2) / 2 : 0;
  const copy = strict ? strictDetail : looseDetail;

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: motion.value * half }],
    borderColor: interpolateColor(motion.value, [0, 1], [`${LOOSE}6B`, `${ROSE}6B`]),
    backgroundColor: interpolateColor(motion.value, [0, 1], [`${LOOSE}1A`, `${ROSE}1A`]),
  }), [half]);
  const looseInkStyle = useAnimatedStyle(() => ({
    color: interpolateColor(motion.value, [0, 1], [LOOSE_INK, '#A8A29E']),
  }));
  const strictInkStyle = useAnimatedStyle(() => ({
    color: interpolateColor(motion.value, [0, 1], ['#A8A29E', ROSE_INK]),
  }));

  return (
    <View>
      <View
        style={s.track}
        onLayout={event => setTrackWidth(event.nativeEvent.layout.width)}
        accessibilityRole="radiogroup"
      >
        {/* The chosen side is a seat CUT INTO the plate, not a plaque laid on
            top of it: an inner shadow along the top edge and a lit lip along
            the bottom, which is the reverse of the raised plaque above. Limit
            and Blocked is the sheet's main choice and must stay the strongest
            thing on it; this one is a refinement of the rule already chosen, so
            it recedes instead of competing. */}
        {half > 0 && (
          <Animated.View pointerEvents="none" style={[s.well, { width: half }, pillStyle]} />
        )}

        <TouchableOpacity
          style={s.half}
          onPress={() => onChange('loose')}
          activeOpacity={0.86}
          haptic="selection"
          accessibilityRole="radio"
          accessibilityState={{ checked: !strict }}
          accessibilityLabel={`Loose. ${spoken(looseDetail)}`}
        >
          <Emblem shut={false} motion={motion} restingAt={0} />
          <Animated.Text style={[s.label, looseInkStyle]}>Loose</Animated.Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.half}
          onPress={() => onChange('strict')}
          activeOpacity={0.86}
          haptic="selection"
          accessibilityRole="radio"
          accessibilityState={{ checked: strict }}
          accessibilityLabel={`Strict. ${spoken(strictDetail)}`}
        >
          <Emblem shut motion={motion} restingAt={1} />
          <Animated.Text style={[s.label, strictInkStyle]}>Strict</Animated.Text>
        </TouchableOpacity>
      </View>

      {/* WHAT THE CHOSEN SIDE ACTUALLY BRINGS.

          This was a dotted line of 14pt grey under the track — the smallest,
          barest thing in the section, carrying the one fact that tells these
          two apart. It is a card now, cut from the same cloth as the rule's own
          plates: the answer's colour down the left edge, its door in a seat,
          and the consequence stated in full rather than abbreviated to fit a
          single line. */}
      <Animated.View
        key={value}
        entering={FadeIn.duration(220)}
        style={[
          s.outcome,
          { borderColor: strict ? `${ROSE}47` : `${LOOSE}42` },
        ]}
      >
        <View pointerEvents="none" style={[s.outcomeEdge, { backgroundColor: strict ? ROSE : LOOSE }]} />
        <View style={[s.outcomeSeat, {
          backgroundColor: strict ? `${ROSE}14` : `${LOOSE}14`,
          borderColor: strict ? `${ROSE}2E` : `${LOOSE}2E`,
        }]}>
          <Door shut={strict} />
        </View>
        <Text style={s.outcomeText}>
          {copy.map((piece, index) => (typeof piece === 'string' ? piece : (
            <Text key={index} style={[s.outcomeFigure, { color: strict ? ROSE_INK : LOOSE_INK }]}>
              {piece.struck}
            </Text>
          )))}
        </Text>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  // A shallower, paler plate than the raised switch's recessed track: nothing
  // is going to sit on top of this one, so it does not need the contrast that
  // lets a plaque lift off.
  track: {
    position: 'relative',
    flexDirection: 'row',
    padding: TRACK_PAD,
    borderRadius: 14,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#E6E1D6',
    backgroundColor: '#FBF9F4',
    overflow: 'hidden',
  },
  well: {
    position: 'absolute',
    left: TRACK_PAD,
    top: TRACK_PAD,
    bottom: TRACK_PAD,
    borderRadius: PILL_RADIUS,
    borderCurve: 'continuous',
    borderWidth: 1,
    // Cut in, not stood up: shadow inside the top edge, light on the bottom lip.
    boxShadow: 'inset 0 1.5px 3px rgba(72, 60, 35, 0.13), inset 0 -1px 0 rgba(255, 255, 255, 0.75)',
  },
  half: {
    flex: 1,
    minHeight: 38,
    borderRadius: PILL_RADIUS,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    zIndex: 1,
  },
  label: { fontFamily: F.serifSemiBold, fontSize: 15.5, lineHeight: 19 },
  emblemSeat: { width: EMBLEM, height: EMBLEM, alignItems: 'center', justifyContent: 'center' },

  // The consequence card. Flat white with a coloured edge rather than a tinted
  // fill: the engraved track above it is already the quiet member of this pair,
  // and a filled card here would outweigh the choice it explains.
  outcome: {
    marginTop: 9,
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    backgroundColor: '#FFFEFB',
    paddingLeft: 14,
    paddingRight: 13,
    paddingVertical: 11,
  },
  outcomeEdge: { position: 'absolute', left: 0, top: 10, bottom: 10, width: 3, borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  outcomeSeat: {
    flexShrink: 0,
    width: 34,
    height: 34,
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ⚠️ 16, not 14.5. This is the longest passage of reading on the sheet and
  // it explains the consequence of a boundary — the last place to be small.
  // Body copy in this app sits at 16 for the same reason.
  outcomeText: { flex: 1, fontFamily: F.serif, fontSize: 16, lineHeight: 22, color: C.textSecondary },
  // The words the answer turns on, struck in the answer's own ink.
  outcomeFigure: { fontFamily: F.serifSemiBold },
});
