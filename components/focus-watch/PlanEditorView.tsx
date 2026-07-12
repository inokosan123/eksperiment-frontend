import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { Calendar, CheckSmall, ChevronRight, Clock, Lock, Plus, Trash2 } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import DailyTargetEditor, { type TargetValues } from './DailyTargetEditor';
import EssentialAppsSheet from './EssentialAppsSheet';
import GoldButton from './GoldButton';
import GroupLimitSheet from './GroupLimitSheet';
import PlanGroupSheet from './PlanGroupSheet';
import SessionClockEditor from './SessionClockEditor';
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
import {
  APP_CATEGORIES,
  DEFAULT_GROUP_APP_IDS,
  connectedSessionsAreValid,
  dateKey,
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
  const [kind, setKind] = useState<PlanKind>(existing?.kind ?? 'daily');
  const [target, setTarget] = useState<TargetValues>({
    target: existing ? existing.budgetMinutes : null,
    tolerable: existing ? existing.tolerableMinutes : null,
    essentialOnly: existing ? existing.essentialOnlyMinutes : null,
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
    const saved = saveDayPlan({
      id: draftPlanId,
      name: name.trim(),
      kind,
      budgetMinutes: target.target,
      tolerableMinutes: target.tolerable,
      essentialOnlyMinutes: target.essentialOnly,
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
        <ScreenTitleBar title={existing ? 'EDIT PLAN' : 'NEW PLAN'} showBack />

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
        </Animated.View>

        <Animated.View entering={enter(50)}>
          <Text style={s.sectionLabel}>PLANNING STYLE</Text>
          <View style={s.kindControl}>
            <TouchableOpacity style={[s.kindOption, kind === 'daily' && s.kindOptionOn]} onPress={() => kind !== 'daily' && setPendingKind('daily')} haptic="selection">
              <Calendar s={16} c={kind === 'daily' ? C.goldDark : C.textMuted} w={2} />
              <View style={{ flex: 1 }}><Text style={[s.kindTitle, kind === 'daily' && s.kindTitleOn]}>Daily Plan</Text><Text style={s.kindBody}>One set of rules for all 24 hours.</Text></View>
            </TouchableOpacity>
            <TouchableOpacity style={[s.kindOption, kind === 'session' && s.kindOptionOn]} onPress={() => kind !== 'session' && setPendingKind('session')} haptic="selection">
              <Clock s={16} c={kind === 'session' ? C.goldDark : C.textMuted} w={2} />
              <View style={{ flex: 1 }}><Text style={[s.kindTitle, kind === 'session' && s.kindTitleOn]}>Session Plan</Text><Text style={s.kindBody}>A connected day with changing rules.</Text></View>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Animated.View entering={enter(100)}>
          <DailyTargetEditor values={target} plannedByGroup={plannedByGroup} onChange={setTarget} />
        </Animated.View>

        <Animated.View entering={enter(140)}>
          <Text style={s.sectionLabel}>SAFETY ALLOWLIST</Text>
          <TouchableOpacity style={s.essentialsRow} onPress={() => setEssentialsOpen(true)} activeOpacity={0.76}>
            <View style={s.essentialsIcon}><Lock s={16} c={C.goldDark} w={2.2} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.essentialsTitle}>Essential Apps</Text>
              <Text style={s.essentialsBody}>
                {nativeAvailable
                  ? optionalEssentialsSummary
                    ? `${optionalEssentialsSummary.applicationCount} optional apps / Core safety access`
                    : 'Loading private iPhone selection'
                  : `${state.optionalEssentialAppIds.length} optional apps / Core safety apps always available`}
              </Text>
            </View>
            <ChevronRight s={17} c={C.textMuted} w={2} />
          </TouchableOpacity>
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

        <Animated.View entering={enter(210)} layout={LinearTransition.duration(220)}>
          <View style={s.sectionTitleRow}>
            <View>
              <Text style={s.sectionLabelNoMargin}>{kind === 'session' ? `${selectedSession?.name?.toUpperCase() ?? 'SESSION'} RULES` : 'DAILY APP RULES'}</Text>
              <Text style={s.sectionSub}>{kind === 'session' ? 'These rules reset when the next Session begins.' : 'Group and app limits apply across the whole day.'}</Text>
            </View>
          </View>
          <View style={s.ruleList}>
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
  sectionLabel: { marginBottom: 8, marginLeft: 4, fontFamily: F.sansBold, fontSize: 9.5, letterSpacing: 2.2, color: C.textMuted },
  sectionLabelNoMargin: { fontFamily: F.sansBold, fontSize: 9.5, letterSpacing: 2.2, color: C.textMuted },
  sectionSub: { marginTop: 3, maxWidth: 275, fontFamily: F.sans, fontSize: 9.5, lineHeight: 14, color: C.textMuted },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 8 },
  nameSurface: { height: 51, flexDirection: 'row', alignItems: 'center', borderRadius: 15, borderCurve: 'continuous', borderWidth: 1, borderColor: '#DFD7C8', backgroundColor: C.surface, paddingHorizontal: 14 },
  nameSurfaceEmpty: { borderColor: '#E1C5A1' },
  nameInput: { flex: 1, fontFamily: F.serifMedium, fontSize: 17, color: C.text },
  requiredText: { marginTop: 5, marginLeft: 4, fontFamily: F.sansMedium, fontSize: 9, color: '#A36F2B' },
  kindControl: { flexDirection: 'row', gap: 8 },
  kindOption: { flex: 1, minHeight: 83, flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 16, borderCurve: 'continuous', borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, padding: 11 },
  kindOptionOn: { borderColor: '#D9BA70', backgroundColor: '#FFF9EA' },
  kindTitle: { fontFamily: F.sansSemiBold, fontSize: 11.5, color: C.textSecondary },
  kindTitleOn: { color: C.goldDark },
  kindBody: { marginTop: 3, fontFamily: F.sans, fontSize: 8.7, lineHeight: 12.5, color: C.textMuted },
  essentialsRow: { minHeight: 65, flexDirection: 'row', alignItems: 'center', gap: 11, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border, paddingHorizontal: 4 },
  essentialsIcon: { width: 36, height: 36, borderRadius: 12, borderCurve: 'continuous', backgroundColor: C.goldLight, alignItems: 'center', justifyContent: 'center' },
  essentialsTitle: { fontFamily: F.serifMedium, fontSize: 17, color: C.text },
  essentialsBody: { marginTop: 2, fontFamily: F.sans, fontSize: 9, color: C.textSecondary },
  sessionCount: { borderRadius: 999, backgroundColor: C.goldLight, paddingHorizontal: 9, paddingVertical: 6 },
  sessionCountText: { fontFamily: F.sansBold, fontSize: 9, color: C.goldDark },
  clockSurface: { borderRadius: 20, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E5DDCF', backgroundColor: '#FFFDF8', padding: 14 },
  selectedSessionPanel: { marginTop: 13, borderTopWidth: 1, borderTopColor: '#EDE7DC', paddingTop: 12 },
  sessionNameInput: { alignSelf: 'center', minWidth: 150, textAlign: 'center', fontFamily: F.serifMedium, fontSize: 19, color: C.text, borderBottomWidth: 1, borderBottomColor: '#D9C99F', paddingVertical: 3 },
  timeButtons: { marginTop: 10, flexDirection: 'row', gap: 8 },
  timeButton: { flex: 1, height: 48, borderRadius: 13, borderCurve: 'continuous', borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  timeButtonLabel: { fontFamily: F.sansBold, fontSize: 7.5, letterSpacing: 1.3, color: C.textMuted },
  timeButtonValue: { marginTop: 2, fontFamily: F.sansSemiBold, fontSize: 13, color: C.text, fontVariant: ['tabular-nums'] },
  structuralActions: { marginTop: 10, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  structuralButton: { height: 37, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, borderWidth: 1, borderColor: '#E6D8B9', backgroundColor: '#FFF8E8', paddingHorizontal: 12 },
  structuralButtonText: { fontFamily: F.sansSemiBold, fontSize: 9.5, color: C.goldDark },
  buttonDisabled: { opacity: 0.35 },
  structuralError: { marginTop: 8, textAlign: 'center', fontFamily: F.sansMedium, fontSize: 9, color: '#A24351' },
  ruleList: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginLeft: 44 },
  ruleRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 3 },
  ruleAvatar: { width: 33, height: 33, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  ruleAvatarText: { fontFamily: F.sansBold, fontSize: 13 },
  ruleName: { fontFamily: F.sansSemiBold, fontSize: 12, color: C.text },
  ruleMeta: { marginTop: 2, fontFamily: F.sans, fontSize: 8.5, color: C.textMuted },
  ruleTag: { borderRadius: 999, backgroundColor: '#F0EFEB', paddingHorizontal: 7, paddingVertical: 5 },
  ruleTagBlocked: { backgroundColor: '#F8E7EA' },
  ruleTagText: { fontFamily: F.sansSemiBold, fontSize: 8, color: C.textSecondary },
  ruleTagTextBlocked: { color: '#A24351' },
  strengthTag: { borderRadius: 999, paddingHorizontal: 6, paddingVertical: 5 },
  looseTag: { backgroundColor: '#FFF0C5' },
  strictTag: { backgroundColor: '#F8E7EA' },
  strengthTagText: { fontFamily: F.sansBold, fontSize: 7, letterSpacing: 0.7 },
  looseTagText: { color: '#95681F' },
  strictTagText: { color: '#A24351' },
  addGroupRow: { marginTop: 8, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: '#DDCEAD', backgroundColor: '#FFFDF7' },
  addGroupIcon: { width: 25, height: 25, borderRadius: 9, backgroundColor: C.goldLight, alignItems: 'center', justifyContent: 'center' },
  addGroupText: { fontFamily: F.sansSemiBold, fontSize: 10.5, color: C.goldDark },
  deletePlanButton: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 9 },
  deletePlanText: { fontFamily: F.sansSemiBold, fontSize: 10, color: '#A24351' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border, backgroundColor: 'rgba(252,252,252,0.96)', paddingHorizontal: 16, paddingTop: 11 },
  saveError: { marginBottom: 8, paddingHorizontal: 6, textAlign: 'center', fontFamily: F.sansMedium, fontSize: 9, lineHeight: 13, color: '#A24351' },
});
