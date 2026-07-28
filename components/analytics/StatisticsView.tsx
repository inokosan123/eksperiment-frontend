import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import {
  CheckSmall,
  ChevronRight,
  ListChecks,
  Sparkles,
  Target,
  Trophy,
} from '@/components/icons/Icons';
import AnalyticsChart from '@/components/analytics/AnalyticsChart';
import HeatmapCalendar from '@/components/analytics/HeatmapCalendar';
import HighlightCards, { QuickTaskHighlightCards } from '@/components/analytics/HighlightCards';
import {
  A,
  cardShell,
  Diamond,
  ExpandChevron,
  GaugeDial,
  HairRule,
  ProgressBar,
  SectionHead,
  SegmentedRail,
  useCountUp,
} from '@/components/analytics/analyticsUi';
import {
  getPerChallengeBreakdown,
  getPerHabitBreakdown,
  getPerTaskCategoryBreakdown,
  getQuickTaskHighlights,
  getStreakLeaders,
  type CountBucket,
  type PerItemBreakdown,
  type SourceFilter,
} from '@/components/analytics/analyticsOverview';
import { useAnalytics } from '@/components/analytics/useAnalytics';
import { F } from '@/constants/tokens';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';

const BG = A.bg;
const GOLD = A.gold;

type FilterTab = SourceFilter;

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'challenges', label: 'Challenges' },
  { key: 'habits', label: 'Habits' },
  { key: 'routineTasks', label: 'Routine Tasks' },
  { key: 'spiritualTasks', label: 'Spiritual Tasks' },
  { key: 'otherTasks', label: 'Other Tasks' },
  { key: 'quickTasks', label: 'Quick Tasks' },
];

/**
 * What the hero is measuring, per filter. Kept short on purpose: the line sits
 * beside a 112pt dial, so anything longer wraps to two lines on a 360pt phone.
 */
const HERO_SUBJECT: Record<FilterTab, string> = {
  all: 'Everything you track',
  challenges: 'Your challenges',
  habits: 'Your habits',
  routineTasks: 'Your routine tasks',
  spiritualTasks: 'Your spiritual tasks',
  otherTasks: 'Your other tasks',
  quickTasks: 'Your quick tasks',
};

