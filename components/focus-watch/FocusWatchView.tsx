import { type ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import {
  BarChart3,
  Clock,
  Globe,
  Lock,
  Shield,
} from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import { useGuidedSetup, useGuideTarget } from '@/components/onboarding/guided/GuidedSetupContext';
import FocusPhoneStatus from './FocusPhoneStatus';
import { FOCUS_TINTS, FocusStatusChip } from './FocusCard';
import RibbonSectionCard, { type RibbonCardProps } from '@/components/shared/RibbonSectionCard';
import { PulseDot } from './FocusMeter';
import { gaugeStanding, gaugeStateColor, GAUGE_ESSENTIALS_COLOR } from './DayGauge';
import { ScreenTimeProtectionCard, WebProtectionCard } from './ProtectionPillarCards';
import MedalStreakCard, { type MedalStreakWeekCell } from './MedalStreakCard';
import GoldButton from './GoldButton';
import AlwaysBlockedSheet from './AlwaysBlockedSheet';
import ProtectionRegisterCard, { REGISTER_TONES } from './ProtectionRegister';
import QuietHourSheet from './QuietHourSheet';
import TrophyCalendarSheet from './TrophyCalendarSheet';
import MilestoneCongratsOverlay from './MilestoneCongratsOverlay';
import { isNativeFocusAvailable } from './focusNativeBridge';
import { useNativeActivitySelectionSummary } from './nativeSelectionSummaryStore';
import {
  acknowledgeMilestone,
  allCoreEssentialIds,
  dateKey,
  formatClockMs,
  formatEndsAt,
  formatMinutesShort,
  getEffectivePlan,
  getLiveDayStatus,
  getLiveUsageSnapshot,
  getWebProtectionSummary,
  planHasProtectionNow,
  tickDayPlanStore,
  useDayPlan,
  type DayPlanState,
  type DayRecord,
} from './dayPlanStore';
import {
  FocusMainMotionProvider,
  FocusViewportMotionBoundary,
  useFocusMainMotion,
  type FocusViewportMotionHandle,
} from './focus-main-motion';

const WEEK_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const enter = (delay: number) => FadeInDown.duration(420).delay(delay);

function buildWeek(state: DayPlanState, now: Date): MedalStreakWeekCell[] {
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

function FocusMainRibbonCard(props: RibbonCardProps) {
  const motionEnabled = useFocusMainMotion();
  return <RibbonSectionCard {...props} active={motionEnabled} />;
}


function QuietHourRemaining({ endsAt }: { endsAt: number }) {
  const motionEnabled = useFocusMainMotion();
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!motionEnabled) return;
    setNowMs(Date.now());
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [motionEnabled]);

  return <>{formatClockMs(endsAt - nowMs)} remaining · ends {formatEndsAt(endsAt)}</>;
}

// The two protection registers now wear the plan builder's Always Blocked
// material verbatim — white ground, weave, blooms, accent edge — so a standing
// boundary looks the same everywhere it is mentioned. Gold = essentials kept
// open, rose = permanently closed.
function ProtectionRow({
  icon,
  tone,
  title,
  detail,
  chipLabel,
  value,
  valueCaption,
  valueColor = C.text,
  index = 0,
  onPress,
}: {
  icon: React.ReactNode;
  tone: keyof typeof REGISTER_TONES;
  title: string;
  detail: string;
  chipLabel?: string;
  value?: string;
  valueCaption?: string;
  valueColor?: string;
  index?: number;
  onPress: () => void;
}) {
  return (
    <ProtectionRegisterCard
      tone={REGISTER_TONES[tone]}
      icon={icon}
      title={title}
      detail={detail}
      chipLabel={chipLabel}
      value={value}
      valueCaption={valueCaption}
      valueColor={valueColor}
      index={index}
      onPress={onPress}
    />
  );
}

