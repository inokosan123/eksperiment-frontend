import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import FocusLottie from '@/components/focus/FocusLottie';
import ConfirmModal from '@/components/shared/ConfirmModal';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import { ArrowLeft, CheckSmall, Clock, Pause, Play, X } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import { useReadingList } from '@/components/library/ReadingListContext';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';


// Minutes values: 5, 10, 15, ... 300
const MINUTE_VALUES = Array.from({ length: 60 }, (_, i) => (i + 1) * 5);
const ITEM_H = 52;
const VISIBLE = 5;

const GOLD = '#C5A059';
const INK  = '#1C1917';
const DONE_COLOR = '#86BFAD';
const TRACK_COLOR = '#E7E5E4';
const PRESETS = [30, 60, 90];

const QUOTE = '"The heart of the prudent getteth knowledge; and the ear of the wise seeketh knowledge."';
const QUOTE_REF = 'Proverbs 18:15';

// SVG uses viewBox 0 0 100 100 — radius in viewBox units
const VB_R = 45;
const VB_CIRC = 2 * Math.PI * VB_R;

type Props = {
  bookId?: string | null;
  title: string;
  author?: string;
  isTask?: boolean;
  showFinishLoader?: boolean;
  sessionDate?: string;
  onBack: () => void;
  onComplete?: (elapsedMinutes: number) => boolean | void | Promise<boolean | void>;
};

