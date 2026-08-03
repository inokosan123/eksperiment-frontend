import { requireOptionalNativeModule } from 'expo-modules-core';

export type ActivitySelectionSummary = {
  selectionId: string;
  applicationCount: number;
  categoryCount: number;
  webDomainCount: number;
  selectionPolicy?: 'applicationsOnly' | 'appsAndCategories' | 'mixed';
  notice?: string;
};

export type AnastaFocusNativeModule = {
  authorizationStatus(): Promise<'notDetermined' | 'approved' | 'denied'>;
  requestAuthorization(): Promise<'notDetermined' | 'approved' | 'denied'>;
  applyProtection(payloadJson: string): Promise<{
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
  syncAnalyticsContext(payloadJson: string): Promise<{
    requestId: string;
    stored: boolean;
  }>;
  runtimeStatus(): Promise<{
    hardWallReached: boolean;
    hardWallDate: string | null;
    webDomainsApplied: number;
    webDomainsOmitted: number;
    adultFilterActive: boolean;
    quietHourActive: boolean;
    targetArmedDays: Record<string, string>;
    targetLostDays: Record<string, string>;
  }>;
  clearProtection(): Promise<void>;
  openActivityPicker(selectionId: string, title: string): Promise<ActivitySelectionSummary>;
  activitySelectionSummary(selectionId: string): Promise<ActivitySelectionSummary>;
  copyActivitySelection(sourceId: string, destinationId: string): Promise<ActivitySelectionSummary>;
  activitySelectionsEqual(firstId: string, secondId: string): Promise<boolean>;
  clearActivitySelection(selectionId: string): Promise<void>;
  clearActivitySelectionsWithPrefix(prefix: string): Promise<void>;
  grantTemporaryAccess(
    selectionId: string,
    sourceSelectionId: string,
    sourceKind: string,
    sourceMinutes: number,
    minutes: number
  ): Promise<void>;
  consumePendingIntervention(): Promise<Record<string, unknown> | null>;
  consumeNativeEvents(): Promise<Record<string, unknown>[]>;
};

export default requireOptionalNativeModule<AnastaFocusNativeModule>('AnastaFocus');
