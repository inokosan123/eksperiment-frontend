import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import { BarChart3, Calendar, CheckSmall, ChevronRight, Target, X } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import FocusNativeActivityReport from './FocusNativeActivityReport';
import FocusSegments from './FocusSegments';
import { SESSION_COLORS } from './SessionClockEditor';
import {
  dateKey,
  formatMinutesShort,
  formatTimeOfDay,
  getPlanSnapshotForDate,
  normalizeConnectedSessions,
  useDayPlan,
  type DayPlan,
  type DayRecord,
  type PlanZone,
} from './dayPlanStore';

const enter = (delay: number) => FadeInDown.duration(420).delay(delay);
const REVIEW_DAY_COUNT = 14;

type AnalyticsViewMode = 'trend' | 'day';

function dateFromKey(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function shiftDateKey(key: string, days: number) {
  const date = dateFromKey(key);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

function fullDate(key: string) {
  return dateFromKey(key).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function compactDate(key: string) {
  return dateFromKey(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function recentDateKeys(count: number) {
  const today = dateKey(new Date());
  return Array.from({ length: count }, (_, index) => shiftDateKey(today, index - count + 1));
}

function planRuleCount(session: PlanZone) {
  return (session.rules ?? []).reduce((count, rule) => {
    const groupProtected = rule.mode === 'blocked' || rule.dailyMinutes != null;
    const appProtected = (rule.appRules ?? []).filter(app => app.mode === 'blocked' || app.minutes != null).length;
    return count + (groupProtected ? 1 : 0) + appProtected;
  }, 0);
}

function targetState(record: DayRecord | undefined, plan: DayPlan | null, key: string, today: string) {
  if (record?.targetLost || record?.status === 'broken') {
    return { label: 'TARGET MISSED', tone: 'lost' as const };
  }
  if (plan?.budgetMinutes == null) {
    return { label: 'NO DAILY TARGET', tone: 'neutral' as const };
  }
  if (key === today) {
    return { label: 'IN PROGRESS', tone: 'active' as const };
  }
  if (record?.status === 'kept') {
    return { label: 'TARGET KEPT', tone: 'kept' as const };
  }
  return { label: 'NOT RESOLVED', tone: 'neutral' as const };
}

function SessionOutline({ plan, dayKey }: { plan: DayPlan; dayKey: string }) {
  const state = useDayPlan();
  const ledger = state.eligibilityByDate[dayKey];
  const sessions = normalizeConnectedSessions(plan.zones);

  return (
    <View style={s.sessionList}>
      {sessions.map((session, index) => {
        const prefix = `${session.id}:`;
        const continuationRecorded = [
          ...Object.entries(ledger?.groups ?? {}),
          ...Object.entries(ledger?.apps ?? {}),
        ].some(([key, value]) => key.startsWith(prefix) && value === 'lost');
        const count = planRuleCount(session);
        return (
          <View key={session.id}>
            {index > 0 && <View style={s.separator} />}
            <View style={s.sessionRow}>
              <View style={[s.sessionLine, { backgroundColor: SESSION_COLORS[index % SESSION_COLORS.length] }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.sessionName}>{session.name}</Text>
                <Text style={s.sessionTime}>
                  {formatTimeOfDay(session.startMinutes)} - {formatTimeOfDay(session.endMinutes)}
                </Text>
              </View>
              <View style={[s.sessionOutcome, continuationRecorded && s.sessionOutcomeLost]}>
                <Text style={[s.sessionOutcomeText, continuationRecorded && s.sessionOutcomeTextLost]}>
                  {continuationRecorded ? 'OVERRIDE USED' : count > 0 ? `${count} RULE${count === 1 ? '' : 'S'}` : 'NO LIMITS'}
                </Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function FocusAnalyticsView() {
  const state = useDayPlan();
  const today = dateKey(new Date());
  const [viewMode, setViewMode] = useState<AnalyticsViewMode>('trend');
  const [selectedDay, setSelectedDay] = useState(today);
  const [trendPage, setTrendPage] = useState(0);
  const reviewDays = recentDateKeys(REVIEW_DAY_COUNT);
  const selectedDate = dateFromKey(selectedDay);
  const selectedPlan = getPlanSnapshotForDate(state, selectedDate);
  const selectedRecord = state.days[selectedDay];
  const selectedTarget = targetState(selectedRecord, selectedPlan, selectedDay, today);
  const protectedDays = Object.values(state.days).filter(day => day.status === 'kept' || day.status === 'broken');
  const keptDays = protectedDays.filter(day => day.status === 'kept').length;
  const consistency = protectedDays.length > 0 ? Math.round((keptDays / protectedDays.length) * 100) : null;
  const trendEnd = shiftDateKey(today, -30 * trendPage);
  const trendStart = shiftDateKey(trendEnd, -29);
  const atToday = selectedDay === today;
  const oldestReviewDay = shiftDateKey(today, -365);

  const moveSelectedDay = (delta: number) => {
    const next = shiftDateKey(selectedDay, delta);
    if (next > today || next < oldestReviewDay) return;
    setSelectedDay(next);
  };

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
        <ScreenTitleBar title="FOCUS ANALYTICS" showBack horizontalBleed={16} />

        <Animated.View entering={enter(0)} style={s.summaryBand}>
          <View style={s.summaryMetric}>
            <Text style={s.metricLabel}>CONSISTENCY</Text>
            <Text style={s.metricValue}>{consistency == null ? '--' : `${consistency}%`}</Text>
            <Text style={s.metricHint}>{protectedDays.length} resolved days</Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryMetric}>
            <Text style={s.metricLabel}>CURRENT STREAK</Text>
            <Text style={s.metricValue}>{state.streak.current}</Text>
            <Text style={s.metricHint}>{state.streak.trophies} trophies earned</Text>
          </View>
        </Animated.View>

        <Animated.View entering={enter(50)} style={{ marginBottom: 10 }}>
          <FocusSegments
            options={[
              { key: 'trend', label: '30-day trend' },
              { key: 'day', label: 'Daily review' },
            ]}
            value={viewMode}
            onChange={key => setViewMode(key as AnalyticsViewMode)}
          />
        </Animated.View>

        {viewMode === 'trend' && <Animated.View entering={enter(70)}>
          <View style={s.sectionHeader}>
            <View>
              <Text style={s.sectionLabel}>PRIVATE PHONE TIME</Text>
              <Text style={s.sectionTitle}>Your activity trend</Text>
            </View>
            <BarChart3 s={21} c={C.goldDark} w={1.9} />
          </View>
          <View style={s.dateNavigator}>
            <TouchableOpacity
              style={[s.navButton, trendPage >= 12 && s.navButtonDisabled]}
              onPress={() => setTrendPage(page => Math.min(12, page + 1))}
              disabled={trendPage >= 12}
              accessibilityLabel="Earlier 30 days"
            >
              <View style={s.chevronBack}><ChevronRight s={17} c={trendPage >= 12 ? C.border : C.textSecondary} w={2.1} /></View>
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={s.selectedDate}>{trendPage === 0 ? 'Recent 30 days' : `${compactDate(trendStart)} - ${compactDate(trendEnd)}`}</Text>
              <Text style={s.selectedDateMeta}>PRIVATE IPHONE ACTIVITY</Text>
            </View>
            <TouchableOpacity
              style={[s.navButton, trendPage === 0 && s.navButtonDisabled]}
              onPress={() => setTrendPage(page => Math.max(0, page - 1))}
              disabled={trendPage === 0}
              accessibilityLabel="Newer 30 days"
            >
              <ChevronRight s={17} c={trendPage === 0 ? C.border : C.textSecondary} w={2.1} />
            </TouchableOpacity>
          </View>
          <FocusNativeActivityReport date={trendEnd} days={30} />
        </Animated.View>}

        {viewMode === 'day' && <Animated.View entering={enter(70)}>
          <View style={s.sectionHeader}>
            <View>
              <Text style={s.sectionLabel}>DAILY REVIEW</Text>
              <Text style={s.sectionTitle}>Plan and activity</Text>
            </View>
            <Calendar s={21} c={C.goldDark} w={1.9} />
          </View>

          <View style={s.dateNavigator}>
            <TouchableOpacity
              style={s.navButton}
              onPress={() => moveSelectedDay(-1)}
              disabled={selectedDay <= oldestReviewDay}
              accessibilityLabel="Previous day"
            >
              <View style={s.chevronBack}><ChevronRight s={17} c={C.textSecondary} w={2.1} /></View>
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={s.selectedDate}>{fullDate(selectedDay)}</Text>
              <Text style={s.selectedDateMeta}>{selectedPlan?.name ?? 'No Screen Time plan'}</Text>
            </View>
            <TouchableOpacity
              style={[s.navButton, atToday && s.navButtonDisabled]}
              onPress={() => moveSelectedDay(1)}
              disabled={atToday}
              accessibilityLabel="Next day"
            >
              <ChevronRight s={17} c={atToday ? C.border : C.textSecondary} w={2.1} />
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dayStrip}>
            {reviewDays.map(key => {
              const day = dateFromKey(key);
              const selected = key === selectedDay;
              const record = state.days[key];
              return (
                <TouchableOpacity
                  key={key}
                  style={[s.dayButton, selected && s.dayButtonSelected]}
                  onPress={() => setSelectedDay(key)}
                  haptic="selection"
                >
                  <Text style={[s.dayWeekday, selected && s.dayWeekdaySelected]}>
                    {day.toLocaleDateString(undefined, { weekday: 'narrow' })}
                  </Text>
                  <Text style={[s.dayNumber, selected && s.dayNumberSelected]}>{day.getDate()}</Text>
                  <View style={[
                    s.dayDot,
                    record?.status === 'kept' && s.dayDotKept,
                    record?.status === 'broken' && s.dayDotBroken,
                  ]} />
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={s.planBand}>
            <View style={{ flex: 1 }}>
              <Text style={s.planKicker}>{selectedPlan?.kind === 'session' ? 'SESSION PLAN' : selectedPlan ? 'DAILY PLAN' : 'REST DAY'}</Text>
              <Text style={s.planName}>{selectedPlan?.name ?? 'No plan assigned'}</Text>
              <Text style={s.planTarget}>
                {selectedPlan?.budgetMinutes == null
                  ? 'No Daily Target'
                  : `${formatMinutesShort(selectedPlan.budgetMinutes)} Daily Target`}
              </Text>
            </View>
            <View style={[
              s.targetTag,
              selectedTarget.tone === 'kept' && s.targetTagKept,
              selectedTarget.tone === 'lost' && s.targetTagLost,
              selectedTarget.tone === 'active' && s.targetTagActive,
            ]}>
              {selectedTarget.tone === 'kept' && <CheckSmall s={11} c="#2F7557" w={2.7} />}
              {selectedTarget.tone === 'lost' && <X s={10} c="#A24351" w={2.7} />}
              <Text style={[
                s.targetTagText,
                selectedTarget.tone === 'kept' && s.targetTagTextKept,
                selectedTarget.tone === 'lost' && s.targetTagTextLost,
                selectedTarget.tone === 'active' && s.targetTagTextActive,
              ]}>{selectedTarget.label}</Text>
            </View>
          </View>

          {selectedPlan?.kind === 'session' && (
            <>
              <Text style={s.subsectionLabel}>SESSION OUTLINE</Text>
              <SessionOutline plan={selectedPlan} dayKey={selectedDay} />
            </>
          )}

          <Text style={s.subsectionLabel}>PRIVATE ACTIVITY DETAIL</Text>
          <FocusNativeActivityReport date={selectedDay} />
        </Animated.View>}

        <Animated.View entering={enter(210)} style={s.consistencyBand}>
          <View style={s.consistencyIcon}><Target s={21} c={C.goldDark} w={2} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.consistencyTitle}>
              {consistency == null ? 'Your first resolved day is still ahead.' : `${keptDays} of ${protectedDays.length} resolved targets kept`}
            </Text>
            <Text style={s.consistencyBody}>Best streak {state.streak.best} days</Text>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  page: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 120, gap: 28 },
  summaryBand: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: C.border,
    paddingVertical: 17,
  },
  summaryMetric: { flex: 1, paddingHorizontal: 9 },
  summaryDivider: { width: StyleSheet.hairlineWidth, backgroundColor: C.border },
  metricLabel: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.6, color: C.textMuted },
  metricValue: { marginTop: 5, fontFamily: F.serifMedium, fontSize: 31, letterSpacing: -0.3, color: C.text, fontVariant: ['tabular-nums'] },
  metricHint: { marginTop: 2, fontFamily: F.sans, fontSize: 10, color: C.textMuted },
  sectionHeader: { minHeight: 47, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionLabel: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.6, color: C.goldDark },
  sectionTitle: { marginTop: 3, fontFamily: F.serifMedium, fontSize: 21, letterSpacing: -0.2, color: C.text },
  segmentedControl: {
    height: 40,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#F2EFE8',
    borderRadius: 12,
    borderCurve: 'continuous',
    padding: 3,
    marginBottom: 10,
  },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 9, borderCurve: 'continuous' },
  segmentActive: {
    backgroundColor: C.surface,
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  segmentText: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1, color: C.textMuted },
  segmentTextActive: { color: C.goldDark },
  dateNavigator: { minHeight: 61, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border },
  navButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  navButtonDisabled: { opacity: 0.55 },
  chevronBack: { transform: [{ rotate: '180deg' }] },
  selectedDate: { fontFamily: F.serifMedium, fontSize: 17, color: C.text },
  selectedDateMeta: { marginTop: 2, fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.2, color: C.textMuted },
  dayStrip: { gap: 7, paddingVertical: 12, paddingHorizontal: 2 },
  dayButton: { width: 44, height: 60, borderRadius: 13, borderCurve: 'continuous', borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  dayButtonSelected: { borderColor: C.goldDark, backgroundColor: C.goldLight },
  dayWeekday: { fontFamily: F.sansBold, fontSize: 8, color: C.textMuted },
  dayWeekdaySelected: { color: C.goldDark },
  dayNumber: { marginTop: 3, fontFamily: F.serifMedium, fontSize: 16, color: C.text, fontVariant: ['tabular-nums'] },
  dayNumberSelected: { color: C.goldDark },
  dayDot: { marginTop: 4, width: 5, height: 5, borderRadius: 3, backgroundColor: C.border },
  dayDotKept: { backgroundColor: '#5E9279' },
  dayDotBroken: { backgroundColor: '#B86570' },
  planBand: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border },
  planKicker: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.4, color: C.textMuted },
  planName: { marginTop: 4, fontFamily: F.serifMedium, fontSize: 19, letterSpacing: -0.2, color: C.text },
  planTarget: { marginTop: 3, fontFamily: F.sansMedium, fontSize: 10.5, color: C.textSecondary },
  targetTag: { minHeight: 26, maxWidth: 124, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: '#F2EFE8', paddingHorizontal: 9 },
  targetTagKept: { borderColor: '#B9D7C8', backgroundColor: '#E9F4EE' },
  targetTagLost: { borderColor: '#E6B8C0', backgroundColor: '#F8E7EA' },
  targetTagActive: { borderColor: '#E3CC93', backgroundColor: C.goldLight },
  targetTagText: { fontFamily: F.sansBold, fontSize: 7.5, letterSpacing: 0.8, color: C.textMuted, textAlign: 'center' },
  targetTagTextKept: { color: '#2F7557' },
  targetTagTextLost: { color: '#A24351' },
  targetTagTextActive: { color: C.goldDark },
  subsectionLabel: { marginTop: 18, marginBottom: 9, fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.6, color: C.textMuted },
  sessionList: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: C.border },
  sessionRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 8, paddingHorizontal: 3 },
  sessionLine: { width: 4, height: 36, borderRadius: 2 },
  sessionName: { fontFamily: F.serifMedium, fontSize: 16, color: C.text },
  sessionTime: { marginTop: 2.5, fontFamily: F.sansMedium, fontSize: 10, color: C.textMuted, fontVariant: ['tabular-nums'] },
  sessionOutcome: { minHeight: 24, maxWidth: 104, borderRadius: 999, backgroundColor: '#F2EFE8', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 9 },
  sessionOutcomeLost: { backgroundColor: '#F8E7EA' },
  sessionOutcomeText: { fontFamily: F.sansBold, fontSize: 7.5, letterSpacing: 0.8, color: C.textMuted, textAlign: 'center' },
  sessionOutcomeTextLost: { color: '#A24351' },
  consistencyBand: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border, paddingVertical: 13 },
  consistencyIcon: { width: 44, height: 44, borderRadius: 14, borderCurve: 'continuous', backgroundColor: C.goldLight, alignItems: 'center', justifyContent: 'center' },
  consistencyTitle: { fontFamily: F.serifMedium, fontSize: 16.5, color: C.text },
  consistencyBody: { marginTop: 3, fontFamily: F.sansMedium, fontSize: 10.5, color: C.textMuted },
});
