import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import {
  CheckSmall,
  ChevronDown,
  ChevronUp,
  ListChecks,
  Target,
  Trophy,
} from '@/components/icons/Icons';
import AnalyticsChart from '@/components/analytics/AnalyticsChart';
import HeatmapCalendar from '@/components/analytics/HeatmapCalendar';
import HighlightCards, { QuickTaskHighlightCards } from '@/components/analytics/HighlightCards';
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


const BG = '#FAF7F0';
const GOLD = '#C5A059';

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

export default function StatisticsView() {
  const { ready, overview, instances, habits, habitIdByTaskId, taskMetaById, challenges } = useAnalytics();
  const [tab, setTab] = useState<FilterTab>('all');

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

      {/* Tab strip */}
      <View style={s.tabsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabsRow}>
          {TABS.map(t => {
            const active = t.key === tab;
            if (active) {
              return (
                <TouchableOpacity
                  key={t.key}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setTab(t.key);
                  }}
                  activeOpacity={0.84}
                >
                  <LinearGradient
                    colors={['#E2BD75', '#C5A059', '#A87E33']}
                    locations={[0, 0.55, 1]}
                    start={{ x: 0.15, y: 0 }}
                    end={{ x: 0.85, y: 1 }}
                    style={[s.tabPill, s.tabPillActive]}
                  >
                    <Text style={[s.tabLabel, s.tabLabelActive]}>{t.label}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              );
            }
            return (
              <TouchableOpacity
                key={t.key}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setTab(t.key);
                }}
                activeOpacity={0.84}
                style={s.tabPill}
              >
                <Text style={s.tabLabel}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
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
            <HeroStats bucket={heroBucket} />

            {tab === 'quickTasks' && quickHighlights ? (
              <QuickTaskHighlightCards {...quickHighlights} />
            ) : streakLeaders ? (
              <HighlightCards {...streakLeaders} />
            ) : null}

            <AnalyticsChart snapshots={overview.dailySnapshots} sourceFilter={sourceFilter} />

            {tab === 'all' && (
              <CategorySection
                challengesPct={overview.global.source.challenges.pct}
                habitsPct={overview.global.source.habits.pct}
                routineTasksPct={overview.global.source.routineTasks.pct}
                spiritualTasksPct={overview.global.source.spiritualTasks.pct}
                otherTasksPct={overview.global.source.otherTasks.pct}
                quickTasksPct={overview.global.source.quickTasks.pct}
                onJump={key => setTab(key)}
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
                title="ROUTINE TASKS"
                items={taskCategoryBreakdown.routineTasks}
                accent="#16A34A"
                bg="#FFFFFF"
              />
            )}

            {tab === 'spiritualTasks' && (
              <TaskBreakdownSection
                title="SPIRITUAL TASKS"
                items={taskCategoryBreakdown.spiritualTasks}
                accent={GOLD}
                bg="#FFFBEB"
              />
            )}

            {tab === 'otherTasks' && (
              <TaskBreakdownSection
                title="OTHER TASKS"
                items={taskCategoryBreakdown.otherTasks}
                accent="#374151"
                bg="#FFFFFF"
              />
            )}

            {tab === 'quickTasks' && (
              <QuickTaskOverview
                bucket={overview.global.source.quickTasks}
              />
            )}

            <HeatmapCalendar snapshots={overview.dailySnapshots} sourceFilter={sourceFilter} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

/* ─── Hero stats ─── */

function HeroStats({ bucket }: { bucket: CountBucket }) {
  const pending = Math.max(0, bucket.scheduled - bucket.completed - bucket.skipped - bucket.missed);

  return (
    <View style={hs.card}>
      <View style={hs.row}>
        <View style={hs.circle}>
          <Text style={hs.circlePct}>{bucket.pct}%</Text>
        </View>
        <View style={hs.stats}>
          <Stat value={bucket.completed} label="DONE" color="#4F6B43" />
          <Stat value={bucket.skipped} label="SKIPPED" color="#9A7426" />
          <Stat value={bucket.missed} label="MISSED" color="#A05656" />
          <Stat value={pending} label="PENDING" color="#78716C" />
        </View>
      </View>
      <View style={hs.bar}>
        <View style={[hs.barFill, { width: `${bucket.pct}%` }]} />
      </View>
      <Text style={hs.summary}>
        {bucket.completed} of {bucket.scheduled} completed
      </Text>
    </View>
  );
}

function Stat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1, minWidth: 0 }}>
      <Text style={[hs.statValue, { color }]}>{value}</Text>
      <Text style={hs.statLabel}>{label}</Text>
    </View>
  );
}

