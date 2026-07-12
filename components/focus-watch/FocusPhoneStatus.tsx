import { useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Smartphone } from '@/components/icons/Icons';
import { C } from '@/constants/tokens';
import FocusWatchLottie from './FocusWatchLottie';

export default function FocusPhoneStatus({
  active,
  critical = false,
  size = 142,
}: {
  active: boolean;
  critical?: boolean;
  size?: number;
}) {
  const isFocused = useIsFocused();
  const reduceMotion = useReducedMotion();
  const [isForeground, setIsForeground] = useState(AppState.currentState === 'active');
  const breath = useSharedValue(0);
  const ripple = useSharedValue(0);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => setIsForeground(next === 'active'));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!isFocused || !isForeground || reduceMotion) {
      cancelAnimation(breath);
      cancelAnimation(ripple);
      breath.value = 0;
      ripple.value = 0;
      return;
    }
    breath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 2200, easing: Easing.inOut(Easing.quad) })
      ),
      -1
    );
    if (active) {
      ripple.value = withRepeat(
        withTiming(1, { duration: 3600, easing: Easing.out(Easing.cubic) }),
        -1
      );
    } else {
      cancelAnimation(ripple);
      ripple.value = 0;
    }
    return () => {
      cancelAnimation(breath);
      cancelAnimation(ripple);
    };
  }, [active, breath, isFocused, isForeground, reduceMotion, ripple]);

  const auraStyle = useAnimatedStyle(() => ({
    opacity: active ? 0.46 + breath.value * 0.28 : 0.18 + breath.value * 0.1,
    transform: [{ scale: 0.96 + breath.value * 0.05 }],
  }));
  const rippleStyle = useAnimatedStyle(() => ({
    opacity: active ? (1 - ripple.value) * 0.22 : 0,
    transform: [{ scale: 0.72 + ripple.value * 0.38 }],
  }));

  const accent = critical ? '#B74B5D' : active ? '#4E9A72' : C.gold;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        pointerEvents="none"
        style={[
          s.ripple,
          { width: size * 0.94, height: size * 0.94, borderRadius: size * 0.47, borderColor: accent },
          rippleStyle,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          s.aura,
          {
            width: size * 0.76,
            height: size * 0.76,
            borderRadius: size * 0.38,
            backgroundColor: critical ? '#F8E7EA' : active ? '#E4F2EA' : '#F7EED9',
          },
          auraStyle,
        ]}
      />
      <View style={s.center} pointerEvents="none">
        {process.env.EXPO_OS === 'web' || !isFocused || !isForeground || reduceMotion ? (
          <View style={[s.fallback, { borderColor: accent }]}>
            <Smartphone s={40} c={accent} w={1.7} />
          </View>
        ) : (
          <FocusWatchLottie
            name="iphone"
            mode="loop"
            speed={active ? 0.82 : 0.68}
            style={{ width: size * 0.74, height: size * 0.74 }}
          />
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  ripple: {
    position: 'absolute',
    borderWidth: 1,
  },
  aura: {
    position: 'absolute',
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallback: {
    width: 62,
    height: 82,
    borderRadius: 17,
    borderCurve: 'continuous',
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.86)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
