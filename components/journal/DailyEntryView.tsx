import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import {
  CheckSmall,
  ChevronDown,
  ChevronUp,
  Plus,
  SlidersHorizontal,
  Trash2,
  X,
} from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { FormatState, RichTextEditor, RichTextEditorRef, RichToolbar } from '@/components/shared/RichTextEditor';
import { NotoLottie, type MoodName, type EnergyName } from '@/components/shared/NotoLottie';
import { useInnerTools } from '@/components/inner-tools/InnerToolsContext';
import { useMonthlyGoals } from '@/components/inner-tools/MonthlyGoalsContext';
import { AnimatedGoalCheck, AnimatedStrikeText, fireGoalToggleHaptic } from '@/components/inner-tools/MonthlyGoalRow';
import { NotoEmoji } from '@/components/shared/NotoEmoji';
import { normalizeHabitIcon } from '@/components/shared/notoEmoji/legacyMap';
import { useBigEvents } from './BigEventsContext';
import { getBigEventCountdown, getBigEventsForDate, todayKey as bigEventsToday } from './bigEventsLogic';
import AnimatedSlider from './AnimatedSlider';
import CustomizeJournalSheet from './CustomizeJournalSheet';
import { useJournal } from './JournalContext';
import type { JournalPromptAnswer } from './journalDb';
import { HapticTouchableOpacity as TouchableOpacity, HapticPressable as Pressable } from '@/components/shared/HapticTouch';
import { useTasks } from '@/components/tasks/TaskProvider';
import { buildInstanceId } from '@/components/tasks/taskScheduler';

import {
  DEFAULT_SECTIONS,
  SECTION_META,
  type JournalSection,
  type SectionType,
} from './journalSections';

const BG = '#FAF7F0';
const GOLD = '#C5A059';
const CARD_BG = '#FFFFFF';
const CARD_BORDER = '#EDE9E0';
const GRATITUDE_TASK_ID = 'gratitude_daily_task';

const WEEKDAYS_FULL = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const MONTH_NAMES_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const MOODS: { name: MoodName; label: string }[] = [
  { name: 'crying-face',   label: 'Sad' },
  { name: 'pensive-face',  label: 'Low' },
  { name: 'neutral-face',  label: 'Neutral' },
  { name: 'relieved-face', label: 'Good' },
  { name: 'smiling-eyes',  label: 'Great' },
];

const ENERGIES: { name: EnergyName; label: string }[] = [
  { name: 'sleeping-face', label: 'Drained' },
  { name: 'tired-face',    label: 'Low' },
  { name: 'neutral-face',  label: 'Normal' },
  { name: 'flexed-biceps', label: 'High' },
  { name: 'high-voltage',  label: 'Peak' },
];

type PromptItem = { id: string; q: string; a: string };

const DEFAULT_PROMPTS: PromptItem[] = [
  { id: 'gp_1', q: 'What was your biggest achievement today?', a: '' },
  { id: 'gp_2', q: 'What did you learn today?', a: '' },
  { id: 'gp_4', q: 'How did you grow closer to God today?', a: '' },
  { id: 'gp_5', q: 'What challenge did you face and how did you handle it?', a: '' },
  { id: 'gp_6', q: 'Knowing what you know now, what should you do differently tomorrow?', a: '' },
];

function uid() {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateFromKey(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 12);
}

function promptsFromEntry(prompts: JournalPromptAnswer[]): PromptItem[] {
  if (!prompts.length) return DEFAULT_PROMPTS.map(p => ({ ...p }));
  const byId = new Map(prompts.map(prompt => [prompt.id, prompt]));
  const mergedDefaults = DEFAULT_PROMPTS.map(prompt => {
    const saved = byId.get(prompt.id);
    return {
      id: prompt.id,
      q: saved?.question || prompt.q,
      a: saved?.answer || '',
    };
  });
  const customPrompts = prompts
    .filter(prompt => !DEFAULT_PROMPTS.some(item => item.id === prompt.id))
    .map(prompt => ({ id: prompt.id, q: prompt.question, a: prompt.answer }));
  return [...mergedDefaults, ...customPrompts];
}

function promptsToEntry(prompts: PromptItem[]): JournalPromptAnswer[] {
  return prompts.map(prompt => ({
    id: prompt.id,
    question: prompt.q,
    answer: prompt.a,
  }));
}

// ────────────────────────────────────────────────────────────────────────────
// Layout primitives
// ────────────────────────────────────────────────────────────────────────────

function DateBanner({ date }: { date: Date }) {
  const weekday = WEEKDAYS_FULL[date.getDay()];
  const monthDay = `${MONTH_NAMES_LONG[date.getMonth()]} ${date.getDate()}`;
  return (
    <View style={db.wrap}>
      <Text style={db.weekday}>{weekday}</Text>
      <Text style={db.date}>{monthDay}</Text>
      <View style={db.line} />
    </View>
  );
}

const db = StyleSheet.create({
  wrap:    { alignItems: 'center', paddingTop: 6, paddingBottom: 14, paddingHorizontal: 32 },
  weekday: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.4, color: C.textMuted },
  date:    { marginTop: 6, fontFamily: F.serifMedium, fontSize: 22, lineHeight: 26, color: C.text },
  line:    { marginTop: 14, width: 60, height: 1, backgroundColor: 'rgba(197,160,89,0.25)' },
});

function SectionCard({
  label,
  children,
  style,
}: {
  label?: string;
  children: React.ReactNode;
  style?: any;
}) {
  return (
    <View style={[card.wrap, style]}>
      {!!label && <Text style={card.label}>{label}</Text>}
      {children}
    </View>
  );
}

