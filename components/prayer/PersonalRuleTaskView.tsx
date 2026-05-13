import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import FocusLottie from '@/components/focus/FocusLottie';
import ConfirmModal from '@/components/shared/ConfirmModal';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import { ArrowLeft, CheckSmall, ChevronDown, Pause, Play, RotateCcw, X } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const QUOTE = '"Continue in prayer, and watch in the same with thanksgiving."';
const QUOTE_REF = 'Colossians 4:2';
const VB_R = 45;

export type PersonalPrayerRuleChoice = 'personal' | 'standard' | 'short' | 'seraphim';

const RULE_OPTIONS: { id: PersonalPrayerRuleChoice; label: string }[] = [
  { id: 'personal', label: 'Personal Rule' },
  { id: 'standard', label: 'Standard Rule' },
  { id: 'short', label: 'Shortened Rule' },
  { id: 'seraphim', label: 'Rule of Saint Seraphim' },
];

const RULE_DESCRIPTIONS: Record<PersonalPrayerRuleChoice, string> = {
  personal: 'Your own prayer book or private rule',
  standard: 'Full prayer rule',
  short: 'Abbreviated prayer rule',
  seraphim: 'Rule of St. Seraphim of Sarov',
};

const PERSONAL_RULE_THEMES = {
  morning: { accent: '#D97706', bg: '#FEF3C7', border: '#FDE68A' },
  evening: { accent: '#7C6EAF', bg: '#EDE9FE', border: '#C4B5FD' },
  default: { accent: C.gold, bg: '#FFFBEB', border: '#E8DCC4' },
};

type Props = {
  title?: string;
  prayerType?: string;
  isTask?: boolean;
  onBack: () => void;
  onComplete?: () => void | Promise<void>;
  selectedRule?: PersonalPrayerRuleChoice;
  onRuleChange?: (rule: PersonalPrayerRuleChoice) => void | Promise<void>;
};

function titleForPrayer(type?: string, title?: string) {
  if (title?.trim()) return title.trim();
  if (type === 'evening') return 'Evening Personal Rule';
  if (type === 'morning') return 'Morning Personal Rule';
  return 'Personal Rule';
}

function canSwitchPrayerRule(type?: string) {
  return type === 'morning' || type === 'evening';
}

function formatElapsed(totalSecs: number) {
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;

  if (hours > 0) {
    return {
      main: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
      tail: String(seconds).padStart(2, '0'),
    };
  }

  return {
    main: String(minutes).padStart(2, '0'),
    tail: String(seconds).padStart(2, '0'),
  };
}

