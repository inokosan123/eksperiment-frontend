import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import ConfirmModal from '@/components/shared/ConfirmModal';
import {
  Calendar as CalendarIcon,
  CalendarHeart,
  CheckSmall,
  ChevronDown,
  Plus,
  Trash2,
  X,
} from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import { NotoEmoji } from '@/components/shared/NotoEmoji';
import { normalizeHabitIcon } from '@/components/shared/notoEmoji/legacyMap';
import type { HabitEmojiName } from '@/components/shared/notoEmoji/habits';
import { useBigEvents } from './BigEventsContext';
import {
  formatDateMedium,
  formatDateShort,
  getBigEventCountdown,
  isBigEventDeletedOnDate,
  sortBigEvents,
  todayKey,
} from './bigEventsLogic';
import type { BigEvent } from './bigEventsDb';
import { HapticTouchableOpacity as TouchableOpacity, HapticPressable as Pressable } from '@/components/shared/HapticTouch';
import {
  notifyGuideEvent,
  useGuidedSetup,
  useGuideTarget,
} from '@/components/onboarding/guided/GuidedSetupContext';


const DateTimePickerModule = Platform.OS === 'web' ? null : require('@react-native-community/datetimepicker');
const NativeDateTimePicker = DateTimePickerModule?.default ?? null;
const NativeDateTimePickerAndroid = DateTimePickerModule?.DateTimePickerAndroid ?? null;

const BG = '#FAF7F0';
const GOLD = '#C5A059';
const DEFAULT_EVENT_COLOR = GOLD;
const EVENT_ICON_CHIP_SIZE = 54;
const EVENT_ICON_MIN_GAP = 9;
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
  const [iosVisible, setIosVisible] = useState(false);
  const [draft, setDraft] = useState(value);

  const open = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (Platform.OS === 'android' && NativeDateTimePickerAndroid) {
      NativeDateTimePickerAndroid.open({
        value: dateFromKey(value),
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
          onChange(`${y}-${m}-${d}`);
          onGuideConfirmed?.();
        },
      });
      return;
    }

    setDraft(value);
    setIosVisible(true);
  };

  const apply = () => {
    onChange(draft);
    setIosVisible(false);
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

      <Modal transparent visible={iosVisible} animationType="fade" onRequestClose={() => setIosVisible(false)}>
        <View style={d.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setIosVisible(false)} />
          <View style={d.modalSheet}>
            <View style={d.modalHandle} />
            <View style={d.modalHead}>
              <Text style={d.modalTitle}>{label}</Text>
              <TouchableOpacity onPress={() => setIosVisible(false)} style={d.modalClose}>
                <X s={18} c="#A8A29E" />
              </TouchableOpacity>
            </View>

            {Platform.OS === 'ios' && NativeDateTimePicker && (
              <View style={d.iosWrap}>
                <NativeDateTimePicker
                  value={dateFromKey(draft)}
                  minimumDate={minDate ? dateFromKey(minDate) : undefined}
                  maximumDate={maxDate ? dateFromKey(maxDate) : undefined}
                  mode="date"
                  display="inline"
                  themeVariant="light"
                  accentColor={GOLD}
                  onChange={(_event: unknown, selectedDate?: Date) => {
                    if (!selectedDate) return;
                    const y = selectedDate.getFullYear();
                    const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
                    const day = String(selectedDate.getDate()).padStart(2, '0');
                    setDraft(`${y}-${m}-${day}`);
                  }}
                />
              </View>
            )}

            <TouchableOpacity onPress={apply} activeOpacity={0.88} style={d.modalSave}>
              <Text style={d.modalSaveText}>SAVE DATE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const d = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', columnGap: 12,
    backgroundColor: '#FFFBF2', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(197,160,89,0.2)',
    paddingHorizontal: 14, paddingVertical: 12,
  },
  iconWrap: { width: 32, height: 32, borderRadius: 11, backgroundColor: 'rgba(197,160,89,0.12)', alignItems: 'center', justifyContent: 'center' },
  copy:    { flex: 1 },
  label:   { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.6, color: '#A09487' },
  value:   { marginTop: 2, fontFamily: F.serifMedium, fontSize: 15, color: C.text },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.42)', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: '#FAF7F0', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
  modalHandle:  { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: '#D6D3CC', marginBottom: 8 },
  modalHead:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, paddingBottom: 6 },
  modalTitle:   { fontFamily: F.serifMedium, fontSize: 18, color: C.text },
  modalClose:   { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  iosWrap:      { backgroundColor: '#FFFFFF', borderRadius: 16, marginVertical: 10, paddingVertical: 6 },
  modalSave:    { backgroundColor: GOLD, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  modalSaveText:{ fontFamily: F.sansBold, fontSize: 12, letterSpacing: 1.8, color: '#fff' },
});

