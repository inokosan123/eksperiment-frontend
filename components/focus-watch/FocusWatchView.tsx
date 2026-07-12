import { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import {
  BarChart3,
  Calendar,
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
import AlwaysBlockedSheet from './AlwaysBlockedSheet';
import QuietHourSheet from './QuietHourSheet';
import TrophyCalendarSheet from './TrophyCalendarSheet';
import MilestoneCongratsOverlay from './MilestoneCongratsOverlay';
import { CATEGORY_TINTS } from './focusContent';
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

function ProtectionRow({
  icon,
  title,
  detail,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={s.protectionRow} activeOpacity={0.72} onPress={onPress}>
      <View style={s.protectionRowIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={s.protectionRowTitle}>{title}</Text>
        <Text style={s.protectionRowDetail} numberOfLines={1}>{detail}</Text>
      </View>
      <ChevronRight s={16} c={C.textMuted} w={2.1} />
    </TouchableOpacity>
  );
}

function SessionRail({ plan, now }: { plan: DayPlan; now: Date }) {
  const current = activeZone(plan, now);
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
                    opacity: current?.id === session.id ? 1 : 0.55,
                  },
                ]}
              />
            );
          }
          return (
            <View key={session.id} style={StyleSheet.absoluteFill} pointerEvents="none">
              <View style={[s.sessionSegment, { left: `${start * 100}%`, right: 0, backgroundColor: SESSION_COLORS[index % SESSION_COLORS.length], opacity: current?.id === session.id ? 1 : 0.55 }]} />
              <View style={[s.sessionSegment, { left: 0, width: `${end * 100}%`, backgroundColor: SESSION_COLORS[index % SESSION_COLORS.length], opacity: current?.id === session.id ? 1 : 0.55 }]} />
            </View>
          );
        })}
        <View style={[s.nowMarker, { left: `${((now.getHours() * 60 + now.getMinutes()) / 1440) * 100}%` }]} />
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

        <Animated.View entering={enter(50)} style={s.protectionSurface}>
          <View style={s.surfaceHeaderRow}>
            <Text style={s.surfaceLabel}>PROTECTION</Text>
            <View style={[s.liveBadge, isProtected && s.liveBadgeOn, (needsPermission || nativeApplying) && s.liveBadgeNeedsAccess, nativeError && s.liveBadgeError, previewMode && s.liveBadgePreview]}>
              <View style={[s.liveDot, isProtected && s.liveDotOn, (needsPermission || nativeApplying) && s.liveDotNeedsAccess, nativeError && s.liveDotError, previewMode && s.liveDotPreview]} />
              <Text style={[s.liveBadgeText, isProtected && s.liveBadgeTextOn, (needsPermission || nativeApplying) && s.liveBadgeTextNeedsAccess, nativeError && s.liveBadgeTextError, previewMode && s.liveBadgeTextPreview]}>
                {previewMode ? 'PREVIEW' : needsPermission ? 'NEEDS ACCESS' : nativeError ? 'COULD NOT START' : nativeApplying && protectionConfigured ? 'STARTING' : isProtected ? 'ACTIVE' : 'QUIET'}
              </Text>
            </View>
          </View>

          <View style={s.phoneStage}>
            <FocusPhoneStatus active={displayProtected} size={136} />
          </View>
          <Text style={s.protectionTitle}>{protectionTitle}</Text>
          <Text style={s.protectionDetail}>{protectionDetail}</Text>

          <View style={s.protectionRows}>
            {state.quiet && (
              <ProtectionRow
                icon={<Lock s={16} c="#A24351" w={2.2} />}
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
                title="Always Blocked"
                detail={`${alwaysBlockedCount} ${alwaysBlockedCount === 1 ? 'app' : 'apps'} · permanent intent`}
                onPress={() => setAlwaysBlockedOpen(true)}
              />
            )}
            {webShown && (
              <ProtectionRow
                icon={<Globe s={16} c="#2D7B6A" w={2.1} />}
                title="Web Protection"
                detail={`${packsOn} ${packsOn === 1 ? 'pack' : 'packs'} · ${customSites} custom ${customSites === 1 ? 'site' : 'sites'}`}
                onPress={() => router.push('/clean-sight' as never)}
              />
            )}
          </View>

          {!state.quiet && (
            <TouchableOpacity
              style={s.quietButton}
              activeOpacity={0.84}
              haptic="medium"
              onPress={() => setQuietOpen(true)}
            >
              <Lock s={15} c="#fff" w={2.2} />
              <Text style={s.quietButtonText}>Begin Quiet Hour</Text>
            </TouchableOpacity>
          )}
        </Animated.View>

        <Animated.View entering={enter(120)}>
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
              <View style={{ flex: 1 }}>
                <Text style={s.progressHeadline}>
                  {liveStatus === 'broken'
                    ? 'Today’s trophy is resting.'
                    : targetMinutes != null
                      ? 'Today’s trophy is within reach.'
                      : plan
                        ? 'No trophy target today.'
                        : 'Today is a rest day.'}
                </Text>
                <Text style={s.progressCaption}>
                  {targetMinutes != null ? `${formatMinutesShort(targetMinutes)} Daily Target` : 'No Daily Target today'}
                </Text>
              </View>
              <Image source={TROPHY_PNG} style={s.progressTrophy} resizeMode="contain" />
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
                    {cell.status === 'kept' && <CheckSmall s={11} c="#fff" w={2.8} />}
                    {cell.status === 'broken' && <X s={10} c="#A24351" w={2.8} />}
                  </View>
                </View>
              ))}
            </View>
            <Text style={s.calendarHint}>Tap to view the monthly trophy calendar</Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View entering={enter(190)}>
          <Text style={s.sectionTitle}>SCREEN TIME</Text>
          <TouchableOpacity style={s.screenTimeSurface} activeOpacity={0.84} onPress={() => router.push('/day-plans' as never)}>
            <View style={s.cardTitleRow}>
              <View style={s.cardIconGold}><Calendar s={18} c={C.goldDark} w={2.1} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardKicker}>TODAY’S PLAN</Text>
                <Text style={s.cardTitle}>{plan?.name ?? 'No plan selected'}</Text>
              </View>
              <ChevronRight s={19} c={C.textMuted} w={2.1} />
            </View>
            {plan ? (
              <>
                <View style={s.planMetaRow}>
                  <Text style={s.planType}>{plan.kind === 'session' ? 'Session Plan' : 'Daily Plan'}</Text>
                  <Text style={s.planMetaDot}>·</Text>
                  <Text style={s.planMetaText}>{session ? `${session.name} now` : 'All-day rules'}</Text>
                </View>
                {plan.kind === 'session' && <SessionRail plan={plan} now={now} />}
                <View style={s.targetRow}>
                  <View>
                    <Text style={s.targetLabel}>DAILY TARGET</Text>
                    <Text style={s.targetValue}>{targetMinutes == null ? 'No limit' : formatMinutesShort(targetMinutes)}</Text>
                  </View>
                  <View style={s.targetDivider} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.targetLabel}>PLANNED</Text>
                    <Text style={s.targetValue}>{formatMinutesShort(plannedMinutes)}</Text>
                  </View>
                  {planningCapacity != null && (
                    <View style={s.capacityPill}>
                      <Text style={s.capacityText}>{formatMinutesShort(planningCapacity)} at 80%</Text>
                    </View>
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
            ) : (
              <Text style={s.emptyText}>Create a simple Daily Plan or shape the day with Sessions.</Text>
            )}
          </TouchableOpacity>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(420).delay(250)}>
          <Text style={s.sectionTitle}>WEB PROTECTION</Text>
          <TouchableOpacity activeOpacity={0.84} onPress={() => router.push('/clean-sight' as never)}>
            <LinearGradient
              colors={['#E5F3EE', '#F4FBF8', '#FFF9EA']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.webSurface}
            >
              <View style={s.webOrb}><Globe s={26} c="#2C7565" w={1.7} /></View>
              <View style={s.webCopy}>
                <View style={s.webTitleRow}>
                  <Text style={s.webTitle}>Clean Sight</Text>
                  <View style={[s.webStatus, webShown && s.webStatusOn]}>
                    <Shield s={11} c={webShown ? '#2C7565' : C.textMuted} w={2.1} />
                    <Text style={[s.webStatusText, webShown && s.webStatusTextOn]}>{previewMode && webConfigured ? 'PREVIEW' : webActive ? 'ON' : 'OFF'}</Text>
                  </View>
                </View>
                <Text style={s.webDescription}>Block unwanted sites in Safari and supported browsers.</Text>
                <Text style={s.webMeta}>{packsOn} active packs · {customSites} custom sites</Text>
              </View>
              <View style={s.webArrow}><ChevronRight s={18} c="#2C7565" w={2.2} /></View>
            </LinearGradient>
          </TouchableOpacity>
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
    paddingHorizontal: 16,
    gap: 18,
  },
  quoteWrap: {
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  quote: {
    fontFamily: F.serifMediumItalic,
    fontSize: 16.5,
    lineHeight: 21,
    color: C.textSecondary,
    textAlign: 'center',
  },
  ref: {
    marginTop: 8,
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 2.2,
    color: C.gold,
  },
  protectionSurface: {
    borderRadius: 22,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#E6E2D9',
    backgroundColor: C.surface,
    padding: 15,
    overflow: 'hidden',
    boxShadow: '0 8px 24px rgba(43, 38, 28, 0.07)',
  },
  surfaceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  surfaceLabel: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 2.2,
    color: C.textMuted,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#F1F0EC',
  },
  liveBadgeOn: { backgroundColor: '#E7F2EB' },
  liveBadgeNeedsAccess: { backgroundColor: '#FFF2D7' },
  liveBadgeError: { backgroundColor: '#F8E7EA' },
  liveBadgePreview: { backgroundColor: '#EEEAF7' },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#A7A39A' },
  liveDotOn: { backgroundColor: '#4E9A72' },
  liveDotNeedsAccess: { backgroundColor: '#C08A2C' },
  liveDotError: { backgroundColor: '#A24351' },
  liveDotPreview: { backgroundColor: '#7866A4' },
  liveBadgeText: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.2, color: C.textMuted },
  liveBadgeTextOn: { color: '#327153' },
  liveBadgeTextNeedsAccess: { color: '#946518' },
  liveBadgeTextError: { color: '#8F3544' },
  liveBadgeTextPreview: { color: '#65548E' },
  phoneStage: { height: 132, alignItems: 'center', justifyContent: 'center' },
  protectionTitle: {
    fontFamily: F.serifMedium,
    fontSize: 23,
    color: C.text,
    textAlign: 'center',
  },
  protectionDetail: {
    marginTop: 3,
    paddingHorizontal: 8,
    fontFamily: F.sans,
    fontSize: 12,
    lineHeight: 17,
    color: C.textSecondary,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  protectionRows: {
    marginTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
  },
  protectionRow: {
    minHeight: 51,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  protectionRowIcon: {
    width: 31,
    height: 31,
    borderRadius: 10,
    borderCurve: 'continuous',
    backgroundColor: '#F4F2EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  protectionRowTitle: { fontFamily: F.sansSemiBold, fontSize: 12.5, color: C.text },
  protectionRowDetail: { marginTop: 2, fontFamily: F.sans, fontSize: 10.5, color: C.textSecondary },
  quietButton: {
    marginTop: 14,
    height: 47,
    borderRadius: 14,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#A87825',
    boxShadow: '0 4px 12px rgba(150, 103, 27, 0.24)',
  },
  quietButtonText: { fontFamily: F.sansSemiBold, fontSize: 13.5, color: '#fff' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  sectionTitle: {
    paddingHorizontal: 4,
    marginBottom: 8,
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 2.2,
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
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    padding: 14,
  },
  progressCopyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressHeadline: { fontFamily: F.serifMedium, fontSize: 18, color: C.text },
  progressCaption: { marginTop: 2, fontFamily: F.sans, fontSize: 11, color: C.textSecondary },
  progressTrophy: { width: 39, height: 39 },
  weekRow: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between' },
  weekCell: { alignItems: 'center', gap: 5, minWidth: 32 },
  weekLetter: { fontFamily: F.sansBold, fontSize: 8.5, color: C.textMuted },
  weekDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0EFEB',
  },
  weekDotKept: { backgroundColor: C.gold },
  weekDotBroken: { backgroundColor: '#F8E7EA', borderWidth: 1, borderColor: '#E8BFC6' },
  weekDotToday: { borderWidth: 1.5, borderColor: C.gold },
  calendarHint: { marginTop: 9, textAlign: 'center', fontFamily: F.sans, fontSize: 9.5, color: C.textMuted },
  screenTimeSurface: {
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#E5D9BD',
    backgroundColor: '#FFFDF7',
    padding: 15,
    boxShadow: '0 6px 18px rgba(80, 58, 20, 0.06)',
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  cardIconGold: { width: 38, height: 38, borderRadius: 12, borderCurve: 'continuous', backgroundColor: '#F8EBCB', alignItems: 'center', justifyContent: 'center' },
  cardKicker: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.6, color: C.gold },
  cardTitle: { marginTop: 1, fontFamily: F.serifMedium, fontSize: 21, color: C.text },
  planMetaRow: { marginTop: 11, flexDirection: 'row', alignItems: 'center', gap: 6 },
  planType: { fontFamily: F.sansSemiBold, fontSize: 10.5, color: C.goldDark },
  planMetaDot: { color: C.textMuted },
  planMetaText: { fontFamily: F.sans, fontSize: 10.5, color: C.textSecondary },
  sessionRail: { marginTop: 12 },
  sessionTrack: { position: 'relative', height: 8, borderRadius: 4, backgroundColor: '#EEECE6', overflow: 'hidden' },
  sessionSegment: { position: 'absolute', top: 0, bottom: 0 },
  nowMarker: { position: 'absolute', top: -2, width: 2, height: 12, borderRadius: 1, backgroundColor: C.text },
  sessionTicks: { marginTop: 4, flexDirection: 'row', justifyContent: 'space-between' },
  tickText: { fontFamily: F.sansMedium, fontSize: 7.5, color: C.textMuted, fontVariant: ['tabular-nums'] },
  targetRow: { marginTop: 13, flexDirection: 'row', alignItems: 'center', gap: 12 },
  targetLabel: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.4, color: C.textMuted },
  targetValue: { marginTop: 2, fontFamily: F.serifMedium, fontSize: 18, color: C.text, fontVariant: ['tabular-nums'] },
  targetDivider: { width: StyleSheet.hairlineWidth, height: 31, backgroundColor: C.border },
  capacityPill: { borderRadius: 999, backgroundColor: '#F4EACF', paddingHorizontal: 9, paddingVertical: 6 },
  capacityText: { fontFamily: F.sansSemiBold, fontSize: 9, color: C.goldDark },
  groupTags: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  groupTag: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  groupTagDot: { width: 5, height: 5, borderRadius: 3 },
  groupTagText: { fontFamily: F.sansSemiBold, fontSize: 9.5, color: C.textSecondary },
  moreText: { fontFamily: F.sansMedium, fontSize: 9.5, color: C.textMuted },
  emptyText: { marginTop: 12, fontFamily: F.serif, fontSize: 14, lineHeight: 19, color: C.textSecondary },
  webSurface: {
    minHeight: 126,
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#CDE6DD',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    overflow: 'hidden',
  },
  webOrb: { width: 49, height: 49, borderRadius: 16, borderCurve: 'continuous', backgroundColor: 'rgba(255,255,255,0.78)', borderWidth: 1, borderColor: '#CDE6DD', alignItems: 'center', justifyContent: 'center' },
  webCopy: { flex: 1 },
  webTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  webTitle: { fontFamily: F.serifMedium, fontSize: 22, color: '#234E45' },
  webStatus: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, backgroundColor: '#EEEDE9', paddingHorizontal: 7, paddingVertical: 4 },
  webStatusOn: { backgroundColor: '#D9ECE5' },
  webStatusText: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1, color: C.textMuted },
  webStatusTextOn: { color: '#2C7565' },
  webDescription: { marginTop: 5, fontFamily: F.serif, fontSize: 13.5, lineHeight: 18, color: '#3D7166' },
  webMeta: { marginTop: 6, fontFamily: F.sansSemiBold, fontSize: 9.5, color: '#4B8578' },
  webArrow: { width: 29, height: 29, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' },
});
