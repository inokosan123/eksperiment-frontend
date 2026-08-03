import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Sparkles, X } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { useInnerTools } from '@/components/inner-tools/InnerToolsContext';
import { useTasks } from '@/components/tasks/TaskProvider';
import { buildInstanceId } from '@/components/tasks/taskScheduler';
import {
  RoutedTaskCompletionErrorModal,
  useRoutedTaskCompletion,
} from '@/components/tasks/use-routed-task-completion';
import { F } from '@/constants/tokens';
import {
  GUIDED_BG,
  GUIDED_GOLD,
  GuidedBackdrop,
  GuidedChoiceRow,
  GuidedCompletion,
  GuidedGratitudeAnswer,
  GuidedMonthlyGoalsReminder,
  GuidedQualitiesAnswer,
  GuidedQuestionShell,
  GuidedScaleAnswer,
  GuidedTextAnswer,
  GuidedUpcomingEventsReminder,
  GuidedWelcome,
  type GuidedVisualKind,
} from './guided-reflection-visuals';
import {
  clampScaleValue,
  cloneJournalSections,
  promptsFromEntry,
  promptsToEntry,
  sectionsForEntry,
  type PromptItem,
} from './DailyEntryView';
import { useJournal, type JournalEntryPatch } from './JournalContext';
import { hasDailyJournalContent, stripRichTextToPlainText } from './journalLogic';
import { DEFAULT_SECTIONS, type JournalSection } from './journalSections';

const GRATITUDE_TASK_ID = 'gratitude_daily_task';

const MOODS = [
  { name: 'crying-face', label: 'Sad' },
  { name: 'pensive-face', label: 'Low' },
  { name: 'neutral-face', label: 'Neutral' },
  { name: 'relieved-face', label: 'Good' },
  { name: 'smiling-eyes', label: 'Great' },
];

const ENERGIES = [
  { name: 'sleeping-face', label: 'Drained' },
  { name: 'tired-face', label: 'Low' },
  { name: 'neutral-face', label: 'Normal' },
  { name: 'flexed-biceps', label: 'High' },
  { name: 'high-voltage', label: 'Peak' },
];

type GuidedDraft = {
  mood?: number;
  energy?: number;
  satisfaction?: number;
  prompts: PromptItem[];
  whoChecks: Record<string, boolean>;
  scaleValues: Record<string, number>;
  freeWritingHtml: string;
};

type GuidedStep =
  | { id: string; type: 'mood'; eyebrow: string; title: string; hint: string }
  | { id: string; type: 'energy'; eyebrow: string; title: string; hint: string }
  | { id: string; type: 'satisfaction'; eyebrow: string; title: string; hint: string }
  | { id: string; type: 'monthlyGoals'; eyebrow: string; title: string; hint: string }
  | { id: string; type: 'prompt'; promptId: string; eyebrow: string; title: string; hint: string }
  | { id: string; type: 'upcomingEvents'; eyebrow: string; title: string; hint: string }
  | { id: string; type: 'gratitude'; eyebrow: string; title: string; hint: string }
  | { id: string; type: 'qualities'; eyebrow: string; title: string; hint: string }
  | { id: string; type: 'scale'; section: JournalSection; eyebrow: string; title: string; hint: string }
  | { id: string; type: 'freeWriting'; eyebrow: string; title: string; hint: string };

function todayKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateFromKey(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 12);
}

function formatDate(key: string) {
  return dateFromKey(key).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
}

function plainTextToHtml(value: string) {
  const trimmed = value.trim();
  return trimmed ? `<p>${escapeHtml(trimmed)}</p>` : '';
}

function draftFromEntry(entry: ReturnType<ReturnType<typeof useJournal>['getEntry']>): GuidedDraft {
  return {
    mood: entry.mood,
    energy: entry.energy,
    satisfaction: entry.satisfaction,
    prompts: promptsFromEntry(entry.prompts),
    whoChecks: entry.whoChecks ?? {},
    scaleValues: entry.scaleValues ?? {},
    freeWritingHtml: entry.freeWritingHtml ?? '',
  };
}

