import { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
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
  CheckSmall,
  ChevronRight,
  Clock,
  Globe,
  Lock,
  Shield,
  X,
} from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import FocusPhoneStatus from './FocusPhoneStatus';
import FocusCard, { FOCUS_TINTS, FocusStatusChip } from './FocusCard';
import { FocusMeter, PulseDot } from './FocusMeter';
import GoldButton from './GoldButton';
import AlwaysBlockedSheet from './AlwaysBlockedSheet';
import QuietHourSheet from './QuietHourSheet';
import TrophyCalendarSheet from './TrophyCalendarSheet';
import MilestoneCongratsOverlay from './MilestoneCongratsOverlay';
import { CATEGORY_TINTS, WEB_PACKS } from './focusContent';
import { isNativeFocusAvailable } from './focusNativeBridge';
import { useNativeActivitySelectionSummary } from './nativeSelectionSummaryStore';
import {
  acknowledgeMilestone,
  activeZone,
  allCoreEssentialIds,
  dateKey,
  formatClockMs,
  formatEndsAt,
  formatMinutesShort,
  formatTimeOfDay,
  getEffectivePlan,
  getLiveDayStatus,
  groupName,
  planHasProtectionNow,
  plannedMinutesByGroup,
  purityActiveCount,
  tickDayPlanStore,
  useDayPlan,
  type DayPlan,
  type DayPlanState,
  type DayRecord,
} from './dayPlanStore';

const TROPHY_PNG = require('@/assets/animations/challenge-trophy-preview.png');
const WEEK_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const SESSION_COLORS = ['#C8A24D', '#658F78', '#7C78A5', '#B46D6D'];
const PACK_SHORT_NAMES: Record<string, string> = {
  gambling: 'Gambling',
  adult: 'Adult',
  social: 'Social',
  news: 'News',
};

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
  onPress,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  detail: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={s.protectionRow} activeOpacity={0.72} onPress={onPress}>
      <View style={[s.protectionRowIcon, { backgroundColor: iconBg }]}>{icon}</View>
      <View style={s.protectionRowCopy}>
        <Text style={s.protectionRowTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.84}>{title}</Text>
        <Text style={s.protectionRowDetail} numberOfLines={1}>{detail}</Text>
      </View>
      <ChevronRight s={16} c={C.textMuted} w={2.1} />
    </TouchableOpacity>
  );
}

