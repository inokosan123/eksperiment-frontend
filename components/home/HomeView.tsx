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
import ChallengesSection from './ChallengesSection';
import ExploreSection from './ExploreSection';
import { C, F } from '@/constants/tokens';
import { AnyTaskCard, TaskData, TaskState } from '@/components/shared/TaskCards';
import { useReadingList } from '@/components/library/ReadingListContext';
import { useInnerTools } from '@/components/inner-tools/InnerToolsContext';
import { HabitItem, INITIAL_HABITS } from '@/components/habits/habitData';
import { useChallenges } from '@/components/challenges/ChallengesContext';

type HomeCard = {
  id: string;
  task: TaskData;
  streak?: number;
  route?: '/prayer' | '/habits' | '/reading-list' | '/gratitude' | '/challenges';
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
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 4 },
  iconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#f5f4f0', alignItems: 'center', justifyContent: 'center' },
  monthWrap: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  month: { fontFamily: F.serifMedium, fontSize: 28, color: C.red, lineHeight: 32 },
  year: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2, color: C.textMuted, marginTop: 3 },
  quoteWrap: { paddingHorizontal: 30, paddingTop: 18, paddingBottom: 6, alignItems: 'center' },
  quote: {
    maxWidth: 330,
    fontFamily: F.serifMediumItalic,
    fontSize: 16,
    color: '#8C8277',
    lineHeight: 25,
    textAlign: 'center',
  },
  ref: { marginTop: 10, fontFamily: F.sansBold, fontSize: 10.5, letterSpacing: 2.5, color: C.gold },
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
  const { activeChallenges, pausedChallenges } = useChallenges();
  const topPadding = Platform.OS === 'web'
    ? 10
    : Math.max(insets.top, 0) + 4;

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

    const primaryChallenge = activeChallenges[0] ?? pausedChallenges[0];

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
        id: 'routine-demo',
        task: {
          variant: 'routine',
          title: 'Evening Walk',
          time: '19:00',
          subtitle: 'Daily',
          state: 'pending',
          type: 'custom',
          habitIconName: 'Activity',
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
        id: 'quick-task-demo',
        task: {
          variant: 'quick',
          title: 'Reply to Father Nikolaj',
          state: 'pending',
          type: 'custom',
        },
      },
      {
        id: 'challenge-task',
        route: '/challenges',
        streak: primaryChallenge?.streak,
        task: {
          variant: 'challenge',
          title: primaryChallenge?.title ?? 'Challenges',
          time: primaryChallenge?.progressTotal ? `${primaryChallenge.progressCurrent}/${primaryChallenge.progressTotal}` : primaryChallenge?.time,
          subtitle: primaryChallenge ? primaryChallenge.subline : 'No active challenges',
          state: primaryChallenge ? (primaryChallenge.status === 'paused' ? 'pending' : 'active') : 'locked',
          type: 'reading',
        },
      },
    ];
  }, [activeChallenges, books, gratitudeEntries, gratitudeTaskEnabled, gratitudeTaskFrequency, gratitudeTaskTime, pausedChallenges]);

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
        paddingTop: topPadding,
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

        <TouchableOpacity activeOpacity={0.82} style={{ marginTop: 8 }}>
          <LinearGradient
            colors={['#FFFFFF', '#F0FDF4']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.addBtn}
          >
            <Plus s={16} c="#1C1917" w={2.5} />
            <Text style={s.addBtnTxt}>ADD QUICK TASK</Text>
          </LinearGradient>
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


