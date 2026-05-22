import { useCallback } from 'react';
import {
  Platform,
  Pressable as NativePressable,
  TouchableOpacity as NativeTouchableOpacity,
  type GestureResponderEvent,
  type PressableProps,
  type TouchableOpacityProps,
} from 'react-native';
import * as Haptics from 'expo-haptics';

type HapticTouchMode = 'light' | 'medium' | 'heavy' | 'selection' | 'none';

type HapticTouchableOpacityProps = TouchableOpacityProps & {
  haptic?: HapticTouchMode;
};

type HapticPressableProps = PressableProps & {
  haptic?: HapticTouchMode;
};

let lastTouchHapticAt = 0;

function hasManualHaptic(handler?: unknown) {
  if (typeof handler !== 'function') return false;

  const source = Function.prototype.toString.call(handler);
  return /Haptics|haptic|impactAsync|selectionAsync|notificationAsync|play[A-Za-z]*Feedback|performTaskFeedback|toggleTaskInstance|completeTaskInstance|skipTaskInstance|resetTaskInstance|requestSkipTaskInstance/i.test(source);
}

function triggerTouchHaptic(mode: HapticTouchMode) {
  if (Platform.OS === 'web' || mode === 'none') return;

  const now = Date.now();
  if (now - lastTouchHapticAt < 90) return;
  lastTouchHapticAt = now;

  if (mode === 'selection') {
    Haptics.selectionAsync().catch(() => {});
    return;
  }

  const style =
    mode === 'heavy'
      ? Haptics.ImpactFeedbackStyle.Heavy
      : mode === 'medium'
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light;

  Haptics.impactAsync(style).catch(() => {});
}

function shouldTriggerHaptic(
  disabled: boolean | null | undefined,
  haptic: HapticTouchMode,
  handler?: unknown
) {
  if (disabled || haptic === 'none') return false;
  if (typeof handler !== 'function') return false;
  return !hasManualHaptic(handler);
}

export function HapticTouchableOpacity({
  haptic = 'light',
  disabled,
  onPress,
  onPressIn,
  onLongPress,
  ...props
}: HapticTouchableOpacityProps) {
  const handlePress = useCallback((event: GestureResponderEvent) => {
    if (shouldTriggerHaptic(disabled, haptic, onPress)) {
      triggerTouchHaptic(haptic);
    }

    onPress?.(event);
  }, [disabled, haptic, onPress]);

  const handleLongPress = useCallback((event: GestureResponderEvent) => {
    if (shouldTriggerHaptic(disabled, haptic, onLongPress)) {
      triggerTouchHaptic(haptic);
    }

    onLongPress?.(event);
  }, [disabled, haptic, onLongPress]);

  return (
    <NativeTouchableOpacity
      {...props}
      disabled={disabled}
      onPress={onPress ? handlePress : undefined}
      onLongPress={onLongPress ? handleLongPress : undefined}
      onPressIn={onPressIn}
    />
  );
}

export function HapticPressable({
  haptic = 'light',
  disabled,
  onPress,
  onPressIn,
  onLongPress,
  ...props
}: HapticPressableProps) {
  const handlePress = useCallback((event: GestureResponderEvent) => {
    if (shouldTriggerHaptic(disabled, haptic, onPress)) {
      triggerTouchHaptic(haptic);
    }

    onPress?.(event);
  }, [disabled, haptic, onPress]);

  const handleLongPress = useCallback((event: GestureResponderEvent) => {
    if (shouldTriggerHaptic(disabled, haptic, onLongPress)) {
      triggerTouchHaptic(haptic);
    }

    onLongPress?.(event);
  }, [disabled, haptic, onLongPress]);

  return (
    <NativePressable
      {...props}
      disabled={disabled}
      onPress={onPress ? handlePress : undefined}
      onLongPress={onLongPress ? handleLongPress : undefined}
      onPressIn={onPressIn}
    />
  );
}
