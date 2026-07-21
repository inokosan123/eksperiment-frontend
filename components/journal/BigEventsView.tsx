import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
  LinearTransition,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import ConfirmModal from '@/components/shared/ConfirmModal';
import {
  Calendar as CalendarIcon,
  CalendarHeart,
  BellRing,
  BellOff,
  CheckSmall,
  ChevronDown,
  Minus,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import { NotoEmoji } from '@/components/shared/NotoEmoji';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import { normalizeHabitIcon } from '@/components/shared/notoEmoji/legacyMap';
import type { HabitEmojiName } from '@/components/shared/notoEmoji/habits';
import { useBigEvents } from './BigEventsContext';
import {
  addDaysToDateKey,
  formatDateMedium,
  formatDateShort,
  getBigEventCountdown,
  getBigEventSectionsForDate,
  todayKey,
} from './bigEventsLogic';
import {
  BIG_EVENT_DEFAULT_LEAD_DAYS,
  BIG_EVENT_MAX_LEAD_DAYS,
  BIG_EVENT_MIN_LEAD_DAYS,
  normalizeBigEventLeadDays,
} from './bigEventsConfig';
import type { BigEvent, BigEventRecurrence } from './bigEventsDb';
import { HapticTouchableOpacity as TouchableOpacity, HapticPressable as Pressable } from '@/components/shared/HapticTouch';
import {
  notifyGuideEvent,
  useGuidedSetup,
  useGuideTarget,
} from '@/components/onboarding/guided/GuidedSetupContext';


// The native picker has no web implementation, so it must stay behind this platform guard.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const DateTimePickerModule = Platform.OS === 'web' ? null : require('@react-native-community/datetimepicker');
const NativeDateTimePicker = DateTimePickerModule?.default ?? null;
const NativeDateTimePickerAndroid = DateTimePickerModule?.DateTimePickerAndroid ?? null;

const BG = '#FAF7F0';
const GOLD = '#C5A059';
const DEFAULT_EVENT_COLOR = GOLD;
const EVENT_ICON_CHIP_SIZE = 54;
const EVENT_ICON_MIN_GAP = 9;
const EVENT_ICON_COLLAPSED_ROWS = 5;
const EVENT_TYPE_GOLD = '#8A5A1A';
const EVENT_TYPE_GREEN = '#2A6E5F';
const LEAD_DAY_PRESETS = [15, 20, 30] as const;

function isLeadDayPreset(value: number) {
  return LEAD_DAY_PRESETS.some(preset => preset === value);
}
const BIG_EVENTS_GUIDE_TARGETS = {
  add: 'big-events.add',
  title: 'big-events.title',
  icons: 'big-events.icons',
  date: 'big-events.date',
  save: 'big-events.save',
} as const;

type GuideTargetBinding = ReturnType<typeof useGuideTarget>;

const EVENT_ICON_GROUPS: { label: string; icons: HabitEmojiName[] }[] = [
  {
    label: 'Life & celebration',
    icons: [
      'party-popper', 'birthday-cake', 'balloon', 'wrapped-gift', 'bottle-with-popping-cork',
      'clinking-glasses', 'confetti-ball', 'sparkles', 'partying-face', 'red-heart',
      'bouquet', 'ring', 'crown', 'handshake', 'candle',
    ],
  },
  {
    label: 'Family & home',
    icons: ['baby', 'house', 'church', 'calendar', 'spiral-calendar', 'fork-and-knife-with-plate', 'wine-glass', 'cocktail-glass'],
  },
  {
    label: 'Travel & adventure',
    icons: ['airplane', 'luggage', 'world-map', 'compass', 'beach-with-umbrella', 'rocket', 'sunrise', 'sun'],
  },
  {
    label: 'Wins & work',
    icons: [
      'trophy', 'first-place-medal', 'sports-medal', 'military-medal', 'gem-stone',
      'chequered-flag', 'bullseye', 'briefcase', 'chart-increasing', 'money-bag', 'laptop',
    ],
  },
  {
    label: 'Study & craft',
    icons: [
      'graduation-cap', 'books', 'open-book', 'writing-hand', 'light-bulb',
      'artist-palette', 'camera', 'movie-camera', 'musical-notes', 'microphone', 'ticket', 'alarm-clock',
    ],
  },
  {
    label: 'Health & fitness',
    icons: [
      'person-running', 'person-walking', 'flexed-biceps', 'soccer-ball',
      'green-salad', 'red-apple', 'droplet', 'shower',
    ],
  },
  {
    label: 'Faith & quiet',
    icons: ['praying-hands', 'latin-cross', 'crescent-moon', 'hot-beverage', 'glowing-star', 'star'],
  },
  {
    label: 'Nature & growth',
    icons: ['evergreen-tree', 'seedling'],
  },
];

const EVENT_ICONS = Array.from(new Set(EVENT_ICON_GROUPS.flatMap(group => group.icons))) as HabitEmojiName[];

function dateFromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
}

function clampDateKey(key: string, minDate?: string, maxDate?: string): string {
  if (minDate && key < minDate) return minDate;
  if (maxDate && key > maxDate) return maxDate;
  return key;
}

