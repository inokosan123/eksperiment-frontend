import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { HapticPressable } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';

export type FocusSegmentOption = {
  key: string;
  label: string;
  // 'danger' tints the thumb rose while this option is selected (e.g. Blocked).
  tone?: 'default' | 'danger';
};

// The Focus segmented control: one white thumb glides under the chosen option
// with a calm spring — selection reads as movement, not a repaint.
export default function FocusSegments({
  options,
  value,
  onChange,
  height = 40,
}: {
  options: FocusSegmentOption[];
  value: string;
  onChange: (key: string) => void;
  height?: number;
}) {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex(option => option.key === value));
  const active = options[index];
  const x = useSharedValue(0);

  const segmentWidth = width > 0 ? (width - 6) / options.length : 0;

  useEffect(() => {
    if (segmentWidth <= 0) return;
    x.value = withSpring(index * segmentWidth, { damping: 17, stiffness: 240, mass: 0.72 });
  }, [index, segmentWidth, x]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  return (
    <View
      style={[s.track, { height }]}
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
    >
      {segmentWidth > 0 && (
        <Animated.View
          style={[
            s.thumb,
            { width: segmentWidth, height: height - 6 },
            active?.tone === 'danger' && s.thumbDanger,
            thumbStyle,
          ]}
          pointerEvents="none"
        />
      )}
      {options.map(option => {
        const selected = option.key === value;
        return (
          <HapticPressable
            key={option.key}
            haptic="selection"
            onPress={() => onChange(option.key)}
            style={s.segment}
          >
            <Text
              style={[
                s.label,
                selected && (option.tone === 'danger' ? s.labelDanger : s.labelOn),
              ]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </HapticPressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 13,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#F0EEE8',
    padding: 3,
  },
  thumb: {
    position: 'absolute',
    left: 3,
    top: 3,
    borderRadius: 10,
    borderCurve: 'continuous',
    backgroundColor: C.surface,
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  thumbDanger: {
    backgroundColor: '#FBEDEF',
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: F.sansSemiBold,
    fontSize: 11.5,
    color: C.textMuted,
  },
  labelOn: {
    color: C.goldDark,
  },
  labelDanger: {
    color: '#A24351',
  },
});
