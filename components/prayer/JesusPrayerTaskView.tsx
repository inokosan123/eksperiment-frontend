import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ConfirmModal from '@/components/shared/ConfirmModal';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import { CheckSmall, ChevronDown, Clock, Minus, Pause, Play, Plus, RotateCcw, Settings, Target, X } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { playPrayerCompleteFeedback, preloadPrayerCompleteSound } from '@/components/prayer/prayerFeedback';

type JesusPrayerMode = 'duration' | 'count';

type Props = {
  title?: string;
  mode?: string;
  durationMinutes?: number;
  targetCount?: number;
  isTask?: boolean;
  onBack: () => void;
  onComplete?: () => void | Promise<void>;
};

const GOLD = '#C5A059';
const DONE_COLOR = '#86BFAD';
const VB_R = 45;
const VB_CIRC = 2 * Math.PI * VB_R;
const DURATION_PRESETS = [5, 10, 15, 30, 45, 60];
const COUNT_PRESETS = [33, 50, 100, 300, 500];
const JESUS_PRAYER = 'Lord Jesus Christ, Son of God, have mercy on me, a sinner.';

function normalizeMode(value?: string): JesusPrayerMode {
  return value === 'count' ? 'count' : 'duration';
}

function clampPositive(value: number, fallback: number, max: number) {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(max, Math.max(1, Math.round(value)));
}

function formatTime(totalSecs: number) {
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;

  if (hours > 0) {
    return {
      main: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
      tail: String(seconds).padStart(2, '0'),
      hasHours: true,
    };
  }

  return {
    main: String(minutes).padStart(2, '0'),
    tail: String(seconds).padStart(2, '0'),
    hasHours: false,
  };
}