function formatDateLong(dateKey: string) {
  return dateFromKey(dateKey).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateMonth(dateKey: string) {
  return dateFromKey(dateKey).toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
}

function newId() {
  return `be_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Date row ───────────────────────────────────────────────────────────────

function DateRow({
  label,
  value,
  minDate,
  maxDate,
  onChange,
  guideTarget,
  onGuideConfirmed,
}: {
  label: string;
  value: string;
  minDate?: string;
  maxDate?: string;
  onChange: (v: string) => void;
  guideTarget?: GuideTargetBinding;
  onGuideConfirmed?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [sheetMounted, setSheetMounted] = useState(false);
  const [draft, setDraft] = useState(value);
  const sheetProgress = useSharedValue(0);
  const pickerValue = clampDateKey(value, minDate, maxDate);

  useEffect(() => {
    if (!sheetMounted) return;
    sheetProgress.value = 0;
    sheetProgress.value = withTiming(1, {
      duration: 235,
      easing: Easing.out(Easing.cubic),
    });
  }, [sheetMounted, sheetProgress]);

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sheetProgress.value, [0, 1], [0, 1], 'clamp'),
  }));
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sheetProgress.value, [0, 0.28, 1], [0, 1, 1], 'clamp'),
    transform: [
      { translateY: interpolate(sheetProgress.value, [0, 1], [34, 0], 'clamp') },
      { scale: interpolate(sheetProgress.value, [0, 1], [0.992, 1], 'clamp') },
    ],
  }));

  const closeSheet = () => {
    sheetProgress.value = withTiming(
      0,
      { duration: 180, easing: Easing.in(Easing.cubic) },
      finished => {
        if (finished) runOnJS(setSheetMounted)(false);
      },
    );
  };

  const open = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (Platform.OS === 'android' && NativeDateTimePickerAndroid) {
      NativeDateTimePickerAndroid.open({
        value: dateFromKey(pickerValue),
        minimumDate: minDate ? dateFromKey(minDate) : undefined,
        maximumDate: maxDate ? dateFromKey(maxDate) : undefined,
        mode: 'date',
        display: 'calendar',
        positiveButton: { label: 'Save', textColor: GOLD },
        negativeButton: { label: 'Cancel', textColor: '#9CA3AF' },
        onChange: (event: { type?: string }, selectedDate?: Date) => {
          if (event?.type !== 'set' || !selectedDate) return;
          const y = selectedDate.getFullYear();
          const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
          const d = String(selectedDate.getDate()).padStart(2, '0');
          onChange(clampDateKey(`${y}-${m}-${d}`, minDate, maxDate));
          onGuideConfirmed?.();
        },
      });
      return;
    }

    setDraft(pickerValue);
    setSheetMounted(true);
  };

  const apply = () => {
    onChange(clampDateKey(draft, minDate, maxDate));
    closeSheet();
    onGuideConfirmed?.();
  };

  return (
    <>
      <TouchableOpacity
        ref={guideTarget?.ref}
        onLayout={guideTarget?.onLayout}
        onPress={open}
        activeOpacity={0.85}
        style={d.row}
      >
        <View style={d.iconWrap}>
          <CalendarIcon s={18} c={GOLD} w={1.8} />
        </View>
        <View style={d.copy}>
          <Text style={d.label}>{label.toUpperCase()}</Text>
          <Text style={d.value}>{formatDateMedium(value)}</Text>
        </View>
        <ChevronDown s={16} c={GOLD} />
      </TouchableOpacity>

      <Modal
        transparent
        visible={sheetMounted}
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeSheet}
      >
        <View style={d.modalOverlay}>
          <Animated.View pointerEvents="none" style={[d.modalScrim, scrimStyle]} />
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
          <Animated.View
            style={[
              d.modalSheet,
              { paddingBottom: Math.max(24, insets.bottom + 12) },
              sheetStyle,
            ]}
          >
            <View style={d.modalHandle} />
            <View style={d.modalHead}>
              <View style={d.modalHeadingRow}>
                <View style={d.modalHeadingIcon}>
                  <CalendarHeart s={20} c={GOLD} w={1.8} />
                </View>
                <View style={d.modalHeadingCopy}>
                  <Text style={d.modalTitle}>Choose a date</Text>
                  <Text style={d.modalSubtitle}>{label}</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={closeSheet}
                style={d.modalClose}
                accessibilityLabel="Close date picker"
              >
                <X s={18} c="#A8A29E" />
              </TouchableOpacity>
            </View>

            <Animated.View
              key={draft}
              entering={FadeIn.duration(145).easing(Easing.out(Easing.quad))}
              style={d.selectedDateCard}
            >
              <View style={d.selectedDateBadge}>
                <Text style={d.selectedDateMonth}>{formatDateMonth(draft)}</Text>
                <Text style={d.selectedDateDay}>{dateFromKey(draft).getDate()}</Text>
              </View>
              <View style={d.selectedDateCopy}>
                <Text style={d.selectedDateLabel}>SELECTED DATE</Text>
                <Text style={d.selectedDateValue} numberOfLines={2}>{formatDateLong(draft)}</Text>
              </View>
            </Animated.View>

            {Platform.OS === 'ios' && NativeDateTimePicker && (
              <View style={d.iosWrap}>
                <NativeDateTimePicker
                  value={dateFromKey(clampDateKey(draft, minDate, maxDate))}
                  minimumDate={minDate ? dateFromKey(minDate) : undefined}
                  maximumDate={maxDate ? dateFromKey(maxDate) : undefined}
                  mode="date"
                  display="inline"
                  themeVariant="light"
                  accentColor={GOLD}
                  style={d.iosPicker}
                  onChange={(_event: unknown, selectedDate?: Date) => {
                    if (!selectedDate) return;
                    const y = selectedDate.getFullYear();
                    const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
                    const day = String(selectedDate.getDate()).padStart(2, '0');
                    setDraft(clampDateKey(`${y}-${m}-${day}`, minDate, maxDate));
                  }}
                />
              </View>
            )}

            <View style={d.modalActions}>
              <TouchableOpacity
                onPress={closeSheet}
                activeOpacity={0.82}
                style={d.modalCancel}
              >
                <Text style={d.modalCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={apply} activeOpacity={0.88} style={d.modalSave}>
                <CheckSmall s={16} c="#FFFFFF" w={2.8} />
                <Text style={d.modalSaveText}>CONFIRM DATE</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const d = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', columnGap: 12,
    backgroundColor: '#FFFBF2', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(197,160,89,0.24)',
    paddingHorizontal: 14, paddingVertical: 13,
  },
  iconWrap: { width: 38, height: 38, borderRadius: 13, backgroundColor: 'rgba(197,160,89,0.13)', alignItems: 'center', justifyContent: 'center' },
  copy:    { flex: 1 },
  label:   { fontFamily: F.sansBold, fontSize: 9.5, letterSpacing: 1.6, color: '#9A8B78' },
  value:   { marginTop: 2, fontFamily: F.serifMedium, fontSize: 16, color: C.text },

  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(34,29,22,0.5)' },
  modalSheet: {
    backgroundColor: '#FAF7F0', borderTopLeftRadius: 30, borderTopRightRadius: 30,
    paddingHorizontal: 18, paddingTop: 9, paddingBottom: 28,
    borderWidth: 1, borderBottomWidth: 0, borderColor: 'rgba(255,255,255,0.7)',
  },
  modalHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: '#D1CBC1', marginBottom: 14 },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 13 },
  modalHeadingRow: { flex: 1, flexDirection: 'row', alignItems: 'center', columnGap: 11 },
  modalHeadingIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(197,160,89,0.13)', alignItems: 'center', justifyContent: 'center' },
  modalHeadingCopy: { flex: 1 },
  modalTitle: { fontFamily: F.serifMedium, fontSize: 21, lineHeight: 24, color: C.text },
  modalSubtitle: { marginTop: 1, fontFamily: F.sansMedium, fontSize: 12.5, color: '#968B7F' },
  modalClose: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F0ECE4', alignItems: 'center', justifyContent: 'center' },
  selectedDateCard: {
    flexDirection: 'row', alignItems: 'center', columnGap: 12,
    backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(197,160,89,0.28)',
    padding: 13,
  },
  selectedDateBadge: { width: 57, height: 62, borderRadius: 16, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  selectedDateMonth: { fontFamily: F.sansBold, fontSize: 9.5, letterSpacing: 1.35, color: 'rgba(255,255,255,0.84)' },
  selectedDateDay: { marginTop: 1, fontFamily: F.serifSemiBold, fontSize: 27, lineHeight: 29, color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  selectedDateCopy: { flex: 1, minWidth: 0 },
  selectedDateLabel: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.35, color: '#9A8E80' },
  selectedDateValue: { marginTop: 3, fontFamily: F.serifMedium, fontSize: 17, lineHeight: 21, color: C.text },
  iosWrap: {
    width: '100%', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 20,
    marginVertical: 12, paddingVertical: 5, overflow: 'hidden', borderWidth: 1, borderColor: '#ECE7DE',
  },
  iosPicker: { width: '100%', alignSelf: 'center' },
  modalActions: { flexDirection: 'row', columnGap: 10, marginTop: 2 },
  modalCancel: { minWidth: 100, borderRadius: 15, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEEAE2' },
  modalCancelText: { fontFamily: F.sansBold, fontSize: 12.5, letterSpacing: 1.35, color: '#81786E' },
  modalSave: { flex: 1, flexDirection: 'row', columnGap: 7, backgroundColor: GOLD, borderRadius: 15, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  modalSaveText: { fontFamily: F.sansBold, fontSize: 12.5, letterSpacing: 1.35, color: '#FFFFFF' },
});

// ─── Add / Edit form ────────────────────────────────────────────────────────

type FormState = {
  id: string | null;       // null = new
  title: string;
  endDate: string;
  icon: HabitEmojiName;
  recurrence: BigEventRecurrence;
  leadDays: number;
  remindersEnabled: boolean;
};

function emptyForm(): FormState {
  return {
    id: null,
    title: '',
    endDate: todayKey(),
    icon: EVENT_ICONS[0],
    recurrence: 'none',
    leadDays: BIG_EVENT_DEFAULT_LEAD_DAYS,
    remindersEnabled: true,
  };
}

function ReminderSwitch({ enabled }: { enabled: boolean }) {
  const progress = useSharedValue(enabled ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(enabled ? 1 : 0, { duration: 180 });
  }, [enabled, progress]);
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * 18 }],
  }));
  return (
    <View style={[ef.switchTrack, enabled && ef.switchTrackOn]}>
      <Animated.View style={[ef.switchThumb, thumbStyle]} />
    </View>
  );
}

function IconGridChevron({ expanded }: { expanded: boolean }) {
  const progress = useSharedValue(expanded ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(expanded ? 1 : 0, {
      duration: 190,
      easing: Easing.out(Easing.cubic),
    });
  }, [expanded, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 180}deg` }],
  }));

  return (
    <View style={ef.showMoreArrowShell}>
      <Animated.View style={animatedStyle}>
        <ChevronDown s={16} c="#786C5E" w={2.2} />
      </Animated.View>
    </View>
  );
}

function EventIconChoice({
  icon,
  active,
  onSelect,
}: {
  icon: HabitEmojiName;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <View style={ef.iconCell}>
      <Pressable
        onPress={onSelect}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        style={({ pressed }) => [
          ef.iconChip,
          active && ef.iconChipActive,
          pressed && { opacity: 0.78 },
        ]}
      >
        <View style={ef.iconGlyphBox}>
          <NotoEmoji name={icon} size={32} />
        </View>
        {active && (
          <View pointerEvents="none" style={ef.iconSelectedBadge}>
            <CheckSmall s={12} c="#FFFFFF" w={3} />
          </View>
        )}
      </Pressable>
    </View>
  );
}