export default function PersonalRuleTaskView({
  title,
  prayerType,
  isTask = false,
  onBack,
  onComplete,
  selectedRule = 'personal',
  onRuleChange,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [running, setRunning] = useState(false);
  const [showExit, setShowExit] = useState(false);
  const [showFinish, setShowFinish] = useState(false);
  const [showRuleSelector, setShowRuleSelector] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishLockRef = useRef(false);
  const bookMotion = useSharedValue(0);
  const pulseMotion = useSharedValue(0);

  const isCompactHeight = height < 720;
  const diameter = Math.min(width - (isCompactHeight ? 56 : 20), isCompactHeight ? 314 : 370);
  const bookSize = isCompactHeight ? 154 : 188;
  const hasHours = elapsedSecs >= 3600;
  const timeFont = hasHours ? (isCompactHeight ? 58 : 68) : (isCompactHeight ? 86 : 102);
  const colonFont = hasHours ? (isCompactHeight ? 22 : 28) : (isCompactHeight ? 32 : 38);
  const display = formatElapsed(elapsedSecs);
  const theme = prayerType === 'evening'
    ? PERSONAL_RULE_THEMES.evening
    : prayerType === 'morning'
      ? PERSONAL_RULE_THEMES.morning
      : PERSONAL_RULE_THEMES.default;
  const selectedRuleOption = RULE_OPTIONS.find(rule => rule.id === selectedRule) ?? RULE_OPTIONS[0];

  useEffect(() => {
    if (!running) return;

    timerRef.current = setInterval(() => {
      setElapsedSecs(prev => prev + 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [running]);

  useEffect(() => {
    bookMotion.value = withTiming(running ? 1 : 0, { duration: running ? 260 : 160 });
    pulseMotion.value = running
      ? withRepeat(
        withSequence(
          withTiming(1, { duration: 1150 }),
          withTiming(0, { duration: 1150 }),
        ),
        -1,
        false,
      )
      : withTiming(0, { duration: 180 });
  }, [bookMotion, pulseMotion, running]);

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (running) {
        setShowExit(true);
        return true;
      }
      return false;
    });

    return () => handler.remove();
  }, [running]);

  const bookStyle = useAnimatedStyle(() => ({
    opacity: bookMotion.value,
    transform: [
      { translateY: 18 - 18 * bookMotion.value },
      { scale: 0.82 + 0.18 * bookMotion.value },
    ],
  }));

  const bookAuraStyle = useAnimatedStyle(() => ({
    opacity: 0.10 + bookMotion.value * 0.12,
    transform: [{ scale: 0.9 + bookMotion.value * 0.1 }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.08 + bookMotion.value * 0.12,
  }));

  const pulseRingStyle = useAnimatedStyle(() => ({
    opacity: running ? 0.38 * (1 - pulseMotion.value) : 0,
    transform: [{ scale: 0.96 + pulseMotion.value * 0.12 }],
  }));

  const pulseRingOuterStyle = useAnimatedStyle(() => ({
    opacity: running ? 0.22 * pulseMotion.value : 0,
    transform: [{ scale: 1 + pulseMotion.value * 0.10 }],
  }));

  const handleReset = useCallback(() => {
    setRunning(false);
    setElapsedSecs(0);
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
  }, []);

  const handleFinish = useCallback(async () => {
    if (finishLockRef.current) return;
    finishLockRef.current = true;
    setRunning(false);
    if (Platform.OS !== 'web' && !isTask) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    await onComplete?.();
    onBack();
  }, [isTask, onBack, onComplete]);

  const handleRulePress = useCallback((rule: PersonalPrayerRuleChoice) => {
    if (rule === selectedRule) {
      setShowRuleSelector(false);
      return;
    }
    setRunning(false);
    setShowRuleSelector(false);
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    void onRuleChange?.(rule);
  }, [onRuleChange, selectedRule]);

  const screenTitle = titleForPrayer(prayerType, title);
  const activeColor = running ? theme.accent : C.text;
  const canSwitchRules = canSwitchPrayerRule(prayerType);

  return (
    <View style={s.screen}>
      <ScreenTitleBar
        title={screenTitle}
        showBack
        onBackOverride={running ? () => setShowExit(true) : undefined}
        compactBottom
      />

      {canSwitchRules && (
        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setShowRuleSelector(true);
          }}
          activeOpacity={0.76}
          style={[s.readerRulePill, { borderColor: theme.border, backgroundColor: theme.bg }]}
        >
          <Text style={[s.readerRuleText, { color: theme.accent }]}>{selectedRuleOption.label}</Text>
          <ChevronDown s={13} c={theme.accent} w={2.2} />
        </TouchableOpacity>
      )}

      <Text style={s.quote}>{QUOTE}</Text>
      <Text style={s.quoteRef}>{QUOTE_REF}</Text>

      <View style={[s.center, isCompactHeight && s.centerCompact]}>
        <View style={[s.timerWrap, isCompactHeight && s.timerWrapCompact, { width: diameter, height: diameter }]}>
          <Reanimated.View pointerEvents="none" style={[s.pulseRing, { width: diameter * 1.01, height: diameter * 1.01, borderRadius: diameter * 0.505, borderColor: `${theme.accent}66` }, pulseRingStyle]} />
          <Reanimated.View pointerEvents="none" style={[s.pulseRingOuter, { width: diameter * 1.10, height: diameter * 1.10, borderRadius: diameter * 0.55, borderColor: `${theme.accent}44` }, pulseRingOuterStyle]} />
          <Reanimated.View pointerEvents="none" style={[s.glow, { width: diameter * 0.82, height: diameter * 0.82, borderRadius: diameter * 0.41, backgroundColor: theme.accent }, glowStyle]} />
          <Svg
            width={diameter}
            height={diameter}
            viewBox="0 0 100 100"
            style={StyleSheet.absoluteFill}
          >
            <Circle
              cx="50"
              cy="50"
              r={VB_R}
              strokeWidth={1.45}
              fill="none"
              stroke={running ? `${theme.accent}77` : '#E2DED8'}
              strokeLinecap="round"
            />
          </Svg>

          <Reanimated.View style={s.timerTextWrap}>
            <Text style={[s.timeText, { color: activeColor, fontSize: timeFont, lineHeight: timeFont + 4 }]}>{display.main}</Text>
            <Text style={[s.colonText, { color: activeColor, fontSize: colonFont }]}>:</Text>
            <Text style={[s.timeText, { color: activeColor, fontSize: timeFont, lineHeight: timeFont + 4 }]}>{display.tail}</Text>
          </Reanimated.View>

          <Reanimated.View style={[s.bookWrap, bookStyle]}>
            <Reanimated.View pointerEvents="none" style={[s.bookAura, bookAuraStyle]} />
            <FocusLottie name="meru-book" loop autoplay={running} speed={0.55} style={[s.bookLottie, { width: bookSize, height: bookSize }]} />
          </Reanimated.View>
        </View>

        <View style={[s.controlsDeck, isCompactHeight && s.controlsDeckCompact]}>
          <TouchableOpacity
            onPress={handleReset}
            activeOpacity={0.78}
            style={[s.smallControl, isCompactHeight && s.smallControlCompact]}
          >
            <RotateCcw s={isCompactHeight ? 18 : 21} c="rgba(28,25,23,0.38)" w={1.8} />
            <Text style={s.smallLabel}>Reset</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setRunning(value => !value)}
            activeOpacity={0.88}
            style={[
              s.mainControl,
              isCompactHeight && s.mainControlCompact,
              { backgroundColor: running ? theme.accent : C.text, shadowColor: running ? theme.accent : C.text },
            ]}
          >
            {running ? <Pause s={isCompactHeight ? 26 : 30} c="#FFFFFF" /> : <Play s={isCompactHeight ? 26 : 30} c="#FFFFFF" />}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => isTask ? setShowFinish(true) : handleFinish()}
            activeOpacity={0.78}
            style={[s.smallControl, isCompactHeight && s.smallControlCompact]}
          >
            <CheckSmall s={isCompactHeight ? 19 : 22} c="rgba(28,25,23,0.38)" w={1.8} />
            <Text style={s.smallLabel}>Finish</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ConfirmModal
        visible={showExit}
        icon={<ArrowLeft s={22} c="#EF4444" />}
        iconBg="#FEF2F2"
        title="Exit Personal Rule?"
        body="Your prayer timer progress will be lost."
        cancelLabel="STAY"
        confirmLabel="EXIT"
        onCancel={() => setShowExit(false)}
        onConfirm={() => {
          setShowExit(false);
          setRunning(false);
          onBack();
        }}
      />

      <ConfirmModal
        visible={showFinish}
        icon={<CheckSmall s={22} c={C.gold} w={2.5} />}
        iconBg="#FFF8E0"
        title="Mark as Complete?"
        body="This will mark the prayer task as done for today."
        cancelLabel="CANCEL"
        confirmLabel="COMPLETE"
        confirmColor={C.gold}
        onCancel={() => setShowFinish(false)}
        onConfirm={handleFinish}
      />

      <Modal
        transparent
        visible={canSwitchRules && showRuleSelector}
        animationType="fade"
        onRequestClose={() => setShowRuleSelector(false)}
      >
        <View style={s.selectorOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowRuleSelector(false)} />
          <View style={[s.selectorSheet, { paddingBottom: insets.bottom + 24 }]}>
            <View style={s.selectorHandle} />
            <View style={s.selectorHeader}>
              <Text style={s.selectorTitle}>Prayer Rule</Text>
              <TouchableOpacity
                onPress={() => setShowRuleSelector(false)}
                style={s.selectorClose}
                activeOpacity={0.76}
              >
                <X s={17} c="#78716C" />
              </TouchableOpacity>
            </View>

            <View style={s.selectorList}>
              {RULE_OPTIONS.map(rule => {
                const active = rule.id === selectedRule;

                return (
                  <TouchableOpacity
                    key={rule.id}
                    onPress={() => handleRulePress(rule.id)}
                    activeOpacity={0.78}
                    style={[
                      s.selectorOption,
                      active
                        ? { backgroundColor: theme.bg, borderColor: theme.border }
                        : s.selectorOptionInactive,
                    ]}
                  >
                    <View style={s.selectorCopy}>
                      <Text style={[s.selectorOptionTitle, { color: active ? theme.accent : C.text }]}>
                        {rule.label}
                      </Text>
                      <Text style={s.selectorOptionSub}>{RULE_DESCRIPTIONS[rule.id]}</Text>
                    </View>
                    {active && <CheckSmall s={18} c={theme.accent} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  readerRulePill: {
    minHeight: 34,
    maxWidth: '88%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderRadius: 17,
    paddingHorizontal: 14,
    marginTop: 8,
    marginBottom: 2,
  },
  readerRuleText: { flexShrink: 1, fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', textAlign: 'center' },
  quote: {
    fontFamily: F.serifItalic,
    fontSize: 18,
    lineHeight: 27,
    color: 'rgba(122,98,69,0.8)',
    textAlign: 'center',
    paddingHorizontal: 26,
    marginTop: 24,
    marginBottom: 8,
  },
  quoteRef: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 2,
    color: 'rgba(197,160,89,0.6)',
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 9,
    marginTop: 3,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 14,
    paddingBottom: 74,
    paddingTop: 10,
  },
  centerCompact: {
    paddingBottom: 18,
    paddingTop: 8,
  },
  timerWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  timerWrapCompact: { marginTop: 2 },
  pulseRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(197,160,89,0.32)',
  },
  pulseRingOuter: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: 'rgba(197,160,89,0.22)',
  },
  glow: {
    position: 'absolute',
    backgroundColor: C.gold,
  },
  timerTextWrap: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  timeText: { fontFamily: F.serifBold },
  colonText: { fontFamily: F.serifBold, opacity: 0.35, marginHorizontal: 3 },
  bookWrap: { position: 'absolute', top: '55%', left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  bookAura: {
    position: 'absolute',
    width: 86,
    height: 30,
    borderRadius: 999,
    backgroundColor: 'rgba(197,160,89,0.24)',
    top: 61,
  },
  bookLottie: { width: 168, height: 168 },
  controlsDeck: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginTop: 54,
    backgroundColor: '#FFFFFF',
    padding: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(28,25,23,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.08,
    shadowRadius: 30,
    elevation: 9,
  },
  controlsDeckCompact: {
    gap: 16,
    marginTop: 26,
    padding: 8,
    paddingHorizontal: 12,
  },
  mainControl: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 10,
  },
  mainControlCompact: { width: 64, height: 64, borderRadius: 32 },
  smallControl: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  smallControlCompact: { width: 48, height: 48, borderRadius: 24 },
  smallLabel: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 0.8, color: 'rgba(28,25,23,0.32)', marginTop: 2, textTransform: 'uppercase' },
  selectorOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(28,25,23,0.24)' },
  selectorSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 10, paddingHorizontal: 18, shadowColor: '#000', shadowOpacity: 0.18, shadowOffset: { width: 0, height: -10 }, shadowRadius: 28, elevation: 18 },
  selectorHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#E7E5E4', alignSelf: 'center', marginBottom: 12 },
  selectorHeader: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  selectorTitle: { fontFamily: F.serifMedium, fontSize: 21, color: C.text },
  selectorClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F5F5F4', alignItems: 'center', justifyContent: 'center' },
  selectorList: { gap: 10 },
  selectorOption: { minHeight: 72, borderRadius: 18, borderWidth: 1, paddingHorizontal: 15, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  selectorOptionInactive: { backgroundColor: '#FAFAF9', borderColor: '#EEE9E0' },
  selectorCopy: { flex: 1, minWidth: 0 },
  selectorOptionTitle: { fontFamily: F.serifMedium, fontSize: 19, lineHeight: 23 },
  selectorOptionSub: { marginTop: 3, fontFamily: F.sansBold, fontSize: 9, lineHeight: 13, letterSpacing: 1.5, color: '#A8A29E', textTransform: 'uppercase' },
});
