import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Reanimated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  CalendarCheck, CheckSmall, ChevronDown,
  Heart, Pencil, Plus, RotateCcw, Trash2, X,
} from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import { RichTextEditor, RichToolbar, RichTextEditorRef, FormatState } from '@/components/shared/RichTextEditor';
import RichCommentText from '@/components/shared/RichCommentText';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import ConfirmModal from '@/components/shared/ConfirmModal';
import TaskTimeEditor from '@/components/shared/TaskTimeEditor';
import { useTasks } from '@/components/tasks/TaskProvider';
import { buildInstanceId, getLocalDateKey } from '@/components/tasks/taskScheduler';
import type { TaskDraft } from '@/components/tasks/taskTypes';
import { GratitudeEntry, GratitudeKind, useInnerTools } from './InnerToolsContext';
import { HapticTouchableOpacity as TouchableOpacity, HapticPressable as Pressable } from '@/components/shared/HapticTouch';


const ROSE = '#F43F5E';
const GOLD = '#C5A059';
const BG = '#FFFFFF';

const WISDOM_QUOTES = [
  {
    text: 'Give thanks to God in all things - this is the greatest wisdom and the most perfect prayer.',
    author: 'St. John Chrysostom',
  },
  {
    text: 'A thankful heart is not only the greatest virtue, but the parent of all other virtues.',
    author: 'St. Isaac the Syrian',
  },
  {
    text: 'Thank God for everything; this is the shortest path to peace of soul.',
    author: 'Elder Ambrose of Optina',
  },
  {
    text: 'He who gives thanks to God for small things will be entrusted with great ones.',
    author: 'St. Dorotheus of Gaza',
  },
];

const FREQ_OPTIONS: { label: string; sub: string; value: 'daily' | 'weekdays' }[] = [
  { label: 'Every Day', sub: '7 days a week', value: 'daily' },
  { label: 'Weekdays', sub: 'Mon - Fri', value: 'weekdays' },
];

const ALL_DAY_INDEXES = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAY_INDEXES = [0, 1, 2, 3, 4];

function getTodayTaskDayIndex() {
  const jsDay = new Date().getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

function newId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

const GRATITUDE_TASK_ID = 'gratitude_daily_task';
const LIFE_PREVIEW_COUNT = 6;

function buildGratitudeTaskDraft({
  time,
  frequency,
  sameTimeEveryDay,
  dayTimes,
}: {
  time: string;
  frequency: 'daily' | 'weekdays';
  sameTimeEveryDay: boolean;
  dayTimes: Record<number, string>;
}): TaskDraft {
  return {
    id: GRATITUDE_TASK_ID,
    title: 'Daily Gratitude',
    subtitle: frequency === 'weekdays' ? 'Weekdays - three blessings' : 'Every day - three blessings',
    level: 1,
    source: 'gratitude',
    type: 'gratitude',
    targetView: '/gratitude',
    schedule: {
      frequency,
      selectedDays: [],
      monthlyDays: [1],
      time,
      sameTimeEveryDay,
      dayTimes: sameTimeEveryDay ? {} : dayTimes,
    },
    notificationMode: 'none',
    journalConfig: {
      journalType: 'gratitude',
      technique: 'gratitude',
    },
  };
}

function useChoiceMotion(active: boolean) {
  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(active ? 1 : 0, {
      damping: 15,
      stiffness: 160,
      mass: 1,
    });
  }, [active, progress]);

  return progress;
}