export default function JesusPrayerTaskView({
  title,
  mode,
  durationMinutes = 15,
  targetCount = 100,
  isTask = false,
  onBack,
  onComplete,
}: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const initialMode = normalizeMode(mode);
  const initialDuration = clampPositive(durationMinutes, 15, 360);
  const initialCount = clampPositive(targetCount, 100, 10000);

  const [prayerMode, setPrayerMode] = useState<JesusPrayerMode>(initialMode);
  const [duration, setDuration] = useState(initialDuration);
  const [countTarget, setCountTarget] = useState(initialCount);
  const [remainingSecs, setRemainingSecs] = useState(initialDuration * 60);
  const [count, setCount] = useState(0);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [showFinishEarly, setShowFinishEarly] = useState(false);
  const [showValueSheet, setShowValueSheet] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishLockRef = useRef(false);
  const celebratedRef = useRef(false);
  const pulseActiveRef = useRef(false);
  const pulse = useSharedValue(0);
  const tapPulse = useSharedValue(0);

  const isCompactHeight = height < 720;
  const diameter = Math.min(width - (isCompactHeight ? 56 : 22), isCompactHeight ? 314 : 368);
  const timeObj = formatTime(remainingSecs);
  const timeFont = timeObj.hasHours ? (isCompactHeight ? 56 : 66) : (isCompactHeight ? 84 : 100);
  const colonFont = timeObj.hasHours ? (isCompactHeight ? 22 : 28) : (isCompactHeight ? 31 : 38);
  const durationProgress = 1 - remainingSecs / Math.max(1, duration * 60);
  const countProgress = count / Math.max(1, countTarget);
  const progress = Math.max(0, Math.min(1, prayerMode === 'count' ? countProgress : durationProgress));
  const ringColor = completed ? DONE_COLOR : running ? GOLD : C.text;
  const screenTitle = title?.trim() || 'Jesus Prayer';
  const valueLabel = prayerMode === 'duration' ? `${duration} min` : `${countTarget} reps`;

  useEffect(() => {
    if (prayerMode !== 'duration' || !running || remainingSecs <= 0) return;

    timerRef.current = setInterval(() => {
      setRemainingSecs(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          setRunning(false);
          setCompleted(true);
          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [prayerMode, remainingSecs, running]);

  useEffect(() => {
    const active = running || (prayerMode === 'count' && count > 0 && !completed);
    if (active === pulseActiveRef.current) return;
    pulseActiveRef.current = active;

    pulse.value = active
      ? withRepeat(
        withSequence(
          withTiming(1, { duration: 1120 }),
          withTiming(0, { duration: 1120 }),
        ),
        -1,
        false,
      )
      : withTiming(0, { duration: 180 });
  }, [completed, count, prayerMode, pulse, running]);

  useEffect(() => {
    preloadPrayerCompleteSound();
  }, []);

  useEffect(() => {
    if (!completed || celebratedRef.current) return;
    celebratedRef.current = true;
    void playPrayerCompleteFeedback();
  }, [completed]);

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (running) {
        setShowFinishEarly(true);
        return true;
      }
      return false;
    });

    return () => handler.remove();
  }, [running]);

  const pulseRingStyle = useAnimatedStyle(() => ({
    opacity: (running || (prayerMode === 'count' && count > 0 && !completed)) ? 0.32 * (1 - pulse.value) : 0,
    transform: [{ scale: 0.97 + pulse.value * 0.12 }],
  }));

  const pulseRingOuterStyle = useAnimatedStyle(() => ({
    opacity: (running || (prayerMode === 'count' && count > 0 && !completed)) ? 0.20 * pulse.value : 0,
    transform: [{ scale: 1 + pulse.value * 0.11 }],
  }));

  const tapStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + tapPulse.value * 0.045 }],
  }));

  const reset = useCallback(() => {
    setRunning(false);
    setCompleted(false);
    celebratedRef.current = false;
    if (prayerMode === 'duration') {
      setRemainingSecs(duration * 60);
    } else {
      setCount(0);
    }
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
  }, [duration, prayerMode]);

  const completeAndClose = useCallback(async () => {
    if (finishLockRef.current) return;
    finishLockRef.current = true;
    setRunning(false);
    await onComplete?.();
    onBack();
  }, [onBack, onComplete]);

  const finish = useCallback(() => {
    if (completed) {
      void completeAndClose();
      return;
    }
    setShowFinishEarly(true);
  }, [completeAndClose, completed]);

  const incrementCount = useCallback(() => {
    if (prayerMode !== 'count' || completed) return;
    tapPulse.value = 0;
    tapPulse.value = withSequence(
      withTiming(1, { duration: 85 }),
      withTiming(0, { duration: 160 }),
    );
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }

    setCount(prev => {
      const next = Math.min(countTarget, prev + 1);
      if (next >= countTarget) {
        setCompleted(true);
      }
      return next;
    });
  }, [completed, countTarget, prayerMode, tapPulse]);

  const countTap = useMemo(() => (
    Gesture.Tap()
      .enabled(prayerMode === 'count' && !completed)
      .onEnd(() => {
        runOnJS(incrementCount)();
      })
  ), [completed, incrementCount, prayerMode]);

  const applyValue = useCallback((nextMode: JesusPrayerMode, value: number) => {
    setRunning(false);
    setCompleted(false);
    celebratedRef.current = false;
    setPrayerMode(nextMode);

    if (nextMode === 'duration') {
      const next = clampPositive(value, duration, 360);
      setDuration(next);
      setRemainingSecs(next * 60);
      setCount(0);
    } else {
      const next = clampPositive(value, countTarget, 10000);
      setCountTarget(next);
      setCount(0);
    }
    setShowValueSheet(false);
  }, [countTarget, duration]);

  return (
    <View style={s.screen}>
      <ScreenTitleBar
        title={screenTitle}
        showBack
        onBackOverride={running ? () => setShowFinishEarly(true) : undefined}
        compactBottom
      />

      <View style={s.topWrap}>
        <TouchableOpacity
          onPress={() => setShowValueSheet(true)}
          activeOpacity={0.78}
          style={s.valuePill}
        >
          <Text style={s.valuePillText}>
            {prayerMode === 'duration' ? 'BY TIME' : 'BY COUNT'} · {valueLabel}
          </Text>
          <ChevronDown s={13} c={GOLD} w={2.2} />
        </TouchableOpacity>
        <Text style={s.prayerText}>{JESUS_PRAYER}</Text>
      </View>

      <View style={[s.center, isCompactHeight && s.centerCompact]}>
        <GestureDetector gesture={countTap}>
          <Reanimated.View style={[s.timerWrap, tapStyle, { width: diameter, height: diameter }]}>
            <Reanimated.View pointerEvents="none" style={[s.pulseRing, { width: diameter * 1.02, height: diameter * 1.02, borderRadius: diameter * 0.51 }, pulseRingStyle]} />
            <Reanimated.View pointerEvents="none" style={[s.pulseRingOuter, { width: diameter * 1.11, height: diameter * 1.11, borderRadius: diameter * 0.555 }, pulseRingOuterStyle]} />
            <Svg width={diameter} height={diameter} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
              <Circle cx="50" cy="50" r={VB_R - 0.5} fill={GOLD} opacity={running || count > 0 ? 0.08 : 0.045} />
              <Circle cx="50" cy="50" r={VB_R} strokeWidth={1.55} fill="none" stroke="#E5E0D8" strokeLinecap="round" />
              <Circle
                cx="50"
                cy="50"
                r={VB_R}
                strokeWidth={1.95}
                fill="none"
                strokeLinecap="round"
                stroke={ringColor}
                strokeDasharray={`${VB_CIRC}`}
                strokeDashoffset={VB_CIRC * (1 - progress)}
                transform="rotate(-90 50 50)"
              />
            </Svg>

            {prayerMode === 'duration' ? (
              <View style={s.timerTextWrap}>
                {completed ? (
                  <View style={s.doneWrap}>
                    <View style={s.doneCircle}>
                      <CheckSmall s={32} c={DONE_COLOR} w={1.8} />
                    </View>
                    <Text style={s.doneLabel}>Complete</Text>
                  </View>
                ) : (
                  <>
                    <Text style={[s.timeText, { color: ringColor, fontSize: timeFont, lineHeight: timeFont + 4 }]}>{timeObj.main}</Text>
                    <Text style={[s.colonText, { color: ringColor, fontSize: colonFont }]}>:</Text>
                    <Text style={[s.timeText, { color: ringColor, fontSize: timeFont, lineHeight: timeFont + 4 }]}>{timeObj.tail}</Text>
                  </>
                )}
              </View>
            ) : (
              <View style={s.counterTextWrap}>
                <Text style={[s.counterNumber, completed && s.counterNumberDone]}>{count}</Text>
                <Text style={s.counterTarget}>OF {countTarget}</Text>
                <Text style={[s.tapHint, completed && s.tapHintDone]}>
                  {completed ? 'COMPLETE' : 'TAP TO COUNT'}
                </Text>
              </View>
            )}
          </Reanimated.View>
        </GestureDetector>

        <View style={[s.controlsDeck, isCompactHeight && s.controlsDeckCompact]}>
          <TouchableOpacity onPress={reset} activeOpacity={0.78} style={[s.smallControl, isCompactHeight && s.smallControlCompact]}>
            <RotateCcw s={isCompactHeight ? 18 : 21} c="rgba(28,25,23,0.38)" w={1.8} />
            <Text style={s.smallLabel}>Reset</Text>
          </TouchableOpacity>

          {prayerMode === 'duration' ? (
            <TouchableOpacity
              onPress={() => {
                if (completed) return;
                setRunning(value => !value);
              }}
              activeOpacity={0.88}
              disabled={completed}
              style={[
                s.mainControl,
                isCompactHeight && s.mainControlCompact,
                { backgroundColor: running ? GOLD : C.text, shadowColor: running ? GOLD : C.text },
                completed && s.mainControlDone,
              ]}
            >
              {running ? <Pause s={isCompactHeight ? 26 : 30} c="#FFFFFF" /> : <Play s={isCompactHeight ? 26 : 30} c="#FFFFFF" />}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => setShowValueSheet(true)} activeOpacity={0.84} style={[s.mainControl, isCompactHeight && s.mainControlCompact, s.targetControl]}>
              <Settings s={isCompactHeight ? 24 : 28} c="#FFFFFF" w={2.1} />
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={finish} activeOpacity={0.78} style={[s.smallControl, isCompactHeight && s.smallControlCompact]}>
            <CheckSmall s={isCompactHeight ? 19 : 22} c={completed ? DONE_COLOR : 'rgba(28,25,23,0.38)'} w={1.8} />
            <Text style={[s.smallLabel, completed && s.smallLabelDone]}>
              Finish
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ConfirmModal
        visible={showFinishEarly}
        icon={<CheckSmall s={22} c={GOLD} w={2.5} />}
        iconBg="#FFF8E0"
        title={completed ? 'Complete Jesus Prayer?' : 'Finish Early?'}
        body={completed ? 'This will mark the Jesus Prayer task as done.' : 'This will mark the Jesus Prayer task as done before reaching the target.'}
        cancelLabel="CANCEL"
        confirmLabel="FINISH"
        confirmColor={GOLD}
        onCancel={() => setShowFinishEarly(false)}
        onConfirm={() => {
          setShowFinishEarly(false);
          void completeAndClose();
        }}
      />

      <JesusValueSheet
        visible={showValueSheet}
        initialMode={prayerMode}
        initialDuration={duration}
        initialCount={countTarget}
        bottomInset={insets.bottom}
        onClose={() => setShowValueSheet(false)}
        onSave={applyValue}
      />
    </View>
  );
}