/* ─── Section: All tab — category comparison ─── */

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
  return (
    <View style={cs.card}>
      <View style={cs.head}>
        <Target s={14} c={GOLD} w={2} />
        <Text style={cs.kicker}>BY CATEGORY</Text>
      </View>
      <View style={{ rowGap: 8 }}>
        <CategoryRow label="Challenges" pct={challengesPct} accent={GOLD} onPress={() => onJump('challenges')} />
        <CategoryRow label="Habits" pct={habitsPct} accent="#2563EB" onPress={() => onJump('habits')} />
        <CategoryRow label="Routine Tasks" pct={routineTasksPct} accent="#16A34A" onPress={() => onJump('routineTasks')} />
        <CategoryRow label="Spiritual Tasks" pct={spiritualTasksPct} accent={GOLD} onPress={() => onJump('spiritualTasks')} />
        <CategoryRow label="Other Tasks" pct={otherTasksPct} accent="#374151" onPress={() => onJump('otherTasks')} />
        <CategoryRow label="Quick Tasks" pct={quickTasksPct} accent="#D97706" onPress={() => onJump('quickTasks')} />
      </View>
    </View>
  );
}

function CategoryRow({ label, pct, accent, onPress }: { label: string; pct: number; accent: string; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.84} onPress={onPress} style={cs.row}>
      <View style={{ flex: 1 }}>
        <Text style={cs.rowLabel}>{label}</Text>
        <View style={cs.rowBar}>
          <View style={[cs.rowBarFill, { width: `${pct}%`, backgroundColor: accent }]} />
        </View>
      </View>
      <Text style={[cs.rowPct, { color: accent }]}>{pct}%</Text>
    </TouchableOpacity>
  );
}

/* ─── Section: Challenges ─── */

function ChallengeBreakdownSection({ items, globalPct }: { items: PerItemBreakdown[]; globalPct: number }) {
  return (
    <View style={{ rowGap: 8 }}>
      <View style={section.head}>
        <Target s={14} c={GOLD} w={2} />
        <Text style={section.kicker}>PER CHALLENGE</Text>
      </View>
      {items.length === 0 ? (
        <View style={section.empty}>
          <Text style={section.emptyText}>No challenges yet</Text>
        </View>
      ) : (
        items.map(item => <ChallengeBreakdownCard key={item.id} item={item} globalPct={globalPct} />)
      )}
    </View>
  );
}

function ChallengeBreakdownCard({ item, globalPct }: { item: PerItemBreakdown; globalPct: number }) {
  const [expanded, setExpanded] = useState(false);
  const diff = item.pct - globalPct;
  return (
    <View style={ch.card}>
      <TouchableOpacity activeOpacity={0.84} onPress={() => setExpanded(e => !e)} style={ch.head}>
        <View style={ch.iconBox}>
          <Trophy s={16} c={GOLD} w={2} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={ch.title} numberOfLines={1}>{item.name}</Text>
          <View style={ch.bar}>
            <View style={[ch.barFill, { width: `${item.pct}%` }]} />
          </View>
        </View>
        <Text style={ch.pct}>{item.pct}%</Text>
        {expanded ? <ChevronUp s={16} c="#A8A29E" /> : <ChevronDown s={16} c="#A8A29E" />}
      </TouchableOpacity>

      {expanded && (
        <View style={ch.expanded}>
          <ExpandStat label="STREAK" value={`${item.currentStreak} / ${item.bestStreak}`} />
          <ExpandStat
            label="VS AVERAGE"
            value={`${diff >= 0 ? '+' : ''}${diff}%`}
            valueColor={diff >= 0 ? '#15803D' : '#DC2626'}
          />
          <ExpandStat label="DONE" value={String(item.completed)} />
          <ExpandStat label="MISSED" value={String(item.missed)} />
        </View>
      )}
    </View>
  );
}