export default function GratitudeView() {
  const params = useLocalSearchParams<{ task?: string; kind?: GratitudeKind; taskDate?: string }>();
  const insets = useSafeAreaInsets();
  const {
    createOrUpdateTask,
    remove: removeTask,
    completeInstance,
    resetInstance,
  } = useTasks();
  const {
    gratitudeEntries, upsertGratitudeEntry, deleteGratitudeEntry,
    gratitudeTaskEnabled, setGratitudeTaskEnabled,
    gratitudeTaskTime, setGratitudeTaskTime,
    gratitudeTaskFrequency, setGratitudeTaskFrequency,
    gratitudeTaskSameTimeEveryDay, setGratitudeTaskSameTimeEveryDay,
    gratitudeTaskDayTimes, setGratitudeTaskDayTimes,
  } = useInnerTools();

  const [formKind, setFormKind] = useState<GratitudeKind | null>(null);
  const [editing, setEditing] = useState<GratitudeEntry | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [taskSheet, setTaskSheet] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [confirmDisableTask, setConfirmDisableTask] = useState(false);
  const [dailyPageIndex, setDailyPageIndex] = useState(0);
  const [showAllLifeEntries, setShowAllLifeEntries] = useState(false);
  const handledTaskOpenRef = useRef(false);
  const { width: windowWidth } = useWindowDimensions();
  const dailyPageWidth = Math.max(0, windowWidth - 40);

  const lifeEntries = useMemo(() => gratitudeEntries.filter(entry => entry.kind === 'life').sort((a, b) => b.createdAt - a.createdAt), [gratitudeEntries]);
  const visibleLifeEntries = useMemo(
    () => showAllLifeEntries ? lifeEntries : lifeEntries.slice(0, LIFE_PREVIEW_COUNT),
    [lifeEntries, showAllLifeEntries]
  );
  const hasHiddenLifeEntries = lifeEntries.length > LIFE_PREVIEW_COUNT;
  const dailyEntries = useMemo(() => gratitudeEntries.filter(entry => entry.kind === 'daily').sort((a, b) => b.createdAt - a.createdAt), [gratitudeEntries]);
  const dailyPages = useMemo(() => {
    const pages: GratitudeEntry[][] = [];
    for (let i = 0; i < dailyEntries.length; i += 5) {
      pages.push(dailyEntries.slice(i, i + 5));
    }
    return pages;
  }, [dailyEntries]);

  useEffect(() => {
    if (dailyPageIndex >= dailyPages.length && dailyPages.length > 0) {
      setDailyPageIndex(dailyPages.length - 1);
    } else if (dailyPages.length === 0 && dailyPageIndex !== 0) {
      setDailyPageIndex(0);
    }
  }, [dailyPages.length, dailyPageIndex]);

  useEffect(() => {
    if (showAllLifeEntries && lifeEntries.length <= LIFE_PREVIEW_COUNT) {
      setShowAllLifeEntries(false);
    }
  }, [lifeEntries.length, showAllLifeEntries]);

  const taskEntryDate = params.taskDate ?? getLocalDateKey();

  const syncGratitudeTaskCompletion = async (nextEntries: GratitudeEntry[], forceEnabled = false, date = taskEntryDate) => {
    if (!forceEnabled && !gratitudeTaskEnabled) return;
    const count = nextEntries.filter(entry => entry.kind === 'daily' && entry.date === date).length;
    const instanceId = buildInstanceId(GRATITUDE_TASK_ID, date);
    if (count >= 3) await completeInstance(instanceId, date);
    else await resetInstance(instanceId, date);
  };

  const openAdd = (kind: GratitudeKind) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditing(null);
    setFormKind(kind);
    setTitle('');
    setContent('');
  };

  const openEdit = (entry: GratitudeEntry) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditing(entry);
    setFormKind(entry.kind);
    setTitle(entry.title);
    setContent(entry.content);
  };

  const closeForm = () => {
    setFormKind(null);
    setEditing(null);
    setTitle('');
    setContent('');
  };

  useEffect(() => {
    if (handledTaskOpenRef.current || params.task !== '1') return;
    handledTaskOpenRef.current = true;
    openAdd(params.kind === 'life' ? 'life' : 'daily');
  }, [params.kind, params.task]);

  const saveEntry = () => {
    const cleanTitle = title.trim();
    const cleanContent = content.trim();
    if (!cleanTitle && !cleanContent) return;

    const nextEntry: GratitudeEntry = {
      id: editing?.id ?? newId('gratitude'),
      kind: formKind ?? 'life',
      title: cleanTitle || cleanContent,
      content: cleanContent,
      date: editing?.date ?? (formKind === 'daily' ? taskEntryDate : getLocalDateKey()),
      createdAt: editing?.createdAt ?? Date.now(),
    };
    const nextEntries = gratitudeEntries.some(entry => entry.id === nextEntry.id)
      ? gratitudeEntries.map(entry => entry.id === nextEntry.id ? nextEntry : entry)
      : [nextEntry, ...gratitudeEntries];

    upsertGratitudeEntry(nextEntry);
    void syncGratitudeTaskCompletion(nextEntries, false, nextEntry.date);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    closeForm();
  };

  return (
    <View style={s.screen}>
      <ScreenTitleBar title="GRATITUDE" showBack bg={BG} />
      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.scripture}>
          <Text style={s.scriptureText}>{'"In everything give thanks, for this is the will of God in Christ Jesus for you."'}</Text>
          <Text style={s.scriptureRef}>1 THESSALONIANS 5:18</Text>
        </View>

        <WisdomCard quote={WISDOM_QUOTES[0]} compact />

        <SectionHeader
          label="Life Gratitude"
          sublabel="Enduring Blessings"
          color="amber"
          count={lifeEntries.length}
          onAdd={() => openAdd('life')}
        />
        {lifeEntries.length === 0 && formKind !== 'life' ? (
          <EmptyHint color="amber" text="What are you always grateful for?" />
        ) : (
          <View style={s.lifeList}>
            {visibleLifeEntries.map(entry => (
              <GratitudeCard
                key={entry.id}
                entry={entry}
                color="amber"
                showDate={false}
                collapsible
                animatePresence
                onEdit={() => openEdit(entry)}
                onDelete={() => setDeleteTarget(entry.id)}
              />
            ))}
            {hasHiddenLifeEntries && (
              <Reanimated.View
                entering={FadeIn.duration(160)}
                exiting={FadeOut.duration(120)}
                layout={LinearTransition.springify().damping(16).stiffness(170).mass(1)}
                style={s.lifeMoreWrap}
              >
                <LifeMoreButton
                  expanded={showAllLifeEntries}
                  onPress={() => setShowAllLifeEntries(value => !value)}
                />
              </Reanimated.View>
            )}
          </View>
        )}

        <TaskToggleCard
          enabled={gratitudeTaskEnabled}
          time={gratitudeTaskTime}
          frequency={gratitudeTaskFrequency}
          sameTimeEveryDay={gratitudeTaskSameTimeEveryDay}
          dayTimes={gratitudeTaskDayTimes}
          onOpen={() => setTaskSheet(true)}
          onToggle={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (gratitudeTaskEnabled) {
              setConfirmDisableTask(true);
              return;
            }
            setTaskSheet(true);
          }}
        />

        <WisdomCard quote={WISDOM_QUOTES[1]} compact />

        <SectionHeader
          label="Daily Gratitude"
          sublabel="Today's Blessings, Big and Small"
          color="rose"
          count={dailyEntries.length}
          onAdd={() => openAdd('daily')}
        />
        {dailyEntries.length === 0 && formKind !== 'daily' ? (
          <EmptyHint color="rose" text="What are you thankful for today?" />
        ) : (
          <View style={s.dailyPager}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToInterval={dailyPageWidth}
              snapToAlignment="start"
              disableIntervalMomentum
              onMomentumScrollEnd={e => {
                if (dailyPageWidth <= 0) return;
                const idx = Math.round(e.nativeEvent.contentOffset.x / dailyPageWidth);
                if (idx !== dailyPageIndex) setDailyPageIndex(idx);
              }}
            >
              {dailyPages.map((page, idx) => (
                <View key={idx} style={[s.dailyPage, { width: dailyPageWidth }]}>
                  {page.map(entry => (
                    <GratitudeCard
                      key={entry.id}
                      entry={entry}
                      color="rose"
                      showDate
                      collapsible
                      onEdit={() => openEdit(entry)}
                      onDelete={() => setDeleteTarget(entry.id)}
                    />
                  ))}
                </View>
              ))}
            </ScrollView>
            {dailyPages.length > 1 && (
              <View style={s.pageDots}>
                {dailyPages.map((_, idx) => (
                  <DailyPageDot
                    key={idx}
                    active={idx === dailyPageIndex}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        <View style={s.bottomQuotes}>
          <WisdomCard quote={WISDOM_QUOTES[3]} />
        </View>
      </ScrollView>

      <GratitudeForm
        visible={!!formKind}
        editorKey={`${formKind ?? 'none'}-${editing?.id ?? 'new'}`}
        color={formKind === 'daily' ? 'rose' : 'amber'}
        title={title}
        content={content}
        isEditing={!!editing}
        placeholder={formKind === 'daily' ? "Today I'm grateful for..." : "I'm always grateful for..."}
        onTitle={setTitle}
        onContent={setContent}
        onCancel={closeForm}
        onSave={saveEntry}
      />

      <ConfirmModal
        visible={!!deleteTarget}
        icon={<Trash2 s={22} c={C.red} />}
        iconBg="#FEF2F2"
        title="Delete entry?"
        body="This gratitude entry will be permanently removed."
        cancelLabel="KEEP"
        confirmLabel="DELETE"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            const nextEntries = gratitudeEntries.filter(entry => entry.id !== deleteTarget);
            deleteGratitudeEntry(deleteTarget);
            void syncGratitudeTaskCompletion(nextEntries);
          }
          setDeleteTarget(null);
        }}
      />

      <ConfirmModal
        visible={confirmDisableTask}
        icon={<CalendarCheck s={22} c={C.gold} />}
        iconBg="#FFF8E0"
        title="Stop daily task?"
        body="Gratitude will be removed from your daily routine."
        cancelLabel="KEEP"
        confirmLabel="STOP"
        confirmColor={C.gold}
        onCancel={() => setConfirmDisableTask(false)}
        onConfirm={() => {
          void (async () => {
            await removeTask(GRATITUDE_TASK_ID);
            setGratitudeTaskEnabled(false);
            setConfirmDisableTask(false);
          })();
        }}
      />

      <TaskSheet
        visible={taskSheet}
        time={gratitudeTaskTime}
        frequency={gratitudeTaskFrequency}
        sameTimeEveryDay={gratitudeTaskSameTimeEveryDay}
        dayTimes={gratitudeTaskDayTimes}
        onTime={setGratitudeTaskTime}
        onFrequency={setGratitudeTaskFrequency}
        onSameTimeEveryDay={setGratitudeTaskSameTimeEveryDay}
        onDayTimes={setGratitudeTaskDayTimes}
        onClose={() => setTaskSheet(false)}
        onSave={async () => {
          await createOrUpdateTask(buildGratitudeTaskDraft({
            time: gratitudeTaskTime,
            frequency: gratitudeTaskFrequency,
            sameTimeEveryDay: gratitudeTaskSameTimeEveryDay,
            dayTimes: gratitudeTaskDayTimes,
          }));
          setGratitudeTaskEnabled(true);
          await syncGratitudeTaskCompletion(gratitudeEntries, true);
          setTaskSheet(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}
      />
    </View>
  );
}

function SectionHeader({
  label, sublabel, color, count, onAdd,
}: {
  label: string;
  sublabel: string;
  color: 'amber' | 'rose';
  count: number;
  onAdd: () => void;
}) {
  const accent = color === 'amber' ? GOLD : ROSE;
  return (
    <View style={s.sectionHeader}>
      <View>
        <Text style={[s.sectionKicker, { color: accent }]}>{sublabel}</Text>
        <Text style={s.sectionTitle}>{label} <Text style={s.sectionCount}>({count})</Text></Text>
      </View>
      <TouchableOpacity onPress={onAdd} style={[s.sectionAdd, { backgroundColor: color === 'amber' ? '#78350F' : ROSE }]} activeOpacity={0.82}>
        <Plus s={17} c="#fff" />
      </TouchableOpacity>
    </View>
  );
}

function LifeMoreButton({ expanded, onPress }: { expanded: boolean; onPress: () => void }) {
  const progress = useChoiceMotion(expanded);
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 180}deg` }],
  }));

  return (
    <TouchableOpacity
      onPress={onPress}
      style={s.lifeMoreBtn}
      activeOpacity={0.86}
      haptic="selection"
    >
      <Text style={s.lifeMoreText}>{expanded ? 'Show Less' : 'See All'}</Text>
      <Reanimated.View style={[s.lifeMoreIcon, iconStyle]}>
        <ChevronDown s={16} c="#9A7A34" w={2.1} />
      </Reanimated.View>
    </TouchableOpacity>
  );
}

function DailyPageDot({ active }: { active: boolean }) {
  const progress = useChoiceMotion(active);
  const dotStyle = useAnimatedStyle(() => ({
    width: 6 + progress.value * 12,
    backgroundColor: interpolateColor(progress.value, [0, 1], ['#E7E5E4', ROSE]),
    opacity: 0.72 + progress.value * 0.28,
  }));

  return <Reanimated.View style={[s.pageDot, dotStyle]} />;
}

function GratitudeForm({
  visible, editorKey, color, title, content, isEditing, placeholder, onTitle, onContent, onCancel, onSave,
}: {
  visible: boolean;
  editorKey: string;
  color: 'amber' | 'rose';
  title: string;
  content: string;
  isEditing: boolean;
  placeholder: string;
  onTitle: (value: string) => void;
  onContent: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const accent = color === 'amber' ? GOLD : ROSE;
  const insets = useSafeAreaInsets();
  const editorRef = useRef<RichTextEditorRef>(null);
  const scrollRef = useRef<ScrollView>(null);
  const toolbarYRef = useRef(0);
  const [fmt, setFmt] = useState<FormatState>({ bold: false, italic: false, underline: false });
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const editorBg = color === 'amber' ? '#FFFDF8' : '#FFF8F8';
  const titleBg = color === 'amber' ? '#FFFBEB' : '#FFF1F2';
  const titlePlaceholderColor = color === 'amber' ? '#E1C780' : '#FDA4AF';
  const saveBg = color === 'amber' ? '#78350F' : ROSE;

  useEffect(() => {
    if (!visible) {
      setKeyboardOpen(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, () => {
      setKeyboardOpen(true);
      // Scroll so toolbar sits at top of the visible scroll — title input scrolls out,
      // toolbar + editor + Save are the focused area above the keyboard.
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y: Math.max(0, toolbarYRef.current - 4), animated: true });
      });
    });
    const hideSub = Keyboard.addListener(hideEvt, () => {
      setKeyboardOpen(false);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <KeyboardAvoidingView
        style={[
          s.gratFormOverlay,
          { paddingTop: Math.max(insets.top + 14, 36), paddingBottom: Math.max(insets.bottom + 14, 28) },
        ]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={StyleSheet.absoluteFill} pointerEvents="none" />
        <View style={s.gratFormCard}>
          <View style={s.gratFormHeader}>
            <Text style={[s.gratFormTitle, { color: accent }]} numberOfLines={1}>
              {isEditing ? 'EDIT ENTRY' : 'NEW ENTRY'}
            </Text>
            <TouchableOpacity onPress={onCancel} style={s.gratFormCloseBtn} activeOpacity={0.85} hitSlop={6}>
              <X s={16} c="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <ScrollView
            ref={scrollRef}
            style={s.gratFormScroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.gratFormScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <TextInput
              value={title}
              onChangeText={value => onTitle(value.replace(/\r?\n/g, ' '))}
              placeholder={placeholder}
              placeholderTextColor={titlePlaceholderColor}
              returnKeyType="done"
              blurOnSubmit
              style={[s.gratFormTitleInput, { backgroundColor: titleBg, borderColor: accent }]}
            />
            <View onLayout={e => { toolbarYRef.current = e.nativeEvent.layout.y; }}>
              <RichToolbar editorRef={editorRef} activeFormats={fmt} style={s.gratFormToolbar} />
            </View>
            <View style={[s.gratFormEditorBox, keyboardOpen && s.gratFormEditorBoxCompact, { backgroundColor: editorBg, borderColor: accent }]}>
              <RichTextEditor
                key={editorKey}
                ref={editorRef}
                initialHTML={content}
                onChange={onContent}
                onFormatChange={setFmt}
                placeholder="Add more detail... (optional)"
                backgroundColor={editorBg}
                color="#3D3229"
              />
            </View>
          </ScrollView>

          <View style={s.gratFormActions}>
            <TouchableOpacity onPress={onCancel} style={s.gratFormCancel} activeOpacity={0.85}>
              <Text style={s.gratFormCancelText}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onSave} style={[s.gratFormSave, { backgroundColor: saveBg }]} activeOpacity={0.85}>
              <Text style={s.gratFormSaveText}>{isEditing ? 'SAVE CHANGES' : 'SAVE'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/\u00e2\u20ac\u00a2/g, '-')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

function GratitudeCard({
  entry, color, showDate, collapsible, animatePresence = false, onEdit, onDelete,
}: {
  entry: GratitudeEntry;
  color: 'amber' | 'rose';
  showDate: boolean;
  collapsible?: boolean;
  animatePresence?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isAmber = color === 'amber';
  const accent = isAmber ? GOLD : ROSE;
  const tint = isAmber ? 'rgba(197,160,89,0.10)' : 'rgba(244,63,94,0.08)';
  const border = isAmber ? 'rgba(197,160,89,0.20)' : 'rgba(244,63,94,0.18)';
  const stripe = isAmber ? 'rgba(197,160,89,0.55)' : 'rgba(244,63,94,0.45)';
  const dateColor = isAmber ? 'rgba(155,127,67,0.85)' : 'rgba(190,58,82,0.85)';

  const hasContent = !!stripHtml(entry.content);
  const hasTitle = !!entry.title?.trim();

  const [expanded, setExpanded] = useState(!collapsible);
  const isExpanded = !collapsible || expanded;

  const rotProgress = useSharedValue(isExpanded ? 1 : 0);
  useEffect(() => {
    rotProgress.value = withTiming(isExpanded ? 1 : 0, { duration: 200 });
  }, [isExpanded, rotProgress]);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotProgress.value * 180}deg` }],
  }));

  const toggle = () => {
    if (!collapsible) return;
    Haptics.selectionAsync();
    setExpanded(v => !v);
  };

  const actions = (
    <View style={s.gActions}>
      <TouchableOpacity onPress={onEdit} style={s.gActionBtn} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
        <Pencil s={15} c="#A8A29E" w={1.8} />
      </TouchableOpacity>
      <TouchableOpacity onPress={onDelete} style={s.gActionBtn} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
        <Trash2 s={15} c="#D64C55" w={1.8} />
      </TouchableOpacity>
    </View>
  );

  return (
    <Reanimated.View
      style={[s.gCard, { borderColor: border }]}
      layout={LinearTransition.springify().damping(15).stiffness(160).mass(1)}
      entering={animatePresence ? FadeIn.duration(160) : undefined}
      exiting={animatePresence ? FadeOut.duration(120) : undefined}
    >
      <View style={[s.gAccent, { backgroundColor: stripe }]} pointerEvents="none" />
      <View style={s.gInner}>
        <Pressable onPress={toggle} style={s.gHead} disabled={!collapsible}>
          <View style={[s.gIconCircle, { backgroundColor: tint }]}>
            <Heart s={13} c={accent} w={2} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            {showDate && (
              <Text style={[s.gDate, { color: dateColor }]}>
                {new Date(entry.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}
              </Text>
            )}
            {hasTitle && (
              <Text style={s.gTitle} numberOfLines={isExpanded ? 0 : 2}>{entry.title}</Text>
            )}
          </View>
          {collapsible && (
            <Reanimated.View style={[s.gChevron, chevronStyle]}>
              <ChevronDown s={18} c="#A8A29E" w={2} />
            </Reanimated.View>
          )}
        </Pressable>

        {isExpanded && (hasContent || !collapsible) && (
          <Reanimated.View
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(120)}
          >
            {hasContent ? (
              <View style={s.gBody}>
                <RichCommentText
                  html={entry.content}
                  color="#5B554F"
                  collapsedLines={isAmber ? 4 : 3}
                  rightSlot={actions}
                />
              </View>
            ) : (
              <View style={s.gActionsOnlyRow}>{actions}</View>
            )}
          </Reanimated.View>
        )}

        {isExpanded && collapsible && !hasContent && (
          <View style={s.gActionsOnlyRow}>{actions}</View>
        )}
      </View>
    </Reanimated.View>
  );
}

