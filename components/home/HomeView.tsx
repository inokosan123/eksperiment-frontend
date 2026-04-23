import React, { useMemo } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Book,
  Calendar,
  CheckSmall,
  ChevronLeft,
  ChevronRight,
  CircleIcon,
  Clock,
  Heart,
  Plus,
  Settings,
} from '@/components/icons/Icons';
import DateStrip from './DateStrip';
import WeeklyRhythm from './WeeklyRhythm';
import ChallengesSection, { ACTIVE_CHALLENGES } from './ChallengesSection';
import ExploreSection from './ExploreSection';
import { C, F } from '@/constants/tokens';
import { AnyTaskCard, TaskData, TaskState } from '@/components/shared/TaskCards';
import { useReadingList } from '@/components/library/ReadingListContext';
import { useInnerTools } from '@/components/inner-tools/InnerToolsContext';
import { HabitItem, INITIAL_HABITS } from '@/components/habits/habitData';

type HomeCard = {
  id: string;
  task: TaskData;
  streak?: number;
  route?: '/prayer' | '/habits' | '/reading-list' | '/gratitude';
};

function isScheduledToday(
  frequency?: 'daily' | 'weekdays' | 'weekends' | 'specific_days',
  selectedDays?: number[],
) {
  const day = new Date().getDay();

  switch (frequency) {
    case 'weekdays':
      return day >= 1 && day <= 5;
    case 'weekends':
      return day === 0 || day === 6;
    case 'specific_days':
      return (selectedDays ?? []).includes(day);
    case 'daily':
    default:
      return true;
  }
}

function getScheduleLabel(
  frequency?: 'daily' | 'weekdays' | 'weekends' | 'specific_days',
  selectedDays?: number[],
) {
  switch (frequency) {
    case 'weekdays':
      return 'Weekdays';
    case 'weekends':
      return 'Weekends';
    case 'specific_days':
      return selectedDays && selectedDays.length > 0 ? `${selectedDays.length} days` : 'Custom schedule';
    case 'daily':
    default:
      return 'Daily';
  }
}

function getHabitState(habit: HabitItem): TaskState {
  if (!habit.active) return 'locked';

  const total = habit.steps.length;
  const done = habit.steps.filter(step => step.completedToday).length;

  if (total > 0 && done === total) return 'done';
  if (done > 0) return 'active';
  return 'pending';
}

function getHabitIconName(habit: HabitItem): TaskData['habitIconName'] {
  if (habit.name.toLowerCase().includes('morning')) return 'Sun';
  if (habit.name.toLowerCase().includes('study')) return 'Book';
  if (habit.name.toLowerCase().includes('review')) return 'Feather';
  return 'Heart';
}

function HomeHeader() {
  return (
    <>
      <View style={h.row}>
        <TouchableOpacity style={h.iconBtn} activeOpacity={0.7}>
          <Settings s={18} c={C.text} />
        </TouchableOpacity>
        <View style={h.monthWrap}>
          <ChevronLeft s={18} c={C.textMuted} />
          <View style={{ alignItems: 'center' }}>
            <Text style={h.month}>April</Text>
            <Text style={h.year}>2026</Text>
          </View>
          <ChevronRight s={18} c={C.textMuted} />
        </View>
        <TouchableOpacity style={h.iconBtn} activeOpacity={0.7}>
          <Calendar s={18} c={C.text} />
        </TouchableOpacity>
      </View>

      <DateStrip />

      <View style={h.quoteWrap}>
        <Text style={h.quote}>
          {'"Awake thou that sleepest, and '}
          <Text style={{ textDecorationLine: 'underline' }}>arise</Text>{' '}
          <Text style={{ color: C.gold }}>(anasta)</Text>
          {' from the dead, and Christ shall give thee light."'}
        </Text>
        <Text style={h.ref}>EPHESIANS 5:14</Text>
      </View>
    </>
  );
}

const h = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  iconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#f5f4f0', alignItems: 'center', justifyContent: 'center' },
  monthWrap: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  month: { fontFamily: F.serifMedium, fontSize: 28, color: C.red, lineHeight: 32 },
  year: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2, color: C.textMuted, marginTop: 3 },
  quoteWrap: { paddingHorizontal: 26, paddingTop: 18, paddingBottom: 4, alignItems: 'center' },
  quote: { fontFamily: F.serifMediumItalic, fontSize: 14, color: C.textSecondary, lineHeight: 21, textAlign: 'center' },
  ref: { marginTop: 8, fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.4, color: C.gold },
});

function ProgressBar({ pct }: { pct: number }) {
  return (
    <View style={progress.track}>
      <View style={[progress.fill, { width: `${pct}%` }]} />
    </View>
  );
}

