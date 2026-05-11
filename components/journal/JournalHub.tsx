import React, { useMemo, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Feather,
  FileEdit,
  Grid3x3,
  Pencil,
} from '@/components/icons/Icons';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import SetAsDailyTaskCard from '@/components/shared/SetAsDailyTaskCard';
import SetAsTaskSheet from '@/components/shared/SetAsTaskSheet';
import { useTasks } from '@/components/tasks/TaskProvider';
import { useJournal, type JournalDotKind } from '@/components/journal/JournalContext';
import { F } from '@/constants/tokens';

const BG = '#FAF7F0';
const GOLD = '#C5A059';
const PURPLE = '#7C6EAF';
const TEAL = '#4A9E8F';
const INK = '#1C1917';
const BORDER = '#EDE5D6';

const FLAME_PNG = require('@/assets/images/streak-flame.png');

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

type JournalKind = JournalDotKind;
type Route = '/journal-daily' | '/journal-morning' | '/journal-free';

type WriteCard = {
  key: JournalKind;
  label: string;
  title: string;
  description: string;
  bg: string;
  border: string;
  labelColor: string;
  titleColor: string;
  bodyColor: string;
  arrowBg: string;
  Decor: React.ComponentType<any>;
  decorColor: string;
  route: Route;
};

const WRITE_CARDS: WriteCard[] = [
  {
    key: 'daily',
    label: 'EVENING REFLECTION',
    title: 'Daily Journal',
    description: 'Capture your day, notice grace, return with a clearer heart.',
    bg: '#FBF3DE',
    border: '#F0E3B8',
    labelColor: '#A9863F',
    titleColor: '#6D4F13',
    bodyColor: '#A9863F',
    arrowBg: '#8A5A1A',
    Decor: Pencil,
    decorColor: '#B45309',
    route: '/journal-daily',
  },
  {
    key: 'morning',
    label: 'CLEAR YOUR MIND',
    title: 'Morning Pages',
    description: 'Three pages of stream-of-thought to start the day untangled.',
    bg: '#EEEAF5',
    border: '#DDD5ED',
    labelColor: '#6D5AAE',
    titleColor: '#3B2F76',
    bodyColor: '#6D5AAE',
    arrowBg: '#2E2478',
    Decor: Feather,
    decorColor: '#6D5AAE',
    route: '/journal-morning',
  },
  {
    key: 'free',
    label: 'OPEN PAGE',
    title: 'Free Writing',
    description: 'Write whatever flows. No prompts, no rules - just the page.',
    bg: '#E1F1EC',
    border: '#C8E6DD',
    labelColor: '#3D8273',
    titleColor: '#1F4E45',
    bodyColor: '#3D8273',
    arrowBg: '#2A6E5F',
    Decor: FileEdit,
    decorColor: '#3D8273',
    route: '/journal-free',
  },
];

const DOT_COLORS: Record<JournalKind, string> = {
  daily: GOLD,
  morning: PURPLE,
  free: TEAL,
};

function localDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dateFromKey(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 12);
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function previousDateKey(key: string) {
  const date = dateFromKey(key);
  date.setDate(date.getDate() - 1);
  return localDateKey(date);
}

function lastSevenDays(todayKey: string) {
  const today = dateFromKey(todayKey);
  const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    return {
      key: localDateKey(date),
      label: labels[date.getDay()],
    };
  });
}

function monthCells(year: number, month: number) {
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i += 1) cells.push(null);
  for (let d = 1; d <= days; d += 1) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function AppText(props: React.ComponentProps<typeof Text>) {
  return <Text {...props} allowFontScaling={false} maxFontSizeMultiplier={1} />;
}

