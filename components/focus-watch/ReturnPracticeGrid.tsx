import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Book, Feather, OrthodoxCross } from '@/components/icons/Icons';
import ScriptureBook from '@/components/icons/ScriptureBook';
import BeadLoop from '@/components/prayer/BeadLoop';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import { RETURN_PRACTICES, SELECTABLE_RETURN_PRACTICES, type PracticeKind } from './dayPlanStore';

// The four ways back in.
//
// These were five full-width seats, each with a name, a line of detail and a
// radio ring — 300pt of identical rows for a setting chosen once. Worse, they
// were the same control as the Loose/Strict pair above them, so a decision
// between two kinds and a decision among practices looked alike.
//
// They are a grid of plaques now, and each wears its own face: these are not
// options, they are things Anasta already knows — the cross, the prayer rope,
// the Psalter, the Gospel. The detail line no longer repeats down the list;
// the chosen practice states its own beneath the grid, which is the only one
// you need while choosing.

const SELECT_SPRING = { damping: 18, stiffness: 235, mass: 0.72 };

const PRACTICE_FACES: Record<PracticeKind, (props: { s: number; c: string; w?: number }) => React.ReactElement> = {
  // One prayer: the sign made over it.
  prayer: ({ s: size, c }) => <OrthodoxCross s={size} c={c} w={1.5} />,
  // The rope it is counted on — the same loop the Prayer Book wears.
  'jesus-prayer': ({ s: size, c }) => <BeadLoop s={size} c={c} w={1.3} />,
  // The Psalter as an object you take up.
  psalm: ({ s: size, c }) => <ScriptureBook s={size} c={c} w={1.3} />,
  // A chapter is a book opened and read through.
  chapter: ({ s: size, c }) => <Book s={size} c={c} w={1.5} />,
  intention: ({ s: size, c }) => <Feather s={size} c={c} w={1.5} />,
};

function PracticeCell({
  practice,
  active,
  accent,
  onPress,
}: {
  practice: (typeof RETURN_PRACTICES)[number];
  active: boolean;
  accent: string;
  onPress: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    progress.value = reduceMotion
      ? (active ? 1 : 0)
      : withSpring(active ? 1 : 0, SELECT_SPRING);
  }, [active, progress, reduceMotion]);

  const cellStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], ['#FFFFFF', `${accent}0F`]),
    borderColor: interpolateColor(progress.value, [0, 1], ['#EFECE4', accent]),
    shadowOpacity: 0.02 + progress.value * 0.08,
  }), [accent]);

  const Face = PRACTICE_FACES[practice.id];

  return (
    <TouchableOpacity
      style={s.touch}
      onPress={onPress}
      activeOpacity={0.86}
      haptic="selection"
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      accessibilityLabel={`${practice.name}. ${practice.detail}`}
    >
      <Animated.View style={[s.cell, cellStyle, { shadowColor: accent }]}>
        {/* Resting the face stays itself, only quieter. */}
        <View style={[s.face, !active && s.faceResting]}>
          <Face s={24} c={active ? accent : '#8B8378'} />
        </View>
        <Text style={[s.name, active && { color: accent }]} numberOfLines={2}>
          {practice.name}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function ReturnPracticeGrid({
  value,
  accent,
  onChange,
}: {
  value: PracticeKind;
  accent: string;
  onChange: (next: PracticeKind) => void;
}) {
  // Looked up in the FULL catalogue, not the selectable four: a plan saved
  // before Written intention was retired still names it, and its line should
  // still read correctly even though it can no longer be chosen.
  const chosen = RETURN_PRACTICES.find(entry => entry.id === value);

  return (
    <View>
      <View style={s.grid} accessibilityRole="radiogroup">
        {SELECTABLE_RETURN_PRACTICES.map(practice => (
          <PracticeCell
            key={practice.id}
            practice={practice}
            active={practice.id === value}
            accent={accent}
            onPress={() => onChange(practice.id)}
          />
        ))}
      </View>

      {/* What the chosen practice actually asks of you. No bullet: the dotted
          note was the pattern the outcome card replaced, and one stray dot at
          the foot of the section read as a leftover. It sits in the same text
          column as the question above the grid, so the whole part reads as one
          column of copy with the choices set into it. */}
      {!!chosen && (
        <Animated.Text
          key={chosen.id}
          entering={FadeIn.duration(200)}
          style={[s.detailText, { color: accent }]}
        >
          {chosen.detail}
        </Animated.Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // Two to a row, and now a clean 2×2 — the fifth practice used to sit alone on
  // a third row, which read as an incomplete grid rather than a set.
  touch: { width: '48.5%' },
  cell: {
    // 56, so a two-word name at 16.5 still sits on one line in a half-width
    // cell rather than wrapping.
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: 15,
    borderCurve: 'continuous',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 12,
    elevation: 1,
  },
  face: { width: 26, height: 26, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  faceResting: { opacity: 0.5 },
  name: { flex: 1, minWidth: 0, fontFamily: F.serifSemiBold, fontSize: 16.5, lineHeight: 20, color: C.text },

  detailText: {
    marginTop: 10,
    marginLeft: 3,
    fontFamily: F.serifItalic,
    fontSize: 15.5,
    lineHeight: 21,
  },
});