function EventForm({
  form,
  onChange,
  onSave,
  onCancel,
  minDate,
  guided = false,
  sheetMode = false,
  onCanSaveChange,
}: {
  form: FormState;
  onChange: (next: FormState) => void;
  onSave: () => void | Promise<void>;
  onCancel: () => void;
  minDate: string;
  guided?: boolean;
  sheetMode?: boolean;
  onCanSaveChange?: (canSave: boolean) => void;
}) {
  const { session, patchSession } = useGuidedSetup();
  const isGuided = guided && session?.active === true && session.activeStep === 'buildBigEvents';
  const titleTarget = useGuideTarget(BIG_EVENTS_GUIDE_TARGETS.title, isGuided);
  const iconsTarget = useGuideTarget(BIG_EVENTS_GUIDE_TARGETS.icons, isGuided);
  const dateTarget = useGuideTarget(BIG_EVENTS_GUIDE_TARGETS.date, isGuided);
  const saveTarget = useGuideTarget(BIG_EVENTS_GUIDE_TARGETS.save, isGuided);
  const [customLeadOpen, setCustomLeadOpen] = useState(!isLeadDayPreset(form.leadDays));
  const [customLeadDraft, setCustomLeadDraft] = useState(String(
    form.leadDays || BIG_EVENT_DEFAULT_LEAD_DAYS,
  ));
  const parsedCustomLead = Number(customLeadDraft);
  const customLeadValid = Number.isInteger(parsedCustomLead) &&
    parsedCustomLead >= BIG_EVENT_MIN_LEAD_DAYS &&
    parsedCustomLead <= BIG_EVENT_MAX_LEAD_DAYS;
  const canSave = !!form.title.trim() && !!form.endDate && (
    form.recurrence === 'yearly' || form.endDate >= minDate
  ) && (!customLeadOpen || customLeadValid);
  const isEdit = form.id !== null;
  const guidePhase = session?.phase;
  const [iconGridWidth, setIconGridWidth] = useState(0);
  const [iconsExpanded, setIconsExpanded] = useState(false);
  const [extraIconsReady, setExtraIconsReady] = useState(!sheetMode);
  const iconExpansionInitialized = useRef(false);
  const iconRevealProgress = useSharedValue(0);
  const extraIconsHeight = useSharedValue(0);
  const iconColumns = iconGridWidth > 0
    ? Math.max(3, Math.floor((iconGridWidth + EVENT_ICON_MIN_GAP) / (EVENT_ICON_CHIP_SIZE + EVENT_ICON_MIN_GAP)))
    : 5;
  const collapsedIconCount = iconColumns * EVENT_ICON_COLLAPSED_ROWS;
  const collapsedIcons = useMemo(
    () => EVENT_ICONS.slice(0, collapsedIconCount),
    [collapsedIconCount],
  );
  const extraIcons = useMemo(
    () => EVENT_ICONS.slice(collapsedIconCount),
    [collapsedIconCount],
  );
  const hiddenIconCount = extraIcons.length;
  const collapsedSpacerCount = (iconColumns - (collapsedIcons.length % iconColumns)) % iconColumns;
  const extraSpacerCount = (iconColumns - (extraIcons.length % iconColumns)) % iconColumns;
  const collapsedSpacers = useMemo(
    () => Array.from({ length: collapsedSpacerCount }, (_, index) => index),
    [collapsedSpacerCount],
  );
  const extraSpacers = useMemo(
    () => Array.from({ length: extraSpacerCount }, (_, index) => index),
    [extraSpacerCount],
  );

  useEffect(() => {
    if (!iconGridWidth || iconExpansionInitialized.current) return;
    iconExpansionInitialized.current = true;
    if (EVENT_ICONS.indexOf(form.icon) >= collapsedIconCount) {
      setIconsExpanded(true);
    }
  }, [collapsedIconCount, form.icon, iconGridWidth]);

  useEffect(() => {
    if (!sheetMode) {
      setExtraIconsReady(true);
      return undefined;
    }

    // The hidden icon set is intentionally warmed after the sheet has begun
    // moving. Rendering every emoji in the opening tap used to hold the JS
    // thread long enough to create a visible pause before the sheet appeared.
    const timer = setTimeout(() => setExtraIconsReady(true), 300);
    return () => clearTimeout(timer);
  }, [sheetMode]);

  useEffect(() => {
    iconRevealProgress.value = withTiming(iconsExpanded ? 1 : 0, {
      duration: iconsExpanded ? 285 : 220,
      easing: iconsExpanded
        ? Easing.bezier(0.22, 1, 0.36, 1)
        : Easing.bezier(0.4, 0, 0.2, 1),
    });
  }, [iconRevealProgress, iconsExpanded]);

  const extraIconsRevealStyle = useAnimatedStyle(() => ({
    height: extraIconsHeight.value * iconRevealProgress.value,
    opacity: interpolate(iconRevealProgress.value, [0, 0.14, 1], [0, 0.34, 1]),
    transform: [{
      translateY: interpolate(iconRevealProgress.value, [0, 1], [-5, 0]),
    }],
  }));

  useEffect(() => {
    onCanSaveChange?.(canSave);
  }, [canSave, onCanSaveChange]);

  // Guided phases walk the form top-to-bottom: name → date → icon → save,
  // so the spotlight never jumps back up the screen.
  const advanceAfterTitle = () => {
    if (isGuided && guidePhase === 'title' && form.title.trim()) {
      patchSession({ phase: 'date' });
    }
  };
  const advanceAfterDate = () => {
    if (isGuided && guidePhase === 'date') {
      patchSession({ phase: 'icon' });
    }
  };
  const advanceAfterIcon = () => {
    if (isGuided && guidePhase === 'icon') {
      patchSession({ phase: 'save' });
    }
  };

  const toggleIconExpansion = () => {
    const nextExpanded = !iconsExpanded;
    if (nextExpanded && !extraIconsReady) setExtraIconsReady(true);
    setIconsExpanded(nextExpanded);
  };

  const setCustomLeadDays = (value: number) => {
    const next = normalizeBigEventLeadDays(value, 'yearly');
    setCustomLeadDraft(String(next));
    onChange({ ...form, leadDays: next });
  };

  const changeCustomLeadDraft = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 3);
    setCustomLeadDraft(digits);
    const parsed = Number(digits);
    if (
      digits &&
      Number.isInteger(parsed) &&
      parsed >= BIG_EVENT_MIN_LEAD_DAYS &&
      parsed <= BIG_EVENT_MAX_LEAD_DAYS
    ) {
      onChange({ ...form, leadDays: parsed });
    }
  };

  return (
    <Animated.View
      style={[ef.wrap, sheetMode && ef.wrapSheet]}
      entering={sheetMode ? undefined : FadeIn.duration(220)}
      exiting={sheetMode ? undefined : FadeOut.duration(160)}
      layout={LinearTransition.duration(240).easing(Easing.out(Easing.cubic))}
    >
      {!sheetMode && (
        <View style={ef.head}>
          <Text style={ef.heading}>{isEdit ? 'EDIT EVENT' : 'NEW EVENT'}</Text>
          <TouchableOpacity onPress={onCancel} style={ef.close} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X s={16} c={C.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      <TextInput
        ref={titleTarget.ref}
        onLayout={titleTarget.onLayout}
        value={form.title}
        onChangeText={t => onChange({ ...form, title: t })}
        placeholder="Event name..."
        placeholderTextColor="#C7C0B4"
        selectionColor={GOLD}
        style={ef.input}
        returnKeyType="done"
        onSubmitEditing={advanceAfterTitle}
      />

      {!isGuided && (
        <View>
          <Text style={ef.sectionLabel}>EVENT TYPE</Text>
          <View style={ef.typePicker}>
            {([
              {
                value: 'none',
                label: 'ONE-TIME',
                detail: 'A single important date',
                accent: EVENT_TYPE_GOLD,
                isYearly: false,
              },
              {
                value: 'yearly',
                label: 'EVERY YEAR',
                detail: 'Birthday or anniversary',
                accent: EVENT_TYPE_GREEN,
                isYearly: true,
              },
            ] as const).map(option => {
              const active = form.recurrence === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    Haptics.selectionAsync();
                    onChange({
                      ...form,
                      recurrence: option.value,
                      remindersEnabled: option.value === 'yearly' && form.recurrence === 'none'
                        ? true
                        : form.remindersEnabled,
                    });
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [
                    ef.typeOption,
                    option.isYearly ? ef.typeOptionGreen : ef.typeOptionGold,
                    active && (option.isYearly ? ef.typeOptionGreenActive : ef.typeOptionGoldActive),
                    pressed && ef.pressed,
                  ]}
                >
                  <View pointerEvents="none" style={[
                    ef.typeGlow,
                    option.isYearly ? ef.typeGlowGreen : ef.typeGlowGold,
                  ]} />
                  <View style={ef.typeOptionTop}>
                    <View style={[
                      ef.typeIcon,
                      option.isYearly ? ef.typeIconGreen : ef.typeIconGold,
                      active && { backgroundColor: option.accent },
                    ]}>
                      {option.value === 'yearly'
                        ? <RotateCcw s={18} c={active ? '#FFFFFF' : option.accent} w={2.1} />
                        : <CalendarIcon s={18} c={active ? '#FFFFFF' : option.accent} w={2.1} />}
                    </View>
                    <View style={[
                      ef.typeSelectionMark,
                      { borderColor: option.accent },
                      active && { backgroundColor: option.accent },
                    ]}>
                      {active ? (
                        <Animated.View entering={FadeIn.duration(130)}>
                          <CheckSmall s={11} c="#FFFFFF" w={2.8} />
                        </Animated.View>
                      ) : (
                        <View style={[ef.typeSelectionDot, { backgroundColor: option.accent }]} />
                      )}
                    </View>
                  </View>
                  <Text style={[ef.typeLabel, { color: option.accent }]}>{option.label}</Text>
                  <Text style={[
                    ef.typeDetail,
                    option.isYearly ? ef.typeDetailGreen : ef.typeDetailGold,
                    active && ef.typeDetailActive,
                  ]}>{option.detail}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <DateRow
        label={form.recurrence === 'yearly' ? 'Anniversary date' : 'Event'}
        value={form.endDate}
        minDate={form.recurrence === 'yearly' ? undefined : minDate}
        onChange={v => onChange({ ...form, endDate: v })}
        guideTarget={dateTarget}
        onGuideConfirmed={advanceAfterDate}
      />

      {form.recurrence === 'yearly' && !isGuided && (
        <Animated.View
          entering={FadeIn.duration(180).easing(Easing.out(Easing.cubic))}
          exiting={FadeOut.duration(120).easing(Easing.in(Easing.quad))}
          layout={LinearTransition.duration(220).easing(Easing.out(Easing.cubic))}
          style={ef.reminderCard}
        >
          <View style={ef.reminderHead}>
            <View style={ef.reminderIcon}><BellRing s={21} c={GOLD} w={1.9} /></View>
            <View style={ef.reminderCopy}>
              <Text style={ef.reminderTitle}>Show it early</Text>
              <Text style={ef.reminderBody}>Choose when it appears on Home and when its reminder begins.</Text>
            </View>
          </View>
          <Text style={ef.leadLabel}>HOW MANY DAYS BEFORE?</Text>
          <View style={ef.leadOptions}>
            {LEAD_DAY_PRESETS.map(days => {
              const active = !customLeadOpen && form.leadDays === days;
              return (
                <Pressable
                  key={days}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setCustomLeadOpen(false);
                    onChange({ ...form, leadDays: days });
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [ef.leadChip, active && ef.leadChipActive, pressed && ef.pressed]}
                >
                  <Text style={[ef.leadNumber, active && ef.leadNumberActive]}>{days}</Text>
                  <Text style={[ef.leadUnit, active && ef.leadUnitActive]}>DAYS</Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setCustomLeadDraft(String(form.leadDays || BIG_EVENT_DEFAULT_LEAD_DAYS));
                setCustomLeadOpen(true);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: customLeadOpen }}
              style={({ pressed }) => [
                ef.leadChip,
                customLeadOpen && ef.leadChipActive,
                pressed && ef.pressed,
              ]}
            >
              <Text style={[ef.leadCustomText, customLeadOpen && ef.leadNumberActive]}>CUSTOM</Text>
              <Text style={[ef.leadUnit, customLeadOpen && ef.leadUnitActive]}>DAYS</Text>
            </Pressable>
          </View>

          {customLeadOpen && (
            <Animated.View
              entering={FadeIn.duration(170).easing(Easing.out(Easing.cubic))}
              exiting={FadeOut.duration(130).easing(Easing.in(Easing.quad))}
              layout={LinearTransition.duration(210).easing(Easing.out(Easing.cubic))}
              style={ef.customLeadPanel}
            >
              <View style={ef.customLeadHeader}>
                <View>
                  <Text style={ef.customLeadLabel}>CUSTOM LEAD TIME</Text>
                  <Text style={ef.customLeadHint}>Choose from 1 to 365 days</Text>
                </View>
                {customLeadValid && (
                  <View style={ef.customLeadValidBadge}>
                    <CheckSmall s={12} c="#FFFFFF" w={2.8} />
                  </View>
                )}
              </View>

              <View style={ef.customLeadControl}>
                <Pressable
                  onPress={() => setCustomLeadDays((customLeadValid ? parsedCustomLead : form.leadDays) - 1)}
                  accessibilityRole="button"
                  accessibilityLabel="One fewer day"
                  style={({ pressed }) => [ef.customStepButton, pressed && ef.pressed]}
                >
                  <Minus s={18} c="#7C6A4C" w={2.2} />
                </Pressable>
                <View style={[ef.customLeadInputWrap, !customLeadValid && ef.customLeadInputWrapError]}>
                  <TextInput
                    value={customLeadDraft}
                    onChangeText={changeCustomLeadDraft}
                    keyboardType="number-pad"
                    returnKeyType="done"
                    maxLength={3}
                    selectTextOnFocus
                    accessibilityLabel="Custom number of days before event"
                    style={ef.customLeadInput}
                  />
                  <Text style={ef.customLeadSuffix}>DAYS</Text>
                </View>
                <Pressable
                  onPress={() => setCustomLeadDays((customLeadValid ? parsedCustomLead : form.leadDays) + 1)}
                  accessibilityRole="button"
                  accessibilityLabel="One more day"
                  style={({ pressed }) => [ef.customStepButton, pressed && ef.pressed]}
                >
                  <Plus s={18} c="#7C6A4C" w={2.2} />
                </Pressable>
              </View>

              {!customLeadValid && (
                <Text style={ef.customLeadError}>Enter a whole number between 1 and 365.</Text>
              )}
            </Animated.View>
          )}
          <Animated.View
            layout={LinearTransition.duration(220).easing(Easing.out(Easing.cubic))}
          >
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                onChange({ ...form, remindersEnabled: !form.remindersEnabled });
              }}
              accessibilityRole="switch"
              accessibilityState={{ checked: form.remindersEnabled }}
              style={({ pressed }) => [ef.notificationRow, pressed && ef.pressed]}
            >
              <View style={ef.notificationCopy}>
                <Text style={ef.notificationTitle}>Phone notification</Text>
                <Text style={ef.notificationBody}>At 9:00 AM when this event first appears on Home</Text>
              </View>
              <ReminderSwitch enabled={form.remindersEnabled} />
            </Pressable>
          </Animated.View>
        </Animated.View>
      )}

      <View>
        <Text style={ef.sectionLabel}>ICON</Text>
        <View
          ref={iconsTarget.ref}
          style={ef.iconGrid}
          onLayout={event => {
            setIconGridWidth(Math.floor(event.nativeEvent.layout.width));
            iconsTarget.onLayout(event);
          }}
        >
          {collapsedIcons.map(ic => (
            <EventIconChoice
              key={ic}
              icon={ic}
              active={form.icon === ic}
              onSelect={() => {
                Haptics.selectionAsync();
                onChange({ ...form, icon: ic });
                advanceAfterIcon();
              }}
            />
          ))}
          {collapsedSpacers.map(index => (
            <View key={`collapsed-icon-spacer-${index}`} pointerEvents="none" style={ef.iconGridSpacer} />
          ))}
        </View>

        <Animated.View
          pointerEvents={iconsExpanded ? 'auto' : 'none'}
          accessibilityElementsHidden={!iconsExpanded}
          importantForAccessibility={iconsExpanded ? 'auto' : 'no-hide-descendants'}
          style={[ef.extraIconClip, extraIconsRevealStyle]}
        >
          {extraIconsReady && (
            <View
              style={ef.extraIconMeasure}
              onLayout={event => {
                extraIconsHeight.value = Math.ceil(event.nativeEvent.layout.height);
                if (iconsExpanded) {
                  iconRevealProgress.value = 0;
                  iconRevealProgress.value = withTiming(1, {
                    duration: 285,
                    easing: Easing.bezier(0.22, 1, 0.36, 1),
                  });
                }
              }}
            >
              <View style={ef.iconGrid}>
                {extraIcons.map(ic => (
                  <EventIconChoice
                    key={ic}
                    icon={ic}
                    active={form.icon === ic}
                    onSelect={() => {
                      Haptics.selectionAsync();
                      onChange({ ...form, icon: ic });
                      advanceAfterIcon();
                    }}
                  />
                ))}
                {extraSpacers.map(index => (
                  <View key={`extra-icon-spacer-${index}`} pointerEvents="none" style={ef.iconGridSpacer} />
                ))}
              </View>
            </View>
          )}
        </Animated.View>

        {hiddenIconCount > 0 && (
          <Pressable
            onPress={toggleIconExpansion}
            accessibilityRole="button"
            accessibilityLabel={iconsExpanded ? 'Show fewer event icons' : 'Show more event icons'}
            accessibilityState={{ expanded: iconsExpanded }}
            style={({ pressed }) => [
              ef.showMoreButton,
              iconsExpanded && ef.showMoreButtonExpanded,
              pressed && ef.pressed,
            ]}
          >
            <View style={ef.showMoreCopy}>
              <Text style={ef.showMoreTitle}>{iconsExpanded ? 'SHOW LESS' : 'SHOW MORE'}</Text>
              <Text style={ef.showMoreMeta}>
                {iconsExpanded ? 'Back to the first five rows' : `${hiddenIconCount} more icons`}
              </Text>
            </View>
            <IconGridChevron expanded={iconsExpanded} />
          </Pressable>
        )}
      </View>

      <TouchableOpacity
        ref={saveTarget.ref}
        onLayout={saveTarget.onLayout}
        onPress={onSave}
        disabled={!canSave}
        activeOpacity={0.85}
        style={[ef.saveBtn, !canSave && ef.saveBtnDisabled]}
      >
        <CheckSmall s={18} c="#fff" w={2.8} />
        <Text style={ef.saveText}>{isEdit ? 'SAVE CHANGES' : 'ADD EVENT'}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const ef = StyleSheet.create({
  wrap: {
    backgroundColor: '#FFFFFF', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(197,160,89,0.22)',
    padding: 18, marginBottom: 16, rowGap: 14,
    shadowColor: '#8C7A4F', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 14, elevation: 2,
  },
  wrapSheet: { marginBottom: 0 },
  head:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 2, color: C.textMuted },
  close: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },

  input: {
    minHeight: 64,
    backgroundColor: '#FFFDF9',
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#E6DED0',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: F.serifMedium,
    fontSize: 22,
    lineHeight: 27,
    letterSpacing: -0.25,
    color: C.text,
    shadowColor: '#6D5C42',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.035,
    shadowRadius: 10,
    elevation: 1,
  },

  sectionLabel: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.8, color: C.textMuted, marginBottom: 8 },
  pressed: { opacity: 0.78 },
  typePicker: { flexDirection: 'row', columnGap: 10 },
  typeOption: {
    position: 'relative',
    flex: 1,
    minHeight: 124,
    overflow: 'hidden',
    borderRadius: 19,
    borderCurve: 'continuous',
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 13,
  },
  typeOptionGold: { borderColor: '#F0E3B8', backgroundColor: '#FFFCF5' },
  typeOptionGreen: { borderColor: '#CFE6DE', backgroundColor: '#F7FBF9' },
  typeOptionGoldActive: {
    borderColor: '#D9BE79',
    backgroundColor: '#FBF3DE',
    shadowColor: EVENT_TYPE_GOLD,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.13,
    shadowRadius: 12,
    elevation: 2,
  },
  typeOptionGreenActive: {
    borderColor: '#9FCABA',
    backgroundColor: '#E1F1EC',
    shadowColor: EVENT_TYPE_GREEN,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.13,
    shadowRadius: 12,
    elevation: 2,
  },
  typeGlow: {
    position: 'absolute',
    right: -20,
    bottom: -26,
    width: 76,
    height: 76,
    borderRadius: 38,
  },
  typeGlowGold: { backgroundColor: 'rgba(197,160,89,0.09)' },
  typeGlowGreen: { backgroundColor: 'rgba(42,110,95,0.07)' },
  typeOptionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  typeIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeIconGold: { backgroundColor: '#F4E6BF' },
  typeIconGreen: { backgroundColor: '#D4EAE2' },
  typeSelectionMark: {
    width: 23,
    height: 23,
    borderRadius: 12,
    borderWidth: 1.25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.62)',
  },
  typeSelectionDot: { width: 5, height: 5, borderRadius: 3, opacity: 0.46 },
  typeLabel: { fontFamily: F.sansBold, fontSize: 11.5, lineHeight: 14, letterSpacing: 1.35 },
  typeDetail: { marginTop: 4, fontFamily: F.serif, fontSize: 13.5, lineHeight: 17.5 },
  typeDetailGold: { color: '#A9863F' },
  typeDetailGreen: { color: '#3D8273' },
  typeDetailActive: { opacity: 0.96 },
  reminderCard: {
    borderRadius: 18, borderWidth: 1, borderColor: 'rgba(197,160,89,0.24)',
    backgroundColor: '#FFFBF2', padding: 16,
  },
  reminderHead: { flexDirection: 'row', alignItems: 'center', columnGap: 12 },
  reminderIcon: {
    width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(197,160,89,0.13)',
  },
  reminderCopy: { flex: 1, minWidth: 0 },
  reminderTitle: { fontFamily: F.serifMedium, fontSize: 18, lineHeight: 21, color: C.text },
  reminderBody: { marginTop: 3, fontFamily: F.serif, fontSize: 14.5, lineHeight: 19, color: C.textSecondary },
  leadLabel: {
    marginTop: 17, marginBottom: 9, fontFamily: F.sansBold, fontSize: 10.5,
    letterSpacing: 1.35, color: '#8E806D',
  },
  leadOptions: { flexDirection: 'row', columnGap: 7 },
  leadChip: {
    flex: 1, height: 58, borderRadius: 14, borderWidth: 1, borderColor: '#E7E0D4',
    backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
  },
  leadChipActive: { borderColor: GOLD, backgroundColor: GOLD },
  leadNumber: { fontFamily: F.serifSemiBold, fontSize: 22, lineHeight: 24, color: '#675D51', fontVariant: ['tabular-nums'] },
  leadNumberActive: { color: '#FFFFFF' },
  leadCustomText: { fontFamily: F.sansBold, fontSize: 10.5, lineHeight: 18, letterSpacing: 0.75, color: '#675D51' },
  leadUnit: { marginTop: 2, fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.05, color: '#9D9388' },
  leadUnitActive: { color: 'rgba(255,255,255,0.82)' },
  customLeadPanel: {
    marginTop: 11, borderRadius: 17, borderWidth: 1, borderColor: '#E4DAC9',
    backgroundColor: '#FFFFFF', padding: 14,
  },
  customLeadHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  customLeadLabel: { fontFamily: F.sansBold, fontSize: 10.5, letterSpacing: 1.25, color: '#746653' },
  customLeadHint: { marginTop: 3, fontFamily: F.serif, fontSize: 14, lineHeight: 18, color: '#91877D' },
  customLeadValidBadge: { width: 25, height: 25, borderRadius: 13, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  customLeadControl: { flexDirection: 'row', alignItems: 'center', columnGap: 8, marginTop: 13 },
  customStepButton: {
    width: 42, height: 44, borderRadius: 13, borderWidth: 1, borderColor: '#E4DCCD',
    backgroundColor: '#F7F3EB', alignItems: 'center', justifyContent: 'center',
  },
  customLeadInputWrap: {
    flex: 1, height: 44, borderRadius: 13, borderWidth: 1.5, borderColor: 'rgba(197,160,89,0.58)',
    backgroundColor: '#FFFCF5', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 10,
  },
  customLeadInputWrapError: { borderColor: '#D97979', backgroundColor: '#FFF8F7' },
  customLeadInput: {
    minWidth: 45, paddingVertical: 0, paddingHorizontal: 4, textAlign: 'right',
    fontFamily: F.serifSemiBold, fontSize: 22, lineHeight: 26, color: C.text,
    fontVariant: ['tabular-nums'],
  },
  customLeadSuffix: { marginLeft: 3, fontFamily: F.sansBold, fontSize: 9.5, letterSpacing: 1.05, color: '#8F8375' },
  customLeadError: { marginTop: 8, fontFamily: F.sansMedium, fontSize: 13, lineHeight: 17, color: '#C65F5F' },
  notificationRow: {
    marginTop: 13, paddingHorizontal: 13, paddingVertical: 12, borderRadius: 15,
    borderWidth: 1, borderColor: '#E3DACB', backgroundColor: '#FFFFFF',
    flexDirection: 'row', alignItems: 'center', columnGap: 12,
  },
  notificationCopy: { flex: 1 },
  notificationTitle: { fontFamily: F.serifMedium, fontSize: 16, lineHeight: 19, color: '#5F564D' },
  notificationBody: { marginTop: 3, fontFamily: F.serif, fontSize: 13.5, lineHeight: 18, color: '#8E857C' },
  switchTrack: { width: 45, height: 27, borderRadius: 14, padding: 3, backgroundColor: '#D9D4CB' },
  switchTrackOn: { backgroundColor: GOLD },
  switchThumb: {
    width: 21, height: 21, borderRadius: 11, backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.14, shadowRadius: 2, elevation: 2,
  },

  iconGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    columnGap: EVENT_ICON_MIN_GAP,
    rowGap: EVENT_ICON_MIN_GAP,
  },
  extraIconClip: { width: '100%', overflow: 'hidden' },
  extraIconMeasure: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: EVENT_ICON_MIN_GAP,
  },
  iconCell: { width: EVENT_ICON_CHIP_SIZE, height: EVENT_ICON_CHIP_SIZE },
  iconChip: {
    width: EVENT_ICON_CHIP_SIZE, height: EVENT_ICON_CHIP_SIZE,
    borderRadius: 19, borderWidth: 1, borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center', overflow: 'visible',
    shadowColor: '#8C7A4F', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.035, shadowRadius: 8, elevation: 1,
  },
  iconChipActive: {
    borderWidth: 2,
    borderColor: GOLD,
    backgroundColor: '#FFF4D6',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.26,
    shadowRadius: 12,
    elevation: 4,
  },
  iconGlyphBox: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  iconSelectedBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGridSpacer: { width: EVENT_ICON_CHIP_SIZE, height: 0 },
  showMoreButton: {
    minHeight: 54,
    marginTop: 12,
    borderRadius: 17,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#E7E0D4',
    backgroundColor: '#F8F5EE',
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 12,
  },
  showMoreButtonExpanded: { borderColor: '#E7D6B1', backgroundColor: '#FFF9EC' },
  showMoreCopy: { flex: 1, minWidth: 0 },
  showMoreTitle: { fontFamily: F.sansBold, fontSize: 11, lineHeight: 14, letterSpacing: 1.5, color: '#6F6253' },
  showMoreMeta: { marginTop: 2, fontFamily: F.serif, fontSize: 13.5, lineHeight: 17, color: '#9A9085' },
  showMoreArrowShell: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5DCCB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', columnGap: 8,
    backgroundColor: GOLD, borderRadius: 16, paddingVertical: 14, marginTop: 4,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveText: { fontFamily: F.sansBold, fontSize: 12, letterSpacing: 1.6, color: '#fff' },
});

function BigEventEditorSheet({
  visible,
  form,
  onChange,
  onSave,
  onClose,
  minDate,
  guided,
}: {
  visible: boolean;
  form: FormState | null;
  onChange: (next: FormState) => void;
  onSave: () => Promise<void>;
  onClose: () => void;
  minDate: string;
  guided: boolean;
}) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [canSave, setCanSave] = useState(false);
  const [saving, setSaving] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      event => setKbHeight(event.endCoordinates.height),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKbHeight(0),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    if (visible) setSaving(false);
  }, [form?.id, visible]);

  const save = useCallback(async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await onSave();
    } catch (error) {
      console.warn('[BigEvents] save failed', error);
      setSaving(false);
    }
  }, [canSave, onSave, saving]);

  if (!form) return null;

  const baseSheetHeight = Math.min(height * 0.92, 720);
  const sheetHeight = kbHeight > 0
    ? Math.max(360, Math.min(baseSheetHeight, height - kbHeight - insets.top - 24))
    : baseSheetHeight;
  const isEdit = form.id !== null;

  return (
    <SmoothBottomSheet
      visible={visible}
      onClose={onClose}
      closeOnBackdropPress={!guided}
      keyboardAware
      embedded={guided}
      backdropOpacity={0.34}
      overlayStyle={guided ? bes.embeddedOverlay : undefined}
      sheetStyle={[
        bes.sheet,
        {
          height: sheetHeight,
          paddingBottom: Math.max(insets.bottom, 10) + 12,
        },
      ]}
    >
      <View style={bes.handle} />
      <View style={bes.header}>
        <TouchableOpacity
          onPress={onClose}
          activeOpacity={0.82}
          style={bes.closeButton}
          accessibilityLabel="Close Big Event editor"
        >
          <X s={19} c="#A8A29E" />
        </TouchableOpacity>

        <View style={bes.headerCopy}>
          <Text style={bes.eyebrow}>BIG EVENTS</Text>
          <Text style={bes.title}>{isEdit ? 'Edit Event' : 'Add an Event'}</Text>
        </View>

        <TouchableOpacity
          onPress={save}
          disabled={!canSave || saving}
          activeOpacity={0.86}
          style={[bes.doneButton, (!canSave || saving) && bes.doneButtonDisabled]}
          accessibilityLabel={isEdit ? 'Save event changes' : 'Add event'}
        >
          <CheckSmall s={19} c="#FFFFFF" w={3} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={bes.scroll}
        contentContainerStyle={bes.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <EventForm
          form={form}
          onChange={onChange}
          onSave={save}
          onCancel={onClose}
          minDate={minDate}
          guided={guided}
          sheetMode
          onCanSaveChange={setCanSave}
        />
      </ScrollView>
    </SmoothBottomSheet>
  );
}