function EmptyHint({ color, text }: { color: 'amber' | 'rose'; text: string }) {
  const accent = color === 'amber' ? 'rgba(197,160,89,0.55)' : 'rgba(244,63,94,0.45)';
  return (
    <View style={s.empty}>
      <Heart s={28} c={accent} />
      <Text style={[s.emptyText, { color: accent }]}>{text}</Text>
    </View>
  );
}

function TaskToggleCard({
  enabled, time, frequency, sameTimeEveryDay, dayTimes, onOpen, onToggle,
}: {
  enabled: boolean;
  time: string;
  frequency: 'daily' | 'weekdays';
  sameTimeEveryDay: boolean;
  dayTimes: Record<number, string>;
  onOpen: () => void;
  onToggle: () => void;
}) {
  const displayTime = sameTimeEveryDay ? time : dayTimes[getTodayTaskDayIndex()] ?? time;

  return (
    <View style={[s.taskCard, enabled && s.taskCardEnabled]}>
      <TouchableOpacity onPress={enabled ? onOpen : onToggle} style={s.taskMain} activeOpacity={0.82}>
        <View style={[s.taskIcon, enabled && s.taskIconEnabled]}>
          <CalendarCheck s={18} c={enabled ? '#fff' : ROSE} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.taskTitle}>Set as Daily Task</Text>
          <Text style={[s.taskSub, enabled && { color: ROSE }]}>
            {enabled ? `${frequency === 'weekdays' ? 'Mon - Fri' : 'Every day'} - ${displayTime}` : 'Add gratitude to your daily routine'}
          </Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity onPress={onToggle} style={[s.switch, enabled && s.switchOn]} activeOpacity={0.8}>
        <View style={[s.switchKnob, enabled && s.switchKnobOn]} />
      </TouchableOpacity>
    </View>
  );
}