function JesusValueSheet({
  visible,
  initialMode,
  initialDuration,
  initialCount,
  bottomInset,
  onClose,
  onSave,
}: {
  visible: boolean;
  initialMode: JesusPrayerMode;
  initialDuration: number;
  initialCount: number;
  bottomInset: number;
  onClose: () => void;
  onSave: (mode: JesusPrayerMode, value: number) => void;
}) {
  const [draftMode, setDraftMode] = useState<JesusPrayerMode>(initialMode);
  const [draftDuration, setDraftDuration] = useState(initialDuration);
  const [draftCount, setDraftCount] = useState(initialCount);
  const [customDraft, setCustomDraft] = useState('');
  const [focused, setFocused] = useState(false);
  const [segmentWidth, setSegmentWidth] = useState(0);
  const tabMotion = useSharedValue(initialMode === 'count' ? 1 : 0);
  const tabContentMotion = useSharedValue(1);

  const isDuration = draftMode === 'duration';
  const value = isDuration ? draftDuration : draftCount;
  const presets = isDuration ? DURATION_PRESETS : COUNT_PRESETS;
  const max = isDuration ? 360 : 10000;
  const step = 1;
  const unit = isDuration ? 'min' : 'reps';
  const longUnit = isDuration ? 'minutes' : 'repetitions';

  useEffect(() => {
    if (!visible) return;
    setDraftMode(initialMode);
    setDraftDuration(initialDuration);
    setDraftCount(initialCount);
    tabMotion.value = initialMode === 'count' ? 1 : 0;
    tabContentMotion.value = 1;
  }, [visible, initialMode, initialDuration, initialCount, tabMotion, tabContentMotion]);

  useEffect(() => {
    tabMotion.value = withSpring(draftMode === 'count' ? 1 : 0, {
      damping: 18,
      stiffness: 235,
      mass: 0.72,
    });
    tabContentMotion.value = 0;
    tabContentMotion.value = withTiming(1, {
      duration: 230,
      easing: Easing.out(Easing.cubic),
    });
  }, [draftMode, tabContentMotion, tabMotion]);

  useEffect(() => {
    setCustomDraft(String(value));
  }, [value]);

  const setValue = useCallback((next: number) => {
    const clamped = clampPositive(next, value, max);
    if (isDuration) setDraftDuration(clamped);
    else setDraftCount(clamped);
  }, [isDuration, max, value]);

  const switchMode = (next: JesusPrayerMode) => {
    if (next === draftMode) return;
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    setDraftMode(next);
  };

  const choosePreset = (preset: number) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    setValue(preset);
  };

  const adjust = (delta: number) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setValue(value + delta);
  };

  const resolveCustom = useCallback(() => {
    const parsed = Number.parseInt(customDraft, 10);
    if (Number.isFinite(parsed) && parsed > 0) return clampPositive(parsed, value, max);
    return value;
  }, [customDraft, max, value]);

  const commitCustom = () => {
    const next = resolveCustom();
    if (next !== value) setValue(next);
    else setCustomDraft(String(value));
  };

  const handleSave = () => {
    const finalValue = resolveCustom();
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onSave(draftMode, finalValue);
  };

  const segmentPillStyle = useAnimatedStyle(() => ({
    transform: [{
      translateX: tabMotion.value * (((segmentWidth - 12) / 2) + 4),
    }],
  }));

  const tabContentMotionStyle = useAnimatedStyle(() => ({
    opacity: tabContentMotion.value,
    transform: [{ translateY: (1 - tabContentMotion.value) * 10 }],
  }));

  const customTrimmed = customDraft.replace(/^0+(?=\d)/, '');
  const customParsed = Number.parseInt(customDraft, 10);
  const customValid = Number.isFinite(customParsed) && customParsed > 0;

  return (
    <SmoothBottomSheet
      visible={visible}
      onClose={onClose}
      keyboardAware
      sheetStyle={[s.valueSheet, { paddingBottom: bottomInset + 24 }]}
    >
      <View style={s.sheetHandle} />
      <View style={s.sheetHead}>
        <View>
          <Text style={s.sheetEyebrow}>Prayer Setup</Text>
          <Text style={s.sheetTitle}>Choose your rhythm</Text>
        </View>
        <TouchableOpacity onPress={onClose} activeOpacity={0.82} style={s.sheetClose}>
          <X s={16} c="#A8A29E" w={2.4} />
        </TouchableOpacity>
      </View>

      <View
        style={s.segmentWrap}
        onLayout={event => setSegmentWidth(event.nativeEvent.layout.width)}
      >
        {segmentWidth > 0 && (
          <Reanimated.View
            pointerEvents="none"
            style={[
              s.segmentPill,
              { width: (segmentWidth - 12) / 2 },
              segmentPillStyle,
            ]}
          />
        )}
        <TouchableOpacity
          onPress={() => switchMode('duration')}
          activeOpacity={0.86}
          style={s.segmentBtn}
        >
          <Clock s={14} c={isDuration ? '#FFFFFF' : '#A8A29E'} w={2.2} />
          <Text style={[s.segmentText, isDuration && s.segmentTextActive]}>BY TIME</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => switchMode('count')}
          activeOpacity={0.86}
          style={s.segmentBtn}
        >
          <Target s={14} c={!isDuration ? '#FFFFFF' : '#A8A29E'} w={2.2} />
          <Text style={[s.segmentText, !isDuration && s.segmentTextActive]}>BY COUNT</Text>
        </TouchableOpacity>
      </View>

      <Reanimated.View style={[s.tabContent, tabContentMotionStyle]}>
        <View style={s.presetSection}>
          <Text style={s.presetSectionLabel}>QUICK CHOICE</Text>
          <View style={s.presetGrid}>
            {presets.map(item => {
              const active = item === value;
              return (
                <TouchableOpacity
                  key={item}
                  onPress={() => choosePreset(item)}
                  activeOpacity={0.84}
                  style={[s.presetChip, active && s.presetChipActive]}
                >
                  <Text style={[s.presetNum, active && s.presetNumActive]}>{item}</Text>
                  <Text style={[s.presetUnit, active && s.presetUnitActive]}>{unit}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={s.customSection}>
          <Text style={s.presetSectionLabel}>CUSTOM {isDuration ? 'TIME' : 'COUNT'}</Text>
          <View style={[s.customRow, focused && s.customRowFocused]}>
            <TouchableOpacity
              onPress={() => adjust(-step)}
              activeOpacity={0.74}
              style={s.stepperBtn}
              disabled={value <= 1}
            >
              <Minus s={16} c={value <= 1 ? '#D6D3D1' : GOLD} w={2.6} />
            </TouchableOpacity>

            <View style={s.customCenter}>
              <TextInput
                value={customTrimmed}
                onChangeText={text => setCustomDraft(text.replace(/[^\d]/g, '').slice(0, 5))}
                onFocus={() => setFocused(true)}
                onBlur={() => { setFocused(false); commitCustom(); }}
                keyboardType="number-pad"
                placeholder={isDuration ? '15' : '100'}
                placeholderTextColor="#D6D3D1"
                style={s.customInput}
                returnKeyType="done"
                onSubmitEditing={() => { Keyboard.dismiss(); commitCustom(); }}
                maxLength={5}
                selectTextOnFocus
              />
              <Text style={s.customUnit}>{longUnit}</Text>
            </View>

            <TouchableOpacity
              onPress={() => adjust(step)}
              activeOpacity={0.74}
              style={s.stepperBtn}
              disabled={value >= max}
            >
              <Plus s={16} c={value >= max ? '#D6D3D1' : GOLD} w={2.6} />
            </TouchableOpacity>
          </View>
        </View>
      </Reanimated.View>

      <TouchableOpacity
        onPress={handleSave}
        disabled={!customValid && customDraft !== ''}
        activeOpacity={0.88}
        style={[s.saveValueBtn, (!customValid && customDraft !== '') && s.saveValueBtnDisabled]}
      >
        <Text style={s.saveValueText}>START PRAYER · {resolveCustom()} {unit}</Text>
      </TouchableOpacity>
    </SmoothBottomSheet>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  topWrap: { alignItems: 'center', paddingTop: 8, paddingHorizontal: 24 },
  valuePill: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderRadius: 17,
    borderColor: 'rgba(197,160,89,0.28)',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  valuePillText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.8, color: GOLD, textTransform: 'uppercase' },
  prayerText: {
    fontFamily: F.serifItalic,
    fontSize: 21,
    lineHeight: 31,
    letterSpacing: 0.25,
    color: 'rgba(94,71,42,0.92)',
    textAlign: 'center',
    paddingHorizontal: 6,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 14,
    paddingTop: 28,
    paddingBottom: 74,
  },
  centerCompact: { paddingTop: 12, paddingBottom: 18 },
  timerWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  pulseRing: { position: 'absolute', borderWidth: 2, borderColor: 'rgba(197,160,89,0.42)' },
  pulseRingOuter: { position: 'absolute', borderWidth: 1.5, borderColor: 'rgba(197,160,89,0.30)' },
  timerTextWrap: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  timeText: { fontFamily: F.serifBold },
  colonText: { fontFamily: F.serifBold, opacity: 0.35, marginHorizontal: 3 },
  doneWrap: { alignItems: 'center', gap: 8 },
  doneCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(134,191,173,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneLabel: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: DONE_COLOR },
  counterTextWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  counterNumber: { fontFamily: F.serifBold, fontSize: 112, lineHeight: 118, color: GOLD },
  counterNumberDone: { color: DONE_COLOR },
  counterTarget: { marginTop: -6, fontFamily: F.sansBold, fontSize: 12, letterSpacing: 2.2, color: 'rgba(28,25,23,0.38)' },
  tapHint: { marginTop: 14, fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2, color: 'rgba(197,160,89,0.68)' },
  tapHintDone: { color: DONE_COLOR },
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
  controlsDeckCompact: { gap: 16, marginTop: 26, padding: 8, paddingHorizontal: 12 },
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
  mainControlDone: { opacity: 0.38 },
  targetControl: { backgroundColor: GOLD, shadowColor: GOLD },
  smallControl: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  smallControlCompact: { width: 48, height: 48, borderRadius: 24 },
  smallLabel: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 0.8, color: 'rgba(28,25,23,0.32)', marginTop: 2, textTransform: 'uppercase' },
  smallLabelDone: { color: DONE_COLOR },
  valueSheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: '#FFFEFB',
    paddingHorizontal: 18,
    paddingTop: 12,
    gap: 18,
  },
  sheetHandle: { width: 42, height: 4, borderRadius: 999, backgroundColor: '#E7E5E4', alignSelf: 'center' },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  sheetEyebrow: {
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 2,
    color: GOLD,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  sheetTitle: { fontFamily: F.serifMedium, fontSize: 22, lineHeight: 26, color: C.text },
  sheetClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F2EC',
  },

  segmentWrap: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ECE8E0',
    backgroundColor: '#FAF7F0',
    position: 'relative',
    overflow: 'hidden',
  },
  segmentPill: {
    position: 'absolute',
    left: 4,
    top: 4,
    bottom: 4,
    borderRadius: 16,
    backgroundColor: GOLD,
    shadowColor: GOLD,
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 3,
  },
  segmentBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    zIndex: 1,
  },
  segmentText: {
    fontFamily: F.sansBold,
    fontSize: 11,
    letterSpacing: 2,
    color: '#A8A29E',
    textTransform: 'uppercase',
  },
  segmentTextActive: { color: '#FFFFFF' },

  tabContent: { gap: 18 },
  presetSection: { gap: 10 },
  presetSectionLabel: {
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 2,
    color: '#A8A29E',
    textTransform: 'uppercase',
    paddingHorizontal: 2,
  },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presetChip: {
    flexBasis: '30%',
    flexGrow: 1,
    minHeight: 58,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EEE8DE',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  presetChipActive: {
    borderColor: GOLD,
    backgroundColor: '#FFF7E8',
    shadowColor: GOLD,
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  presetNum: { fontFamily: F.serifMedium, fontSize: 22, lineHeight: 26, color: '#78716C' },
  presetNumActive: { color: GOLD },
  presetUnit: {
    marginTop: 2,
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 1.6,
    color: '#A8A29E',
    textTransform: 'uppercase',
  },
  presetUnitActive: { color: '#B6822D' },

  customSection: { gap: 10 },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 76,
    borderRadius: 22,
    borderWidth: 1.2,
    borderColor: 'rgba(197,160,89,0.22)',
    backgroundColor: '#FFFBF4',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 12,
  },
  customRowFocused: {
    borderColor: GOLD,
    backgroundColor: '#FFFFFF',
    shadowColor: GOLD,
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 3,
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.20)',
  },
  customCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  customInput: {
    fontFamily: F.serifBold,
    fontSize: 38,
    lineHeight: 42,
    color: C.text,
    textAlign: 'center',
    padding: 0,
    minWidth: 80,
  },
  customUnit: {
    marginTop: 2,
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 1.8,
    color: '#A8A29E',
    textTransform: 'uppercase',
  },

  saveValueBtn: {
    minHeight: 56,
    borderRadius: 22,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: GOLD,
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  saveValueBtnDisabled: { backgroundColor: '#D6D3D1', shadowOpacity: 0 },
  saveValueText: { fontFamily: F.sansBold, fontSize: 11.5, letterSpacing: 2, color: '#FFFFFF' },
});