const bes = StyleSheet.create({
  embeddedOverlay: { zIndex: 50, elevation: 50 },
  sheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: '#FFFEFB',
    overflow: 'hidden',
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#D6D3D1',
    alignSelf: 'center',
    marginTop: 10,
  },
  header: {
    minHeight: 70,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EDE8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F7F5F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1, minWidth: 0, alignItems: 'center' },
  eyebrow: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 2,
    color: '#A8A29E',
  },
  title: {
    marginTop: 2,
    fontFamily: F.serifMedium,
    fontSize: 22,
    lineHeight: 26,
    color: C.text,
  },
  doneButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 3,
  },
  doneButtonDisabled: { backgroundColor: '#D6D3D1', shadowOpacity: 0, elevation: 0 },
  scroll: { flex: 1 },
  content: { padding: 18, gap: 14 },
});

// ─── Event card ─────────────────────────────────────────────────────────────

type EventCardVariant = 'upcoming' | 'recurring' | 'past';

// A little calendar-page tile: a tinted cap with the month, a big serif day
// beneath it. Carries a soft touch of the event's own colour so each date
// keeps its identity while the recurring card stays calm.
function DateMedallion({ dateKey, color }: { dateKey: string; color: string }) {
  const d = new Date(`${dateKey}T12:00:00`);
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const day = d.getDate();
  return (
    <View style={[ec.medallion, { borderColor: `${color}33` }]}>
      <View style={[ec.medallionCap, { backgroundColor: `${color}1A` }]}>
        <Text style={[ec.medallionMonth, { color }]}>{month}</Text>
      </View>
      <Text style={ec.medallionDay}>{day}</Text>
    </View>
  );
}