function ExpandStat({ label, value, valueColor = '#1A1714' }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={ch.expandStat}>
      <Text style={ch.expandLabel}>{label}</Text>
      <Text style={[ch.expandValue, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

/* ─── Section: Habits ─── */

function HabitBreakdownSection({ items }: { items: PerItemBreakdown[] }) {
  const active = items.filter(h => h.isActive !== false);
  const inactive = items.filter(h => h.isActive === false);

  return (
    <View style={{ rowGap: 8 }}>
      <View style={section.head}>
        <ListChecks s={14} c={GOLD} w={2} />
        <Text style={section.kicker}>ACTIVE</Text>
      </View>
      {active.length === 0 ? (
        <View style={section.empty}>
          <Text style={section.emptyText}>No active habits</Text>
        </View>
      ) : (
        active.map(item => <HabitBreakdownCard key={item.id} item={item} />)
      )}
      {inactive.length > 0 && (
        <>
          <View style={[section.head, { paddingTop: 8 }]}>
            <ListChecks s={14} c="#A8A29E" w={2} />
            <Text style={[section.kicker, { color: '#A8A29E' }]}>INACTIVE / ARCHIVED</Text>
          </View>
          {inactive.map(item => (
            <View key={item.id} style={{ opacity: 0.6 }}>
              <HabitBreakdownCard item={item} />
            </View>
          ))}
        </>
      )}
    </View>
  );
}

function HabitBreakdownCard({ item }: { item: PerItemBreakdown }) {
  const [expanded, setExpanded] = useState(false);
  const accent = item.color || GOLD;
  return (
    <View style={[hb.card, { borderLeftWidth: 4, borderLeftColor: accent }]}>
      <TouchableOpacity activeOpacity={0.84} onPress={() => setExpanded(e => !e)} style={hb.head}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={hb.title} numberOfLines={1}>{item.name}</Text>
          <View style={hb.bar}>
            <View style={[hb.barFill, { width: `${item.pct}%`, backgroundColor: accent }]} />
          </View>
        </View>
        <Text style={[hb.pct, { color: accent }]}>{item.pct}%</Text>
        {expanded ? <ChevronUp s={16} c="#A8A29E" /> : <ChevronDown s={16} c="#A8A29E" />}
      </TouchableOpacity>

      {expanded && (
        <View style={hb.expanded}>
          <Text style={hb.expandedKicker}>OVERALL</Text>
          <View style={hb.statsGrid}>
            <MiniStat value={item.completed} label="DONE" color="#4F6B43" />
            <MiniStat value={item.skipped} label="SKIPPED" color="#9A7426" />
            <MiniStat value={item.missed} label="MISSED" color="#A05656" />
            <MiniStat value={`${item.currentStreak}/${item.bestStreak}`} label="STREAK" color="#1A1714" />
          </View>

          {item.subTasks && item.subTasks.length > 0 && (
            <>
              <Text style={[hb.expandedKicker, { marginTop: 12 }]}>TASKS</Text>
              <View style={{ rowGap: 8, marginTop: 8 }}>
                {item.subTasks.map(t => (
                  <View key={t.id} style={hb.subTask}>
                    <View style={hb.subTaskHead}>
                      <Text style={hb.subTaskTitle} numberOfLines={1}>{t.name}</Text>
                      <Text style={[hb.subTaskPct, { color: accent }]}>{t.pct}%</Text>
                    </View>
                    <View style={hb.subTaskGrid}>
                      <MiniStat value={t.completed} label="DONE" color="#4F6B43" small />
                      <MiniStat value={t.skipped} label="SKIPPED" color="#9A7426" small />
                      <MiniStat value={t.missed} label="MISSED" color="#A05656" small />
                      <MiniStat value={`${t.currentStreak}/${t.bestStreak}`} label="STREAK" color="#1A1714" small />
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      )}
    </View>
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
      <Text style={[ms.value, { color }, small && ms.valueSmall]}>{value}</Text>
      <Text style={[ms.label, small && ms.labelSmall]}>{label}</Text>
    </View>
  );
}

/* ─── Section: Routines ─── */

function TaskBreakdownSection({
  title,
  items,
  accent,
  bg,
}: {
  title: string;
  items: PerItemBreakdown[];
  accent: string;
  bg: string;
}) {
  return (
    <View style={{ rowGap: 8 }}>
      <View style={section.head}>
        <CheckSmall s={14} c={accent} w={2.4} />
        <Text style={[section.kicker, { color: accent }]}>{title}</Text>
      </View>
      <RoutineGroupCard title={title} items={items} accent={accent} bg={bg} />
    </View>
  );
}

function RoutineGroupCard({
  title,
  items,
  accent,
  bg,
}: {
  title: string;
  items: PerItemBreakdown[];
  accent: string;
  bg: string;
}) {
  return (
    <View style={[rg.card, { backgroundColor: bg, borderLeftWidth: 4, borderLeftColor: accent }]}>
      <Text style={rg.title}>{title.toUpperCase()}</Text>
      {items.length === 0 ? (
        <Text style={rg.empty}>No tasks yet</Text>
      ) : (
        <View style={{ rowGap: 6, marginTop: 8 }}>
          {items.map(item => (
            <View key={item.id} style={rg.row}>
              <Text style={rg.rowName} numberOfLines={1}>{item.name}</Text>
              <Text style={[rg.rowPct, { color: accent }]}>{item.pct}%</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/* ─── Section: Quick tasks overview ─── */

function QuickTaskOverview({ bucket }: { bucket: CountBucket }) {
  const pending = Math.max(0, bucket.scheduled - bucket.completed - bucket.skipped - bucket.missed);

  return (
    <View style={qt.card}>
      <View style={section.head}>
        <Target s={14} c={GOLD} w={2} />
        <Text style={section.kicker}>OVERVIEW</Text>
      </View>
      <View style={qt.grid}>
        <View style={qt.tile}>
          <Text style={qt.tileLabel}>SCHEDULED</Text>
          <Text style={qt.tileValue}>{bucket.scheduled}</Text>
        </View>
        <View style={qt.tile}>
          <Text style={qt.tileLabel}>COMPLETED</Text>
          <Text style={[qt.tileValue, { color: GOLD }]}>{bucket.completed}</Text>
        </View>
        <View style={qt.tile}>
          <Text style={qt.tileLabel}>SKIPPED</Text>
          <Text style={[qt.tileValue, { color: '#9A7426' }]}>{bucket.skipped}</Text>
        </View>
        <View style={qt.tile}>
          <Text style={qt.tileLabel}>MISSED</Text>
          <Text style={[qt.tileValue, { color: '#A05656' }]}>{bucket.missed}</Text>
        </View>
        <View style={qt.tile}>
          <Text style={qt.tileLabel}>PENDING</Text>
          <Text style={[qt.tileValue, { color: '#78716C' }]}>{pending}</Text>
        </View>
      </View>
    </View>
  );
}

/* ─── Styles ─── */

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  loadingText: {
    fontFamily: F.serifMediumItalic,
    fontSize: 15,
    color: '#A8A29E',
    textAlign: 'center',
    marginTop: 60,
  },
  tabsWrap: { backgroundColor: BG, paddingBottom: 6 },
  tabsRow: { columnGap: 8, paddingHorizontal: 16, paddingVertical: 4 },
  tabPill: {
    minHeight: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0EDE6',
  },
  tabPillActive: {
    borderWidth: 0,
    shadowColor: '#A87E33',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 12,
    elevation: 3,
  },
  tabLabel: { fontFamily: F.sansBold, fontSize: 12, letterSpacing: 0.6, color: '#78716C' },
  tabLabelActive: { color: '#FFFFFF', letterSpacing: 0.8 },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 80, rowGap: 14 },
});

const hs = StyleSheet.create({
  card: {
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0EDE6',
    padding: 16,
    shadowColor: '#1C1917',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 7,
    elevation: 1,
  },
  row: { flexDirection: 'row', alignItems: 'center', columnGap: 16 },
  circle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: 'rgba(197,160,89,0.28)',
    backgroundColor: '#FFFBEB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circlePct: { fontFamily: F.serifSemiBold, fontSize: 24, color: GOLD },
  stats: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', columnGap: 4 },
  statValue: { fontFamily: F.serifSemiBold, fontSize: 20, lineHeight: 23 },
  statLabel: { marginTop: 4, fontFamily: F.sansBold, fontSize: 11, letterSpacing: 0.9, color: '#A8A29E' },
  bar: {
    marginTop: 14,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F4F0E8',
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 3, backgroundColor: GOLD },
  summary: {
    marginTop: 8,
    fontFamily: F.sans,
    fontSize: 13,
    color: '#A8A29E',
    textAlign: 'center',
  },
});

const cs = StyleSheet.create({
  card: {
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0EDE6',
    padding: 16,
    shadowColor: '#1C1917',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 7,
    elevation: 1,
  },
  head: { flexDirection: 'row', alignItems: 'center', columnGap: 6, marginBottom: 12 },
  kicker: { fontFamily: F.sansBold, fontSize: 12, letterSpacing: 2.2, color: GOLD },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FAFAF9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0EDE6',
  },
  rowLabel: { fontFamily: F.serifMedium, fontSize: 15, color: '#1A1714' },
  rowBar: {
    marginTop: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F0EDE6',
    overflow: 'hidden',
  },
  rowBarFill: { height: '100%', borderRadius: 3 },
  rowPct: { fontFamily: F.serifSemiBold, fontSize: 17 },
});

const section = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
    paddingHorizontal: 4,
  },
  kicker: { fontFamily: F.sansBold, fontSize: 12, letterSpacing: 2.2, color: GOLD },
  empty: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F0EDE6',
    backgroundColor: '#FFFFFF',
    paddingVertical: 28,
    alignItems: 'center',
  },
  emptyText: { fontFamily: F.serifMediumItalic, fontSize: 15, color: '#A8A29E' },
});

const ch = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderColor: 'rgba(197,160,89,0.55)',
    backgroundColor: '#FFFDF7',
    overflow: 'hidden',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 11,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: '#FFF5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: F.serifMedium, fontSize: 15, color: '#1A1714' },
  bar: {
    marginTop: 6,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#F0EDE6',
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 3, backgroundColor: GOLD },
  pct: { fontFamily: F.serifSemiBold, fontSize: 17, color: GOLD },
  expanded: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(197,160,89,0.20)',
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: 'rgba(255,251,235,0.45)',
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 12,
    rowGap: 8,
  },
  expandStat: { width: '46%', alignItems: 'center' },
  expandLabel: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 1.6, color: '#A8A29E' },
  expandValue: { marginTop: 4, fontFamily: F.serifMedium, fontSize: 15 },
});

const hb = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F0EDE6',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 11,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  title: { fontFamily: F.serifMedium, fontSize: 15, color: '#1A1714' },
  bar: {
    marginTop: 6,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#F0EDE6',
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 3 },
  pct: { fontFamily: F.serifSemiBold, fontSize: 17 },
  expanded: {
    borderTopWidth: 1,
    borderTopColor: '#F0EDE6',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FAFAF9',
  },
  expandedKicker: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 1.6, color: '#A8A29E' },
  statsGrid: {
    marginTop: 8,
    flexDirection: 'row',
    columnGap: 6,
  },
  subTask: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0EDE6',
    backgroundColor: '#FFFFFF',
    padding: 10,
  },
  subTaskHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', columnGap: 8 },
  subTaskTitle: { flex: 1, fontFamily: F.serifMedium, fontSize: 14, color: '#1A1714' },
  subTaskPct: { fontFamily: F.serifSemiBold, fontSize: 14 },
  subTaskGrid: { marginTop: 8, flexDirection: 'row', columnGap: 4 },
});

