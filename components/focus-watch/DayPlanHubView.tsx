import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { Calendar, CheckSmall, ChevronRight, Clock, Lock, Plus, Shield } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import AlwaysBlockedSheet from './AlwaysBlockedSheet';
import EssentialAppsSheet from './EssentialAppsSheet';
import FocusSheetHeader from './FocusSheetHeader';
import ZoneClock from './ZoneClock';
import { getNativeActivitySelectionSummary, isNativeFocusAvailable } from './focusNativeBridge';
import { useNativeActivitySelectionSummary } from './nativeSelectionSummaryStore';
import { usePermissionGate } from './usePermissionGate';
import {
  activeZone,
  assignPlanToWeekday,
  dateKey,
  DAY_LETTERS,
  DAY_NAMES,
  describeRules,
  formatMinutesShort,
  getEffectivePlan,
  getPlanById,
  groupName,
  planHasProtectionNow,
  swapTodayPlan,
  useDayPlan,
  weekdayMondayFirst,
  wouldPlanLoseTodayTarget,
  type DayPlan,
  type DayPlanState,
} from './dayPlanStore';

const enter = (delay: number) => FadeInDown.duration(420).delay(delay);

type PickerState =
  | { mode: 'template'; day: number }
  | { mode: 'today'; day: number }
  | null;

type PlanChangeConfirmation = {
  planId: string | null;
  kind: 'known-loss' | 'native-reconcile';
} | null;

function PlanPickerSheet({
  picker,
  onClose,
  requestActivation,
}: {
  picker: PickerState;
  onClose: () => void;
  requestActivation: (action: () => void) => void;
}) {
  const state = useDayPlan();
  const nativeAvailable = isNativeFocusAvailable();
  const [pendingChange, setPendingChange] = useState<PlanChangeConfirmation>(null);
  const [checkingPlanId, setCheckingPlanId] = useState<string | null>(null);
  const [activationError, setActivationError] = useState<string | null>(null);
  const day = picker?.day ?? 0;
  const today = new Date();
  const todayRecord = state.days[dateKey(today)];
  const currentPlanId = picker?.mode === 'today'
    ? todayRecord ? todayRecord.planId : state.schedule[weekdayMondayFirst(today)]
    : state.schedule[day];
  const currentPlan = getPlanById(state, currentPlanId);

  useEffect(() => {
    setCheckingPlanId(null);
    setActivationError(null);
  }, [picker?.day, picker?.mode]);

  const apply = (planId: string | null) => {
    if (!picker) return;
    if (picker.mode === 'today') swapTodayPlan(planId);
    else assignPlanToWeekday(day, planId);
    onClose();
  };

  const missingNativeSelections = async (nextPlan: DayPlan) => {
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
    const activatesToday = picker?.mode === 'today'
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
      } finally {
        setCheckingPlanId(null);
      }
    }
    if (activatesToday) requestActivation(() => apply(planId));
    else apply(planId);
  };

  const choose = (planId: string | null) => {
    if (planId === currentPlanId) {
      onClose();
      return;
    }
    if (picker?.mode === 'today' && wouldPlanLoseTodayTarget(planId)) {
      setPendingChange({ planId, kind: 'known-loss' });
      return;
    }
    const nextTarget = getPlanById(state, planId)?.budgetMinutes ?? null;
    const currentTarget = currentPlan?.budgetMinutes ?? null;
    const tightensUnknownToday = picker?.mode === 'today'
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
    <>
      <SmoothBottomSheet visible={picker !== null} onClose={onClose} sheetStyle={s.sheet}>
        <FocusSheetHeader
          kicker={picker?.mode === 'today' ? 'ACTIVE DAY' : 'WEEKLY TEMPLATE'}
          title={picker?.mode === 'today' ? "Today's Screen Time" : DAY_NAMES[day]}
          subtitle={picker?.mode === 'today'
            ? 'This changes only today. Usage already recorded remains part of today.'
            : `This shapes future ${DAY_NAMES[day]}s. Today's resolved plan is not rewritten.`}
          onClose={onClose}
        />

        {activationError && (
          <View style={s.activationError}>
            <Shield s={14} c="#A24351" w={2.1} />
            <Text style={s.activationErrorText}>{activationError}</Text>
          </View>
        )}

        <View style={s.pickerList}>
          {state.plans.map((plan, index) => {
            const selected = currentPlanId === plan.id;
            return (
              <View key={plan.id}>
                {index > 0 && <View style={s.separator} />}
                <TouchableOpacity
                  style={[s.pickerRow, checkingPlanId !== null && checkingPlanId !== plan.id && s.pickerRowMuted]}
                  onPress={() => checkingPlanId === null && choose(plan.id)}
                  disabled={checkingPlanId !== null}
                  haptic="selection"
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.pickerName}>{plan.name}</Text>
                    <Text style={s.pickerMeta}>{checkingPlanId === plan.id ? 'Checking private iPhone selections...' : `${plan.kind === 'session' ? `${plan.zones.length} Sessions` : 'Daily Plan'} - ${plan.budgetMinutes == null ? 'No target' : `${formatMinutesShort(plan.budgetMinutes)} target`}`}</Text>
                  </View>
                  <View style={[s.radio, selected && s.radioOn]}>{selected && <CheckSmall s={12} c="#fff" w={3} />}</View>
                </TouchableOpacity>
              </View>
            );
          })}
          {state.plans.length > 0 && <View style={s.separator} />}
          <TouchableOpacity style={s.pickerRow} onPress={() => choose(null)} haptic="selection">
            <View style={{ flex: 1 }}><Text style={s.pickerName}>No plan</Text><Text style={s.pickerMeta}>A rest day without Screen Time rules.</Text></View>
            <View style={[s.radio, currentPlanId == null && s.radioOn]}>{currentPlanId == null && <CheckSmall s={12} c="#fff" w={3} />}</View>
          </TouchableOpacity>
        </View>
      </SmoothBottomSheet>

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
      />
    </>
  );
}

