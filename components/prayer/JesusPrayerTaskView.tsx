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
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ConfirmModal from '@/components/shared/ConfirmModal';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import { CheckSmall, ChevronDown, Pause, Play, RotateCcw, Settings } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';

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
  const prayerMode = normalizeMode(mode);
  const initialDuration = clampPositive(durationMinutes, 15, 360);
  const initialCount = clampPositive(targetCount, 100, 10000);

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
    if (!completed || celebratedRef.current) return;
    celebratedRef.current = true;
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
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

  const applyCustomValue = useCallback((value: number) => {
    if (prayerMode === 'duration') {
      const next = clampPositive(value, duration, 360);
      setDuration(next);
      setRemainingSecs(next * 60);
    } else {
      const next = clampPositive(value, countTarget, 10000);
      setCountTarget(next);
      setCount(current => Math.min(current, next));
      setCompleted(count >= next);
    }
    setRunning(false);
    celebratedRef.current = false;
    setShowValueSheet(false);
  }, [count, countTarget, duration, prayerMode]);

  const choosePreset = useCallback((value: number) => {
    applyCustomValue(value);
  }, [applyCustomValue]);

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
              {completed ? 'Finish' : 'Early'}
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
        mode={prayerMode}
        value={prayerMode === 'duration' ? duration : countTarget}
        presets={prayerMode === 'duration' ? DURATION_PRESETS : COUNT_PRESETS}
        bottomInset={insets.bottom}
        onClose={() => setShowValueSheet(false)}
        onPreset={choosePreset}
        onSave={applyCustomValue}
      />
    </View>
  );
}

function JesusValueSheet({
  visible,
  mode,
  value,
  presets,
  bottomInset,
  onClose,
  onPreset,
  onSave,
}: {
  visible: boolean;
  mode: JesusPrayerMode;
  value: number;
  presets: number[];
  bottomInset: number;
  onClose: () => void;
  onPreset: (value: number) => void;
  onSave: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    if (!visible) return;
    setDraft(String(value));
  }, [value, visible]);

  const parsed = Number.parseInt(draft, 10);
  const canSave = Number.isFinite(parsed) && parsed > 0;
  const unit = mode === 'duration' ? 'min' : 'reps';

  return (
    <SmoothBottomSheet
      visible={visible}
      onClose={onClose}
      keyboardAware
      sheetStyle={[s.valueSheet, { paddingBottom: bottomInset + 24 }]}
    >
      <View style={s.sheetHandle} />
      <View style={s.sheetHead}>
        <Text style={s.sheetTitle}>{mode === 'duration' ? 'Prayer Time' : 'Prayer Count'}</Text>
        <TouchableOpacity onPress={onClose} activeOpacity={0.82} style={s.sheetClose}>
          <Text style={s.sheetCloseText}>×</Text>
        </TouchableOpacity>
      </View>

      <View style={s.presetRow}>
        {presets.map(item => {
          const active = item === value;

          return (
            <TouchableOpacity
              key={item}
              onPress={() => onPreset(item)}
              activeOpacity={0.84}
              style={[s.presetChip, active && s.presetChipActive]}
            >
              <Text style={[s.presetText, active && s.presetTextActive]}>
                {item} {unit}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={s.customBox}>
        <Text style={s.customLabel}>Custom {mode === 'duration' ? 'time' : 'count'}</Text>
        <TextInput
          value={draft}
          onChangeText={text => setDraft(text.replace(/[^\d]/g, ''))}
          keyboardType="number-pad"
          placeholder={mode === 'duration' ? '15' : '100'}
          placeholderTextColor="#C9C5BD"
          style={s.customInput}
          returnKeyType="done"
          onSubmitEditing={() => {
            Keyboard.dismiss();
            if (canSave) onSave(parsed);
          }}
        />
      </View>

      <TouchableOpacity
        onPress={() => canSave && onSave(parsed)}
        disabled={!canSave}
        activeOpacity={0.88}
        style={[s.saveValueBtn, !canSave && s.saveValueBtnDisabled]}
      >
        <Text style={s.saveValueText}>SET {mode === 'duration' ? 'TIME' : 'COUNT'}</Text>
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
    fontSize: 18,
    lineHeight: 27,
    color: 'rgba(122,98,69,0.82)',
    textAlign: 'center',
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
  valueSheet: { borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: '#FFFEFB', paddingHorizontal: 18, paddingTop: 12, gap: 16 },
  sheetHandle: { width: 42, height: 4, borderRadius: 999, backgroundColor: '#D6D3D1', alignSelf: 'center' },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontFamily: F.serifMedium, fontSize: 22, color: '#1F2937' },
  sheetClose: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F2EC' },
  sheetCloseText: { fontFamily: F.sansBold, fontSize: 24, lineHeight: 28, color: '#A8A29E' },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presetChip: {
    minHeight: 42,
    minWidth: 92,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EEE8DE',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  presetChipActive: { borderColor: '#D7AA54', backgroundColor: '#FFF7E8' },
  presetText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 1.2, color: '#717782', textTransform: 'uppercase' },
  presetTextActive: { color: '#B6822D' },
  customBox: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.18)',
    backgroundColor: '#FFFBF4',
    padding: 14,
    gap: 8,
  },
  customLabel: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.6, color: '#9C948C', textTransform: 'uppercase' },
  customInput: {
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EEE8DE',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    fontFamily: F.serifMedium,
    fontSize: 24,
    color: C.text,
  },
  saveValueBtn: { minHeight: 56, borderRadius: 22, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', shadowColor: GOLD, shadowOpacity: 0.24, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  saveValueBtnDisabled: { backgroundColor: '#D6D3D1', shadowOpacity: 0 },
  saveValueText: { fontFamily: F.sansBold, fontSize: 12, letterSpacing: 2, color: '#FFFFFF' },
});