export default function ReadingSessionView({
  bookId = null,
  title,
  author,
  isTask = false,
  showFinishLoader = false,
  sessionDate,
  onBack,
  onComplete,
}: Props) {
  const { width, height } = useWindowDimensions();
  const { recordSession } = useReadingList();
  const isFree = !bookId;

  // Timer state
  const [selectedSecs, setSelectedSecs] = useState(30 * 60);
  const [timerSecs, setTimerSecs] = useState(30 * 60);
  const [running, setRunning] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showExit, setShowExit] = useState(false);
  const [showFinish, setShowFinish] = useState(false);

  const celebrated = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const timerLift = useSharedValue(0);
  const sandyOpacity = useSharedValue(0);

  // Dimensions — same approach as Focus Zone
  const isCompactHeight = height < 720;
  const diameter = Math.min(width - (isCompactHeight ? 72 : 30), isCompactHeight ? 292 : 348);
  const timeFont = Math.round(diameter * 0.265);
  const colonFont = Math.round(diameter * 0.10);

  // Countdown
  useEffect(() => {
    if (running && timerSecs > 0) {
      timerRef.current = setInterval(() => {
        setTimerSecs(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [running]);

  // Celebrate on done
  useEffect(() => {
    if (timerSecs === 0 && !celebrated.current && selectedSecs > 0) {
      celebrated.current = true;
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [timerSecs]);

  // Animate on running change
  useEffect(() => {
    timerLift.value = withSpring(running ? -14 : 0, {
      damping: 17,
      stiffness: 190,
      mass: 0.8,
    });
    sandyOpacity.value = withTiming(running ? 1 : 0, { duration: running ? 340 : 180 });
  }, [running, sandyOpacity, timerLift]);

  const timerTextMotionStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: timerLift.value }],
  }));

  const sandyMotionStyle = useAnimatedStyle(() => ({
    opacity: sandyOpacity.value,
  }));

  // Android back
  useEffect(() => {
    const h = BackHandler.addEventListener('hardwareBackPress', () => {
      if (running) { setShowExit(true); return true; }
      return false;
    });
    return () => h.remove();
  }, [running]);

  const done     = timerSecs === 0;
  const progress = done ? 1 : (selectedSecs - timerSecs) / Math.max(1, selectedSecs);
  const offset   = VB_CIRC * (1 - progress);
  const mins = String(Math.floor(timerSecs / 60)).padStart(2, '0');
  const secs = String(timerSecs % 60).padStart(2, '0');
  const isCustom = !PRESETS.includes(selectedSecs / 60);
  const currentMins = Math.round(selectedSecs / 60);
  const ringColor = done ? DONE_COLOR : (running ? GOLD : INK);
  const trackColor = running ? TRACK_COLOR : INK;

  const selectPreset = useCallback((m: number) => {
    const s = m * 60;
    setSelectedSecs(s); setTimerSecs(s);
    setRunning(false);
    celebrated.current = false;
  }, []);

  const confirmCustom = useCallback((m: number) => {
    const s = m * 60;
    setSelectedSecs(s); setTimerSecs(s);
    setRunning(false); celebrated.current = false;
    setShowPicker(false);
  }, []);

  const handleFinish = useCallback(async () => {
    const elapsed = Math.round((selectedSecs - timerSecs) / 60);
    let completedSuccessfully: boolean | void = undefined;
    if (onComplete) {
      completedSuccessfully = await onComplete(elapsed);
    } else if (elapsed >= 1 && bookId) {
      await recordSession(bookId, elapsed, sessionDate);
    }
    if (completedSuccessfully === false) return;
    onBack();
  }, [selectedSecs, timerSecs, bookId, recordSession, sessionDate, onComplete, onBack]);

  return (
    <View style={s.screen}>

      {/* Header */}
      <ScreenTitleBar
        title={isFree ? 'Reading Session' : title}
        showBack
        onBackOverride={running ? () => setShowExit(true) : undefined}
        compactBottom
      />

      {/* Quote — directly below header */}
      <Text style={s.quote}>{QUOTE}</Text>
      <Text style={s.quoteRef}>{QUOTE_REF}</Text>

      {/* Center — presets + ring + controls */}
      <View style={[s.center, isCompactHeight && s.centerCompact]}>

        {/* Presets */}
        {/* Segmented control + custom link */}
        <View style={[s.segWrap, running && s.segDisabled]}>
          <View style={s.seg}>
            {PRESETS.map(m => {
              const active = selectedSecs === m * 60 && !isCustom;
              return (
                <TouchableOpacity
                  key={m}
                  onPress={() => { if (!running) selectPreset(m); }}
                  activeOpacity={running ? 1 : 0.82}
                  style={[s.segItem, active && s.segItemActive]}
                >
                  <Text style={[s.segText, active && s.segTextActive]}>{m}m</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            onPress={() => { if (!running) setShowPicker(true); }}
            activeOpacity={running ? 1 : 0.7}
            style={s.customLink}
          >
            <Clock s={12} c={isCustom ? GOLD : '#9C948C'} w={2} />
            <Text style={[s.customLinkText, isCustom && s.customLinkTextActive]}>
              {isCustom ? `${currentMins} min — custom` : 'Set custom time'}
            </Text>
          </TouchableOpacity>
        </View>

        <MinutesPicker
          visible={showPicker}
          initialValue={currentMins}
          onClose={() => setShowPicker(false)}
          onConfirm={confirmCustom}
        />

        {/* Ring — Focus Zone proportions */}
        <View style={[s.timerWrap, isCompactHeight && s.timerWrapCompact, { width: diameter, height: diameter }]}>
          <Svg
            width={diameter}
            height={diameter}
            viewBox="0 0 100 100"
            style={StyleSheet.absoluteFill}
          >
            {/* Inner glow fill */}
            <Circle cx="50" cy="50" r={VB_R - 0.5} fill={GOLD} opacity={running ? 0.07 : 0} />
            {/* Track */}
            <Circle cx="50" cy="50" r={VB_R} strokeWidth={1.6} fill="none" stroke={trackColor} strokeLinecap="round" />
            {/* Progress arc */}
            <Circle
              cx="50" cy="50" r={VB_R}
              strokeWidth={1.8}
              fill="none"
              strokeLinecap="round"
              stroke={ringColor}
              strokeDasharray={`${VB_CIRC}`}
              strokeDashoffset={offset}
              transform="rotate(-90 50 50)"
            />
          </Svg>

          {/* Timer text */}
          {done ? (
            <View style={s.doneWrap}>
              <View style={s.doneCircle}>
                <CheckSmall s={32} c={DONE_COLOR} w={1.8} />
              </View>
              <Text style={[s.doneLabel, { color: DONE_COLOR }]}>Complete</Text>
            </View>
          ) : (
            <>
              <Reanimated.View style={[s.timerTextWrap, timerTextMotionStyle]}>
                <Text style={[s.timeText, { color: ringColor, fontSize: timeFont, lineHeight: timeFont + 4 }]}>{mins}</Text>
                <Text style={[s.colonText, { color: ringColor, fontSize: colonFont }]}>:</Text>
                <Text style={[s.timeText, { color: ringColor, fontSize: timeFont, lineHeight: timeFont + 4 }]}>{secs}</Text>
              </Reanimated.View>

              <Reanimated.View style={[s.sandyWrap, sandyMotionStyle]}>
                <FocusLottie name="meru-book" loop speed={0.6} style={s.sandyLottie} />
              </Reanimated.View>
            </>
          )}
        </View>

        {/* Controls deck — Focus Zone pill style */}
        <View style={[s.controlsDeck, isCompactHeight && s.controlsDeckCompact]}>
          {/* Reset — small left */}
          <TouchableOpacity
            onPress={() => selectPreset(selectedSecs / 60)}
            activeOpacity={0.78}
            style={[s.smallControl, isCompactHeight && s.smallControlCompact, running && { opacity: 0.22 }]}
            disabled={running}
          >
            <Text style={s.resetGlyph}>↺</Text>
            <Text style={s.smallLabel}>Reset</Text>
          </TouchableOpacity>

          {/* Start/Pause — main center */}
          <TouchableOpacity
            onPress={() => { if (!done) setRunning(p => !p); }}
            activeOpacity={0.88}
            disabled={done}
            style={[
              s.mainControl,
              isCompactHeight && s.mainControlCompact,
              { backgroundColor: running ? GOLD : INK, shadowColor: running ? GOLD : INK },
              done && { opacity: 0.35 },
            ]}
          >
            {running ? <Pause s={isCompactHeight ? 26 : 30} c="#FFFFFF" /> : <Play s={isCompactHeight ? 26 : 30} c="#FFFFFF" />}
          </TouchableOpacity>

          {/* Finish — small right */}
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
        icon={<ArrowLeft s={22} c={C.red} />}
        iconBg="#FEF2F2"
        title="Exit Reading?"
        body="Your timer progress will be lost."
        cancelLabel="STAY"
        confirmLabel="EXIT"
        onCancel={() => setShowExit(false)}
        onConfirm={() => { setShowExit(false); onBack(); }}
      />

      <ConfirmModal
        visible={showFinish}
        icon={<CheckSmall s={22} c={GOLD} w={2.5} />}
        iconBg="#FFF8E0"
        title="Mark as Complete?"
        body="This will mark the reading task as done for today."
        cancelLabel="CANCEL"
        confirmLabel="COMPLETE"
        confirmColor={GOLD}
        confirmLoading={showFinishLoader}
        onCancel={() => setShowFinish(false)}
        onConfirm={handleFinish}
      />
    </View>
  );
}

// ─── Minutes Drum Picker ─────────────────────────────────────────────────────

function MinutesPicker({
  visible,
  initialValue,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  initialValue: number;
  onClose: () => void;
  onConfirm: (minutes: number) => void;
}) {
  const listRef = useRef<FlatList>(null);
  const [selected, setSelected] = useState(initialValue);

  // Snap to closest MINUTE_VALUES entry
  const nearest = MINUTE_VALUES.reduce((prev, cur) =>
    Math.abs(cur - initialValue) < Math.abs(prev - initialValue) ? cur : prev,
  );

  useEffect(() => {
    if (!visible) return;
    const v = MINUTE_VALUES.includes(initialValue) ? initialValue : nearest;
    setSelected(v);
    const idx = MINUTE_VALUES.indexOf(v);
    setTimeout(() => {
      listRef.current?.scrollToIndex({ index: Math.max(0, idx), animated: false });
    }, 80);
  }, [visible]);

  const pickerH = ITEM_H * VISIBLE;

  return (
    <SmoothBottomSheet visible={visible} onClose={onClose} sheetStyle={ps.sheet} keyboardAware>
      <View style={ps.handle} />
      <View style={ps.head}>
        <Text style={ps.title}>Custom Time</Text>
        <TouchableOpacity onPress={onClose} activeOpacity={0.84} style={ps.closeBtn}>
          <X s={18} c="#A8A29E" />
        </TouchableOpacity>
      </View>

      <View style={[ps.wheelWrap, { height: pickerH }]}>
        <View pointerEvents="none" style={[ps.selectionLine, { top: pickerH / 2 - ITEM_H / 2 }]} />
        <View pointerEvents="none" style={[ps.selectionLine, { top: pickerH / 2 + ITEM_H / 2 - 1 }]} />
        <LinearGradient
          pointerEvents="none"
          colors={['#FFFBF4', 'rgba(255,251,244,0)']}
          style={[ps.fade, ps.fadeTop]}
        />
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,251,244,0)', '#FFFBF4']}
          style={[ps.fade, ps.fadeBottom]}
        />

        <FlatList
          ref={listRef}
          data={MINUTE_VALUES}
          keyExtractor={item => String(item)}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_H}
          decelerationRate="fast"
          contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
          getItemLayout={(_, index) => ({ length: ITEM_H, offset: ITEM_H * index, index })}
          onMomentumScrollEnd={e => {
            const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
            const val = MINUTE_VALUES[Math.max(0, Math.min(idx, MINUTE_VALUES.length - 1))];
            setSelected(val);
            if (Platform.OS !== 'web') Haptics.selectionAsync();
          }}
          renderItem={({ item }) => {
            const active = item === selected;
            return (
              <View style={ps.item}>
                <Text style={[ps.itemText, active && ps.itemTextActive]}>
                  {item} <Text style={[ps.itemUnit, active && ps.itemUnitActive]}>min</Text>
                </Text>
              </View>
            );
          }}
        />
      </View>

      <TouchableOpacity onPress={() => onConfirm(selected)} activeOpacity={0.88} style={ps.saveBtn}>
        <Text style={ps.saveTxt}>SET TIME</Text>
      </TouchableOpacity>
    </SmoothBottomSheet>
  );
}

const ps = StyleSheet.create({
  sheet: { borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: '#FFFEFB', paddingHorizontal: 18, paddingTop: 12, paddingBottom: 28, gap: 16 },
  handle: { width: 42, height: 4, borderRadius: 999, backgroundColor: '#D6D3D1', alignSelf: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: F.serifMedium, fontSize: 22, color: '#1F2937' },
  closeBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F2EC' },
  wheelWrap: { borderRadius: 22, borderWidth: 1, borderColor: 'rgba(197,160,89,0.18)', backgroundColor: '#FFFBF4', overflow: 'hidden' },
  selectionLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(197,160,89,0.45)', zIndex: 2 },
  fade: { position: 'absolute', left: 0, right: 0, height: ITEM_H * 2, zIndex: 1, pointerEvents: 'none' },
  fadeTop: { top: 0 },
  fadeBottom: { bottom: 0 },
  item: { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
  itemText: { fontFamily: F.serifMedium, fontSize: 22, color: 'rgba(28,25,23,0.28)', letterSpacing: 0.2 },
  itemTextActive: { color: GOLD, fontSize: 26 },
  itemUnit: { fontFamily: F.sansBold, fontSize: 12, color: 'rgba(28,25,23,0.2)' },
  itemUnitActive: { color: 'rgba(197,160,89,0.6)' },
  saveBtn: { minHeight: 56, borderRadius: 22, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', shadowColor: GOLD, shadowOpacity: 0.24, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  saveTxt: { fontFamily: F.sansBold, fontSize: 12, letterSpacing: 2, color: '#fff' },
});

// ─────────────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF', overflow: 'hidden' },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 86,
    paddingTop: 12,
  },
  centerCompact: {
    paddingBottom: 18,
    paddingTop: 14,
  },

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

  segWrap: { width: '100%', alignItems: 'center', gap: 6, marginBottom: 4 },
  segDisabled: { opacity: 0.32 },

  seg: {
    flexDirection: 'row',
    width: '74%',
    backgroundColor: '#F3F2EF',
    borderRadius: 19,
    padding: 3,
    gap: 3,
  },
  segItem: {
    flex: 1,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segItemActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.22)',
  },
  segText: { fontFamily: F.sansBold, fontSize: 13, letterSpacing: 0.8, color: '#A8A29E' },
  segTextActive: { fontFamily: F.sansBold, fontSize: 13, letterSpacing: 0.8, color: GOLD },

  customLink: {
    minHeight: 29,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#FFFBF4',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.16)',
  },
  customLinkText: { fontFamily: F.sansMedium, fontSize: 13.5, color: '#9C948C', letterSpacing: 0.25 },
  customLinkTextActive: { color: GOLD, fontFamily: F.sansSemiBold },


  // Ring — Focus Zone style
  timerWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center', marginTop: 5, marginBottom: 20 },
  timerWrapCompact: { marginTop: 0, marginBottom: 10 },
  timerTextWrap: { position: 'absolute', flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' },
  timeText: { fontFamily: F.serifBold, letterSpacing: -1 },
  colonText: { fontFamily: F.serifBold, opacity: 0.35, marginHorizontal: 3 },
  sandyWrap: { position: 'absolute', top: '54%', left: 0, right: 0, alignItems: 'center' },
  sandyLottie: { width: 158, height: 158 },

  doneWrap: { position: 'absolute', alignItems: 'center', gap: 8 },
  doneCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(134,191,173,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  doneLabel: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' },

  // Controls deck — Focus Zone pill
  controlsDeck: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
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
    padding: 8,
    paddingHorizontal: 12,
  },
  mainControl: {
    width: 74, height: 74, borderRadius: 37,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28, shadowRadius: 18, elevation: 10,
  },
  mainControlCompact: { width: 64, height: 64, borderRadius: 32 },
  smallControl: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  smallControlCompact: { width: 48, height: 48, borderRadius: 24 },
  smallLabel: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 0.8, color: 'rgba(28,25,23,0.32)', marginTop: 2, textTransform: 'uppercase' },
  resetGlyph: { fontSize: 22, color: 'rgba(28,25,23,0.38)', lineHeight: 24 },
});