export default function StatisticsView() {
  const { ready, overview, instances, habits, habitIdByTaskId, taskMetaById, challenges } = useAnalytics();
  const [tab, setTab] = useState<FilterTab>('all');

  // The rail brings whichever filter is chosen back into view on its own, so
  // a jump from a category row lands on a segment the user can actually see.
  const jumpToTab = useCallback((key: FilterTab) => setTab(key), []);

  const sourceFilter: SourceFilter = tab;

  const heroBucket: CountBucket = useMemo(() => {
    if (!overview) return { scheduled: 0, completed: 0, skipped: 0, missed: 0, pct: 0 };
    if (tab === 'all') return overview.global.overall;
    return overview.global.source[tab];
  }, [overview, tab]);

  const streakLeaders = useMemo(() => {
    if (!overview) return null;
    return getStreakLeaders(challenges, habits, overview.dailySnapshots, sourceFilter, instances, taskMetaById);
  }, [overview, challenges, habits, sourceFilter, instances, taskMetaById]);

  const quickHighlights = useMemo(() => {
    if (!overview) return null;
    return getQuickTaskHighlights(overview.dailySnapshots);
  }, [overview]);

  const challengeBreakdown = useMemo(() => {
    if (!overview) return [];
    return getPerChallengeBreakdown(challenges, overview.dailySnapshots);
  }, [overview, challenges]);

  const habitBreakdown = useMemo(() => {
    if (!overview) return [];
    return getPerHabitBreakdown(habits, overview.dailySnapshots, habitIdByTaskId, taskMetaById);
  }, [overview, habits, habitIdByTaskId, taskMetaById]);

  const taskCategoryBreakdown = useMemo(() => {
    if (!overview) return { routineTasks: [], spiritualTasks: [], otherTasks: [] };
    return getPerTaskCategoryBreakdown(instances, overview.dailySnapshots, taskMetaById);
  }, [overview, instances, taskMetaById]);

  return (
    <View style={s.screen}>
      <ScreenTitleBar title="ANALYTICS" showBack bg={BG} />

      {/* Filter rail — it dissolves at whichever end it can still travel to */}
      <View style={s.tabsWrap}>
        <SegmentedRail items={TABS} value={tab} onChange={setTab} fadeColor={BG} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {!ready ? (
          <Text style={s.loadingText}>Loading…</Text>
        ) : !overview ? (
          <Text style={s.loadingText}>No data yet</Text>
        ) : (
          <>
            <HeroStats bucket={heroBucket} subject={HERO_SUBJECT[tab]} tabKey={tab} />

            <Animated.View key={`highlights-${tab}`} layout={LinearTransition.duration(220)}>
              {tab === 'quickTasks' && quickHighlights ? (
                <QuickTaskHighlightCards {...quickHighlights} />
              ) : streakLeaders ? (
                <HighlightCards {...streakLeaders} />
              ) : null}
            </Animated.View>

            <AnalyticsChart snapshots={overview.dailySnapshots} sourceFilter={sourceFilter} />

            {tab === 'all' && (
              <CategorySection
                challengesPct={overview.global.source.challenges.pct}
                habitsPct={overview.global.source.habits.pct}
                routineTasksPct={overview.global.source.routineTasks.pct}
                spiritualTasksPct={overview.global.source.spiritualTasks.pct}
                otherTasksPct={overview.global.source.otherTasks.pct}
                quickTasksPct={overview.global.source.quickTasks.pct}
                onJump={jumpToTab}
              />
            )}

            {tab === 'challenges' && (
              <ChallengeBreakdownSection
                items={challengeBreakdown}
                globalPct={overview.global.source.challenges.pct}
              />
            )}

            {tab === 'habits' && <HabitBreakdownSection items={habitBreakdown} />}

            {tab === 'routineTasks' && (
              <TaskBreakdownSection
                title="Routine tasks"
                caption="Every routine task, ranked by how often you finish it."
                items={taskCategoryBreakdown.routineTasks}
                accent="#16A34A"
                wash="#F1F7F2"
              />
            )}

            {tab === 'spiritualTasks' && (
              <TaskBreakdownSection
                title="Spiritual tasks"
                caption="Prayer and church tasks, ranked by how often you finish them."
                items={taskCategoryBreakdown.spiritualTasks}
                accent={GOLD}
                wash={A.goldWash}
              />
            )}

            {tab === 'otherTasks' && (
              <TaskBreakdownSection
                title="Other tasks"
                caption="Everything else you scheduled, ranked by completion."
                items={taskCategoryBreakdown.otherTasks}
                accent="#4A4540"
                wash="#F5F4F1"
              />
            )}

            {tab === 'quickTasks' && <QuickTaskOverview bucket={overview.global.source.quickTasks} />}

            <HeatmapCalendar snapshots={overview.dailySnapshots} sourceFilter={sourceFilter} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

/* ─── Hero ───────────────────────────────────────────────────
 * The screen's headline reading, struck in the Home card's own
 * language: a gauge blooming with light, small-caps copy hung
 * off a gold hairline, and — instead of four coloured chips —
 * one ledger band whose columns are ruled apart, each carrying
 * the register's diamond over a serif figure.
 * ───────────────────────────────────────────────────────────── */

const REGISTERS = [
  { key: 'completed', label: 'DONE', bar: A.done, ink: A.doneInk },
  { key: 'skipped', label: 'SKIPPED', bar: A.skipped, ink: A.skippedInk },
  { key: 'missed', label: 'MISSED', bar: A.missed, ink: A.missedInk },
  { key: 'pending', label: 'PENDING', bar: A.pending, ink: A.pendingInk },
] as const;

function HeroStats({
  bucket,
  subject,
  tabKey,
}: {
  bucket: CountBucket;
  subject: string;
  tabKey: FilterTab;
}) {
  const pending = Math.max(0, bucket.scheduled - bucket.completed - bucket.skipped - bucket.missed);
  const shownPct = useCountUp(bucket.pct);
  const empty = bucket.scheduled === 0;

  const counts: Record<string, number> = {
    completed: bucket.completed,
    skipped: bucket.skipped,
    missed: bucket.missed,
    pending,
  };

  return (
    <Animated.View
      style={hs.card}
      entering={FadeInDown.duration(420).easing(Easing.out(Easing.cubic))}
      layout={LinearTransition.duration(220)}
    >
      <View style={hs.top}>
        <GaugeDial key={`gauge-${tabKey}`} pct={bucket.pct} size={112} stroke={8}>
          <View style={hs.readingRow}>
            <Text style={hs.reading}>{shownPct}</Text>
            <Text style={hs.readingSign}>%</Text>
          </View>
          <View style={hs.readingRule} />
          <Text style={hs.readingCaption}>COMPLETE</Text>
        </GaugeDial>

        <View style={hs.copy}>
          <Text style={hs.eyebrow}>COMPLETION RATE</Text>
          <Text style={hs.subject} numberOfLines={2}>
            {empty ? 'Nothing scheduled' : subject}
          </Text>
          <HairRule style={hs.copyRule} />
          <View style={hs.countRow}>
            <Text style={hs.countValue}>{bucket.completed}</Text>
            <Text style={hs.countOf}>of</Text>
            <Text style={hs.countValue}>{bucket.scheduled}</Text>
            <Text style={hs.countLabel}>COMPLETED</Text>
          </View>
        </View>
      </View>

      <CompositionBar
        completed={bucket.completed}
        skipped={bucket.skipped}
        missed={bucket.missed}
        pending={pending}
      />

      <View style={hs.ledger}>
        {REGISTERS.map((r, i) => (
          <React.Fragment key={r.key}>
            {i > 0 && <View style={hs.ledgerRule} />}
            <LedgerColumn value={counts[r.key]} label={r.label} tone={r.bar} ink={r.ink} index={i} />
          </React.Fragment>
        ))}
      </View>
    </Animated.View>
  );
}

/**
 * The composition of the range, read as one enamelled rail: every
 * segment grows on the same sweep, hairline gaps keep the registers
 * apart, and a light catch runs along the top so it reads as glass
 * over the colour rather than four flat blocks.
 */
function CompositionBar({
  completed,
  skipped,
  missed,
  pending,
}: {
  completed: number;
  skipped: number;
  missed: number;
  pending: number;
}) {
  const reduceMotion = useReducedMotion();
  const total = completed + skipped + missed + pending;
  const grow = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    grow.value = reduceMotion
      ? 1
      : withDelay(240, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [grow, reduceMotion]);

  const counts: Record<string, number> = { completed, skipped, missed, pending };
  const segments = REGISTERS.filter(r => counts[r.key] > 0);

  return (
    <View style={hs.barTrack}>
      {total > 0 &&
        segments.map((seg, i) => (
          <BarSegment
            key={seg.key}
            share={(counts[seg.key] / total) * 100}
            color={seg.bar}
            grow={grow}
            first={i === 0}
          />
        ))}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,255,255,0.42)', 'rgba(255,255,255,0.04)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={hs.barSheen}
      />
    </View>
  );
}

function BarSegment({
  share,
  color,
  grow,
  first,
}: {
  share: number;
  color: string;
  grow: SharedValue<number>;
  first: boolean;
}) {
  const style = useAnimatedStyle(() => ({ width: `${share * grow.value}%` }));
  return (
    <Animated.View
      style={[
        { height: '100%', backgroundColor: color },
        !first && hs.barSegmentGap,
        style,
      ]}
    />
  );
}

function LedgerColumn({
  value,
  label,
  tone,
  ink,
  index,
}: {
  value: number;
  label: string;
  tone: string;
  ink: string;
  index: number;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <Animated.View
      entering={
        reduceMotion
          ? undefined
          : FadeInDown.duration(360).delay(200 + index * 60).easing(Easing.out(Easing.cubic))
      }
      style={hs.ledgerCol}
    >
      <Diamond size={5} color={tone} />
      <Text
        style={[hs.ledgerValue, { color: ink }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {value}
      </Text>
      <Text style={hs.ledgerLabel} numberOfLines={1}>
        {label}
      </Text>
    </Animated.View>
  );
}

/* ─── All tab — category comparison ─── */

const CATEGORY_ROWS: { key: FilterTab; label: string; accent: string }[] = [
  { key: 'challenges', label: 'Challenges', accent: GOLD },
  { key: 'habits', label: 'Habits', accent: '#2563EB' },
  { key: 'routineTasks', label: 'Routine Tasks', accent: '#16A34A' },
  { key: 'spiritualTasks', label: 'Spiritual Tasks', accent: '#B07D2C' },
  { key: 'otherTasks', label: 'Other Tasks', accent: '#4A4540' },
  { key: 'quickTasks', label: 'Quick Tasks', accent: '#D97706' },
];

function CategorySection({
  challengesPct,
  habitsPct,
  routineTasksPct,
  spiritualTasksPct,
  otherTasksPct,
  quickTasksPct,
  onJump,
}: {
  challengesPct: number;
  habitsPct: number;
  routineTasksPct: number;
  spiritualTasksPct: number;
  otherTasksPct: number;
  quickTasksPct: number;
  onJump: (key: FilterTab) => void;
}) {
  const values: Record<string, number> = {
    challenges: challengesPct,
    habits: habitsPct,
    routineTasks: routineTasksPct,
    spiritualTasks: spiritualTasksPct,
    otherTasks: otherTasksPct,
    quickTasks: quickTasksPct,
  };

  return (
    <Animated.View style={cs.card} entering={FadeIn.duration(280)}>
      <SectionHead
        Icon={Target}
        title="By category"
        caption="Tap a row to open that filter on its own."
      />
      <View style={cs.rows}>
        {CATEGORY_ROWS.map((row, i) => (
          <CategoryRow
            key={row.key}
            label={row.label}
            pct={values[row.key] ?? 0}
            accent={row.accent}
            index={i}
            onPress={() => onJump(row.key)}
          />
        ))}
      </View>
    </Animated.View>
  );
}

function CategoryRow({
  label,
  pct,
  accent,
  index,
  onPress,
}: {
  label: string;
  pct: number;
  accent: string;
  index: number;
  onPress: () => void;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <Animated.View
      entering={
        reduceMotion
          ? undefined
          : FadeInDown.duration(340).delay(index * 50).easing(Easing.out(Easing.cubic))
      }
    >
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={cs.row}>
        <View style={cs.rowBody}>
          <Text style={cs.rowLabel} numberOfLines={1}>
            {label}
          </Text>
          <ProgressBar pct={pct} color={accent} height={7} delay={200 + index * 60} style={cs.rowBar} />
        </View>
        <Text style={[cs.rowPct, { color: accent }]}>{pct}%</Text>
        <ChevronRight s={17} c="#C9C2B7" />
      </TouchableOpacity>
    </Animated.View>
  );
}

/* ─── Challenges ─── */

function ChallengeBreakdownSection({ items, globalPct }: { items: PerItemBreakdown[]; globalPct: number }) {
  return (
    <Animated.View style={sec.wrap} entering={FadeIn.duration(280)}>
      <SectionHead
        Icon={Trophy}
        title="Per challenge"
        caption="Open a challenge to see its streak and how it compares."
        style={sec.head}
      />
      {items.length === 0 ? (
        <EmptySection text="No challenges yet" />
      ) : (
        items.map((item, i) => (
          <ChallengeBreakdownCard key={item.id} item={item} globalPct={globalPct} index={i} />
        ))
      )}
    </Animated.View>
  );
}

function ChallengeBreakdownCard({
  item,
  globalPct,
  index,
}: {
  item: PerItemBreakdown;
  globalPct: number;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const reduceMotion = useReducedMotion();
  const diff = item.pct - globalPct;

  return (
    <Animated.View
      style={ch.card}
      layout={LinearTransition.duration(240)}
      entering={
        reduceMotion
          ? undefined
          : FadeInDown.duration(340).delay(index * 55).easing(Easing.out(Easing.cubic))
      }
    >
      <TouchableOpacity activeOpacity={0.85} onPress={() => setExpanded(e => !e)} style={ch.head}>
        <View style={ch.iconBox}>
          <Trophy s={17} c={GOLD} w={2} />
        </View>
        <View style={ch.body}>
          <Text style={ch.title} numberOfLines={1}>
            {item.name}
          </Text>
          <ProgressBar pct={item.pct} color={GOLD} height={6} delay={120 + index * 50} style={ch.bar} />
        </View>
        <Text style={ch.pct}>{item.pct}%</Text>
        <ExpandChevron expanded={expanded} />
      </TouchableOpacity>

      {expanded && (
        <Animated.View
          style={ch.expanded}
          entering={reduceMotion ? undefined : FadeIn.duration(200)}
          exiting={reduceMotion ? undefined : FadeOut.duration(120)}
        >
          <View style={grid.row}>
            <MiniStat value={`${item.currentStreak}/${item.bestStreak}`} label="STREAK" color={A.ink} />
            <MiniStat
              value={`${diff >= 0 ? '+' : ''}${diff}%`}
              label="VS AVG"
              color={diff >= 0 ? '#15803D' : '#B91C1C'}
            />
            <MiniStat value={item.completed} label="DONE" color={A.done} />
            <MiniStat value={item.missed} label="MISSED" color={A.missed} />
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );
}

/* ─── Habits ─── */

function HabitBreakdownSection({ items }: { items: PerItemBreakdown[] }) {
  const active = items.filter(h => h.isActive !== false);
  const inactive = items.filter(h => h.isActive === false);

  return (
    <Animated.View style={sec.wrap} entering={FadeIn.duration(280)}>
      <SectionHead
        Icon={ListChecks}
        title="Active goals"
        caption="Open a goal to see its tasks and streaks."
        style={sec.head}
      />
      {active.length === 0 ? (
        <EmptySection text="No active goals" />
      ) : (
        active.map((item, i) => <HabitBreakdownCard key={item.id} item={item} index={i} />)
      )}

      {inactive.length > 0 && (
        <>
          <SectionHead
            Icon={ListChecks}
            title="Archived"
            caption="Goals you have paused or finished."
            tone={A.faint}
            wash="#F4F2ED"
            style={[sec.head, { marginTop: 12 }]}
          />
          {inactive.map((item, i) => (
            <View key={item.id} style={{ opacity: 0.62 }}>
              <HabitBreakdownCard item={item} index={i} />
            </View>
          ))}
        </>
      )}
    </Animated.View>
  );
}

function HabitBreakdownCard({ item, index }: { item: PerItemBreakdown; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const reduceMotion = useReducedMotion();
  const accent = item.color || GOLD;

  return (
    <Animated.View
      style={[hb.card, { borderLeftWidth: 4, borderLeftColor: accent }]}
      layout={LinearTransition.duration(240)}
      entering={
        reduceMotion
          ? undefined
          : FadeInDown.duration(340).delay(index * 55).easing(Easing.out(Easing.cubic))
      }
    >
      <TouchableOpacity activeOpacity={0.85} onPress={() => setExpanded(e => !e)} style={hb.head}>
        <View style={hb.body}>
          <Text style={hb.title} numberOfLines={1}>
            {item.name}
          </Text>
          <ProgressBar pct={item.pct} color={accent} height={6} delay={120 + index * 50} style={hb.bar} />
        </View>
        <Text style={[hb.pct, { color: accent }]}>{item.pct}%</Text>
        <ExpandChevron expanded={expanded} />
      </TouchableOpacity>

      {expanded && (
        <Animated.View
          style={hb.expanded}
          entering={reduceMotion ? undefined : FadeIn.duration(200)}
          exiting={reduceMotion ? undefined : FadeOut.duration(120)}
        >
          <Text style={hb.expandedKicker}>OVERALL</Text>
          <View style={[grid.row, { marginTop: 9 }]}>
            <MiniStat value={item.completed} label="DONE" color={A.done} />
            <MiniStat value={item.skipped} label="SKIPPED" color={A.skipped} />
            <MiniStat value={item.missed} label="MISSED" color={A.missed} />
            <MiniStat value={`${item.currentStreak}/${item.bestStreak}`} label="STREAK" color={A.ink} />
          </View>

          {item.subTasks && item.subTasks.length > 0 && (
            <>
              <Text style={[hb.expandedKicker, { marginTop: 16 }]}>TASKS</Text>
              <View style={{ rowGap: 9, marginTop: 9 }}>
                {item.subTasks.map(t => (
                  <View key={t.id} style={hb.subTask}>
                    <View style={hb.subTaskHead}>
                      <Text style={hb.subTaskTitle} numberOfLines={1}>
                        {t.name}
                      </Text>
                      <Text style={[hb.subTaskPct, { color: accent }]}>{t.pct}%</Text>
                    </View>
                    <View style={[grid.row, { marginTop: 9, columnGap: 5 }]}>
                      <MiniStat value={t.completed} label="DONE" color={A.done} small />
                      <MiniStat value={t.skipped} label="SKIPPED" color={A.skipped} small />
                      <MiniStat value={t.missed} label="MISSED" color={A.missed} small />
                      <MiniStat value={`${t.currentStreak}/${t.bestStreak}`} label="STREAK" color={A.ink} small />
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}
        </Animated.View>
      )}
    </Animated.View>
  );
}

function MiniStat({
  value,
  label,
  color,
  small,
}: {
  value: string | number;
  label: string;
  color: string;
  small?: boolean;
}) {
  return (
    <View style={[ms.tile, small && ms.tileSmall]}>
      <Text
        style={[ms.value, { color }, small && ms.valueSmall]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.72}
      >
        {value}
      </Text>
      <Text style={[ms.label, small && ms.labelSmall]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/* ─── Task categories ─── */

function TaskBreakdownSection({
  title,
  caption,
  items,
  accent,
  wash,
}: {
  title: string;
  caption: string;
  items: PerItemBreakdown[];
  accent: string;
  wash: string;
}) {
  return (
    <Animated.View style={sec.wrap} entering={FadeIn.duration(280)}>
      <SectionHead Icon={CheckSmall} title={title} caption={caption} tone={accent} wash={wash} style={sec.head} />
      {items.length === 0 ? (
        <EmptySection text="No tasks yet" />
      ) : (
        <View style={[rg.card, { borderLeftWidth: 4, borderLeftColor: accent }]}>
          {items.map((item, i) => (
            <TaskRow key={item.id} item={item} accent={accent} index={i} last={i === items.length - 1} />
          ))}
        </View>
      )}
    </Animated.View>
  );
}

function TaskRow({
  item,
  accent,
  index,
  last,
}: {
  item: PerItemBreakdown;
  accent: string;
  index: number;
  last: boolean;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <Animated.View
      entering={
        reduceMotion
          ? undefined
          : FadeInDown.duration(320).delay(index * 40).easing(Easing.out(Easing.cubic))
      }
      style={[rg.row, !last && rg.rowDivider]}
    >
      <View style={rg.rowBody}>
        <Text style={rg.rowName} numberOfLines={1}>
          {item.name}
        </Text>
        <ProgressBar pct={item.pct} color={accent} height={6} delay={140 + index * 45} style={rg.rowBar} />
      </View>
      <Text style={[rg.rowPct, { color: accent }]}>{item.pct}%</Text>
    </Animated.View>
  );
}

/* ─── Quick tasks ─── */

function QuickTaskOverview({ bucket }: { bucket: CountBucket }) {
  const pending = Math.max(0, bucket.scheduled - bucket.completed - bucket.skipped - bucket.missed);

  const tiles: { key: string; label: string; value: number; color: string; wash: string }[] = [
    { key: 'scheduled', label: 'Scheduled', value: bucket.scheduled, color: A.ink, wash: '#F6F4F1' },
    { key: 'completed', label: 'Completed', value: bucket.completed, color: A.done, wash: A.doneWash },
    { key: 'skipped', label: 'Skipped', value: bucket.skipped, color: A.skipped, wash: A.skippedWash },
    { key: 'missed', label: 'Missed', value: bucket.missed, color: A.missed, wash: A.missedWash },
    { key: 'pending', label: 'Pending', value: pending, color: A.pending, wash: A.pendingWash },
  ];

  return (
    <Animated.View style={qt.card} entering={FadeIn.duration(280)}>
      <SectionHead Icon={Sparkles} title="Overview" caption="Every quick task you have logged so far." />
      <View style={qt.grid}>
        {tiles.map((tile, i) => (
          <QuickTile
            key={tile.key}
            label={tile.label}
            value={tile.value}
            color={tile.color}
            wash={tile.wash}
            index={i}
          />
        ))}
      </View>
    </Animated.View>
  );
}

function QuickTile({
  label,
  value,
  color,
  wash,
  index,
}: {
  label: string;
  value: number;
  color: string;
  wash: string;
  index: number;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <Animated.View
      entering={
        reduceMotion
          ? undefined
          : FadeInDown.duration(340).delay(index * 55).easing(Easing.out(Easing.cubic))
      }
      style={[qt.tile, { backgroundColor: wash }]}
    >
      <Text style={[qt.tileValue, { color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
      <Text style={qt.tileLabel} numberOfLines={1}>
        {label}
      </Text>
    </Animated.View>
  );
}

function EmptySection({ text }: { text: string }) {
  return (
    <View style={sec.empty}>
      <Text style={sec.emptyText}>{text}</Text>
    </View>
  );
}

/* ─── Styles ─── */

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  loadingText: {
    fontFamily: F.serifMediumItalic,
    fontSize: 16,
    color: A.faint,
    textAlign: 'center',
    marginTop: 60,
  },
  tabsWrap: { backgroundColor: BG, paddingTop: 2, paddingBottom: 10 },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 90, rowGap: 16 },
});

const hs = StyleSheet.create({
  card: { ...cardShell, padding: 18, paddingBottom: 16 },
  top: { flexDirection: 'row', alignItems: 'center', columnGap: 14 },

  // Inside the dial: the figure, a hairline, and its caption.
  readingRow: { flexDirection: 'row', alignItems: 'baseline' },
  reading: {
    fontFamily: F.serifSemiBold,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -1,
    color: A.numberInk,
    includeFontPadding: false,
    fontVariant: ['lining-nums', 'tabular-nums'],
  },
  readingSign: { fontFamily: F.serifMedium, fontSize: 15, color: A.goldInk, marginLeft: 1 },
  readingRule: {
    width: 22,
    height: 1,
    marginTop: 3,
    borderRadius: 1,
    backgroundColor: A.hair,
  },
  readingCaption: {
    marginTop: 4,
    fontFamily: F.sansBold,
    fontSize: 7.5,
    letterSpacing: 1.15,
    color: 'rgba(121,89,30,0.72)',
  },

  copy: { flex: 1, minWidth: 0 },
  eyebrow: {
    fontFamily: F.sansBold,
    fontSize: 8.2,
    lineHeight: 10,
    letterSpacing: 1.15,
    color: 'rgba(121,89,30,0.72)',
  },
  subject: {
    marginTop: 5,
    fontFamily: F.serifMedium,
    fontSize: 19,
    lineHeight: 24,
    letterSpacing: -0.2,
    color: A.ink,
  },
  copyRule: { width: 46, marginTop: 9 },
  countRow: { marginTop: 9, flexDirection: 'row', alignItems: 'baseline', columnGap: 4 },
  countValue: {
    fontFamily: F.serifSemiBold,
    fontSize: 17,
    color: A.numberInk,
    fontVariant: ['lining-nums', 'tabular-nums'],
  },
  countOf: { fontFamily: F.serifItalic, fontSize: 14, color: A.faint },
  countLabel: {
    marginLeft: 2,
    fontFamily: F.sansBold,
    fontSize: 8.2,
    letterSpacing: 1.15,
    color: A.faint,
  },

  // The enamelled composition rail.
  barTrack: {
    marginTop: 18,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#F3EEE3',
    overflow: 'hidden',
    flexDirection: 'row',
  },
  barSegmentGap: { borderLeftWidth: 1.5, borderLeftColor: '#FFFFFF' },
  barSheen: { position: 'absolute', left: 0, right: 0, top: 0, height: 4 },

  // One ruled band instead of four floating chips.
  ledger: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: A.line,
    backgroundColor: '#FCFAF5',
    paddingVertical: 12,
  },
  ledgerRule: { width: 1, marginVertical: 4, backgroundColor: A.lineSoft },
  ledgerCol: { flex: 1, minWidth: 0, alignItems: 'center', paddingHorizontal: 4, rowGap: 5 },
  ledgerValue: {
    fontFamily: F.serifSemiBold,
    fontSize: 24,
    lineHeight: 27,
    letterSpacing: -0.4,
    includeFontPadding: false,
    fontVariant: ['lining-nums', 'tabular-nums'],
  },
  ledgerLabel: {
    fontFamily: F.sansBold,
    fontSize: 8.6,
    letterSpacing: 1.05,
    color: A.faint,
  },
});

const cs = StyleSheet.create({
  card: { ...cardShell, padding: 18 },
  rows: { marginTop: 16, rowGap: 9 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FCFAF6',
    borderRadius: 15,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: A.lineSoft,
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowLabel: { fontFamily: F.serifMedium, fontSize: 17, lineHeight: 21, color: A.ink },
  rowBar: { marginTop: 8 },
  rowPct: {
    fontFamily: F.serifSemiBold,
    fontSize: 19,
    fontVariant: ['tabular-nums'],
  },
});

const sec = StyleSheet.create({
  wrap: { rowGap: 10 },
  head: { paddingHorizontal: 2, marginBottom: 2 },
  empty: {
    ...cardShell,
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: { fontFamily: F.serifMediumItalic, fontSize: 16, color: A.faint },
});

const grid = StyleSheet.create({
  row: { flexDirection: 'row', columnGap: 7 },
});

const ch = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.42)',
    borderLeftWidth: 4,
    borderLeftColor: 'rgba(197,160,89,0.65)',
    backgroundColor: '#FFFDF7',
    overflow: 'hidden',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderCurve: 'continuous',
    backgroundColor: '#FFF5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, minWidth: 0 },
  title: { fontFamily: F.serifMedium, fontSize: 17, lineHeight: 21, color: A.ink },
  bar: { marginTop: 7 },
  pct: {
    fontFamily: F.serifSemiBold,
    fontSize: 19,
    color: GOLD,
    fontVariant: ['tabular-nums'],
  },
  expanded: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(197,160,89,0.22)',
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: 'rgba(255,251,235,0.5)',
  },
});

const hb = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: A.line,
    backgroundColor: A.surface,
    overflow: 'hidden',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  body: { flex: 1, minWidth: 0 },
  title: { fontFamily: F.serifMedium, fontSize: 17, lineHeight: 21, color: A.ink },
  bar: { marginTop: 7 },
  pct: { fontFamily: F.serifSemiBold, fontSize: 19, fontVariant: ['tabular-nums'] },
  expanded: {
    borderTopWidth: 1,
    borderTopColor: A.lineSoft,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#FBFAF7',
  },
  expandedKicker: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 1.4, color: A.faint },
  subTask: {
    borderRadius: 13,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: A.lineSoft,
    backgroundColor: A.surface,
    padding: 11,
  },
  subTaskHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', columnGap: 8 },
  subTaskTitle: { flex: 1, fontFamily: F.serifMedium, fontSize: 15.5, color: A.ink },
  subTaskPct: { fontFamily: F.serifSemiBold, fontSize: 15.5, fontVariant: ['tabular-nums'] },
});

const ms = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: 0,
    borderRadius: 11,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: A.lineSoft,
    backgroundColor: A.surface,
    paddingVertical: 9,
    paddingHorizontal: 3,
    alignItems: 'center',
  },
  tileSmall: { paddingVertical: 7 },
  value: { fontFamily: F.serifSemiBold, fontSize: 16, lineHeight: 19, fontVariant: ['tabular-nums'] },
  valueSmall: { fontSize: 14.5, lineHeight: 17 },
  label: { marginTop: 2, fontFamily: F.sansBold, fontSize: 10, letterSpacing: 0.4, color: A.faint },
  labelSmall: { fontSize: 9, letterSpacing: 0.2 },
});

const rg = StyleSheet.create({
  card: {
    ...cardShell,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  row: { flexDirection: 'row', alignItems: 'center', columnGap: 12, paddingVertical: 12 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: A.lineSoft },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: { fontFamily: F.serifMedium, fontSize: 16.5, lineHeight: 20, color: A.ink },
  rowBar: { marginTop: 7 },
  rowPct: { fontFamily: F.serifSemiBold, fontSize: 17, fontVariant: ['tabular-nums'] },
});

const qt = StyleSheet.create({
  card: { ...cardShell, padding: 18 },
  grid: { marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', columnGap: 9, rowGap: 9 },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    minWidth: 0,
    borderRadius: 15,
    borderCurve: 'continuous',
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  tileValue: {
    fontFamily: F.serifSemiBold,
    fontSize: 27,
    lineHeight: 31,
    fontVariant: ['tabular-nums'],
  },
  tileLabel: {
    marginTop: 4,
    fontFamily: F.sansSemiBold,
    fontSize: 12.5,
    letterSpacing: 0.2,
    color: A.muted,
  },
});
