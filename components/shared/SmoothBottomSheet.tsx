import React, { useEffect, useState } from 'react';
import { HapticPressable as Pressable } from '@/components/shared/HapticTouch';

import {
  Keyboard,
  Modal,
  Platform,
  StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import Reanimated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

type SmoothBottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  overlayChildren?: React.ReactNode;
  sheetStyle?: StyleProp<ViewStyle>;
  overlayStyle?: StyleProp<ViewStyle>;
  closeOnBackdropPress?: boolean;
  backdropOpacity?: number;
  durationIn?: number;
  durationOut?: number;
  statusBarTranslucent?: boolean;
  keyboardAware?: boolean;
  // When true the sheet renders inline (no native Modal). Use this when
  // nesting one SmoothBottomSheet inside another's `overlayChildren` —
  // iOS UIKit refuses to present a second Modal while another is already
  // shown, which silently breaks nested sheets like Habit Builder → Add Step.
  embedded?: boolean;
};

export default function SmoothBottomSheet({
  visible,
  onClose,
  children,
  overlayChildren,
  sheetStyle,
  overlayStyle,
  closeOnBackdropPress = true,
  backdropOpacity = 0.38,
  durationIn = 280,
  durationOut = 200,
  statusBarTranslucent = true,
  keyboardAware = false,
  embedded = false,
}: SmoothBottomSheetProps) {
  const { height } = useWindowDimensions();
  const progress = useSharedValue(0);
  const [mounted, setMounted] = useState(visible);
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    if (!keyboardAware) return;
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      e => setKbHeight(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKbHeight(0),
    );
    return () => { show.remove(); hide.remove(); };
  }, [keyboardAware]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = 0;
      const frame = requestAnimationFrame(() => {
        progress.value = withTiming(1, {
          duration: durationIn,
          easing: Easing.out(Easing.cubic),
        });
      });
      return () => cancelAnimationFrame(frame);
    }

    if (!mounted) return undefined;

    progress.value = withTiming(0, {
      duration: durationOut,
      easing: Easing.in(Easing.cubic),
    }, finished => {
      if (finished) runOnJS(setMounted)(false);
    });

    return undefined;
  }, [durationIn, durationOut, mounted, progress, visible]);

  const startOffset = Math.max(430, height * 0.72);
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: progress.value * backdropOpacity,
  }));
  const sheetMotionStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * startOffset }],
  }));

  if (!mounted) return null;

  const inner = (
    <View style={[styles.root, overlayStyle, keyboardAware && kbHeight > 0 && { paddingBottom: kbHeight }]}>
      <Reanimated.View pointerEvents="none" style={[styles.scrim, scrimStyle]} />
      {closeOnBackdropPress && (
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      )}
      <Reanimated.View style={[sheetStyle, sheetMotionStyle]}>
        {children}
      </Reanimated.View>
      {overlayChildren}
    </View>
  );

  if (embedded) {
    return <View style={StyleSheet.absoluteFill}>{inner}</View>;
  }

  return (
    <Modal
      transparent
      visible={mounted}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent={statusBarTranslucent}
    >
      {inner}
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
});