const ms = StyleSheet.create({
  tile: {
    flex: 1,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#F0EDE6',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    alignItems: 'center',
  },
  tileSmall: { paddingVertical: 6 },
  value: { fontFamily: F.serifSemiBold, fontSize: 14 },
  valueSmall: { fontSize: 13 },
  label: { marginTop: 2, fontFamily: F.sansBold, fontSize: 11, letterSpacing: 1.4, color: '#A8A29E' },
  labelSmall: { fontSize: 10 },
});

const rg = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F0EDE6',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  title: { fontFamily: F.sansBold, fontSize: 12, letterSpacing: 2, color: '#78716C' },
  empty: { marginTop: 8, fontFamily: F.serifMediumItalic, fontSize: 14, color: '#A8A29E' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', columnGap: 8 },
  rowName: { flex: 1, fontFamily: F.serifMedium, fontSize: 15, color: '#1A1714' },
  rowPct: { fontFamily: F.serifSemiBold, fontSize: 15 },
});

const qt = StyleSheet.create({
  card: {
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0EDE6',
    padding: 14,
    shadowColor: '#1C1917',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 7,
    elevation: 1,
  },
  grid: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 8 },
  tile: {
    flexBasis: '48%',
    flexGrow: 1,
    borderRadius: 12,
    backgroundColor: '#FAFAF9',
    paddingVertical: 12,
    alignItems: 'center',
  },
  tileLabel: { fontFamily: F.sansBold, fontSize: 11.5, letterSpacing: 1.6, color: '#A8A29E' },
  tileValue: { marginTop: 6, fontFamily: F.serifMedium, fontSize: 22, color: '#1A1714' },
});
