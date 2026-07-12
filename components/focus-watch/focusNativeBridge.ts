import { NativeModules, Platform } from 'react-native';
import AnastaFocusModule, {
  type ActivitySelectionSummary,
  type AnastaFocusNativeModule,
} from '@/modules/anasta-focus';
import {
  allCoreEssentialIds,
  dateKey,
  getEffectivePlan,
  groupName,
  normalizeConnectedSessions,
  type DayPlanState,
} from './dayPlanStore';
import { resolveWebProtectionDomains } from './webProtectionCatalog';

export type NativeAuthorizationStatus = 'notDetermined' | 'approved' | 'denied' | 'unavailable';

export type NativePendingIntervention = {
  kind: 'always' | 'blocked' | 'checkin' | 'daily-hard' | 'limit' | 'quiet' | 'web';
  day: string;
  planId: string;
  selectionId: string;
  sessionId: string;
  accessSelectionId: string;
  strength: 'loose' | 'strict';
  practice: 'chapter' | 'intention' | 'jesus-prayer' | 'prayer' | 'psalm';
  label: string;
  minutes: number;
  createdAt: number;
};

export type NativeBoundaryEvent = Omit<NativePendingIntervention, 'kind'> & {
  kind: NativePendingIntervention['kind'] | 'daily-target';
  activity: string;
  event: string;
};

const NATIVE_EVENT_KINDS = new Set([
  'always', 'blocked', 'checkin', 'daily-hard', 'daily-target', 'limit', 'quiet', 'web',
]);
const NATIVE_PRACTICES = new Set(['chapter', 'intention', 'jesus-prayer', 'prayer', 'psalm']);

function normalizeNativeEvent(value: Record<string, unknown>): NativeBoundaryEvent {
  const rawKind = typeof value.kind === 'string' ? value.kind : 'limit';
  const kind = NATIVE_EVENT_KINDS.has(rawKind) ? rawKind : 'limit';
  const rawPractice = typeof value.practice === 'string' ? value.practice : 'prayer';
  const selectionId = typeof value.selectionId === 'string' ? value.selectionId : '';
  return {
    kind: kind as NativeBoundaryEvent['kind'],
    day: typeof value.day === 'string' ? value.day : '',
    planId: typeof value.planId === 'string' ? value.planId : '',
    selectionId,
    sessionId: typeof value.sessionId === 'string' ? value.sessionId : '',
    accessSelectionId: typeof value.accessSelectionId === 'string'
      ? value.accessSelectionId
      : selectionId,
    strength: value.strength === 'loose' ? 'loose' : 'strict',
    practice: (NATIVE_PRACTICES.has(rawPractice) ? rawPractice : 'prayer') as NativeBoundaryEvent['practice'],
    label: typeof value.label === 'string' ? value.label : '',
    minutes: Math.max(0, Number(value.minutes) || 0),
    createdAt: Math.max(0, Number(value.createdAt) || 0),
    activity: typeof value.activity === 'string' ? value.activity : '',
    event: typeof value.event === 'string' ? value.event : '',
  };
}

type LegacyAnastaFocusNativeModule = {
  authorizationStatus?: () => Promise<NativeAuthorizationStatus>;
  requestAuthorization?: () => Promise<NativeAuthorizationStatus>;
  applyProtection?: (payloadJson: string) => Promise<{
    applied: boolean;
    error?: string;
    errorCode?: 'unauthorized' | 'excessiveActivities' | 'intervalTooShort' | 'intervalTooLong' | 'invalidDateComponents' | 'missingSelections' | 'unknown';
    recovery?: string;
    hardWallReached?: boolean;
    hardWallDate?: string | null;
    webDomainsApplied?: number;
    webDomainsOmitted?: number;
    adultFilterActive?: boolean;
    quietHourActive?: boolean;
    targetArmedDays?: Record<string, string>;
    targetLostDays?: Record<string, string>;
  }>;
  runtimeStatus?: () => Promise<{
    hardWallReached: boolean;
    hardWallDate: string | null;
    webDomainsApplied: number;
    webDomainsOmitted: number;
    adultFilterActive: boolean;
    quietHourActive: boolean;
    targetArmedDays: Record<string, string>;
    targetLostDays: Record<string, string>;
  }>;
  clearProtection?: () => Promise<void>;
};

const nativeModule = AnastaFocusModule
  ?? NativeModules.AnastaFocus as (AnastaFocusNativeModule & LegacyAnastaFocusNativeModule) | undefined;

export function isNativeFocusAvailable() {
  return Platform.OS === 'ios'
    && typeof nativeModule?.requestAuthorization === 'function'
    && typeof nativeModule?.applyProtection === 'function';
}

export async function getNativeAuthorizationStatus(): Promise<NativeAuthorizationStatus> {
  if (!isNativeFocusAvailable() || !nativeModule?.authorizationStatus) return 'unavailable';
  try {
    return await nativeModule.authorizationStatus();
  } catch {
    return 'denied';
  }
}

export async function requestNativeAuthorization(): Promise<NativeAuthorizationStatus> {
  if (!isNativeFocusAvailable() || !nativeModule?.requestAuthorization) return 'unavailable';
  try {
    return await nativeModule.requestAuthorization();
  } catch {
    return 'denied';
  }
}