function CalendarStreakCard({
  year,
  month,
  todayKey,
  onPrev,
  onNext,
  canNext,
  selectedDate,
  onSelect,
  dotsByDate,
  completedDates,
  currentStreak,
}: {
  year: number;
  month: number;
  todayKey: string;
  onPrev: () => void;
  onNext: () => void;
  canNext: boolean;
  selectedDate: string;
  onSelect: (key: string) => void;
  dotsByDate: Record<string, JournalKind[]>;
  completedDates: string[];
  currentStreak: number;
}) {
  const cells = useMemo(() => monthCells(year, month), [year, month]);
  const completedSet = useMemo(() => new Set(completedDates), [completedDates]);
  const streakDays = useMemo(() => lastSevenDays(todayKey), [todayKey]);

  return (
    <View style={s.card}>
      <View style={s.monthHead}>
        <TouchableOpacity style={s.monthBtn} activeOpacity={0.75} onPress={onPrev} hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}>
          <ChevronLeft s={20} c={GOLD} />
        </TouchableOpacity>
        <View style={s.monthCenter}>
          <AppText style={s.monthName}>{MONTH_NAMES[month]}</AppText>
          <AppText style={s.monthYear}>{year}</AppText>
        </View>
        <TouchableOpacity
          style={[s.monthBtn, !canNext && s.disabled]}
          activeOpacity={0.75}
          onPress={onNext}
          disabled={!canNext}
          hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
        >
          <ChevronRight s={20} c={GOLD} />
        </TouchableOpacity>
      </View>

      <View style={s.weekRow}>
        {WEEKDAYS.map((w, i) => (
          <View key={`${w}-${i}`} style={s.weekCell}>
            <AppText style={s.weekText}>{w}</AppText>
          </View>
        ))}
      </View>

      <View style={s.calendarGrid}>
        {cells.map((day, index) => {
          if (!day) return <View key={`empty-${index}`} style={s.dateSlot} />;
          const key = dateKey(year, month, day);
          const isToday = key === todayKey;
          const isSelected = key === selectedDate;
          const isFuture = key > todayKey;
          const dots = dotsByDate[key] || [];

          return (
            <View key={key} style={s.dateSlot}>
              <Pressable
                disabled={isFuture}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                style={({ pressed }) => [
                  s.dateShell,
                  isToday && s.dateCellToday,
                  isSelected && s.dateCellSelected,
                  pressed && !isFuture && s.pressed,
                ]}
                onPress={() => onSelect(key)}
              >
                <View style={s.dateNumberLayer} pointerEvents="none">
                  <AppText
                    numberOfLines={1}
                    style={[
                      s.dateText,
                      isToday && s.todayText,
                      isSelected && s.selectedDateText,
                      isFuture && s.futureText,
                    ]}
                  >
                    {day}
                  </AppText>
                </View>
                <View style={s.dateDotsLayer} pointerEvents="none">
                  <View style={s.dots}>
                    {dots.slice(0, 3).map((kind, dotIndex) => (
                      <View key={`${kind}-${dotIndex}`} style={[s.dot, { backgroundColor: DOT_COLORS[kind] }]} />
                    ))}
                  </View>
                </View>
              </Pressable>
            </View>
          );
        })}
      </View>

      <View style={s.legend}>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: GOLD }]} />
          <AppText style={s.legendText}>Daily</AppText>
        </View>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: PURPLE }]} />
          <AppText style={s.legendText}>Morning</AppText>
        </View>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: TEAL }]} />
          <AppText style={s.legendText}>Free</AppText>
        </View>
      </View>

      <View style={s.divider} />

      <View style={s.streakHead}>
        <View style={s.flameBox}>
          <Image source={FLAME_PNG} style={s.flame} resizeMode="contain" />
        </View>
        <AppText style={s.streakNumber}>{currentStreak}</AppText>
        <AppText style={s.streakLabel}>day streak</AppText>
      </View>

      <View style={s.streakRow}>
        {streakDays.map((item) => {
          const active = completedSet.has(item.key);
          return (
          <View key={item.key} style={s.streakDay}>
            <View
              style={[
                s.streakCircle,
                active && s.streakCircleActive,
              ]}
            >
              <Image
                source={FLAME_PNG}
                style={{ width: 17, height: 17, opacity: active ? 0.9 : 0.18 }}
                resizeMode="contain"
              />
            </View>
            <AppText style={[s.streakDayText, active && s.streakDayTextActive]}>{item.label}</AppText>
          </View>
          );
        })}
      </View>
    </View>
  );
}

