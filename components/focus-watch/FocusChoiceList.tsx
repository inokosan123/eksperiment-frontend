import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import { withAlpha } from './GroupSeal';

// The choice list the task sheets use for frequency, brought to Focus.
//
// A decision that changes what a rule does is worth a full-width seat: the name
// set in serif, one short line under it saying what it actually brings, and a
// ring on the right that fills when chosen. The seat lights with the accent on
// a spring — background, border and a lift — so choosing reads as the card
// coming forward rather than a dot moving.
//
// It replaces the sliding two-word track for anything consequential. A track is
// right for a setting you can guess; it is wrong when the two answers need a
// sentence to tell apart.

export type Choice<T extends string> = {
  key: T;
  label: string;
  /** One short line: what this choice brings. Not a description of the word. */
  detail: string;
  /** Rose for the closing answers, the group's colour for the open ones. */
  accent: string;
  icon?: React.ReactNode;
};

function ChoiceSeat({
  choice,
  active,
  onPress,
}: {
  choice: Choice<string>;
  active: boolean;
  onPress: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(active ? 1 : 0);
  const activeBg = withAlpha(choice.accent, 0.055);

  useEffect(() => {
    progress.value = reduceMotion
      ? (active ? 1 : 0)
      : withSpring(active ? 1 : 0, { damping: 18, stiffness: 235, mass: 0.72 });
  }, [active, progress, reduceMotion]);

  const seatStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], ['#FFFFFF', activeBg]),
    borderColor: interpolateColor(progress.value, [0, 1], ['#F0EDE6', choice.accent]),
    shadowOpacity: 0.015 + progress.value * 0.085,
    transform: [{ scale: 1 + progress.value * 0.006 }],
  }), [activeBg, choice.accent]);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      haptic="selection"
      style={s.touch}
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      accessibilityLabel={`${choice.label}. ${choice.detail}`}
    >
      <Animated.View style={[s.seat, seatStyle, { shadowColor: choice.accent }]}>
        {!!choice.icon && (
          <View style={[
            s.icon,
            active
              ? { backgroundColor: withAlpha(choice.accent, 0.12), borderColor: withAlpha(choice.accent, 0.26) }
              : null,
          ]}>
            {choice.icon}
          </View>
        )}
        <View style={s.copy}>
          <Text style={[s.label, active && { color: choice.accent }]} numberOfLines={1}>
            {choice.label}
          </Text>
          <Text style={s.detail} numberOfLines={2}>{choice.detail}</Text>
        </View>
        <View style={[
          s.ring,
          active && { borderColor: withAlpha(choice.accent, 0.34), backgroundColor: '#FFFDF8' },
        ]}>
          {active && <View style={[s.dot, { backgroundColor: choice.accent }]} />}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function FocusChoiceList<T extends string>({
  value,
  choices,
  onChange,
}: {
  value: T;
  choices: Choice<T>[];
  onChange: (key: T) => void;
}) {
  return (
    <View style={s.list} accessibilityRole="radiogroup">
      {choices.map(choice => (
        <ChoiceSeat
          key={choice.key}
          choice={choice}
          active={choice.key === value}
          onPress={() => onChange(choice.key)}
        />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  list: { gap: 8 },
  touch: { width: '100%' },
  seat: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#F0EDE6',
    backgroundColor: '#FFFFFF',
    paddingLeft: 13,
    paddingRight: 12,
    paddingVertical: 9,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 1,
  },
  icon: {
    flexShrink: 0,
    width: 34,
    height: 34,
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#EFECE4',
    backgroundColor: '#FAF9F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, minWidth: 0 },
  label: { fontFamily: F.serifSemiBold, fontSize: 17, lineHeight: 21, color: C.text },
  detail: { marginTop: 1, fontFamily: F.sans, fontSize: 11, lineHeight: 15, color: C.textMuted },
  ring: {
    flexShrink: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#E8E2D7',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
