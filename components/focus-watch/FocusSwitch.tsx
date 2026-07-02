import { useEffect } from 'react';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { HapticPressable } from '@/components/shared/HapticTouch';
import { C } from '@/constants/tokens';

const SPRING = { damping: 17, stiffness: 260 };

// The app-wide 46x26 switch (see ReadingListView task switch), animated:
// sprung knob + track color blend instead of an instant jump.
export default function FocusSwitch({
  value,
  onToggle,
}: {
  value: boolean;
  onToggle: () => void;
}) {
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(value ? 1 : 0, SPRING);
  }, [value, progress]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], ['#E5E7EB', C.gold]),
  }));
  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * 20 }],
  }));

  return (
    <HapticPressable
      haptic="selection"
      onPress={onToggle}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Animated.View
        style={[
          { width: 46, height: 26, borderRadius: 13, padding: 3, flexShrink: 0 },
          trackStyle,
        ]}
      >
        <Animated.View
          style={[
            {
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: '#FFFFFF',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.15,
              shadowRadius: 2,
              elevation: 2,
            },
            knobStyle,
          ]}
        />
      </Animated.View>
    </HapticPressable>
  );
}
