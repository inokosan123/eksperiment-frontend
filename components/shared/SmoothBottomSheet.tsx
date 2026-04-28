import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';

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
}: SmoothBottomSheetProps) {
  const { height } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;
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
      progress.setValue(0);
      const frame = requestAnimationFrame(() => {
        Animated.timing(progress, {
          toValue: 1,
          duration: durationIn,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      });
      return () => cancelAnimationFrame(frame);
    }

    if (!mounted) return undefined;

    Animated.timing(progress, {
      toValue: 0,
      duration: durationOut,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setMounted(false);
    });

    return undefined;
  }, [durationIn, durationOut, mounted, progress, visible]);

  if (!mounted) return null;

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [Math.max(430, height * 0.72), 0],
  });

  const scrimOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, backdropOpacity],
  });

  return (
    <Modal
      transparent
      visible={mounted}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent={statusBarTranslucent}
    >
      <View style={[styles.root, overlayStyle, keyboardAware && kbHeight > 0 && { paddingBottom: kbHeight }]}>
        <Animated.View pointerEvents="none" style={[styles.scrim, { opacity: scrimOpacity }]} />
        {closeOnBackdropPress && (
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        )}
        <Animated.View style={[sheetStyle, { transform: [{ translateY }] }]}>
          {children}
        </Animated.View>
        {overlayChildren}
      </View>
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