function EventCard({
  event, today, variant, onTap, onAskDelete,
}: {
  event: BigEvent;
  today: string;
  variant: EventCardVariant;
  onTap?: () => void;
  onAskDelete: () => void;
}) {
  const daysLeft = getBigEventCountdown(event, today);
  const tintBg = `${event.color}22`;
  const isPast = variant === 'past';
  const isRecurring = variant === 'recurring';

  const deleteButton = (
    <TouchableOpacity onPress={onAskDelete} style={ec.del} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
      <Trash2 s={16} c="#D76A6A" w={1.9} />
    </TouchableOpacity>
  );

  // Recurring events sit here while they wait for their yearly window — their
  // "inactive" state. The card grows a foot bar that says, plainly, how early
  // the reminder fires and how far off the day still is, and the next date is
  // shown as an elegant calendar medallion instead of a cramped label.
  if (isRecurring) {
    const remindsOn = event.remindersEnabled;
    return (
      <Animated.View
        entering={FadeIn.duration(170).easing(Easing.out(Easing.cubic))}
        exiting={FadeOut.duration(120).easing(Easing.in(Easing.quad))}
        layout={LinearTransition.duration(220).easing(Easing.bezier(0.22, 1, 0.36, 1))}
        style={[ec.card, ec.cardRecurring]}
      >
        <View pointerEvents="none" style={ec.recurringRail} />
        <View style={ec.recTopRow}>
          <Pressable
            onPress={onTap}
            disabled={!onTap}
            style={ec.recTap}
            android_ripple={onTap ? { color: 'rgba(0,0,0,0.04)' } : undefined}
          >
            <View style={[ec.iconBox, ec.iconBoxRecurring, { backgroundColor: '#E3EDE7' }]}>
              <View style={[ec.eventGlyph, ec.eventGlyphRecurring]}>
                <NotoEmoji name={normalizeHabitIcon(event.icon)} size={26} />
              </View>
            </View>
            <View style={ec.copy}>
              <Text style={[ec.title, ec.titleRecurring]} numberOfLines={1}>{event.title}</Text>
              <View style={ec.recTag}>
                <RotateCcw s={10} c="#7D9186" w={2} />
                <Text style={ec.recTagText}>EVERY YEAR</Text>
              </View>
            </View>
            <DateMedallion dateKey={event.endDate} color={event.color} />
          </Pressable>
          {deleteButton}
        </View>

        <View style={ec.recFoot}>
          <View style={ec.recFootLeft}>
            <View style={[ec.recFootIcon, !remindsOn && ec.recFootIconOff]}>
              {remindsOn
                ? <BellRing s={12} c="#5F7F6F" w={1.9} />
                : <BellOff s={12} c="#A7A29A" w={1.9} />}
            </View>
            <Text style={ec.recFootText} numberOfLines={1}>
              {remindsOn
                ? `Reminds you ${event.leadDays} ${event.leadDays === 1 ? 'day' : 'days'} early`
                : 'No reminder set'}
            </Text>
          </View>
          <View style={ec.recFootCount}>
            <Text style={ec.recFootCountText}>in {daysLeft} {daysLeft === 1 ? 'day' : 'days'}</Text>
          </View>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={FadeIn.duration(170).easing(Easing.out(Easing.cubic))}
      exiting={FadeOut.duration(120).easing(Easing.in(Easing.quad))}
      layout={LinearTransition.duration(220).easing(Easing.bezier(0.22, 1, 0.36, 1))}
      style={[ec.card, isPast && ec.cardPast]}
    >
      <Pressable
        onPress={onTap}
        disabled={!onTap}
        style={ec.tap}
        android_ripple={onTap ? { color: 'rgba(0,0,0,0.04)' } : undefined}
      >
        <View style={[
          ec.iconBox,
          { backgroundColor: isPast ? '#ECE8DF' : tintBg },
          isPast && ec.iconBoxPast,
        ]}>
          <View style={[ec.eventGlyph, isPast && ec.eventGlyphPast]}>
            <NotoEmoji name={normalizeHabitIcon(event.icon)} size={26} />
          </View>
        </View>
        <View style={ec.copy}>
          <Text style={[ec.title, isPast && ec.titlePast]} numberOfLines={1}>{event.title}</Text>
          <Text style={[ec.range, isPast && ec.rangePast]} numberOfLines={1}>
            {`${formatDateShort(event.startDate)} – ${formatDateMedium(event.endDate)}`}
          </Text>
        </View>

        {!isPast && (
          daysLeft === 0 ? (
            <View style={[ec.todayPill, { backgroundColor: event.color }]}>
              <View style={ec.todayDot} />
              <Text style={ec.todayPillText}>TODAY</Text>
            </View>
          ) : (
            <View style={ec.countdown}>
              <Text style={[ec.countNum, { color: event.color }]}>{daysLeft}</Text>
              <Text style={ec.countLabel}>{daysLeft === 1 ? 'day' : 'days'}</Text>
            </View>
          )
        )}
      </Pressable>

      {deleteButton}
    </Animated.View>
  );
}

const ec = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#EDE9E0',
    paddingRight: 6, marginBottom: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
  },
  cardPast: {
    backgroundColor: '#F4F1EB',
    borderColor: '#E2DDD3',
    shadowOpacity: 0,
    elevation: 0,
  },
  cardRecurring: {
    flexDirection: 'column', alignItems: 'stretch',
    backgroundColor: '#F3F6F3',
    borderColor: '#D8E3DC',
    paddingRight: 0,
    shadowOpacity: 0.018,
    elevation: 0,
    overflow: 'hidden',
  },
  recurringRail: {
    position: 'absolute', left: 0, top: 11, bottom: 11, width: 3, borderRadius: 2,
    backgroundColor: '#7FA491', opacity: 0.72,
    zIndex: 1,
  },
  recTopRow: { flexDirection: 'row', alignItems: 'center', paddingRight: 6 },
  recTap: { flex: 1, flexDirection: 'row', alignItems: 'center', columnGap: 12, paddingHorizontal: 14, paddingVertical: 11, paddingRight: 4 },
  recTag: { marginTop: 3, flexDirection: 'row', alignItems: 'center', columnGap: 4 },
  recTagText: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.5, color: '#7D9186', textTransform: 'uppercase' },
  // The calendar medallion — the beautified date display.
  medallion: {
    width: 46, borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, backgroundColor: '#FFFFFF', alignItems: 'stretch',
  },
  medallionCap: { paddingVertical: 2.5, alignItems: 'center' },
  medallionMonth: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.2 },
  medallionDay: {
    paddingTop: 2, paddingBottom: 3, textAlign: 'center',
    fontFamily: F.serifSemiBold, fontSize: 20, lineHeight: 23, color: '#41514A',
  },
  // The foot bar — reminder lead-days on the left, days-until on the right.
  recFoot: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', columnGap: 10,
    borderTopWidth: 1, borderTopColor: '#E1EAE4', backgroundColor: 'rgba(226,236,230,0.5)',
    paddingLeft: 14, paddingRight: 12, paddingVertical: 8,
  },
  recFootLeft: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', columnGap: 7 },
  recFootIcon: {
    width: 22, height: 22, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#DCE9E1', borderWidth: 1, borderColor: '#CBDFD4',
  },
  recFootIconOff: { backgroundColor: '#ECEAE4', borderColor: '#DED9CF' },
  recFootText: { flex: 1, minWidth: 0, fontFamily: F.sansMedium, fontSize: 11.5, color: '#607A6D' },
  recFootCount: {
    borderRadius: 999, backgroundColor: '#E5EFE9', borderWidth: 1, borderColor: '#D2E1D9',
    paddingHorizontal: 9, paddingVertical: 3.5,
  },
  recFootCountText: { fontFamily: F.sansBold, fontSize: 9.5, letterSpacing: 0.5, color: '#5A7669', fontVariant: ['tabular-nums'] },
  tap:     { flex: 1, flexDirection: 'row', alignItems: 'center', columnGap: 12, paddingHorizontal: 14, paddingVertical: 11, paddingRight: 4 },
  iconBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  iconBoxRecurring: { borderWidth: 1, borderColor: '#D1E1D8' },
  iconBoxPast: { borderWidth: 1, borderColor: '#DDD7CE' },
  eventGlyph: { alignItems: 'center', justifyContent: 'center' },
  eventGlyphRecurring: { opacity: 0.76 },
  eventGlyphPast: { opacity: 0.48 },
  copy:    { flex: 1, minWidth: 0 },
  title:   { fontFamily: F.serifMedium, fontSize: 17, color: C.text },
  titleRecurring: { color: '#52645B' },
  titlePast: { color: '#827C73' },
  range:   { marginTop: 2, fontFamily: F.sansBold, fontSize: 9.5, letterSpacing: 1.4, color: '#A8A29E', textTransform: 'uppercase' },
  rangePast: { color: '#B6AEA4' },
  countdown: { width: 52, alignItems: 'center', justifyContent: 'center' },
  countNum:  { width: '100%', textAlign: 'center', fontFamily: F.serifSemiBold, fontSize: 26, lineHeight: 28 },
  countLabel:{ width: '100%', marginTop: 2, textAlign: 'center', fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.5, color: '#A8A29E', textTransform: 'uppercase' },
  todayPill: {
    flexDirection: 'row', alignItems: 'center', columnGap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 4, elevation: 3,
  },
  todayDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.95)' },
  todayPillText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 1.4, color: '#FFFFFF' },
  del:     { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
});

