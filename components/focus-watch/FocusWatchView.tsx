import { type ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line } from 'react-native-svg';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import {
  BarChart3,
  ChevronRight,
  Clock,
  Eye,
  Globe,
  Lock,
  Shield,
  X,
} from '@/components/icons/Icons';
import { StaticChallengeTrophy } from '@/components/challenges/ChallengeTrophy';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import { useGuidedSetup, useGuideTarget } from '@/components/onboarding/guided/GuidedSetupContext';
import FocusPhoneStatus from './FocusPhoneStatus';
import FocusCard, { FOCUS_TINTS, FocusStatusChip } from './FocusCard';
import { PulseDot } from './FocusMeter';
import DayGauge, { gaugeStanding, gaugeStateColor, GAUGE_ESSENTIALS_COLOR } from './DayGauge';
import PlanCardBackdrop from './PlanCardBackdrop';
import { planVisualFor, type PlanVisual } from './planVisuals';
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
  allCoreEssentialIds,
  dateKey,
  formatClockMs,
  formatEndsAt,
  formatMinutesShort,
  getEffectivePlan,
  getLiveDayStatus,
  getLiveUsageSnapshot,
  planHasProtectionNow,
  purityActiveCount,
  tickDayPlanStore,
  useDayPlan,
  type DayPlan,
  type DayPlanState,
  type DayRecord,
} from './dayPlanStore';

const WEEK_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

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

// Today's plan wears the streak trophy's radiance in its own colors: a ray
// burst and a slow-breathing glow behind the Daily Plan shield. Radiance is
// reserved for what is alive right now — list and editor views stay still.
function RadiantPlanSeal({ visual, plan }: { visual: PlanVisual; plan: DayPlan }) {
  const reduceMotion = useReducedMotion();
  const breathe = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      breathe.value = 0.6;
      return;
    }
    breathe.value = 0;
    breathe.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2600, easing: Easing.inOut(Easing.sin) })
      ),
      -1
    );
    return () => cancelAnimation(breathe);
  }, [reduceMotion, breathe]);

  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.4 + breathe.value * 0.6 }));

  const field = 92;
  const cx = field / 2;
  const inner = 29;

  return (
    <View style={s.sealStage}>
      <Animated.View pointerEvents="none" style={[s.sealGlow, { backgroundColor: visual.bloom }, glowStyle]} />
      <Svg pointerEvents="none" width={field} height={field} style={s.sealRays}>
        {Array.from({ length: 12 }).map((_, index) => {
          const angle = (index / 12) * Math.PI * 2 - Math.PI / 2;
          const long = index % 2 === 0;
          const r2 = inner + (long ? 14 : 8);
          return (
            <Line
              key={index}
              x1={cx + inner * Math.cos(angle)}
              y1={cx + inner * Math.sin(angle)}
              x2={cx + r2 * Math.cos(angle)}
              y2={cx + r2 * Math.sin(angle)}
              stroke={visual.accent}
              strokeOpacity={long ? 0.4 : 0.22}
              strokeWidth={long ? 1.7 : 1.3}
              strokeLinecap="round"
            />
          );
        })}
      </Svg>
      <View style={[s.sealDisc, { borderColor: visual.border }]}>
        <View style={[s.sealDiscRing, { borderColor: visual.accent }]} />
        <Shield s={21} c={visual.accent} w={1.9} />
      </View>
      <View pointerEvents="none" style={[s.sealGlint, { backgroundColor: visual.accent }]} />
      <View pointerEvents="none" style={[s.sealGlintSmall, { backgroundColor: visual.accent }]} />
    </View>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// The web card's surface: the shared weave crossed with its own mirror — a
// fine diamond lattice, the filter everything from the web must pass through.
function LatticeWeave({ color }: { color: string }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const step = 30;
  const lineCount = box.w > 0 ? Math.ceil((box.w + box.h) / step) + 1 : 0;

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={event => {
        const { width, height } = event.nativeEvent.layout;
        setBox({ w: width, h: height });
      }}
    >
      {lineCount > 0 && (
        <Svg width={box.w} height={box.h} style={StyleSheet.absoluteFill}>
          {Array.from({ length: lineCount }).map((_, index) => {
            const offset = index * step;
            return (
              <Line
                key={`a${index}`}
                x1={offset}
                y1={-4}
                x2={offset - box.h - 8}
                y2={box.h + 4}
                stroke={color}
                strokeOpacity={0.035}
                strokeWidth={1}
              />
            );
          })}
          {Array.from({ length: lineCount }).map((_, index) => {
            const offset = index * step;
            return (
              <Line
                key={`b${index}`}
                x1={box.w - offset}
                y1={-4}
                x2={box.w - offset + box.h + 8}
                y2={box.h + 4}
                stroke={color}
                strokeOpacity={0.035}
                strokeWidth={1}
              />
            );
          })}
        </Svg>
      )}
    </View>
  );
}

