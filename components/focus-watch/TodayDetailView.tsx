import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import { BarChart3, ChevronRight, Lock, Pencil, Shield } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import DayGauge, { GAUGE_ESSENTIALS_COLOR, gaugeStanding, gaugeStateColor } from './DayGauge';
import { FocusMeter } from './FocusMeter';
import PlanCardBackdrop from './PlanCardBackdrop';
import { CATEGORY_TINTS, ESSENTIAL_APP_OPTIONS, PREVIEW_APPS } from './focusContent';
import { planVisualFor } from './planVisuals';
import {
  dateKey,
  formatMinutesShort,
  getEffectivePlan,
  getLiveUsageSnapshot,
  groupName,
  useDayPlan,
  type AppRule,
  type DayPlan,
} from './dayPlanStore';

// Today's plan under a magnifying glass: the same macro gauge as the hub,
// then every group boundary with how today's real activity stands against it.

const enter = (delay: number) => FadeInDown.duration(420).delay(delay);

const APP_NAMES: Record<string, string> = Object.fromEntries([
  ...PREVIEW_APPS.map(app => [app.id, app.name]),
  ...ESSENTIAL_APP_OPTIONS.map(app => [app.id, app.name]),
]);

type GroupRow = {
  groupId: string;
  plannedMinutes: number | null;
  blocked: boolean;
  appRules: AppRule[];
};

function buildGroupRows(plan: DayPlan): GroupRow[] {
  const source = plan.kind === 'session'
    ? plan.zones.flatMap(zone => zone.rules ?? [])
    : plan.rules;
  const map = new Map<string, GroupRow>();
  for (const rule of source) {
    const row = map.get(rule.groupId)
      ?? { groupId: rule.groupId, plannedMinutes: null, blocked: false, appRules: [] };
    const mode = rule.mode ?? (rule.dailyMinutes == null ? 'noLimit' : 'limit');
    if (mode === 'blocked') row.blocked = true;
    else if (mode === 'limit' && rule.dailyMinutes != null) {
      row.plannedMinutes = (row.plannedMinutes ?? 0) + rule.dailyMinutes;
    }
    for (const appRule of rule.appRules ?? []) {
      const appMode = appRule.mode ?? (appRule.minutes == null ? 'noLimit' : 'limit');
      if (appMode === 'blocked' || (appMode === 'limit' && appRule.minutes != null)) {
        if (!row.appRules.some(existing => existing.appId === appRule.appId)) {
          row.appRules.push(appRule);
        }
      }
    }
    map.set(rule.groupId, row);
  }
  return [...map.values()]
    .filter(row => row.blocked || row.plannedMinutes != null || row.appRules.length > 0)
    .sort((a, b) => {
      if (a.blocked !== b.blocked) return a.blocked ? 1 : -1;
      return (b.plannedMinutes ?? -1) - (a.plannedMinutes ?? -1);
    });
}

function groupTint(groupId: string) {
  return CATEGORY_TINTS[groupId] ?? { bg: C.goldLight, color: C.goldDark };
}