function stepList(sections: JournalSection[], draft: GuidedDraft, qualities: string[]): GuidedStep[] {
  const steps: GuidedStep[] = [];
  for (const section of sections.filter(item => item.active)) {
    if (section.type === 'mood') steps.push({ id: section.id, type: 'mood', eyebrow: 'CHECK IN', title: 'How are you arriving today?', hint: 'Choose the feeling that is most true right now.' });
    if (section.type === 'monthlyGoals') steps.push({ id: section.id, type: 'monthlyGoals', eyebrow: 'YOUR DIRECTION', title: 'Keep what matters in sight.', hint: 'A quiet reminder of the intentions shaping this month.' });
    if (section.type === 'energy') steps.push({ id: section.id, type: 'energy', eyebrow: 'CHECK IN', title: 'What is your energy like?', hint: 'There is no right answer. Name what is present.' });
    if (section.type === 'satisfaction') steps.push({ id: section.id, type: 'satisfaction', eyebrow: 'LOOKING BACK', title: 'How satisfied are you with today?', hint: 'A gentle measure, not a verdict.' });
    if (section.type === 'guidedPrompts') {
      draft.prompts.forEach(prompt => steps.push({ id: `prompt:${prompt.id}`, type: 'prompt', promptId: prompt.id, eyebrow: 'DAILY REFLECTION', title: prompt.q, hint: 'Take a moment. A few honest words are enough.' }));
    }
    if (section.type === 'upcomingEvents') steps.push({ id: section.id, type: 'upcomingEvents', eyebrow: 'ON THE HORIZON', title: 'Remember what you are moving toward.', hint: 'Hold the next important moment with clarity, not pressure.' });
    if (section.type === 'gratitude') steps.push({ id: section.id, type: 'gratitude', eyebrow: 'NOTICE THE GOOD', title: 'What made today worth receiving?', hint: 'Name three details you do not want the day to take with it.' });
    if (section.type === 'whoIWantToBe' && qualities.length) steps.push({ id: section.id, type: 'qualities', eyebrow: 'BECOMING', title: 'How did you live your values today?', hint: 'Select every quality you practiced, even in a small way.' });
    if (section.type === 'customScale') steps.push({ id: section.id, type: 'scale', section, eyebrow: 'PERSONAL CHECK IN', title: section.customLabel || 'Custom scale', hint: 'Choose the number that best reflects your day.' });
    if (section.type === 'freeWriting') steps.push({ id: section.id, type: 'freeWriting', eyebrow: 'OPEN PAGE', title: 'What else would you like to remember?', hint: 'Leave yourself a note before you close the day.' });
  }
  return steps;
}