const card = StyleSheet.create({
  wrap:  { marginHorizontal: 16, marginBottom: 12, backgroundColor: CARD_BG, borderRadius: 20, borderWidth: 1, borderColor: CARD_BORDER, padding: 16 },
  label: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 2, color: C.textMuted, marginBottom: 14, textTransform: 'uppercase' },
});

// ────────────────────────────────────────────────────────────────────────────
// Mood / Energy
// ────────────────────────────────────────────────────────────────────────────

function EmojiPicker<K extends 'mood' | 'energy'>({
  kind, items, selected, onSelect,
}: {
  kind: K;
  items: { name: K extends 'mood' ? MoodName : EnergyName; label: string }[];
  selected: number;
  onSelect: (i: number) => void;
}) {
  return (
    <View style={ep.row}>
      {items.map((item, i) => {
        const isSelected = selected === i;
        return (
          <Pressable
            key={i}
            style={({ pressed }) => [
              ep.item,
              pressed && { opacity: 0.75, transform: [{ scale: 0.96 }] },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelect(i);
            }}
          >
            <View style={ep.emojiFrame}>
              {isSelected && (
                <Animated.View
                  entering={FadeIn.duration(200)}
                  exiting={FadeOut.duration(150)}
                  style={ep.glowRing}
                  pointerEvents="none"
                />
              )}
              <NotoLottie kind={kind as any} name={item.name as any} size={44} selected={isSelected} />
            </View>
            <Text style={[ep.label, isSelected && ep.labelActive]} numberOfLines={1}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const ep = StyleSheet.create({
  row:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  item:       { flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingVertical: 4, paddingHorizontal: 2 },
  emojiFrame: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  glowRing: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(197,160,89,0.10)',
    borderWidth: 1.5,
    borderColor: 'rgba(197,160,89,0.42)',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
  },
  label:       { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.4, color: C.textMuted, marginTop: 8, textTransform: 'uppercase', textAlign: 'center' },
  labelActive: { color: GOLD },
});

// ────────────────────────────────────────────────────────────────────────────
// Satisfaction
// ────────────────────────────────────────────────────────────────────────────

// Each scale value (1-10) maps to a single band with a unique (label, color)
// pair. Single source of truth — never let label and color drift apart again.
type ScaleBand = { label: string; color: string };
const SCALE_BANDS: ScaleBand[] = [
  { label: '',                color: GOLD }, // index 0 placeholder (values are 1-10)
  { label: 'Very Low',        color: '#DC2626' }, // 1
  { label: 'Very Low',        color: '#DC2626' }, // 2
  { label: 'Low',             color: '#D97706' }, // 3
  { label: 'Low',             color: '#D97706' }, // 4
  { label: 'Okay',            color: '#C5A059' }, // 5
  { label: 'Okay',            color: '#C5A059' }, // 6
  { label: 'Satisfied',       color: '#A8853C' }, // 7
  { label: 'Satisfied',       color: '#A8853C' }, // 8
  { label: 'Very Satisfied',  color: '#16A34A' }, // 9
  { label: 'Excellent',       color: '#0F8C4E' }, // 10
];

function bandFor(v: number): ScaleBand {
  const i = Math.max(1, Math.min(10, Math.round(v)));
  return SCALE_BANDS[i];
}

function clampScaleValue(value: unknown, fallback = 5) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.min(10, Math.round(numeric)));
}

function sanitizeScaleValues(values: Record<string, number> | undefined) {
  const next: Record<string, number> = {};
  for (const [key, value] of Object.entries(values ?? {})) {
    next[key] = clampScaleValue(value);
  }
  return next;
}

function SatisfactionSection({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const safeValue = clampScaleValue(value, 7);
  const { label, color } = bandFor(safeValue);
  return (
    <SectionCard>
      <View style={sat.head}>
        <Text style={sat.title}>How satisfied are you with yourself today?</Text>
        <View style={sat.rightCol}>
          <Text style={[sat.value, { color }]}>{safeValue}</Text>
          <Text style={[sat.sub, { color }]} numberOfLines={1}>{label}</Text>
        </View>
      </View>
      <AnimatedSlider value={safeValue} onChange={onChange} color={color} edgeLabels={{ left: '1', right: '10' }} />
    </SectionCard>
  );
}

const sat = StyleSheet.create({
  head:     { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, columnGap: 12 },
  title:    { flex: 1, fontFamily: F.serifMedium, fontSize: 16, lineHeight: 21, color: C.text, paddingTop: 4 },
  rightCol: { alignItems: 'flex-end', minWidth: 72 },
  value:    { fontFamily: F.serifSemiBold, fontSize: 32, lineHeight: 34, letterSpacing: -0.5 },
  sub:      { fontFamily: F.serifMediumItalic, fontSize: 13, lineHeight: 16, marginTop: 2 },
});

// ────────────────────────────────────────────────────────────────────────────
// Custom scale (1-10, user-named)
// ────────────────────────────────────────────────────────────────────────────

function CustomScaleSection({
  section, value, onChange,
}: {
  section: JournalSection;
  value: number;
  onChange: (v: number) => void;
}) {
  const safeValue = clampScaleValue(value);
  const { color } = bandFor(safeValue);
  const label = section.customLabel || 'Custom Scale';
  return (
    <SectionCard>
      <View style={sat.head}>
        <Text style={sat.title} numberOfLines={2}>{label}</Text>
        <View style={sat.rightCol}>
          <Text style={[sat.value, { color }]}>{safeValue}</Text>
        </View>
      </View>
      <AnimatedSlider value={safeValue} onChange={onChange} color={color} edgeLabels={{ left: '1', right: '10' }} />
    </SectionCard>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Guided Prompts (CRUD)
// ────────────────────────────────────────────────────────────────────────────

function PromptBlock({
  prompt, canMoveUp, canMoveDown,
  onAnswerChange, onMoveUp, onMoveDown, onDelete, readOnly = false,
}: {
  prompt: PromptItem;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onAnswerChange: (v: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  readOnly?: boolean;
}) {
  const editorRef = useRef<RichTextEditorRef>(null);
  const [fmt, setFmt] = useState<FormatState>({ bold: false, italic: false, underline: false });

  return (
    <Animated.View
      style={gp.block}
      layout={LinearTransition.springify().damping(18).stiffness(200)}
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(140)}
    >
      <View style={gp.qRow}>
        <Text style={gp.question}>{prompt.q}</Text>
        {!readOnly && (
        <View style={gp.qActions}>
          <View style={gp.arrows}>
            <Pressable
              onPress={onMoveUp} disabled={!canMoveUp}
              style={({ pressed }) => [gp.arrow, !canMoveUp && gp.arrowDisabled, pressed && canMoveUp && { opacity: 0.55 }]}
              hitSlop={{ top: 6, bottom: 0, left: 6, right: 6 }}
            >
              <ChevronUp s={14} c={canMoveUp ? C.textSecondary : '#D6D3CC'} w={2.2} />
            </Pressable>
            <Pressable
              onPress={onMoveDown} disabled={!canMoveDown}
              style={({ pressed }) => [gp.arrow, !canMoveDown && gp.arrowDisabled, pressed && canMoveDown && { opacity: 0.55 }]}
              hitSlop={{ top: 0, bottom: 6, left: 6, right: 6 }}
            >
              <ChevronDown s={14} c={canMoveDown ? C.textSecondary : '#D6D3CC'} w={2.2} />
            </Pressable>
          </View>
          <TouchableOpacity onPress={onDelete} style={gp.del} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
            <Trash2 s={16} c={C.textMuted} w={1.8} />
          </TouchableOpacity>
        </View>
        )}
      </View>
      {!readOnly && <RichToolbar editorRef={editorRef} activeFormats={fmt} style={gp.toolbar} />}
      <RichTextEditor
        ref={editorRef}
        initialHTML={prompt.a}
        onChange={value => {
          if (!readOnly) onAnswerChange(value);
        }}
        onFormatChange={setFmt}
        placeholder="Write your thoughts..."
        backgroundColor="#fff"
        color={C.text}
        editable={!readOnly}
        style={gp.editor}
      />
    </Animated.View>
  );
}

function GuidedPromptsSection({
  prompts, onPromptsChange, readOnly = false,
}: {
  prompts: PromptItem[];
  onPromptsChange: (next: PromptItem[]) => void;
  readOnly?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const confirmingPrompt = confirmId ? prompts.find(p => p.id === confirmId) : null;

  const updateAnswer = (id: string, a: string) => {
    if (readOnly) return;
    onPromptsChange(prompts.map(p => p.id === id ? { ...p, a } : p));
  };

  const move = (idx: number, dir: -1 | 1) => {
    if (readOnly) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= prompts.length) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = [...prompts];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    onPromptsChange(next);
  };

  const askDelete = (id: string) => {
    if (readOnly) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setConfirmId(id);
  };

  const confirmDelete = () => {
    if (readOnly) return;
    if (!confirmId) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onPromptsChange(prompts.filter(p => p.id !== confirmId));
    setConfirmId(null);
  };

  const submit = () => {
    if (readOnly) return;
    const q = draft.trim();
    if (!q) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onPromptsChange([...prompts, { id: uid(), q, a: '' }]);
    setDraft('');
    setAdding(false);
  };

  return (
    <View style={gp.wrap}>
      <Text style={gp.sectionLabel}>DAILY REFLECTIONS</Text>
      {prompts.map((p, i) => (
        <PromptBlock
          key={p.id}
          prompt={p}
          canMoveUp={i > 0}
          canMoveDown={i < prompts.length - 1}
          onAnswerChange={v => updateAnswer(p.id, v)}
          onMoveUp={() => move(i, -1)}
          onMoveDown={() => move(i, 1)}
          onDelete={() => askDelete(p.id)}
          readOnly={readOnly}
        />
      ))}

      {!readOnly && (
      <ConfirmModal
        visible={!!confirmId}
        icon={<Trash2 s={22} c="#EF4444" w={2} />}
        iconBg="#FEE2E2"
        title="Delete question?"
        body="Your answer for this question will be removed too."
        subject={confirmingPrompt?.q}
        confirmLabel="DELETE"
        confirmColor="#EF4444"
        onCancel={() => setConfirmId(null)}
        onConfirm={confirmDelete}
      />
      )}

      {!readOnly && (adding ? (
        <Animated.View style={gp.addBox} entering={FadeIn.duration(180)}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Type your custom question..."
            placeholderTextColor={C.textMuted}
            style={gp.input}
            autoFocus
            multiline
            returnKeyType="done"
            blurOnSubmit
            onSubmitEditing={submit}
          />
          <View style={gp.addBtns}>
            <TouchableOpacity onPress={() => { setAdding(false); setDraft(''); }} style={gp.cancelBtn}>
              <X s={18} c={C.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity onPress={submit} style={[gp.confirmBtn, !draft.trim() && gp.confirmBtnDisabled]} disabled={!draft.trim()}>
              <CheckSmall s={16} c="#fff" w={3} />
              <Text style={gp.confirmText}>ADD</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      ) : (
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setAdding(true); }}
          style={gp.addBtn}
          activeOpacity={0.78}
        >
          <Plus s={16} c={C.gold} w={2.4} />
          <Text style={gp.addBtnText}>ADD CUSTOM QUESTION</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const gp = StyleSheet.create({
  wrap:         { paddingHorizontal: 16, marginTop: 4, marginBottom: 12 },
  sectionLabel: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 2, color: C.textMuted, marginBottom: 12, marginLeft: 4, textTransform: 'uppercase' },
  block:        { backgroundColor: CARD_BG, borderRadius: 18, borderWidth: 1, borderColor: CARD_BORDER, padding: 14, marginBottom: 10 },
  qRow:         { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, columnGap: 8 },
  question:     { flex: 1, fontFamily: F.serifMedium, fontSize: 15, lineHeight: 20, color: C.text },
  qActions:     { flexDirection: 'row', alignItems: 'center', columnGap: 4 },
  arrows:       { width: 18, alignSelf: 'stretch', justifyContent: 'space-between', paddingVertical: 1 },
  arrow:        { padding: 1, alignItems: 'center', justifyContent: 'center' },
  arrowDisabled:{ opacity: 0.35 },
  del:          { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  toolbar:      { marginBottom: 8 },
  editor:       { minHeight: 110 },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', columnGap: 8,
    borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(197,160,89,0.45)', borderStyle: 'dashed',
    paddingVertical: 12, marginTop: 0, marginBottom: 4,
  },
  addBtnText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 1.6, color: C.gold },

  addBox: { backgroundColor: CARD_BG, borderRadius: 16, borderWidth: 1, borderColor: CARD_BORDER, padding: 14 },
  input:  { fontFamily: F.serifMedium, fontSize: 16, lineHeight: 22, color: C.text, minHeight: 60 },
  addBtns:{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', columnGap: 8, marginTop: 8 },
  cancelBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  confirmBtn:{ flexDirection: 'row', alignItems: 'center', columnGap: 6, backgroundColor: GOLD, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 12 },
  confirmBtnDisabled: { backgroundColor: '#D6D3CC' },
  confirmText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 1.4, color: '#fff' },
});

// ────────────────────────────────────────────────────────────────────────────
// Gratitude (linked to InnerToolsContext)
// ────────────────────────────────────────────────────────────────────────────

function GratitudeSection({ date, readOnly = false }: { date: string; readOnly?: boolean }) {
  const { gratitudeEntries, upsertGratitudeEntry, deleteGratitudeEntry } = useInnerTools();
  const { completeInstance, resetInstance } = useTasks();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const todays = gratitudeEntries.filter(e => e.kind === 'daily' && e.date === date);
  const confirmingItem = confirmId ? todays.find(e => e.id === confirmId) : null;
  const syncTaskCompletion = (nextEntries: typeof gratitudeEntries) => {
    const count = nextEntries.filter(entry => entry.kind === 'daily' && entry.date === date).length;
    const instanceId = buildInstanceId(GRATITUDE_TASK_ID, date);
    void (count >= 3
      ? completeInstance(instanceId, date)
      : resetInstance(instanceId, date)
    ).catch(() => {});
  };

  const submit = () => {
    if (readOnly) return;
    const text = draft.trim();
    if (!text) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const nextEntry = {
      id: uid(),
      kind: 'daily',
      title: '',
      content: text,
      date,
      createdAt: Date.now(),
    } as const;
    upsertGratitudeEntry(nextEntry);
    syncTaskCompletion([nextEntry, ...gratitudeEntries]);
    setDraft('');
    setAdding(false);
  };

  const askDelete = (id: string) => {
    if (readOnly) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setConfirmId(id);
  };

  const confirmDelete = () => {
    if (readOnly) return;
    if (!confirmId) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    syncTaskCompletion(gratitudeEntries.filter(entry => entry.id !== confirmId));
    deleteGratitudeEntry(confirmId);
    setConfirmId(null);
  };

  return (
    <SectionCard label="GRATITUDE">
      {todays.length === 0 && !adding && (
        <Text style={grat.empty}>Nothing yet — what are you thankful for today?</Text>
      )}

      {todays.map(item => (
        <Animated.View key={item.id} style={grat.item} entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} layout={LinearTransition.springify().damping(20)}>
          <Text style={grat.heart}>♥</Text>
          <Text style={grat.txt} numberOfLines={3}>{item.content}</Text>
          {!readOnly && (
          <TouchableOpacity onPress={() => askDelete(item.id)} style={grat.del} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
            <Trash2 s={15} c={C.textMuted} w={1.8} />
          </TouchableOpacity>
          )}
        </Animated.View>
      ))}

      {!readOnly && (
      <ConfirmModal
        visible={!!confirmId}
        icon={<Trash2 s={22} c="#EF4444" w={2} />}
        iconBg="#FEE2E2"
        title="Remove gratitude?"
        body="This entry will also disappear from the Gratitude page."
        subject={confirmingItem?.content}
        confirmLabel="REMOVE"
        confirmColor="#EF4444"
        onCancel={() => setConfirmId(null)}
        onConfirm={confirmDelete}
      />
      )}

      {!readOnly && (adding ? (
        <Animated.View style={grat.addBox} entering={FadeIn.duration(180)}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Today I'm thankful for..."
            placeholderTextColor={C.textMuted}
            style={grat.input}
            autoFocus
            multiline
            returnKeyType="done"
            blurOnSubmit
            onSubmitEditing={submit}
          />
          <View style={grat.addBtns}>
            <TouchableOpacity onPress={() => { setAdding(false); setDraft(''); }} style={grat.cancelBtn}>
              <X s={18} c={C.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity onPress={submit} style={[grat.confirmBtn, !draft.trim() && grat.confirmBtnDisabled]} disabled={!draft.trim()}>
              <CheckSmall s={16} c="#fff" w={3} />
              <Text style={grat.confirmText}>ADD</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      ) : (
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setAdding(true); }}
          style={grat.addBtn}
          activeOpacity={0.78}
        >
          <Plus s={16} c={C.gold} w={2.4} />
          <Text style={grat.addBtnText}>ADD GRATITUDE</Text>
        </TouchableOpacity>
      ))}
    </SectionCard>
  );
}

const grat = StyleSheet.create({
  empty: { fontFamily: F.serifMediumItalic, fontSize: 14, color: C.textMuted, textAlign: 'center', marginBottom: 12 },
  item:  { flexDirection: 'row', alignItems: 'center', columnGap: 10, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#F0E2B8', borderRadius: 14, padding: 13, marginBottom: 8 },
  heart: { fontSize: 18, color: GOLD, lineHeight: 22 },
  txt:   { fontFamily: F.serifMedium, fontSize: 16, lineHeight: 21, color: C.text, flex: 1 },
  del:   { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', columnGap: 8,
    borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(197,160,89,0.45)', borderStyle: 'dashed',
    paddingVertical: 12, marginTop: 4,
  },
  addBtnText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 1.6, color: C.gold },

  addBox: { backgroundColor: '#FFFBEB', borderRadius: 14, borderWidth: 1, borderColor: '#F0E2B8', padding: 14, marginTop: 4 },
  input:  { fontFamily: F.serifMedium, fontSize: 16, lineHeight: 22, color: C.text, minHeight: 50 },
  addBtns:{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', columnGap: 8, marginTop: 8 },
  cancelBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  confirmBtn:{ flexDirection: 'row', alignItems: 'center', columnGap: 6, backgroundColor: GOLD, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 12 },
  confirmBtnDisabled: { backgroundColor: '#D6D3CC' },
  confirmText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 1.4, color: '#fff' },
});

// ────────────────────────────────────────────────────────────────────────────
// Who I Want to Be (from idealSelf.qualities)
// ────────────────────────────────────────────────────────────────────────────

function IdealQualityRow({
  quality, isChecked, onToggle,
}: {
  quality: string;
  isChecked: boolean;
  onToggle: () => void;
}) {
  const scale = useSharedValue(1);

  const onPress = () => {
    scale.value = withSequence(
      withTiming(0.82, { duration: 90, easing: Easing.out(Easing.cubic) }),
      withSpring(1, { damping: 9, stiffness: 220, mass: 0.5 }),
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle();
  };

  const boxStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      style={({ pressed }) => [who.row, pressed && { opacity: 0.85 }]}
      onPress={onPress}
    >
      <Animated.View style={[who.box, isChecked && who.boxChecked, boxStyle]}>
        {isChecked && (
          <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(110)}>
            <CheckSmall s={13} c="#fff" w={3} />
          </Animated.View>
        )}
      </Animated.View>
      <Text style={[who.label, isChecked && who.labelChecked]} numberOfLines={2}>{quality}</Text>
    </Pressable>
  );
}

function AnimatedProgressBar({ pct, color }: { pct: number; color: string }) {
  const width = useSharedValue(pct);

  React.useEffect(() => {
    width.value = withTiming(pct, { duration: 480, easing: Easing.out(Easing.cubic) });
  }, [pct, width]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
  }));

  return (
    <View style={who.progressTrack}>
      <Animated.View style={[who.progressFill, { backgroundColor: color }, fillStyle]} />
    </View>
  );
}

function WhoIWantToBeSection({
  checks, onToggle,
}: {
  checks: Record<string, boolean>;
  onToggle: (q: string) => void;
}) {
  const router = useRouter();
  const { idealSelf } = useInnerTools();
  const qualities = idealSelf?.qualities || [];
  const total = qualities.length;
  const done = qualities.filter(q => checks[q]).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  if (total === 0) {
    return (
      <SectionCard label="WHO I WANT TO BE">
        <Text style={who.empty}>Set up your Ideal Self qualities to see them here.</Text>
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/ideal-self' as any); }}
          style={who.setupBtn}
          activeOpacity={0.85}
        >
          <Text style={who.setupText}>SET UP IDEAL SELF</Text>
        </TouchableOpacity>
      </SectionCard>
    );
  }

  return (
    <SectionCard label="WHO I WANT TO BE">
      {qualities.map(q => (
        <IdealQualityRow
          key={q}
          quality={q}
          isChecked={!!checks[q]}
          onToggle={() => onToggle(q)}
        />
      ))}

      <View style={who.progressRow}>
        <Text style={who.progressLabel}>PROGRESS</Text>
        <Text style={[who.progressValue, { color: pct === 100 ? '#16A34A' : GOLD }]}>{pct}%</Text>
      </View>
      <AnimatedProgressBar pct={pct} color={pct === 100 ? '#16A34A' : GOLD} />
    </SectionCard>
  );
}

const who = StyleSheet.create({
  empty:     { fontFamily: F.serifMediumItalic, fontSize: 14, color: C.textMuted, textAlign: 'center', marginBottom: 12 },
  setupBtn:  { backgroundColor: GOLD, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 11 },
  setupText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 1.6, color: '#fff' },

  row:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, columnGap: 12 },
  box:       { width: 22, height: 22, borderRadius: 11, borderWidth: 1.6, borderColor: '#D4CDBE', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  boxChecked:{ borderColor: GOLD, backgroundColor: GOLD },
  label:     { flex: 1, fontFamily: F.serifMedium, fontSize: 16, lineHeight: 21, color: C.text },
  labelChecked: { color: C.textSecondary },

  progressRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F2EDE4' },
  progressLabel: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.8, color: C.textMuted },
  progressValue: { fontFamily: F.serifSemiBold, fontSize: 16, color: GOLD },
  progressTrack: { height: 6, marginTop: 8, backgroundColor: '#F0EDE6', borderRadius: 3, overflow: 'hidden' },
  progressFill:  { height: '100%', backgroundColor: GOLD, borderRadius: 3 },
});

// ────────────────────────────────────────────────────────────────────────────
// Monthly Goals (placeholder — backend later)
// ────────────────────────────────────────────────────────────────────────────

function MonthlyGoalsSection() {
  const router = useRouter();
  const monthName = MONTH_NAMES_LONG[new Date().getMonth()];
  const monthKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);
  const { goalsByMonth, toggleGoal } = useMonthlyGoals();
  const monthGoals = useMemo(() => {
    return [...(goalsByMonth[monthKey] ?? [])].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt,
    );
  }, [goalsByMonth, monthKey]);

  const onToggle = (id: string, willComplete: boolean) => {
    fireGoalToggleHaptic(willComplete);
    toggleGoal(id);
  };

  const openManage = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push('/monthly-goals');
  };

  if (monthGoals.length === 0) {
    return (
      <SectionCard label={`${monthName.toUpperCase()} GOALS`}>
        <Text style={goals.empty}>No goals set for this month yet.</Text>
        <TouchableOpacity onPress={openManage} activeOpacity={0.84} style={goals.setupBtn}>
          <Plus s={13} c="#A8853C" w={2.5} />
          <Text style={goals.setupText}>SET MONTHLY GOALS</Text>
        </TouchableOpacity>
      </SectionCard>
    );
  }

  return (
    <SectionCard label={`${monthName.toUpperCase()} GOALS`}>
      <View style={{ rowGap: 6 }}>
        {monthGoals.map(goal => (
          <View key={goal.id} style={[goals.row, goal.isCompleted && goals.rowDone]}>
            <AnimatedGoalCheck
              done={goal.isCompleted}
              onPress={() => onToggle(goal.id, !goal.isCompleted)}
              size={20}
            />
            <AnimatedStrikeText
              text={goal.text}
              done={goal.isCompleted}
              textStyle={goals.rowText}
              numberOfLines={2}
            />
          </View>
        ))}
      </View>
      <TouchableOpacity onPress={openManage} activeOpacity={0.84} style={goals.manageBtn}>
        <Text style={goals.manageText}>MANAGE GOALS  ›</Text>
      </TouchableOpacity>
    </SectionCard>
  );
}

