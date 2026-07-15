import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Line } from 'react-native-svg';
import Animated, { FadeInDown } from 'react-native-reanimated';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { ArrowUpRight, ChevronRight, Clock, Lock, Plus, Shield } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import AlwaysBlockedSheet from './AlwaysBlockedSheet';
import EssentialAppsSheet from './EssentialAppsSheet';
import FocusCheck from './FocusCheck';
import FocusSheetHeader from './FocusSheetHeader';
import ZoneClock from './ZoneClock';
import DayGauge, { gaugeStanding, gaugeStateColor } from './DayGauge';
import PlanCardBackdrop from './PlanCardBackdrop';
import { getNativeActivitySelectionSummary, isNativeFocusAvailable } from './focusNativeBridge';
import { useNativeActivitySelectionSummary } from './nativeSelectionSummaryStore';
import { usePermissionGate } from './usePermissionGate';
import { PLAN_VISUALS, planVisualFor } from './planVisuals';
import {
  activeZone,
  assignPlanToWeekday,
  assignPlanToWeekdayAndToday,
  dateKey,
  DAY_LETTERS,
  DAY_NAMES,
  describeRules,
  formatMinutesShort,
  getEffectivePlan,
  getLiveUsageSnapshot,
  getPlanById,
  groupName,
  planHasProtectionNow,
  swapTodayPlan,
  useDayPlan,
  weekdayMondayFirst,
  wouldPlanLoseTodayTarget,
  type DayPlan,
  type DayPlanState,
  type PlanZone,
} from './dayPlanStore';

const enter = (delay: number) => FadeInDown.duration(420).delay(delay);

const NO_PLAN_VISUAL = {
  gradient: ['#F6DDD7', '#FFF2EE', '#FFFCFA'] as const,
  border: '#EABEB3',
  accent: '#B6533F',
  accentSoft: 'rgba(182,83,63,0.13)',
  ink: '#6D2E25',
  body: '#8D5A50',
  bloom: 'rgba(182,83,63,0.18)',
} as const;

const EMPTY_PLAN_VISUAL = PLAN_VISUALS[1];

type PickerState =
  | { mode: 'template'; day: number }
  | { mode: 'today'; day: number }
  | { mode: 'today-and-template'; day: number }
  | null;

type PlanChangeConfirmation = {
  planId: string | null;
  kind: 'known-loss' | 'native-reconcile';
} | null;

