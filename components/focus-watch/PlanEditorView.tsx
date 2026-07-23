import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, FadeInDown, LinearTransition, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { CheckSmall, ChevronRight, Lock, Trash2 } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import { useGuidedSetup, useGuideTarget } from '@/components/onboarding/guided/GuidedSetupContext';
import { LinearGradient } from 'expo-linear-gradient';
import DailyTargetEditor, { type TargetValues } from './DailyTargetEditor';
import Bloom from './Bloom';
import { LockGhost, LockSeal } from './EssentialsEmblem';
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
import { ESSENTIAL_APP_OPTIONS, PREVIEW_APPS, type PreviewApp } from './focusContent';
import { usePermissionGate } from './usePermissionGate';
import { PLAN_VISUALS, planVisualForTheme } from './planVisuals';
import {
  APP_CATEGORIES,
  DEFAULT_GROUP_APP_IDS,
  assignPlanToWeekdayAndToday,
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
  weekdayMondayFirst,
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

// The selected color rises just enough to read, without a spring or bounce.
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
    progress.value = withTiming(selected ? 1 : 0, {
      duration: 170,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, selected]);

  const ringStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(progress.value, [0, 1], [visual.border, visual.accent]),
    borderWidth: 1 + progress.value,
    transform: [{ scale: 1 + progress.value * 0.055 }],
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


// Both Essentials surfaces are lit the same way: a warm rose-black ground, the
// lock ghosted at the right edge, a rose bloom in the corner, and a tapered
// rose bar down the left — the register that says "this is what stays open".
function EssentialsSurfaceChrome() {
  return (
    <>
      <LinearGradient
        colors={['#241E20', '#2B2325', '#181415']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={s.essentialsBloom}>
        <Bloom color="#E14B5A" opacity={0.32} />
      </View>
      <View pointerEvents="none" style={s.essentialsWatermark}>
        <LockGhost size={132} />
      </View>
      <LinearGradient
        colors={['rgba(225,75,90,0.25)', '#E14B5A', 'rgba(225,75,90,0.3)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={s.essentialsAccent}
      />
    </>
  );
}

export default function PlanEditorView({
  guided = false,
  guidedRecommendedMinutes = 240,
  onGuidedComplete,
}: {
  guided?: boolean;
  guidedRecommendedMinutes?: number;
  onGuidedComplete?: (planId: string) => void;
} = {}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: guideScreenHeight } = useWindowDimensions();
  const { planId } = useLocalSearchParams<{ planId?: string }>();
  const state = useDayPlan();
  const { request: requestProtection, gate: permissionGate } = usePermissionGate();
  const { session, patchSession, setPresentation } = useGuidedSetup();
  const isGuided = guided && session?.active === true && session.activeStep === 'focusScreenTime';
  const guidePhase = isGuided ? session.phase : '';
  const guideScrollRef = useRef<React.ElementRef<typeof ScrollView>>(null);
  const nameTarget = useGuideTarget('focus-screen-time-plan-name', isGuided);
  const dailyTarget = useGuideTarget('focus-screen-time-daily-target', isGuided);
  const saveTarget = useGuideTarget('focus-screen-time-save-plan', isGuided);
  const guideScrollY = useRef(0);
  const guideTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const nativeAvailable = isNativeFocusAvailable();
  const optionalEssentialsSummary = useNativeActivitySelectionSummary('global.essentials');
  const existing = useMemo(() => state.plans.find(plan => plan.id === planId), [planId, state.plans]);
  const [draftPlanId] = useState(() => existing?.id ?? makeId('plan'));
  const planEssentialsSummary = useNativeActivitySelectionSummary(`plan.${draftPlanId}.essentials`);
  const alwaysStrictSummary = useNativeActivitySelectionSummary('always.strict');
  const alwaysLooseSummary = useNativeActivitySelectionSummary('always.loose');
  const retainNativeSelections = useRef(!!existing);
  const initialGroupIds = useMemo(
    () => [...APP_CATEGORIES.map(group => group.id), ...(existing?.customGroupIds ?? [])],
    [existing]
  );

  const recommendedMinutes = Math.max(60, Math.min(10 * 60, Math.round(guidedRecommendedMinutes / 15) * 15));
  const recommendedTolerance = Math.min(12 * 60, recommendedMinutes + 60);
  const [name, setName] = useState(existing?.name ?? (guided ? 'My Daily Guard' : ''));
  const [themeId, setThemeId] = useState<PlanThemeId>(existing?.themeId ?? defaultPlanThemeId(draftPlanId));
  const existingToleranceEnd = existing?.essentialOnlyMinutes ?? existing?.tolerableMinutes ?? null;
  const [target, setTarget] = useState<TargetValues>(() => existing
    ? {
        target: existing.budgetMinutes,
        tolerable: existingToleranceEnd,
        essentialOnly: existingToleranceEnd,
      }
    : {
        // A new plan opens as a complete, editable day instead of hiding
        // Tolerance and the Your day preview behind an unset Goal.
        target: recommendedMinutes,
        tolerable: recommendedTolerance,
        essentialOnly: recommendedTolerance,
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

  const alwaysBlockedIds = useMemo(
    () => new Set(state.alwaysBlockedApps.map(entry => entry.appId)),
    [state.alwaysBlockedApps]
  );
  const planningGroupCatalog = useMemo(
    () => Object.fromEntries(
      Object.entries(groupCatalog).map(([groupId, appIds]) => [
        groupId,
        appIds.filter(appId => !alwaysBlockedIds.has(appId)),
      ])
    ),
    [alwaysBlockedIds, groupCatalog]
  );
  const alwaysBlockedAppNames = useMemo(
    () => state.alwaysBlockedApps
      .map(entry => ESSENTIAL_APP_OPTIONS.find(app => app.id === entry.appId)?.name ?? entry.appId)
      .sort((a, b) => a.localeCompare(b)),
    [state.alwaysBlockedApps]
  );
  const alwaysBlockedAppCount = nativeAvailable
    ? (alwaysStrictSummary?.applicationCount ?? 0) + (alwaysLooseSummary?.applicationCount ?? 0)
    : alwaysBlockedAppNames.length;

  const groupIds = useMemo(
    () => [...APP_CATEGORIES.map(group => group.id), ...customGroupIds],
    [customGroupIds]
  );
  // Session Planning is intentionally dormant in Focus v1. The editor owns a
  // single Daily rule set; any legacy zones are preserved only when saving.
  const activeRules = rules;
  const activeRule = activeRules.find(rule => rule.groupId === ruleGroupId) ?? null;
  const groupAppCounts = useMemo(
    () => Object.fromEntries(groupIds.map(groupId => [groupId, (planningGroupCatalog[groupId] ?? []).length])),
    [groupIds, planningGroupCatalog]
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
      const desired = Math.max(insets.top + 108, guideScreenHeight * 0.46 - height / 2);
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

  useEffect(() => {
    if (!isGuided) return;
    clearGuideTimers();

    if (guidePhase === 'planName') {
      stageGuideTarget(nameTarget, 'origin', () => {
        setPresentation({
          key: 'focus-screen-time-plan-name',
          targetId: 'focus-screen-time-plan-name',
          cutoutPadding: 7,
          placement: 'below',
          allowTargetInteraction: true,
          eyebrow: 'SCREEN TIME CONTROL',
          progress: { current: 3, total: 5 },
          message: 'We prepared a clear first plan. Keep this name or make it your own.',
          highlights: ['first plan', 'make it your own'],
          ctaLabel: 'Use this name',
          onCta: () => patchSession({ phase: 'planTarget' }),
        });
      });
      return;
    }

    if (guidePhase === 'planTarget') {
      stageGuideTarget(dailyTarget, 'middle', () => {
        setPresentation({
          key: 'focus-screen-time-daily-target',
          targetId: 'focus-screen-time-daily-target',
          cutoutPadding: 7,
          placement: 'above',
          allowTargetInteraction: false,
          eyebrow: 'SCREEN TIME CONTROL',
          progress: { current: 4, total: 5 },
          message: `Your answer becomes a ${formatMinutesShort(recommendedMinutes)} Goal. The extra hour of Tolerance gives a warning before only Essentials remain.`,
          highlights: [`${formatMinutesShort(recommendedMinutes)} Goal`, 'Tolerance', 'Essentials'],
          ctaLabel: 'Use this boundary',
          onCta: () => patchSession({ phase: 'planSave' }),
        });
      });
      return;
    }

    if (guidePhase === 'planSave') {
      guideTimersRef.current.push(setTimeout(() => {
        saveTarget.measure();
        setPresentation({
          key: 'focus-screen-time-save-plan',
          targetId: 'focus-screen-time-save-plan',
          cutoutPadding: 7,
          placement: 'above',
          allowTargetInteraction: true,
          eyebrow: 'SCREEN TIME CONTROL',
          progress: { current: 5, total: 5 },
          message: 'Create the real plan. It will become today’s active Screen Time boundary.',
          highlights: ['real plan', 'today’s active'],
          action: 'Tap Create plan',
          hint: 'tap',
        });
      }, 180));
      return;
    }

    setPresentation(null);
  }, [
    clearGuideTimers,
    dailyTarget,
    guidePhase,
    isGuided,
    nameTarget,
    patchSession,
    recommendedMinutes,
    saveTarget,
    setPresentation,
    stageGuideTarget,
  ]);

  useEffect(() => () => clearGuideTimers(), [clearGuideTimers]);

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
    const planAppIds = appIds.filter(appId => !alwaysBlockedIds.has(appId));
    setCustomGroupIds(current => current.includes(groupId) ? current : [...current, groupId]);
    setGroupCatalog(current => {
      const next = clonePlanCatalog(current);
      for (const id of Object.keys(next)) next[id] = next[id].filter(appId => !planAppIds.includes(appId));
      next[groupId] = [...planAppIds];
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
    if (isGuided) {
      assignPlanToWeekdayAndToday(weekdayMondayFirst(new Date()), saved.id);
      setPresentation(null);
      onGuidedComplete?.(saved.id);
      return;
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
        ref={isGuided ? guideScrollRef : undefined}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[s.page, { paddingBottom: 130 + insets.bottom }]}
        scrollEventThrottle={isGuided ? 16 : undefined}
        onScroll={isGuided ? event => { guideScrollY.current = event.nativeEvent.contentOffset.y; } : undefined}
      >
        <ScreenTitleBar
          title={existing ? 'EDIT PLAN' : 'NEW PLAN'}
          showBack
          horizontalBleed={16}
          onBackOverride={isGuided ? () => {} : undefined}
        />

        <Animated.View entering={enter(0)} style={s.identitySurface}>
          <View style={s.identitySection}>
            <Text style={s.sectionLabel}>PLAN NAME</Text>
            <View {...(isGuided ? nameTarget : {})} style={[s.nameSurface, name.length === 0 && s.nameSurfaceEmpty]}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Name this plan..."
                placeholderTextColor={C.textMuted}
                maxLength={28}
                style={s.nameInput}
              />
              {name.trim().length > 0 && (
                <Animated.View entering={FadeInDown.duration(220)} style={s.nameCheck}>
                  <CheckSmall s={16} c="#397557" w={2.6} />
                </Animated.View>
              )}
            </View>
            {name.length === 0 && <Text style={s.requiredText}>Give it a name to save it.</Text>}
          </View>

          <View style={s.identityDivider} />

          <View style={s.identitySection}>
            <View style={s.colorPickerHeader}>
              <Text style={s.colorPickerLabel}>PLAN COLOR</Text>
              <View style={[s.colorPickerValuePill, { backgroundColor: planVisualForTheme(themeId).accentSoft }]}>
                <View style={[s.colorPickerValueDot, { backgroundColor: planVisualForTheme(themeId).accent }]} />
                <Text style={[s.colorPickerValue, { color: planVisualForTheme(themeId).accent }]}>
                  {planVisualForTheme(themeId).label}
                </Text>
              </View>
            </View>
            <View style={s.colorPickerSurface} accessibilityRole="radiogroup">
              {PLAN_VISUALS.map(visual => (
                <View key={visual.id} style={s.colorSwatchCell}>
                  <ColorSwatch
                    visual={visual}
                    selected={visual.id === themeId}
                    onPress={() => setThemeId(visual.id)}
                  />
                </View>
              ))}
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={enter(30)}>
          <TouchableOpacity
            style={[s.essOnlyCard, essentialsOnlyDay && s.essOnlyCardOn]}
            activeOpacity={0.86}
            haptic="medium"
            onPress={toggleEssentialsOnlyDay}
          >
            <LinearGradient
              colors={essentialsOnlyDay
                ? ['#241E20', '#2C2426', '#1A1516']
                : ['#FFFAFA', '#FDF2F3', '#FFF7F7']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View pointerEvents="none" style={s.essBloom}>
              <Bloom color="#E14B5A" opacity={essentialsOnlyDay ? 0.34 : 0.2} />
            </View>
            <LockSeal size={34} lit={essentialsOnlyDay} />
            <View style={s.essOnlyCopy}>
              <Text style={[s.essOnlyLabel, essentialsOnlyDay && s.essOnlyLabelOn]}>ESSENTIALS-ONLY DAY</Text>
              <Text style={[s.essOnlyTitle, essentialsOnlyDay && s.essOnlyTitleOn]}>Lock the whole day</Text>
              <Text style={[s.essOnlyBody, essentialsOnlyDay && s.essOnlyBodyOn]}>
                Only your Essentials open, from minute one.
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
                <EssentialsSurfaceChrome />
                <View style={s.essentialsOutcomeRow}>
                  <LockSeal size={36} lit />
                  <View style={s.essentialsOutcomeCopy}>
                    <Text style={s.essentialsOutcomeLabel}>LOCKED FROM MINUTE ONE</Text>
                    <Text style={s.essentialsOutcomeTitle}>
                      Everything else stays closed <Text style={s.essentialsOutcomeTime}>all day</Text>.
                    </Text>
                    <LinearGradient
                      colors={['rgba(225,75,90,0.42)', 'rgba(225,75,90,0.14)', 'rgba(225,75,90,0)']}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={s.essentialsOutcomeRule}
                    />
                    <Text style={s.essentialsOutcomeBody}>Goal and Tolerance still keep the score of the day.</Text>
                  </View>
                </View>

                <TouchableOpacity style={s.essentialsPicker} onPress={() => setEssentialsOpen(true)} activeOpacity={0.76}>
                  <LinearGradient
                    colors={['#FFFAFA', '#FDF1F2', '#FFF7F7']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <LockSeal size={30} />
                  <View style={s.essentialsPickerCopy}>
                    <Text style={s.essentialsPickerTitle}>Choose this plan&apos;s apps</Text>
                    <Text style={s.essentialsPickerMeta}>
                      {nativeAvailable
                        ? planEssentialsSummary
                          ? `${planEssentialsSummary.applicationCount} plan-only apps · Essentials included`
                          : 'Loading private iPhone selection'
                        : `${planEssentialAppIds.length} plan-only apps · Essentials included`}
                    </Text>
                  </View>
                  <View style={s.essentialsPickerArrow}><ChevronRight s={16} c="#8E3A48" w={2.2} /></View>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        )}

        {!essentialsOnlyDay && (
        <View style={s.sectionsGroup}>
        <Animated.View {...(isGuided ? dailyTarget : {})} entering={enter(50)}>
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
            <EssentialsSurfaceChrome />
            <View style={s.essentialsOutcomeRow}>
              <LockSeal size={36} lit />
              <View style={s.essentialsOutcomeCopy}>
                <Text style={s.essentialsOutcomeLabel}>WHEN TOLERANCE ENDS</Text>
                {/* The hour the phone closes is the fact this whole card exists
                    for — it gets lit, the way the Goal card lights its value. */}
                {draftToleranceEnd == null ? (
                  <Text style={s.essentialsOutcomeTitle}>Set a Goal first.</Text>
                ) : (
                  <Text style={s.essentialsOutcomeTitle}>
                    At <Text style={s.essentialsOutcomeTime}>{formatMinutesShort(draftToleranceEnd)}</Text>, the phone locks.
                  </Text>
                )}
                <LinearGradient
                  colors={['rgba(225,75,90,0.42)', 'rgba(225,75,90,0.14)', 'rgba(225,75,90,0)']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={s.essentialsOutcomeRule}
                />
                <Text style={s.essentialsOutcomeBody}>Everything closes for the rest of the day — except your Essentials.</Text>
              </View>
            </View>

            <TouchableOpacity style={s.essentialsPicker} onPress={() => setEssentialsOpen(true)} activeOpacity={0.76}>
              <LinearGradient
                colors={['#FFFAFA', '#FDF1F2', '#FFF7F7']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <LockSeal size={30} />
              <View style={s.essentialsPickerCopy}>
                <Text style={s.essentialsPickerTitle}>Choose your Essentials</Text>
                <Text style={s.essentialsPickerMeta}>
                  {nativeAvailable
                    ? optionalEssentialsSummary
                      ? `${optionalEssentialsSummary.applicationCount} apps chosen · safety access always stays`
                      : 'Loading private iPhone selection'
                    : `${state.optionalEssentialAppIds.length} apps chosen · safety access always stays`}
                </Text>
              </View>
              <View style={s.essentialsPickerArrow}><ChevronRight s={16} c="#8E3A48" w={2.2} /></View>
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
            alwaysBlockedAppCount={alwaysBlockedAppCount}
            alwaysBlockedAppNames={alwaysBlockedAppNames}
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
        {isGuided ? (
          <View {...saveTarget}>
            <GoldButton
              label={checkingSelections ? 'Checking iPhone selections...' : existing ? 'Save changes' : 'Create plan'}
              disabled={!canSave || checkingSelections}
              onPress={requestSave}
            />
          </View>
        ) : (
          <GoldButton
            label={checkingSelections ? 'Checking iPhone selections...' : existing ? 'Save changes' : 'Create plan'}
            disabled={!canSave || checkingSelections}
            onPress={requestSave}
          />
        )}
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
        apps={ruleGroupId ? appsForGroup(planningGroupCatalog, ruleGroupId) : []}
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
  sectionLabel: { marginBottom: 9, fontFamily: F.sansBold, fontSize: 10.5, letterSpacing: 2.25, color: C.textMuted },
  sectionLabelNoMargin: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.4, color: C.textMuted },
  sectionSub: { marginTop: 4, maxWidth: 320, fontFamily: F.sans, fontSize: 12.5, lineHeight: 17.5, color: C.textSecondary },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 8 },
  sectionsGroup: { gap: 18 },
  dormant: { opacity: 0.38 },
  dormantNote: { marginTop: 9, textAlign: 'center', fontFamily: F.serifItalic, fontSize: 13, color: C.textMuted },
  // The Essentials register: rose on cream when the day is open, rose on a warm
  // black when it's locked. Same seal, same ghost, both states.
  essOnlyCard: {
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderRadius: 22,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#EFD3D7',
    backgroundColor: '#FFF9F9',
    paddingVertical: 14,
    paddingHorizontal: 15,
    boxShadow: '0 6px 18px rgba(120, 52, 63, 0.07)',
  },
  essOnlyCardOn: {
    borderColor: '#3C2E31',
    backgroundColor: '#241E20',
    boxShadow: '0 12px 28px rgba(24, 24, 25, 0.22)',
  },
  essBloom: { position: 'absolute', right: -66, top: -78, width: 196, height: 158 },
  essOnlyCopy: { flex: 1, minWidth: 0 },
  essOnlyLabel: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.5, color: '#A63A4B' },
  essOnlyLabelOn: { color: '#E6A9B1' },
  essOnlyTitle: { marginTop: 3, fontFamily: F.serifSemiBold, fontSize: 19.5, lineHeight: 23, letterSpacing: -0.2, color: '#3A252A' },
  essOnlyTitleOn: { color: '#FDF6F6' },
  essOnlyBody: { marginTop: 3, fontFamily: F.serifMedium, fontSize: 14.5, lineHeight: 18.5, color: '#7E6165' },
  essOnlyBodyOn: { color: '#C4B4B6' },
  identitySurface: { borderRadius: 25, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E2DDD4', backgroundColor: '#FFFEFB', padding: 15, gap: 15, boxShadow: '0 9px 25px rgba(42, 38, 31, 0.055)' },
  identitySection: { minWidth: 0 },
  identityDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#E8E3DA' },
  nameSurface: { height: 62, flexDirection: 'row', alignItems: 'center', borderRadius: 18, borderCurve: 'continuous', borderWidth: 1, borderColor: '#DCD8D0', backgroundColor: '#F7F6F2', paddingLeft: 16, paddingRight: 10, boxShadow: 'inset 0 1px 2px rgba(34, 31, 26, 0.035)' },
  nameSurfaceEmpty: { borderColor: '#E1C5A1' },
  nameInput: { flex: 1, fontFamily: F.serifMedium, fontSize: 22, lineHeight: 27, color: C.text, paddingVertical: 0 },
  nameCheck: { width: 32, height: 32, borderRadius: 11, borderCurve: 'continuous', backgroundColor: '#E7F1EB', alignItems: 'center', justifyContent: 'center' },
  requiredText: { marginTop: 5, marginLeft: 4, fontFamily: F.sansMedium, fontSize: 10, color: '#A36F2B' },
  colorPickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  colorPickerLabel: { fontFamily: F.sansBold, fontSize: 10.5, letterSpacing: 2.25, color: C.textMuted },
  colorPickerValuePill: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 999, paddingHorizontal: 11 },
  colorPickerValueDot: { width: 7, height: 7, borderRadius: 4 },
  colorPickerValue: { fontFamily: F.sansSemiBold, fontSize: 12.5 },
  // Every swatch owns exactly one sixth of the tray, so narrow and wide
  // devices always keep the intended two rows of six.
  colorPickerSurface: { marginTop: 11, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', rowGap: 12, borderRadius: 19, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E3E0D9', backgroundColor: '#F4F3EF', paddingHorizontal: 3, paddingVertical: 13, boxShadow: 'inset 0 1px 2px rgba(34, 31, 26, 0.035)' },
  colorSwatchCell: { width: '16.666666%', alignItems: 'center', justifyContent: 'center' },
  colorSwatchButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  colorSwatch: { width: 29, height: 29, borderRadius: 15, alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(47, 39, 28, 0.13)' },
  essentialsSurface: { position: 'relative', overflow: 'hidden', borderRadius: 25, borderCurve: 'continuous', borderWidth: 1, borderColor: '#3A2E30', backgroundColor: '#241E20', padding: 16, gap: 15, boxShadow: '0 12px 28px rgba(24, 24, 25, 0.18)' },
  planAccessSurface: { borderColor: '#403234', boxShadow: '0 14px 32px rgba(24, 24, 25, 0.22)' },
  essentialsBloom: { position: 'absolute', right: -76, top: -92, width: 224, height: 180 },
  essentialsWatermark: { position: 'absolute', right: -32, top: -10, opacity: 0.26, transform: [{ rotate: '7deg' }] },
  // A tapered rose bar instead of a flat slab: inset, rounded, brightest at the
  // middle where the lock sits.
  essentialsAccent: { position: 'absolute', left: 0, top: 16, bottom: 16, width: 4, borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  essentialsOutcomeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 13, paddingLeft: 6 },
  essentialsOutcomeCopy: { flex: 1, minWidth: 0, paddingTop: 1 },
  essentialsOutcomeLabel: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.55, color: '#E6A9B1' },
  essentialsOutcomeTitle: { marginTop: 5, fontFamily: F.serifSemiBold, fontSize: 21, lineHeight: 25, letterSpacing: -0.25, color: '#FDF6F6' },
  // The lock hour, lit inside its own sentence: same size so the line still
  // sits on one baseline, but bolder, rose, and tabular.
  essentialsOutcomeTime: { fontFamily: F.serifBold, color: '#FF9DA8', fontVariant: ['tabular-nums'] },
  essentialsOutcomeRule: { height: 1, width: 96, marginTop: 10, borderRadius: 1 },
  essentialsOutcomeBody: { marginTop: 9, fontFamily: F.serifMedium, fontSize: 15, lineHeight: 19.5, color: '#C4B4B6' },
  essentialsPicker: { position: 'relative', overflow: 'hidden', minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, borderCurve: 'continuous', borderWidth: 1, borderColor: '#EFD3D7', backgroundColor: '#FFF9F9', paddingHorizontal: 13, paddingVertical: 12 },
  essentialsPickerCopy: { flex: 1, minWidth: 0 },
  essentialsPickerTitle: { fontFamily: F.serifSemiBold, fontSize: 18.5, lineHeight: 22, letterSpacing: -0.2, color: '#3A252A' },
  essentialsPickerMeta: { marginTop: 3, fontFamily: F.sans, fontSize: 11, lineHeight: 15, color: '#7A6468' },
  essentialsPickerArrow: { flexShrink: 0, width: 29, height: 29, borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(166,58,75,0.28)', backgroundColor: 'rgba(244,217,222,0.7)', alignItems: 'center', justifyContent: 'center' },
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
