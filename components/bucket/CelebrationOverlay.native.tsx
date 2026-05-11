import { useEffect, useState } from 'react';
import {
  Modal, StyleSheet, Text, View,
} from 'react-native';
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import LottieView from 'lottie-react-native';
import { Sparkles } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';

const GOLD = '#C5A059';
const CONFETTI_DELAY_MS = 430;

export default function CelebrationOverlay() {
  const [showConfetti, setShowConfetti] = useState(false);
  const scale = useSharedValue(0.7);
  const opacity = useSharedValue(0);
  const scrimOpacity = useSharedValue(0);
  const sparkleScale = useSharedValue(0.5);

  useEffect(() => {
    scrimOpacity.value = withTiming(1, {
      duration: 180,
      easing: Easing.out(Easing.quad),
    });
    scale.value = withSpring(1, {
      damping: 13,
      stiffness: 170,
      mass: 0.75,
    });
    opacity.value = withTiming(1, {
      duration: 220,
      easing: Easing.out(Easing.quad),
    });
    sparkleScale.value = withDelay(120, withSpring(1, {
      damping: 11,
      stiffness: 160,
      mass: 0.8,
    }));

    const confettiTimer = setTimeout(() => {
      setShowConfetti(true);
    }, CONFETTI_DELAY_MS);

    return () => clearTimeout(confettiTimer);
  }, [opacity, scale, scrimOpacity, sparkleScale]);

  const scrimMotionStyle = useAnimatedStyle(() => ({
    opacity: scrimOpacity.value,
  }));

  const cardMotionStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const sparkleMotionStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sparkleScale.value }],
  }));

  return (
    <Modal transparent visible animationType="none" hardwareAccelerated statusBarTranslucent>
      <View style={s.wrap} pointerEvents="none">
        <Reanimated.View style={[s.scrim, scrimMotionStyle]} />

        <Reanimated.View style={[s.card, cardMotionStyle]}>
          <Reanimated.View style={[s.iconRing, sparkleMotionStyle]}>
            <Sparkles s={32} c={GOLD} w={1.6} />
          </Reanimated.View>
          <Text style={s.title}>Dream Achieved!</Text>
          <Text style={s.label}>CONGRATULATIONS</Text>
        </Reanimated.View>

        {showConfetti && (
          <View style={s.lottieWrapper} pointerEvents="none">
            <LottieView
              source={require('@/assets/animations/task-complete.json')}
              autoPlay
              loop={false}
              style={StyleSheet.absoluteFill}
              speed={0.92}
              renderMode="HARDWARE"
            />
          </View>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5000,
    elevation: 5000,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17,17,17,0.38)',
  },
  lottieWrapper: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 3,
    elevation: 3,
  },
  card: {
    zIndex: 2,
    alignItems: 'center',
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 44,
    paddingVertical: 32,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.20)',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 14 },
    shadowRadius: 32,
    elevation: 18,
  },
  iconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(197,160,89,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontFamily: F.serifMedium,
    fontSize: 22,
    color: C.text,
    marginTop: 12,
  },
  label: {
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 2.8,
    color: GOLD,
    marginTop: 6,
  },
});