function PlanPickerSheet({
  picker,
  onClose,
}: {
  picker: PickerState;
  onClose: () => void;
}) {
  const state = useDayPlan();
  const { request: requestActivation, gate: activationGate } = usePermissionGate({ embedded: true });
  const nativeAvailable = isNativeFocusAvailable();
  const [pendingChange, setPendingChange] = useState<PlanChangeConfirmation>(null);
  const [checkingPlanId, setCheckingPlanId] = useState<string | null>(null);
  const [activationError, setActivationError] = useState<string | null>(null);
  const day = picker?.day ?? 0;
  const today = new Date();
  const todayRecord = state.days[dateKey(today)];
  const affectsToday = picker?.mode === 'today' || picker?.mode === 'today-and-template';
  const currentPlanId = affectsToday
    ? todayRecord ? todayRecord.planId : state.schedule[weekdayMondayFirst(today)]
    : state.schedule[day];
  const currentPlan = getPlanById(state, currentPlanId);
  const currentTemplatePlanId = state.schedule[day];

  useEffect(() => {
    setPendingChange(null);
    setCheckingPlanId(null);
    setActivationError(null);
  }, [picker?.day, picker?.mode]);

  const apply = (planId: string | null) => {
    if (!picker) return;
    if (picker.mode === 'today') swapTodayPlan(planId);
    else if (picker.mode === 'today-and-template') assignPlanToWeekdayAndToday(day, planId);
    else assignPlanToWeekday(day, planId);
    onClose();
  };

  const missingNativeSelections = async (nextPlan: DayPlan) => {
    // Stored Daily/Session rules are only a reversible draft in this mode.
    // Activation must not demand selections for invisible rules.
    if (nextPlan.essentialsOnly) return [];
    const required = new Map<string, string>();
    const ruleSets = nextPlan.kind === 'session'
      ? nextPlan.zones.flatMap(session => session.rules ?? [])
      : nextPlan.rules;
    for (const rule of ruleSets) {
      const groupMode = rule.mode ?? (rule.dailyMinutes == null ? 'noLimit' : 'limit');
      const activeAppRules = (rule.appRules ?? []).filter(appRule => {
        const appMode = appRule.mode ?? (appRule.minutes == null ? 'noLimit' : 'limit');
        return appMode === 'blocked' || (appMode === 'limit' && appRule.minutes != null);
      });
      if (
        groupMode === 'blocked'
        || (groupMode === 'limit' && rule.dailyMinutes != null)
        || activeAppRules.length > 0
      ) {
        required.set(
          `plan.${nextPlan.id}.group.${rule.groupId}`,
          `${groupName(state, rule.groupId)} group`
        );
      }
      for (const appRule of activeAppRules) {
        required.set(
          `plan.${nextPlan.id}.group.${rule.groupId}.app.${appRule.appId}`,
          appRule.label?.trim() || 'an individual app rule'
        );
      }
    }
    const missing: string[] = [];
    for (const [selectionId, label] of required) {
      const summary = await getNativeActivitySelectionSummary(selectionId);
      const isIndividual = selectionId.includes('.app.');
      if (!summary || (isIndividual ? summary.applicationCount !== 1 : summary.applicationCount === 0)) {
        missing.push(label);
      }
    }
    return missing;
  };

  const applyWithPermission = async (planId: string | null) => {
    const nextPlan = getPlanById(state, planId);
    const changesToday = affectsToday && planId !== currentPlanId;
    const activatesToday = changesToday
      && !!nextPlan
      && (nextPlan.budgetMinutes != null || planHasProtectionNow(nextPlan, new Date()));
    setActivationError(null);
    if (activatesToday && nativeAvailable && nextPlan) {
      setCheckingPlanId(nextPlan.id);
      try {
        const missing = await missingNativeSelections(nextPlan);
        if (missing.length > 0) {
          const visible = missing.slice(0, 2).join(' and ');
          const rest = missing.length > 2 ? ` and ${missing.length - 2} more` : '';
          setActivationError(`Open ${nextPlan.name} and choose real iPhone apps for ${visible}${rest} before activating it.`);
          return;
        }
      } catch {
        setActivationError(`Anasta couldn't verify ${nextPlan.name}'s iPhone selections. Try selecting the plan again.`);
        return;
      } finally {
        setCheckingPlanId(null);
      }
    }
    if (activatesToday) requestActivation(() => apply(planId));
    else apply(planId);
  };

  const choose = (planId: string | null) => {
    const alreadySelected = picker?.mode === 'today-and-template'
      ? planId === currentPlanId && planId === currentTemplatePlanId
      : planId === currentPlanId;
    if (alreadySelected) {
      onClose();
      return;
    }
    const changesToday = affectsToday && planId !== currentPlanId;
    if (changesToday && wouldPlanLoseTodayTarget(planId)) {
      setPendingChange({ planId, kind: 'known-loss' });
      return;
    }
    const nextTarget = getPlanById(state, planId)?.budgetMinutes ?? null;
    const currentTarget = currentPlan?.budgetMinutes ?? null;
    const tightensUnknownToday = changesToday
      && !todayRecord?.targetLost
      && nextTarget != null
      && (currentTarget == null || nextTarget < currentTarget);
    if (tightensUnknownToday) {
      setPendingChange({ planId, kind: 'native-reconcile' });
      return;
    }
    void applyWithPermission(planId);
  };

  return (
    <SmoothBottomSheet
      visible={picker !== null}
      onClose={onClose}
      sheetStyle={s.sheet}
      overlayChildren={(
        <>
          <ConfirmModal
            visible={pendingChange !== null}
            icon={<Lock s={21} c="#A24351" w={2.2} />}
            iconBg="#F8E7EA"
            title={pendingChange?.kind === 'known-loss' ? 'Today would lose its trophy' : "Tighten today's target?"}
            body={pendingChange?.kind === 'known-loss'
              ? "This plan's Daily Target is already below the phone time used today. The change is allowed, but today's target cannot become eligible again."
              : "Apple keeps exact live usage inside Screen Time. The new plan applies immediately and iPhone will reconcile today's activity with its tighter target. If that target has already been passed, today's trophy becomes ineligible and raising it later will not restore it."}
            subject={pendingChange?.planId ? getPlanById(state, pendingChange.planId)?.name : 'No plan'}
            confirmLabel="APPLY PLAN"
            confirmColor="#A24351"
            onCancel={() => setPendingChange(null)}
            onConfirm={() => {
              const planId = pendingChange?.planId ?? null;
              setPendingChange(null);
              void applyWithPermission(planId);
            }}
            embedded
          />
          {activationGate}
        </>
      )}
    >
        <FocusSheetHeader
          kicker={picker?.mode === 'today'
            ? 'PROTECT TODAY'
            : picker?.mode === 'today-and-template'
              ? 'TODAY & WEEKLY RHYTHM'
              : 'CHOOSE A RHYTHM'}
          title={picker?.mode === 'today'
            ? "Choose today's protection plan"
            : picker?.mode === 'today-and-template'
              ? `Today and future ${DAY_NAMES[day]}s`
              : DAY_NAMES[day]}
          subtitle={picker?.mode === 'today'
            ? 'One Phone Plan will guide and protect your time for the rest of today.'
            : picker?.mode === 'today-and-template'
              ? `This changes protection now and becomes the default for future ${DAY_NAMES[day]}s.`
              : `This sets the default for future ${DAY_NAMES[day]}s without rewriting today.`}
          onClose={onClose}
          large
        />

        {activationError && (
          <View style={s.activationError}>
            <Shield s={14} c="#A24351" w={2.1} />
            <Text style={s.activationErrorText}>{activationError}</Text>
          </View>
        )}

        <ScrollView
          style={s.pickerScroll}
          contentContainerStyle={s.pickerList}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {state.plans.map(plan => {
            const selected = currentPlanId === plan.id;
            const isSession = !plan.essentialsOnly && plan.kind === 'session';
            const visual = planVisualFor(plan);
            return (
              <TouchableOpacity
                key={plan.id}
                style={[
                  s.pickerRow,
                  { borderColor: selected ? visual.accent : visual.border, borderWidth: selected ? 1.5 : 1 },
                  checkingPlanId !== null && checkingPlanId !== plan.id && s.pickerRowMuted,
                ]}
                onPress={() => checkingPlanId === null && choose(plan.id)}
                disabled={checkingPlanId !== null}
                haptic="selection"
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={plan.name}
              >
                <LinearGradient colors={visual.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                <View pointerEvents="none" style={[s.pickerBloom, { backgroundColor: visual.bloom }]} />
                <View style={[s.pickerVisual, { backgroundColor: visual.accentSoft, borderColor: visual.border }]}>
                  {isSession
                    ? <Clock s={22} c={visual.accent} w={2} />
                    : <Shield s={22} c={visual.accent} w={2} />}
                </View>
                <View style={s.pickerCopy}>
                  <Text style={[s.pickerName, { color: visual.ink }]} numberOfLines={1}>{plan.name}</Text>
                  <Text style={[s.pickerMeta, { color: visual.body }]} numberOfLines={2}>
                    {checkingPlanId === plan.id
                      ? 'Checking your private iPhone selections...'
                      : [
                          plan.budgetMinutes == null ? 'No daily target' : `${formatMinutesShort(plan.budgetMinutes)} target`,
                          plan.essentialsOnly ? 'Essentials only' : null,
                          isSession ? `${plan.zones.length} Sessions` : null,
                        ].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <FocusCheck checked={selected} size={24} accent={visual.accent} />
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={[
              s.pickerRow,
              s.pickerRestRow,
              { borderColor: currentPlanId == null ? NO_PLAN_VISUAL.accent : NO_PLAN_VISUAL.border, borderWidth: currentPlanId == null ? 1.5 : 1 },
            ]}
            onPress={() => choose(null)}
            haptic="selection"
            accessibilityRole="button"
            accessibilityState={{ selected: currentPlanId == null }}
            accessibilityLabel="No plan, no Screen Time boundaries"
          >
            <LinearGradient colors={NO_PLAN_VISUAL.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <View pointerEvents="none" style={[s.pickerBloom, { backgroundColor: NO_PLAN_VISUAL.bloom }]} />
            <View style={[s.pickerVisual, { backgroundColor: NO_PLAN_VISUAL.accentSoft, borderColor: NO_PLAN_VISUAL.border }]}>
              <Shield s={22} c={NO_PLAN_VISUAL.accent} w={1.9} />
              <View pointerEvents="none" style={[s.noPlanSlash, { backgroundColor: NO_PLAN_VISUAL.accent }]} />
            </View>
            <View style={s.pickerCopy}>
              <Text style={[s.pickerName, { color: NO_PLAN_VISUAL.ink }]}>No plan</Text>
              <Text style={[s.pickerMeta, { color: NO_PLAN_VISUAL.body }]}>Leaves this day without Screen Time boundaries.</Text>
            </View>
            <FocusCheck checked={currentPlanId == null} size={24} accent={NO_PLAN_VISUAL.accent} />
          </TouchableOpacity>
        </ScrollView>
    </SmoothBottomSheet>
  );
}

function TodayPlanHero({
  plan,
  currentSession,
  usedMinutes,
  onChoose,
  onOpenDetail,
  notice,
}: {
  plan: DayPlan | null;
  currentSession?: PlanZone | null;
  usedMinutes: number | null;
  onChoose: () => void;
  onOpenDetail: () => void;
  notice?: ReactNode;
}) {
  if (!plan) {
    const visual = NO_PLAN_VISUAL;
    return (
      <TouchableOpacity
        style={[s.todayRestCard, { borderColor: visual.border }]}
        onPress={onChoose}
        activeOpacity={0.9}
        haptic="selection"
        accessibilityRole="button"
        accessibilityLabel="Today is unprotected. Choose a Screen Time plan."
      >
        <LinearGradient colors={visual.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={[s.todayBloom, { backgroundColor: visual.bloom }]} />
        <View pointerEvents="none" style={s.todayRestOrbitOuter} />
        <View pointerEvents="none" style={s.todayRestOrbitInner} />
        <View pointerEvents="none" style={[s.todayRestGlyph, { backgroundColor: visual.accentSoft, borderColor: visual.border }]}>
          <Shield s={29} c={visual.accent} w={1.8} />
          <View style={[s.todayNoPlanSlash, { backgroundColor: visual.accent }]} />
        </View>
        <View style={s.todayRestCopy}>
          <Text style={[s.todayHeroKicker, { color: visual.accent }]}>TIME UNPROTECTED</Text>
          <Text style={[s.todayRestTitle, { color: visual.ink }]}>No plan is protecting today</Text>
          <Text style={[s.todayRestBody, { color: visual.body }]}>Without a boundary, scrolling gets the whole day. Protect your time for the life you actually want to live.</Text>
          <View style={[s.todayRestCta, { backgroundColor: visual.ink }]} pointerEvents="none">
            <Text style={s.todayRestCtaText}>Protect today</Text>
            <ChevronRight s={14} c="#FFFFFF" w={2.4} />
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  const visual = planVisualFor(plan);
  const goal = plan.budgetMinutes;
  const toleranceEnd = plan.essentialOnlyMinutes ?? plan.tolerableMinutes;
  const standing = goal != null ? gaugeStanding(goal, toleranceEnd, usedMinutes) : 'unknown';
  const stateColor = gaugeStateColor(standing, visual.ink);

  let sideValue: string | null = null;
  let sideCaption: string | null = null;
  if (goal != null && usedMinutes != null) {
    if (standing === 'under') {
      sideValue = `${formatMinutesShort(Math.max(0, goal - usedMinutes))} left`;
      sideCaption = 'before your goal';
    } else if (standing === 'tolerance') {
      sideValue = `${formatMinutesShort(Math.max(0, (toleranceEnd ?? goal) - usedMinutes))} left`;
      sideCaption = 'of tolerance';
    } else {
      sideValue = 'Essentials only';
      sideCaption = 'the limit is behind you';
    }
  }

  return (
    <TouchableOpacity
      style={[s.todayPlanCard, { borderColor: visual.border }]}
      onPress={onOpenDetail}
      activeOpacity={0.9}
      haptic="selection"
      accessibilityRole="button"
      accessibilityLabel={`${plan.name} is protecting today. Open today's detail.`}
    >
      <LinearGradient colors={visual.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <PlanCardBackdrop visual={visual} ringSize={172} live />

      <View style={s.todayPlanTopRow}>
        <View style={s.todayPlanHeading}>
          <Text style={[s.todayHeroKicker, { color: visual.accent }]}>TODAY’S PLAN</Text>
          <Text style={[s.todayPlanName, { color: visual.ink }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{plan.name}</Text>
          {plan.essentialsOnly ? (
            <Text style={[s.todayPlanStatus, { color: visual.body }]} numberOfLines={1}>
              Essentials only · protected from minute one
            </Text>
          ) : currentSession && (
            <Text style={[s.todayPlanStatus, { color: visual.body }]} numberOfLines={1}>
              {currentSession.name} · active until {formatTimeOfDaySafe(currentSession.endMinutes)}
            </Text>
          )}
        </View>
        <TouchableOpacity style={[s.todayPlanChange, { borderColor: visual.border }]} onPress={onChoose} haptic="selection">
          <Text style={[s.todayPlanChangeText, { color: visual.accent }]}>Change</Text>
          <ChevronRight s={13} c={visual.accent} w={2.3} />
        </TouchableOpacity>
      </View>

      <View style={s.todayValueRow}>
        <View style={s.todayValueMain}>
          {goal == null ? (
            <Text style={[s.todayValueBig, { color: visual.ink }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>Group limits</Text>
          ) : (
            <View style={s.todayValueLine}>
              <Text style={[s.todayValueBig, { color: stateColor }]} numberOfLines={1}>
                {usedMinutes == null ? '– –' : formatMinutesShort(usedMinutes)}
              </Text>
              <Text style={[s.todayValueGoal, { color: visual.body }]} numberOfLines={1}>
                {' '}/ {formatMinutesShort(goal)}
              </Text>
            </View>
          )}
          <Text style={[s.todayValueCaption, { color: visual.body }]}>
            {goal == null ? 'shape this day' : 'screen time today'}
          </Text>
        </View>
        {sideValue != null && (
          <View style={s.todayValueSide}>
            <Text style={[s.todayValueSideText, { color: stateColor }]} numberOfLines={1}>{sideValue}</Text>
            <Text style={[s.todayValueCaption, { color: visual.body }]} numberOfLines={1}>{sideCaption}</Text>
          </View>
        )}
      </View>

      {goal != null && (
        <DayGauge
          goalMinutes={goal}
          toleranceEndMinutes={toleranceEnd}
          usedMinutes={usedMinutes}
          accent={visual.accent}
          labelColor={visual.body}
          style={s.todayGauge}
        />
      )}

      <View style={[s.todayFooterRow, { borderTopColor: visual.border }]}>
        <Text style={[s.todayFooterNote, { color: visual.body }]} numberOfLines={1}>
          {usedMinutes == null ? 'Usage syncs privately from your iPhone' : 'Live from your iPhone · approximate'}
        </Text>
        <View style={s.todayDetailLink}>
          <Text style={[s.todayDetailLinkText, { color: visual.accent }]}>Today in detail</Text>
          <ChevronRight s={13} c={visual.accent} w={2.3} />
        </View>
      </View>
      {notice}
    </TouchableOpacity>
  );
}

function PlanCard({
  plan,
  days,
  state,
  isToday,
  onPress,
}: {
  plan: DayPlan;
  days: number[];
  state: DayPlanState;
  isToday: boolean;
  onPress: () => void;
}) {
  const visual = planVisualFor(plan);
  const isSession = !plan.essentialsOnly && plan.kind === 'session';
  const today = weekdayMondayFirst(new Date());
  const goal = plan.budgetMinutes;
  const toleranceEnd = plan.essentialOnlyMinutes ?? plan.tolerableMinutes;
  const toleranceDuration = goal != null && toleranceEnd != null
    ? Math.max(0, toleranceEnd - goal)
    : null;
  const rules = plan.essentialsOnly ? 'Protected from minute one' : describeRules(state, plan);
  const meta = [
    goal == null ? 'No daily target' : `${formatMinutesShort(goal)} goal`,
    toleranceDuration != null && toleranceDuration > 0 ? `+${formatMinutesShort(toleranceDuration)}` : null,
    rules === 'No daily limits' ? null : rules,
  ].filter(Boolean).join(' · ');

  return (
    <TouchableOpacity
      style={[s.planCard, { borderColor: visual.border }]}
      onPress={onPress}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={`Open and edit ${plan.name}`}
    >
      <LinearGradient colors={visual.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <PlanCardBackdrop visual={visual} compact />

      <View style={s.planCardRow}>
        <View style={[s.planCardSeal, { backgroundColor: visual.accentSoft, borderColor: visual.border }]}>
          {isSession ? <ZoneClock zones={plan.zones} size={44} compact /> : <Shield s={22} c={visual.accent} w={1.9} />}
        </View>
        <View style={s.planCardCopy}>
          <View style={s.planCardNameRow}>
            <Text style={[s.planCardName, { color: visual.ink }]} numberOfLines={1}>{plan.name}</Text>
            {isToday && (
              <View style={[s.planTodayChip, { backgroundColor: visual.accent }]}>
                <Text style={s.planTodayChipText}>TODAY</Text>
              </View>
            )}
          </View>
          <Text style={[s.planCardMeta, { color: visual.body }]} numberOfLines={1}>{meta}</Text>
        </View>
        <ChevronRight s={17} c={visual.accent} w={2.1} />
      </View>

      <View style={[s.planCardWeek, { borderTopColor: visual.border }]}>
        <Text style={[s.planScheduleLabel, { color: visual.accent }]}>
          {days.length > 0 ? 'ACTIVE THIS WEEK' : 'NOT ON YOUR WEEK YET'}
        </Text>
        <View style={s.planDayRow}>
          {DAY_LETTERS.map((letter, index) => {
            const active = days.includes(index);
            return (
              <View
                key={`${letter}-${index}`}
                style={[
                  s.planDayCircle,
                  { borderColor: visual.border, backgroundColor: '#FFFFFF' },
                  active && { backgroundColor: visual.accent, borderColor: visual.accent },
                  index === today && !active && { borderWidth: 1.5, borderColor: visual.accent },
                ]}
              >
                <Text style={[
                  s.planDayLetter,
                  { color: visual.body },
                  active && s.planDayLetterOn,
                ]}>{letter}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function DayPlanHubView() {
  const router = useRouter();
  const state = useDayPlan();
  const { request, gate } = usePermissionGate();
  const [picker, setPicker] = useState<PickerState>(null);
  const [essentialsOpen, setEssentialsOpen] = useState(false);
  const [alwaysBlockedOpen, setAlwaysBlockedOpen] = useState(false);
  const today = weekdayMondayFirst(new Date());
  const todayPlan = getEffectivePlan(state, new Date());
  const currentSession = todayPlan?.essentialsOnly ? null : activeZone(todayPlan, new Date());
  const todayPlanProtects = planHasProtectionNow(todayPlan, new Date());
  const todayUsage = getLiveUsageSnapshot(dateKey(new Date()));
  const nativeAvailable = isNativeFocusAvailable();
  const optionalSummary = useNativeActivitySelectionSummary('global.essentials');
  const strictAlwaysSummary = useNativeActivitySelectionSummary('always.strict');
  const looseAlwaysSummary = useNativeActivitySelectionSummary('always.loose');
  const optionalCount = nativeAvailable
    ? optionalSummary?.applicationCount ?? null
    : state.optionalEssentialAppIds.length;
  const alwaysBlockedCount = nativeAvailable
    ? strictAlwaysSummary && looseAlwaysSummary
      ? strictAlwaysSummary.applicationCount + looseAlwaysSummary.applicationCount
      : null
    : state.alwaysBlockedApps.length;

  const daysByPlan = useMemo(() => {
    const result: Record<string, number[]> = {};
    state.schedule.forEach((planId, day) => {
      if (!planId) return;
      result[planId] = [...(result[planId] ?? []), day];
    });
    return result;
  }, [state.schedule]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenTitleBar title="SCREEN TIME" showBack />
      <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
        <Animated.View entering={enter(0)}>
          <TodayPlanHero
            plan={todayPlan}
            currentSession={currentSession}
            usedMinutes={todayUsage?.totalMinutes ?? null}
            onChoose={() => setPicker({ mode: 'today', day: today })}
            onOpenDetail={() => router.push('/day-plan-today' as never)}
            notice={todayPlanProtects && state.permission !== 'approved' ? (
              <View style={s.permissionRow}>
                <Shield s={15} c="#A36F2B" w={2.1} />
                <Text style={s.permissionText}>
                  {state.permission === 'preview'
                    ? 'Preview mode is active. Real shields require the Anasta development build.'
                    : 'This plan is saved, but Screen Time access is still needed.'}
                </Text>
                {state.permission !== 'preview' && <TouchableOpacity onPress={() => request(() => {})}><Text style={s.permissionAction}>Enable</Text></TouchableOpacity>}
              </View>
            ) : undefined}
          />
        </Animated.View>

        <Animated.View entering={enter(100)}>
          <Text style={s.sectionLabel}>WEEKLY RHYTHM</Text>
          <View style={s.weekBand}>
            <View style={s.weekRow}>
              {DAY_LETTERS.map((letter, day) => {
                const plan = getPlanById(state, state.schedule[day]);
                const visual = plan ? planVisualFor(plan) : NO_PLAN_VISUAL;
                return (
                  <TouchableOpacity
                    key={day}
                    style={s.weekCell}
                    onPress={() => setPicker({
                      mode: day === today ? 'today-and-template' : 'template',
                      day,
                    })}
                    haptic="selection"
                    accessibilityRole="button"
                    accessibilityLabel={`${DAY_NAMES[day]}, ${plan ? plan.name : 'No plan'}`}
                  >
                    <View style={[
                      s.weekCircle,
                      plan
                        ? { borderColor: visual.border, backgroundColor: visual.accentSoft }
                        : { borderColor: '#E4DFD4', backgroundColor: '#FFFFFF' },
                      day === today && s.weekCircleToday,
                    ]}>
                      {!!plan && (
                        <Svg width={44} height={44} style={StyleSheet.absoluteFill} pointerEvents="none">
                          {[7, 18, 29, 40, 51].map(offset => (
                            <Line
                              key={offset}
                              x1={offset}
                              y1={-3}
                              x2={offset - 50}
                              y2={47}
                              stroke={visual.accent}
                              strokeOpacity={0.16}
                              strokeWidth={1}
                            />
                          ))}
                        </Svg>
                      )}
                      <Text style={[s.weekLetter, { color: plan ? visual.ink : C.textMuted }]}>{letter}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={s.weekNote}>Today updates now. Other days shape future weeks.</Text>
          </View>
        </Animated.View>

        <Animated.View entering={enter(150)}>
          <Text style={s.sectionLabel}>PROTECTION DEFAULTS</Text>
          <View style={s.defaultsGrid}>
            <TouchableOpacity
              style={s.defaultCard}
              onPress={() => setEssentialsOpen(true)}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel="Essential Apps"
            >
              <View style={s.defaultCardSeal}><Lock s={17} c={C.goldDark} w={2.1} /></View>
              <Text style={s.defaultCardTitle}>Essential Apps</Text>
              <Text style={s.defaultCardMeta} numberOfLines={2}>
                {optionalCount == null
                  ? 'Syncing with iPhone'
                  : `${optionalCount} ${optionalCount === 1 ? 'app stays' : 'apps stay'} open after the limit`}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.defaultCard}
              onPress={() => setAlwaysBlockedOpen(true)}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel="Always Blocked"
            >
              <View style={[s.defaultCardSeal, s.defaultCardSealRose]}><Shield s={17} c="#A24351" w={2.1} /></View>
              <Text style={s.defaultCardTitle}>Always Blocked</Text>
              <Text style={s.defaultCardMeta} numberOfLines={2}>
                {alwaysBlockedCount == null
                  ? 'Syncing with iPhone'
                  : alwaysBlockedCount === 0
                    ? 'Nothing is sealed away yet'
                    : `${alwaysBlockedCount} ${alwaysBlockedCount === 1 ? 'app is' : 'apps are'} sealed away for good`}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Animated.View entering={enter(200)}>
          <View style={s.plansHeader}><Text style={s.sectionLabelNoMargin}>PLANS</Text><Text style={s.plansCount}>{state.plans.length} saved</Text></View>
          <View style={s.planList}>
            {state.plans.length === 0 ? (
              <TouchableOpacity
                style={[s.planEmptyCard, { borderColor: EMPTY_PLAN_VISUAL.border }]}
                onPress={() => router.push('/day-plan' as never)}
                activeOpacity={0.9}
              >
                <LinearGradient colors={EMPTY_PLAN_VISUAL.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                <View pointerEvents="none" style={[s.planEmptyBloom, { backgroundColor: EMPTY_PLAN_VISUAL.bloom }]} />
                <View style={[s.planEmptyIcon, { backgroundColor: EMPTY_PLAN_VISUAL.accentSoft, borderColor: EMPTY_PLAN_VISUAL.border }]}>
                  <Plus s={20} c={EMPTY_PLAN_VISUAL.accent} w={2.2} />
                </View>
                <View style={s.planEmptyCopy}>
                  <Text style={[s.planEmptyKicker, { color: EMPTY_PLAN_VISUAL.accent }]}>START PROTECTING YOUR TIME</Text>
                  <Text style={[s.planEmptyTitle, { color: EMPTY_PLAN_VISUAL.ink }]}>Create your first plan</Text>
                  <Text style={[s.planEmptyBody, { color: EMPTY_PLAN_VISUAL.body }]}>Decide how much phone time is enough—and keep the rest of the day for your real life.</Text>
                </View>
                <View style={[s.planEmptyArrow, { backgroundColor: EMPTY_PLAN_VISUAL.accent }]}>
                  <ArrowUpRight s={16} c="#FFFFFF" w={2.4} />
                </View>
              </TouchableOpacity>
            ) : state.plans.map(plan => (
              <PlanCard
                key={plan.id}
                plan={plan}
                days={daysByPlan[plan.id] ?? []}
                state={state}
                isToday={todayPlan?.id === plan.id}
                onPress={() => router.push(`/day-plan?planId=${plan.id}` as never)}
              />
            ))}
          </View>
          {state.plans.length > 0 && (
            <TouchableOpacity style={s.newPlanButton} onPress={() => router.push('/day-plan' as never)}>
              <View style={s.newPlanIcon}><Plus s={14} c={C.goldDark} w={2.5} /></View>
              <Text style={s.newPlanText}>Create a new plan</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </ScrollView>

      <PlanPickerSheet
        picker={picker}
        onClose={() => setPicker(null)}
      />
      <EssentialAppsSheet visible={essentialsOpen} onClose={() => setEssentialsOpen(false)} />
      <AlwaysBlockedSheet visible={alwaysBlockedOpen} onClose={() => setAlwaysBlockedOpen(false)} />
      {gate}
    </View>
  );
}

function formatTimeOfDaySafe(minutes: number) {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 90, gap: 20 },
  sectionLabel: { marginBottom: 8, marginLeft: 4, fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.4, color: C.textMuted },
  sectionLabelNoMargin: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.4, color: C.textMuted },
  todayRestCard: { position: 'relative', minHeight: 190, borderRadius: 28, borderCurve: 'continuous', borderWidth: 1, overflow: 'hidden', padding: 20, boxShadow: '0 10px 28px rgba(71, 60, 44, 0.09)' },
  todayBloom: { position: 'absolute', right: -36, top: -42, width: 190, height: 190, borderRadius: 95, opacity: 0.72 },
  todayRestOrbitOuter: { position: 'absolute', right: -18, top: -14, width: 142, height: 142, borderRadius: 71, borderWidth: 1, borderColor: 'rgba(182,83,63,0.13)' },
  todayRestOrbitInner: { position: 'absolute', right: 12, top: 16, width: 82, height: 82, borderRadius: 41, borderWidth: 1, borderColor: 'rgba(182,83,63,0.18)' },
  todayRestGlyph: { position: 'absolute', right: 29, top: 33, width: 54, height: 54, borderRadius: 18, borderCurve: 'continuous', borderWidth: 1, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-4deg' }] },
  todayNoPlanSlash: { position: 'absolute', width: 38, height: 2.5, borderRadius: 2, transform: [{ rotate: '-42deg' }] },
  todayRestCopy: { maxWidth: '72%', minWidth: 0 },
  todayHeroKicker: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 2.2 },
  todayRestTitle: { marginTop: 7, fontFamily: F.serifSemiBold, fontSize: 29, lineHeight: 32, letterSpacing: -0.45 },
  todayRestBody: { marginTop: 7, fontFamily: F.serif, fontSize: 15, lineHeight: 20 },
  todayRestCta: { alignSelf: 'flex-start', marginTop: 15, minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  todayRestCtaText: { fontFamily: F.sansSemiBold, fontSize: 10.5, letterSpacing: 0.2, color: '#FFFFFF' },
  todayPlanCard: { position: 'relative', borderRadius: 28, borderCurve: 'continuous', borderWidth: 1, overflow: 'hidden', paddingHorizontal: 16, paddingTop: 15, paddingBottom: 13, boxShadow: '0 10px 30px rgba(69, 58, 39, 0.10)' },
  todayPlanTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  todayPlanHeading: { flex: 1, minWidth: 0 },
  todayPlanChange: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 999, borderWidth: 1, backgroundColor: '#FFFFFF', paddingHorizontal: 11, paddingVertical: 6 },
  todayPlanChangeText: { fontFamily: F.sansSemiBold, fontSize: 10.5 },
  todayPlanName: { marginTop: 4, fontFamily: F.serifSemiBold, fontSize: 27, lineHeight: 30, letterSpacing: -0.4 },
  todayPlanStatus: { marginTop: 3, fontFamily: F.sansMedium, fontSize: 10.5, lineHeight: 15 },
  todayValueRow: { marginTop: 10, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14 },
  todayValueMain: { flexShrink: 1, minWidth: 0 },
  todayValueLine: { flexDirection: 'row', alignItems: 'baseline', minWidth: 0 },
  todayValueBig: { fontFamily: F.serifSemiBold, fontSize: 38, lineHeight: 41, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  todayValueGoal: { fontFamily: F.serifMedium, fontSize: 19, lineHeight: 24, fontVariant: ['tabular-nums'] },
  todayValueCaption: { marginTop: 2, fontFamily: F.sansMedium, fontSize: 10, lineHeight: 13.5 },
  todayValueSide: { alignItems: 'flex-end', paddingBottom: 2 },
  todayValueSideText: { fontFamily: F.serifSemiBold, fontSize: 18, lineHeight: 21, fontVariant: ['tabular-nums'] },
  todayGauge: { marginTop: 6 },
  todayFooterRow: { marginTop: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 9 },
  todayFooterNote: { flexShrink: 1, fontFamily: F.sansMedium, fontSize: 9 },
  todayDetailLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  todayDetailLinkText: { fontFamily: F.sansSemiBold, fontSize: 12.5 },
  permissionRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, backgroundColor: '#FFF1D5', paddingHorizontal: 11, paddingVertical: 8 },
  permissionText: { flex: 1, fontFamily: F.sansMedium, fontSize: 10, lineHeight: 14, color: '#8D5C1E' },
  permissionAction: { fontFamily: F.sansBold, fontSize: 10, color: '#8D5C1E' },
  weekBand: { borderRadius: 20, borderCurve: 'continuous', borderWidth: 1, borderColor: '#ECE7DC', backgroundColor: '#FEFDF9', paddingHorizontal: 5, paddingTop: 14, paddingBottom: 13 },
  weekRow: { flexDirection: 'row' },
  weekCell: { flex: 1, minWidth: 0, alignItems: 'center' },
  weekCircle: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  weekCircleToday: { borderWidth: 2, borderColor: C.gold },
  weekLetter: { fontFamily: F.sansBold, fontSize: 13 },
  weekNote: { marginTop: 8, paddingHorizontal: 22, textAlign: 'center', fontFamily: F.sansMedium, fontSize: 12, lineHeight: 16, color: C.textMuted },
  defaultsGrid: { flexDirection: 'row', gap: 10 },
  defaultCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    padding: 13,
    boxShadow: '0 5px 14px rgba(57, 48, 34, 0.05)',
  },
  defaultCardSeal: { width: 38, height: 38, borderRadius: 13, borderCurve: 'continuous', backgroundColor: C.goldLight, alignItems: 'center', justifyContent: 'center' },
  defaultCardSealRose: { backgroundColor: '#F8E7EA' },
  defaultCardTitle: { marginTop: 10, fontFamily: F.serifSemiBold, fontSize: 16.5, color: C.text },
  defaultCardMeta: { marginTop: 3, fontFamily: F.serif, fontSize: 12.5, lineHeight: 16.5, color: C.textSecondary },
  plansHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 8 },
  plansCount: { fontFamily: F.sansMedium, fontSize: 10, color: C.textMuted },
  planList: { gap: 12 },
  planCard: { position: 'relative', borderRadius: 22, borderCurve: 'continuous', borderWidth: 1, overflow: 'hidden', paddingHorizontal: 15, paddingTop: 14, paddingBottom: 13, boxShadow: '0 7px 20px rgba(57, 48, 34, 0.08)' },
  planCardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  planCardSeal: { flexShrink: 0, width: 50, height: 50, borderRadius: 17, borderCurve: 'continuous', borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  planCardCopy: { flex: 1, minWidth: 0 },
  planCardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 0 },
  planCardName: { flexShrink: 1, fontFamily: F.serifSemiBold, fontSize: 20, lineHeight: 23, letterSpacing: -0.25 },
  planTodayChip: { flexShrink: 0, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },
  planTodayChipText: { fontFamily: F.sansBold, fontSize: 7.5, letterSpacing: 1, color: '#FFFFFF' },
  planCardMeta: { marginTop: 3, fontFamily: F.sansMedium, fontSize: 10.5, lineHeight: 14, fontVariant: ['tabular-nums'] },
  planCardWeek: { marginTop: 12, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  planScheduleLabel: { fontFamily: F.sansBold, fontSize: 7.5, letterSpacing: 1.3 },
  planDayRow: { marginTop: 7, flexDirection: 'row', justifyContent: 'space-between' },
  planDayCircle: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  planDayLetter: { fontFamily: F.sansBold, fontSize: 10.5 },
  planDayLetterOn: { color: '#FFFFFF' },
  planEmptyCard: { position: 'relative', minHeight: 146, flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 25, borderCurve: 'continuous', borderWidth: 1, overflow: 'hidden', paddingHorizontal: 17, paddingVertical: 18, boxShadow: '0 7px 20px rgba(71, 60, 44, 0.07)' },
  planEmptyBloom: { position: 'absolute', right: -34, top: -50, width: 170, height: 170, borderRadius: 85, opacity: 0.74 },
  planEmptyIcon: { flexShrink: 0, width: 52, height: 52, borderRadius: 18, borderCurve: 'continuous', borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  planEmptyCopy: { flex: 1, minWidth: 0, paddingRight: 30 },
  planEmptyKicker: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.7 },
  planEmptyTitle: { marginTop: 5, fontFamily: F.serifSemiBold, fontSize: 22, lineHeight: 25, letterSpacing: -0.3 },
  planEmptyBody: { marginTop: 4, fontFamily: F.serif, fontSize: 13.5, lineHeight: 17 },
  planEmptyArrow: { position: 'absolute', right: 14, top: 14, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  newPlanButton: { marginTop: 10, height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 15, borderCurve: 'continuous', borderWidth: 1, borderStyle: 'dashed', borderColor: '#DDCEAD', backgroundColor: '#FFFDF7' },
  newPlanIcon: { width: 26, height: 26, borderRadius: 9, backgroundColor: C.goldLight, alignItems: 'center', justifyContent: 'center' },
  newPlanText: { fontFamily: F.serifSemiBold, fontSize: 15, color: C.goldDark },
  sheet: { height: '62%', backgroundColor: '#FCFBF7', borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 18, paddingBottom: 20, maxHeight: '90%' },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4.5, borderRadius: 3, backgroundColor: '#E7E5E0', marginTop: 10 },
  sheetHeader: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  sheetKicker: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 2, color: C.gold },
  sheetTitle: { marginTop: 3, fontFamily: F.serifMedium, fontSize: 25, letterSpacing: -0.2, color: C.text },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F0EFEA', alignItems: 'center', justifyContent: 'center' },
  sheetNote: { marginTop: 6, fontFamily: F.serif, fontSize: 12.5, lineHeight: 17, color: C.textSecondary },
  pickerScroll: { flex: 1, marginTop: 18 },
  pickerList: { gap: 8, paddingBottom: 18 },
  pickerRow: { position: 'relative', minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 18, borderCurve: 'continuous', borderWidth: 1, borderColor: '#EAE6DE', backgroundColor: '#FFF', overflow: 'hidden', paddingHorizontal: 11, paddingVertical: 9 },
  pickerBloom: { position: 'absolute', right: -28, top: -42, width: 126, height: 126, borderRadius: 63, opacity: 0.56 },
  noPlanSlash: { position: 'absolute', width: 28, height: 2, borderRadius: 1, transform: [{ rotate: '-42deg' }] },
  pickerRowMuted: { opacity: 0.52 },
  pickerRestRow: { marginTop: 2 },
  pickerVisual: { flexShrink: 0, width: 44, height: 44, borderRadius: 14, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E9DDBF', backgroundColor: '#F8F0DC', alignItems: 'center', justifyContent: 'center' },
  pickerCopy: { flex: 1, minWidth: 0 },
  pickerName: { flexShrink: 1, fontFamily: F.serifSemiBold, fontSize: 18.5, lineHeight: 21, color: C.text },
  pickerMeta: { marginTop: 3, fontFamily: F.sans, fontSize: 11, lineHeight: 15, color: C.textSecondary },
  activationError: { marginTop: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 7, borderRadius: 12, backgroundColor: '#F8E7EA', paddingHorizontal: 11, paddingVertical: 9 },
  activationErrorText: { flex: 1, fontFamily: F.sansMedium, fontSize: 10, lineHeight: 14, color: '#8F3443' },
});