function WisdomCard({ quote, compact = false }: { quote: { text: string; author: string }; compact?: boolean }) {
  return (
    <View style={[s.wisdom, compact && s.wisdomCompact]}>
      <Text style={s.wisdomText}>
        <Text style={s.wisdomQuote}>{'"'}</Text>
        {quote.text}
        <Text style={s.wisdomQuote}>{'"'}</Text>
      </Text>
      <Text style={s.wisdomAuthor}>— {quote.author.toUpperCase()}</Text>
    </View>
  );
}

function TaskSheet({
  visible, time, frequency, sameTimeEveryDay, dayTimes,
  onTime, onFrequency, onSameTimeEveryDay, onDayTimes, onClose, onSave,
}: {
  visible: boolean;
  time: string;
  frequency: 'daily' | 'weekdays';
  sameTimeEveryDay: boolean;
  dayTimes: Record<number, string>;
  onTime: (time: string) => void;
  onFrequency: (freq: 'daily' | 'weekdays') => void;
  onSameTimeEveryDay: (sameTimeEveryDay: boolean) => void;
  onDayTimes: (dayTimes: Record<number, string>) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const activeDayIndexes = frequency === 'weekdays' ? WEEKDAY_INDEXES : ALL_DAY_INDEXES;

  return (
    <SmoothBottomSheet visible={visible} onClose={onClose} sheetStyle={s.sheet} keyboardAware>
      <View style={s.sheetHandle} />
      <View style={s.sheetHead}>
        <TouchableOpacity onPress={onClose} style={s.sheetHeadBtn} activeOpacity={0.75}>
          <X s={21} c="#A8A29E" />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={s.sheetKicker}>Set as Task</Text>
          <Text style={s.sheetTitle}>Daily Gratitude</Text>
        </View>
        <TouchableOpacity onPress={onSave} style={[s.sheetHeadBtn, s.sheetSave]} activeOpacity={0.86}>
          <CheckSmall s={20} c="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.sheetContent}>
        <View style={s.taskPreview}>
          <View style={s.taskPreviewIcon}>
            <Heart s={21} c={ROSE} />
          </View>
          <View style={s.taskPreviewCopy}>
            <Text style={s.taskPreviewKicker}>Gratitude Practice</Text>
            <Text style={s.taskPreviewTitle}>Three blessings each day</Text>
            <View style={s.taskPreviewQuote}>
              <Text style={s.taskPreviewQuoteText}>{`"${WISDOM_QUOTES[2].text}"`}</Text>
              <Text style={s.taskPreviewQuoteAuthor}>- {WISDOM_QUOTES[2].author.toUpperCase()}</Text>
            </View>
          </View>
        </View>

        <View style={s.sheetBlock}>
          <View style={s.sheetLabelRow}>
            <Text style={s.sheetLabel}>Frequency</Text>
            <RotateCcw s={14} c="#FDA4AF" />
          </View>
          <View style={s.freqColumn}>
            {FREQ_OPTIONS.map(option => (
              <FrequencyCard
                key={option.value}
                option={option}
                active={frequency === option.value}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onFrequency(option.value);
                }}
              />
            ))}
          </View>
        </View>

        <View style={s.sheetBlock}>
          <TaskTimeEditor
            time={time}
            sameTimeEveryDay={sameTimeEveryDay}
            dayTimes={dayTimes}
            onTimeChange={onTime}
            onSameTimeEveryDayChange={onSameTimeEveryDay}
            onDayTimesChange={onDayTimes}
            activeDayIndexes={activeDayIndexes}
            accent={ROSE}
            softBg="#FFF7F8"
            borderColor="#FFE4E6"
            mutedColor="#FB7185"
          />
        </View>

        <TouchableOpacity onPress={onSave} activeOpacity={0.88} style={s.sheetPrimary}>
          <Text style={s.sheetPrimaryText}>SAVE DAILY TASK</Text>
        </TouchableOpacity>
      </ScrollView>
    </SmoothBottomSheet>
  );
}