export default function TodayDetailView() {
  const router = useRouter();
  const state = useDayPlan();
  const now = new Date();
  const plan = getEffectivePlan(state, now);
  const usage = getLiveUsageSnapshot(dateKey(now));
  const rows = useMemo(() => (plan ? buildGroupRows(plan) : []), [plan]);
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
  const standing = goal != null ? gaugeStanding(goal, toleranceEnd, used) : 'unknown';
  const stateColor = gaugeStateColor(standing, visual.ink);

  const headline = goal == null
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
                ? 'Usage syncs privately from your iPhone and appears here as the day moves.'
                : 'Live from your iPhone · numbers are approximate by design.'}
            </Text>
          </View>
        </Animated.View>

        <Animated.View entering={enter(60)}>
          <Text style={s.sectionLabel}>GROUP BOUNDARIES</Text>
          {rows.length === 0 ? (
            <View style={s.emptyGroups}>
              <Text style={s.emptyGroupsTitle}>No group limits in this plan</Text>
              <Text style={s.emptyGroupsBody}>Open the plan and distribute its time across groups to see them here.</Text>
            </View>
          ) : (
            <View style={s.groupList}>
              {rows.map((row, index) => {
                const tint = groupTint(row.groupId);
                const groupUsed = usage ? usage.groupMinutes[row.groupId] ?? 0 : null;
                const over = row.plannedMinutes != null && groupUsed != null && groupUsed > row.plannedMinutes;
                const rightValue = row.blocked
                  ? 'Blocked'
                  : row.plannedMinutes == null
                    ? `${row.appRules.length} app ${row.appRules.length === 1 ? 'rule' : 'rules'}`
                    : groupUsed == null
                      ? `${formatMinutesShort(row.plannedMinutes)} planned`
                      : `${formatMinutesShort(groupUsed)} / ${formatMinutesShort(row.plannedMinutes)}`;
                const caption = row.blocked
                  ? 'Closed for the whole day'
                  : row.plannedMinutes != null && groupUsed != null
                    ? over
                      ? 'Limit used up'
                      : `${formatMinutesShort(row.plannedMinutes - groupUsed)} left today`
                    : null;
                return (
                  <View key={row.groupId}>
                    {index > 0 && <View style={s.groupSeparator} />}
                    <View style={s.groupRow}>
                      <View style={[s.groupAvatar, { backgroundColor: tint.bg }]}>
                        {row.blocked
                          ? <Lock s={15} c={tint.color} w={2.2} />
                          : <Text style={[s.groupAvatarText, { color: tint.color }]}>{groupName(state, row.groupId).slice(0, 1)}</Text>}
                      </View>
                      <View style={s.groupCopy}>
                        <View style={s.groupTitleRow}>
                          <Text style={s.groupName} numberOfLines={1}>{groupName(state, row.groupId)}</Text>
                          <Text style={[s.groupValue, over && { color: GAUGE_ESSENTIALS_COLOR }, row.blocked && { color: GAUGE_ESSENTIALS_COLOR }]} numberOfLines={1}>
                            {rightValue}
                          </Text>
                        </View>
                        {row.plannedMinutes != null && !row.blocked && (
                          <FocusMeter
                            fraction={groupUsed == null ? 0 : groupUsed / row.plannedMinutes}
                            height={7}
                            fill={over ? GAUGE_ESSENTIALS_COLOR : tint.color}
                            track="#F0EDE5"
                            style={s.groupMeter}
                          />
                        )}
                        {caption && <Text style={[s.groupCaption, over && { color: GAUGE_ESSENTIALS_COLOR }]}>{caption}</Text>}
                        {row.appRules.map(appRule => {
                          const appName = appRule.label?.trim() || APP_NAMES[appRule.appId] || 'App rule';
                          const appMode = appRule.mode ?? (appRule.minutes == null ? 'noLimit' : 'limit');
                          const appUsed = usage ? usage.appMinutes[appRule.appId] ?? 0 : null;
                          const appOver = appMode === 'limit' && appRule.minutes != null && appUsed != null && appUsed > appRule.minutes;
                          return (
                            <View key={appRule.appId} style={s.appRow}>
                              <View style={[s.appDot, { backgroundColor: tint.color }]} />
                              <Text style={s.appName} numberOfLines={1}>{appName}</Text>
                              <Text style={[s.appValue, (appOver || appMode === 'blocked') && { color: GAUGE_ESSENTIALS_COLOR }]} numberOfLines={1}>
                                {appMode === 'blocked'
                                  ? 'Blocked'
                                  : appUsed == null
                                    ? `${formatMinutesShort(appRule.minutes ?? 0)} planned`
                                    : `${formatMinutesShort(appUsed)} / ${formatMinutesShort(appRule.minutes ?? 0)}`}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </Animated.View>

        {usage != null && (() => {
          const covered = new Set(rows.map(row => row.groupId));
          const other = Object.entries(usage.groupMinutes)
            .filter(([groupId, minutes]) => !covered.has(groupId) && minutes > 0)
            .sort(([, a], [, b]) => b - a);
          if (other.length === 0) return null;
          return (
            <Animated.View entering={enter(120)}>
              <Text style={s.sectionLabel}>OUTSIDE THE PLAN</Text>
              <View style={s.groupList}>
                {other.map(([groupId, minutes], index) => {
                  const tint = groupTint(groupId);
                  return (
                    <View key={groupId}>
                      {index > 0 && <View style={s.groupSeparator} />}
                      <View style={s.otherRow}>
                        <View style={[s.appDot, { backgroundColor: tint.color }]} />
                        <Text style={s.appName} numberOfLines={1}>{groupName(state, groupId)}</Text>
                        <Text style={s.appValue}>{formatMinutesShort(minutes)}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
              <Text style={s.otherNote}>Time in groups this plan leaves without a limit.</Text>
            </Animated.View>
          );
        })()}

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
  emptyGroups: { borderRadius: 16, borderCurve: 'continuous', borderWidth: 1, borderStyle: 'dashed', borderColor: '#DDD8CC', backgroundColor: '#FEFDF9', paddingHorizontal: 16, paddingVertical: 15 },
  emptyGroupsTitle: { fontFamily: F.serifMedium, fontSize: 16, color: C.text },
  emptyGroupsBody: { marginTop: 3, fontFamily: F.sans, fontSize: 11, lineHeight: 15.5, color: C.textSecondary },
  groupList: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border },
  groupSeparator: { height: StyleSheet.hairlineWidth, backgroundColor: C.border },
  groupRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 13, paddingHorizontal: 3 },
  groupAvatar: { width: 36, height: 36, borderRadius: 12, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  groupAvatarText: { fontFamily: F.serifSemiBold, fontSize: 17 },
  groupCopy: { flex: 1, minWidth: 0 },
  groupTitleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  groupName: { flexShrink: 1, fontFamily: F.serifMedium, fontSize: 16.5, color: C.text },
  groupValue: { fontFamily: F.serifSemiBold, fontSize: 14.5, color: C.text, fontVariant: ['tabular-nums'] },
  groupMeter: { marginTop: 8 },
  groupCaption: { marginTop: 5, fontFamily: F.sansMedium, fontSize: 9.5, color: C.textSecondary },
  appRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 7 },
  appDot: { width: 5, height: 5, borderRadius: 3 },
  appName: { flex: 1, minWidth: 0, fontFamily: F.sansMedium, fontSize: 11, color: C.textSecondary },
  appValue: { fontFamily: F.sansSemiBold, fontSize: 10.5, color: C.textSecondary, fontVariant: ['tabular-nums'] },
  otherRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 11, paddingHorizontal: 3 },
  otherNote: { marginTop: 7, marginLeft: 4, fontFamily: F.sansMedium, fontSize: 9, color: C.textMuted },
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
