import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft, CalendarCheck, CheckSmall, ChevronDown, ChevronUp,
  Heart, Pencil, Plus, RotateCcw, Trash2, X,
} from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import { getTitleBarTopPadding, TITLE_BAR_BOTTOM_PADDING } from '@/components/shared/titleBar';
import { RichTextEditor, RichToolbar, RichTextEditorRef, FormatState } from '@/components/shared/RichTextEditor';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import ConfirmModal from '@/components/shared/ConfirmModal';
import TaskTimeEditor from '@/components/shared/TaskTimeEditor';
import { useTasks } from '@/components/tasks/TaskProvider';
import type { TaskDraft } from '@/components/tasks/taskTypes';
import { GratitudeEntry, GratitudeKind, useInnerTools } from './InnerToolsContext';

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
  const progress = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: active ? 1 : 0,
      friction: 15,
      tension: 145,
      useNativeDriver: false,
    }).start();
  }, [active, progress]);

  return progress;
}

export default function GratitudeView() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { createOrUpdateTask, remove: removeTask } = useTasks();
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [taskSheet, setTaskSheet] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [confirmDisableTask, setConfirmDisableTask] = useState(false);

  const lifeEntries = useMemo(() => gratitudeEntries.filter(entry => entry.kind === 'life').sort((a, b) => b.createdAt - a.createdAt), [gratitudeEntries]);
  const dailyEntries = useMemo(() => gratitudeEntries.filter(entry => entry.kind === 'daily').sort((a, b) => b.createdAt - a.createdAt), [gratitudeEntries]);

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

  const saveEntry = () => {
    const cleanTitle = title.trim();
    const cleanContent = content.trim();
    if (!cleanTitle && !cleanContent) return;

    upsertGratitudeEntry({
      id: editing?.id ?? newId('gratitude'),
      kind: formKind ?? 'life',
      title: cleanTitle || cleanContent,
      content: cleanContent,
      date: editing?.date ?? new Date().toISOString().split('T')[0],
      createdAt: editing?.createdAt ?? Date.now(),
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    closeForm();
  };

  return (
    <View style={s.screen}>
      <Header top={insets.top} onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
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
        {formKind === 'life' && (
          <GratitudeForm
            editorKey={`life-${editing?.id ?? 'new'}`}
            color="amber"
            title={title}
            content={content}
            isEditing={!!editing}
            placeholder="I'm always grateful for..."
            onTitle={setTitle}
            onContent={setContent}
            onCancel={closeForm}
            onSave={saveEntry}
          />
        )}
        {lifeEntries.length === 0 && formKind !== 'life' ? (
          <EmptyHint color="amber" text="What are you always grateful for?" />
        ) : (
          <View style={s.lifeList}>
            {lifeEntries.map(entry => (
              <GratitudeCard
                key={entry.id}
                entry={entry}
                color="amber"
                expanded={expandedId === entry.id}
                showDate={false}
                onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                onEdit={() => openEdit(entry)}
                onDelete={() => setDeleteTarget(entry.id)}
              />
            ))}
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
        {formKind === 'daily' && (
          <GratitudeForm
            editorKey={`daily-${editing?.id ?? 'new'}`}
            color="rose"
            title={title}
            content={content}
            isEditing={!!editing}
            placeholder="Today I'm grateful for..."
            onTitle={setTitle}
            onContent={setContent}
            onCancel={closeForm}
            onSave={saveEntry}
          />
        )}
        {dailyEntries.length === 0 && formKind !== 'daily' ? (
          <EmptyHint color="rose" text="What are you thankful for today?" />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dailyCarousel}>
            {dailyEntries.map(entry => (
              <View key={entry.id} style={s.dailySlide}>
                <GratitudeCard
                  entry={entry}
                  color="rose"
                  expanded={expandedId === entry.id}
                  showDate
                  onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  onEdit={() => openEdit(entry)}
                  onDelete={() => setDeleteTarget(entry.id)}
                />
              </View>
            ))}
          </ScrollView>
        )}

        <View style={s.bottomQuotes}>
          <WisdomCard quote={WISDOM_QUOTES[3]} />
        </View>
      </ScrollView>

      <ConfirmModal
        visible={!!deleteTarget}
        icon={<Trash2 s={22} c="#EF4444" />}
        iconBg="#FEF2F2"
        title="Delete entry?"
        body="This gratitude entry will be permanently removed."
        cancelLabel="KEEP"
        confirmLabel="DELETE"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteGratitudeEntry(deleteTarget);
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
          void removeTask(GRATITUDE_TASK_ID);
          setGratitudeTaskEnabled(false);
          setConfirmDisableTask(false);
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
          setTaskSheet(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}
      />
    </View>
  );
}

function Header({ top, onBack }: { top: number; onBack: () => void }) {
  return (
    <View style={[s.header, { paddingTop: getTitleBarTopPadding(top) }]}>
      <TouchableOpacity onPress={onBack} style={s.headerBtn} activeOpacity={0.7}>
        <ArrowLeft s={24} c={C.textMuted} />
      </TouchableOpacity>
      <Text style={s.headerTitle}>GRATITUDE</Text>
      <View style={s.headerBtn} />
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

function GratitudeForm({
  editorKey, color, title, content, isEditing, placeholder, onTitle, onContent, onCancel, onSave,
}: {
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
  const editorRef = useRef<RichTextEditorRef>(null);
  const [fmt, setFmt] = useState<FormatState>({ bold: false, italic: false, underline: false });
  const [titleHeight, setTitleHeight] = useState(44);
  const bg = color === 'amber' ? '#FFFBEB' : '#FFF1F2';
  const editorBg = color === 'amber' ? '#FFFDF8' : '#FFF8F8';

  return (
    <View style={[s.formFrame, { borderColor: accent, backgroundColor: bg }]}>
      <View style={s.formInner}>
        <Text style={[s.formKicker, { color: accent }]}>{isEditing ? 'Edit Entry' : 'New Entry'}</Text>
        <TextInput
          value={title}
          onChangeText={onTitle}
          placeholder={placeholder}
          placeholderTextColor={color === 'amber' ? '#E1C780' : '#FDA4AF'}
          multiline
          scrollEnabled={false}
          textAlignVertical="top"
          onContentSizeChange={e => setTitleHeight(Math.max(44, e.nativeEvent.contentSize.height))}
          style={[s.formInput, { backgroundColor: bg, height: titleHeight }]}
        />
        <RichToolbar editorRef={editorRef} activeFormats={fmt} style={s.formToolbar} />
        <RichTextEditor
          key={editorKey}
          ref={editorRef}
          initialHTML={content}
          onChange={onContent}
          onFormatChange={setFmt}
          placeholder="Add more detail... (optional)"
          backgroundColor={editorBg}
          color="#3D3229"
          style={s.formEditor}
        />
        <View style={s.formActions}>
          <TouchableOpacity onPress={onCancel} style={s.cancelBtn} activeOpacity={0.8}>
            <Text style={s.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onSave} style={[s.saveBtn, { backgroundColor: color === 'amber' ? '#78350F' : ROSE }]} activeOpacity={0.88}>
            <Text style={s.saveText}>{isEditing ? 'Save Changes' : 'Save'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
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
  entry, color, expanded, showDate, onToggle, onEdit, onDelete,
}: {
  entry: GratitudeEntry;
  color: 'amber' | 'rose';
  expanded: boolean;
  showDate: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isAmber = color === 'amber';
  const accent = isAmber ? GOLD : ROSE;
  const plainContent = stripHtml(entry.content);
  const long = plainContent.length > 110 || plainContent.split('\n').length > 3;
  return (
    <View style={[s.gCard, isAmber ? s.gAmber : s.gRose]}>
      <View style={[s.gAccent, { backgroundColor: accent }]} />
      <View style={s.gContent}>
        <View style={s.gTop}>
          <View style={{ flex: 1 }}>
            {showDate && <Text style={s.gDate}>{new Date(entry.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>}
            <Text style={s.gTitle}>{entry.title}</Text>
          </View>
          <View style={s.gActions}>
            <TouchableOpacity onPress={onEdit} style={s.gActionBtn} activeOpacity={0.7}>
              <Pencil s={13} c="#A8A29E" />
            </TouchableOpacity>
            <TouchableOpacity onPress={onDelete} style={s.gActionBtn} activeOpacity={0.7}>
              <Trash2 s={13} c="#F87171" />
            </TouchableOpacity>
          </View>
        </View>
        {!!plainContent && (
          <Text style={s.gText} numberOfLines={expanded ? undefined : 3}>{plainContent}</Text>
        )}
        {long && (
          <TouchableOpacity onPress={onToggle} style={s.moreBtn} activeOpacity={0.7}>
            {expanded ? <ChevronUp s={12} c={accent} /> : <ChevronDown s={12} c={accent} />}
            <Text style={[s.moreText, { color: accent }]}>{expanded ? 'less' : 'more'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
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
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] });
  const backgroundColor = progress.interpolate({ inputRange: [0, 1], outputRange: ['#FFFFFF', '#FFF1F2'] });
  const borderColor = progress.interpolate({ inputRange: [0, 1], outputRange: ['#F1E7EA', '#F43F5E'] });
  const shadowOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0.02, 0.16] });
  const dotScale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={s.freqTouch}>
      <Animated.View style={[s.freqCard, { backgroundColor, borderColor, shadowOpacity, transform: [{ scale }] }]}>
        <View style={s.freqCopy}>
          <Text style={[s.freqTitle, active && s.freqTitleActive]}>{option.label}</Text>
          <Text style={[s.freqSub, active && s.freqSubActive]}>{option.sub}</Text>
        </View>
        <View style={[s.freqDot, active && s.freqDotActive]}>
          <Animated.View style={{ opacity: progress, transform: [{ scale: dotScale }] }}>
            <CheckSmall s={9} c="#fff" />
          </Animated.View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: TITLE_BAR_BOTTOM_PADDING, backgroundColor: 'rgba(255,255,255,0.96)', borderBottomWidth: 1, borderBottomColor: '#F5F5F4' },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: F.serifMedium, fontSize: 20, letterSpacing: 2.8, color: C.text },
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
  lifeList: { gap: 11, marginBottom: 18 },
  formFrame: { borderWidth: 2, borderRadius: 24, padding: 2, marginBottom: 12 },
  formInner: { borderRadius: 22, backgroundColor: '#fff', padding: 15, gap: 11 },
  formKicker: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 2, textTransform: 'uppercase' },
  formInput: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontFamily: F.serif, fontSize: 16, color: C.text },
  formToolbar: { marginTop: 2, marginBottom: 6 },
  formEditor: { height: 180, borderRadius: 10, overflow: 'hidden' },
  formActions: { flexDirection: 'row', gap: 9 },
  cancelBtn: { flex: 1, borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', paddingVertical: 12, alignItems: 'center' },
  cancelText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 1.7, color: C.textSecondary, textTransform: 'uppercase' },
  saveBtn: { flex: 2, borderRadius: 16, paddingVertical: 12, alignItems: 'center' },
  saveText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 1.7, color: '#fff', textTransform: 'uppercase' },
  gCard: { borderRadius: 20, borderWidth: 1, overflow: 'hidden', flexDirection: 'row' },
  gAmber: { backgroundColor: '#FFFEF9', borderColor: 'rgba(197,160,89,0.20)' },
  gRose: { backgroundColor: '#fff', borderColor: 'rgba(244,63,94,0.14)' },
  gAccent: { width: 4 },
  gContent: { flex: 1, padding: 15 },
  gTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  gDate: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 2, color: 'rgba(244,63,94,0.60)', textTransform: 'uppercase', marginBottom: 4 },
  gTitle: { fontFamily: F.serifMedium, fontSize: 17, lineHeight: 22, color: C.text },
  gActions: { flexDirection: 'row', alignItems: 'center' },
  gActionBtn: { padding: 7 },
  gText: { marginTop: 8, fontFamily: F.sans, fontSize: 13, lineHeight: 20, color: C.textMuted },
  moreBtn: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 3 },
  moreText: { fontFamily: F.sansSemiBold, fontSize: 11 },
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
  dailyCarousel: { gap: 12, paddingBottom: 14 },
  dailySlide: { width: 292 },
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