export default function DailyGuidedEntryView() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string; title?: string; isTask?: string; taskInstanceId?: string; taskDate?: string }>();
  const selectedDateKey = typeof params.date === 'string' && params.date ? params.date : todayKey();
  const isTaskLaunch = params.isTask === 'true' || !!params.taskInstanceId;
  const { ready, getEntry, sections: storedSections, upsertEntry } = useJournal();
  const { idealSelf, gratitudeEntries, upsertGratitudeEntry } = useInnerTools();
  const { completeInstance, resetInstance } = useTasks();
  const routedCompletion = useRoutedTaskCompletion({
    taskInstanceId: params.taskInstanceId,
    taskDate: params.taskDate ?? selectedDateKey,
  });
  const [sections, setSections] = useState<JournalSection[]>(DEFAULT_SECTIONS);
  const [draft, setDraft] = useState<GuidedDraft>(() => draftFromEntry(getEntry(selectedDateKey)));
  const draftRef = useRef(draft);
  const hydratedRef = useRef(false);
  const dirtyRef = useRef(false);
  const [page, setPage] = useState(-1);
  const [transitionDirection, setTransitionDirection] = useState<1 | -1>(1);
  const [saving, setSaving] = useState(false);
  const [gratitudeDrafts, setGratitudeDrafts] = useState(['', '', '']);
  const gratitudeDraftRef = useRef(gratitudeDrafts);
  const gratitudeDirtyRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);

  const qualities = useMemo(() => idealSelf?.qualities ?? [], [idealSelf]);
  const todaysGratitude = useMemo(() => gratitudeEntries
    .filter(entry => entry.kind === 'daily' && entry.date === selectedDateKey)
    .sort((left, right) => left.createdAt - right.createdAt), [gratitudeEntries, selectedDateKey]);
  const steps = useMemo(() => stepList(sections, draft, qualities), [sections, draft, qualities]);
  const currentStep = page >= 0 ? steps[page] : undefined;
  const isFinished = page >= steps.length;

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [page]);

  const updateDraft = useCallback((change: Partial<GuidedDraft>) => {
    dirtyRef.current = true;
    setDraft(current => {
      const next = { ...current, ...change };
      draftRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    hydratedRef.current = false;
    dirtyRef.current = false;
    gratitudeDirtyRef.current = false;
    gratitudeDraftRef.current = ['', '', ''];
    setGratitudeDrafts(['', '', '']);
    setTransitionDirection(1);
    setPage(-1);
  }, [selectedDateKey]);

  useEffect(() => {
    if (gratitudeDirtyRef.current) return;
    const next = Array.from({ length: 3 }, (_, index) => {
      const entry = todaysGratitude[index];
      return entry?.title?.trim() || entry?.content?.trim() || '';
    });
    gratitudeDraftRef.current = next;
    setGratitudeDrafts(next);
  }, [todaysGratitude]);

  useEffect(() => {
    if (!ready || hydratedRef.current) return;
    const entry = getEntry(selectedDateKey);
    const nextDraft = draftFromEntry(entry);
    draftRef.current = nextDraft;
    setDraft(nextDraft);
    setSections(sectionsForEntry(entry, storedSections, selectedDateKey));
    hydratedRef.current = true;
  }, [ready, getEntry, selectedDateKey, storedSections]);

  const buildPatch = useCallback((value: GuidedDraft): JournalEntryPatch => {
    const patch: JournalEntryPatch = {
      dailySections: cloneJournalSections(sections),
      prompts: promptsToEntry(value.prompts),
      whoChecks: value.whoChecks,
      scaleValues: value.scaleValues,
      freeWritingHtml: value.freeWritingHtml,
    };
    if (value.mood !== undefined) patch.mood = value.mood;
    if (value.energy !== undefined) patch.energy = value.energy;
    if (value.satisfaction !== undefined) patch.satisfaction = value.satisfaction;
    return patch;
  }, [sections]);

  const exitSaveRef = useRef<{
    date: string;
    patch: JournalEntryPatch;
    queueCelebration: boolean;
  }>({
    date: selectedDateKey,
    patch: {},
    queueCelebration: !isTaskLaunch,
  });
  exitSaveRef.current = {
    date: selectedDateKey,
    patch: buildPatch(draftRef.current),
    queueCelebration: !isTaskLaunch,
  };

  const persistDraft = useCallback(async () => {
    if (!hydratedRef.current || !dirtyRef.current) return;
    await upsertEntry(selectedDateKey, buildPatch(draftRef.current), {
      queueCompletionCelebration: !isTaskLaunch,
    });
    dirtyRef.current = false;
  }, [buildPatch, isTaskLaunch, selectedDateKey, upsertEntry]);

  const persistGratitudeDrafts = useCallback(async () => {
    if (!gratitudeDirtyRef.current) return;
    const values = gratitudeDraftRef.current.map(value => value.trim());
    const resultingEntries = [...todaysGratitude];
    values.forEach((title, index) => {
      if (!title) return;
      const existing = todaysGratitude[index];
      const nextEntry = existing
        ? { ...existing, title }
        : {
          id: `guided_gratitude_${selectedDateKey}_${index}`,
          kind: 'daily' as const,
          title,
          content: '',
          date: selectedDateKey,
          createdAt: Date.now() + index,
        };
      resultingEntries[index] = nextEntry;
      upsertGratitudeEntry(nextEntry);
    });
    const gratitudeInstanceId = buildInstanceId(GRATITUDE_TASK_ID, selectedDateKey);
    await (resultingEntries.filter(Boolean).length >= 3
      ? completeInstance(gratitudeInstanceId, selectedDateKey)
      : resetInstance(gratitudeInstanceId, selectedDateKey)
    ).catch(() => {});
    gratitudeDirtyRef.current = false;
  }, [completeInstance, resetInstance, selectedDateKey, todaysGratitude, upsertGratitudeEntry]);

  useEffect(() => () => {
    const snapshot = exitSaveRef.current;
    if (!hydratedRef.current || !dirtyRef.current) return;
    void upsertEntry(snapshot.date, snapshot.patch, {
      queueCompletionCelebration: snapshot.queueCelebration,
    }).catch(error => {
      console.warn('Guided journal exit save failed', error);
    });
  }, [upsertEntry]);

  useEffect(() => {
    if (!dirtyRef.current) return;
    const timer = setTimeout(() => {
      void persistDraft().catch(error => console.warn('Guided journal autosave failed', error));
    }, 550);
    return () => clearTimeout(timer);
  }, [draft, persistDraft]);

  useEffect(() => {
    if (!gratitudeDirtyRef.current) return;
    const timer = setTimeout(() => {
      void persistGratitudeDrafts().catch(error => console.warn('Guided gratitude autosave failed', error));
    }, 650);
    return () => clearTimeout(timer);
  }, [gratitudeDrafts, persistGratitudeDrafts]);

  const close = async () => {
    try { await Promise.all([persistDraft(), persistGratitudeDrafts()]); } catch (error) { console.warn('Guided journal close failed', error); }
    router.back();
  };

  const advance = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await Promise.all([persistDraft(), persistGratitudeDrafts()]);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setTransitionDirection(1);
      setPage(value => value + 1);
    } catch (error) {
      console.warn('Guided journal save failed', error);
    } finally {
      setSaving(false);
    }
  };

  const finish = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await Promise.all([persistDraft(), persistGratitudeDrafts()]);
      const entry = getEntry(selectedDateKey);
      const completion = { ...entry, ...buildPatch(draftRef.current) };
      if (isTaskLaunch && params.taskInstanceId && hasDailyJournalContent(completion)) {
        const result = await routedCompletion.completeBeforeReturn({});
        if (!result.ok) return false;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      return true;
    } catch (error) {
      console.warn('Guided journal finish failed', error);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const updatePrompt = (id: string, answer: string) => {
    updateDraft({ prompts: draftRef.current.prompts.map(prompt => prompt.id === id ? { ...prompt, a: plainTextToHtml(answer) } : prompt) });
  };

  const updateGratitudeDraft = (index: number, value: string) => {
    gratitudeDirtyRef.current = true;
    setGratitudeDrafts(current => {
      const next = [...current];
      next[index] = value;
      gratitudeDraftRef.current = next;
      return next;
    });
  };

  const renderAnswer = () => {
    if (!currentStep) return null;
    switch (currentStep.type) {
      case 'mood':
        return <GuidedChoiceRow kind="mood" items={MOODS} selected={draft.mood} onSelect={mood => updateDraft({ mood })} />;
      case 'energy':
        return <GuidedChoiceRow kind="energy" items={ENERGIES} selected={draft.energy} onSelect={energy => updateDraft({ energy })} />;
      case 'satisfaction': {
        const value = clampScaleValue(draft.satisfaction ?? 5, 5);
        return <GuidedScaleAnswer value={value} label={value >= 9 ? 'Deeply satisfied' : value >= 7 ? 'Quietly proud' : value >= 5 ? 'An honest middle' : value >= 3 ? 'Something felt off' : 'A difficult day'} onChange={satisfaction => updateDraft({ satisfaction })} />;
      }
      case 'monthlyGoals':
        return <GuidedMonthlyGoalsReminder dateKey={selectedDateKey} />;
      case 'prompt': {
        const prompt = draft.prompts.find(item => item.id === currentStep.promptId);
        return <GuidedTextAnswer value={stripRichTextToPlainText(prompt?.a ?? '')} onChange={value => updatePrompt(currentStep.promptId, value)} placeholder="Write what feels true…" />;
      }
      case 'upcomingEvents':
        return <GuidedUpcomingEventsReminder dateKey={selectedDateKey} />;
      case 'gratitude':
        return <GuidedGratitudeAnswer values={gratitudeDrafts} onChange={updateGratitudeDraft} />;
      case 'qualities':
        return <GuidedQualitiesAnswer qualities={qualities} checks={draft.whoChecks} onToggle={quality => updateDraft({ whoChecks: { ...draftRef.current.whoChecks, [quality]: !draftRef.current.whoChecks[quality] } })} />;
      case 'scale': {
        const value = clampScaleValue(draft.scaleValues[currentStep.section.id] ?? 5, 5);
        return <GuidedScaleAnswer kind="scale" value={value} label={value >= 8 ? 'Strong and present' : value >= 5 ? 'Somewhere in the middle' : 'Needs gentle attention'} onChange={next => updateDraft({ scaleValues: { ...draftRef.current.scaleValues, [currentStep.section.id]: next } })} />;
      }
      case 'freeWriting':
        return <GuidedTextAnswer kind="freeWriting" value={stripRichTextToPlainText(draft.freeWritingHtml)} onChange={value => updateDraft({ freeWritingHtml: plainTextToHtml(value) })} placeholder="Write without overthinking…" />;
    }
  };

  const primaryLabel = page < 0 ? 'Begin reflection' : page === steps.length - 1 ? 'Complete reflection' : 'Continue';

  const goBack = () => {
    setTransitionDirection(-1);
    setPage(value => Math.max(0, value - 1));
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <GuidedBackdrop kind={currentStep?.type as GuidedVisualKind | undefined} />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => { void close(); }} style={styles.close} activeOpacity={0.75} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><X s={18} c="#766C60" /></TouchableOpacity>
        <View style={styles.headerCenter}><Text style={styles.headerEyebrow}>GUIDED REFLECTION</Text><Text style={styles.headerDate}>{formatDate(selectedDateKey)}</Text></View>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.progressWrap}>
        <View style={styles.progressMeta}>
          <Text style={styles.progressLabel}>{page < 0 ? 'YOUR REFLECTION PATH' : isFinished ? 'RITUAL COMPLETE' : currentStep?.eyebrow}</Text>
          <Text style={styles.progressText}>{page < 0 ? `${steps.length} MOMENTS` : isFinished ? 'SAVED' : `${String(page + 1).padStart(2, '0')} / ${String(steps.length).padStart(2, '0')}`}</Text>
        </View>
        <View style={styles.progressSegments}>
          {steps.map((step, index) => {
            const complete = isFinished || (page >= 0 && index < page);
            const current = page === index;
            return <View key={step.id} style={styles.progressSegment}><Animated.View layout={LinearTransition.duration(220)} style={[styles.progressSegmentFill, complete && styles.progressSegmentComplete, current && styles.progressSegmentCurrent]} /></View>;
          })}
        </View>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 126 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {page < 0 ? (
          <GuidedWelcome dateKey={selectedDateKey} stepCount={steps.length} />
        ) : isFinished ? (
          <GuidedCompletion />
        ) : currentStep ? (
          <GuidedQuestionShell
            key={currentStep.id}
            kind={currentStep.type as GuidedVisualKind}
            eyebrow={currentStep.eyebrow}
            title={currentStep.title}
            hint={currentStep.hint}
            stepIndex={page}
            stepCount={steps.length}
            direction={transitionDirection}
          >
            {renderAnswer()}
          </GuidedQuestionShell>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {page > 0 && !isFinished ? <TouchableOpacity onPress={goBack} style={styles.backBtn} activeOpacity={0.75}><ChevronLeft s={18} c="#817668" /><Text style={styles.backText}>BACK</Text></TouchableOpacity> : <View style={styles.backPlaceholder} />}
        <TouchableOpacity disabled={saving} onPress={() => { if (isFinished) { void close(); } else if (page === steps.length - 1) { void finish().then(completed => { if (completed) { setTransitionDirection(1); setPage(steps.length); } }); } else { void advance(); } }} style={[styles.primary, saving && styles.primaryDisabled]} activeOpacity={0.86}>
          <LinearGradient colors={['#302B24', '#181510']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryGradient}>
            <Text style={styles.primaryText}>{isFinished ? 'BACK TO JOURNAL' : primaryLabel.toUpperCase()}</Text>
            {!isFinished && (
              <View style={styles.primaryIcon}>
                {routedCompletion.showSlowIndicator
                  ? <ActivityIndicator size="small" color="#F2D79B" />
                  : <Sparkles s={15} c="#F2D79B" w={1.9} />}
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
      <RoutedTaskCompletionErrorModal
        visible={routedCompletion.saveErrorVisible}
        onKeepEditing={routedCompletion.keepEditing}
        onRetry={routedCompletion.retry}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: GUIDED_BG },
  header: { minHeight: 72, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center' },
  close: { width: 39, height: 39, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.62)', borderWidth: 1, borderColor: 'rgba(105,83,54,0.1)', alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' }, headerSpacer: { width: 38 },
  headerEyebrow: { fontFamily: F.sansBold, fontSize: 9.5, letterSpacing: 1.9, color: GUIDED_GOLD },
  headerDate: { marginTop: 3, fontFamily: F.serifMedium, fontSize: 13.5, color: '#655B50' },
  progressWrap: { paddingHorizontal: 22, paddingTop: 4, paddingBottom: 9 },
  progressMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { flex: 1, fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.3, color: '#A19586' },
  progressText: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.15, color: '#887B6A' },
  progressSegments: { height: 4, flexDirection: 'row', gap: 4 },
  progressSegment: { flex: 1, borderRadius: 3, overflow: 'hidden', backgroundColor: 'rgba(122,101,73,0.1)' },
  progressSegmentFill: { width: '0%', height: '100%', borderRadius: 3, backgroundColor: GUIDED_GOLD },
  progressSegmentComplete: { width: '100%', opacity: 0.52 },
  progressSegmentCurrent: { width: '100%', opacity: 1 },
  content: { flexGrow: 1, paddingHorizontal: 24, justifyContent: 'center', paddingTop: 8 },
  footer: { minHeight: 79, paddingHorizontal: 18, paddingTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(247,243,236,0.82)', borderTopWidth: 1, borderTopColor: 'rgba(126,101,68,0.07)' },
  backBtn: { minWidth: 73, height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 1 },
  backPlaceholder: { width: 73 },
  backText: { fontFamily: F.sansBold, fontSize: 9.5, letterSpacing: 1.2, color: '#817668' },
  primary: { flex: 1, minHeight: 54, borderRadius: 18, overflow: 'hidden', boxShadow: '0 9px 22px rgba(32,27,20,0.22)' },
  primaryGradient: { minHeight: 54, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  primaryDisabled: { opacity: 0.62 },
  primaryText: { fontFamily: F.sansBold, fontSize: 10.5, letterSpacing: 1.35, color: '#FFF9ED' },
  primaryIcon: { width: 25, height: 25, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
});
