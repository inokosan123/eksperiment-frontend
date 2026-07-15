import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import {
  BarChart3,
  ChevronRight,
  Clock,
  Globe,
  Lock,
  Shield,
  X,
} from '@/components/icons/Icons';
import { StaticChallengeTrophy } from '@/components/challenges/ChallengeTrophy';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import FocusPhoneStatus from './FocusPhoneStatus';
import FocusCard, { FOCUS_TINTS, FocusStatusChip } from './FocusCard';
import { PulseDot } from './FocusMeter';
import DayGauge, { gaugeStanding, gaugeStateColor, GAUGE_ESSENTIALS_COLOR } from './DayGauge';
import HairlineWeave from './HairlineWeave';
import PlanCardBackdrop from './PlanCardBackdrop';
import { planVisualFor } from './planVisuals';
import { RadiantTrophy, StreakMedallion, TrophyShineBackdrop } from './TrophyRadiance';
import GoldButton from './GoldButton';
import AlwaysBlockedSheet from './AlwaysBlockedSheet';
import QuietHourSheet from './QuietHourSheet';
import TrophyCalendarSheet from './TrophyCalendarSheet';
import MilestoneCongratsOverlay from './MilestoneCongratsOverlay';
import { isNativeFocusAvailable } from './focusNativeBridge';
import { useNativeActivitySelectionSummary } from './nativeSelectionSummaryStore';
import {
  acknowledgeMilestone,
  activeZone,
  allCoreEssentialIds,
  APP_CATEGORIES,
  dateKey,
  formatClockMs,
  formatEndsAt,
  formatMinutesShort,
  formatTimeOfDay,
  getEffectivePlan,
  getLiveDayStatus,
  getLiveUsageSnapshot,
  planHasProtectionNow,
  purityActiveCount,
  tickDayPlanStore,
  useDayPlan,
  type DayPlanState,
  type DayRecord,
  type PlanZone,
} from './dayPlanStore';

const WEEK_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// Everything a Session holds over its hours: fully closed groups, group
// limits or blocks, and single-app rules — the card can't list them, but it
// can honestly count them.
function sessionBoundaryCount(zone: PlanZone) {
  const closed = zone.closedGroupIds?.length ?? 0;
  const rules = zone.rules ?? [];
  const groupRules = rules.filter(rule => {
    const mode = rule.mode ?? (rule.dailyMinutes == null ? 'noLimit' : 'limit');
    return mode === 'blocked' || (mode === 'limit' && rule.dailyMinutes != null);
  }).length;
  const appRules = rules.reduce((count, rule) => count + (rule.appRules ?? []).filter(appRule => {
    const mode = appRule.mode ?? (appRule.minutes == null ? 'noLimit' : 'limit');
    return mode === 'blocked' || (mode === 'limit' && appRule.minutes != null);
  }).length, 0);
  return closed + groupRules + appRules;
}

const enter = (delay: number) => FadeInDown.duration(420).delay(delay);

type WeekCell = {
  key: string;
  letter: string;
  status: 'kept' | 'broken' | 'rest' | 'today';
};

function buildWeek(state: DayPlanState, now: Date): WeekCell[] {
  const today = dateKey(now);
  const live = getLiveDayStatus(state, now);
  return Array.from({ length: 7 }).map((_, index) => {
    const day = new Date(now);
    day.setDate(now.getDate() - (6 - index));
    const key = dateKey(day);
    if (key === today) {
      return {
        key,
        letter: WEEK_LETTERS[day.getDay()],
        status: live === 'broken' ? 'broken' : 'today',
      };
    }
    const record: DayRecord | undefined = state.days[key];
    return {
      key,
      letter: WEEK_LETTERS[day.getDay()],
      status: record?.status === 'kept' ? 'kept' : record?.status === 'broken' ? 'broken' : 'rest',
    };
  });
}

// A soft breathing ring around today's cell in the week strip.
function TodayRing() {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    t.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1700, easing: Easing.inOut(Easing.quad) })
      ),
      -1
    );
    return () => cancelAnimation(t);
  }, [reduceMotion, t]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.25 + t.value * 0.55,
    transform: [{ scale: 1 + t.value * 0.06 }],
  }));

  return <Animated.View pointerEvents="none" style={[s.todayRing, style]} />;
}