export function buildNativeProtectionPayload(state: DayPlanState, now = new Date()) {
  const plan = getEffectivePlan(state, now);
  const resolvedWeb = resolveWebProtectionDomains(state.purity);
  const serializePlan = (entry: NonNullable<typeof plan>) => ({
    id: entry.id,
    kind: entry.kind,
    targetMinutes: entry.budgetMinutes,
    tolerableMinutes: entry.tolerableMinutes,
    essentialOnlyMinutes: entry.essentialOnlyMinutes,
    groupCatalog: entry.groupCatalog,
    groupNames: Object.fromEntries(
      Object.keys(entry.groupCatalog).map(groupId => [groupId, groupName(state, groupId)])
    ),
    dailyRules: entry.kind === 'daily' ? entry.rules : [],
    sessions: entry.kind === 'session'
      ? normalizeConnectedSessions(entry.zones).map(session => ({
          id: session.id,
          name: session.name,
          startMinutes: session.startMinutes,
          endMinutes: session.endMinutes,
          rules: session.rules ?? [],
        }))
      : [],
  });
  const dayOverrides = Object.fromEntries(
    Object.values(state.days)
      .map(day => [day.date, day.planId])
  );
  const reportPlanSnapshots = Object.fromEntries(
    Object.entries(state.planSnapshotsByDate).map(([day, snapshot]) => [
      day,
      snapshot ? serializePlan(snapshot) : null,
    ])
  );
  return {
    schemaVersion: 4,
    generatedAt: Date.now(),
    localDay: dateKey(now),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    authorizationRequired: true,
    essentials: {
      selectionId: 'global.essentials',
      coreLabels: allCoreEssentialIds(state),
      optionalLabels: state.optionalEssentialAppIds,
    },
    alwaysBlocked: state.alwaysBlockedApps,
    quietHour: state.quiet
      ? {
          startsAt: state.quiet.startedAt,
          endsAt: state.quiet.endsAt,
          selectionId: 'quiet.current',
          allowedLabels: [...allCoreEssentialIds(state), ...state.quiet.selection.appIds],
        }
      : null,
    plan: plan ? serializePlan(plan) : null,
    plans: state.plans.map(serializePlan),
    weeklySchedule: state.schedule,
    dayOverrides,
    reportPlanSnapshots,
    webProtection: {
      packs: state.purity.packs,
      customPacks: state.purity.customPacks,
      customDomains: state.purity.customDomains,
      resolvedDomains: resolvedWeb.domains,
      omittedDomainCount: resolvedWeb.omittedDomains.length,
      adultFilterActive: resolvedWeb.adultFilterActive,
      locks: state.purity.locks,
    },
  };
}

export async function applyNativeProtection(state: DayPlanState) {
  if (!isNativeFocusAvailable() || !nativeModule?.applyProtection) {
    return { applied: false, unavailable: true as const };
  }
  const result = await nativeModule.applyProtection(JSON.stringify(buildNativeProtectionPayload(state)));
  return { ...result, unavailable: false as const };
}

export async function clearNativeProtection() {
  if (!isNativeFocusAvailable() || !nativeModule?.clearProtection) return;
  await nativeModule.clearProtection();
}

export async function getNativeRuntimeStatus() {
  if (!isNativeFocusAvailable() || !nativeModule?.runtimeStatus) return null;
  return nativeModule.runtimeStatus();
}

export async function openNativeActivityPicker(selectionId: string, title: string) {
  if (!isNativeFocusAvailable() || !nativeModule?.openActivityPicker) return null;
  return nativeModule.openActivityPicker(selectionId, title);
}

export async function getNativeActivitySelectionSummary(
  selectionId: string
): Promise<ActivitySelectionSummary | null> {
  if (!isNativeFocusAvailable() || !nativeModule?.activitySelectionSummary) return null;
  return nativeModule.activitySelectionSummary(selectionId);
}

export async function copyNativeActivitySelection(sourceId: string, destinationId: string) {
  if (!isNativeFocusAvailable() || !nativeModule?.copyActivitySelection) return null;
  return nativeModule.copyActivitySelection(sourceId, destinationId);
}

export async function nativeActivitySelectionsEqual(firstId: string, secondId: string) {
  if (!isNativeFocusAvailable() || !nativeModule?.activitySelectionsEqual) return null;
  return nativeModule.activitySelectionsEqual(firstId, secondId);
}

export async function clearNativeActivitySelection(selectionId: string) {
  if (!isNativeFocusAvailable() || !nativeModule?.clearActivitySelection) return;
  await nativeModule.clearActivitySelection(selectionId);
}

export async function clearNativeActivitySelectionsWithPrefix(prefix: string) {
  if (!isNativeFocusAvailable() || !nativeModule?.clearActivitySelectionsWithPrefix) return;
  await nativeModule.clearActivitySelectionsWithPrefix(prefix);
}

export async function grantNativeTemporaryAccess(
  selectionId: string,
  sourceSelectionId: string,
  sourceKind: string,
  sourceMinutes: number,
  minutes = 15
) {
  if (!isNativeFocusAvailable() || !nativeModule?.grantTemporaryAccess) return;
  await nativeModule.grantTemporaryAccess(
    selectionId,
    sourceSelectionId,
    sourceKind,
    Math.max(0, Math.round(sourceMinutes)),
    minutes
  );
}

export async function consumeNativePendingIntervention() {
  if (!isNativeFocusAvailable() || !nativeModule?.consumePendingIntervention) return null;
  const value = await nativeModule.consumePendingIntervention();
  if (!value || typeof value !== 'object') return null;
  const normalized = normalizeNativeEvent(value);
  if (normalized.kind === 'daily-target') return null;
  return normalized as NativePendingIntervention;
}

export async function consumeNativeBoundaryEvents(): Promise<NativeBoundaryEvent[]> {
  if (!isNativeFocusAvailable() || !nativeModule?.consumeNativeEvents) return [];
  const values = await nativeModule.consumeNativeEvents();
  return Array.isArray(values)
    ? values.filter(value => value && typeof value === 'object').map(normalizeNativeEvent)
    : [];
}
