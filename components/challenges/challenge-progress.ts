import type { ChallengeRecord } from '@/components/challenges/challengeData';

type DayCountProgress = Pick<ChallengeRecord, 'progressTotal' | 'durationDays' | 'totalUnits'>;

/**
 * Legacy open-ended-looking records can carry progressTotal=0 while still
 * having a real duration. Zero means "use the duration", not "never finish".
 */
export function resolveDayCountChallengeTotal(record: DayCountProgress) {
  if ((record.progressTotal ?? 0) > 0) return record.progressTotal ?? 0;
  return record.durationDays ?? record.totalUnits ?? 0;
}

export function resolveDayCountProgress(
  record: DayCountProgress & Pick<ChallengeRecord, 'completedAt'>,
  statuses: Iterable<'completed' | 'skipped' | 'pending'>,
  completionDate: string,
) {
  let completedCount = 0;
  for (const status of statuses) {
    if (status === 'completed') completedCount += 1;
  }
  const total = resolveDayCountChallengeTotal(record);
  const completedAt = total > 0 && completedCount >= total
    ? record.completedAt ?? completionDate
    : undefined;
  return { completedCount, total, completedAt };
}

export function challengeUsesFiniteScriptureReader(
  record: Pick<ChallengeRecord, 'category' | 'templateId'>,
) {
  return record.category === 'scripture' && record.templateId !== 'lectionary_daily';
}