// ─── Add / Edit form ────────────────────────────────────────────────────────

type FormState = {
  id: string | null;       // null = new
  title: string;
  endDate: string;
  icon: HabitEmojiName;
};

function emptyForm(): FormState {
  return {
    id: null,
    title: '',
    endDate: todayKey(),
    icon: EVENT_ICONS[0],
  };
}

function EventForm({
  form,
  onChange,
  onSave,
  onCancel,
  guided = false,
}: {
  form: FormState;
  onChange: (next: FormState) => void;
  onSave: () => void;
  onCancel: () => void;
  guided?: boolean;
}) {
  const { session, patchSession } = useGuidedSetup();
  const isGuided = guided && session?.active === true && session.activeStep === 'buildBigEvents';
  const titleTarget = useGuideTarget(BIG_EVENTS_GUIDE_TARGETS.title, isGuided);
  const iconsTarget = useGuideTarget(BIG_EVENTS_GUIDE_TARGETS.icons, isGuided);
  const dateTarget = useGuideTarget(BIG_EVENTS_GUIDE_TARGETS.date, isGuided);
  const saveTarget = useGuideTarget(BIG_EVENTS_GUIDE_TARGETS.save, isGuided);
  const canSave = !!form.title.trim() && !!form.endDate;
  const isEdit = form.id !== null;
  const guidePhase = session?.phase;
  const [iconGridWidth, setIconGridWidth] = useState(0);
  const iconColumns = iconGridWidth > 0
    ? Math.max(3, Math.floor((iconGridWidth + EVENT_ICON_MIN_GAP) / (EVENT_ICON_CHIP_SIZE + EVENT_ICON_MIN_GAP)))
    : 5;
  const trailingSpacerCount = (iconColumns - (EVENT_ICONS.length % iconColumns)) % iconColumns;
  const trailingSpacers = useMemo(
    () => Array.from({ length: trailingSpacerCount }, (_, index) => index),
    [trailingSpacerCount],
  );
  const advanceAfterTitle = () => {
    if (isGuided && guidePhase === 'title' && form.title.trim()) {
      patchSession({ phase: 'icon' });
    }
  };
  const advanceAfterIcon = () => {
    if (isGuided && guidePhase === 'icon') {
      patchSession({ phase: 'date' });
    }
  };
  const advanceAfterDate = () => {
    if (isGuided && guidePhase === 'date') {
      patchSession({ phase: 'save' });
    }
  };

  return (
    <Animated.View
      style={ef.wrap}
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(160)}
      layout={LinearTransition.springify().damping(15).stiffness(160).mass(1)}
    >
      <View style={ef.head}>
        <Text style={ef.heading}>{isEdit ? 'EDIT EVENT' : 'NEW EVENT'}</Text>
        <TouchableOpacity onPress={onCancel} style={ef.close} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <X s={16} c={C.textMuted} />
        </TouchableOpacity>
      </View>

      <TextInput
        ref={titleTarget.ref}
        onLayout={titleTarget.onLayout}
        value={form.title}
        onChangeText={t => onChange({ ...form, title: t })}
        placeholder="Event name..."
        placeholderTextColor="#C7C0B4"
        style={ef.input}
        returnKeyType="done"
        onSubmitEditing={advanceAfterTitle}
      />

      <DateRow
        label="Event"
        value={form.endDate}
        onChange={v => onChange({ ...form, endDate: v })}
        guideTarget={dateTarget}
        onGuideConfirmed={advanceAfterDate}
      />

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
          {EVENT_ICONS.map(ic => {
            const active = form.icon === ic;
            return (
              <Pressable
                key={ic}
                onPress={() => {
                  Haptics.selectionAsync();
                  onChange({ ...form, icon: ic });
                  advanceAfterIcon();
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [
                  ef.iconChip,
                  active && ef.iconChipActive,
                  pressed && { opacity: 0.78 },
                ]}
              >
                <View style={ef.iconGlyphBox}>
                  <NotoEmoji name={ic} size={32} />
                </View>
                {active && (
                  <View pointerEvents="none" style={ef.iconSelectedBadge}>
                    <CheckSmall s={12} c="#FFFFFF" w={3} />
                  </View>
                )}
              </Pressable>
            );
          })}
          {trailingSpacers.map(index => (
            <View key={`icon-spacer-${index}`} pointerEvents="none" style={ef.iconGridSpacer} />
          ))}
        </View>
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
  head:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 2, color: C.textMuted },
  close: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },

  input: {
    backgroundColor: '#F8F5EE', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    fontFamily: F.serifMedium, fontSize: 16, color: C.text,
  },

  sectionLabel: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.8, color: C.textMuted, marginBottom: 8 },

  iconGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: EVENT_ICON_MIN_GAP,
  },
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

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', columnGap: 8,
    backgroundColor: GOLD, borderRadius: 16, paddingVertical: 14, marginTop: 4,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveText: { fontFamily: F.sansBold, fontSize: 12, letterSpacing: 1.6, color: '#fff' },
});