const goals = StyleSheet.create({
  empty: { fontFamily: F.serifMediumItalic, fontSize: 14, color: C.textMuted, textAlign: 'center', marginBottom: 10 },
  setupBtn: {
    flexDirection: 'row', alignSelf: 'center', alignItems: 'center', columnGap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
    backgroundColor: 'rgba(197,160,89,0.12)',
    borderWidth: 1, borderColor: 'rgba(197,160,89,0.28)',
  },
  setupText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.4, color: '#A8853C' },
  row: {
    flexDirection: 'row', alignItems: 'center', columnGap: 10,
    paddingVertical: 4,
  },
  rowDone: { opacity: 0.7 },
  rowText: {
    fontFamily: F.serifMedium, fontSize: 14, lineHeight: 19, color: '#1A1714',
  },
  manageBtn: { alignSelf: 'center', marginTop: 10, paddingVertical: 4 },
  manageText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.4, color: '#A8853C' },
});

// ────────────────────────────────────────────────────────────────────────────
// Upcoming Events (placeholder — backend later)
// ────────────────────────────────────────────────────────────────────────────

function UpcomingEventsSection() {
  const router = useRouter();
  const { bigEvents } = useBigEvents();
  const today = bigEventsToday();
  const events = getBigEventsForDate(bigEvents, today, 3);

  const goManage = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/big-events' as any);
  };

  if (events.length === 0) {
    return (
      <SectionCard label="UPCOMING EVENTS">
        <Text style={goals.empty}>No active events for today.</Text>
        <TouchableOpacity onPress={goManage} activeOpacity={0.78} style={ue.addBtn}>
          <Plus s={16} c={C.gold} w={2.4} />
          <Text style={ue.addBtnText}>ADD BIG EVENT</Text>
        </TouchableOpacity>
      </SectionCard>
    );
  }

  return (
    <SectionCard label="UPCOMING EVENTS">
      {events.map(event => {
        const days = getBigEventCountdown(event, today);
        const isToday = days === 0;
        return (
          <Pressable
            key={event.id}
            onPress={goManage}
            style={({ pressed }) => [ue.row, pressed && { opacity: 0.78 }]}
          >
            <View style={[ue.iconBox, { backgroundColor: `${event.color}22` }]}>
              <NotoEmoji name={normalizeHabitIcon(event.icon)} size={22} />
            </View>
            <View style={ue.copy}>
              <Text style={ue.title} numberOfLines={1}>{event.title}</Text>
            </View>
            {isToday ? (
              <View style={[ue.todayPill, { backgroundColor: event.color }]}>
                <View style={ue.todayDot} />
                <Text style={ue.todayPillText}>TODAY</Text>
              </View>
            ) : (
              <View style={ue.count}>
                <Text style={[ue.countNum, { color: event.color }]}>{days}</Text>
                <Text style={ue.countLabel}>{days === 1 ? 'day' : 'days'}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </SectionCard>
  );
}

const ue = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', columnGap: 12, paddingVertical: 8 },
  iconBox:   { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  copy:      { flex: 1, minWidth: 0 },
  title:     { fontFamily: F.serifMedium, fontSize: 15, color: C.text },
  count:     { alignItems: 'flex-end', minWidth: 44 },
  countNum:  { fontFamily: F.serifSemiBold, fontSize: 19, lineHeight: 22 },
  countLabel:{ marginTop: 1, fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.2, color: '#A8A29E', textTransform: 'uppercase' },
  todayPill: {
    flexDirection: 'row', alignItems: 'center', columnGap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 11,
  },
  todayDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.95)' },
  todayPillText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.4, color: '#FFFFFF' },
  addBtn:    {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', columnGap: 8,
    borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(197,160,89,0.45)', borderStyle: 'dashed',
    paddingVertical: 12, marginTop: 4,
  },
  addBtnText:{ fontFamily: F.sansBold, fontSize: 11, letterSpacing: 1.6, color: GOLD },
});

// ────────────────────────────────────────────────────────────────────────────
// Free Writing (inline rich text editor)
// ────────────────────────────────────────────────────────────────────────────

function FreeWritingSection({ value, onChange, readOnly = false }: { value: string; onChange: (v: string) => void; readOnly?: boolean }) {
  const editorRef = useRef<RichTextEditorRef>(null);
  const [fmt, setFmt] = useState<FormatState>({ bold: false, italic: false, underline: false });
  return (
    <SectionCard label="FREE WRITING">
      {!readOnly && <RichToolbar editorRef={editorRef} activeFormats={fmt} style={{ marginBottom: 8 }} />}
      <RichTextEditor
        ref={editorRef}
        initialHTML={value}
        onChange={next => {
          if (!readOnly) onChange(next);
        }}
        onFormatChange={setFmt}
        placeholder="Write whatever flows..."
        backgroundColor="#fff"
        color={C.text}
        editable={!readOnly}
        style={{ minHeight: 140 }}
      />
    </SectionCard>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main: DailyEntryView
// ────────────────────────────────────────────────────────────────────────────

export default function DailyEntryView() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string; readOnly?: string }>();
  const selectedDateKey = typeof params.date === 'string' && params.date ? params.date : todayKey();
  const isReadOnly = params.readOnly === '1' || params.readOnly === 'true';
  const selectedDate = useMemo(() => dateFromKey(selectedDateKey), [selectedDateKey]);
  const {
    ready: journalReady,
    getEntry,
    sections: storedSections,
    upsertEntry,
    setJournalSections,
  } = useJournal();
  const hydratedDateRef = useRef('');
  const dirtyRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [sections, setSections] = useState<JournalSection[]>(DEFAULT_SECTIONS);
  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(2);
  const [satisfaction, setSatisfaction] = useState(7);
  const [prompts, setPrompts] = useState<PromptItem[]>(DEFAULT_PROMPTS.map(p => ({ ...p })));
  const [whoChecks, setWhoChecks] = useState<Record<string, boolean>>({});
  const [scaleValues, setScaleValues] = useState<Record<string, number>>({});
  const [freeWriting, setFreeWriting] = useState('');
  const [customizeOpen, setCustomizeOpen] = useState(false);

  const markDirty = () => {
    if (isReadOnly) return;
    dirtyRef.current = true;
  };

  useEffect(() => {
    if (!journalReady || hydratedDateRef.current === selectedDateKey) return;

    const entry = getEntry(selectedDateKey);
    setSections(storedSections.length ? storedSections : DEFAULT_SECTIONS);
    setMood(entry.mood ?? 3);
    setEnergy(entry.energy ?? 2);
    setSatisfaction(clampScaleValue(entry.satisfaction ?? 7, 7));
    setPrompts(promptsFromEntry(entry.prompts));
    setWhoChecks(entry.whoChecks ?? {});
    setScaleValues(sanitizeScaleValues(entry.scaleValues));
    setFreeWriting(entry.freeWritingHtml ?? '');
    hydratedDateRef.current = selectedDateKey;
    dirtyRef.current = false;
  }, [journalReady, selectedDateKey, getEntry, storedSections]);

  useEffect(() => {
    if (isReadOnly) return;
    if (!dirtyRef.current || hydratedDateRef.current !== selectedDateKey) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      void upsertEntry(selectedDateKey, {
        mood,
        energy,
        satisfaction,
        prompts: promptsToEntry(prompts),
        whoChecks,
        scaleValues,
        freeWritingHtml: freeWriting,
      });
      dirtyRef.current = false;
    }, 350);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [
    selectedDateKey,
    mood,
    energy,
    satisfaction,
    prompts,
    whoChecks,
    scaleValues,
    freeWriting,
    isReadOnly,
    upsertEntry,
  ]);

  const saveNow = async () => {
    if (isReadOnly) return;
    if (!dirtyRef.current || hydratedDateRef.current !== selectedDateKey) return;
    await upsertEntry(selectedDateKey, {
      mood,
      energy,
      satisfaction,
      prompts: promptsToEntry(prompts),
      whoChecks,
      scaleValues,
      freeWritingHtml: freeWriting,
    });
    dirtyRef.current = false;
  };

  const toggleWho = (q: string) => {
    if (isReadOnly) return;
    markDirty();
    setWhoChecks(prev => ({ ...prev, [q]: !prev[q] }));
  };

  const setScaleValue = (id: string, v: number) => {
    if (isReadOnly) return;
    const nextValue = clampScaleValue(v);
    markDirty();
    setScaleValues(prev => ({ ...prev, [id]: nextValue }));
  };

  const applySections = (next: JournalSection[]) => {
    setSections(next);
    void setJournalSections(next);
  };

  const addCustomScale = (label: string) => {
    const id = uid();
    applySections([...sections, { id, type: 'customScale', active: true, customLabel: label }]);
    markDirty();
    setScaleValues(prev => ({ ...prev, [id]: 5 }));
  };

  const deleteCustomScale = (id: string) => {
    applySections(sections.filter(s => s.id !== id));
    markDirty();
    setScaleValues(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const renderSection = (section: JournalSection) => {
    switch (section.type) {
      case 'mood':
        return (
          <SectionCard key={section.id} label="HOW ARE YOU FEELING?">
            <EmojiPicker kind="mood" items={MOODS} selected={mood} onSelect={(value) => {
              if (isReadOnly) return;
              markDirty();
              setMood(value);
            }} />
          </SectionCard>
        );
      case 'energy':
        return (
          <SectionCard key={section.id} label="ENERGY LEVEL">
            <EmojiPicker kind="energy" items={ENERGIES} selected={energy} onSelect={(value) => {
              if (isReadOnly) return;
              markDirty();
              setEnergy(value);
            }} />
          </SectionCard>
        );
      case 'satisfaction':
        return <SatisfactionSection key={section.id} value={satisfaction} onChange={(value) => {
          if (isReadOnly) return;
          markDirty();
          setSatisfaction(clampScaleValue(value, 7));
        }} />;
      case 'guidedPrompts':
        return <GuidedPromptsSection key={section.id} prompts={prompts} readOnly={isReadOnly} onPromptsChange={(next) => {
          if (isReadOnly) return;
          markDirty();
          setPrompts(next);
        }} />;
      case 'gratitude':
        return <GratitudeSection key={section.id} date={selectedDateKey} readOnly={isReadOnly} />;
      case 'whoIWantToBe':
        return <WhoIWantToBeSection key={section.id} checks={whoChecks} onToggle={toggleWho} />;
      case 'monthlyGoals':
        return <View key={section.id} pointerEvents={isReadOnly ? 'none' : 'auto'}><MonthlyGoalsSection /></View>;
      case 'upcomingEvents':
        return <View key={section.id} pointerEvents={isReadOnly ? 'none' : 'auto'}><UpcomingEventsSection /></View>;
      case 'freeWriting':
        return <FreeWritingSection key={section.id} value={freeWriting} readOnly={isReadOnly} onChange={(value) => {
          if (isReadOnly) return;
          markDirty();
          setFreeWriting(value);
        }} />;
      case 'customScale':
        return (
          <CustomScaleSection
            key={section.id}
            section={section}
            value={scaleValues[section.id] ?? 5}
            onChange={v => {
              if (!isReadOnly) setScaleValue(section.id, v);
            }}
          />
        );
      default:
        return null;
    }
  };

  const activeSections = sections.filter(s => s.active);

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <ScreenTitleBar
        title="DAILY JOURNAL"
        showBack
        bg={BG}
        rightElement={isReadOnly ? undefined : (
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setCustomizeOpen(true); }}
            style={hd.rightBtn}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <SlidersHorizontal s={20} c={C.textMuted} />
          </TouchableOpacity>
        )}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
        keyboardShouldPersistTaps="handled"
      >
        <DateBanner date={selectedDate} />

        <Animated.View layout={LinearTransition.springify().damping(18).stiffness(200)}>
          {activeSections.map(section => (
            <Animated.View
              key={section.id}
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(140)}
              layout={LinearTransition.springify().damping(18).stiffness(200)}
            >
              {renderSection(section)}
            </Animated.View>
          ))}
        </Animated.View>

        <View style={{ height: 8 }} />
      </ScrollView>

      {!isReadOnly && (
      <View style={[fin.wrap, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={fin.btn}
          activeOpacity={0.85}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            void saveNow().finally(() => router.back());
          }}
        >
          <CheckSmall s={20} c="#fff" w={2.8} />
          <Text style={fin.txt}>Finish</Text>
        </TouchableOpacity>
      </View>
      )}

      {!isReadOnly && (
      <CustomizeJournalSheet
        visible={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        sections={sections}
        onSectionsChange={applySections}
        onAddCustomScale={addCustomScale}
        onDeleteCustomScale={deleteCustomScale}
      />
      )}
    </View>
  );
}

// Re-export for type-checker (avoid unused-import lint on SectionType)
export type { JournalSection, SectionType };

const hd = StyleSheet.create({
  rightBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});

const fin = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingTop: 10, backgroundColor: BG, borderTopWidth: 1, borderTopColor: 'rgba(197,160,89,0.1)' },
  btn:  { backgroundColor: GOLD, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', columnGap: 8, paddingVertical: 15, shadowColor: GOLD, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 },
  txt:  { fontFamily: F.sansBold, fontSize: 16, color: '#fff', letterSpacing: 1 },
});

void SECTION_META;