// Web Protection's emblem: Clean Sight's eye behind a half-drawn veil, held
// inside a watch ring. While the guard stands, the veil is drawn solid and a
// sentinel node patrols the ring — the same quiet life as the phone's orbits;
// when the guard rests, the watch stands still and the veil hangs open.
function GuardedSightEmblem({ active }: { active: boolean }) {
  const reduceMotion = useReducedMotion();
  const patrol = useSharedValue(0);
  const animate = active && !reduceMotion;

  useEffect(() => {
    if (animate) {
      patrol.value = 0;
      patrol.value = withRepeat(
        withTiming(1, { duration: 11000, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      cancelAnimation(patrol);
      patrol.value = 0;
    }
    return () => cancelAnimation(patrol);
  }, [animate, patrol]);

  const sentinelProps = useAnimatedProps(() => {
    const angle = -Math.PI / 2 + patrol.value * Math.PI * 2;
    return { cx: 32 + 29 * Math.cos(angle), cy: 32 + 29 * Math.sin(angle) };
  });
  // Half a revolution behind, so the watch never looks empty.
  const counterProps = useAnimatedProps(() => {
    const angle = Math.PI / 2 + patrol.value * Math.PI * 2;
    return { cx: 32 + 29 * Math.cos(angle), cy: 32 + 29 * Math.sin(angle) };
  });

  return (
    <View style={s.webEmblemStage}>
      <View pointerEvents="none" style={[s.webEmblemGlow, active && s.webEmblemGlowOn]} />
      <Svg pointerEvents="none" width={64} height={64} style={StyleSheet.absoluteFill}>
        <Circle
          cx={32}
          cy={32}
          r={29}
          stroke="#2D7967"
          strokeOpacity={active ? 0.32 : 0.15}
          strokeWidth={1}
          fill="none"
          strokeDasharray={active ? undefined : '1 5'}
        />
        <Circle cx={32} cy={32} r={24.5} stroke="#2D7967" strokeOpacity={active ? 0.15 : 0.09} strokeWidth={1} fill="none" strokeDasharray="1 4" />
        {active && (
          <>
            <AnimatedCircle animatedProps={sentinelProps} r={2.1} fill="#2D7967" fillOpacity={0.55} />
            <AnimatedCircle animatedProps={counterProps} r={1.5} fill="#2D7967" fillOpacity={0.32} />
          </>
        )}
      </Svg>
      <View style={[s.webEmblemDisc, !active && s.webEmblemDiscOff]}>
        <Eye s={21} c={active ? '#2D7967' : 'rgba(45,121,103,0.6)'} w={1.9} />
        <Svg pointerEvents="none" width={42} height={42} style={StyleSheet.absoluteFill}>
          {[
            { y: 9, x1: 6.3, x2: 35.7 },
            { y: 13.5, x1: 3.9, x2: 38.1 },
            { y: 18, x1: 2.7, x2: 39.3 },
          ].map(line => (
            <Line
              key={line.y}
              x1={line.x1}
              y1={line.y}
              x2={line.x2}
              y2={line.y}
              stroke="#2D7967"
              strokeOpacity={active ? 0.38 : 0.2}
              strokeWidth={1.3}
              strokeLinecap="round"
              strokeDasharray={active ? undefined : '2 4'}
            />
          ))}
        </Svg>
      </View>
    </View>
  );
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

export default function FocusWatchView({
  guided = false,
  onGuidedComplete,
}: {
  guided?: boolean;
  onGuidedComplete?: () => void;
} = {}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: guideScreenHeight } = useWindowDimensions();
  const state = useDayPlan();
  const { session, patchSession, setPresentation } = useGuidedSetup();
  const isGuided = guided && session?.active === true && session.activeStep === 'focusOverview';
  const guidePhase = isGuided ? session.phase : '';
  const guideScrollRef = useRef<React.ElementRef<typeof ScrollView>>(null);
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
  // The web pillar shows whenever rules exist: standing guard, previewing,
  // or resting — the resting card is designed too, not hidden.
  const webState: 'on' | 'preview' | 'off' = webActive ? 'on' : previewMode && webConfigured ? 'preview' : 'off';
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
    ? `${formatClockMs(state.quiet.endsAt - nowMs)} remaining · ends ${formatEndsAt(state.quiet.endsAt)}`
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
    : planProtects
        ? <FocusStatusChip text="Active" color="#327153" pulse />
        : undefined;

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
          description="Block gambling, adult content, and other harmful sites in browsers."
          onPress={() => router.push('/clean-sight' as never)}
          style={s.navCard}
        />
      </Animated.View>
    </>
  );
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        ref={isGuided ? guideScrollRef : undefined}
        contentContainerStyle={s.page}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={isGuided ? 16 : undefined}
        onScroll={isGuided ? event => { guideScrollY.current = event.nativeEvent.contentOffset.y; } : undefined}
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
                  style={[s.todayCard, { borderColor: visual.border }]}
                  activeOpacity={0.86}
                  onPress={() => router.push('/day-plan-today' as never)}
                  accessibilityRole="button"
                  accessibilityLabel={`${plan.name} is active today. Open today's detail.`}
                >
                  <LinearGradient colors={visual.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                  <PlanCardBackdrop visual={visual} ringSize={128} live />
                  <View style={s.todayHeroRow}>
                    <RadiantPlanSeal visual={visual} plan={plan} />
                    <View style={s.todayCopy}>
                      <Text style={[s.todayKicker, { color: visual.accent }]}>TODAY’S PLAN</Text>
                      <Text style={[s.todayName, { color: visual.ink }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{plan.name}</Text>
                      {(essentialsOnly || essentialsNow) && (
                        <Text style={[s.todayStatus, { color: visual.body }]} numberOfLines={1}>
                          {essentialsOnly
                            ? 'Only Essentials are open today'
                            : essentialsNow
                              ? 'Limit spent · Essentials remain open'
                              : null}
                        </Text>
                      )}
                      {(usedToday != null || (!essentialsOnly && targetMinutes != null)) && (
                        <View style={s.todaySpentRow}>
                          {!essentialsOnly && targetMinutes != null && (
                            <View style={[s.todaySpentRail, { backgroundColor: visual.track }]}>
                              <View
                                style={[
                                  s.todaySpentFill,
                                  {
                                    backgroundColor: screenTimeNumbersColor,
                                    width: usedToday
                                      ? Math.max(4, Math.min(1, usedToday / targetMinutes) * 46)
                                      : 0,
                                  },
                                ]}
                              />
                            </View>
                          )}
                          <Text numberOfLines={1}>
                            <Text style={[s.todaySpentValue, { color: screenTimeNumbersColor }]}>
                              {usedToday == null ? '– –' : formatMinutesShort(usedToday)}
                            </Text>
                            <Text style={[s.todaySpentMeta, { color: visual.body }]}>
                              {!essentialsOnly && targetMinutes != null
                                ? ` of ${formatMinutesShort(targetMinutes)}`
                                : ' today'}
                            </Text>
                          </Text>
                        </View>
                      )}
                    </View>
                    {screenTimeValue != null && (
                      <View style={s.todayValueBlock}>
                        <Text style={[s.todayValue, { color: screenTimeValueColor }]} numberOfLines={1}>{screenTimeValue}</Text>
                        <Text style={[s.todayValueCaption, { color: visual.body }]} numberOfLines={1}>{screenTimeCaption}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            );
          })()}

          {webConfigured && (
            <View style={s.pillarBlock}>
              <Text style={s.pillarLabel}>WEB PROTECTION</Text>
              <TouchableOpacity
                style={[s.webCard, webState === 'off' && s.webCardOff]}
                activeOpacity={0.86}
                onPress={() => router.push('/clean-sight' as never)}
                accessibilityRole="button"
                accessibilityLabel={webState === 'off'
                  ? 'Web Protection is resting. Open Clean Sight.'
                  : 'Web Protection is standing guard. Open Clean Sight.'}
              >
                <LinearGradient
                  colors={webState === 'off'
                    ? ['#EDF3F0', '#FBFDFC', '#FFFFFF']
                    : ['#E6F3EC', '#F9FCFA', '#FEFFFE']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <LatticeWeave color="#2D7967" />
                <View pointerEvents="none" style={[s.webBloom, webState !== 'off' && s.webBloomOn]} />
                <View style={s.webHeroRow}>
                  <View style={s.webCopy}>
                    <Text style={s.webKicker}>CLEAN SIGHT</Text>
                    <Text style={[s.webName, webState === 'off' && s.webNameOff]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                      {webState === 'off' ? 'The guard is resting' : 'Standing guard'}
                    </Text>
                    <Text style={s.webStatusLine} numberOfLines={1}>
                      {packsOn} {packsOn === 1 ? 'pack' : 'packs'} · {customSites} custom {customSites === 1 ? 'site' : 'sites'} blocked
                    </Text>
                  </View>
                  <GuardedSightEmblem active={webState !== 'off'} />
                </View>
                <View style={s.webRule}>
                  <View style={s.webRuleLine} />
                  <View style={s.webRuleCross}>
                    <View style={s.webRuleCrossH} />
                    <View style={s.webRuleCrossV} />
                  </View>
                  <View style={s.webRuleLine} />
                </View>
                <View style={s.webStateRow}>
                  {webState === 'on' ? (
                    <PulseDot size={5} color="#2C7565" />
                  ) : (
                    <View style={[s.webStateDot, webState === 'preview' && s.webStateDotPreview]} />
                  )}
                  <Text style={[
                    s.webStateText,
                    webState === 'preview' && s.webStateTextPreview,
                    webState === 'off' && s.webStateTextOff,
                  ]}>
                    {webState === 'on' ? 'ON' : webState === 'preview' ? 'PREVIEW' : 'OFF'}
                  </Text>
                  <Text style={s.webStateCaption} numberOfLines={1}>
                    {state.purity.locks.locked
                      ? 'HARD LOCKED'
                      : state.purity.locks.enabled
                        ? 'HARD LOCK'
                        : 'SYSTEM-WIDE'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
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
          <TouchableOpacity
            {...(isGuided ? streakTarget : {})}
            style={s.progressSurface}
            activeOpacity={0.86}
            onPress={openTrophyCalendar}
          >
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

        {isGuided ? <View {...toolsTarget}>{focusNavigationCards}</View> : focusNavigationCards}
      </ScrollView>

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
  // Web Protection card — the veiled watch. Unique to the web pillar: lattice
  // surface, the eye behind a half-drawn veil, a sentinel patrolling the ring
  // while the guard stands; everything still and open when it rests.
  webCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 22,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#B7D8CA',
    paddingHorizontal: 15,
    paddingTop: 13,
    paddingBottom: 13,
    boxShadow: '0 6px 16px rgba(34, 61, 51, 0.07)',
  },
  webCardOff: {
    borderColor: '#CFDCD5',
    boxShadow: '0 4px 12px rgba(34, 61, 51, 0.05)',
  },
  webBloom: { position: 'absolute', right: -30, top: -38, width: 118, height: 118, borderRadius: 59, backgroundColor: 'rgba(61,130,115,0.07)' },
  webBloomOn: { backgroundColor: 'rgba(61,130,115,0.15)' },
  webHeroRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 64 },
  webCopy: { flex: 1, minWidth: 0 },
  webKicker: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.8, color: '#2D7967' },
  webName: { marginTop: 2.5, fontFamily: F.serifSemiBold, fontSize: 21, lineHeight: 25, letterSpacing: -0.25, color: '#1F4E45' },
  webNameOff: { color: 'rgba(31,78,69,0.72)' },
  webStatusLine: { marginTop: 2.5, fontFamily: F.serif, fontSize: 13.5, lineHeight: 17, color: '#3D8273' },
  webEmblemStage: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  webEmblemGlow: { position: 'absolute', left: 5, top: 5, width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(61,130,115,0.06)' },
  webEmblemGlowOn: { backgroundColor: 'rgba(61,130,115,0.16)' },
  webEmblemDisc: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: '#B7D8CA',
    backgroundColor: 'rgba(255,255,255,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#12271F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  webEmblemDiscOff: { backgroundColor: 'rgba(255,255,255,0.62)', borderColor: 'rgba(183,216,202,0.72)', shadowOpacity: 0.05, elevation: 1 },
  webRule: { marginTop: 10, marginBottom: 9, flexDirection: 'row', alignItems: 'center', gap: 7 },
  webRuleLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#CBE0D5' },
  webRuleCross: { width: 7, height: 7, alignItems: 'center', justifyContent: 'center' },
  webRuleCrossH: { position: 'absolute', width: 7, height: 1, borderRadius: 0.5, backgroundColor: '#2D7967', opacity: 0.65 },
  webRuleCrossV: { position: 'absolute', width: 1, height: 7, borderRadius: 0.5, backgroundColor: '#2D7967', opacity: 0.65 },
  webStateRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  webStateDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(42,110,95,0.4)' },
  webStateDotPreview: { backgroundColor: '#7866A4' },
  webStateText: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.2, color: '#2C7565' },
  webStateTextPreview: { color: '#65548E' },
  webStateTextOff: { color: 'rgba(31,78,69,0.55)' },
  webStateCaption: { flex: 1, textAlign: 'right', fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.1, color: '#3D8273' },
  // Today's plan card — the radiant-seal view of the plan (view two of the
  // set: hero dashboard / radiant today / bound library card).
  todayCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 22,
    borderCurve: 'continuous',
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingTop: 13,
    paddingBottom: 13,
    boxShadow: '0 6px 16px rgba(57, 48, 34, 0.07)',
  },
  todayHeroRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 66 },
  sealStage: { width: 66, height: 66, alignItems: 'center', justifyContent: 'center' },
  sealGlow: { position: 'absolute', left: 4, top: 4, width: 58, height: 58, borderRadius: 29 },
  sealRays: { position: 'absolute', left: -13, top: -13 },
  sealDisc: {
    width: 47,
    height: 47,
    borderRadius: 23.5,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  sealDiscRing: { position: 'absolute', left: 3.5, top: 3.5, right: 3.5, bottom: 3.5, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, opacity: 0.45 },
  sealGlint: { position: 'absolute', right: 6, top: 7, width: 5.5, height: 5.5, borderRadius: 1.5, opacity: 0.72, transform: [{ rotate: '45deg' }] },
  sealGlintSmall: { position: 'absolute', left: 7, bottom: 9, width: 3.2, height: 3.2, borderRadius: 1, opacity: 0.5, transform: [{ rotate: '45deg' }] },
  todayCopy: { flex: 1, minWidth: 0 },
  todayKicker: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.8 },
  todayName: { marginTop: 2.5, fontFamily: F.serifSemiBold, fontSize: 21, lineHeight: 25, letterSpacing: -0.25 },
  todayStatus: { marginTop: 2.5, fontFamily: F.serif, fontSize: 13.5, lineHeight: 17 },
  todayValueBlock: { maxWidth: 104, alignItems: 'flex-end' },
  todayValue: { fontFamily: F.serifSemiBold, fontSize: 19, fontVariant: ['tabular-nums'] },
  todayValueCaption: { marginTop: 1.5, fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.1 },
  // The spent line: the hero gauge in miniature — a tiny rail in the plan's
  // own track color, filled in the live state color, then the numbers in
  // words. No caption needed; "of 3h" carries it.
  todaySpentRow: { marginTop: 5, flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 0 },
  todaySpentRail: { width: 46, height: 3, borderRadius: 1.5, overflow: 'hidden' },
  todaySpentFill: { height: 3, borderRadius: 1.5 },
  todaySpentValue: { fontFamily: F.serifSemiBold, fontSize: 14.5, fontVariant: ['tabular-nums'] },
  todaySpentMeta: { fontFamily: F.serif, fontSize: 12.5 },
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