function EventSectionHeader({ variant, count }: { variant: EventCardVariant; count: number }) {
  const copy = variant === 'upcoming'
    ? { label: 'UPCOMING', detail: 'Inside their active countdown window' }
    : variant === 'recurring'
      ? { label: 'RECURRING', detail: 'Waiting for their next lead window' }
      : { label: 'PAST', detail: 'Completed one-time events' };

  return (
    <View style={s.sectionHeader}>
      <View style={s.sectionHeaderCopy}>
        <Text style={[
          s.sectionLabel,
          variant === 'recurring' && s.sectionLabelRecurring,
          variant === 'past' && s.sectionLabelPast,
        ]}>{copy.label}</Text>
        <Text style={[
          s.sectionDetail,
          variant === 'recurring' && s.sectionDetailRecurring,
          variant === 'past' && s.sectionDetailPast,
        ]}>{copy.detail}</Text>
      </View>
      <View style={[
        s.sectionCount,
        variant === 'recurring' && s.sectionCountRecurring,
        variant === 'past' && s.sectionCountPast,
      ]}>
        <Text style={[
          s.sectionCountText,
          variant === 'recurring' && s.sectionCountTextRecurring,
          variant === 'past' && s.sectionCountTextPast,
        ]}>{count}</Text>
      </View>
    </View>
  );
}

