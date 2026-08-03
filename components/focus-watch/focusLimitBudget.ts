import type { AppRule, GroupRule } from './dayPlanStore';

export const FOCUS_LIMIT_STEP_MINUTES = 15;
export const FOCUS_LIMIT_PICKER_MAX_MINUTES = 12 * 60;
export type FocusRuleMode = 'limit' | 'blocked';

export type LimitBudgetIssue = {
  code:
    | 'groups-over-target'
    | 'apps-over-group'
    | 'group-over-target'
    | 'app-over-parent'
    | 'invalid-duration';
  message: string;
  groupId?: string;
  appId?: string;
  allocatedMinutes: number;
  availableMinutes: number;
};

export class FocusLimitBudgetError extends Error {
  readonly issues: LimitBudgetIssue[];

  constructor(issues: LimitBudgetIssue[]) {
    super(issues[0]?.message ?? 'Focus limits do not fit their parent boundaries.');
    this.name = 'FocusLimitBudgetError';
    this.issues = issues;
  }
}

export type LimitBounds = {
  currentMinutes: number;
  minimumMinutes: number;
  maximumMinutes: number;
  allocatedElsewhereMinutes: number;
  parentMinutes: number | null;
  hasCapacity: boolean;
};

export function groupRuleMode(
  rule: Pick<GroupRule, 'mode' | 'dailyMinutes'> | null | undefined
): FocusRuleMode {
  return rule?.mode === 'blocked' ? 'blocked' : 'limit';
}

export function appRuleMode(
  rule: Pick<AppRule, 'mode' | 'minutes'> | null | undefined
): FocusRuleMode {
  return rule?.mode === 'blocked' ? 'blocked' : 'limit';
}

export function finiteGroupMinutes(rule: GroupRule | null | undefined): number {
  const minutes = groupRuleMode(rule) === 'limit' ? rule?.dailyMinutes : null;
  return minutes != null ? Math.max(0, minutes) : 0;
}

export function finiteAppMinutes(rule: AppRule | null | undefined): number {
  const minutes = appRuleMode(rule) === 'limit' ? rule?.minutes : null;
  return minutes != null ? Math.max(0, minutes) : 0;
}

export function allocatedGroupMinutes(rules: GroupRule[], excludingGroupId?: string): number {
  return rules.reduce((sum, rule) => (
    rule.groupId === excludingGroupId ? sum : sum + finiteGroupMinutes(rule)
  ), 0);
}

export function allocatedAppMinutes(appRules: AppRule[], excludingAppId?: string): number {
  return appRules.reduce((sum, rule) => (
    rule.appId === excludingAppId ? sum : sum + finiteAppMinutes(rule)
  ), 0);
}

export function groupLimitBounds({
  dailyTargetMinutes,
  rules,
  groupId,
  pickerMaximumMinutes = FOCUS_LIMIT_PICKER_MAX_MINUTES,
}: {
  dailyTargetMinutes: number | null;
  rules: GroupRule[];
  groupId: string;
  pickerMaximumMinutes?: number;
}): LimitBounds {
  const rule = rules.find(entry => entry.groupId === groupId);
  const allocatedElsewhereMinutes = allocatedGroupMinutes(rules, groupId);
  const appMinimum = allocatedAppMinutes(rule?.appRules ?? []);
  const parentMaximum = dailyTargetMinutes == null
    ? pickerMaximumMinutes
    : Math.max(0, dailyTargetMinutes - allocatedElsewhereMinutes);
  const maximumMinutes = Math.min(pickerMaximumMinutes, parentMaximum);
  const minimumMinutes = Math.max(FOCUS_LIMIT_STEP_MINUTES, appMinimum);

  return {
    currentMinutes: finiteGroupMinutes(rule),
    minimumMinutes,
    maximumMinutes,
    allocatedElsewhereMinutes,
    parentMinutes: dailyTargetMinutes,
    hasCapacity: maximumMinutes >= minimumMinutes,
  };
}

export function appLimitBounds({
  dailyTargetMinutes,
  groupRule,
  appId,
  pickerMaximumMinutes = FOCUS_LIMIT_PICKER_MAX_MINUTES,
}: {
  dailyTargetMinutes: number | null;
  groupRule: GroupRule;
  appId: string;
  pickerMaximumMinutes?: number;
}): LimitBounds {
  const groupMode = groupRuleMode(groupRule);
  const finiteGroupLimit = groupMode === 'limit' && groupRule.dailyMinutes != null;
  // App limits divide a shared pool only when the group itself owns a finite
  // allowance. Limit + no duration is the natural unlimited state, so app caps
  // remain independent beneath the Daily Target.
  const allocatedElsewhereMinutes = finiteGroupLimit
    ? allocatedAppMinutes(groupRule.appRules ?? [], appId)
    : 0;
  const parentMinutes = groupMode === 'blocked'
    ? 0
    : finiteGroupLimit
      ? groupRule.dailyMinutes
      : dailyTargetMinutes;
  const parentMaximum = parentMinutes == null
    ? pickerMaximumMinutes
    : Math.max(0, parentMinutes - allocatedElsewhereMinutes);
  const maximumMinutes = Math.min(pickerMaximumMinutes, parentMaximum);

  return {
    currentMinutes: finiteAppMinutes(
      (groupRule.appRules ?? []).find(entry => entry.appId === appId)
    ),
    minimumMinutes: FOCUS_LIMIT_STEP_MINUTES,
    maximumMinutes,
    allocatedElsewhereMinutes,
    parentMinutes,
    hasCapacity: maximumMinutes >= FOCUS_LIMIT_STEP_MINUTES,
  };
}

