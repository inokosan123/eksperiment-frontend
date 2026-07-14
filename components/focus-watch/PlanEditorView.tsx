import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { Calendar, CheckSmall, ChevronRight, Clock, Lock, Plus, Shield, Trash2 } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import DailyTargetEditor, { PlanningRail, type TargetValues } from './DailyTargetEditor';
import EssentialAppsSheet from './EssentialAppsSheet';
import FocusCheck from './FocusCheck';
import FocusSwitch from './FocusSwitch';
import GoldButton from './GoldButton';
import GroupLimitSheet from './GroupLimitSheet';
import PlanGroupSheet from './PlanGroupSheet';
import SessionClockEditor, { SESSION_COLORS } from './SessionClockEditor';
import SessionCopySheet from './SessionCopySheet';
import TimeWheelSheet from './TimeWheelSheet';
import {
  clearNativeActivitySelectionsWithPrefix,
  getNativeActivitySelectionSummary,
  isNativeFocusAvailable,
} from './focusNativeBridge';
import { useNativeActivitySelectionSummary } from './nativeSelectionSummaryStore';
import { CATEGORY_TINTS, PREVIEW_APPS, type PreviewApp } from './focusContent';
import { usePermissionGate } from './usePermissionGate';
import { PLAN_VISUALS, planVisualForTheme } from './planVisuals';
import {
  APP_CATEGORIES,
  DEFAULT_GROUP_APP_IDS,
  connectedSessionsAreValid,
  dateKey,
  defaultPlanThemeId,
  deleteDayPlan,
  formatMinutesShort,
  formatTimeOfDay,
  getEffectivePlan,
  groupName,
  moveSessionBoundary,
  normalizeConnectedSessions,
  recordLimitExceeded,
  removeSessionAndExtendPrevious,
  saveDayPlan,
  splitSessionAt,
  useDayPlan,
  zoneContains,
  type GroupRule,
  type PlanKind,
  type PlanThemeId,
  type PlanZone,
  type Strength,
} from './dayPlanStore';

const enter = (delay: number) => FadeInDown.duration(420).delay(delay);

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function defaultRule(groupId: string): GroupRule {
  return {
    groupId,
    mode: 'noLimit',
    dailyMinutes: null,
    strength: 'loose',
    practice: 'prayer',
    checkInMinutes: null,
    appRules: [],
  };
}

function completeRules(rules: GroupRule[], groupIds: string[]) {
  const byId = new Map(rules.map(rule => [rule.groupId, rule]));
  return groupIds.map(groupId => byId.get(groupId) ?? defaultRule(groupId));
}

function blankSessions(count: number, groupIds: string[]): PlanZone[] {
  const safeCount = Math.max(1, Math.min(4, count));
  const boundariesByCount: Record<number, number[]> = {
    1: [0],
    2: [0, 720],
    3: [0, 480, 1020],
    4: [0, 360, 720, 1080],
  };
  const namesByCount: Record<number, string[]> = {
    1: ['Day'],
    2: ['Day', 'Evening'],
    3: ['Morning', 'Day', 'Evening'],
    4: ['Morning', 'Day', 'Evening', 'Night'],
  };
  const starts = boundariesByCount[safeCount];
  return starts.map((startMinutes, index) => ({
    id: makeId('session'),
    name: namesByCount[safeCount][index],
    startMinutes,
    endMinutes: starts[(index + 1) % starts.length],
    closedGroupIds: [],
    rules: groupIds.map(defaultRule),
  }));
}

function draftPlannedByGroup(kind: PlanKind, rules: GroupRule[], sessions: PlanZone[]) {
  const source = kind === 'session' ? sessions.flatMap(session => session.rules ?? []) : rules;
  const result: Record<string, number> = {};
  for (const rule of source) {
    if (rule.mode === 'blocked' || rule.dailyMinutes == null) continue;
    result[rule.groupId] = (result[rule.groupId] ?? 0) + rule.dailyMinutes;
  }
  return result;
}

function clonePlanCatalog(source?: Record<string, string[]>) {
  const catalog = source ?? DEFAULT_GROUP_APP_IDS;
  return Object.fromEntries(Object.entries(catalog).map(([id, appIds]) => [id, [...appIds]]));
}

function appsForGroup(catalog: Record<string, string[]>, groupId: string): PreviewApp[] {
  return (catalog[groupId] ?? [])
    .map(appId => PREVIEW_APPS.find(app => app.id === appId))
    .filter(Boolean) as PreviewApp[];
}

function ruleModeLabel(rule: GroupRule) {
  const mode = rule.mode ?? (rule.dailyMinutes == null ? 'noLimit' : 'limit');
  if (mode === 'blocked') return 'Blocked';
  if (mode === 'limit' && rule.dailyMinutes != null) return formatMinutesShort(rule.dailyMinutes);
  return 'No limit';
}

function GroupRuleMeta({
  nativeAvailable,
  selectionId,
  previewCount,
  individualCount,
}: {
  nativeAvailable: boolean;
  selectionId: string;
  previewCount: number;
  individualCount: number;
}) {
  const summary = useNativeActivitySelectionSummary(selectionId);
  const groupPart = nativeAvailable
    ? summary
      ? summary.applicationCount > 0
        ? `${summary.applicationCount} selected ${summary.applicationCount === 1 ? 'app' : 'apps'}`
        : 'Choose apps'
      : 'Loading iPhone selection'
    : `${previewCount} apps`;
  return (
    <Text style={s.ruleMeta}>
      {groupPart} · {individualCount} individual {individualCount === 1 ? 'rule' : 'rules'}
    </Text>
  );
}