// ─── Empty state ────────────────────────────────────────────────────────────

function EmptyState({ onAddPress }: { onAddPress: () => void }) {
  return (
    <Animated.View
      entering={FadeIn.duration(220).easing(Easing.out(Easing.cubic))}
      exiting={FadeOut.duration(120).easing(Easing.in(Easing.quad))}
      style={es.wrap}
    >
      <View style={es.iconCircle}>
        <CalendarHeart s={32} c={GOLD} w={1.6} />
      </View>

      <Text style={es.eyebrow}>MILESTONES & MOMENTS</Text>
      <Text style={es.title}>Mark what matters</Text>

      <Text style={es.body}>
        Big Events are the moments you are walking toward — a wedding, a journey,
        a deadline, a quiet anniversary. Add one to keep it in view as the days draw near.
      </Text>

      <View style={es.tipCard}>
        <View style={es.tipRow}>
          <View style={es.tipDot} />
          <Text style={es.tipText}>Each event shows a daily countdown</Text>
        </View>
        <View style={es.tipRow}>
          <View style={es.tipDot} />
          <Text style={es.tipText}>Choose when it begins appearing on Home</Text>
        </View>
        <View style={es.tipRow}>
          <View style={es.tipDot} />
          <Text style={es.tipText}>Birthdays and anniversaries can repeat every year</Text>
        </View>
      </View>

      <TouchableOpacity onPress={onAddPress} activeOpacity={0.86} style={es.cta}>
        <Plus s={16} c="#FFFFFF" w={2.4} />
        <Text style={es.ctaText}>ADD YOUR FIRST EVENT</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const es = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: 36, paddingBottom: 40, paddingHorizontal: 8 },
  iconCircle: {
    width: 78, height: 78, borderRadius: 26,
    backgroundColor: 'rgba(197,160,89,0.10)',
    borderWidth: 1, borderColor: 'rgba(197,160,89,0.22)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 22,
  },
  eyebrow: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.4, color: GOLD, marginBottom: 8 },
  title:   { fontFamily: F.serifMedium, fontSize: 26, lineHeight: 30, color: C.text, marginBottom: 14 },
  body: {
    fontFamily: F.serif, fontSize: 15, lineHeight: 22, color: C.textSecondary,
    textAlign: 'center', maxWidth: 320, marginBottom: 22,
  },
  tipCard: {
    width: '100%', maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 18, borderWidth: 1, borderColor: '#EDE9E0',
    paddingHorizontal: 18, paddingVertical: 14,
    rowGap: 10,
    marginBottom: 22,
  },
  tipRow:  { flexDirection: 'row', alignItems: 'center', columnGap: 12 },
  tipDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: GOLD },
  tipText: { flex: 1, fontFamily: F.serif, fontSize: 14, lineHeight: 19, color: C.textSecondary },
  cta: {
    flexDirection: 'row', alignItems: 'center', columnGap: 8,
    backgroundColor: GOLD, borderRadius: 16,
    paddingHorizontal: 20, paddingVertical: 13,
    shadowColor: GOLD, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 10, elevation: 4,
  },
  ctaText: { fontFamily: F.sansBold, fontSize: 12, letterSpacing: 1.6, color: '#FFFFFF' },
});

// ─── Main view ──────────────────────────────────────────────────────────────

