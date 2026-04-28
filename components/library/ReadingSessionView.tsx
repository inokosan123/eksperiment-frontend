import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated, BackHandler, FlatList, Platform,
  StyleSheet, Text, TouchableOpacity, View, useWindowDimensions,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import FocusLottie from '@/components/focus/FocusLottie';
import ConfirmModal from '@/components/shared/ConfirmModal';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import { ArrowLeft, CheckSmall, Pause, Pencil, Play, X } from '@/components/icons/Icons';
import { F } from '@/constants/tokens';
import { useReadingList } from '@/components/library/ReadingListContext';

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
  onBack: () => void;
  onComplete?: () => void;
};

export default function ReadingSessionView({
  bookId = null,
  title,
  author,
  isTask = false,
  onBack,
  onComplete,
}: Props) {
  const { width } = useWindowDimensions();
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

  // Animated
  const numShift   = useRef(new Animated.Value(0)).current;
  const sandyAnim  = useRef(new Animated.Value(0)).current;
  const glowAnim   = useRef(new Animated.Value(0)).current;

  // Dimensions — same approach as Focus Zone
  const diameter = Math.min(width - 24, 360);
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
    Animated.parallel([
      Animated.spring(numShift, { toValue: running ? -14 : 0, useNativeDriver: true, tension: 60, friction: 10 }),
      Animated.timing(sandyAnim, { toValue: running ? 1 : 0, duration: 400, useNativeDriver: true }),
      Animated.timing(glowAnim,  { toValue: running ? 1 : 0, duration: 700, useNativeDriver: true }),
    ]).start();
  }, [running]);

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

  const handleFinish = useCallback(() => {
    const elapsed = Math.round((selectedSecs - timerSecs) / 60);
    if (elapsed >= 1 && bookId) recordSession(bookId, elapsed);
    if (isTask && Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onComplete?.();
    onBack();
  }, [selectedSecs, timerSecs, bookId, isTask, onComplete, onBack]);

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
      <View style={s.center}>

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
            <Pencil s={11} c={isCustom ? GOLD : '#B8B0A8'} />
            <Text style={[s.customLinkText, isCustom && s.customLinkTextActive]}>
              {isCustom ? `${currentMins} min — custom` : 'Custom time'}
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
        <View style={[s.timerWrap, { width: diameter, height: diameter }]}>
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
              <Animated.View style={[s.timerTextWrap, { transform: [{ translateY: numShift }] }]}>
                <Text style={[s.timeText, { color: ringColor, fontSize: timeFont, lineHeight: timeFont + 4 }]}>{mins}</Text>
                <Text style={[s.colonText, { color: ringColor, fontSize: colonFont }]}>:</Text>
                <Text style={[s.timeText, { color: ringColor, fontSize: timeFont, lineHeight: timeFont + 4 }]}>{secs}</Text>
              </Animated.View>

              <Animated.View style={[s.sandyWrap, { opacity: sandyAnim }]}>
                <FocusLottie name="meru-book" loop speed={0.6} style={s.sandyLottie} />
              </Animated.View>
            </>
          )}
        </View>

        {/* Controls deck — Focus Zone pill style */}
        <View style={s.controlsDeck}>
          {/* Finish — small left */}
          <TouchableOpacity
            onPress={() => isTask ? setShowFinish(true) : handleFinish()}
            activeOpacity={0.78}
            style={s.smallControl}
          >
            <CheckSmall s={22} c="rgba(28,25,23,0.38)" w={1.8} />
            <Text style={s.smallLabel}>Finish</Text>
          </TouchableOpacity>

          {/* Start/Pause — main center */}
          <TouchableOpacity
            onPress={() => { if (!done) setRunning(p => !p); }}
            activeOpacity={0.88}
            disabled={done}
            style={[
              s.mainControl,
              { backgroundColor: running ? GOLD : INK, shadowColor: running ? GOLD : INK },
              done && { opacity: 0.35 },
            ]}
          >
            {running ? <Pause s={30} c="#FFFFFF" /> : <Play s={30} c="#FFFFFF" />}
          </TouchableOpacity>

          {/* Reset — small right */}
          <TouchableOpacity
            onPress={() => selectPreset(selectedSecs / 60)}
            activeOpacity={0.78}
            style={[s.smallControl, running && { opacity: 0.22 }]}
            disabled={running}
          >
            <Text style={s.resetGlyph}>↺</Text>
            <Text style={s.smallLabel}>Reset</Text>
          </TouchableOpacity>
        </View>

      </View>

      <ConfirmModal
        visible={showExit}
        icon={<ArrowLeft s={22} c="#EF4444" />}
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

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingBottom: 28, paddingTop: 0 },

  quote: {
    fontFamily: F.serifItalic,
    fontSize: 17,
    lineHeight: 26,
    color: 'rgba(122,98,69,0.8)',
    textAlign: 'center',
    paddingHorizontal: 28,
    marginTop: 18,
    marginBottom: 6,
  },
  quoteRef: {
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 2,
    color: 'rgba(197,160,89,0.6)',
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 0,
    marginTop: 2,
  },

  segWrap: { width: '100%', alignItems: 'center', gap: 8, marginBottom: 8 },
  segDisabled: { opacity: 0.32 },

  seg: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: '#F3F2EF',
    borderRadius: 20,
    padding: 4,
    gap: 4,
  },
  segItem: {
    flex: 1,
    height: 38,
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

  customLink: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  customLinkText: { fontFamily: F.sansMedium, fontSize: 14, color: '#A8A29E', letterSpacing: 0.3 },
  customLinkTextActive: { color: GOLD, fontFamily: F.sansSemiBold },


  // Ring — Focus Zone style
  timerWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  timerTextWrap: { position: 'absolute', flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' },
  timeText: { fontFamily: F.serifBold, letterSpacing: -1 },
  colonText: { fontFamily: F.serifBold, opacity: 0.35, marginHorizontal: 3 },
  sandyWrap: { position: 'absolute', top: '55%', left: 0, right: 0, alignItems: 'center' },
  sandyLottie: { width: 180, height: 180 },

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
    gap: 24,
    backgroundColor: '#FFFFFF',
    padding: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(28,25,23,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.08,
    shadowRadius: 30,
    elevation: 9,
  },
  mainControl: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28, shadowRadius: 18, elevation: 10,
  },
  smallControl: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  smallLabel: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 0.8, color: 'rgba(28,25,23,0.32)', marginTop: 2, textTransform: 'uppercase' },
  resetGlyph: { fontSize: 22, color: 'rgba(28,25,23,0.38)', lineHeight: 24 },
});