export default function PlanEditorView() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { planId } = useLocalSearchParams<{ planId?: string }>();
  const state = useDayPlan();
  const { request: requestProtection, gate: permissionGate } = usePermissionGate();
  const nativeAvailable = isNativeFocusAvailable();
  const optionalEssentialsSummary = useNativeActivitySelectionSummary('global.essentials');
  const existing = useMemo(() => state.plans.find(plan => plan.id === planId), [planId, state.plans]);
  const [draftPlanId] = useState(() => existing?.id ?? makeId('plan'));
  const retainNativeSelections = useRef(!!existing);
  const initialGroupIds = useMemo(
    () => [...APP_CATEGORIES.map(group => group.id), ...(existing?.customGroupIds ?? [])],
    [existing]
  );

  const [name, setName] = useState(existing?.name ?? '');
  const [themeId, setThemeId] = useState<PlanThemeId>(existing?.themeId ?? defaultPlanThemeId(draftPlanId));
  const [kind, setKind] = useState<PlanKind>(existing?.kind ?? 'daily');
  const existingToleranceEnd = existing?.essentialOnlyMinutes ?? existing?.tolerableMinutes ?? null;
  const [target, setTarget] = useState<TargetValues>({
    target: existing ? existing.budgetMinutes : null,
    tolerable: existing ? existingToleranceEnd : null,
    essentialOnly: existing ? existingToleranceEnd : null,
  });
  const [planStrength] = useState<Strength>(existing?.strength ?? 'loose');
  const [customGroupIds, setCustomGroupIds] = useState(existing?.customGroupIds ?? []);
  const [groupCatalog, setGroupCatalog] = useState(() => clonePlanCatalog(existing?.groupCatalog));
  const [rules, setRules] = useState(() => completeRules(existing?.rules ?? [], initialGroupIds));
  const [sessions, setSessions] = useState<PlanZone[]>(() => {
    if (existing?.kind === 'session') return normalizeConnectedSessions(existing.zones);
    return blankSessions(3, initialGroupIds);
  });
  const [selectedSessionId, setSelectedSessionId] = useState(() => sessions[0]?.id ?? '');
  const [ruleGroupId, setRuleGroupId] = useState<string | null>(null);
  const [essentialsOpen, setEssentialsOpen] = useState(false);
  const [groupSheetOpen, setGroupSheetOpen] = useState(false);
  const [sessionCopyOpen, setSessionCopyOpen] = useState(false);
  const [pendingKind, setPendingKind] = useState<PlanKind | null>(null);
  const [timeEdit, setTimeEdit] = useState<{ type: 'start' | 'end' | 'add'; sessionId?: string; value: number } | null>(null);
  const [pendingAddMinute, setPendingAddMinute] = useState<number | null>(null);
  const [confirmRemoveSession, setConfirmRemoveSession] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [targetConfirmation, setTargetConfirmation] = useState<'known-loss' | 'native-reconcile' | null>(null);
  const [structuralError, setStructuralError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [checkingSelections, setCheckingSelections] = useState(false);

  const groupIds = useMemo(
    () => [...APP_CATEGORIES.map(group => group.id), ...customGroupIds],
    [customGroupIds]
  );
  const selectedSession = sessions.find(session => session.id === selectedSessionId) ?? sessions[0];
  const activeRules = kind === 'session' ? (selectedSession?.rules ?? []) : rules;
  const activeRule = activeRules.find(rule => rule.groupId === ruleGroupId) ?? null;
  const plannedByGroup = useMemo(() => draftPlannedByGroup(kind, rules, sessions), [kind, rules, sessions]);
  const draftToleranceEnd = target.essentialOnly ?? target.tolerable;
  const draftRequiresNative = useMemo(() => {
    const ruleSets = kind === 'session'
      ? sessions.flatMap(session => session.rules ?? [])
      : rules;
    const hasBoundary = ruleSets.some(rule => {
      const mode = rule.mode ?? (rule.dailyMinutes == null ? 'noLimit' : 'limit');
      if (mode === 'blocked' || (mode === 'limit' && rule.dailyMinutes != null)) return true;
      return (rule.appRules ?? []).some(appRule => {
        const appMode = appRule.mode ?? (appRule.minutes == null ? 'noLimit' : 'limit');
        return appMode === 'blocked' || (appMode === 'limit' && appRule.minutes != null);
      });
    });
    return target.target != null || target.essentialOnly != null || hasBoundary;
  }, [kind, rules, sessions, target.essentialOnly, target.target]);
  const currentPlan = getEffectivePlan(state, new Date());
  const isActivePlan = !!existing && currentPlan?.id === existing.id;
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const canSave = name.trim().length > 0 && (kind === 'daily' || connectedSessionsAreValid(sessions));

  // Essentials-only day: the whole day closes to distractions from minute one.
  // Represented through the existing target model (goal 0, tolerance 0), so
  // nothing below the switch matters — those sections rest while it is on.
  const [essentialsOnlyDay, setEssentialsOnlyDay] = useState(
    () => !!existing && existing.budgetMinutes === 0 && existing.essentialOnlyMinutes === 0
  );
  const savedTargetRef = useRef<TargetValues | null>(null);
  const toggleEssentialsOnlyDay = () => {
    if (essentialsOnlyDay) {
      setEssentialsOnlyDay(false);
      setTarget(savedTargetRef.current ?? { target: null, tolerable: null, essentialOnly: null });
      return;
    }
    savedTargetRef.current = target;
    setEssentialsOnlyDay(true);
    setTarget({ target: 0, tolerable: 0, essentialOnly: 0 });
  };

  useEffect(() => () => {
    if (!retainNativeSelections.current) {
      void clearNativeActivitySelectionsWithPrefix(`plan.${draftPlanId}.`);
    }
  }, [draftPlanId]);

  const updateActiveRule = (groupId: string, partial: Partial<GroupRule>) => {
    if (kind === 'daily') {
      setRules(current => current.map(rule => rule.groupId === groupId ? { ...rule, ...partial } : rule));
      return;
    }
    setSessions(current => current.map(session => session.id === selectedSessionId
      ? {
          ...session,
          rules: completeRules(session.rules ?? [], groupIds).map(rule => rule.groupId === groupId ? { ...rule, ...partial } : rule),
        }
      : session
    ));
  };

  const applyKind = (next: PlanKind) => {
    if (next === kind) return;
    if (next === 'session') {
      const nextSessions = blankSessions(3, groupIds);
      setSessions(nextSessions);
      setSelectedSessionId(nextSessions[0].id);
    } else {
      setRules(groupIds.map(defaultRule));
    }
    setKind(next);
    setPendingKind(null);
  };

  const addGroup = (groupId: string, appIds: string[]) => {
    setCustomGroupIds(current => current.includes(groupId) ? current : [...current, groupId]);
    setGroupCatalog(current => {
      const next = clonePlanCatalog(current);
      for (const id of Object.keys(next)) next[id] = next[id].filter(appId => !appIds.includes(appId));
      next[groupId] = [...appIds];
      return next;
    });
    setRules(current => completeRules(current, [...groupIds, groupId]));
    setSessions(current => current.map(session => ({ ...session, rules: completeRules(session.rules ?? [], [...groupIds, groupId]) })));
  };

  const removeGroup = (groupId: string) => {
    const appIds = groupCatalog[groupId] ?? [];
    setCustomGroupIds(current => current.filter(id => id !== groupId));
    setGroupCatalog(current => {
      const next = clonePlanCatalog(current);
      delete next[groupId];
      for (const appId of appIds) {
        const defaultId = PREVIEW_APPS.find(app => app.id === appId)?.categoryId;
        if (defaultId && !next[defaultId].includes(appId)) next[defaultId] = [...next[defaultId], appId];
      }
      return next;
    });
    setRules(current => current.filter(rule => rule.groupId !== groupId));
    setSessions(current => current.map(session => ({ ...session, rules: (session.rules ?? []).filter(rule => rule.groupId !== groupId) })));
    if (ruleGroupId === groupId) setRuleGroupId(null);
  };

  const commitTimeEdit = (minutes: number) => {
    if (!timeEdit) return;
    if (timeEdit.type === 'add') {
      if (isActivePlan && minutes < nowMinutes) {
        setStructuralError('A new Session in today\'s active plan may start only now or later.');
        setTimeEdit(null);
        return;
      }
      const source = sessions.find(session => zoneContains(session, minutes));
      if (!source || !splitSessionAt(sessions, minutes)) {
        setStructuralError('Choose a point that leaves at least 30 minutes on both sides.');
        setTimeEdit(null);
        return;
      }
      setPendingAddMinute(minutes);
      setStructuralError(null);
      setTimeEdit(null);
      return;
    }
    const session = sessions.find(entry => entry.id === timeEdit.sessionId);
    if (!session) return;
    if (timeEdit.type === 'start') {
      const next = moveSessionBoundary(sessions, session.id, minutes);
      if (next === sessions) {
        setStructuralError('Keep every Session at least 30 minutes long and every midnight interval at least 15 minutes long.');
      } else {
        setSessions(next);
        setStructuralError(null);
      }
    } else {
      const nextSession = sessions.find(entry => entry.startMinutes === session.endMinutes);
      if (nextSession) {
        const next = moveSessionBoundary(sessions, nextSession.id, minutes);
        if (next === sessions) {
          setStructuralError('Keep every Session at least 30 minutes long and every midnight interval at least 15 minutes long.');
        } else {
          setSessions(next);
          setStructuralError(null);
        }
      }
    }
    setTimeEdit(null);
  };

  const doSave = () => {
    retainNativeSelections.current = true;
    const toleranceEnd = target.target == null
      ? null
      : Math.max(target.target, target.essentialOnly ?? target.tolerable ?? target.target);
    const saved = saveDayPlan({
      id: draftPlanId,
      name: name.trim(),
      kind,
      themeId,
      budgetMinutes: target.target,
      // v4 has one post-Goal Tolerance period. Its endpoint is also the
      // existing native Essentials-only threshold; these must never diverge.
      tolerableMinutes: toleranceEnd,
      essentialOnlyMinutes: toleranceEnd,
      strength: planStrength,
      customGroupIds,
      groupCatalog,
      zones: kind === 'session' ? normalizeConnectedSessions(sessions) : [],
      rules: kind === 'daily' ? completeRules(rules, groupIds) : groupIds.map(defaultRule),
    });
    if (isActivePlan) {
      const actual = state.usageByDate[dateKey(new Date())]?.totalMinutes ?? 0;
      if (saved.budgetMinutes != null && actual > saved.budgetMinutes) recordLimitExceeded('daily-target');
    }
    router.back();
  };

  const commitSave = () => {
    if (isActivePlan && draftRequiresNative) requestProtection(doSave);
    else doSave();
  };

  const missingNativeSelections = async () => {
    const required = new Map<string, string>();
    const ruleSets = kind === 'session'
      ? sessions.map(session => ({ sessionName: session.name, rules: session.rules ?? [] }))
      : [{ sessionName: '', rules }];
    for (const ruleSet of ruleSets) {
      for (const draftRule of ruleSet.rules) {
        const appRules = (draftRule.appRules ?? []).filter(appRule => appRule.mode !== 'noLimit');
        const groupMode = draftRule.mode ?? (draftRule.dailyMinutes == null ? 'noLimit' : 'limit');
        const groupHasBoundary = groupMode === 'blocked'
          || (groupMode === 'limit' && draftRule.dailyMinutes != null);
        if (groupHasBoundary || appRules.length > 0) {
          required.set(
            `plan.${draftPlanId}.group.${draftRule.groupId}`,
            `${groupName(state, draftRule.groupId)} group`
          );
        }
        for (const appRule of appRules) {
          required.set(
            `plan.${draftPlanId}.group.${draftRule.groupId}.app.${appRule.appId}`,
            appRule.label?.trim() || 'an individual app rule'
          );
        }
      }
    }
    const missing: string[] = [];
    for (const [selectionId, label] of required) {
      const summary = await getNativeActivitySelectionSummary(selectionId);
      if (!summary || summary.applicationCount === 0) missing.push(label);
    }
    return missing;
  };

  const requestSave = async () => {
    if (!canSave || checkingSelections) return;
    setSaveError(null);
    if (nativeAvailable) {
      setCheckingSelections(true);
      try {
        const missing = await missingNativeSelections();
        if (missing.length > 0) {
          const visible = missing.slice(0, 2).join(' and ');
          const rest = missing.length > 2 ? ` and ${missing.length - 2} more` : '';
          setSaveError(`Choose real iPhone apps for ${visible}${rest} before saving these boundaries.`);
          return;
        }
      } finally {
        setCheckingSelections(false);
      }
    }
    const usage = state.usageByDate[dateKey(new Date())];
    if (isActivePlan && target.target != null) {
      if (usage && usage.totalMinutes > target.target) {
        setTargetConfirmation('known-loss');
        return;
      }
      const previousTarget = existing?.budgetMinutes ?? null;
      if (!usage && (previousTarget == null || target.target < previousTarget)) {
        setTargetConfirmation('native-reconcile');
        return;
      }
    }
    commitSave();
  };

  const selectedRemoveAllowed = !isActivePlan || (!!selectedSession && selectedSession.startMinutes > nowMinutes && !zoneContains(selectedSession, nowMinutes));
  const sourceForAdd = pendingAddMinute == null ? null : sessions.find(session => zoneContains(session, pendingAddMinute));
  const splitPreview = pendingAddMinute == null ? null : splitSessionAt(sessions, pendingAddMinute);
  const newSessionPreview = splitPreview?.find(session => !sessions.some(existingSession => existingSession.id === session.id));
  const previousForRemove = selectedSession
    ? normalizeConnectedSessions(sessions)[(normalizeConnectedSessions(sessions).findIndex(session => session.id === selectedSession.id) - 1 + sessions.length) % sessions.length]
    : null;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[s.page, { paddingBottom: 130 + insets.bottom }]}
      >
        <ScreenTitleBar title={existing ? 'EDIT PLAN' : 'NEW PLAN'} showBack horizontalBleed={16} />

        <Animated.View entering={enter(0)}>
          <Text style={s.sectionLabel}>PLAN NAME</Text>
          <View style={[s.nameSurface, name.length === 0 && s.nameSurfaceEmpty]}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Workday"
              placeholderTextColor={C.textMuted}
              maxLength={28}
              style={s.nameInput}
            />
            {name.trim().length > 0 && <CheckSmall s={15} c="#4E8C69" w={2.6} />}
          </View>
          {name.length === 0 && <Text style={s.requiredText}>A name is required before this plan can be saved.</Text>}

          <View style={s.colorPickerHeader}>
            <View>
              <Text style={s.colorPickerLabel}>PLAN COLOR</Text>
              <Text style={s.colorPickerHint}>Give this plan its own identity across Screen Time.</Text>
            </View>
            <Text style={[s.colorPickerValue, { color: planVisualForTheme(themeId).accent }]}>
              {planVisualForTheme(themeId).label}
            </Text>
          </View>
          <View style={s.colorPickerSurface}>
            {PLAN_VISUALS.map(visual => {
              const selected = visual.id === themeId;
              return (
                <TouchableOpacity
                  key={visual.id}
                  style={[
                    s.colorSwatchButton,
                    { backgroundColor: visual.gradient[1], borderColor: selected ? visual.accent : visual.border },
                    selected && s.colorSwatchButtonOn,
                  ]}
                  onPress={() => setThemeId(visual.id)}
                  haptic="selection"
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${visual.label} plan color`}
                >
                  <View style={[s.colorSwatch, { backgroundColor: visual.accent }]}>
                    <FocusCheck checked={selected} size={22} accent={visual.accent} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>

        <Animated.View entering={enter(30)}>
          <TouchableOpacity
            style={[s.essOnlyCard, essentialsOnlyDay && s.essOnlyCardOn]}
            activeOpacity={0.86}
            haptic="medium"
            onPress={toggleEssentialsOnlyDay}
          >
            <View style={[s.essOnlyIcon, essentialsOnlyDay && s.essOnlyIconOn]}>
              <Shield s={19} c={essentialsOnlyDay ? '#FFFFFF' : '#A63A4B'} w={2.2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.essOnlyLabel, essentialsOnlyDay && s.essOnlyLabelOn]}>ESSENTIALS-ONLY DAY</Text>
              <Text style={[s.essOnlyTitle, essentialsOnlyDay && s.essOnlyTitleOn]}>Close the whole day to distractions</Text>
              <Text style={[s.essOnlyBody, essentialsOnlyDay && s.essOnlyBodyOn]}>
                Only Essentials and iOS system access stay reachable, from the first minute. Name it, give it a color — done.
              </Text>
            </View>
            <FocusSwitch value={essentialsOnlyDay} onToggle={toggleEssentialsOnlyDay} />
          </TouchableOpacity>
          {essentialsOnlyDay && (
            <Text style={s.dormantNote}>Everything below rests while this day is Essentials-only.</Text>
          )}
        </Animated.View>

        <View
          style={[s.sectionsGroup, essentialsOnlyDay && s.dormant]}
          pointerEvents={essentialsOnlyDay ? 'none' : 'auto'}
        >
        <Animated.View entering={enter(50)}>
          <Text style={s.sectionLabel}>PLANNING STYLE</Text>
          <View style={s.kindControl}>
            <TouchableOpacity style={[s.kindOption, kind === 'daily' && s.kindOptionOn]} onPress={() => kind !== 'daily' && setPendingKind('daily')} haptic="selection">
              <View style={[s.kindIconSeal, kind === 'daily' && s.kindIconSealOn]}>
                <Calendar s={18} c={kind === 'daily' ? C.goldDark : C.textMuted} w={2} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.kindTitle, kind === 'daily' && s.kindTitleOn]}>Daily Plan</Text>
                <Text style={s.kindBody}>One set of rules holds the whole day.</Text>
                <View style={s.kindStrip}>
                  <View style={[s.kindStripSegment, { flex: 1, backgroundColor: kind === 'daily' ? C.gold : '#DDD8CC' }]} />
                </View>
              </View>
              <FocusCheck checked={kind === 'daily'} size={20} />
            </TouchableOpacity>
            <TouchableOpacity style={[s.kindOption, kind === 'session' && s.kindOptionOn]} onPress={() => kind !== 'session' && setPendingKind('session')} haptic="selection">
              <View style={[s.kindIconSeal, kind === 'session' && s.kindIconSealOn]}>
                <Clock s={18} c={kind === 'session' ? C.goldDark : C.textMuted} w={2} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.kindTitle, kind === 'session' && s.kindTitleOn]}>Session Plan</Text>
                <Text style={s.kindBody}>Morning, work, and evening each keep their own rules.</Text>
                <View style={s.kindStrip}>
                  {SESSION_COLORS.slice(0, 3).map((color, index) => (
                    <View
                      key={color}
                      style={[
                        s.kindStripSegment,
                        { flex: index === 1 ? 1.6 : 1, backgroundColor: kind === 'session' ? color : '#DDD8CC' },
                        index > 0 && { marginLeft: 3 },
                      ]}
                    />
                  ))}
                </View>
              </View>
              <FocusCheck checked={kind === 'session'} size={20} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Animated.View entering={enter(100)}>
          <DailyTargetEditor values={target} onChange={setTarget} />
        </Animated.View>

        {kind === 'session' && (
          <Animated.View entering={enter(170)} layout={LinearTransition.duration(220)}>
            <View style={s.sectionTitleRow}>
              <View>
                <Text style={s.sectionLabelNoMargin}>THE 24-HOUR DAY</Text>
                <Text style={s.sectionSub}>Drag a boundary or enter an exact time. Adjacent Sessions move together.</Text>
              </View>
              <View style={s.sessionCount}><Text style={s.sessionCountText}>{sessions.length}/4</Text></View>
            </View>
            <View style={s.clockSurface}>
              <SessionClockEditor sessions={sessions} selectedId={selectedSessionId} onSelect={setSelectedSessionId} onChange={setSessions} />

              {selectedSession && (
                <View style={s.selectedSessionPanel}>
                  <TextInput
                    value={selectedSession.name}
                    onChangeText={next => setSessions(current => current.map(session => session.id === selectedSession.id ? { ...session, name: next } : session))}
                    maxLength={20}
                    style={s.sessionNameInput}
                  />
                  <View style={s.timeButtons}>
                    <TouchableOpacity
                      style={s.timeButton}
                      disabled={sessions.length === 1}
                      onPress={() => setTimeEdit({ type: 'start', sessionId: selectedSession.id, value: selectedSession.startMinutes })}
                    >
                      <Text style={s.timeButtonLabel}>START</Text><Text style={s.timeButtonValue}>{sessions.length === 1 ? '00:00' : formatTimeOfDay(selectedSession.startMinutes)}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.timeButton}
                      disabled={sessions.length === 1}
                      onPress={() => setTimeEdit({ type: 'end', sessionId: selectedSession.id, value: selectedSession.endMinutes })}
                    >
                      <Text style={s.timeButtonLabel}>END</Text><Text style={s.timeButtonValue}>{sessions.length === 1 ? '24:00' : formatTimeOfDay(selectedSession.endMinutes)}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <View style={s.structuralActions}>
                <TouchableOpacity
                  style={s.structuralButton}
                  onPress={() => setSessionCopyOpen(true)}
                >
                  <Clock s={13} c={C.goldDark} w={2.2} /><Text style={s.structuralButtonText}>Copy rules</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.structuralButton, sessions.length >= 4 && s.buttonDisabled]}
                  disabled={sessions.length >= 4}
                  onPress={() => setTimeEdit({ type: 'add', value: selectedSession ? Math.round((selectedSession.startMinutes + 120) / 5) * 5 % 1440 : 720 })}
                >
                  <Plus s={13} c={C.goldDark} w={2.5} /><Text style={s.structuralButtonText}>Add Session</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.structuralButton, (sessions.length <= 1 || !selectedRemoveAllowed) && s.buttonDisabled]}
                  disabled={sessions.length <= 1 || !selectedRemoveAllowed}
                  onPress={() => setConfirmRemoveSession(true)}
                >
                  <Trash2 s={13} c="#A24351" w={2.1} /><Text style={[s.structuralButtonText, { color: '#A24351' }]}>Remove</Text>
                </TouchableOpacity>
              </View>
              {structuralError && <Text style={s.structuralError}>{structuralError}</Text>}
            </View>
          </Animated.View>
        )}

        <Animated.View entering={enter(200)}>
          <View style={s.sectionTitleRow}>
            <View>
              <Text style={s.sectionLabelNoMargin}>ESSENTIALS AFTER TOLERANCE</Text>
              <Text style={s.sectionSub}>Choose the few apps that should remain reachable after protection begins.</Text>
            </View>
          </View>

          <View style={s.essentialsSurface}>
            <View style={s.essentialsAccent} />
            <View style={s.essentialsOutcomeRow}>
              <View style={s.essentialsOutcomeIcon}><Shield s={21} c="#FFFFFF" w={2.2} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.essentialsOutcomeLabel}>WHEN TOLERANCE ENDS</Text>
                <Text style={s.essentialsOutcomeTitle}>
                  {draftToleranceEnd == null
                    ? 'Set a Goal to activate Essentials-only protection.'
                    : `At ${formatMinutesShort(draftToleranceEnd)}, the rest of your day is protected.`}
                </Text>
                <Text style={s.essentialsOutcomeBody}>Non-essential apps close for the rest of the day. Essentials and iOS system access remain reachable.</Text>
              </View>
            </View>

            <TouchableOpacity style={s.essentialsPicker} onPress={() => setEssentialsOpen(true)} activeOpacity={0.76}>
              <View style={s.essentialsPickerIcon}><Lock s={17} c="#A63A4B" w={2.2} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.essentialsPickerLabel}>CHOOSE YOUR ESSENTIAL APPS</Text>
                <Text style={s.essentialsPickerTitle}>Decide what stays reachable</Text>
                <Text style={s.essentialsPickerMeta}>
                  {nativeAvailable
                    ? optionalEssentialsSummary
                      ? `${optionalEssentialsSummary.applicationCount} optional apps · Core safety access always remains`
                      : 'Loading private iPhone selection'
                    : `${state.optionalEssentialAppIds.length} optional apps · Core safety access always remains`}
                </Text>
              </View>
              <View style={s.essentialsPickerArrow}><ChevronRight s={17} c="#7A303D" w={2.2} /></View>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Animated.View entering={enter(240)} layout={LinearTransition.duration(220)}>
          <View style={s.sectionTitleRow}>
            <View>
              <Text style={s.sectionLabelNoMargin}>{kind === 'session' ? `${selectedSession?.name?.toUpperCase() ?? 'SESSION'} RULES` : 'DAILY APP RULES'}</Text>
              <Text style={s.sectionSub}>{kind === 'session' ? 'Divide this Session’s capacity. Its rules reset when the next Session begins.' : 'Divide your daily capacity across groups and individual apps.'}</Text>
            </View>
          </View>
          <View style={s.ruleList}>
            <PlanningRail values={target} plannedByGroup={plannedByGroup} embedded />
            <View style={s.railRulesDivider} />
            {groupIds.map((groupId, index) => {
              const rule = activeRules.find(entry => entry.groupId === groupId) ?? defaultRule(groupId);
              const tint = CATEGORY_TINTS[groupId] ?? { bg: C.goldLight, color: C.goldDark };
              const custom = customGroupIds.includes(groupId);
              return (
                <View key={groupId}>
                  {index > 0 && <View style={s.separator} />}
                  <TouchableOpacity style={s.ruleRow} onPress={() => setRuleGroupId(groupId)} activeOpacity={0.72}>
                    <View style={[s.ruleAvatar, { backgroundColor: tint.bg }]}><Text style={[s.ruleAvatarText, { color: tint.color }]}>{groupName(state, groupId)[0]}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.ruleName}>{groupName(state, groupId)}</Text>
                      <GroupRuleMeta
                        nativeAvailable={nativeAvailable}
                        selectionId={`plan.${draftPlanId}.group.${groupId}`}
                        previewCount={(groupCatalog[groupId] ?? []).length}
                        individualCount={(rule.appRules ?? []).length}
                      />
                    </View>
                    <View style={[s.ruleTag, rule.mode === 'blocked' && s.ruleTagBlocked]}>
                      <Text style={[s.ruleTagText, rule.mode === 'blocked' && s.ruleTagTextBlocked]}>{ruleModeLabel(rule)}</Text>
                    </View>
                    {rule.mode !== 'noLimit' && (
                      <View style={[s.strengthTag, rule.strength === 'strict' ? s.strictTag : s.looseTag]}>
                        <Text style={[s.strengthTagText, rule.strength === 'strict' ? s.strictTagText : s.looseTagText]}>{rule.strength === 'strict' ? 'STRICT' : 'LOOSE'}</Text>
                      </View>
                    )}
                    {custom && (
                      <TouchableOpacity onPress={() => removeGroup(groupId)} hitSlop={8}>
                        <Trash2 s={13} c={C.textMuted} w={2} />
                      </TouchableOpacity>
                    )}
                    <ChevronRight s={15} c={C.textMuted} w={2} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          <TouchableOpacity style={s.addGroupRow} onPress={() => setGroupSheetOpen(true)} activeOpacity={0.74}>
            <View style={s.addGroupIcon}><Plus s={13} c={C.goldDark} w={2.5} /></View>
            <Text style={s.addGroupText}>Add or reuse a group</Text>
          </TouchableOpacity>
        </Animated.View>
        </View>

        {existing && (
          <TouchableOpacity style={s.deletePlanButton} onPress={() => setConfirmDelete(true)}>
            <Trash2 s={14} c="#A24351" w={2.1} />
            <Text style={s.deletePlanText}>Delete this plan</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <View style={[s.footer, { paddingBottom: Math.max(12, insets.bottom) }]}>
        {saveError && <Text style={s.saveError}>{saveError}</Text>}
        <GoldButton
          label={checkingSelections ? 'Checking iPhone selections...' : existing ? 'Save changes' : 'Create plan'}
          disabled={!canSave || checkingSelections}
          onPress={requestSave}
        />
      </View>

      <EssentialAppsSheet visible={essentialsOpen} onClose={() => setEssentialsOpen(false)} />
      <PlanGroupSheet
        visible={groupSheetOpen}
        planId={draftPlanId}
        currentGroupIds={customGroupIds}
        onClose={() => setGroupSheetOpen(false)}
        onAdd={addGroup}
      />
      <SessionCopySheet
        visible={sessionCopyOpen}
        currentPlanId={draftPlanId}
        currentGroupIds={groupIds}
        currentCatalog={groupCatalog}
        onClose={() => setSessionCopyOpen(false)}
        onCopy={copiedRules => {
          setSessions(current => current.map(session => session.id === selectedSessionId
            ? { ...session, rules: completeRules(copiedRules, groupIds) }
            : session
          ));
        }}
      />
      <GroupLimitSheet
        rule={activeRule}
        groupLabel={ruleGroupId ? groupName(state, ruleGroupId) : ''}
        apps={ruleGroupId ? appsForGroup(groupCatalog, ruleGroupId) : []}
        planStrength={planStrength}
        nativeSelectionBaseId={`plan.${draftPlanId}`}
        sessionName={kind === 'session' ? selectedSession?.name : undefined}
        onChange={partial => { if (ruleGroupId) updateActiveRule(ruleGroupId, partial); }}
        onClose={() => setRuleGroupId(null)}
      />
      <TimeWheelSheet
        visible={timeEdit !== null}
        title={timeEdit?.type === 'add' ? 'New Session starts' : timeEdit?.type === 'start' ? 'Session starts' : 'Session ends'}
        minutes={timeEdit?.value ?? 0}
        onClose={() => setTimeEdit(null)}
        onSave={commitTimeEdit}
      />

      <ConfirmModal
        visible={pendingKind !== null}
        icon={pendingKind === 'session' ? <Clock s={21} c={C.goldDark} w={2.1} /> : <Calendar s={21} c={C.goldDark} w={2.1} />}
        iconBg={C.goldLight}
        title={`Change to ${pendingKind === 'session' ? 'Session Plan' : 'Daily Plan'}?`}
        body={pendingKind === 'session'
          ? 'This creates a connected three-Session day. Existing Daily rules do not silently become Session limits.'
          : 'Session rules are structural and will not be silently merged. The new Daily rules begin at No limit.'}
        confirmLabel="CHANGE STYLE"
        onCancel={() => setPendingKind(null)}
        onConfirm={() => pendingKind && applyKind(pendingKind)}
      />

      <ConfirmModal
        visible={pendingAddMinute !== null}
        icon={<Plus s={21} c={C.goldDark} w={2.5} />}
        iconBg={C.goldLight}
        title="Add this Session?"
        body={sourceForAdd && newSessionPreview
          ? `${sourceForAdd.name} will end at ${formatTimeOfDay(pendingAddMinute ?? 0)}. The new Session runs until ${formatTimeOfDay(newSessionPreview.endMinutes)} and begins with the same rules.`
          : 'The selected Session will be split at this point.'}
        subject={pendingAddMinute == null ? undefined : `${formatTimeOfDay(pendingAddMinute)} start`}
        confirmLabel="ADD SESSION"
        onCancel={() => setPendingAddMinute(null)}
        onConfirm={() => {
          if (pendingAddMinute != null) {
            const next = splitSessionAt(sessions, pendingAddMinute);
            if (next) {
              setSessions(next);
              const added = next.find(session => !sessions.some(old => old.id === session.id));
              if (added) setSelectedSessionId(added.id);
            }
          }
          setPendingAddMinute(null);
        }}
      />

      <ConfirmModal
        visible={confirmRemoveSession}
        icon={<Trash2 s={21} c="#A24351" w={2.1} />}
        iconBg="#F8E7EA"
        title="Remove this Session?"
        body={selectedSession && previousForRemove
          ? `${previousForRemove.name} will expand through ${selectedSession.name}'s time and keep its own rules.`
          : 'The preceding Session will expand through this time.'}
        subject={selectedSession?.name}
        confirmLabel="REMOVE SESSION"
        confirmColor="#A24351"
        onCancel={() => setConfirmRemoveSession(false)}
        onConfirm={() => {
          if (selectedSession) {
            const next = removeSessionAndExtendPrevious(sessions, selectedSession.id);
            if (next) {
              setSessions(next);
              setSelectedSessionId(previousForRemove?.id ?? next[0].id);
            }
          }
          setConfirmRemoveSession(false);
        }}
      />

      <ConfirmModal
        visible={targetConfirmation !== null}
        icon={<Lock s={21} c="#A24351" w={2.2} />}
        iconBg="#F8E7EA"
        title={targetConfirmation === 'known-loss' ? 'Today would lose its trophy' : 'Tighten today\'s target?'}
        body={targetConfirmation === 'known-loss'
          ? "The new Daily Target is already below the phone time used today. Saving is allowed, but today's target cannot become eligible again."
          : "Apple keeps exact live usage inside Screen Time. After saving, iPhone will reconcile today's activity with the tighter target. If it has already been passed, today's trophy becomes ineligible and cannot be restored by raising the target later."}
        confirmLabel={targetConfirmation === 'known-loss' ? 'SAVE ANYWAY' : 'SAVE TARGET'}
        confirmColor="#A24351"
        onCancel={() => setTargetConfirmation(null)}
        onConfirm={() => { setTargetConfirmation(null); commitSave(); }}
      />

      <ConfirmModal
        visible={confirmDelete}
        icon={<Trash2 s={21} c="#A24351" w={2.1} />}
        iconBg="#F8E7EA"
        title="Delete this plan?"
        body="Weekly days using it become unplanned. Historical day records remain unchanged."
        subject={existing?.name}
        confirmLabel="DELETE PLAN"
        confirmColor="#A24351"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (existing) {
            void clearNativeActivitySelectionsWithPrefix(`plan.${existing.id}.`);
            deleteDayPlan(existing.id);
          }
          router.back();
        }}
      />
      {permissionGate}
    </View>
  );
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 16, gap: 18 },
  sectionLabel: { marginBottom: 8, marginLeft: 4, fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.4, color: C.textMuted },
  sectionLabelNoMargin: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.4, color: C.textMuted },
  sectionSub: { marginTop: 4, maxWidth: 320, fontFamily: F.sans, fontSize: 11.5, lineHeight: 16.5, color: C.textSecondary },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 8 },
  sectionsGroup: { gap: 18 },
  dormant: { opacity: 0.38 },
  dormantNote: { marginTop: 9, textAlign: 'center', fontFamily: F.serifItalic, fontSize: 13, color: C.textMuted },
  essOnlyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 22,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#E8CDD2',
    backgroundColor: '#FFF8F8',
    padding: 14,
    boxShadow: '0 6px 18px rgba(120, 52, 63, 0.07)',
  },
  essOnlyCardOn: {
    borderColor: '#33282B',
    backgroundColor: '#202123',
    boxShadow: '0 12px 28px rgba(24, 24, 25, 0.2)',
  },
  essOnlyIcon: {
    flexShrink: 0,
    width: 42,
    height: 42,
    borderRadius: 14,
    borderCurve: 'continuous',
    backgroundColor: '#F8E3E7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  essOnlyIconOn: { backgroundColor: '#E14B5A', boxShadow: '0 5px 14px rgba(225,75,90,0.3)' },
  essOnlyLabel: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.5, color: '#A63A4B' },
  essOnlyLabelOn: { color: '#D4B7BC' },
  essOnlyTitle: { marginTop: 2, fontFamily: F.serifSemiBold, fontSize: 17, lineHeight: 21, color: '#3A252A' },
  essOnlyTitleOn: { color: '#FFFFFF' },
  essOnlyBody: { marginTop: 3, fontFamily: F.sans, fontSize: 10.5, lineHeight: 14.5, color: '#7A6468' },
  essOnlyBodyOn: { color: '#C8C9CC' },
  railRulesDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#E3DFD6', marginHorizontal: -10 },
  nameSurface: { height: 52, flexDirection: 'row', alignItems: 'center', borderRadius: 15, borderCurve: 'continuous', borderWidth: 1, borderColor: '#DFD7C8', backgroundColor: C.surface, paddingHorizontal: 14 },
  nameSurfaceEmpty: { borderColor: '#E1C5A1' },
  nameInput: { flex: 1, fontFamily: F.serifMedium, fontSize: 17.5, color: C.text },
  requiredText: { marginTop: 5, marginLeft: 4, fontFamily: F.sansMedium, fontSize: 10, color: '#A36F2B' },
  colorPickerHeader: { marginTop: 15, marginHorizontal: 4, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  colorPickerLabel: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.9, color: C.textMuted },
  colorPickerHint: { marginTop: 3, fontFamily: F.sans, fontSize: 10.5, lineHeight: 14, color: C.textSecondary },
  colorPickerValue: { paddingBottom: 1, fontFamily: F.serifSemiBold, fontSize: 14 },
  colorPickerSurface: { marginTop: 9, height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 18, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E7E0D4', backgroundColor: '#FFFDF9', paddingHorizontal: 10, boxShadow: '0 4px 12px rgba(69, 58, 39, 0.04)' },
  colorSwatchButton: { width: 43, height: 43, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  colorSwatchButtonOn: { borderWidth: 2, transform: [{ scale: 1.07 }] },
  colorSwatch: { width: 29, height: 29, borderRadius: 15, alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(47, 39, 28, 0.13)' },
  kindControl: { gap: 8 },
  kindOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#E1DDD4',
    backgroundColor: '#FFFDF9',
    paddingHorizontal: 14,
    paddingVertical: 13,
    boxShadow: '0 6px 18px rgba(45, 40, 33, 0.045)',
  },
  kindOptionOn: { borderColor: '#D9BA70', backgroundColor: '#FFF9EA', boxShadow: '0 8px 22px rgba(150, 110, 35, 0.1)' },
  kindIconSeal: {
    flexShrink: 0,
    width: 42,
    height: 42,
    borderRadius: 14,
    borderCurve: 'continuous',
    backgroundColor: '#F4F2EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kindIconSealOn: { backgroundColor: C.goldLight },
  kindTitle: { fontFamily: F.serifMedium, fontSize: 17.5, color: C.text },
  kindTitleOn: { color: C.goldDark },
  kindBody: { marginTop: 2, fontFamily: F.sans, fontSize: 11.5, lineHeight: 15.5, color: C.textSecondary },
  kindStrip: { marginTop: 8, height: 6, flexDirection: 'row', borderRadius: 3, overflow: 'hidden' },
  kindStripSegment: { height: '100%', borderRadius: 3 },
  essentialsSurface: { position: 'relative', overflow: 'hidden', borderRadius: 25, borderCurve: 'continuous', backgroundColor: '#202123', padding: 16, gap: 15, boxShadow: '0 12px 28px rgba(24, 24, 25, 0.16)' },
  essentialsAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, backgroundColor: '#E14B5A' },
  essentialsOutcomeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingLeft: 3 },
  essentialsOutcomeIcon: { flexShrink: 0, width: 42, height: 42, borderRadius: 14, borderCurve: 'continuous', backgroundColor: '#E14B5A', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 14px rgba(225,75,90,0.28)' },
  essentialsOutcomeLabel: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.55, color: '#D4B7BC' },
  essentialsOutcomeTitle: { marginTop: 4, fontFamily: F.serifSemiBold, fontSize: 20, lineHeight: 24, color: '#FFFFFF' },
  essentialsOutcomeBody: { marginTop: 6, fontFamily: F.sans, fontSize: 12, lineHeight: 17.5, color: '#C8C9CC' },
  essentialsPicker: { minHeight: 86, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 18, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E8CDD2', backgroundColor: '#FFF8F8', paddingHorizontal: 12, paddingVertical: 11 },
  essentialsPickerIcon: { flexShrink: 0, width: 38, height: 38, borderRadius: 12, borderCurve: 'continuous', backgroundColor: '#F8E3E7', alignItems: 'center', justifyContent: 'center' },
  essentialsPickerLabel: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.35, color: '#A63A4B' },
  essentialsPickerTitle: { marginTop: 2, fontFamily: F.serifSemiBold, fontSize: 17, lineHeight: 20, color: '#3A252A' },
  essentialsPickerMeta: { marginTop: 3, fontFamily: F.sans, fontSize: 9.5, lineHeight: 13.5, color: '#7A6468' },
  essentialsPickerArrow: { flexShrink: 0, width: 30, height: 30, borderRadius: 15, backgroundColor: '#F4D9DE', alignItems: 'center', justifyContent: 'center' },
  sessionCount: { borderRadius: 999, backgroundColor: C.goldLight, paddingHorizontal: 10, paddingVertical: 6 },
  sessionCountText: { fontFamily: F.sansBold, fontSize: 9.5, color: C.goldDark },
  clockSurface: { borderRadius: 22, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E5DDCF', backgroundColor: '#FFFDF8', padding: 14 },
  selectedSessionPanel: { marginTop: 13, borderTopWidth: 1, borderTopColor: '#EDE7DC', paddingTop: 12 },
  sessionNameInput: { alignSelf: 'center', minWidth: 150, textAlign: 'center', fontFamily: F.serifMedium, fontSize: 20, color: C.text, borderBottomWidth: 1, borderBottomColor: '#D9C99F', paddingVertical: 3 },
  timeButtons: { marginTop: 10, flexDirection: 'row', gap: 8 },
  timeButton: { flex: 1, height: 52, borderRadius: 14, borderCurve: 'continuous', borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  timeButtonLabel: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.4, color: C.textMuted },
  timeButtonValue: { marginTop: 2, fontFamily: F.serifMedium, fontSize: 16.5, color: C.text, fontVariant: ['tabular-nums'] },
  structuralActions: { marginTop: 10, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  structuralButton: { height: 39, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 13, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E6D8B9', backgroundColor: '#FFF8E8', paddingHorizontal: 12 },
  structuralButtonText: { fontFamily: F.sansSemiBold, fontSize: 10.5, color: C.goldDark },
  buttonDisabled: { opacity: 0.35 },
  structuralError: { marginTop: 8, textAlign: 'center', fontFamily: F.sansMedium, fontSize: 10, color: '#A24351' },
  ruleList: { overflow: 'hidden', borderRadius: 22, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E1DDD4', backgroundColor: '#FFFDF9', paddingHorizontal: 10, boxShadow: '0 8px 24px rgba(45, 40, 33, 0.05)' },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#E9E5DE', marginLeft: 50 },
  ruleRow: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 3, paddingVertical: 8 },
  ruleAvatar: { width: 40, height: 40, borderRadius: 14, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  ruleAvatarText: { fontFamily: F.serifSemiBold, fontSize: 17 },
  ruleName: { fontFamily: F.serifMedium, fontSize: 17, color: C.text },
  ruleMeta: { marginTop: 3, fontFamily: F.sans, fontSize: 10, lineHeight: 13.5, color: C.textMuted },
  ruleTag: { borderRadius: 999, backgroundColor: '#F0EFEB', paddingHorizontal: 9, paddingVertical: 6 },
  ruleTagBlocked: { backgroundColor: '#F8E7EA' },
  ruleTagText: { fontFamily: F.sansSemiBold, fontSize: 9.5, color: C.textSecondary, fontVariant: ['tabular-nums'] },
  ruleTagTextBlocked: { color: '#A24351' },
  strengthTag: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 6 },
  looseTag: { backgroundColor: '#FFF0C5' },
  strictTag: { backgroundColor: '#F8E7EA' },
  strengthTagText: { fontFamily: F.sansBold, fontSize: 7.5, letterSpacing: 0.8 },
  looseTagText: { color: '#95681F' },
  strictTagText: { color: '#A24351' },
  addGroupRow: { marginTop: 10, minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 18, borderCurve: 'continuous', borderWidth: 1, borderStyle: 'dashed', borderColor: '#D7C398', backgroundColor: '#FFF9EC' },
  addGroupIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: C.goldLight, alignItems: 'center', justifyContent: 'center' },
  addGroupText: { fontFamily: F.serifSemiBold, fontSize: 16, color: C.goldDark },
  deletePlanButton: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 9 },
  deletePlanText: { fontFamily: F.sansSemiBold, fontSize: 11, color: '#A24351' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border, backgroundColor: 'rgba(252,252,252,0.96)', paddingHorizontal: 16, paddingTop: 11 },
  saveError: { marginBottom: 8, paddingHorizontal: 6, textAlign: 'center', fontFamily: F.sansMedium, fontSize: 10.5, lineHeight: 14.5, color: '#A24351' },
});