function HomeReadingCard({
  task,
  book,
}: {
  task: TaskData;
  book?: { author?: string; category?: string; totalMinutes?: number; sessions?: number };
}) {
  const isDone = task.state === 'done';
  const isLocked = task.state === 'locked';

  return (
    <LinearGradient
      colors={['#F8F6FE', '#FDFCFF']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[custom.readingCard, { opacity: isLocked ? 0.7 : 1 }]}
    >
      {/* Checker — indigo ring */}
      <View style={[custom.readingCheck, isDone && custom.readingCheckDone]}>
        {isDone && <CheckSmall s={18} c="#FFFFFF" w={2.8} />}
      </View>

      {/* Content */}
      <View style={custom.readingMid}>
        <Text style={custom.readingTitle} numberOfLines={1}>{task.title}</Text>
        <View style={custom.readingMetaRow}>
          {task.time ? (
            <>
              <Clock s={9} c="#7C6FB0" />
              <Text style={custom.readingMeta}>{task.time}</Text>
              <Text style={custom.readingDot}>•</Text>
            </>
          ) : null}
          <Text style={custom.readingMeta} numberOfLines={1}>
            {book?.author ?? task.subtitle ?? 'Reading Task'}
          </Text>
        </View>
      </View>

      {/* Book icon badge — indigo/purple */}
      <View style={custom.readingIconBadge}>
        <Book s={16} c="#6D28D9" />
      </View>
    </LinearGradient>
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
      colors={['#FFEDF2', '#FFF6F8']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[custom.gratitudeCard, { opacity: isLocked ? 0.72 : 1 }]}
    >
      <View style={custom.gratitudeRow}>
        {/* Standard task checker, rose-accented */}
        <View style={[custom.gratitudeCheck, isDone && custom.gratitudeCheckDone]}>
          {isDone
            ? <CheckSmall s={19} c="#FFFFFF" w={2.8} />
            : <CircleIcon s={19} c="#F472B6" w={2} />
          }
        </View>

        <View style={custom.gratitudeMid}>
          <Text style={custom.gratitudeTitle}>{task.title}</Text>
          <View style={custom.gratitudeMetaRow}>
            {task.time ? (
              <>
                <Clock s={9} c="#E11D48" />
                <Text style={custom.gratitudeMeta}>{task.time}</Text>
                <Text style={custom.gratitudeDot}>•</Text>
              </>
            ) : null}
            <Text style={custom.gratitudeMeta} numberOfLines={1}>
              {isDone
                ? (blessingsToday > 0 ? `${blessingsToday} blessings` : 'Completed')
                : task.subtitle || 'Daily Gratitude'}
            </Text>
          </View>
        </View>

        {/* Small heart type badge */}
        <View style={custom.gratitudeTypeBox}>
          <Heart s={16} c="#E11D48" />
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
    padding: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#1C1917',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  addBtnTxt: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 2.5, color: '#1C1917', textTransform: 'uppercase' },
});

const custom = StyleSheet.create({
  // Reading card — indigo/literary aesthetic
  readingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderRadius: 18,
    borderColor: 'rgba(109,40,217,0.14)',
    marginBottom: 10,
  },
  readingCheck: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'rgba(109,40,217,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  readingCheckDone: {
    backgroundColor: '#6D28D9',
    borderColor: '#6D28D9',
  },
  readingMid: { flex: 1, minWidth: 0 },
  readingTitle: {
    fontFamily: F.serifMedium,
    fontSize: 16,
    lineHeight: 20,
    color: '#1C1917',
  },
  readingMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  readingMeta: {
    fontFamily: F.sansMedium,
    fontSize: 10,
    color: '#7C6FB0',
  },
  readingDot: { color: '#7C6FB0', opacity: 0.6, fontSize: 9 },
  readingIconBadge: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#ECE8F5',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // Gratitude card — 2-line, same size as other cards
  gratitudeCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F9A8D4',
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
    borderColor: '#F472B6',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  gratitudeCheckDone: {
    backgroundColor: '#E11D48',
    borderColor: '#E11D48',
  },
  gratitudeMid: { flex: 1, minWidth: 0 },
  gratitudeTitle: {
    fontFamily: F.serifMedium,
    fontSize: 15.5,
    lineHeight: 19,
    color: '#1C1917',
  },
  gratitudeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  gratitudeMeta: {
    fontFamily: F.sansMedium,
    fontSize: 10.5,
    color: '#E11D48',
  },
  gratitudeDot: { color: '#E11D48', opacity: 0.65, fontSize: 10 },
  gratitudeTypeBox: {
    padding: 7,
    borderRadius: 9,
    borderWidth: 1,
    backgroundColor: '#FFD6DF',
    borderColor: 'rgba(225,29,72,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