function ProtectionRow({
  icon,
  iconBg,
  title,
  detail,
  value,
  valueCaption,
  valueColor = C.text,
  onPress,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  detail: string;
  value?: string;
  valueCaption?: string;
  valueColor?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={s.protectionRow} activeOpacity={0.72} onPress={onPress}>
      <View style={[s.protectionRowIcon, { backgroundColor: iconBg }]}>{icon}</View>
      <View style={s.protectionRowCopy}>
        <Text style={s.protectionRowTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.84}>{title}</Text>
        <Text style={s.protectionRowDetail} numberOfLines={1}>{detail}</Text>
      </View>
      {value != null && (
        <View style={s.protectionRowValueBlock}>
          <Text style={[s.protectionRowValue, { color: valueColor }]} numberOfLines={1}>{value}</Text>
          {!!valueCaption && <Text style={s.protectionRowValueCaption} numberOfLines={1}>{valueCaption}</Text>}
        </View>
      )}
      <ChevronRight s={16} c={C.textMuted} w={2.1} />
    </TouchableOpacity>
  );
}

export default function FocusWatchView() {
  const router = useRouter();
  const state = useDayPlan();
  const nativeAvailable = isNativeFocusAvailable();
  const quietSelectionSummary = useNativeActivitySelectionSummary('quiet.current');
  const designatedCoreSummary = useNativeActivitySelectionSummary('core.designated');
  const strictAlwaysSummary = useNativeActivitySelectionSummary('always.strict');
  const looseAlwaysSummary = useNativeActivitySelectionSummary('always.loose');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [quietOpen, setQuietOpen] = useState(false);
  const [alwaysBlockedOpen, setAlwaysBlockedOpen] = useState(false);
  const [trophiesOpen, setTrophiesOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      const next = Date.now();
      tickDayPlanStore(next);
      setNowMs(next);
    }, state.quiet ? 1000 : 30_000);
    return () => clearInterval(timer);
  }, [state.quiet]);

  const now = useMemo(() => new Date(nowMs), [nowMs]);
  const plan = getEffectivePlan(state, now);
  const session = activeZone(plan, now);
  const packsOn = state.purity.packs.filter(pack => pack.mode !== 'off').length
    + state.purity.customPacks.filter(pack => pack.mode !== 'off').length;
  const customSites = state.purity.customDomains.length
    + state.purity.customPacks.reduce((sum, pack) => sum + pack.domains.length, 0);
  const webConfigured = purityActiveCount(state.purity) > 0;
  const permissionGranted = state.permission === 'approved';
  const previewMode = state.permission === 'preview';
  const nativeApplied = state.nativeProtection.status === 'applied';
  const nativeApplying = permissionGranted
    && (state.nativeProtection.status === 'idle' || state.nativeProtection.status === 'applying');
  const nativeError = permissionGranted && state.nativeProtection.status === 'error';
  const hardWallActive = state.nativeProtection.hardWallDate === dateKey(now);
  const alwaysBlockedCount = nativeAvailable
    ? (strictAlwaysSummary?.applicationCount ?? 0) + (looseAlwaysSummary?.applicationCount ?? 0)
    : state.alwaysBlockedApps.length;
  const alwaysConfigured = alwaysBlockedCount > 0;
  const webActive = permissionGranted && nativeApplied && webConfigured;
  const webShown = webActive || (previewMode && webConfigured);
  const planConfigured = planHasProtectionNow(plan, now);
  const planProtects = permissionGranted && nativeApplied && planConfigured;
  const protectionConfigured = !!state.quiet || webConfigured || planConfigured || alwaysConfigured;
  const isProtected = permissionGranted && nativeApplied && (!!state.quiet || webActive || planProtects || alwaysConfigured);
  const displayProtected = isProtected || (previewMode && protectionConfigured);
  const needsPermission = !permissionGranted && !previewMode && protectionConfigured;
  const liveStatus = getLiveDayStatus(state, now);
  const week = useMemo(() => buildWeek(state, now), [state, now]);
  const targetMinutes = plan?.budgetMinutes ?? null;
  const toleranceEndMinutes = plan ? plan.essentialOnlyMinutes ?? plan.tolerableMinutes : null;
  const usedToday = getLiveUsageSnapshot(dateKey(now))?.totalMinutes ?? null;
  const todayStanding = targetMinutes != null
    ? gaugeStanding(targetMinutes, toleranceEndMinutes, usedToday)
    : 'unknown';

  // The Screen Time card divides its job cleanly: the status line says WHICH
  // rules hold right now, the right block says WHERE today stands, and the
  // numbers row says HOW MUCH — used / goal in the big-card slash grammar.
  const toleranceDuration = targetMinutes != null && toleranceEndMinutes != null
    ? Math.max(0, toleranceEndMinutes - targetMinutes)
    : null;
  const essentialsNow = !!plan && !plan.essentialsOnly
    && (hardWallActive || todayStanding === 'essentials');

  // Session-plan facts: how long this Session still runs, what follows it,
  // how many boundaries it holds, and whether it closes every leisure group
  // (a Session-sized Essentials-only).
  const nowMinutesOfDay = now.getHours() * 60 + now.getMinutes();
  const sessionMinutesLeft = session
    ? Math.max(1, (((session.endMinutes - nowMinutesOfDay) % 1440) + 1440) % 1440)
    : null;
  const sessionZones = plan?.kind === 'session' ? plan.zones : [];
  const nextSession = session && sessionZones.length > 1
    ? sessionZones[(sessionZones.findIndex(zone => zone.id === session.id) + 1) % sessionZones.length]
    : null;
  const leisureGroupIds = plan
    ? [...APP_CATEGORIES.map(category => category.id), ...plan.customGroupIds]
    : [];
  const sessionClosesAll = !!session
    && leisureGroupIds.length > 0
    && leisureGroupIds.every(id => session.closedGroupIds?.includes(id));
  const sessionBoundaries = session ? sessionBoundaryCount(session) : 0;
  let screenTimeValue: string | undefined;
  let screenTimeCaption: string | undefined;
  let screenTimeValueColor: string = C.text;
  if (plan) {
    if (plan.essentialsOnly) {
      screenTimeValue = 'Essentials';
      screenTimeCaption = 'ALL DAY';
      screenTimeValueColor = GAUGE_ESSENTIALS_COLOR;
    } else if (sessionClosesAll && !essentialsNow) {
      screenTimeValue = 'Essentials';
      screenTimeCaption = 'THIS SESSION';
      screenTimeValueColor = GAUGE_ESSENTIALS_COLOR;
    } else if (targetMinutes == null) {
      screenTimeValue = 'On';
      screenTimeCaption = plan.kind === 'session' ? 'SESSION RULES' : 'GROUP LIMITS';
    } else if (essentialsNow) {
      screenTimeValue = 'Essentials';
      screenTimeCaption = 'ONLY FOR NOW';
      screenTimeValueColor = GAUGE_ESSENTIALS_COLOR;
    } else if (usedToday == null) {
      if (toleranceDuration != null && toleranceDuration > 0) {
        screenTimeValue = `+${formatMinutesShort(toleranceDuration)}`;
        screenTimeCaption = 'TOLERANCE';
      } else {
        screenTimeValue = formatMinutesShort(targetMinutes);
        screenTimeCaption = 'TODAY’S GOAL';
      }
    } else if (todayStanding === 'tolerance') {
      screenTimeValue = formatMinutesShort(Math.max(0, (toleranceEndMinutes ?? targetMinutes) - usedToday));
      screenTimeCaption = 'TOLERANCE LEFT';
      screenTimeValueColor = gaugeStateColor('tolerance', C.text);
    } else {
      screenTimeValue = formatMinutesShort(Math.max(0, targetMinutes - usedToday));
      screenTimeCaption = 'LEFT TODAY';
      screenTimeValueColor = gaugeStateColor('under', C.text);
    }
  }
  // The color the used-minutes number wears in the numbers row.
  const screenTimeNumbersColor = plan?.essentialsOnly || targetMinutes == null || usedToday == null
    ? C.text
    : gaugeStateColor(todayStanding, C.text);

  const protectionTitle = previewMode && protectionConfigured
    ? 'Protection preview is ready.'
    : needsPermission
    ? 'Screen Time access is needed.'
    : nativeError && protectionConfigured
    ? 'Protection could not start.'
    : nativeApplying && protectionConfigured
    ? 'Protection is starting.'
    : (plan?.essentialsOnly || hardWallActive) && isProtected
    ? 'Essentials-only is active.'
    : state.quiet && isProtected
    ? 'Quiet Hour is holding.'
    : isProtected
      ? 'Protection is active!'
      : 'No protection is active.';
  const protectionDetail = previewMode && protectionConfigured
    ? 'The interface is live. Real iPhone shields require the Anasta development build.'
    : needsPermission
    ? 'Allow access once to apply your Screen Time and Web Protection rules.'
    : nativeError && protectionConfigured
    ? state.nativeProtection.error ?? 'Open Screen Time settings, then try applying protection again.'
    : nativeApplying && protectionConfigured
    ? 'Your plan is saved while Anasta confirms the native iPhone shields.'
    : (plan?.essentialsOnly || hardWallActive) && isProtected
    ? state.quiet
      ? 'Plan apps must also be allowed by Quiet Hour. iOS system access remains available by design.'
      : plan?.essentialsOnly
        ? 'Only global Essentials and this plan’s chosen apps are reachable today.'
        : 'Daily Essentials and iOS system access remain available until the local day ends.'
    : state.quiet && isProtected
    ? `${formatClockMs(state.quiet.endsAt - nowMs)} remaining · ends ${formatEndsAt(state.quiet.endsAt)}`
    : session
      ? `${session.name} · until ${formatTimeOfDay(session.endMinutes)}`
      : planProtects
        ? webActive
          ? `${plan?.name} and Web Protection are standing guard.`
          : `${plan?.name} is shaping today.`
        : alwaysConfigured
          ? `${alwaysBlockedCount} ${alwaysBlockedCount === 1 ? 'app stays' : 'apps stay'} behind a permanent boundary.`
        : webActive
          ? 'Web Protection is guarding supported web access.'
          : 'Choose a plan or begin a Quiet Hour.';

  const badgePulse = isProtected || (nativeApplying && protectionConfigured);
  const screenTimeChip = plan?.essentialsOnly && isProtected
    ? <FocusStatusChip text="Essentials only" color="#8F3544" pulse={false} />
    : hardWallActive && isProtected
    ? <FocusStatusChip text="Limit reached" color="#8F3544" pulse={false} />
    : session && planProtects
      ? <FocusStatusChip text="Live now" color="#327153" pulse />
      : planProtects
        ? <FocusStatusChip text="Active" color="#327153" pulse />
        : undefined;
  const webChip = webActive
    ? <FocusStatusChip text="On" color="#2C7565" pulse />
    : previewMode && webConfigured
      ? <FocusStatusChip text="Preview" color="#65548E" pulse={false} />
      : <FocusStatusChip text="Off" color="rgba(42,110,95,0.62)" pulse={false} />;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={s.page}
        showsVerticalScrollIndicator={false}
      >
        <ScreenTitleBar title="FOCUS" />
        <Animated.View entering={enter(0)} style={s.quoteWrap}>
          <Text style={s.quote}>“Be sober, be vigilant.”</Text>
          <Text style={s.ref}>1 PETER 5:8</Text>
        </Animated.View>

        <Animated.View entering={enter(60)} style={s.protectionSurface}>
          <LinearGradient
            colors={displayProtected
              ? ['rgba(228,242,234,0.72)', 'rgba(255,255,255,0)', 'rgba(247,238,217,0.32)']
              : ['rgba(247,238,217,0.58)', 'rgba(255,255,255,0)', 'rgba(241,240,236,0.24)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.protectionLight}
            pointerEvents="none"
          />
          <View style={s.surfaceHeaderRow}>
            <Text style={s.surfaceLabel}>PROTECTION</Text>
            <View style={[s.liveBadge, isProtected && s.liveBadgeOn, (needsPermission || nativeApplying) && s.liveBadgeNeedsAccess, nativeError && s.liveBadgeError, previewMode && s.liveBadgePreview]}>
              {badgePulse ? (
                <PulseDot
                  size={5}
                  color={isProtected ? '#4E9A72' : '#C08A2C'}
                />
              ) : (
                <View style={[s.liveDot, (needsPermission || nativeApplying) && s.liveDotNeedsAccess, nativeError && s.liveDotError, previewMode && s.liveDotPreview]} />
              )}
              <Text style={[s.liveBadgeText, isProtected && s.liveBadgeTextOn, (needsPermission || nativeApplying) && s.liveBadgeTextNeedsAccess, nativeError && s.liveBadgeTextError, previewMode && s.liveBadgeTextPreview]}>
                {previewMode ? 'PREVIEW' : needsPermission ? 'NEEDS ACCESS' : nativeError ? 'COULD NOT START' : nativeApplying && protectionConfigured ? 'STARTING' : isProtected ? 'ACTIVE' : 'QUIET'}
              </Text>
            </View>
          </View>

          <View style={s.phoneStage}>
            <FocusPhoneStatus active={displayProtected} critical={!!plan?.essentialsOnly || hardWallActive} size={164} />
          </View>
          <Text style={s.protectionTitle} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.86}>{protectionTitle}</Text>
          <Text style={s.protectionDetail}>{protectionDetail}</Text>

          <View style={(state.quiet || alwaysConfigured) ? s.protectionRows : undefined}>
            {state.quiet && (
              <ProtectionRow
                icon={<Lock s={16} c="#A24351" w={2.2} />}
                iconBg="#FBE6E9"
                title="Quiet Hour"
                detail={nativeAvailable
                  ? quietSelectionSummary && designatedCoreSummary
                    ? `${quietSelectionSummary.applicationCount + designatedCoreSummary.applicationCount} chosen apps / strict`
                    : 'Private app selection / strict'
                  : `${state.quiet.selection.appIds.length + allCoreEssentialIds(state).length} essentials / strict`}
                onPress={() => setQuietOpen(true)}
              />
            )}
            {alwaysConfigured && (
              <ProtectionRow
                icon={<Shield s={16} c="#A24351" w={2.1} />}
                iconBg="#FBE6E9"
                title="Always Blocked"
                detail={`${alwaysBlockedCount} ${alwaysBlockedCount === 1 ? 'app' : 'apps'} · permanent intent`}
                onPress={() => setAlwaysBlockedOpen(true)}
              />
            )}
          </View>

          {plan && (() => {
            const visual = planVisualFor(plan);
            const essentialsOnly = !!plan.essentialsOnly;
            return (
              <View style={s.pillarBlock}>
                <Text style={s.pillarLabel}>SCREEN TIME</Text>
                <TouchableOpacity
                  style={[s.miniCard, { borderColor: visual.border }]}
                  activeOpacity={0.86}
                  onPress={() => router.push('/day-plan-today' as never)}
                  accessibilityRole="button"
                  accessibilityLabel={`${plan.name} is active today. Open today's detail.`}
                >
                  <LinearGradient colors={visual.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                  <PlanCardBackdrop visual={visual} ringSize={116} />
                  <View style={s.miniTopRow}>
                    <View style={s.miniCopy}>
                      <Text style={[s.miniName, { color: visual.ink }]} numberOfLines={1}>{plan.name}</Text>
                      <Text style={[s.miniStatus, { color: visual.body }]} numberOfLines={1}>
                        {essentialsOnly
                          ? 'Only Essentials are open today'
                          : essentialsNow
                            ? 'Limit spent · Essentials remain open'
                            : session && sessionMinutesLeft != null
                              ? `${session.name} · ends in ${formatMinutesShort(sessionMinutesLeft)}`
                              : plan.kind === 'session'
                                ? 'Sessions shape today'
                                : 'Active all day'}
                      </Text>
                    </View>
                    <View style={s.miniValueBlock}>
                      <Text style={[s.miniValue, { color: screenTimeValueColor }]} numberOfLines={1}>{screenTimeValue}</Text>
                      <Text style={[s.miniValueCaption, { color: visual.body }]} numberOfLines={1}>{screenTimeCaption}</Text>
                    </View>
                  </View>
                  <View style={s.miniNumbersRow}>
                    <Text style={[s.miniUsed, { color: screenTimeNumbersColor }]} numberOfLines={1}>
                      {usedToday == null ? '– –' : formatMinutesShort(usedToday)}
                    </Text>
                    {!essentialsOnly && targetMinutes != null && (
                      <Text style={[s.miniGoal, { color: visual.body }]} numberOfLines={1}> / {formatMinutesShort(targetMinutes)}</Text>
                    )}
                    <Text style={[s.miniNumbersCaption, { color: visual.body }]} numberOfLines={1}>
                      {essentialsOnly || targetMinutes == null ? '  PHONE TIME TODAY' : '  SCREEN TIME TODAY'}
                    </Text>
                  </View>
                  {plan.kind === 'session' && session && !essentialsOnly && (
                    <Text style={[s.miniSessionMeta, { color: visual.body }]} numberOfLines={1}>
                      {sessionClosesAll
                        ? `Everything rests in ${session.name}`
                        : sessionBoundaries === 0
                          ? `No limits in ${session.name}`
                          : `${sessionBoundaries} ${sessionBoundaries === 1 ? 'boundary holds' : 'boundaries hold'} in ${session.name}`}
                      {nextSession ? ` · ${nextSession.name} follows` : ''}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })()}

          {webShown && (
            <View style={s.pillarBlock}>
              <Text style={s.pillarLabel}>WEB PROTECTION</Text>
              <TouchableOpacity
                style={[s.miniCard, { borderColor: '#B7D8CA' }]}
                activeOpacity={0.86}
                onPress={() => router.push('/clean-sight' as never)}
                accessibilityRole="button"
                accessibilityLabel="Web Protection is standing guard. Open Clean Sight."
              >
                <LinearGradient colors={['#E6F3EC', '#F9FCFA', '#FEFFFE']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                <HairlineWeave color="#2D7967" />
                <View style={s.miniTopRow}>
                  <View style={s.miniCopy}>
                    <Text style={[s.miniName, { color: '#1F4E45' }]} numberOfLines={1}>Standing guard</Text>
                    <Text style={[s.miniStatus, { color: '#3D8273' }]} numberOfLines={1}>
                      {packsOn} {packsOn === 1 ? 'pack' : 'packs'} · {customSites} custom {customSites === 1 ? 'site' : 'sites'} blocked
                    </Text>
                  </View>
                  <View style={s.miniValueBlock}>
                    <Text style={[s.miniValue, { color: webActive ? '#2C7565' : '#65548E' }]} numberOfLines={1}>
                      {webActive ? 'On' : 'Preview'}
                    </Text>
                    <Text style={[s.miniValueCaption, { color: '#3D8273' }]} numberOfLines={1}>
                      {state.purity.locks.enabled ? 'STRICT WATCH' : 'ALWAYS ON'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {!state.quiet && (
            <GoldButton
              label="Begin Quiet Hour"
              height={50}
              onPress={() => setQuietOpen(true)}
              style={s.quietButton}
            />
          )}
        </Animated.View>

        <Animated.View entering={enter(140)} style={s.contentSection}>
          <View style={s.sectionTitleRow}>
            <Text style={s.sectionTitle}>TODAY’S PROGRESS</Text>
            <TouchableOpacity
              style={s.analyticsButton}
              activeOpacity={0.74}
              onPress={() => router.push('/focus-analytics' as never)}
            >
              <BarChart3 s={14} c={C.goldDark} w={2.1} />
              <Text style={s.analyticsButtonText}>Analytics</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={s.progressSurface} activeOpacity={0.86} onPress={() => setTrophiesOpen(true)}>
            <LinearGradient
              colors={['#F8E7BE', '#FFF8E9', '#FFFEFA']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <TrophyShineBackdrop />
            <View style={s.progressHeaderRow}>
              <Text style={s.progressKicker}>TROPHY STREAK</Text>
              <View style={s.calendarLink}>
                <Text style={s.calendarLinkText}>Monthly calendar</Text>
                <ChevronRight s={13} c={C.goldDark} w={2.2} />
              </View>
            </View>

            <View style={s.progressHeroRow}>
              <View style={s.progressMedallion}>
                <StreakMedallion value={state.streak.current} />
                <View style={s.progressUnitRow}>
                  <View style={s.progressUnitRule} />
                  <Text style={s.progressUnitCaps}>{state.streak.current === 0 ? 'BEGINS TODAY' : 'DAY STREAK'}</Text>
                  <View style={s.progressUnitRule} />
                </View>
              </View>
              <RadiantTrophy size={76} />
            </View>
            <Text style={s.progressHeadline} numberOfLines={2}>
              {liveStatus === 'broken'
                ? 'Today’s trophy is resting.'
                : targetMinutes != null
                  ? state.streak.current === 0
                    ? 'Hold today’s limit and day one is yours.'
                    : 'Today’s trophy is within reach.'
                  : plan
                    ? 'No trophy target today.'
                    : 'Today is a rest day.'}
            </Text>

            <View style={s.weekBand}>
              {week.map(cell => (
                <View key={cell.key} style={s.weekCell}>
                  <Text style={[s.weekLetter, cell.status === 'today' && s.weekLetterToday]}>{cell.letter}</Text>
                  <View style={[
                    s.weekDot,
                    cell.status === 'kept' && s.weekDotKept,
                    cell.status === 'broken' && s.weekDotBroken,
                    cell.status === 'today' && s.weekDotToday,
                    cell.status === 'rest' && s.weekDotRest,
                  ]}>
                    {cell.status === 'today' && <TodayRing />}
                    {cell.status === 'kept' && <StaticChallengeTrophy size={22} />}
                    {cell.status === 'today' && (
                      <View style={s.todayTrophyFaint}>
                        <StaticChallengeTrophy size={20} />
                      </View>
                    )}
                    {cell.status === 'broken' && <X s={11} c="#B45360" w={2.5} />}
                    {cell.status === 'rest' && <View style={s.restDot} />}
                  </View>
                </View>
              ))}
            </View>

            {targetMinutes != null ? (
              <DayGauge
                goalMinutes={targetMinutes}
                toleranceEndMinutes={toleranceEndMinutes}
                usedMinutes={usedToday}
                accent="#8A5A1A"
                labelColor="#A9863F"
                style={s.progressGauge}
              />
            ) : (
              <Text style={s.progressNoLimit}>No daily limit today</Text>
            )}
          </TouchableOpacity>
        </Animated.View>

        <Animated.View entering={enter(210)} style={s.contentSection}>
          <FocusCard
            label="APP BLOCKING"
            title="Screen Time"
            tint={FOCUS_TINTS.gold}
            watermark={<Clock s={84} c="#A9863F" w={1.1} />}
            chip={screenTimeChip}
            description="Plan how much of the day the phone may have — goals, limits, and app rules."
            onPress={() => router.push('/day-plans' as never)}
            style={s.navCard}
          />
        </Animated.View>

        <Animated.View entering={enter(280)} style={s.contentSectionTight}>
          <FocusCard
            label="CLEAN SIGHT"
            title="Web Protection"
            tint={FOCUS_TINTS.green}
            watermark={<Globe s={84} c="#3D8273" w={1.1} />}
            chip={webChip}
            description="Block gambling, adult content, and other harmful sites in browsers."
            onPress={() => router.push('/clean-sight' as never)}
            style={s.navCard}
          />
        </Animated.View>
      </ScrollView>

      <QuietHourSheet visible={quietOpen} onClose={() => setQuietOpen(false)} editingSession={state.quiet} />
      <AlwaysBlockedSheet visible={alwaysBlockedOpen} onClose={() => setAlwaysBlockedOpen(false)} />
      <TrophyCalendarSheet visible={trophiesOpen} onClose={() => setTrophiesOpen(false)} />
      <MilestoneCongratsOverlay milestone={state.pendingMilestone} onClose={acknowledgeMilestone} />
    </View>
  );
}

const s = StyleSheet.create({
  page: {
    paddingBottom: 128,
  },
  quoteWrap: {
    paddingHorizontal: 26,
    paddingTop: 8,
    paddingBottom: 6,
    alignItems: 'center',
  },
  quote: {
    fontFamily: F.serifMediumItalic,
    fontSize: 17,
    lineHeight: 21.5,
    color: C.textSecondary,
    textAlign: 'center',
  },
  ref: {
    marginTop: 10,
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2.4,
    color: C.gold,
  },
  protectionSurface: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 26,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#E9E4D8',
    backgroundColor: C.surface,
    padding: 16,
    overflow: 'hidden',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 4,
  },
  protectionLight: {
    ...StyleSheet.absoluteFillObject,
  },
  contentSection: {
    marginHorizontal: 16,
    marginTop: 18,
  },
  contentSectionTight: {
    marginHorizontal: 16,
    marginTop: 10,
  },
  navCard: {
    minHeight: 128,
  },
  surfaceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  surfaceLabel: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2.4,
    color: C.textMuted,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#F1F0EC',
  },
  liveBadgeOn: { backgroundColor: '#E7F2EB' },
  liveBadgeNeedsAccess: { backgroundColor: '#FFF2D7' },
  liveBadgeError: { backgroundColor: '#F8E7EA' },
  liveBadgePreview: { backgroundColor: '#EEEAF7' },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#A7A39A' },
  liveDotNeedsAccess: { backgroundColor: '#C08A2C' },
  liveDotError: { backgroundColor: '#A24351' },
  liveDotPreview: { backgroundColor: '#7866A4' },
  liveBadgeText: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.2, color: C.textMuted },
  liveBadgeTextOn: { color: '#327153' },
  liveBadgeTextNeedsAccess: { color: '#946518' },
  liveBadgeTextError: { color: '#8F3544' },
  liveBadgeTextPreview: { color: '#65548E' },
  phoneStage: { height: 164, alignItems: 'center', justifyContent: 'center' },
  protectionTitle: {
    fontFamily: F.serifMedium,
    fontSize: 24,
    letterSpacing: -0.2,
    color: C.text,
    textAlign: 'center',
  },
  protectionDetail: {
    marginTop: 4,
    paddingHorizontal: 10,
    fontFamily: F.serif,
    fontSize: 14,
    lineHeight: 19.5,
    color: C.textSecondary,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  protectionRows: {
    marginTop: 15,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
  },
  protectionRow: {
    minHeight: 55,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  protectionRowIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  protectionRowCopy: { flex: 1, minWidth: 0 },
  protectionRowTitle: { fontFamily: F.serifMedium, fontSize: 16, color: C.text },
  protectionRowDetail: { marginTop: 1.5, fontFamily: F.sans, fontSize: 10.5, color: C.textSecondary },
  protectionRowValueBlock: { maxWidth: 96, alignItems: 'flex-end' },
  protectionRowValue: { fontFamily: F.serifSemiBold, fontSize: 15.5, fontVariant: ['tabular-nums'] },
  protectionRowValueCaption: { marginTop: 1, fontFamily: F.sansBold, fontSize: 6.5, letterSpacing: 0.9, color: C.textMuted },
  pillarBlock: { marginTop: 14 },
  pillarLabel: { marginBottom: 7, marginLeft: 2, fontFamily: F.sansBold, fontSize: 9.5, letterSpacing: 2, color: C.textMuted },
  miniCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    boxShadow: '0 5px 14px rgba(57, 48, 34, 0.06)',
  },
  miniTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  miniCopy: { flex: 1, minWidth: 0 },
  miniName: { fontFamily: F.serifSemiBold, fontSize: 20, lineHeight: 24, letterSpacing: -0.25 },
  miniStatus: { marginTop: 3, fontFamily: F.serif, fontSize: 14, lineHeight: 18 },
  miniValueBlock: { maxWidth: 110, alignItems: 'flex-end' },
  miniValue: { fontFamily: F.serifSemiBold, fontSize: 19, fontVariant: ['tabular-nums'] },
  miniValueCaption: { marginTop: 1.5, fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.1 },
  miniNumbersRow: { marginTop: 10, flexDirection: 'row', alignItems: 'baseline', minWidth: 0 },
  miniUsed: { fontFamily: F.serifSemiBold, fontSize: 26, lineHeight: 29, fontVariant: ['tabular-nums'] },
  miniGoal: { fontFamily: F.serifMedium, fontSize: 16, fontVariant: ['tabular-nums'] },
  miniNumbersCaption: { flexShrink: 1, fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.1 },
  miniSessionMeta: { marginTop: 7, fontFamily: F.serif, fontSize: 13.5, lineHeight: 17 },
  quietButton: { marginTop: 16 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  sectionTitle: {
    paddingHorizontal: 4,
    marginBottom: 8,
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2.4,
    color: C.textMuted,
  },
  analyticsButton: {
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5D9BD',
    backgroundColor: '#FFF9EB',
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  analyticsButtonText: { fontFamily: F.sansSemiBold, fontSize: 10.5, color: C.goldDark },
  progressSurface: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#E8D8B5',
    padding: 16,
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  progressHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  progressKicker: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 2, color: C.goldDark },
  progressHeroRow: { marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 14, paddingRight: 22 },
  progressMedallion: { alignItems: 'center' },
  progressUnitRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 7 },
  progressUnitRule: { width: 14, height: 1, borderRadius: 1, backgroundColor: 'rgba(169,134,63,0.45)' },
  progressUnitCaps: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 2.2, color: C.goldDark },
  progressHeadline: { marginTop: 11, fontFamily: F.serif, fontSize: 14.5, lineHeight: 19, color: C.textSecondary, textAlign: 'center' },
  weekBand: {
    marginTop: 14,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#EADFC8',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekCell: { alignItems: 'center', gap: 6, minWidth: 34 },
  weekLetter: { fontFamily: F.sansBold, fontSize: 9.5, color: C.textMuted },
  weekLetterToday: { color: C.goldDark },
  weekDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDotKept: {
    backgroundColor: '#FFF3D8',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.55)',
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  weekDotBroken: { backgroundColor: '#FBEDEF', borderWidth: 1, borderColor: '#EBC7CD' },
  weekDotToday: { borderWidth: 1.5, borderColor: C.gold, backgroundColor: '#FFFBEF' },
  weekDotRest: { borderWidth: 1.5, borderColor: '#DDD8CC', borderStyle: 'dashed', backgroundColor: 'transparent' },
  todayTrophyFaint: { position: 'absolute', opacity: 0.34 },
  restDot: { width: 4.5, height: 4.5, borderRadius: 3, backgroundColor: '#D3CEC1' },
  todayRing: {
    position: 'absolute',
    top: -5,
    left: -5,
    right: -5,
    bottom: -5,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: C.gold,
  },
  progressGauge: { marginTop: 14, paddingHorizontal: 2 },
  progressNoLimit: { marginTop: 14, textAlign: 'center', fontFamily: F.sansMedium, fontSize: 10.5, color: '#A9863F' },
  calendarLink: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  calendarLinkText: { fontFamily: F.serifSemiBold, fontSize: 13.5, color: C.goldDark },
});