function FrequencyCard({
  option,
  active,
  onPress,
}: {
  option: typeof FREQ_OPTIONS[number];
  active: boolean;
  onPress: () => void;
}) {
  const progress = useChoiceMotion(active);
  const cardMotionStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], ['#FFFFFF', '#FFF1F2']),
    borderColor: interpolateColor(progress.value, [0, 1], ['#F1E7EA', '#F43F5E']),
    shadowOpacity: 0.02 + progress.value * 0.14,
    transform: [{ scale: 1 + progress.value * 0.02 }],
  }));
  const dotMotionStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.7 + progress.value * 0.3 }],
  }));

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={s.freqTouch}>
      <Reanimated.View style={[s.freqCard, cardMotionStyle]}>
        <View style={s.freqCopy}>
          <Text style={[s.freqTitle, active && s.freqTitleActive]}>{option.label}</Text>
          <Text style={[s.freqSub, active && s.freqSubActive]}>{option.sub}</Text>
        </View>
        <View style={[s.freqDot, active && s.freqDotActive]}>
          <Reanimated.View style={dotMotionStyle}>
            <CheckSmall s={9} c="#fff" />
          </Reanimated.View>
        </View>
      </Reanimated.View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  content: { paddingHorizontal: 20 },

  scripture: { alignItems: 'center', paddingTop: 18, paddingBottom: 16, paddingHorizontal: 10 },
  scriptureText: { fontFamily: F.serifMediumItalic, fontSize: 19, lineHeight: 30, color: '#3D3229', textAlign: 'center' },
  scriptureRef: { marginTop: 10, fontFamily: F.sansBold, fontSize: 9, letterSpacing: 2.4, color: GOLD },

  wisdom: { borderRadius: 22, backgroundColor: '#1C1917', paddingHorizontal: 22, paddingVertical: 18, marginVertical: 6, borderLeftWidth: 3, borderLeftColor: GOLD },
  wisdomCompact: { marginVertical: 8 },
  wisdomText: { fontFamily: F.serifItalic, fontSize: 16, lineHeight: 26, color: '#EAE5DC', marginBottom: 10 },
  wisdomQuote: { color: GOLD },
  wisdomAuthor: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 2.2, color: GOLD },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 6, marginBottom: 10 },
  sectionKicker: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 2.1, textTransform: 'uppercase', marginBottom: 4 },
  sectionTitle: { fontFamily: F.serifMedium, fontSize: 23, color: C.text },
  sectionCount: { fontSize: 15, color: C.textMuted },
  sectionAdd: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  lifeList: { gap: 7, marginBottom: 16 },
  lifeMoreWrap: { alignItems: 'center', paddingTop: 2, paddingBottom: 2 },
  lifeMoreBtn: {
    minHeight: 38,
    paddingHorizontal: 17,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.28)',
    backgroundColor: '#FFF9EC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 7,
    shadowColor: GOLD,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 12,
    elevation: 2,
  },
  lifeMoreText: {
    fontFamily: F.serifMedium,
    fontSize: 15.5,
    color: '#8D6D2D',
  },
  lifeMoreIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(197,160,89,0.10)',
  },
  formFrame: { borderWidth: 2, borderRadius: 24, padding: 2, marginBottom: 12 },
  formInner: { borderRadius: 22, backgroundColor: '#fff', padding: 15, gap: 11 },
  formKicker: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 2, textTransform: 'uppercase' },
  formInput: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontFamily: F.serif, fontSize: 16, color: C.text },
  formToolbar: { marginTop: 2, marginBottom: 6 },
  formEditor: { height: 180, borderRadius: 10, overflow: 'hidden' },
  formEditorCompact: { height: 140 },

  // Modal-based gratitude form (mirrors CommentModal layout for keyboard handling)
  gratFormOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    backgroundColor: 'rgba(0,0,0,0.40)',
  },
  gratFormCard: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '100%',
    flexShrink: 1,
    flexDirection: 'column',
    borderRadius: 26,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowOffset: { width: 0, height: 16 },
    shadowRadius: 38,
    elevation: 18,
  },
  gratFormHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    marginBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEEFF2',
  },
  gratFormTitle: { flex: 1, fontFamily: F.sansBold, fontSize: 11, letterSpacing: 2.2, marginRight: 12 },
  gratFormCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F4F5F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gratFormScroll: { flexShrink: 1, flexGrow: 0 },
  gratFormScrollContent: { paddingBottom: 4 },
  gratFormTitleInput: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 0,
    fontFamily: F.serif,
    fontSize: 16,
    color: C.text,
    marginBottom: 10,
  },
  gratFormToolbar: { marginTop: 4, marginBottom: 8 },
  gratFormEditorBox: {
    height: 220,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
  },
  gratFormEditorBoxCompact: { height: 170 },
  gratFormActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  gratFormCancel: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gratFormCancelText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 1.8, color: C.textSecondary },
  gratFormSave: {
    flex: 1.6,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gratFormSaveText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 1.8, color: '#fff' },
  formActions: { flexDirection: 'row', gap: 9 },
  cancelBtn: { flex: 1, borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', paddingVertical: 12, alignItems: 'center' },
  cancelText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 1.7, color: C.textSecondary, textTransform: 'uppercase' },
  saveBtn: { flex: 2, borderRadius: 16, paddingVertical: 12, alignItems: 'center' },
  saveText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 1.7, color: '#fff', textTransform: 'uppercase' },
  gCard: {
    position: 'relative',
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 10,
    elevation: 2,
  },
  gAccent: {
    position: 'absolute',
    left: 0,
    top: 14,
    bottom: 14,
    width: 3,
    borderRadius: 2,
  },
  gInner: { paddingHorizontal: 16, paddingVertical: 13, paddingLeft: 22 },
  gHead: { flexDirection: 'row', alignItems: 'center', columnGap: 11 },
  gIconCircle: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  gDate: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.8, textTransform: 'uppercase' },
  gTitle: {
    marginTop: 1,
    fontFamily: F.serifMedium,
    fontSize: 16,
    lineHeight: 20,
    color: '#2A2622',
  },
  gBody: { marginTop: 10 },
  gActions: { flexDirection: 'row', alignItems: 'center', columnGap: 9 },
  gActionBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  gActionsOnlyRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  gChevron: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingVertical: 24, marginBottom: 10 },
  emptyText: { marginTop: 8, fontFamily: F.serifMediumItalic, fontSize: 16, textAlign: 'center' },
  taskCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, borderWidth: 1, borderColor: '#FFE4E6', backgroundColor: '#FFF7F8', paddingHorizontal: 14, paddingVertical: 13, marginBottom: 12 },
  taskCardEnabled: { borderColor: '#FECDD3', backgroundColor: '#FFF1F2' },
  taskMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  taskIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: 'rgba(244,63,94,0.10)', alignItems: 'center', justifyContent: 'center' },
  taskIconEnabled: { backgroundColor: ROSE },
  taskTitle: { fontFamily: F.sansSemiBold, fontSize: 13, color: C.text },
  taskSub: { marginTop: 2, fontFamily: F.sans, fontSize: 11, color: C.textMuted },
  switch: { width: 48, height: 26, borderRadius: 13, backgroundColor: '#E5E7EB', padding: 3 },
  switchOn: { backgroundColor: ROSE },
  switchKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  switchKnobOn: { transform: [{ translateX: 22 }] },
  dailyPager: { marginHorizontal: -20, marginBottom: 4 },
  dailyPage: { paddingLeft: 20, paddingRight: 0, gap: 7 },
  pageDots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingTop: 12, paddingBottom: 6 },
  pageDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#E7E5E4' },
  bottomQuotes: { gap: 4, marginTop: 6 },
  sheet: { borderTopLeftRadius: 34, borderTopRightRadius: 34, backgroundColor: '#FAFAFA', paddingBottom: 22, maxHeight: '88%', overflow: 'hidden' },
  sheetHandle: { width: 42, height: 4, borderRadius: 999, backgroundColor: '#D6D3D1', alignSelf: 'center', marginTop: 12, marginBottom: 6 },
  sheetHead: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: '#F0EDE6' },
  sheetHeadBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sheetSave: { backgroundColor: ROSE, shadowColor: ROSE, shadowOpacity: 0.25, shadowOffset: { width: 0, height: 7 }, shadowRadius: 12, elevation: 3 },
  sheetKicker: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.9, color: '#FDA4AF', textTransform: 'uppercase' },
  sheetTitle: { fontFamily: F.serifMedium, fontSize: 21, color: C.text, marginTop: 1 },
  sheetContent: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 20, gap: 14 },
  taskPreview: { flexDirection: 'row', gap: 12, borderRadius: 24, borderWidth: 1, borderColor: '#FFE4E6', backgroundColor: '#FFF7F8', padding: 16 },
  taskPreviewIcon: { width: 48, height: 48, borderRadius: 17, backgroundColor: '#FFE4E6', alignItems: 'center', justifyContent: 'center' },
  taskPreviewCopy: { flex: 1, minWidth: 0, paddingTop: 1 },
  taskPreviewKicker: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.9, color: ROSE, textTransform: 'uppercase' },
  taskPreviewTitle: { marginTop: 5, fontFamily: F.serifMedium, fontSize: 20, color: C.text },
  taskPreviewQuote: { marginTop: 10, borderLeftWidth: 2, borderLeftColor: '#FDA4AF', paddingLeft: 10 },
  taskPreviewQuoteText: { fontFamily: F.serifMediumItalic, fontSize: 14, lineHeight: 21, color: '#6F3A44' },
  taskPreviewQuoteAuthor: { marginTop: 7, fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.7, color: ROSE, textTransform: 'uppercase' },
  sheetBlock: { borderRadius: 24, backgroundColor: '#fff', borderWidth: 1, borderColor: '#F1E7EA', padding: 16, gap: 13 },
  sheetLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetLabel: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2, color: ROSE, textTransform: 'uppercase' },
  freqColumn: { gap: 9 },
  freqTouch: { width: '100%' },
  freqCard: { minHeight: 62, borderRadius: 20, borderWidth: 1.5, borderColor: '#F5F5F4', backgroundColor: '#FAFAFA', paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, shadowColor: ROSE, shadowOffset: { width: 0, height: 8 }, shadowRadius: 16, elevation: 2 },
  freqCopy: { flex: 1, minWidth: 0 },
  freqDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  freqDotActive: { borderColor: ROSE, backgroundColor: ROSE },
  freqTitle: { fontFamily: F.sansBold, fontSize: 13.5, color: C.textSecondary },
  freqTitleActive: { color: '#9F1239' },
  freqSub: { fontFamily: F.sans, fontSize: 10.5, color: C.textMuted, marginTop: 3 },
  freqSubActive: { color: ROSE },
  sheetPrimary: { minHeight: 56, borderRadius: 22, backgroundColor: ROSE, alignItems: 'center', justifyContent: 'center', shadowColor: ROSE, shadowOpacity: 0.24, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  sheetPrimaryText: { fontFamily: F.sansBold, fontSize: 12, letterSpacing: 2, color: '#fff' },
});
