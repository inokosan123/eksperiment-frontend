import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import { BarChart3, ChevronRight, Pencil, Shield } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import DayGauge, { gaugeStanding, gaugeStateColor } from './DayGauge';
import FocusNativeActivityReport, { hasNativeActivityReport } from './FocusNativeActivityReport';
import PlanCardBackdrop from './PlanCardBackdrop';
import { planVisualFor } from './planVisuals';
import TodayUsageBreakdown from './TodayUsageBreakdown';
import { useNativeActivitySelectionSummary } from './nativeSelectionSummaryStore';
import {
  dateKey,
  formatMinutesShort,
  getEffectivePlan,
  getLiveUsageSnapshot,
  rulesForPlanAt,
  tickDayPlanStore,
  useDayPlan,
} from './dayPlanStore';

// Today's plan under a magnifying glass: the existing macro card stays intact,
// while private activity below it is ordered by real group and app usage.

const enter = (delay: number) => FadeInDown.duration(420).delay(delay);

export default function TodayDetailView() {
  const router = useRouter();
  const state = useDayPlan();
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      const next = Date.now();
      tickDayPlanStore(next);
      setNowMs(next);
    }, 30_000);
    return () => clearInterval(timer);
  }, []);
  const now = useMemo(() => new Date(nowMs), [nowMs]);
  const todayKey = dateKey(now);
  const plan = getEffectivePlan(state, now);
  const planEssentialsSummary = useNativeActivitySelectionSummary(
    `plan.${plan?.id ?? 'none'}.essentials`
  );
  const usage = getLiveUsageSnapshot(todayKey);
  const rules = useMemo(() => rulesForPlanAt(plan, now), [now, plan]);
  const dateLine = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  if (!plan) {
    return (
      <View style={s.screen}>
        <ScreenTitleBar title="TODAY" showBack />
        <View style={s.restWrap}>
          <View style={s.restSeal}>
            <Shield s={26} c="#B6533F" w={1.9} />
          </View>
          <Text style={s.restTitle}>No plan is protecting today</Text>
          <Text style={s.restBody}>Choose a Screen Time plan on the previous screen and today’s detail will live here.</Text>
        </View>
      </View>
    );
  }

  const visual = planVisualFor(plan);
  const goal = plan.budgetMinutes;
  const toleranceEnd = plan.essentialOnlyMinutes ?? plan.tolerableMinutes;
  const used = usage?.totalMinutes ?? null;
  const usageMatchesPlan = usage?.planId == null || usage.planId === plan.id;
  const groupUsageAvailable = !!usage && usageMatchesPlan;
  const appUsageAvailable = !!usage && usageMatchesPlan && Object.keys(usage.appMinutes).length > 0;
  const groupMinutes = usage?.groupMinutes ?? {};
  const appMinutes = usage?.appMinutes ?? {};
  const standing = goal != null ? gaugeStanding(goal, toleranceEnd, used) : 'unknown';
  const stateColor = gaugeStateColor(standing, visual.ink);
  const nativeActivityAvailable = hasNativeActivityReport();

  const headline = plan.essentialsOnly
    ? used == null
      ? 'Essentials-only access is active from minute one.'
      : standing === 'under'
        ? `Essentials-only is active · ${formatMinutesShort(Math.max(0, (goal ?? 0) - used))} left before your goal.`
        : standing === 'tolerance'
          ? `Essentials-only is active · ${formatMinutesShort(Math.max(0, (toleranceEnd ?? goal ?? 0) - used))} of tolerance left.`
          : 'Essentials-only is still active · the daily ceiling has been crossed.'
    : goal == null
    ? 'This plan works through group limits only.'
    : used == null
      ? `The goal is ${formatMinutesShort(goal)} of phone time.`
      : standing === 'under'
        ? `${formatMinutesShort(Math.max(0, goal - used))} left before your goal.`
        : standing === 'tolerance'
          ? `Past the goal — ${formatMinutesShort(Math.max(0, (toleranceEnd ?? goal) - used))} of tolerance left.`
          : 'Past every boundary — essentials only.';

  return (
    <View style={s.screen}>
      <ScreenTitleBar title="TODAY" showBack />
      <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
        <Animated.View entering={enter(0)}>
          <View style={[s.macroCard, { borderColor: visual.border }]}>
            <LinearGradient colors={visual.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <PlanCardBackdrop visual={visual} ringSize={190} live />
            <Text style={[s.macroKicker, { color: visual.accent }]}>{dateLine.toUpperCase()}</Text>
            <Text style={[s.macroName, { color: visual.ink }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>{plan.name}</Text>
            <Text style={[s.macroHeadline, { color: visual.body }]}>{headline}</Text>

            {goal != null && (
              <>
                <View style={s.macroValueRow}>
                  <Text style={[s.macroValueBig, { color: stateColor }]} numberOfLines={1}>
                    {used == null ? '– –' : formatMinutesShort(used)}
                  </Text>
                  <Text style={[s.macroValueGoal, { color: visual.body }]} numberOfLines={1}>
                    {' '}/ {formatMinutesShort(goal)}
                  </Text>
                </View>
                <Text style={[s.macroValueCaption, { color: visual.body }]}>screen time today</Text>
                <DayGauge
                  goalMinutes={goal}
                  toleranceEndMinutes={toleranceEnd}
                  usedMinutes={used}
                  accent={visual.accent}
                  labelColor={visual.body}
                  height={14}
                  style={s.macroGauge}
                />
              </>
            )}
            <Text style={[s.macroNote, { color: visual.body }]}>
              {used == null
                ? 'Exact activity stays inside Apple’s private report below.'
                : 'Live from your iPhone · numbers are approximate by design.'}
            </Text>
          </View>
        </Animated.View>

        <Animated.View entering={enter(60)}>
          <Text style={s.sectionLabel}>TODAY&apos;S ACTIVITY</Text>
          {nativeActivityAvailable ? (
            <FocusNativeActivityReport date={todayKey} />
          ) : plan.essentialsOnly ? (
            <View style={s.emptyGroups}>
              <Text style={s.emptyGroupsTitle}>Protected from minute one</Text>
              <Text style={s.emptyGroupsBody}>
                Global Essentials and {planEssentialsSummary?.applicationCount ?? plan.essentialAppIds?.length ?? 0} plan-only apps stay reachable. Every other shieldable app stays closed all day.
              </Text>
            </View>
          ) : (
            <TodayUsageBreakdown
              plan={plan}
              state={state}
              rules={rules}
              groupMinutes={groupMinutes}
              appMinutes={appMinutes}
              groupUsageAvailable={groupUsageAvailable}
              appUsageAvailable={appUsageAvailable}
              scopeLabel="Today"
            />
          )}
        </Animated.View>

        <Animated.View entering={enter(180)} style={s.actionsRow}>
          <TouchableOpacity
            style={s.actionButton}
            activeOpacity={0.78}
            onPress={() => router.push(`/day-plan?planId=${plan.id}` as never)}
          >
            <Pencil s={14} c={C.goldDark} w={2} />
            <Text style={s.actionButtonText}>Edit this plan</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.actionButton}
            activeOpacity={0.78}
            onPress={() => router.push('/focus-analytics' as never)}
          >
            <BarChart3 s={14} c={C.goldDark} w={2} />
            <Text style={s.actionButtonText}>Analytics</Text>
            <ChevronRight s={13} c={C.goldDark} w={2.2} />
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  page: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 100, gap: 22 },
  restWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingBottom: 90 },
  restSeal: { width: 62, height: 62, borderRadius: 21, borderCurve: 'continuous', backgroundColor: '#FBEDEA', alignItems: 'center', justifyContent: 'center' },
  restTitle: { marginTop: 16, fontFamily: F.serifSemiBold, fontSize: 22, letterSpacing: -0.25, color: C.text, textAlign: 'center' },
  restBody: { marginTop: 7, fontFamily: F.serif, fontSize: 14.5, lineHeight: 19.5, color: C.textSecondary, textAlign: 'center' },
  macroCard: { position: 'relative', borderRadius: 26, borderCurve: 'continuous', borderWidth: 1, overflow: 'hidden', padding: 18, boxShadow: '0 10px 28px rgba(69, 58, 39, 0.09)' },
  macroKicker: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.9 },
  macroName: { marginTop: 6, fontFamily: F.serifSemiBold, fontSize: 27, lineHeight: 30, letterSpacing: -0.4 },
  macroHeadline: { marginTop: 4, fontFamily: F.serif, fontSize: 14.5, lineHeight: 19 },
  macroValueRow: { marginTop: 16, flexDirection: 'row', alignItems: 'baseline', minWidth: 0 },
  macroValueBig: { fontFamily: F.serifSemiBold, fontSize: 40, lineHeight: 43, letterSpacing: -0.55, fontVariant: ['tabular-nums'] },
  macroValueGoal: { fontFamily: F.serifMedium, fontSize: 20, lineHeight: 25, fontVariant: ['tabular-nums'] },
  macroValueCaption: { marginTop: 2, fontFamily: F.sansMedium, fontSize: 10, lineHeight: 13.5 },
  macroGauge: { marginTop: 13 },
  macroNote: { marginTop: 12, fontFamily: F.sansMedium, fontSize: 9, lineHeight: 12.5 },
  sectionLabel: { marginBottom: 9, marginLeft: 4, fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.4, color: C.textMuted },
  sessionCard: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 18, borderCurve: 'continuous', borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  sessionDot: { width: 9, height: 9, borderRadius: 5 },
  sessionCopy: { flex: 1, minWidth: 0 },
  sessionName: { fontFamily: F.serifSemiBold, fontSize: 17.5, lineHeight: 21 },
  sessionTime: { marginTop: 2, fontFamily: F.sansMedium, fontSize: 10.5, fontVariant: ['tabular-nums'] },
  sessionLive: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  sessionLiveText: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.2 },
  emptyGroups: { borderRadius: 16, borderCurve: 'continuous', borderWidth: 1, borderStyle: 'dashed', borderColor: '#DDD8CC', backgroundColor: '#FEFDF9', paddingHorizontal: 16, paddingVertical: 15 },
  emptyGroupsTitle: { fontFamily: F.serifMedium, fontSize: 16, color: C.text },
  emptyGroupsBody: { marginTop: 3, fontFamily: F.sans, fontSize: 11, lineHeight: 15.5, color: C.textSecondary },
  actionsRow: { flexDirection: 'row', gap: 10 },
  actionButton: {
    flex: 1,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 15,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#E5D9BD',
    backgroundColor: '#FFF9EB',
  },
  actionButtonText: { fontFamily: F.sansSemiBold, fontSize: 11.5, color: C.goldDark },
});