const progress = StyleSheet.create({
  track: { width: 110, height: 3, borderRadius: 3, backgroundColor: '#ece9de', overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: C.gold, borderRadius: 3 },
});

export default function HomeView() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { books } = useReadingList();
  const {
    gratitudeEntries,
    gratitudeTaskEnabled,
    gratitudeTaskFrequency,
    gratitudeTaskTime,
  } = useInnerTools();

  const homeCards = useMemo<HomeCard[]>(() => {
    const todayKey = new Date().toISOString().split('T')[0];
    const featuredHabit = INITIAL_HABITS.find(habit => habit.active && habit.steps.some(step => !step.completedToday))
      ?? INITIAL_HABITS.find(habit => habit.active)
      ?? INITIAL_HABITS[0];
    const habitDone = featuredHabit.steps.filter(step => step.completedToday).length;
    const habitTotal = featuredHabit.steps.length;
    const nextHabitStep = featuredHabit.steps.find(step => !step.completedToday) ?? featuredHabit.steps[0];

    const featuredReading = books.find(book => book.showOnHome && book.status === 'reading')
      ?? books.find(book => book.showOnHome)
      ?? books.find(book => book.status === 'reading');
    const readingScheduled = featuredReading
      ? isScheduledToday(featuredReading.taskFrequency, featuredReading.taskSelectedDays)
      : false;
    const readingDoneToday = !!(featuredReading?.lastSessionAt && dateKey(featuredReading.lastSessionAt) === todayKey);

    const gratitudeTodayCount = gratitudeEntries.filter(
      entry => entry.kind === 'daily' && entry.date === todayKey,
    ).length;
    const gratitudeScheduled = gratitudeTaskEnabled
      && isScheduledToday(gratitudeTaskFrequency, gratitudeTaskFrequency === 'daily' ? undefined : [1, 2, 3, 4, 5]);
    const gratitudeDoneToday = gratitudeTodayCount >= 3;

    const primaryChallenge = ACTIVE_CHALLENGES[0];

    return [
      {
        id: 'spiritual-routine',
        route: '/prayer',
        streak: 4,
        task: {
          variant: 'spiritual',
          title: 'Morning Prayer',
          time: '07:00',
          subtitle: 'Spiritual routine',
          state: 'active',
          type: 'prayer',
        },
      },
      {
        id: 'habit-flow',
        route: '/habits',
        streak: nextHabitStep?.currentStreak ?? 0,
        task: {
          variant: 'habit',
          title: featuredHabit?.name ?? 'Habits',
          time: nextHabitStep?.time,
          subtitle: featuredHabit ? `${habitDone}/${habitTotal} steps today` : 'Create your first habit',
          state: featuredHabit ? getHabitState(featuredHabit) : 'locked',
          habitColor: featuredHabit?.color ?? C.gold,
          habitIconName: featuredHabit ? getHabitIconName(featuredHabit) : 'Heart',
        },
      },
      {
        id: 'reading-task',
        route: '/reading-list',
        task: {
          variant: 'routine',
          title: featuredReading?.title ?? 'Reading List',
          time: featuredReading?.taskTime,
          subtitle: featuredReading
            ? getScheduleLabel(featuredReading.taskFrequency, featuredReading.taskSelectedDays)
            : 'Add a reading task',
          state: featuredReading ? (readingDoneToday ? 'done' : readingScheduled ? 'active' : 'locked') : 'locked',
          type: 'reading',
        },
      },
      {
        id: 'gratitude-task',
        route: '/gratitude',
        task: {
          variant: 'routine',
          title: 'Gratitude',
          time: gratitudeTaskEnabled ? gratitudeTaskTime : undefined,
          subtitle: gratitudeTaskEnabled
            ? getScheduleLabel(gratitudeTaskFrequency)
            : 'Set as daily task',
          state: gratitudeTaskEnabled ? (gratitudeDoneToday ? 'done' : gratitudeScheduled ? 'active' : 'locked') : 'locked',
          type: 'gratitude',
        },
      },
      {
        id: 'challenge-task',
        streak: primaryChallenge?.streak,
        task: {
          variant: 'challenge',
          title: primaryChallenge?.title ?? 'Challenges',
          time: primaryChallenge ? `${primaryChallenge.count}/${primaryChallenge.total}` : undefined,
          subtitle: primaryChallenge ? 'Reading challenge' : 'No active challenges',
          state: primaryChallenge ? 'active' : 'locked',
          type: 'reading',
        },
      },
    ];
  }, [books, gratitudeEntries, gratitudeTaskEnabled, gratitudeTaskFrequency, gratitudeTaskTime]);

  const scheduledToday = homeCards.filter(card => card.task.state !== 'locked').length;
  const completedToday = homeCards.filter(card => card.task.state === 'done').length;
  const progressPct = scheduledToday === 0 ? 0 : Math.round((completedToday / scheduledToday) * 100);
  const statusLine = scheduledToday === 0
    ? 'Set up tasks to fill your Home flow'
    : completedToday > 0
      ? `${completedToday} of ${scheduledToday} completed`
      : `${scheduledToday} active today`;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{
        paddingTop: Math.max(insets.top, Platform.OS === 'web' ? 24 : insets.top) + 4,
        paddingBottom: 120,
      }}
      showsVerticalScrollIndicator={false}
    >
      <HomeHeader />

      <View style={s.tasksWrap}>
        <View style={s.tasksHead}>
          <View>
            <Text style={s.tasksTitle}>{"Today's Tasks"}</Text>
            <Text style={s.tasksSub}>{statusLine}</Text>
          </View>
          <View style={s.progressWrap}>
            <ProgressBar pct={progressPct} />
          </View>
        </View>

        <View style={s.cardsList}>
          {homeCards.map(card => {
            const content = card.id === 'reading-task'
              ? (
                <HomeReadingCard
                  task={card.task}
                  book={books.find(book => book.title === card.task.title)}
                />
              )
              : card.id === 'gratitude-task'
                ? (
                  <HomeGratitudeCard
                    task={card.task}
                    blessingsToday={gratitudeEntries.filter(
                      entry => entry.kind === 'daily' && entry.date === new Date().toISOString().split('T')[0],
                    ).length}
                  />
                )
                : <AnyTaskCard task={card.task} streak={card.streak} />;

            if (!card.route) {
              return <View key={card.id}>{content}</View>;
            }

            const route = card.route;

            return (
              <TouchableOpacity
                key={card.id}
                activeOpacity={0.84}
                onPress={() => router.push(route)}
              >
                {content}
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={s.addBtn} activeOpacity={0.8}>
          <Plus s={15} c={C.text} w={2.4} />
          <Text style={s.addBtnTxt}>ADD QUICK TASK</Text>
        </TouchableOpacity>
      </View>

      <WeeklyRhythm />
      <ChallengesSection />
      <ExploreSection />
    </ScrollView>
  );
}

function dateKey(timestamp: number) {
  return new Date(timestamp).toISOString().split('T')[0];
}

function getReadingAccent(category?: string) {
  switch (category) {
    case 'Spirituality':
      return { main: '#C5A059', soft: '#FBF5E7', border: '#EEDCB4', text: '#8B6B2F' };
    case 'Productivity':
      return { main: '#15803D', soft: '#EEF9F0', border: '#CEEED4', text: '#166534' };
    case 'Philosophy':
      return { main: '#6D28D9', soft: '#F3EEFF', border: '#DFD0FF', text: '#5B21B6' };
    default:
      return { main: '#7C3AED', soft: '#F3EFFF', border: '#E4D7FF', text: '#5B21B6' };
  }
}

function HomeReadingCard({
  task,
  book,
}: {
  task: TaskData;
  book?: { author?: string; category?: string; totalMinutes?: number; sessions?: number };
}) {
  const accent = getReadingAccent(book?.category);
  const isDone = task.state === 'done';
  const isLocked = task.state === 'locked';

  return (
    <View
      style={[
        custom.readingCard,
        { borderColor: accent.border, opacity: isLocked ? 0.7 : 1 },
      ]}
    >
      {/* Left category accent bar */}
      <View style={[custom.readingBar, { backgroundColor: accent.main }]} />

      {/* Left checker */}
      <View style={[custom.readingCheck, isDone && { backgroundColor: accent.main, borderColor: accent.main }]}>
        {isDone
          ? <CheckSmall s={18} c="#FFFFFF" w={2.8} />
          : <CircleIcon s={19} c={accent.border} w={2} />
        }
      </View>

      {/* Content */}
      <View style={custom.readingMid}>
        <Text style={custom.readingTitle} numberOfLines={1}>{task.title}</Text>
        {!!book?.author && (
          <Text style={custom.readingAuthorCompact} numberOfLines={1}>{book.author}</Text>
        )}
        <View style={custom.readingMetaRowCompact}>
          {task.time ? (
            <>
              <Clock s={9} c={accent.text} />
              <Text style={[custom.readingMetaCompact, { color: accent.text }]}>{task.time}</Text>
              <Text style={{ color: accent.text, opacity: 0.55, fontSize: 10 }}>•</Text>
            </>
          ) : null}
          {task.subtitle ? (
            <Text style={[custom.readingMetaCompact, { color: accent.text, opacity: 0.75 }]}>
              {task.subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Right badge */}
      {book?.sessions ? (
        <View style={[custom.readingSessionBadge, { backgroundColor: accent.soft, borderColor: accent.border }]}>
          <Book s={11} c={accent.main} />
          <Text style={[custom.readingSessionText, { color: accent.text }]}>{book.sessions}</Text>
        </View>
      ) : (
        <View style={[custom.readingIconBadge, { backgroundColor: accent.soft, borderColor: accent.border }]}>
          <Book s={16} c={accent.main} />
        </View>
      )}
    </View>
  );
}

function HomeGratitudeCard({
  task,
  blessingsToday,
}: {
  task: TaskData;
  blessingsToday: number;
}) {
  const isDone = task.state === 'done';
  const isLocked = task.state === 'locked';

  return (
    <LinearGradient
      colors={['#FFF7F9', '#FFFFFF', '#FFF1F4']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[custom.gratitudeCard, { opacity: isLocked ? 0.72 : 1 }]}
    >
      <View style={custom.gratitudeRow}>
        {/* Standard task checker, rose-accented */}
        <View style={[custom.gratitudeCheck, isDone && custom.gratitudeCheckDone]}>
          {isDone
            ? <CheckSmall s={19} c="#FFFFFF" w={2.8} />
            : <CircleIcon s={19} c="rgba(251,113,133,0.5)" w={2} />
          }
        </View>

        <View style={custom.gratitudeMid}>
          <View style={custom.gratitudeBadgeRow}>
            <Text style={custom.gratitudeBadge}>Daily Gratitude</Text>
            {blessingsToday > 0 && !isDone ? (
              <Text style={custom.gratitudeCount}>{blessingsToday} today</Text>
            ) : null}
          </View>
          <Text style={custom.gratitudeTitle}>{task.title}</Text>
          <Text style={custom.gratitudeMeta}>
            {task.time ? `${task.time} • ` : ''}
            {isDone ? "You completed today's blessings." : task.subtitle || 'Three blessings'}
          </Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  tasksWrap: { paddingHorizontal: 20, paddingTop: 18 },
  tasksHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  tasksTitle: { fontFamily: F.serifMedium, fontSize: 22, color: C.text },
  tasksSub: { fontFamily: F.sans, fontSize: 12, color: C.textMuted, marginTop: 4 },
  progressWrap: { marginTop: 8 },
  cardsList: { marginTop: 14 },
  addBtn: {
    marginTop: 8,
    padding: 13,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: C.text,
    backgroundColor: '#FCFAF6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addBtnTxt: { fontFamily: F.sansBold, fontSize: 10.5, letterSpacing: 2, color: C.text, textTransform: 'uppercase' },
});

const custom = StyleSheet.create({
  // Reading card — compact redesign
  readingCard: {
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    paddingLeft: 18,
    borderWidth: 1,
    borderRadius: 16,
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
  },
  readingBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  readingCheck: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#e7e5e4',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  readingMid: {
    flex: 1,
    minWidth: 0,
  },
  readingTitle: {
    fontFamily: F.serifMedium,
    fontSize: 15.5,
    lineHeight: 19,
    color: '#1C1917',
  },
  readingAuthorCompact: {
    marginTop: 1,
    fontFamily: F.serifItalic,
    fontSize: 11,
    color: '#78716C',
  },
  readingMetaRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  readingMetaCompact: {
    fontFamily: F.sansBold,
    fontSize: 10.5,
    letterSpacing: 0.8,
  },
  readingSessionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    flexShrink: 0,
  },
  readingSessionText: {
    fontFamily: F.sansBold,
    fontSize: 11,
  },
  readingIconBadge: {
    padding: 7,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // Gratitude card — same size as other cards, no right heart
  gratitudeCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FDE2E8',
    marginBottom: 10,
    padding: 13,
  },
  gratitudeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  gratitudeCheck: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#FBCFE8',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  gratitudeCheckDone: {
    backgroundColor: '#F43F5E',
    borderColor: '#F43F5E',
  },
  gratitudeMid: {
    flex: 1,
    minWidth: 0,
  },
  gratitudeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
    flexWrap: 'wrap',
  },
  gratitudeBadge: {
    fontFamily: F.sansBold,
    fontSize: 8.5,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: '#F43F5E',
    backgroundColor: '#FFF1F2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  gratitudeCount: {
    fontFamily: F.sansSemiBold,
    fontSize: 10,
    color: '#FB7185',
  },
  gratitudeTitle: {
    fontFamily: F.serifMedium,
    fontSize: 15.5,
    lineHeight: 19,
    color: '#1C1917',
  },
  gratitudeMeta: {
    marginTop: 3,
    fontFamily: F.sansMedium,
    fontSize: 10.5,
    lineHeight: 15,
    color: '#FB7185',
  },
});
