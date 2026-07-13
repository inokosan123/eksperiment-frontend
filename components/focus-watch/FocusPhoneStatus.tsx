import { useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
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
  const motion = useSharedValue(0);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => setIsForeground(next === 'active'));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!isFocused || !isForeground || reduceMotion) {
      cancelAnimation(motion);
      motion.value = 0;
      return;
    }
    motion.value = 0;
    motion.value = withRepeat(
      withTiming(1, { duration: 8400, easing: Easing.linear }),
      -1,
      false
    );
    return () => {
      cancelAnimation(motion);
    };
  }, [isFocused, isForeground, motion, reduceMotion]);

  const auraStyle = useAnimatedStyle(() => ({
    opacity: active
      ? interpolate(motion.value, [0, 0.5, 1], [0.48, 0.72, 0.48])
      : interpolate(motion.value, [0, 0.5, 1], [0.18, 0.3, 0.18]),
    transform: [{ scale: interpolate(motion.value, [0, 0.5, 1], [0.96, 1.025, 0.96]) }],
  }));
  const orbitStyle = useAnimatedStyle(() => ({
    opacity: active ? 0.82 : 0.38,
    transform: [{ rotate: `${motion.value * 360}deg` }],
  }));
  const boundaryStyle = useAnimatedStyle(() => ({
    opacity: active
      ? interpolate(motion.value, [0, 0.5, 1], [0.22, 0.08, 0.22])
      : interpolate(motion.value, [0, 0.5, 1], [0.12, 0.06, 0.12]),
    transform: [{ scale: interpolate(motion.value, [0, 0.5, 1], [0.94, 1.04, 0.94]) }],
  }));

  const accent = critical ? '#B74B5D' : active ? '#4E9A72' : C.gold;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        pointerEvents="none"
        style={[
          s.boundary,
          { width: size * 0.96, height: size * 0.96, borderRadius: size * 0.48, borderColor: accent },
          boundaryStyle,
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
      <View
        pointerEvents="none"
        style={[
          s.signalRing,
          {
            width: size * 0.86,
            height: size * 0.86,
            borderRadius: size * 0.43,
            borderColor: active ? 'rgba(78,154,114,0.28)' : 'rgba(197,160,89,0.22)',
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          s.orbit,
          { width: size * 0.86, height: size * 0.86, borderRadius: size * 0.43 },
          orbitStyle,
        ]}
      >
        <View style={[s.orbitNode, { backgroundColor: accent }]} />
        <View style={[s.orbitNode, s.orbitNodeOpposite, { backgroundColor: accent }]} />
      </Animated.View>
      <View style={s.center} pointerEvents="none">
        {process.env.EXPO_OS === 'web' || !isFocused || !isForeground || reduceMotion ? (
          <View style={[s.fallback, { borderColor: accent, width: size * 0.38, height: size * 0.54 }]}>
            <Smartphone s={size * 0.26} c={accent} w={1.7} />
          </View>
        ) : (
          <FocusWatchLottie
            name="iphone"
            mode="periodic"
            restMs={active ? 1450 : 1900}
            speed={active ? 0.74 : 0.64}
            style={{ width: size * 0.84, height: size * 0.84 }}
          />
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  boundary: {
    position: 'absolute',
    borderWidth: 1,
  },
  aura: {
    position: 'absolute',
  },
  signalRing: {
    position: 'absolute',
    borderWidth: 1,
  },
  orbit: {
    position: 'absolute',
  },
  orbitNode: {
    position: 'absolute',
    top: -2.5,
    left: '50%',
    width: 5,
    height: 5,
    marginLeft: -2.5,
    borderRadius: 3,
  },
  orbitNodeOpposite: {
    top: undefined,
    bottom: -2,
    opacity: 0.48,
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallback: {
    borderRadius: 17,
    borderCurve: 'continuous',
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.86)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