// ─── Event card ─────────────────────────────────────────────────────────────

function EventCard({
  event, today, isPast, onTap, onAskDelete,
}: {
  event: BigEvent;
  today: string;
  isPast: boolean;
  onTap: () => void;
  onAskDelete: () => void;
}) {
  const daysLeft = getBigEventCountdown(event, today);
  const tintBg = `${event.color}22`;

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(140)}
      layout={LinearTransition.springify().damping(15).stiffness(160).mass(1)}
      style={[ec.card, isPast && ec.cardPast]}
    >
      <Pressable onPress={onTap} style={ec.tap} android_ripple={{ color: 'rgba(0,0,0,0.04)' }}>
        <View style={[ec.iconBox, { backgroundColor: tintBg }]}>
          <NotoEmoji name={normalizeHabitIcon(event.icon)} size={26} />
        </View>
        <View style={ec.copy}>
          <Text style={ec.title} numberOfLines={1}>{event.title}</Text>
          <Text style={ec.range} numberOfLines={1}>
            {formatDateShort(event.startDate)} – {formatDateMedium(event.endDate)}
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

      <TouchableOpacity onPress={onAskDelete} style={ec.del} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
        <Trash2 s={16} c="#C9C2B5" w={1.8} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const ec = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#EDE9E0',
    paddingRight: 6, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
  },
  cardPast: { opacity: 0.55 },
  tap:     { flex: 1, flexDirection: 'row', alignItems: 'center', columnGap: 12, padding: 14, paddingRight: 6 },
  iconBox: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  copy:    { flex: 1, minWidth: 0 },
  title:   { fontFamily: F.serifMedium, fontSize: 16, color: C.text },
  range:   { marginTop: 2, fontFamily: F.sansBold, fontSize: 9.5, letterSpacing: 1.4, color: '#A8A29E', textTransform: 'uppercase' },
  countdown: { alignItems: 'flex-end' },
  countNum:  { fontFamily: F.serifSemiBold, fontSize: 26, lineHeight: 28 },
  countLabel:{ marginTop: 2, fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.5, color: '#A8A29E', textTransform: 'uppercase' },
  todayPill: {
    flexDirection: 'row', alignItems: 'center', columnGap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 4, elevation: 3,
  },
  todayDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.95)' },
  todayPillText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 1.4, color: '#FFFFFF' },
  del:     { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
});

// ─── Empty state ────────────────────────────────────────────────────────────