function DayChoicesPanel({
  date,
  kinds,
  editable,
  onClose,
  onOpen,
}: {
  date: string;
  kinds: JournalKind[];
  editable: boolean;
  onClose: () => void;
  onOpen: (route: Route, readOnly: boolean) => void;
}) {
  const choices = WRITE_CARDS;
  const displayDate = dateFromKey(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  if (!date) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.choiceOverlay} onPress={onClose}>
        <Pressable style={s.choicePanel} onPress={() => {}}>
          <View style={s.choiceHead}>
            <View>
              <AppText style={s.choiceKicker}>{displayDate}</AppText>
              <AppText style={s.choiceTitle}>{editable ? 'Choose Technique' : 'Saved Entries'}</AppText>
              <AppText style={s.choiceDate}>
                {editable ? 'Write or edit today\'s reflection.' : 'Only completed entries can be opened.'}
              </AppText>
            </View>
            <TouchableOpacity onPress={onClose} style={s.choiceClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <AppText style={s.choiceCloseText}>x</AppText>
            </TouchableOpacity>
          </View>
          <View style={s.choiceRow}>
            {choices.map(item => {
              const enabled = editable || kinds.includes(item.key);
              return (
                <Pressable
                  key={item.key}
                  disabled={!enabled}
                  style={({ pressed }) => [
                    s.choiceChip,
                    { backgroundColor: item.bg, borderColor: item.border },
                    !enabled && s.choiceChipDisabled,
                    pressed && enabled && s.pressed,
                  ]}
                  onPress={() => onOpen(item.route, !editable)}
                >
                  <View style={[
                    s.choiceIcon,
                    { backgroundColor: '#FFFFFF', borderColor: item.border },
                    !enabled && s.choiceIconDisabled,
                  ]}>
                    <item.Decor s={18} c={enabled ? item.labelColor : '#BDB7AD'} w={1.8} />
                  </View>
                  <AppText style={[
                    s.choiceChipText,
                    { color: enabled ? item.titleColor : '#BDB7AD' },
                  ]}>
                    {item.title}
                  </AppText>
                  <AppText style={[
                    s.choiceChipHint,
                    { color: enabled ? item.labelColor : '#C6C0B7' },
                  ]}>
                    {enabled ? (editable ? 'Open' : 'Saved') : 'Empty'}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function WriteSectionCard({ card, onPress }: { card: WriteCard; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[s.writeCard, { backgroundColor: card.bg, borderColor: card.border }]}
    >
      <LinearGradient
        colors={[card.bg, '#FFFFFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={s.writeWatermark} pointerEvents="none">
        <card.Decor s={110} c={card.decorColor} w={1} />
      </View>

      <View style={[s.writeArrow, { backgroundColor: card.arrowBg }]} pointerEvents="none">
        <View style={s.writeArrowRotated}>
          <ArrowUpRight s={16} c="#fff" w={2.5} />
        </View>
      </View>

      <View style={s.writeContent}>
        <AppText style={[s.writeLabel, { color: card.labelColor }]}>{card.label}</AppText>
        <AppText style={[s.writeTitle, { color: card.titleColor }]}>{card.title}</AppText>
        <AppText style={[s.writeDesc, { color: card.bodyColor }]}>{card.description}</AppText>
      </View>
    </TouchableOpacity>
  );
}

function YearInPixelsSection({
  onPress,
  entryCount,
}: {
  onPress: () => void;
  entryCount: number;
}) {
  return (
    <View style={s.toolsWrap}>
      <View style={s.sectionHead}>
        <AppText style={s.sectionTitle}>YEAR IN PIXELS</AppText>
        <AppText style={s.sectionHint}>Reflect gently</AppText>
      </View>
      <TouchableOpacity activeOpacity={0.84} onPress={onPress} style={s.yearPixelCard}>
        <View style={s.yearPixelIcon}>
          <Grid3x3 s={23} c={PURPLE} />
        </View>
        <View style={s.yearPixelCopy}>
          <AppText style={s.yearPixelTitle}>Year in Pixels</AppText>
          <AppText style={s.yearPixelSub}>
            {entryCount === 0 ? 'No entries yet' : `${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}`}
          </AppText>
        </View>
        <ChevronRight s={20} c="#A8A29E" />
      </TouchableOpacity>
    </View>
  );
}

export default function JournalHub() {
  const router = useRouter();
  const { createOrUpdateTask, refresh: refreshTasks } = useTasks();
  const { dotsByDate, streak, entries } = useJournal();
  const today = useMemo(() => new Date(), []);
  const todayKey = localDateKey(today);
  const yesterdayKey = useMemo(() => previousDateKey(todayKey), [todayKey]);
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskSummary, setTaskSummary] = useState('Add to your daily routine');
  const [chosenDate, setChosenDate] = useState('');
  const chosenKinds = chosenDate ? dotsByDate[chosenDate] ?? [] : [];
  const chosenDateEditable = chosenDate === todayKey || chosenDate === yesterdayKey;
  const canNext = year < today.getFullYear() || (year === today.getFullYear() && month < today.getMonth());

  const nav = (route?: string, date?: string, readOnly = false) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!route) return;
    if (date) {
      router.push({ pathname: route as any, params: { date, ...(readOnly ? { readOnly: '1' } : {}) } });
      return;
    }
    router.push(route as any);
  };

  const prevMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (month === 0) {
      setMonth(11);
      setYear(v => v - 1);
    } else {
      setMonth(v => v - 1);
    }
  };

  const nextMonth = () => {
    if (!canNext) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (month === 11) {
      setMonth(0);
      setYear(v => v + 1);
    } else {
      setMonth(v => v + 1);
    }
  };

  const selectDate = (key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const dots = dotsByDate[key] || [];
    const isEditableDate = key === todayKey || key === yesterdayKey;

    if (isEditableDate || dots.length > 0) {
      setChosenDate(key);
      return;
    }

    setChosenDate('');
  };

  return (
    <View style={s.screen}>
      <ScreenTitleBar title="JOURNAL" showBack bg={BG} />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
      >
        <View style={s.body}>
          <CalendarStreakCard
            year={year}
            month={month}
            todayKey={todayKey}
            onPrev={prevMonth}
            onNext={nextMonth}
            canNext={canNext}
            selectedDate={chosenDate}
            onSelect={selectDate}
            dotsByDate={dotsByDate}
            completedDates={streak.completedDates}
            currentStreak={streak.currentStreak}
          />

          <DayChoicesPanel
            date={chosenDate}
            kinds={chosenKinds}
            editable={chosenDateEditable}
            onClose={() => setChosenDate('')}
            onOpen={(route, readOnly) => nav(route, chosenDate, readOnly)}
          />

          <View style={s.writeStack}>
            {WRITE_CARDS.map(card => (
              <WriteSectionCard key={card.key} card={card} onPress={() => nav(card.route, todayKey)} />
            ))}
          </View>

          <View style={s.taskCardWrap}>
            <SetAsDailyTaskCard
              variant="soft"
              subtitle={taskSummary}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setTaskOpen(true);
              }}
              textMaxFontSizeMultiplier={1}
            />
          </View>

          <YearInPixelsSection
            entryCount={entries.length}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              router.push('/year-in-pixels');
            }}
          />
        </View>
      </ScrollView>

      <SetAsTaskSheet
        visible={taskOpen}
        context="journal"
        onClose={() => setTaskOpen(false)}
        onSummaryChange={setTaskSummary}
        onTaskDraft={createOrUpdateTask}
        onTaskMutation={refreshTasks}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 140 },
  body: { width: '100%', paddingHorizontal: 16, paddingTop: 6, alignItems: 'stretch' },

  card: {
    width: '100%',
    alignSelf: 'stretch',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 18,
    shadowColor: '#8C7A4F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  monthHead: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFBF2',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.32 },
  monthCenter: { alignItems: 'center', justifyContent: 'center' },
  monthName: { fontFamily: F.serifSemiBold, fontSize: 23, lineHeight: 27, color: INK },
  monthYear: { marginTop: 1, fontFamily: F.sansBold, fontSize: 10, lineHeight: 12, letterSpacing: 2.4, color: GOLD },
  weekRow: { width: '100%', alignSelf: 'stretch', marginTop: 14, flexDirection: 'row' },
  weekCell: { flex: 1, height: 20, alignItems: 'center', justifyContent: 'center' },
  weekText: { fontFamily: F.sansBold, fontSize: 10, lineHeight: 12, letterSpacing: 1.2, color: '#A5A09A' },
  calendarGrid: {
    width: '100%',
    alignSelf: 'stretch',
    marginTop: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dateSlot: {
    width: `${100 / 7}%`,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateShell: {
    width: 48,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ECE2D1',
    backgroundColor: '#FFFDF8',
    position: 'relative',
    alignItems: 'center',
  },
  dateCellToday: { backgroundColor: '#FFF8E7', borderColor: GOLD, borderWidth: 1.4 },
  dateCellSelected: { backgroundColor: '#FFF2D8', borderColor: GOLD, borderWidth: 1.6 },
  dateNumberLayer: {
    width: '100%',
    height: 25,
    marginTop: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDotsLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 34,
    height: 8,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    elevation: 2,
  },
  dateText: {
    fontFamily: F.serifMedium,
    fontSize: 17,
    lineHeight: 21,
    color: INK,
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  todayText: { fontFamily: F.serifSemiBold, color: GOLD },
  selectedDateText: { fontFamily: F.serifSemiBold, color: '#9A6B1E' },
  futureText: { color: '#D7D1C8' },
  pressed: { opacity: 0.76, transform: [{ scale: 0.985 }] },
  dots: {
    width: '100%',
    height: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 4.6, height: 4.6, borderRadius: 3, marginHorizontal: 1.2 },

  legend: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F2EDE4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 16,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', columnGap: 6 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { fontFamily: F.sansMedium, fontSize: 11, lineHeight: 13, color: '#918A80' },

  divider: { height: 1, marginTop: 14, marginBottom: 14, backgroundColor: '#F2EDE4' },

  streakHead: { flexDirection: 'row', alignItems: 'center' },
  flameBox: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF3D3', alignItems: 'center', justifyContent: 'center' },
  flame: { width: 20, height: 20 },
  streakNumber: { marginLeft: 11, fontFamily: F.serifSemiBold, fontSize: 28, lineHeight: 31, color: GOLD },
  streakLabel: { marginLeft: 7, fontFamily: F.serifMediumItalic, fontSize: 16, lineHeight: 20, color: '#B29A67' },
  streakRow: { marginTop: 12, flexDirection: 'row' },
  streakDay: { flex: 1, alignItems: 'center' },
  streakCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: 'rgba(197,160,89,0.18)',
    backgroundColor: 'rgba(197,160,89,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakCircleActive: { borderColor: GOLD, backgroundColor: '#FFFFFF' },
  streakDayText: { marginTop: 5, fontFamily: F.sansBold, fontSize: 10, lineHeight: 12, color: '#C4BAA8' },
  streakDayTextActive: { color: GOLD },

  choiceOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(28, 25, 23, 0.34)',
    paddingHorizontal: 22,
  },
  choicePanel: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#EFE3CF',
    backgroundColor: '#FFFFFF',
    padding: 18,
    paddingTop: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 12,
  },
  choiceHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  choiceKicker: {
    fontFamily: F.sansBold,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 1.8,
    color: GOLD,
    textTransform: 'uppercase',
  },
  choiceTitle: { marginTop: 2, fontFamily: F.serifSemiBold, fontSize: 23, lineHeight: 28, color: INK },
  choiceDate: { marginTop: 3, fontFamily: F.serifItalic, fontSize: 13, lineHeight: 17, color: '#A29A91' },
  choiceClose: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F6F4F0', alignItems: 'center', justifyContent: 'center' },
  choiceCloseText: { fontFamily: F.serifMedium, fontSize: 24, lineHeight: 28, color: '#A8A29E' },
  choiceRow: { rowGap: 10, marginTop: 18 },
  choiceChip: {
    width: '100%',
    minHeight: 68,
    borderRadius: 19,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 11,
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  choiceChipDisabled: { backgroundColor: '#F3F0EA', borderColor: '#E6E0D6', opacity: 0.62 },
  choiceIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  choiceIconDisabled: { backgroundColor: '#F7F4EE', borderColor: '#E2DCD2' },
  choiceChipText: {
    flex: 1,
    fontFamily: F.serifMedium,
    fontSize: 17,
    lineHeight: 21,
    textAlign: 'left',
  },
  choiceChipHint: {
    marginLeft: 10,
    fontFamily: F.sansBold,
    fontSize: 9.5,
    lineHeight: 12,
    letterSpacing: 1.1,
    textAlign: 'right',
    textTransform: 'uppercase',
  },

  writeStack: { width: '100%', alignSelf: 'stretch', marginTop: 14, rowGap: 12 },
  writeCard: {
    position: 'relative',
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  writeWatermark: {
    position: 'absolute',
    bottom: -8,
    right: 14,
    width: 110,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.12,
  },
  writeArrow: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 5,
  },
  writeArrowRotated: { transform: [{ rotate: '-15deg' }] },
  writeContent: { padding: 18, paddingRight: 70, maxWidth: '88%' },
  writeLabel: {
    fontFamily: F.sansBold,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 2.2,
    marginBottom: 6,
  },
  writeTitle: {
    fontFamily: F.serifMedium,
    fontSize: 24,
    lineHeight: 28,
    marginBottom: 6,
  },
  writeDesc: {
    fontFamily: F.serif,
    fontSize: 14,
    lineHeight: 19,
  },

  taskCardWrap: { width: '100%', alignSelf: 'stretch', marginTop: 14 },

  toolsWrap: { width: '100%', alignSelf: 'stretch', marginTop: 18 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionTitle: { fontFamily: F.sansBold, fontSize: 10, lineHeight: 13, letterSpacing: 2.3, color: GOLD },
  sectionHint: { fontFamily: F.serifMediumItalic, fontSize: 14, lineHeight: 18, color: '#A7A098' },
  yearPixelCard: {
    width: '100%',
    minHeight: 92,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E9DEC9',
    backgroundColor: '#FFFDF8',
    paddingHorizontal: 15,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 7,
    elevation: 1,
  },
  yearPixelIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#EEEAF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearPixelCopy: { flex: 1, minWidth: 0 },
  yearPixelTitle: { fontFamily: F.serifMedium, fontSize: 18, lineHeight: 22, color: INK },
  yearPixelSub: { marginTop: 4, fontFamily: F.sans, fontSize: 12, lineHeight: 15, color: '#999287' },
});
