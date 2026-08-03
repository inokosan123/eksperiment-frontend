import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
} from 'react-native-reanimated';
import { Smartphone } from '@/components/icons/Icons';
import { C } from '@/constants/tokens';
import FocusWatchLottie from './FocusWatchLottie';
import { useFocusMainMotion } from './focus-main-motion';
import {
  continuousPhase,
} from '@/components/shared/use-continuous-animation-clock';
import { useAmbientMotion } from '@/components/shared/ambient-motion';

const FocusPhoneStatus = memo(function FocusPhoneStatus({
  active,
  critical = false,
  size = 142,
}: {
  active: boolean;
  critical?: boolean;
  size?: number;
}) {
  const mainMotionEnabled = useFocusMainMotion();
  const runtime = useAmbientMotion(mainMotionEnabled);
  const { clock, reduceMotion } = runtime;
  const motionEnabled = runtime.enabled;
  const motionPhase = useDerivedValue(() => (
    motionEnabled ? continuousPhase(clock.value, 8400) : 0
  ));
  const lottieStyle = useMemo(
    () => ({ width: size * 0.84, height: size * 0.84 }),
    [size],
  );

  const auraStyle = useAnimatedStyle(() => {
    const motion = motionPhase.value;
    return {
      opacity: active
        ? interpolate(motion, [0, 0.5, 1], [0.48, 0.72, 0.48])
        : interpolate(motion, [0, 0.5, 1], [0.18, 0.3, 0.18]),
      transform: [{ scale: interpolate(motion, [0, 0.5, 1], [0.96, 1.025, 0.96]) }],
    };
  });
  const orbitStyle = useAnimatedStyle(() => {
    const motion = motionPhase.value;
    return {
      opacity: active ? 0.82 : 0.38,
      transform: [{ rotate: `${motion * 360}deg` }],
    };
  });
  const boundaryStyle = useAnimatedStyle(() => {
    const motion = motionPhase.value;
    return {
      opacity: active
        ? interpolate(motion, [0, 0.5, 1], [0.22, 0.08, 0.22])
        : interpolate(motion, [0, 0.5, 1], [0.12, 0.06, 0.12]),
      transform: [{ scale: interpolate(motion, [0, 0.5, 1], [0.94, 1.04, 0.94]) }],
    };
  });

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
        {process.env.EXPO_OS === 'web' || reduceMotion ? (
          <View style={[s.fallback, { borderColor: accent, width: size * 0.38, height: size * 0.54 }]}>
            <Smartphone s={size * 0.26} c={accent} w={1.7} />
          </View>
        ) : (
          <FocusWatchLottie
            name="iphone"
            mode="periodic"
            restMs={4200}
            speed={1}
            playing={mainMotionEnabled}
            style={lottieStyle}
          />
        )}
      </View>
    </View>
  );
});

export default FocusPhoneStatus;

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
