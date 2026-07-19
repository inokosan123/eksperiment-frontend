import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, LinearTransition, interpolateColor, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { NotoEmoji } from '@/components/shared/NotoEmoji';
import { CheckSmall, ChevronRight, Lock, Trash2 } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import DailyTargetEditor, { type TargetValues } from './DailyTargetEditor';
import AppRulesBoard from './AppRulesBoard';
import EssentialAppsSheet from './EssentialAppsSheet';
import FocusCheck from './FocusCheck';
import FocusSwitch from './FocusSwitch';
import GoldButton from './GoldButton';
import GroupLimitSheet from './GroupLimitSheet';
import PlanGroupSheet from './PlanGroupSheet';
import {
  clearNativeActivitySelectionsWithPrefix,
  getNativeActivitySelectionSummary,
  isNativeFocusAvailable,
} from './focusNativeBridge';
import { useNativeActivitySelectionSummary } from './nativeSelectionSummaryStore';
import { PREVIEW_APPS, type PreviewApp } from './focusContent';
import { usePermissionGate } from './usePermissionGate';
import { PLAN_VISUALS, planVisualForTheme } from './planVisuals';
import {
  APP_CATEGORIES,
  DEFAULT_GROUP_APP_IDS,
  dateKey,
  defaultPlanThemeId,
  deleteDayPlan,
  formatMinutesShort,
  getEffectivePlan,
  groupName,
  recordLimitExceeded,
  saveDayPlan,
  useDayPlan,
  type GroupRule,
  type PlanThemeId,
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

function clonePlanCatalog(source?: Record<string, string[]>) {
  const catalog = source ?? DEFAULT_GROUP_APP_IDS;
  return Object.fromEntries(Object.entries(catalog).map(([id, appIds]) => [id, [...appIds]]));
}

function appsForGroup(catalog: Record<string, string[]>, groupId: string): PreviewApp[] {
  return (catalog[groupId] ?? [])
    .map(appId => PREVIEW_APPS.find(app => app.id === appId))
    .filter(Boolean) as PreviewApp[];
}

// A plan color: springs up when chosen, settles back when another takes over.
function ColorSwatch({
  visual,
  selected,
  onPress,
}: {
  visual: (typeof PLAN_VISUALS)[number];
  selected: boolean;
  onPress: () => void;
}) {
  const progress = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(selected ? 1 : 0, { damping: 15, stiffness: 235, mass: 0.72 });
  }, [progress, selected]);

  const ringStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(progress.value, [0, 1], [visual.border, visual.accent]),
    borderWidth: 1 + progress.value,
    transform: [{ scale: 1 + progress.value * 0.09 }],
  }));

  return (
    <TouchableOpacity
      onPress={onPress}
      haptic="selection"
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${visual.label} plan color`}
    >
      <Animated.View style={[s.colorSwatchButton, { backgroundColor: visual.gradient[1] }, ringStyle]}>
        <View style={[s.colorSwatch, { backgroundColor: visual.accent }]}>
          <FocusCheck checked={selected} size={22} accent={visual.accent} />
        </View>
      </Animated.View>
    </TouchableOpacity>
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
  const planEssentialsSummary = useNativeActivitySelectionSummary(`plan.${draftPlanId}.essentials`);
  const retainNativeSelections = useRef(!!existing);
  const initialGroupIds = useMemo(
    () => [...APP_CATEGORIES.map(group => group.id), ...(existing?.customGroupIds ?? [])],
    [existing]
  );

  const [name, setName] = useState(existing?.name ?? '');
  const [themeId, setThemeId] = useState<PlanThemeId>(existing?.themeId ?? defaultPlanThemeId(draftPlanId));
  const existingToleranceEnd = existing?.essentialOnlyMinutes ?? existing?.tolerableMinutes ?? null;
  const [target, setTarget] = useState<TargetValues>({
    target: existing ? existing.budgetMinutes : null,
    tolerable: existing ? existingToleranceEnd : null,
    essentialOnly: existing ? existingToleranceEnd : null,
  });
  const [essentialsOnlyDay, setEssentialsOnlyDay] = useState(() => !!existing?.essentialsOnly);
  const [planEssentialAppIds, setPlanEssentialAppIds] = useState(existing?.essentialAppIds ?? []);
  const [planStrength] = useState<Strength>(existing?.strength ?? 'loose');
  const [customGroupIds, setCustomGroupIds] = useState(existing?.customGroupIds ?? []);
  const [groupCatalog, setGroupCatalog] = useState(() => clonePlanCatalog(existing?.groupCatalog));
  const [rules, setRules] = useState(() => completeRules(existing?.rules ?? [], initialGroupIds));
  const [ruleGroupId, setRuleGroupId] = useState<string | null>(null);
  const [essentialsOpen, setEssentialsOpen] = useState(false);
  const [groupSheetOpen, setGroupSheetOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [targetConfirmation, setTargetConfirmation] = useState<'known-loss' | 'native-reconcile' | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [checkingSelections, setCheckingSelections] = useState(false);

  const groupIds = useMemo(
    () => [...APP_CATEGORIES.map(group => group.id), ...customGroupIds],
    [customGroupIds]
  );
  // Session Planning is intentionally dormant in Focus v1. The editor owns a
  // single Daily rule set; any legacy zones are preserved only when saving.
  const activeRules = rules;
  const activeRule = activeRules.find(rule => rule.groupId === ruleGroupId) ?? null;
  const groupAppCounts = useMemo(
    () => Object.fromEntries(groupIds.map(groupId => [groupId, (groupCatalog[groupId] ?? []).length])),
    [groupCatalog, groupIds]
  );
  const draftToleranceEnd = target.essentialOnly ?? target.tolerable;
  const draftRequiresNative = useMemo(() => {
    const ruleSets = rules;
    const hasBoundary = ruleSets.some(rule => {
      const mode = rule.mode ?? (rule.dailyMinutes == null ? 'noLimit' : 'limit');
      if (mode === 'blocked' || (mode === 'limit' && rule.dailyMinutes != null)) return true;
      return (rule.appRules ?? []).some(appRule => {
        const appMode = appRule.mode ?? (appRule.minutes == null ? 'noLimit' : 'limit');
        return appMode === 'blocked' || (appMode === 'limit' && appRule.minutes != null);
      });
    });
    return target.target != null || target.essentialOnly != null || hasBoundary;
  }, [rules, target.essentialOnly, target.target]);
  const currentPlan = getEffectivePlan(state, new Date());
  const isActivePlan = !!existing && currentPlan?.id === existing.id;
  const essentialsTargetReady = !essentialsOnlyDay
    || (target.target != null && target.target > 0 && draftToleranceEnd != null);
  const canSave = name.trim().length > 0
    && essentialsTargetReady;

  // Essentials-only is an access mode, not a zero-minute target. Goal and
  // Tolerance keep measuring the day while the allowlist starts immediately.
  const toggleEssentialsOnlyDay = () => {
    if (essentialsOnlyDay) {
      setEssentialsOnlyDay(false);
      return;
    }
    setEssentialsOnlyDay(true);
    if (target.target == null || target.target <= 0) {
      setTarget({ target: 60, tolerable: 180, essentialOnly: 180 });
    }
  };

  useEffect(() => () => {
    if (!retainNativeSelections.current) {
      void clearNativeActivitySelectionsWithPrefix(`plan.${draftPlanId}.`);
    }
  }, [draftPlanId]);

  const updateActiveRule = (groupId: string, partial: Partial<GroupRule>) => {
    setRules(current => current.map(rule => rule.groupId === groupId ? { ...rule, ...partial } : rule));
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
    if (ruleGroupId === groupId) setRuleGroupId(null);
  };

  const doSave = () => {
    retainNativeSelections.current = true;
    const toleranceEnd = target.target == null
      ? null
      : Math.max(target.target, target.essentialOnly ?? target.tolerable ?? target.target);
    const saved = saveDayPlan({
      id: draftPlanId,
      name: name.trim(),
      kind: 'daily',
      themeId,
      essentialsOnly: essentialsOnlyDay,
      essentialAppIds: planEssentialAppIds,
      budgetMinutes: target.target,
      // v4 has one post-Goal Tolerance period. Its endpoint is also the
      // existing native Essentials-only threshold; these must never diverge.
      tolerableMinutes: toleranceEnd,
      essentialOnlyMinutes: toleranceEnd,
      strength: planStrength,
      customGroupIds,
      groupCatalog,
      // Keep an old Session draft intact without allowing it to participate in
      // v1 runtime. A later release can explicitly offer to restore it.
      zones: existing?.zones ?? [],
      rules: completeRules(rules, groupIds),
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
    if (essentialsOnlyDay) return [];
    const required = new Map<string, string>();
    const ruleSets = [{ rules }];
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
              placeholder="Name this plan..."
              placeholderTextColor={C.textMuted}
              maxLength={28}
              style={s.nameInput}
            />
            {name.trim().length > 0 && (
              <Animated.View entering={FadeInDown.duration(220)}>
                <CheckSmall s={16} c="#4E8C69" w={2.6} />
              </Animated.View>
            )}
          </View>
          {name.length === 0 && <Text style={s.requiredText}>Give it a name to save it.</Text>}

          <View style={s.colorPickerHeader}>
            <Text style={s.colorPickerLabel}>PLAN COLOR</Text>
            <Text style={[s.colorPickerValue, { color: planVisualForTheme(themeId).accent }]}>
              {planVisualForTheme(themeId).label}
            </Text>
          </View>
          <View style={s.colorPickerSurface}>
            {PLAN_VISUALS.map(visual => (
              <ColorSwatch
                key={visual.id}
                visual={visual}
                selected={visual.id === themeId}
                onPress={() => setThemeId(visual.id)}
              />
            ))}
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
              <NotoEmoji name="lock" size={24} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.essOnlyLabel, essentialsOnlyDay && s.essOnlyLabelOn]}>ESSENTIALS-ONLY DAY</Text>
              <Text style={[s.essOnlyTitle, essentialsOnlyDay && s.essOnlyTitleOn]}>Lock the whole day</Text>
              <Text style={[s.essOnlyBody, essentialsOnlyDay && s.essOnlyBodyOn]}>
                ON: only your Essential apps open, all day. Everything else stays locked from minute one.
              </Text>
            </View>
            <FocusSwitch value={essentialsOnlyDay} onToggle={toggleEssentialsOnlyDay} />
          </TouchableOpacity>
        </Animated.View>

        {essentialsOnlyDay && (
          <View style={s.sectionsGroup}>
            <Animated.View entering={enter(50)} layout={LinearTransition.duration(220)}>
              <DailyTargetEditor values={target} onChange={setTarget} essentialsOnly />
            </Animated.View>

            <Animated.View entering={enter(100)} layout={LinearTransition.duration(220)}>
              <View style={s.sectionTitleRow}>
                <View>
                  <Text style={s.sectionLabelNoMargin}>APPS THAT STAY OPEN</Text>
                  <Text style={s.sectionSub}>Your Essentials are already in. Add only what this day truly needs.</Text>
                </View>
              </View>
              <View style={[s.essentialsSurface, s.planAccessSurface]}>
                <View style={s.essentialsAccent} />
                <View style={s.essentialsOutcomeRow}>
                  <View style={s.essentialsOutcomeIcon}><NotoEmoji name="lock" size={24} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.essentialsOutcomeLabel}>LOCKED FROM MINUTE ONE</Text>
                    <Text style={s.essentialsOutcomeTitle}>Everything else stays closed all day.</Text>
                    <Text style={s.essentialsOutcomeBody}>Goal and Tolerance still keep the score of the day.</Text>
                  </View>
                </View>

                <TouchableOpacity style={s.essentialsPicker} onPress={() => setEssentialsOpen(true)} activeOpacity={0.76}>
                  <View style={s.essentialsPickerIcon}><Lock s={17} c="#A63A4B" w={2.2} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.essentialsPickerTitle}>Choose this plan&apos;s apps</Text>
                    <Text style={s.essentialsPickerMeta}>
                      {nativeAvailable
                        ? planEssentialsSummary
                          ? `${planEssentialsSummary.applicationCount} plan-only apps · Essentials included`
                          : 'Loading private iPhone selection'
                        : `${planEssentialAppIds.length} plan-only apps · Essentials included`}
                    </Text>
                  </View>
                  <View style={s.essentialsPickerArrow}><ChevronRight s={17} c="#7A303D" w={2.2} /></View>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        )}

        {!essentialsOnlyDay && (
        <View style={s.sectionsGroup}>
        <Animated.View entering={enter(50)}>
          <DailyTargetEditor values={target} onChange={setTarget} />
        </Animated.View>

        <Animated.View entering={enter(200)}>
          <View style={s.sectionTitleRow}>
            <View>
              <Text style={s.sectionLabelNoMargin}>ESSENTIALS</Text>
              <Text style={s.sectionSub}>The few apps that stay open after the phone locks.</Text>
            </View>
          </View>

          <View style={s.essentialsSurface}>
            <View style={s.essentialsAccent} />
            <View style={s.essentialsOutcomeRow}>
              <View style={s.essentialsOutcomeIcon}><NotoEmoji name="lock" size={24} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.essentialsOutcomeLabel}>WHEN TOLERANCE ENDS</Text>
                <Text style={s.essentialsOutcomeTitle}>
                  {draftToleranceEnd == null
                    ? 'Set a Goal first.'
                    : `At ${formatMinutesShort(draftToleranceEnd)}, the phone locks.`}
                </Text>
                <Text style={s.essentialsOutcomeBody}>Everything closes for the rest of the day — except your Essentials.</Text>
              </View>
            </View>

            <TouchableOpacity style={s.essentialsPicker} onPress={() => setEssentialsOpen(true)} activeOpacity={0.76}>
              <View style={s.essentialsPickerIcon}><Lock s={17} c="#A63A4B" w={2.2} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.essentialsPickerTitle}>Choose your Essentials</Text>
                <Text style={s.essentialsPickerMeta}>
                  {nativeAvailable
                    ? optionalEssentialsSummary
                      ? `${optionalEssentialsSummary.applicationCount} apps chosen · safety access always stays`
                      : 'Loading private iPhone selection'
                    : `${state.optionalEssentialAppIds.length} apps chosen · safety access always stays`}
                </Text>
              </View>
              <View style={s.essentialsPickerArrow}><ChevronRight s={17} c="#7A303D" w={2.2} /></View>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Animated.View entering={enter(240)} layout={LinearTransition.duration(220)}>
          <AppRulesBoard
            goalMinutes={target.target}
            lockAtMinutes={draftToleranceEnd}
            rules={completeRules(activeRules, groupIds)}
            groupIds={groupIds}
            customGroupIds={customGroupIds}
            groupAppCounts={groupAppCounts}
            resolveGroupName={groupId => groupName(state, groupId)}
            nativeAvailable={nativeAvailable}
            selectionIdForGroup={groupId => `plan.${draftPlanId}.group.${groupId}`}
            onOpenRule={setRuleGroupId}
            onRemoveGroup={removeGroup}
            onAddGroup={() => setGroupSheetOpen(true)}
          />
        </Animated.View>
        </View>
        )}

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

      <EssentialAppsSheet
        visible={essentialsOpen}
        onClose={() => setEssentialsOpen(false)}
        planId={essentialsOnlyDay ? draftPlanId : undefined}
        planAppIds={planEssentialAppIds}
        onChangePlanApps={setPlanEssentialAppIds}
      />
      <PlanGroupSheet
        visible={groupSheetOpen}
        planId={draftPlanId}
        currentGroupIds={customGroupIds}
        onClose={() => setGroupSheetOpen(false)}
        onAdd={addGroup}
      />
      <GroupLimitSheet
        rule={activeRule}
        groupLabel={ruleGroupId ? groupName(state, ruleGroupId) : ''}
        apps={ruleGroupId ? appsForGroup(groupCatalog, ruleGroupId) : []}
        planStrength={planStrength}
        nativeSelectionBaseId={`plan.${draftPlanId}`}
        onChange={partial => { if (ruleGroupId) updateActiveRule(ruleGroupId, partial); }}
        onClose={() => setRuleGroupId(null)}
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
  sectionSub: { marginTop: 4, maxWidth: 320, fontFamily: F.sans, fontSize: 12.5, lineHeight: 17.5, color: C.textSecondary },
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
  essOnlyTitle: { marginTop: 2, fontFamily: F.serifSemiBold, fontSize: 19, lineHeight: 23, color: '#3A252A' },
  essOnlyTitleOn: { color: '#FFFFFF' },
  essOnlyBody: { marginTop: 3, fontFamily: F.sans, fontSize: 11.5, lineHeight: 15.5, color: '#7A6468' },
  essOnlyBodyOn: { color: '#C8C9CC' },
  nameSurface: { height: 58, flexDirection: 'row', alignItems: 'center', borderRadius: 18, borderCurve: 'continuous', borderWidth: 1, borderColor: '#DFD7C8', backgroundColor: C.surface, paddingHorizontal: 16, boxShadow: '0 6px 18px rgba(45, 40, 33, 0.04)' },
  nameSurfaceEmpty: { borderColor: '#E1C5A1' },
  nameInput: { flex: 1, fontFamily: F.serifMedium, fontSize: 21, color: C.text },
  requiredText: { marginTop: 5, marginLeft: 4, fontFamily: F.sansMedium, fontSize: 10, color: '#A36F2B' },
  colorPickerHeader: { marginTop: 16, marginHorizontal: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  colorPickerLabel: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.4, color: C.textMuted },
  colorPickerValue: { fontFamily: F.serifSemiBold, fontSize: 15 },
  colorPickerSurface: { marginTop: 9, height: 66, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 20, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E7E0D4', backgroundColor: '#FFFDF9', paddingHorizontal: 11, boxShadow: '0 4px 12px rgba(69, 58, 39, 0.04)' },
  colorSwatchButton: { width: 43, height: 43, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  colorSwatch: { width: 29, height: 29, borderRadius: 15, alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(47, 39, 28, 0.13)' },
  essentialsSurface: { position: 'relative', overflow: 'hidden', borderRadius: 25, borderCurve: 'continuous', backgroundColor: '#202123', padding: 16, gap: 15, boxShadow: '0 12px 28px rgba(24, 24, 25, 0.16)' },
  planAccessSurface: { borderWidth: 1, borderColor: '#35363A', backgroundColor: '#1D1E20', boxShadow: '0 14px 32px rgba(24, 24, 25, 0.2)' },
  essentialsAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, backgroundColor: '#E14B5A' },
  essentialsOutcomeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingLeft: 3 },
  essentialsOutcomeIcon: { flexShrink: 0, width: 42, height: 42, borderRadius: 14, borderCurve: 'continuous', backgroundColor: '#E14B5A', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 14px rgba(225,75,90,0.28)' },
  essentialsOutcomeLabel: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.55, color: '#D4B7BC' },
  essentialsOutcomeTitle: { marginTop: 4, fontFamily: F.serifSemiBold, fontSize: 21, lineHeight: 25, letterSpacing: -0.25, color: '#FFFFFF' },
  essentialsOutcomeBody: { marginTop: 6, fontFamily: F.sans, fontSize: 12.5, lineHeight: 18, color: '#C8C9CC' },
  essentialsPicker: { minHeight: 86, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 18, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E8CDD2', backgroundColor: '#FFF8F8', paddingHorizontal: 12, paddingVertical: 11 },
  essentialsPickerIcon: { flexShrink: 0, width: 38, height: 38, borderRadius: 12, borderCurve: 'continuous', backgroundColor: '#F8E3E7', alignItems: 'center', justifyContent: 'center' },
  essentialsPickerTitle: { fontFamily: F.serifSemiBold, fontSize: 18.5, lineHeight: 22, color: '#3A252A' },
  essentialsPickerMeta: { marginTop: 3, fontFamily: F.sans, fontSize: 11, lineHeight: 15, color: '#7A6468' },
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
  deletePlanButton: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 9 },
  deletePlanText: { fontFamily: F.sansSemiBold, fontSize: 11, color: '#A24351' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border, backgroundColor: 'rgba(252,252,252,0.96)', paddingHorizontal: 16, paddingTop: 11 },
  saveError: { marginBottom: 8, paddingHorizontal: 6, textAlign: 'center', fontFamily: F.sansMedium, fontSize: 10.5, lineHeight: 14.5, color: '#A24351' },
});
