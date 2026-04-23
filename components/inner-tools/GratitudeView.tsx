import React, { useMemo, useState } from 'react';
import {
  Modal, Pressable, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft, CalendarCheck, CheckSmall, ChevronDown, ChevronUp,
  Heart, Pencil, Plus, Trash2, X,
} from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import { getTitleBarTopPadding, TITLE_BAR_BOTTOM_PADDING } from '@/components/shared/titleBar';
import { TextFormatToolbar, TextSelection } from '@/components/shared/TextFormatToolbar';
import { LinedTextInput } from '@/components/shared/LinedTextInput';
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

const TIME_PRESETS = [
  { label: 'Morning', sub: 'Start the day', value: '07:00' },
  { label: 'Midday', sub: 'Lunch break', value: '12:00' },
  { label: 'Evening', sub: 'Wind down', value: '20:00' },
];

function newId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export default function GratitudeView() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    gratitudeEntries, upsertGratitudeEntry, deleteGratitudeEntry,
    gratitudeTaskEnabled, setGratitudeTaskEnabled,
    gratitudeTaskTime, setGratitudeTaskTime,
    gratitudeTaskFrequency, setGratitudeTaskFrequency,
  } = useInnerTools();

  const [formKind, setFormKind] = useState<GratitudeKind | null>(null);
  const [editing, setEditing] = useState<GratitudeEntry | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [taskSheet, setTaskSheet] = useState(false);

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
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 120 }]} showsVerticalScrollIndicator={false}>
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
                onDelete={() => deleteGratitudeEntry(entry.id)}
              />
            ))}
          </View>
        )}

        <TaskToggleCard
          enabled={gratitudeTaskEnabled}
          time={gratitudeTaskTime}
          frequency={gratitudeTaskFrequency}
          onOpen={() => setTaskSheet(true)}
          onToggle={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (gratitudeTaskEnabled) setGratitudeTaskEnabled(false);
            else setTaskSheet(true);
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
                  onDelete={() => deleteGratitudeEntry(entry.id)}
                />
              </View>
            ))}
          </ScrollView>
        )}

        <View style={s.bottomQuotes}>
          <WisdomCard quote={WISDOM_QUOTES[2]} />
          <WisdomCard quote={WISDOM_QUOTES[3]} />
        </View>
      </ScrollView>

      <TaskSheet
        visible={taskSheet}
        time={gratitudeTaskTime}
        frequency={gratitudeTaskFrequency}
        onTime={setGratitudeTaskTime}
        onFrequency={setGratitudeTaskFrequency}
        onClose={() => setTaskSheet(false)}
        onSave={() => {
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
  color, title, content, isEditing, placeholder, onTitle, onContent, onCancel, onSave,
}: {
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
  const [contentSelection, setContentSelection] = useState<TextSelection>({ start: 0, end: 0 });

  return (
    <View style={[s.formFrame, { borderColor: accent, backgroundColor: color === 'amber' ? '#FFFBEB' : '#FFF1F2' }]}>
      <View style={s.formInner}>
        <Text style={[s.formKicker, { color: accent }]}>{isEditing ? 'Edit Entry' : 'New Entry'}</Text>
        <TextInput
          value={title}
          onChangeText={onTitle}
          placeholder={placeholder}
          placeholderTextColor={color === 'amber' ? '#E1C780' : '#FDA4AF'}
          style={[s.formInput, { backgroundColor: color === 'amber' ? '#FFFBEB' : '#FFF1F2' }]}
        />
        <TextFormatToolbar
          value={content}
          selection={contentSelection}
          onChangeText={onContent}
          onSelectionChange={setContentSelection}
          style={s.formToolbar}
        />
        <LinedTextInput
          value={content}
          onChangeText={onContent}
          selection={contentSelection}
          onSelectionChange={setContentSelection}
          placeholder="Add more detail... (optional)"
          placeholderTextColor={color === 'amber' ? '#E1C780' : '#FDA4AF'}
          minLines={3}
          lineHeight={23}
          wrapStyle={s.formAreaWrap}
          inputStyle={[s.formInput, s.formArea]}
          lineColor={color === 'amber' ? 'rgba(197,160,89,0.14)' : 'rgba(244,63,94,0.12)'}
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
  const long = entry.content.length > 110 || entry.content.split('\n').length > 3;
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
        {!!entry.content && (
          <Text style={s.gText} numberOfLines={expanded ? undefined : 3}>{entry.content}</Text>
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
  enabled, time, frequency, onOpen, onToggle,
}: {
  enabled: boolean;
  time: string;
  frequency: 'daily' | 'weekdays';
  onOpen: () => void;
  onToggle: () => void;
}) {
  return (
    <View style={[s.taskCard, enabled && s.taskCardEnabled]}>
      <TouchableOpacity onPress={enabled ? onOpen : onToggle} style={s.taskMain} activeOpacity={0.82}>
        <View style={[s.taskIcon, enabled && s.taskIconEnabled]}>
          <CalendarCheck s={18} c={enabled ? '#fff' : ROSE} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.taskTitle}>Set as Daily Task</Text>
          <Text style={[s.taskSub, enabled && { color: ROSE }]}>{enabled ? `${frequency === 'weekdays' ? 'Mon - Fri' : 'Every day'} · ${time}` : 'Add gratitude to your daily routine'}</Text>
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
      <Text style={[s.wisdomText, compact && s.wisdomTextCompact]}>{`"${quote.text}"`}</Text>
      <Text style={s.wisdomAuthor}>- {quote.author}</Text>
    </View>
  );
}

function TaskSheet({
  visible, time, frequency, onTime, onFrequency, onClose, onSave,
}: {
  visible: boolean;
  time: string;
  frequency: 'daily' | 'weekdays';
  onTime: (time: string) => void;
  onFrequency: (freq: 'daily' | 'weekdays') => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.sheetOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.sheetHandle} />
          <View style={s.sheetHead}>
            <TouchableOpacity onPress={onClose} style={s.sheetHeadBtn} activeOpacity={0.7}>
              <X s={22} c="#A8A29E" />
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <Text style={s.sheetKicker}>Daily Task</Text>
              <Text style={s.sheetTitle}>Daily Gratitude</Text>
            </View>
            <TouchableOpacity onPress={onSave} style={[s.sheetHeadBtn, s.sheetSave]} activeOpacity={0.85}>
              <CheckSmall s={20} c="#fff" />
            </TouchableOpacity>
          </View>

          <View style={s.sheetBlock}>
            <Text style={s.sheetLabel}>FREQUENCY</Text>
            <View style={s.freqRow}>
              {([
                { label: 'Every Day', sub: '7 days a week', value: 'daily' as const },
                { label: 'Weekdays', sub: 'Mon - Fri', value: 'weekdays' as const },
              ]).map(option => {
                const active = frequency === option.value;
                return (
                  <TouchableOpacity key={option.value} onPress={() => onFrequency(option.value)} style={[s.freqCard, active && s.freqActive]} activeOpacity={0.85}>
                    <View style={[s.freqDot, active && s.freqDotActive]}>
                      {active && <CheckSmall s={9} c="#fff" />}
                    </View>
                    <Text style={[s.freqTitle, active && s.freqTitleActive]}>{option.label}</Text>
                    <Text style={[s.freqSub, active && s.freqSubActive]}>{option.sub}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={s.sheetBlock}>
            <Text style={s.sheetLabel}>TIME</Text>
            <View style={s.presetRow}>
              {TIME_PRESETS.map(preset => {
                const active = time === preset.value;
                return (
                  <TouchableOpacity key={preset.value} onPress={() => onTime(preset.value)} style={[s.timePreset, active && s.timePresetActive]} activeOpacity={0.85}>
                    <Text style={[s.timePresetTitle, active && s.timeActiveText]}>{preset.label}</Text>
                    <Text style={[s.timePresetSub, active && s.timeActiveSub]}>{preset.value}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TextInput value={time} onChangeText={onTime} style={s.timeInput} keyboardType="numbers-and-punctuation" />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: TITLE_BAR_BOTTOM_PADDING, backgroundColor: 'rgba(255,255,255,0.96)', borderBottomWidth: 1, borderBottomColor: '#F5F5F4' },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: F.serifMedium, fontSize: 25, letterSpacing: 3.4, color: C.text },
  content: { paddingHorizontal: 20 },
  scripture: { alignItems: 'center', paddingTop: 18, paddingBottom: 10, paddingHorizontal: 12 },
  scriptureText: { fontFamily: F.serifMediumItalic, fontSize: 15, lineHeight: 22, color: C.textMuted, textAlign: 'center' },
  scriptureRef: { marginTop: 6, fontFamily: F.sansBold, fontSize: 9, letterSpacing: 2.2, color: GOLD },
  wisdom: { borderRadius: 22, backgroundColor: '#1C1917', paddingHorizontal: 20, paddingVertical: 17, marginVertical: 8 },
  wisdomCompact: { paddingHorizontal: 16, paddingVertical: 13, marginVertical: 8 },
  wisdomText: { fontFamily: F.serifItalic, fontSize: 15, lineHeight: 23, color: '#D6D3D1' },
  wisdomTextCompact: { fontSize: 13, lineHeight: 20 },
  wisdomAuthor: { marginTop: 8, fontFamily: F.sansBold, fontSize: 9, letterSpacing: 2, color: GOLD, textTransform: 'uppercase' },
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
  formToolbar: { marginTop: 2 },
  formAreaWrap: { paddingHorizontal: 14 },
  formArea: { lineHeight: 23, paddingHorizontal: 0, paddingVertical: 0 },
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
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.36)' },
  sheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, backgroundColor: '#FAFAFA', paddingBottom: 28, maxHeight: '86%' },
  sheetHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F4' },
  sheetHeadBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sheetSave: { backgroundColor: ROSE },
  sheetKicker: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 2, color: C.textMuted, textTransform: 'uppercase' },
  sheetTitle: { fontFamily: F.serifMedium, fontSize: 19, color: C.text, marginTop: 2 },
  sheetBlock: { marginHorizontal: 22, marginTop: 18, borderRadius: 22, backgroundColor: '#fff', borderWidth: 1, borderColor: '#F5F5F4', padding: 18 },
  sheetLabel: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2, color: ROSE, textTransform: 'uppercase', marginBottom: 14 },
  freqRow: { flexDirection: 'row', gap: 12 },
  freqCard: { flex: 1, borderRadius: 18, borderWidth: 2, borderColor: '#F5F5F4', backgroundColor: '#FAFAFA', paddingVertical: 15, paddingHorizontal: 10, alignItems: 'center' },
  freqActive: { borderColor: ROSE, backgroundColor: '#FFF1F2' },
  freqDot: { width: 17, height: 17, borderRadius: 9, borderWidth: 2, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  freqDotActive: { borderColor: ROSE, backgroundColor: ROSE },
  freqTitle: { fontFamily: F.sansBold, fontSize: 13, color: C.textSecondary },
  freqTitleActive: { color: '#9F1239' },
  freqSub: { fontFamily: F.sans, fontSize: 10, color: C.textMuted, marginTop: 3 },
  freqSubActive: { color: ROSE },
  presetRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  timePreset: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: '#F5F5F4', backgroundColor: '#FAFAFA', alignItems: 'center', paddingVertical: 12 },
  timePresetActive: { borderColor: '#FDA4AF', backgroundColor: '#FFF1F2' },
  timePresetTitle: { fontFamily: F.sansBold, fontSize: 11, color: C.textSecondary },
  timePresetSub: { fontFamily: F.sans, fontSize: 10, color: C.textMuted, marginTop: 3 },
  timeActiveText: { color: '#9F1239' },
  timeActiveSub: { color: ROSE },
  timeInput: { borderRadius: 16, borderWidth: 1, borderColor: '#FFE4E6', backgroundColor: '#FFF1F2', color: ROSE, textAlign: 'center', fontFamily: F.serifMedium, fontSize: 32, paddingVertical: 12 },
});