export default function FocusWatchView({
  guided = false,
  onGuidedComplete,
}: {
  guided?: boolean;
  onGuidedComplete?: () => void;
} = {}) {
  const router = useRouter();
  const isFocused = useIsFocused();
  const routeParams = useLocalSearchParams<{ sheet?: string }>();
  const insets = useSafeAreaInsets();
  const { height: guideScreenHeight, width: screenWidth } = useWindowDimensions();
  const state = useDayPlan();
  const { session, patchSession, setPresentation } = useGuidedSetup();
  const isGuided = guided && session?.active === true && session.activeStep === 'focusOverview';
  const guidePhase = isGuided ? session.phase : '';
  const guideScrollRef = useRef<React.ElementRef<typeof ScrollView>>(null);
  const focusHeroMotionRef = useRef<FocusViewportMotionHandle>(null);
  const focusFooterMotionRef = useRef<FocusViewportMotionHandle>(null);
  const focusToolsMotionRef = useRef<FocusViewportMotionHandle>(null);
  const protectionTarget = useGuideTarget('focus-overview-protection-status', isGuided);
  const quietTarget = useGuideTarget('focus-overview-quiet-hour', isGuided);
  const streakTarget = useGuideTarget('focus-overview-streak', isGuided);
  const toolsTarget = useGuideTarget('focus-overview-main-cards', isGuided);
  const guideScrollY = useRef(0);
  const guideTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const nativeAvailable = isNativeFocusAvailable();
  const quietSelectionSummary = useNativeActivitySelectionSummary('quiet.current');
  const designatedCoreSummary = useNativeActivitySelectionSummary('core.designated');
  const strictAlwaysSummary = useNativeActivitySelectionSummary('always.strict');
  const looseAlwaysSummary = useNativeActivitySelectionSummary('always.loose');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [quietOpen, setQuietOpen] = useState(false);
  const [alwaysBlockedOpen, setAlwaysBlockedOpen] = useState(false);
  const [trophiesOpen, setTrophiesOpen] = useState(false);
  const handledQuietRouteRef = useRef(false);

  const handleFocusScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    focusHeroMotionRef.current?.updateViewport(scrollY);
    focusFooterMotionRef.current?.updateViewport(scrollY);
    focusToolsMotionRef.current?.updateViewport(scrollY);
    if (isGuided) guideScrollY.current = scrollY;
  }, [isGuided]);

  useEffect(() => {
    if (
      guided
      || routeParams.sheet !== 'quiet'
      || handledQuietRouteRef.current
    ) return;
    handledQuietRouteRef.current = true;
    setQuietOpen(true);
    router.setParams({ sheet: '' } as never);
  }, [guided, routeParams.sheet, router]);

  useEffect(() => {
    if (!isFocused) return;
    const tick = () => {
      const next = Date.now();
      tickDayPlanStore(next);
      setNowMs(next);
    };
    const timer = setInterval(tick, 30_000);
    const quietEndDelay = state.quiet
      ? Math.max(0, state.quiet.endsAt - Date.now() + 50)
      : null;
    const quietEndTimer = quietEndDelay != null && quietEndDelay <= 2_147_483_647
      ? setTimeout(tick, quietEndDelay)
      : null;
    return () => {
      clearInterval(timer);
      if (quietEndTimer) clearTimeout(quietEndTimer);
    };
  }, [isFocused, state.quiet]);

  const now = useMemo(() => new Date(nowMs), [nowMs]);
  const plan = getEffectivePlan(state, now);
  const webProtection = getWebProtectionSummary(state);
  const { packsOn, customSites, configured: webConfigured, state: webState } = webProtection;
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
  const webActive = webState === 'on';
  // The web pillar shows whenever rules exist: standing guard, previewing,
  // or resting — the resting card is designed too, not hidden.
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
  // The Medal Streak card banks whenever no medal is on the table today:
  // no plan is scheduled, or the plan that is carries no daily limit. A day
  // already lost still counts as live — it has a verdict to show.
  const streakBanked = targetMinutes == null && liveStatus !== 'broken';
  // A true rest day: no plan at all. The card strips down to the crest and
  // the seal — the week strip is meaningless when nothing is scheduled — and
  // says plainly that the streak still stands.
  const restDay = streakBanked && !plan;

  // The Screen Time card divides its job cleanly: the status line says WHICH
  // rules hold right now, the right block says WHERE today stands, and the
  // numbers row says HOW MUCH — used / goal in the big-card slash grammar.
  const essentialsNow = !!plan && !plan.essentialsOnly
    && (hardWallActive || todayStanding === 'essentials');

  let screenTimeValue: string | undefined;
  let screenTimeCaption: string | undefined;
  let screenTimeValueColor: string = C.text;
  if (plan) {
    if (plan.essentialsOnly) {
      screenTimeValue = 'Essentials';
      screenTimeCaption = 'ALL DAY';
      screenTimeValueColor = GAUGE_ESSENTIALS_COLOR;
    } else if (targetMinutes == null) {
      screenTimeValue = 'On';
      screenTimeCaption = 'GROUP LIMITS';
    } else if (essentialsNow) {
      screenTimeValue = 'Essentials';
      screenTimeCaption = 'ONLY FOR NOW';
      screenTimeValueColor = GAUGE_ESSENTIALS_COLOR;
    } else if (usedToday == null) {
      // No standing yet — the numbers row already says "– – / goal"; the
      // corner stays quiet instead of parroting plan settings.
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
    ? <QuietHourRemaining endsAt={state.quiet.endsAt} />
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
  const screenTimeChip = useMemo(() => (
    plan?.essentialsOnly && isProtected
      ? <FocusStatusChip text="Essentials only" color="#8F3544" pulse={false} />
      : hardWallActive && isProtected
      ? <FocusStatusChip text="Limit reached" color="#8F3544" pulse={false} />
      : planProtects
          ? <FocusStatusChip text="Active" color="#327153" pulse />
          : undefined
  ), [hardWallActive, isProtected, plan?.essentialsOnly, planProtects]);
  const openDayPlans = useCallback(() => router.push('/day-plans' as never), [router]);
  const openCleanSight = useCallback(() => router.push('/clean-sight' as never), [router]);

  const clearGuideTimers = useCallback(() => {
    guideTimersRef.current.forEach(clearTimeout);
    guideTimersRef.current = [];
  }, []);

  const stageGuideTarget = useCallback((
    binding: ReturnType<typeof useGuideTarget>,
    position: 'origin' | 'middle',
    present: () => void,
  ) => {
    const node = binding.ref.current;
    if (!node?.measureInWindow) {
      guideTimersRef.current.push(setTimeout(present, 40));
      return;
    }
    if (position === 'origin') {
      guideScrollRef.current?.scrollTo({ y: 0, animated: guideScrollY.current > 4 });
      guideTimersRef.current.push(setTimeout(() => {
        binding.measure();
        guideTimersRef.current.push(setTimeout(present, 48));
      }, guideScrollY.current > 4 ? 330 : 56));
      return;
    }
    node.measureInWindow((_x: number, y: number, _width: number, height: number) => {
      const desired = Math.max(insets.top + 92, guideScreenHeight * 0.48 - height / 2);
      const delta = y - desired;
      if (Math.abs(delta) < 14) {
        binding.measure();
        guideTimersRef.current.push(setTimeout(present, 56));
        return;
      }
      guideScrollRef.current?.scrollTo({ y: Math.max(0, guideScrollY.current + delta), animated: true });
      guideTimersRef.current.push(setTimeout(() => {
        binding.measure();
        guideTimersRef.current.push(setTimeout(present, 48));
      }, 340));
    });
  }, [guideScreenHeight, insets.top]);

  const finishGuidedOverview = useCallback(() => {
    setPresentation(null);
    onGuidedComplete?.();
  }, [onGuidedComplete, setPresentation]);

  useEffect(() => {
    if (!isGuided) return;
    clearGuideTimers();

    if (guidePhase === 'focusIntro') {
      if (guideScrollY.current > 4) guideScrollRef.current?.scrollTo({ y: 0, animated: true });
      guideTimersRef.current.push(setTimeout(() => {
        setPresentation({
          key: 'focus-overview-intro',
          placement: 'bottom',
          lightScrim: true,
          eyebrow: 'FOCUS TOUR',
          progress: { current: 1, total: 5 },
          message: 'This is the real Focus screen. Screen Time, Web Protection, Quiet Hour, and your streak meet here.',
          highlights: ['real Focus screen', 'meet here'],
          ctaLabel: 'See my protection',
          onCta: () => patchSession({ phase: 'focusProtection' }),
        });
      }, 360));
      return;
    }

    if (guidePhase === 'focusProtection') {
      stageGuideTarget(protectionTarget, 'origin', () => {
        setPresentation({
          key: 'focus-overview-protection-status',
          targetId: 'focus-overview-protection-status',
          cutoutPadding: 8,
          placement: 'below',
          allowTargetInteraction: false,
          eyebrow: 'FOCUS TOUR',
          progress: { current: 2, total: 5 },
          message: 'The Protection badge tells you immediately whether your saved rules are active, starting, waiting for access, or resting.',
          highlights: ['Protection badge', 'active', 'resting'],
          ctaLabel: 'Show Quiet Hour',
          onCta: () => patchSession({ phase: 'focusQuiet' }),
        });
      });
      return;
    }

    if (guidePhase === 'focusQuiet') {
      stageGuideTarget(quietTarget, 'middle', () => {
        setPresentation({
          key: 'focus-overview-quiet-hour',
          targetId: 'focus-overview-quiet-hour',
          cutoutPadding: 8,
          placement: 'above',
          allowTargetInteraction: false,
          eyebrow: 'FOCUS TOUR',
          progress: { current: 3, total: 5 },
          message: 'Quiet Hour is the fast option for a focused block right now. It temporarily keeps only the apps you choose available.',
          highlights: ['Quiet Hour', 'focused block right now'],
          ctaLabel: 'See my streak',
          onCta: () => patchSession({ phase: 'focusStreak' }),
        });
      });
      return;
    }

    if (guidePhase === 'focusStreak') {
      stageGuideTarget(streakTarget, 'middle', () => {
        setPresentation({
          key: 'focus-overview-streak',
          targetId: 'focus-overview-streak',
          cutoutPadding: 8,
          placement: 'above',
          allowTargetInteraction: true,
          eyebrow: 'FOCUS TOUR',
          progress: { current: 4, total: 5 },
          message: 'Each day you hold your Goal earns a trophy and keeps the streak alive. Open the real monthly streak view.',
          highlights: ['earns a trophy', 'keeps the streak alive'],
          action: 'Tap Trophy Streak',
          hint: 'tap',
        });
      });
      return;
    }

    if (guidePhase === 'focusStreakOpen') {
      setPresentation(null);
      return;
    }

    if (guidePhase === 'focusTools') {
      stageGuideTarget(toolsTarget, 'middle', () => {
        setPresentation({
          key: 'focus-overview-main-cards',
          targetId: 'focus-overview-main-cards',
          cutoutPadding: 8,
          placement: 'above',
          allowTargetInteraction: false,
          eyebrow: 'FOCUS TOUR',
          progress: { current: 5, total: 5 },
          message: 'These are the two main doors back into your setup: Screen Time for app boundaries and Web Protection for harmful sites.',
          highlights: ['two main doors', 'Screen Time', 'Web Protection'],
          celebrate: true,
          ctaLabel: 'Finish Focus setup',
          onCta: finishGuidedOverview,
        });
      });
      return;
    }

    setPresentation(null);
  }, [
    clearGuideTimers,
    finishGuidedOverview,
    guidePhase,
    isGuided,
    patchSession,
    protectionTarget,
    quietTarget,
    setPresentation,
    stageGuideTarget,
    streakTarget,
    toolsTarget,
  ]);

  useEffect(() => () => clearGuideTimers(), [clearGuideTimers]);

  const openTrophyCalendar = useCallback(() => {
    if (isGuided && guidePhase === 'focusStreak') {
      setPresentation(null);
      patchSession({ phase: 'focusStreakOpen' });
    }
    setTrophiesOpen(true);
  }, [guidePhase, isGuided, patchSession, setPresentation]);

  const closeTrophyCalendar = useCallback(() => {
    setTrophiesOpen(false);
    if (isGuided && guidePhase === 'focusStreakOpen') {
      patchSession({ phase: 'focusTools' });
    }
  }, [guidePhase, isGuided, patchSession]);

  const withQuietGuideTarget = (content: ReactElement) => (
    isGuided ? <View {...quietTarget}>{content}</View> : content
  );

  const focusNavigationCards = (
    <>
      <View style={s.contentSection}>
        <FocusMainRibbonCard
          label="APP BLOCKING"
          title="Screen Time"
          titleColor={FOCUS_TINTS.gold.title}
          arrowBg={FOCUS_TINTS.gold.arrowBg}
          Decor={Clock}
          decorColor={FOCUS_TINTS.gold.label}
          chip={screenTimeChip}
          description="Plan how much of the day the phone may have — goals, limits, and app rules."
          onPress={openDayPlans}
          index={0}
          estimatedWidth={screenWidth - 32}
          style={s.navCard}
        />
      </View>

      <View style={s.contentSectionTight}>
        <FocusMainRibbonCard
          label="CLEAN SIGHT"
          title="Web Protection"
          titleColor={FOCUS_TINTS.green.title}
          arrowBg={FOCUS_TINTS.green.arrowBg}
          Decor={Globe}
          decorColor={FOCUS_TINTS.green.label}
          description="Block gambling, adult content, and other harmful sites in browsers."
          onPress={openCleanSight}
          index={1}
          estimatedWidth={screenWidth - 32}
          style={s.navCard}
        />
      </View>
    </>
  );
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <FocusMainMotionProvider>
        <ScrollView
          ref={isGuided ? guideScrollRef : undefined}
          contentContainerStyle={s.page}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={isGuided ? 16 : 32}
          onScroll={handleFocusScroll}
        >
        <ScreenTitleBar title="FOCUS" />
        <Animated.View entering={enter(0)} style={s.quoteWrap}>
          <Text style={s.quote}>“Be sober, be vigilant.”</Text>
          <Text style={s.ref}>1 PETER 5:8</Text>
        </Animated.View>

        <FocusViewportMotionBoundary
          ref={focusHeroMotionRef}
          viewportHeight={guideScreenHeight}
          initiallyActive
        >
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
          <View {...(isGuided ? protectionTarget : {})} style={s.surfaceHeaderRow}>
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
            {state.quiet && withQuietGuideTarget(
                <ProtectionRow
                  icon={<Lock s={19} c="#8B6B2F" w={2.2} />}
                  tone="gold"
                  title="Quiet Hour"
                  detail={nativeAvailable
                    ? quietSelectionSummary && designatedCoreSummary
                      ? `${quietSelectionSummary.applicationCount + designatedCoreSummary.applicationCount} chosen apps / strict`
                      : 'Private app selection / strict'
                    : `${state.quiet.selection.appIds.length + allCoreEssentialIds(state).length} essentials / strict`}
                  chipLabel="Quiet"
                  onPress={() => setQuietOpen(true)}
                />
            )}
            {alwaysConfigured && (
              <ProtectionRow
                icon={<Shield s={19} c="#A24351" w={2.1} />}
                tone="rose"
                title="Always Blocked"
                detail={`${alwaysBlockedCount} ${alwaysBlockedCount === 1 ? 'app' : 'apps'} · permanent intent`}
                chipLabel="Blocked"
                index={state.quiet ? 1 : 0}
                onPress={() => setAlwaysBlockedOpen(true)}
              />
            )}
          </View>

          {plan && (
            <ScreenTimeProtectionCard
              plan={plan}
              statusText={plan.essentialsOnly
                ? 'Only Essentials are open today'
                : essentialsNow
                  ? 'Limit spent · Essentials remain open'
                  : null}
              usedMinutes={usedToday}
              targetMinutes={targetMinutes}
              numbersColor={screenTimeNumbersColor}
              value={screenTimeValue}
              valueCaption={screenTimeCaption}
              valueColor={screenTimeValueColor}
              live
              onPress={() => router.push('/day-plan-today' as never)}
              accessibilityLabel={`${plan.name} is active today. Open today's detail.`}
            />
          )}

          {webConfigured && (
            <WebProtectionCard
              state={webState}
              packsOn={packsOn}
              customSites={customSites}
              lockCaption={state.purity.locks.locked
                ? 'HARD LOCKED'
                : state.purity.locks.enabled
                  ? 'HARD LOCK'
                  : 'SYSTEM-WIDE'}
              onPress={() => router.push('/clean-sight' as never)}
            />
          )}

          {!state.quiet && withQuietGuideTarget(
              <GoldButton
                label="Begin Quiet Hour"
                height={50}
                onPress={() => setQuietOpen(true)}
                style={s.quietButton}
              />
          )}
        </Animated.View>
        </FocusViewportMotionBoundary>

        <FocusViewportMotionBoundary
          ref={focusFooterMotionRef}
          viewportHeight={guideScreenHeight}
        >
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
          <MedalStreakCard
            {...(isGuided ? streakTarget : {})}
            streak={state.streak.current}
            week={week}
            banked={streakBanked}
            restDay={restDay}
            liveStatus={liveStatus}
            hasPlan={!!plan}
            targetMinutes={targetMinutes}
            toleranceEndMinutes={toleranceEndMinutes}
            usedMinutes={usedToday}
            onPress={openTrophyCalendar}
          />
        </Animated.View>

        </FocusViewportMotionBoundary>

        <FocusViewportMotionBoundary
          ref={focusToolsMotionRef}
          viewportHeight={guideScreenHeight}
        >
        {isGuided ? <View {...toolsTarget}>{focusNavigationCards}</View> : focusNavigationCards}
        </FocusViewportMotionBoundary>
        </ScrollView>
      </FocusMainMotionProvider>

      <QuietHourSheet visible={quietOpen} onClose={() => setQuietOpen(false)} editingSession={state.quiet} />
      <AlwaysBlockedSheet visible={alwaysBlockedOpen} onClose={() => setAlwaysBlockedOpen(false)} />
      <TrophyCalendarSheet visible={trophiesOpen} onClose={closeTrophyCalendar} />
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
  // Compact register cards, not a flat hairline list — the same grammar the
  // hub's protection defaults wear, kept to one row each.
  // The rows themselves now come from ProtectionRegister — only their stacking
  // lives here.
  protectionRows: { marginTop: 15, gap: 9 },
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
});