export default function BigEventsView({
  guided = false,
  onGuidedComplete,
}: {
  guided?: boolean;
  onGuidedComplete?: () => void;
} = {}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    completeStep,
    patchSession,
    session,
    setPresentation,
  } = useGuidedSetup();
  const { bigEvents, addBigEvent, updateBigEvent, softDeleteBigEvent } = useBigEvents();
  const [form, setForm] = useState<FormState | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const today = todayKey();
  const isGuided = guided && session?.active === true && session.activeStep === 'buildBigEvents';
  const addTarget = useGuideTarget(BIG_EVENTS_GUIDE_TARGETS.add, isGuided);
  const guidePhase = session?.phase ?? 'intro';

  const { upcoming, recurring, past } = useMemo(
    () => getBigEventSectionsForDate(bigEvents, today),
    [bigEvents, today],
  );

  const openNew = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setForm(emptyForm());
    setEditorOpen(true);
    if (isGuided) patchSession({ phase: 'title' });
  };

  const openEdit = (event: BigEvent) => {
    if (event.endDate < today) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const source = bigEvents.find(candidate => candidate.id === event.id) ?? event;
    setForm({
      id: source.id,
      title: source.title,
      endDate: source.endDate,
      icon: normalizeHabitIcon(source.icon),
      recurrence: source.recurrence,
      leadDays: source.leadDays || BIG_EVENT_DEFAULT_LEAD_DAYS,
      remindersEnabled: source.remindersEnabled,
    });
    setEditorOpen(true);
  };

  const closeForm = () => setEditorOpen(false);

  const saveForm = async () => {
    if (!form) return;
    const trimmed = form.title.trim();
    if (!trimmed) return;
    if (form.recurrence === 'none' && form.endDate < today) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setForm({ ...form, endDate: today });
      return;
    }
    const leadDays = normalizeBigEventLeadDays(form.leadDays, form.recurrence);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (form.id === null) {
      const today = todayKey();
      const eventId = newId();
      await addBigEvent({
        id: eventId,
        title: trimmed,
        startDate: form.recurrence === 'yearly'
          ? addDaysToDateKey(form.endDate, -leadDays)
          : today,
        endDate: form.endDate,
        color: DEFAULT_EVENT_COLOR,
        icon: form.icon,
        recurrence: form.recurrence,
        leadDays,
        remindersEnabled: form.recurrence === 'yearly' && form.remindersEnabled,
      });
      if (isGuided) {
        notifyGuideEvent({
          type: 'completed',
          step: 'buildBigEvents',
          phase: 'complete',
          entityKey: 'bigEvent',
          entityId: eventId,
        });
      }
    } else {
      const existing = bigEvents.find(e => e.id === form.id);
      if (existing) {
        await updateBigEvent({
          ...existing,
          title: trimmed,
          startDate: form.recurrence === 'yearly'
            ? addDaysToDateKey(form.endDate, -leadDays)
            : existing.startDate,
          endDate: form.endDate,
          icon: form.icon,
          recurrence: form.recurrence,
          leadDays,
          remindersEnabled: form.recurrence === 'yearly' && form.remindersEnabled,
        });
      }
    }
    setEditorOpen(false);
  };

  const finishGuidedStep = useCallback(() => {
    completeStep('buildBigEvents');
    setPresentation(null);
    onGuidedComplete?.();
  }, [completeStep, onGuidedComplete, setPresentation]);

  const addAnotherGuidedEvent = useCallback(() => {
    setPresentation(null);
    setForm(emptyForm());
    setEditorOpen(true);
    patchSession({ phase: 'title' });
  }, [patchSession, setPresentation]);

  useEffect(() => {
    if (!isGuided || editorOpen || guidePhase === 'intro' || guidePhase === 'complete') return;
    setForm(emptyForm());
    setEditorOpen(true);
  }, [editorOpen, guidePhase, isGuided]);

  useEffect(() => {
    if (!isGuided) return;

    if (guidePhase === 'intro') {
      setPresentation({
        key: 'big-events-intro',
        targetId: BIG_EVENTS_GUIDE_TARGETS.add,
        placement: 'below',
        allowTargetInteraction: true,
        eyebrow: 'BIG EVENTS',
        message: 'Important dates should stay in view — long before they become urgent.',
        highlights: ['stay in view'],
        chips: ['Birthday', 'Wedding', 'Exam', 'Trip'],
        action: 'Tap + to add your first event',
        hint: 'tap',
      });
      return;
    }
    if (guidePhase === 'title') {
      setPresentation({
        key: 'big-events-title',
        targetId: BIG_EVENTS_GUIDE_TARGETS.title,
        placement: 'below',
        allowTargetInteraction: true,
        eyebrow: 'NEW EVENT',
        progress: { current: 1, total: 4 },
        message: 'Give it a name — the way you would say it out loud.',
        highlights: ['name'],
        action: 'Type the name, then tap Done',
      });
      return;
    }
    if (guidePhase === 'date') {
      setPresentation({
        key: 'big-events-date',
        targetId: BIG_EVENTS_GUIDE_TARGETS.date,
        placement: 'below',
        allowTargetInteraction: true,
        eyebrow: 'NEW EVENT',
        progress: { current: 2, total: 4 },
        message: 'Set the day it happens. Anasta keeps the countdown close from today on.',
        highlights: ['countdown'],
        action: 'Tap the date row to pick a day',
        hint: 'tap',
        hintAnchor: 'left',
      });
      return;
    }
    if (guidePhase === 'icon') {
      setPresentation({
        key: 'big-events-icon',
        targetId: BIG_EVENTS_GUIDE_TARGETS.icons,
        cutoutPadding: 5,
        placement: 'above',
        allowTargetInteraction: true,
        eyebrow: 'NEW EVENT',
        progress: { current: 3, total: 4 },
        message: 'Choose an icon you will recognize at a glance.',
        highlights: ['at a glance'],
        action: 'Tap an icon to select it',
      });
      return;
    }
    if (guidePhase === 'save') {
      setPresentation({
        key: 'big-events-save',
        targetId: BIG_EVENTS_GUIDE_TARGETS.save,
        placement: 'above',
        allowTargetInteraction: true,
        eyebrow: 'NEW EVENT',
        progress: { current: 4, total: 4 },
        message: 'Everything is ready.',
        action: 'Save your first Big Event',
        hint: 'tap',
        hintAnchor: 'left',
      });
      return;
    }
    if (guidePhase === 'complete') {
      setPresentation({
        key: 'big-events-complete',
        placement: 'center',
        celebrate: true,
        eyebrow: 'BIG EVENTS',
        message: 'Your first Big Event is saved. It will live on Home, counting down as the day draws near.\n\nWould you like to add another?',
        highlights: ['counting down'],
        ctaLabel: 'Add another event',
        onCta: addAnotherGuidedEvent,
        secondaryCtaLabel: 'Continue',
        onSecondaryCta: finishGuidedStep,
      });
    }
  }, [addAnotherGuidedEvent, finishGuidedStep, guidePhase, isGuided, setPresentation]);

  useEffect(() => () => {
    if (guided) setPresentation(null);
  }, [guided, setPresentation]);

  const askDelete = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setConfirmId(id);
  };

  const confirmDelete = async () => {
    if (!confirmId) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await softDeleteBigEvent(confirmId);
    setConfirmId(null);
    if (editorOpen && form?.id === confirmId) setEditorOpen(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <ScreenTitleBar
        title="BIG EVENTS"
        showBack={!isGuided}
        bg={BG}
        onBackOverride={() => router.back()}
        rightElement={
          <TouchableOpacity
            ref={addTarget.ref}
            onLayout={addTarget.onLayout}
            onPress={editorOpen ? closeForm : openNew}
            style={s.headRight}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            {editorOpen
              ? <X s={22} c={C.textMuted} />
              : <Plus s={22} c={GOLD} w={2.4} />}
          </TouchableOpacity>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40, paddingTop: 8 }}
        keyboardShouldPersistTaps="handled"
      >
        {upcoming.length > 0 && (
          <Animated.View
            entering={FadeIn.duration(170).easing(Easing.out(Easing.cubic))}
            exiting={FadeOut.duration(120).easing(Easing.in(Easing.quad))}
            layout={LinearTransition.duration(220).easing(Easing.bezier(0.22, 1, 0.36, 1))}
            style={s.section}
          >
            <EventSectionHeader variant="upcoming" count={upcoming.length} />
            {upcoming.map(e => (
              <EventCard
                key={e.id}
                event={e}
                today={today}
                variant="upcoming"
                onTap={() => openEdit(e)}
                onAskDelete={() => askDelete(e.id)}
              />
            ))}
          </Animated.View>
        )}

        {recurring.length > 0 && (
          <Animated.View
            entering={FadeIn.duration(170).easing(Easing.out(Easing.cubic))}
            exiting={FadeOut.duration(120).easing(Easing.in(Easing.quad))}
            layout={LinearTransition.duration(220).easing(Easing.bezier(0.22, 1, 0.36, 1))}
            style={s.section}
          >
            <EventSectionHeader variant="recurring" count={recurring.length} />
            {recurring.map(e => (
              <EventCard
                key={e.id}
                event={e}
                today={today}
                variant="recurring"
                onTap={() => openEdit(e)}
                onAskDelete={() => askDelete(e.id)}
              />
            ))}
          </Animated.View>
        )}

        {past.length > 0 && (
          <Animated.View
            entering={FadeIn.duration(170).easing(Easing.out(Easing.cubic))}
            exiting={FadeOut.duration(120).easing(Easing.in(Easing.quad))}
            layout={LinearTransition.duration(220).easing(Easing.bezier(0.22, 1, 0.36, 1))}
            style={s.section}
          >
            <EventSectionHeader variant="past" count={past.length} />
            {past.map(e => (
              <EventCard
                key={e.id}
                event={e}
                today={today}
                variant="past"
                onTap={undefined}
                onAskDelete={() => askDelete(e.id)}
              />
            ))}
          </Animated.View>
        )}

        {upcoming.length === 0 && recurring.length === 0 && past.length === 0 && !editorOpen && (
          <EmptyState onAddPress={openNew} />
        )}
      </ScrollView>

      <BigEventEditorSheet
        visible={editorOpen}
        form={form}
        onChange={setForm}
        onSave={saveForm}
        onClose={closeForm}
        minDate={today}
        guided={isGuided}
      />

      <ConfirmModal
        visible={!!confirmId}
        icon={<Trash2 s={22} c={C.red} w={2} />}
        iconBg="#FEE2E2"
        title="Delete event?"
        body="This event will disappear from today onward."
        confirmLabel="DELETE"
        confirmColor={C.red}
        onCancel={() => setConfirmId(null)}
        onConfirm={confirmDelete}
      />
    </View>
  );
}

const s = StyleSheet.create({
  headRight: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  section: { marginBottom: 16 },
  sectionHeader: {
    minHeight: 47, marginBottom: 8, paddingHorizontal: 4,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', columnGap: 12,
  },
  sectionHeaderCopy: { flex: 1, minWidth: 0 },
  sectionLabel: { fontFamily: F.sansBold, fontSize: 11.5, lineHeight: 14, letterSpacing: 2.25, color: '#9C7A3F' },
  sectionLabelRecurring: { color: '#62816F' },
  sectionLabelPast: { color: '#9D968C' },
  sectionDetail: { marginTop: 3, fontFamily: F.serif, fontSize: 13.5, lineHeight: 17, color: '#A19688' },
  sectionDetailRecurring: { color: '#819187' },
  sectionDetailPast: { color: '#ADA79F' },
  sectionCount: {
    minWidth: 29, height: 29, borderRadius: 15, paddingHorizontal: 8,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#E9D8B4', backgroundColor: '#FFF7E6',
  },
  sectionCountRecurring: { borderColor: '#D2E2D9', backgroundColor: '#EAF2ED' },
  sectionCountPast: { borderColor: '#E2DED7', backgroundColor: '#F1EFEB' },
  sectionCountText: { fontFamily: F.sansBold, fontSize: 11, color: '#9C7A3F', fontVariant: ['tabular-nums'] },
  sectionCountTextRecurring: { color: '#62816F' },
  sectionCountTextPast: { color: '#999289' },
});