export function nearestValidLimitMinutes(
  preferredMinutes: number,
  bounds: Pick<LimitBounds, 'minimumMinutes' | 'maximumMinutes' | 'hasCapacity'>
): number | null {
  if (!bounds.hasCapacity) return null;
  const minimum = Math.ceil(bounds.minimumMinutes / FOCUS_LIMIT_STEP_MINUTES)
    * FOCUS_LIMIT_STEP_MINUTES;
  const maximum = Math.floor(bounds.maximumMinutes / FOCUS_LIMIT_STEP_MINUTES)
    * FOCUS_LIMIT_STEP_MINUTES;
  if (maximum < minimum) return null;
  const snapped = Math.round(preferredMinutes / FOCUS_LIMIT_STEP_MINUTES)
    * FOCUS_LIMIT_STEP_MINUTES;
  return Math.max(minimum, Math.min(maximum, snapped));
}

function isValidDuration(minutes: number) {
  return minutes >= FOCUS_LIMIT_STEP_MINUTES
    && minutes % FOCUS_LIMIT_STEP_MINUTES === 0;
}

export function validateFocusLimitBudget({
  dailyTargetMinutes,
  rules,
}: {
  dailyTargetMinutes: number | null;
  rules: GroupRule[];
}): LimitBudgetIssue[] {
  const issues: LimitBudgetIssue[] = [];
  const groupAllocated = allocatedGroupMinutes(rules);

  if (dailyTargetMinutes != null && groupAllocated > dailyTargetMinutes) {
    issues.push({
      code: 'groups-over-target',
      message: 'Group limits use more time than the Daily Target.',
      allocatedMinutes: groupAllocated,
      availableMinutes: dailyTargetMinutes,
    });
  }

  for (const rule of rules) {
    const groupMinutes = finiteGroupMinutes(rule);
    if (groupMinutes > 0 && !isValidDuration(groupMinutes)) {
      issues.push({
        code: 'invalid-duration',
        message: 'Group limits must use 15-minute steps.',
        groupId: rule.groupId,
        allocatedMinutes: groupMinutes,
        availableMinutes: groupMinutes,
      });
    }
    if (dailyTargetMinutes != null && groupMinutes > dailyTargetMinutes) {
      issues.push({
        code: 'group-over-target',
        message: 'This group limit is longer than the Daily Target.',
        groupId: rule.groupId,
        allocatedMinutes: groupMinutes,
        availableMinutes: dailyTargetMinutes,
      });
    }

    const activeAppRules = groupRuleMode(rule) === 'blocked' ? [] : (rule.appRules ?? []);
    const appAllocated = allocatedAppMinutes(activeAppRules);
    if (groupRuleMode(rule) === 'limit' && appAllocated > groupMinutes) {
      issues.push({
        code: 'apps-over-group',
        message: 'Individual app limits use more time than their group limit.',
        groupId: rule.groupId,
        allocatedMinutes: appAllocated,
        availableMinutes: groupMinutes,
      });
    }

    for (const appRule of activeAppRules) {
      const appMinutes = finiteAppMinutes(appRule);
      if (appMinutes <= 0) continue;
      if (!isValidDuration(appMinutes)) {
        issues.push({
          code: 'invalid-duration',
          message: 'App limits must use 15-minute steps.',
          groupId: rule.groupId,
          appId: appRule.appId,
          allocatedMinutes: appMinutes,
          availableMinutes: appMinutes,
        });
      }
      const directParent = groupRuleMode(rule) === 'limit'
        ? groupMinutes
        : dailyTargetMinutes;
      if (directParent != null && appMinutes > directParent) {
        issues.push({
          code: 'app-over-parent',
          message: 'This app limit is longer than its active parent limit.',
          groupId: rule.groupId,
          appId: appRule.appId,
          allocatedMinutes: appMinutes,
          availableMinutes: directParent,
        });
      }
    }
  }

  return issues;
}

export function assertFocusLimitBudget(input: {
  dailyTargetMinutes: number | null;
  rules: GroupRule[];
}) {
  const issues = validateFocusLimitBudget(input);
  if (issues.length > 0) throw new FocusLimitBudgetError(issues);
}