function PlanCard({ plan, days, state, onPress }: { plan: DayPlan; days: number[]; state: DayPlanState; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.planRow} onPress={onPress} activeOpacity={0.76}>
      <View style={s.planVisual}>
        {plan.kind === 'session' ? <ZoneClock zones={plan.zones} size={58} compact /> : <Calendar s={22} c={C.goldDark} w={1.9} />}
      </View>
      <View style={{ flex: 1 }}>
        <View style={s.planTitleRow}>
          <Text style={s.planName} numberOfLines={1}>{plan.name}</Text>
          <View style={s.kindTag}><Text style={s.kindTagText}>{plan.kind === 'session' ? 'SESSION' : 'DAILY'}</Text></View>
        </View>
        <Text style={s.planTarget} numberOfLines={2}>{plan.budgetMinutes == null ? 'No Daily Target' : `${formatMinutesShort(plan.budgetMinutes)} Daily Target`} · {plan.essentialOnlyMinutes == null ? 'No hard wall' : `${formatMinutesShort(plan.essentialOnlyMinutes)} Essentials + system`}</Text>
        <Text style={s.planRules} numberOfLines={1}>{describeRules(state, plan)}</Text>
        <View style={s.assignedDays}>
          {DAY_LETTERS.map((letter, index) => (
            <Text key={`${letter}-${index}`} style={[s.assignedDay, days.includes(index) && s.assignedDayOn]}>{letter}</Text>
          ))}
        </View>
      </View>
      <ChevronRight s={17} c={C.textMuted} w={2} />
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
  const currentSession = activeZone(todayPlan, new Date());
  const todayPlanProtects = planHasProtectionNow(todayPlan, new Date());
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
      <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
        <ScreenTitleBar title="SCREEN TIME" showBack />
        <Animated.View entering={enter(0)} style={s.introWrap}>
          <Text style={s.intro}>Plan your phone the way you plan your day.</Text>
        </Animated.View>

        <Animated.View entering={enter(50)}>
          <Text style={s.sectionLabel}>TODAY</Text>
          <View style={s.todayBand}>
            <LinearGradient
              colors={['rgba(255,248,232,0.92)', 'rgba(255,253,247,0.7)', 'rgba(244,250,247,0.42)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View style={s.todayHeader}>
              <View style={s.todayIcon}>{todayPlan?.kind === 'session' ? <Clock s={19} c={C.goldDark} w={2} /> : <Calendar s={19} c={C.goldDark} w={2} />}</View>
              <View style={s.todayCopy}>
                <Text style={s.todayName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>{todayPlan?.name ?? 'No plan today'}</Text>
                <Text style={s.todayMeta} numberOfLines={2}>
                  {todayPlan
                    ? currentSession
                      ? `${currentSession.name} · until ${formatTimeOfDaySafe(currentSession.endMinutes)}`
                      : todayPlan.kind === 'daily' ? 'Daily rules · all day' : 'Session plan'
                    : 'Choose a plan for this day only.'}
                </Text>
              </View>
              <TouchableOpacity style={s.changeTodayButton} onPress={() => setPicker({ mode: 'today', day: today })}>
                <Text style={s.changeTodayText}>Change</Text>
              </TouchableOpacity>
            </View>

            {todayPlan && (
              <View style={s.todayStats}>
                <View style={s.statCell}><Text style={s.statLabel}>TARGET</Text><Text style={s.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.76}>{todayPlan.budgetMinutes == null ? 'No limit' : formatMinutesShort(todayPlan.budgetMinutes)}</Text></View>
                <View style={s.statDivider} />
                <View style={s.statCell}><Text style={s.statLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>ESSENTIALS ONLY</Text><Text style={s.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.76}>{todayPlan.essentialOnlyMinutes == null ? 'Off' : formatMinutesShort(todayPlan.essentialOnlyMinutes)}</Text></View>
                <View style={s.statDivider} />
                <View style={s.statCell}><Text style={s.statLabel}>STYLE</Text><Text style={s.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{todayPlan.kind === 'session' ? `${todayPlan.zones.length} Sessions` : 'Daily'}</Text></View>
              </View>
            )}

            {todayPlanProtects && state.permission !== 'approved' && (
              <View style={s.permissionRow}>
                <Shield s={15} c="#A36F2B" w={2.1} />
                <Text style={s.permissionText}>
                  {state.permission === 'preview'
                    ? 'Preview mode is active. Real shields require the Anasta development build.'
                    : 'This plan is saved, but Screen Time access is still needed.'}
                </Text>
                {state.permission !== 'preview' && <TouchableOpacity onPress={() => request(() => {})}><Text style={s.permissionAction}>Enable</Text></TouchableOpacity>}
              </View>
            )}
          </View>
        </Animated.View>

        <Animated.View entering={enter(100)}>
          <Text style={s.sectionLabel}>WEEKLY RHYTHM</Text>
          <View style={s.weekBand}>
            <View style={s.weekRow}>
              {DAY_LETTERS.map((letter, day) => {
                const plan = getPlanById(state, state.schedule[day]);
                return (
                  <TouchableOpacity key={day} style={s.weekCell} onPress={() => setPicker({ mode: 'template', day })} haptic="selection">
                    <View style={[s.weekCircle, plan && s.weekCircleOn, day === today && s.weekCircleToday]}>
                      <Text style={[s.weekLetter, plan && s.weekLetterOn]}>{letter}</Text>
                    </View>
                    <Text style={s.weekPlan} numberOfLines={1}>{plan?.name ?? 'Rest'}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={s.weekNote}>Tap a day to shape future weeks. Today stays historically honest.</Text>
          </View>
        </Animated.View>

        <Animated.View entering={enter(150)}>
          <Text style={s.sectionLabel}>PROTECTION DEFAULTS</Text>
          <View style={s.defaultsList}>
            <TouchableOpacity style={s.defaultsRow} onPress={() => setEssentialsOpen(true)}>
              <View style={s.defaultsIcon}><Lock s={15} c={C.goldDark} w={2.2} /></View>
              <View style={{ flex: 1 }}><Text style={s.defaultsTitle}>Essential Apps</Text><Text style={s.defaultsMeta}>{optionalCount == null ? 'Loading iPhone selection' : `${optionalCount} optional`} / Core safety access</Text></View>
              <ChevronRight s={16} c={C.textMuted} w={2} />
            </TouchableOpacity>
            <View style={s.separator} />
            <TouchableOpacity style={s.defaultsRow} onPress={() => setAlwaysBlockedOpen(true)}>
              <View style={[s.defaultsIcon, s.blockedDefaultsIcon]}><Shield s={15} c="#A24351" w={2.2} /></View>
              <View style={{ flex: 1 }}><Text style={s.defaultsTitle}>Always Blocked</Text><Text style={s.defaultsMeta}>{alwaysBlockedCount == null ? 'Loading iPhone selection' : `${alwaysBlockedCount} permanent-intent apps`}</Text></View>
              <ChevronRight s={16} c={C.textMuted} w={2} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Animated.View entering={enter(200)}>
          <View style={s.plansHeader}><Text style={s.sectionLabelNoMargin}>PLANS</Text><Text style={s.plansCount}>{state.plans.length} saved</Text></View>
          <View style={s.planList}>
            {state.plans.map((plan, index) => (
              <View key={plan.id}>
                {index > 0 && <View style={s.separator} />}
                <PlanCard plan={plan} days={daysByPlan[plan.id] ?? []} state={state} onPress={() => router.push(`/day-plan?planId=${plan.id}` as never)} />
              </View>
            ))}
          </View>
          <TouchableOpacity style={s.newPlanButton} onPress={() => router.push('/day-plan' as never)}>
            <View style={s.newPlanIcon}><Plus s={14} c={C.goldDark} w={2.5} /></View>
            <Text style={s.newPlanText}>Create a new plan</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      <PlanPickerSheet
        picker={picker}
        onClose={() => setPicker(null)}
        requestActivation={request}
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
  page: { paddingHorizontal: 16, paddingBottom: 90, gap: 18 },
  introWrap: { paddingHorizontal: 30, alignItems: 'center' },
  intro: { fontFamily: F.serifMediumItalic, fontSize: 16, lineHeight: 21, color: C.textSecondary, textAlign: 'center' },
  sectionLabel: { marginBottom: 8, marginLeft: 4, fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.4, color: C.textMuted },
  sectionLabelNoMargin: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.4, color: C.textMuted },
  todayBand: {
    borderRadius: 22,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#E5D9BD',
    backgroundColor: '#FFFDF7',
    padding: 15,
    overflow: 'hidden',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  todayHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  todayCopy: { flex: 1, minWidth: 0 },
  todayIcon: { width: 40, height: 40, borderRadius: 13, borderCurve: 'continuous', backgroundColor: C.goldLight, alignItems: 'center', justifyContent: 'center' },
  todayName: { fontFamily: F.serifMedium, fontSize: 21, letterSpacing: -0.2, color: C.text },
  todayMeta: { marginTop: 2, fontFamily: F.sans, fontSize: 10.5, color: C.textSecondary },
  changeTodayButton: { borderRadius: 999, borderWidth: 1, borderColor: '#E1D2B1', backgroundColor: '#FFF8E8', paddingHorizontal: 12, paddingVertical: 8 },
  changeTodayText: { fontFamily: F.sansSemiBold, fontSize: 10.5, color: C.goldDark },
  todayStats: { marginTop: 13, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#EEE5D3', paddingTop: 11 },
  statCell: { flex: 1, minWidth: 0 },
  statLabel: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.4, color: C.textMuted },
  statValue: { marginTop: 2.5, fontFamily: F.serifMedium, fontSize: 16.5, color: C.text, fontVariant: ['tabular-nums'] },
  statDivider: { width: StyleSheet.hairlineWidth, height: 30, backgroundColor: '#E8E0D1' },
  permissionRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, backgroundColor: '#FFF1D5', paddingHorizontal: 11, paddingVertical: 9 },
  permissionText: { flex: 1, fontFamily: F.sansMedium, fontSize: 10, lineHeight: 14, color: '#8D5C1E' },
  permissionAction: { fontFamily: F.sansBold, fontSize: 10, color: '#8D5C1E' },
  weekBand: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border, paddingTop: 12, paddingBottom: 10 },
  weekRow: { flexDirection: 'row' },
  weekCell: { flex: 1, alignItems: 'center', gap: 5 },
  weekCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F0EFEB', alignItems: 'center', justifyContent: 'center' },
  weekCircleOn: { backgroundColor: C.goldLight },
  weekCircleToday: { borderWidth: 1.5, borderColor: C.gold },
  weekLetter: { fontFamily: F.sansBold, fontSize: 11, color: C.textMuted },
  weekLetterOn: { color: C.goldDark },
  weekPlan: { maxWidth: 44, fontFamily: F.sansMedium, fontSize: 8.5, color: C.textMuted },
  weekNote: { marginTop: 10, textAlign: 'center', fontFamily: F.serifItalic, fontSize: 12, color: C.textMuted },
  defaultsList: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border },
  defaultsRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 3 },
  defaultsIcon: { width: 34, height: 34, borderRadius: 11, borderCurve: 'continuous', backgroundColor: C.goldLight, alignItems: 'center', justifyContent: 'center' },
  blockedDefaultsIcon: { backgroundColor: '#F8E7EA' },
  defaultsTitle: { fontFamily: F.serifMedium, fontSize: 16.5, color: C.text },
  defaultsMeta: { marginTop: 2, fontFamily: F.sans, fontSize: 10, color: C.textSecondary },
  plansHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 8 },
  plansCount: { fontFamily: F.sansMedium, fontSize: 10, color: C.textMuted },
  planList: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border },
  planRow: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 3 },
  planVisual: { width: 60, height: 60, borderRadius: 17, borderCurve: 'continuous', backgroundColor: '#FFF8E8', borderWidth: 1, borderColor: '#F2E7CB', alignItems: 'center', justifyContent: 'center' },
  planTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  planName: { flexShrink: 1, fontFamily: F.serifMedium, fontSize: 19, letterSpacing: -0.2, color: C.text },
  kindTag: { borderRadius: 999, backgroundColor: '#F5EFE1', paddingHorizontal: 7, paddingVertical: 4 },
  kindTagText: { fontFamily: F.sansBold, fontSize: 7.5, letterSpacing: 1, color: C.goldDark },
  planTarget: { marginTop: 2.5, fontFamily: F.sansMedium, fontSize: 10, color: C.textSecondary },
  planRules: { marginTop: 2, fontFamily: F.sans, fontSize: 9.5, color: C.textMuted },
  assignedDays: { marginTop: 6, flexDirection: 'row', gap: 4 },
  assignedDay: { width: 15, height: 15, borderRadius: 8, textAlign: 'center', textAlignVertical: 'center', fontFamily: F.sansBold, fontSize: 7, color: C.textMuted, backgroundColor: '#F0EFEB', overflow: 'hidden' },
  assignedDayOn: { color: C.goldDark, backgroundColor: C.goldLight },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginLeft: 42 },
  newPlanButton: { marginTop: 10, height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 15, borderCurve: 'continuous', borderWidth: 1, borderStyle: 'dashed', borderColor: '#DDCEAD', backgroundColor: '#FFFDF7' },
  newPlanIcon: { width: 26, height: 26, borderRadius: 9, backgroundColor: C.goldLight, alignItems: 'center', justifyContent: 'center' },
  newPlanText: { fontFamily: F.serifSemiBold, fontSize: 15, color: C.goldDark },
  sheet: { backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingBottom: 28, maxHeight: '88%' },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4.5, borderRadius: 3, backgroundColor: '#E7E5E0', marginTop: 10 },
  sheetHeader: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  sheetKicker: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 2, color: C.gold },
  sheetTitle: { marginTop: 3, fontFamily: F.serifMedium, fontSize: 25, letterSpacing: -0.2, color: C.text },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F0EFEA', alignItems: 'center', justifyContent: 'center' },
  sheetNote: { marginTop: 6, fontFamily: F.serif, fontSize: 12.5, lineHeight: 17, color: C.textSecondary },
  pickerList: { marginTop: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border },
  pickerRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 3 },
  pickerRowMuted: { opacity: 0.52 },
  pickerName: { fontFamily: F.serifMedium, fontSize: 16.5, color: C.text },
  pickerMeta: { marginTop: 2, fontFamily: F.sans, fontSize: 10, color: C.textMuted },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#D6D3D1', backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: C.gold, backgroundColor: C.gold },
  activationError: { marginTop: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 7, borderRadius: 12, backgroundColor: '#F8E7EA', paddingHorizontal: 11, paddingVertical: 9 },
  activationErrorText: { flex: 1, fontFamily: F.sansMedium, fontSize: 10, lineHeight: 14, color: '#8F3443' },
});