function SessionRail({ plan, now }: { plan: DayPlan; now: Date }) {
  const current = activeZone(plan, now);
  const nowPct = ((now.getHours() * 60 + now.getMinutes()) / 1440) * 100;
  return (
    <View style={s.sessionRail}>
      <View style={s.sessionTrack}>
        {plan.zones.map((session, index) => {
          const start = session.startMinutes / 1440;
          const end = session.endMinutes / 1440;
          if (end > start) {
            return (
              <View
                key={session.id}
                style={[
                  s.sessionSegment,
                  {
                    left: `${start * 100}%`,
                    width: `${(end - start) * 100}%`,
                    backgroundColor: SESSION_COLORS[index % SESSION_COLORS.length],
                    opacity: current?.id === session.id ? 1 : 0.45,
                  },
                ]}
              />
            );
          }
          return (
            <View key={session.id} style={StyleSheet.absoluteFill} pointerEvents="none">
              <View style={[s.sessionSegment, { left: `${start * 100}%`, right: 0, backgroundColor: SESSION_COLORS[index % SESSION_COLORS.length], opacity: current?.id === session.id ? 1 : 0.45 }]} />
              <View style={[s.sessionSegment, { left: 0, width: `${end * 100}%`, backgroundColor: SESSION_COLORS[index % SESSION_COLORS.length], opacity: current?.id === session.id ? 1 : 0.45 }]} />
            </View>
          );
        })}
        <View style={[s.nowMarker, { left: `${nowPct}%` }]} />
      </View>
      <View style={[s.nowMarkerCap, { left: `${nowPct}%` }]} pointerEvents="none">
        <PulseDot color="#4A3A16" size={5} pulse={!!current} />
      </View>
      <View style={s.sessionTicks}>
        <Text style={s.tickText}>00</Text>
        <Text style={s.tickText}>06</Text>
        <Text style={s.tickText}>12</Text>
        <Text style={s.tickText}>18</Text>
        <Text style={s.tickText}>24</Text>
      </View>
    </View>
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
  const plannedGroups = plan ? Object.entries(plannedMinutesByGroup(plan)) : [];
  const plannedMinutes = plannedGroups.reduce((sum, [, minutes]) => sum + minutes, 0);
  const targetMinutes = plan?.budgetMinutes ?? null;
  const planningCapacity = targetMinutes == null ? null : Math.round(targetMinutes * 0.8);

  const protectionTitle = previewMode && protectionConfigured
    ? 'Protection preview is ready.'
    : needsPermission
    ? 'Screen Time access is needed.'
    : nativeError && protectionConfigured
    ? 'Protection could not start.'
    : nativeApplying && protectionConfigured
    ? 'Protection is starting.'
    : hardWallActive && isProtected
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
    : hardWallActive && isProtected
    ? state.quiet
      ? 'Daily Essentials must also be allowed by Quiet Hour. iOS system access remains available by design.'
      : 'Daily Essentials and iOS system access remain available until the local day ends.'
    : state.quiet && isProtected
    ? `${formatClockMs(state.quiet.endsAt - nowMs)} remaining · ends ${formatEndsAt(state.quiet.endsAt)}`
    : session
      ? `${session.name} · until ${formatTimeOfDay(session.endMinutes)}`
      : planProtects
        ? `${plan?.name} is shaping today.`
        : alwaysConfigured
          ? `${alwaysBlockedCount} ${alwaysBlockedCount === 1 ? 'app stays' : 'apps stay'} behind a permanent boundary.`
        : webActive
          ? 'Web Protection is guarding supported web access.'
          : 'Choose a plan or begin a Quiet Hour.';

  const badgePulse = isProtected || (nativeApplying && protectionConfigured);
  const screenTimeChip = hardWallActive && isProtected
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
        contentInsetAdjustmentBehavior="automatic"
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
            <FocusPhoneStatus active={displayProtected} critical={hardWallActive} size={164} />
          </View>
          <Text style={s.protectionTitle} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.86}>{protectionTitle}</Text>
          <Text style={s.protectionDetail}>{protectionDetail}</Text>

          <View style={s.protectionRows}>
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
            {plan && (
              <ProtectionRow
                icon={<Clock s={16} c={C.goldDark} w={2.1} />}
                iconBg="#F8EBCB"
                title="Screen Time"
                detail={hardWallActive
                  ? 'Daily limit reached · Essentials + system access'
                  : session
                    ? `${session.name} · ${formatTimeOfDay(session.startMinutes)}–${formatTimeOfDay(session.endMinutes)}`
                    : `${plan.name} · all day`}
                onPress={() => router.push('/day-plans' as never)}
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
            {webShown && (
              <ProtectionRow
                icon={<Globe s={16} c="#2C7565" w={2.1} />}
                iconBg="#DFF0EA"
                title="Web Protection"
                detail={`${packsOn} ${packsOn === 1 ? 'pack' : 'packs'} · ${customSites} custom ${customSites === 1 ? 'site' : 'sites'}`}
                onPress={() => router.push('/clean-sight' as never)}
              />
            )}
          </View>

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
            <View style={s.progressCopyRow}>
              <View style={s.progressTrophySeal}>
                <View style={s.progressTrophyGlow} />
                <Image source={TROPHY_PNG} style={s.progressTrophy} resizeMode="contain" />
              </View>
              <View style={s.progressCopy}>
                <Text style={s.progressKicker}>TROPHY STREAK</Text>
                <View style={s.progressValueRow}>
                  <Text style={s.progressValue}>{state.streak.current}</Text>
                  <Text style={s.progressUnit}>{state.streak.current === 1 ? 'day' : 'days'}</Text>
                </View>
                <Text style={s.progressHeadline} numberOfLines={2}>
                  {liveStatus === 'broken'
                    ? 'Today’s trophy is resting.'
                    : targetMinutes != null
                      ? 'Today’s trophy is within reach.'
                      : plan
                        ? 'No trophy target today.'
                        : 'Today is a rest day.'}
                </Text>
              </View>
              <ChevronRight s={17} c={C.goldDark} w={2} />
            </View>
            <View style={s.progressTargetRow}>
              <Text style={s.progressCaption}>
                {targetMinutes != null ? `${formatMinutesShort(targetMinutes)} Daily Target` : 'No Daily Target today'}
              </Text>
              <Text style={s.progressBest}>Best {state.streak.best}d</Text>
            </View>
            <View style={s.weekRow}>
              {week.map(cell => (
                <View key={cell.key} style={s.weekCell}>
                  <Text style={s.weekLetter}>{cell.letter}</Text>
                  <View style={[
                    s.weekDot,
                    cell.status === 'kept' && s.weekDotKept,
                    cell.status === 'broken' && s.weekDotBroken,
                    cell.status === 'today' && s.weekDotToday,
                  ]}>
                    {cell.status === 'today' && <TodayRing />}
                    {cell.status === 'kept' && <CheckSmall s={11} c="#fff" w={2.8} />}
                    {cell.status === 'broken' && <X s={10} c="#A24351" w={2.8} />}
                  </View>
                </View>
              ))}
            </View>
            <Text style={s.calendarHint}>Tap to view the monthly trophy calendar</Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View entering={enter(210)} style={s.contentSection}>
          <FocusCard
            label="APP BLOCKING"
            title="Screen Time"
            tint={FOCUS_TINTS.gold}
            watermark={<Clock s={84} c="#A9863F" w={1.1} />}
            chip={screenTimeChip}
            description={plan ? undefined : 'Create a simple Daily Plan or shape the day with Sessions.'}
            onPress={() => router.push('/day-plans' as never)}
          >
            {plan && (
              <>
                <View style={s.stPlanHeader}>
                  <View style={s.stPlanCopy}>
                    <Text style={s.stPlanKicker}>TODAY’S PLAN</Text>
                    <View style={s.stPlanTitleRow}>
                      <Text style={s.stPlanName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>{plan.name}</Text>
                      <View style={s.stKindTag}>
                        <Text style={s.stKindTagText}>{plan.kind === 'session' ? 'SESSION' : 'DAILY'}</Text>
                      </View>
                    </View>
                    <Text style={s.stPlanMeta} numberOfLines={1}>
                      {session ? `${session.name} is active now` : plan.kind === 'session' ? `${plan.zones.length} Sessions across today` : 'One set of rules across today'}
                    </Text>
                  </View>
                </View>
                {plan.kind === 'session' && <SessionRail plan={plan} now={now} />}
                <View style={s.stTargetBlock}>
                  <View style={s.stTargetRow}>
                    <View>
                      <Text style={s.stTargetLabel}>DAILY TARGET</Text>
                      <Text style={s.stTargetValue}>{targetMinutes == null ? 'No limit' : formatMinutesShort(targetMinutes)}</Text>
                    </View>
                    <View style={s.stTargetDivider} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.stTargetLabel}>PLANNED</Text>
                      <Text style={s.stTargetValue}>{formatMinutesShort(plannedMinutes)}</Text>
                    </View>
                    {planningCapacity != null && (
                      <View style={s.capacityPill}>
                        <Text style={s.capacityText}>{formatMinutesShort(planningCapacity)} at 80%</Text>
                      </View>
                    )}
                  </View>
                  {targetMinutes != null && (
                    <FocusMeter
                      fraction={plannedMinutes / targetMinutes}
                      height={10}
                      fill={C.gold}
                      track="rgba(138,90,26,0.14)"
                      live={!!session && planProtects}
                      markers={[
                        { at: 0.8, color: '#8A5A1A' },
                        { at: 1, color: '#4A3A16', strong: true },
                      ]}
                      style={s.stMeter}
                    />
                  )}
                </View>
                {plannedGroups.length > 0 && (
                  <View style={s.groupTags}>
                    {plannedGroups.slice(0, 3).map(([groupId, minutes]) => (
                      <View key={groupId} style={[s.groupTag, { backgroundColor: CATEGORY_TINTS[groupId]?.bg ?? '#F0EEE8' }]}>
                        <View style={[s.groupTagDot, { backgroundColor: CATEGORY_TINTS[groupId]?.color ?? C.gold }]} />
                        <Text style={s.groupTagText}>{groupName(state, groupId)} {formatMinutesShort(minutes)}</Text>
                      </View>
                    ))}
                    {plannedGroups.length > 3 && <Text style={s.moreText}>+{plannedGroups.length - 3} more</Text>}
                  </View>
                )}
              </>
            )}
          </FocusCard>
        </Animated.View>

        <Animated.View entering={enter(280)} style={s.contentSection}>
          <FocusCard
            label="CLEAN SIGHT"
            title="Web Protection"
            tint={FOCUS_TINTS.green}
            watermark={<Globe s={84} c="#3D8273" w={1.1} />}
            chip={webChip}
            description="Block selected harmful content across supported browsers."
            onPress={() => router.push('/clean-sight' as never)}
          >
            <View style={s.webStatsRow}>
              <View style={s.webStat}>
                <Text style={s.webStatValue}>{packsOn}</Text>
                <Text style={s.webStatLabel}>{packsOn === 1 ? 'active pack' : 'active packs'}</Text>
              </View>
              <View style={s.webStatDivider} />
              <View style={s.webStat}>
                <Text style={s.webStatValue}>{customSites}</Text>
                <Text style={s.webStatLabel}>{customSites === 1 ? 'custom site' : 'custom sites'}</Text>
              </View>
            </View>
            <View style={s.packChips}>
              {WEB_PACKS.map(pack => {
                const on = (state.purity.packs.find(entry => entry.id === pack.id)?.mode ?? 'off') !== 'off';
                return (
                  <View key={pack.id} style={[s.packChip, on ? s.packChipOn : s.packChipOff]}>
                    <View style={[s.packChipDot, on ? s.packChipDotOn : s.packChipDotOff]} />
                    <Text style={[s.packChipText, on ? s.packChipTextOn : s.packChipTextOff]}>
                      {PACK_SHORT_NAMES[pack.id] ?? pack.name}
                    </Text>
                  </View>
                );
              })}
              {customSites > 0 && (
                <View style={[s.packChip, s.packChipOn]}>
                  <View style={[s.packChipDot, s.packChipDotOn]} />
                  <Text style={[s.packChipText, s.packChipTextOn]}>
                    +{customSites} custom {customSites === 1 ? 'site' : 'sites'}
                  </Text>
                </View>
              )}
            </View>
          </FocusCard>
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
    borderRadius: 22,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#E8D8B5',
    backgroundColor: '#FFFDF7',
    padding: 16,
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  progressCopyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressTrophySeal: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.38)',
    backgroundColor: '#FFF7E3',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  progressTrophyGlow: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(216,182,114,0.25)',
  },
  progressTrophy: { width: 39, height: 39 },
  progressCopy: { flex: 1, minWidth: 0 },
  progressKicker: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.7, color: C.goldDark },
  progressValueRow: { marginTop: 1, flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  progressValue: { fontFamily: F.serifSemiBold, fontSize: 29, lineHeight: 31, color: C.text, fontVariant: ['tabular-nums'] },
  progressUnit: { fontFamily: F.serifMedium, fontSize: 15, color: C.textSecondary },
  progressHeadline: { marginTop: 1, fontFamily: F.serif, fontSize: 13.5, lineHeight: 17, color: C.textSecondary },
  progressTargetRow: { marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EADFC8', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  progressCaption: { flexShrink: 1, fontFamily: F.sansSemiBold, fontSize: 10.5, color: C.textSecondary },
  progressBest: { fontFamily: F.sansBold, fontSize: 9.5, letterSpacing: 0.4, color: C.goldDark },
  weekRow: { marginTop: 13, flexDirection: 'row', justifyContent: 'space-between' },
  weekCell: { alignItems: 'center', gap: 5, minWidth: 32 },
  weekLetter: { fontFamily: F.sansBold, fontSize: 8.5, color: C.textMuted },
  weekDot: {
    width: 29,
    height: 29,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0EFEB',
  },
  weekDotKept: {
    backgroundColor: C.gold,
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 2,
  },
  weekDotBroken: { backgroundColor: '#F8E7EA', borderWidth: 1, borderColor: '#E8BFC6' },
  weekDotToday: { borderWidth: 1.5, borderColor: C.gold, backgroundColor: '#FFFBEF' },
  todayRing: {
    position: 'absolute',
    top: -5,
    left: -5,
    right: -5,
    bottom: -5,
    borderRadius: 19.5,
    borderWidth: 1.5,
    borderColor: C.gold,
  },
  calendarHint: { marginTop: 10, textAlign: 'center', fontFamily: F.serifItalic, fontSize: 12, color: C.textMuted },
  stPlanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stPlanCopy: { flex: 1, minWidth: 0 },
  stPlanTitleRow: { marginTop: 2, flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 0 },
  stPlanKicker: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.6, color: '#A9863F' },
  stPlanName: { flexShrink: 1, fontFamily: F.serifMedium, fontSize: 20, letterSpacing: -0.2, color: '#4A3A16' },
  stKindTag: { flexShrink: 0, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(169,134,63,0.22)', backgroundColor: 'rgba(255,255,255,0.62)', paddingHorizontal: 7, paddingVertical: 3.5 },
  stKindTagText: { fontFamily: F.sansBold, fontSize: 7.5, letterSpacing: 1, color: '#8A5A1A' },
  stPlanMeta: { marginTop: 2, fontFamily: F.sansMedium, fontSize: 9.5, color: '#A9863F' },
  sessionRail: { marginTop: 12 },
  sessionTrack: { position: 'relative', height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.6)', overflow: 'hidden' },
  sessionSegment: { position: 'absolute', top: 0, bottom: 0, borderRadius: 3 },
  nowMarker: { position: 'absolute', top: -2, width: 2, height: 14, borderRadius: 1, backgroundColor: '#4A3A16' },
  nowMarkerCap: { position: 'absolute', top: -7, marginLeft: -1.5 },
  sessionTicks: { marginTop: 5, flexDirection: 'row', justifyContent: 'space-between' },
  tickText: { fontFamily: F.sansMedium, fontSize: 7.5, color: 'rgba(138,90,26,0.6)', fontVariant: ['tabular-nums'] },
  stTargetBlock: {
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(169,134,63,0.32)',
    paddingTop: 12,
  },
  stTargetRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stTargetLabel: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.4, color: '#A9863F' },
  stTargetValue: { marginTop: 2, fontFamily: F.serifMedium, fontSize: 18, color: '#4A3A16', fontVariant: ['tabular-nums'] },
  stTargetDivider: { width: StyleSheet.hairlineWidth, height: 31, backgroundColor: 'rgba(169,134,63,0.35)' },
  capacityPill: { borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.85)', borderWidth: 1, borderColor: 'rgba(240,227,184,0.9)', paddingHorizontal: 9, paddingVertical: 6 },
  capacityText: { fontFamily: F.sansSemiBold, fontSize: 9, color: '#8A5A1A' },
  stMeter: { marginTop: 10 },
  groupTags: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  groupTag: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  groupTagDot: { width: 5, height: 5, borderRadius: 3 },
  groupTagText: { fontFamily: F.sansSemiBold, fontSize: 9.5, color: C.textSecondary },
  moreText: { fontFamily: F.sansMedium, fontSize: 9.5, color: '#A9863F' },
  webStatsRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(61,130,115,0.24)', paddingVertical: 10 },
  webStat: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  webStatValue: { fontFamily: F.serifSemiBold, fontSize: 22, color: '#1F4E45', fontVariant: ['tabular-nums'] },
  webStatLabel: { flexShrink: 1, fontFamily: F.sansMedium, fontSize: 9.5, color: '#3D8273' },
  webStatDivider: { width: StyleSheet.hairlineWidth, height: 27, marginHorizontal: 12, backgroundColor: 'rgba(61,130,115,0.28)' },
  packChips: { marginTop: 11, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  packChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5.5,
  },
  packChipOn: { backgroundColor: 'rgba(255,255,255,0.8)', borderColor: '#BFDDD2' },
  packChipOff: { backgroundColor: 'rgba(255,255,255,0.38)', borderColor: 'rgba(191,221,210,0.5)' },
  packChipDot: { width: 5, height: 5, borderRadius: 3 },
  packChipDotOn: { backgroundColor: '#2C7565' },
  packChipDotOff: { backgroundColor: 'rgba(44,117,101,0.3)' },
  packChipText: { fontFamily: F.sansSemiBold, fontSize: 10 },
  packChipTextOn: { color: '#2A6E5F' },
  packChipTextOff: { color: 'rgba(42,110,95,0.5)' },
});