function EmptyState({ onAddPress }: { onAddPress: () => void }) {
  return (
    <Animated.View entering={FadeIn.duration(260)} style={es.wrap}>
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
          <Text style={es.tipText}>Appears on Home from the day you create it</Text>
        </View>
        <View style={es.tipRow}>
          <View style={es.tipDot} />
          <Text style={es.tipText}>Past events stay in your history</Text>
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
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const today = todayKey();
  const isGuided = guided && session?.active === true && session.activeStep === 'buildBigEvents';
  const addTarget = useGuideTarget(BIG_EVENTS_GUIDE_TARGETS.add, isGuided);
  const guidePhase = session?.phase ?? 'intro';

  const { upcoming, past } = useMemo(() => {
    const sorted = sortBigEvents(bigEvents).filter(e => !isBigEventDeletedOnDate(e, today));
    return {
      upcoming: sorted.filter(e => e.endDate >= today),
      past: sorted.filter(e => e.endDate < today),
    };
  }, [bigEvents, today]);

  const openNew = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setForm(emptyForm());
    if (isGuided) patchSession({ phase: 'title' });
  };

  const openEdit = (event: BigEvent) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setForm({
      id: event.id,
      title: event.title,
      endDate: event.endDate,
      icon: normalizeHabitIcon(event.icon),
    });
  };

  const closeForm = () => setForm(null);

  const saveForm = async () => {
    if (!form) return;
    const trimmed = form.title.trim();
    if (!trimmed) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (form.id === null) {
      const today = todayKey();
      const eventId = newId();
      await addBigEvent({
        id: eventId,
        title: trimmed,
        startDate: today,
        endDate: form.endDate,
        color: DEFAULT_EVENT_COLOR,
        icon: form.icon,
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
          endDate: form.endDate,
          icon: form.icon,
        });
      }
    }
    setForm(null);
  };

  const finishGuidedStep = useCallback(() => {
    completeStep('buildBigEvents');
    patchSession({
      activeStep: 'buildMonthlyGoals',
      phase: 'intro',
      route: '/onboarding',
    });
    setPresentation(null);
    onGuidedComplete?.();
  }, [completeStep, onGuidedComplete, patchSession, setPresentation]);

  useEffect(() => {
    if (!isGuided || form || guidePhase === 'intro' || guidePhase === 'complete') return;
    setForm(emptyForm());
  }, [form, guidePhase, isGuided]);

  useEffect(() => {
    if (!isGuided) return;

    if (guidePhase === 'intro') {
      setPresentation({
        key: 'big-events-intro',
        targetId: BIG_EVENTS_GUIDE_TARGETS.add,
        placement: 'below',
        allowTargetInteraction: true,
        message: 'Big Events keep important dates in view before they become urgent.\n\nBirthday  |  Wedding  |  Exam\n\nTap + to add your first one.',
      });
      return;
    }
    if (guidePhase === 'title') {
      setPresentation({
        key: 'big-events-title',
        targetId: BIG_EVENTS_GUIDE_TARGETS.title,
        placement: 'below',
        allowTargetInteraction: true,
        message: 'Start with its name. When it feels right, tap Done.',
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
        message: 'Choose an icon so you can recognize this moment at a glance.',
      });
      return;
    }
    if (guidePhase === 'date') {
      setPresentation({
        key: 'big-events-date',
        targetId: BIG_EVENTS_GUIDE_TARGETS.date,
        placement: 'below',
        allowTargetInteraction: true,
        message: 'Now set the date. Anasta will keep the countdown close.',
      });
      return;
    }
    if (guidePhase === 'save') {
      setPresentation({
        key: 'big-events-save',
        targetId: BIG_EVENTS_GUIDE_TARGETS.save,
        placement: 'above',
        allowTargetInteraction: true,
        message: 'Everything is ready. Save your first Big Event.',
      });
      return;
    }
    if (guidePhase === 'complete') {
      setPresentation({
        key: 'big-events-complete',
        placement: 'center',
        celebrate: true,
        message: 'Your first Big Event is set.',
        ctaLabel: 'CONTINUE',
        onCta: finishGuidedStep,
      });
    }
  }, [finishGuidedStep, guidePhase, isGuided, setPresentation]);

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
    if (form?.id === confirmId) setForm(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <ScreenTitleBar
        title="BIG EVENTS"
        showBack
        bg={BG}
        onBackOverride={() => router.back()}
        rightElement={
          <TouchableOpacity
            ref={addTarget.ref}
            onLayout={addTarget.onLayout}
            onPress={form ? closeForm : openNew}
            style={s.headRight}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            {form
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
        {form && (
          <EventForm
            form={form}
            onChange={setForm}
            onSave={saveForm}
            onCancel={closeForm}
            guided={isGuided}
          />
        )}

        {upcoming.length > 0 && (
          <Animated.View layout={LinearTransition.springify().damping(15).stiffness(160).mass(1)} style={{ marginBottom: 20 }}>
            <Text style={s.sectionLabel}>UPCOMING</Text>
            {upcoming.map(e => (
              <EventCard
                key={e.id}
                event={e}
                today={today}
                isPast={false}
                onTap={() => openEdit(e)}
                onAskDelete={() => askDelete(e.id)}
              />
            ))}
          </Animated.View>
        )}

        {past.length > 0 && (
          <Animated.View layout={LinearTransition.springify().damping(15).stiffness(160).mass(1)}>
            <Text style={s.sectionLabel}>PAST</Text>
            {past.map(e => (
              <EventCard
                key={e.id}
                event={e}
                today={today}
                isPast
                onTap={() => openEdit(e)}
                onAskDelete={() => askDelete(e.id)}
              />
            ))}
          </Animated.View>
        )}

        {upcoming.length === 0 && past.length === 0 && !form && (
          <EmptyState onAddPress={openNew} />
        )}
      </ScrollView>

      <ConfirmModal
        visible={!!confirmId}
        icon={<Trash2 s={22} c="#EF4444" w={2} />}
        iconBg="#FEE2E2"
        title="Delete event?"
        body="This event will disappear from today onward."
        confirmLabel="DELETE"
        confirmColor="#EF4444"
        onCancel={() => setConfirmId(null)}
        onConfirm={confirmDelete}
      />
    </View>
  );
}

const s = StyleSheet.create({
  headRight: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2, color: C.textMuted, marginBottom: 10, marginLeft: 4 },
});
