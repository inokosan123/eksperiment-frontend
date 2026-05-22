import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { CheckSmall } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { F } from '@/constants/tokens';
import { CHALLENGE_TROPHY_SOURCE } from '@/components/challenges/ChallengeTrophy';
import { playChallengeCompleteFeedback } from '@/components/challenges/challengeFeedback';

const ARRIVAL_START_FRAME = 0;
const ARRIVAL_END_FRAME = 99;
const EXIT_START_FRAME = 100;
const EXIT_END_FRAME = 119;
const EXIT_HOLD_MS = 1000;
const EXIT_DURATION_MS = 760 + EXIT_HOLD_MS;

type Props = {
  visible: boolean;
  title: string;
  onExited: () => void;
};

export default function ChallengeCompletionHomeModal({
  visible,
  title,
  onExited,
}: Props) {
  const lottieRef = useRef<LottieView>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [leaving, setLeaving] = useState(false);
  const scrimOpacity = useSharedValue(0);
  const cardOpacity = useSharedValue(0);
  const cardScale = useSharedValue(0.84);
  const contentLift = useSharedValue(14);
  const glowScale = useSharedValue(0.7);

  useEffect(() => () => {
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
  }, []);

  useEffect(() => {
    if (!visible) {
      setLeaving(false);
      scrimOpacity.value = 0;
      cardOpacity.value = 0;
      cardScale.value = 0.84;
      contentLift.value = 14;
      glowScale.value = 0.7;
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
      return;
    }

    void playChallengeCompleteFeedback();
    scrimOpacity.value = withTiming(1, {
      duration: 180,
      easing: Easing.out(Easing.quad),
    });
    cardOpacity.value = withTiming(1, {
      duration: 220,
      easing: Easing.out(Easing.quad),
    });
    cardScale.value = withSpring(1, {
      damping: 14,
      stiffness: 170,
      mass: 0.78,
    });
    contentLift.value = withSpring(0, {
      damping: 13,
      stiffness: 150,
      mass: 0.82,
    });
    glowScale.value = withDelay(180, withTiming(1, {
      duration: 620,
      easing: Easing.out(Easing.cubic),
    }));

    const playTimer = setTimeout(() => {
      lottieRef.current?.reset();
      lottieRef.current?.play(ARRIVAL_START_FRAME, ARRIVAL_END_FRAME);
    }, 45);

    return () => clearTimeout(playTimer);
  }, [cardOpacity, cardScale, contentLift, glowScale, scrimOpacity, visible]);

  const continueFlow = useCallback(() => {
    if (leaving) return;
    setLeaving(true);
    lottieRef.current?.play(EXIT_START_FRAME, EXIT_END_FRAME);
    contentLift.value = withTiming(-8, {
      duration: 420,
      easing: Easing.inOut(Easing.cubic),
    });
    cardScale.value = withDelay(430 + EXIT_HOLD_MS, withTiming(0.96, {
      duration: 210,
      easing: Easing.in(Easing.quad),
    }));
    cardOpacity.value = withDelay(520 + EXIT_HOLD_MS, withTiming(0, {
      duration: 180,
      easing: Easing.in(Easing.quad),
    }));
    scrimOpacity.value = withDelay(560 + EXIT_HOLD_MS, withTiming(0, {
      duration: 190,
      easing: Easing.in(Easing.quad),
    }));

    exitTimerRef.current = setTimeout(() => {
      exitTimerRef.current = null;
      onExited();
    }, EXIT_DURATION_MS);
  }, [cardOpacity, cardScale, contentLift, leaving, onExited, scrimOpacity]);

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: scrimOpacity.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: contentLift.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.28 + glowScale.value * 0.36,
    transform: [{ scale: glowScale.value }],
  }));

  return (
    <Modal transparent visible={visible} animationType="none" hardwareAccelerated statusBarTranslucent>
      <View style={s.overlay}>
        <Reanimated.View style={[s.scrim, scrimStyle]} />
        <Reanimated.View style={[s.card, cardStyle]}>
          <LinearGradient
            colors={['#FFF7DE', '#FFFFFF', '#FFFDF8']}
            start={{ x: 0.08, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.stage}
          >
            <Reanimated.View style={[s.glow, glowStyle]} />
            <Reanimated.View style={[s.trophyWrap, contentStyle]}>
              <LottieView
                ref={lottieRef}
                source={CHALLENGE_TROPHY_SOURCE}
                autoPlay={false}
                loop={false}
                style={StyleSheet.absoluteFill}
                resizeMode="contain"
                renderMode="HARDWARE"
              />
            </Reanimated.View>
          </LinearGradient>

          <View style={s.copy}>
            <View style={s.kickerRow}>
              <CheckSmall s={12} c="#C5A059" w={2.8} />
              <Text style={s.kicker}>CONGRATULATIONS</Text>
            </View>
            <Text style={s.title}>Challenge completed</Text>
            <Text style={s.body}>
              Excellent work. You completed {title} and added a new trophy to your collection.
            </Text>
          </View>

          <TouchableOpacity
            onPress={continueFlow}
            disabled={leaving}
            activeOpacity={0.86}
            haptic="medium"
            style={[s.continueBtn, leaving && s.continueBtnLeaving]}
          >
            <Text style={s.continueText}>{leaving ? 'SAVING...' : 'CONTINUE'}</Text>
          </TouchableOpacity>
        </Reanimated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(18,16,12,0.46)',
  },
  card: {
    width: '100%',
    maxWidth: 354,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.24)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.22,
    shadowRadius: 34,
    elevation: 16,
  },
  stage: {
    width: '100%',
    height: 192,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#F4C95D',
  },
  trophyWrap: {
    width: 188,
    height: 188,
  },
  copy: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  kickerRow: {
    marginTop: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  kicker: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2,
    color: '#C5A059',
  },
  title: {
    marginTop: 8,
    fontFamily: F.serifMedium,
    fontSize: 24,
    lineHeight: 29,
    color: '#1C1917',
    textAlign: 'center',
  },
  body: {
    marginTop: 8,
    fontFamily: F.serif,
    fontSize: 15,
    lineHeight: 22,
    color: '#6B7280',
    textAlign: 'center',
  },
  continueBtn: {
    marginTop: 19,
    width: '100%',
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: '#C5A059',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#C5A059',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 4,
  },
  continueBtnLeaving: {
    opacity: 0.72,
  },
  continueText: {
    fontFamily: F.sansBold,
    fontSize: 11,
    letterSpacing: 2,
    color: '#FFFFFF',
  },
});
