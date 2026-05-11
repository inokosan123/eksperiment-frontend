import type { ChallengeRecord } from '@/components/challenges/challengeData';
import { challengeTaskId } from '@/components/challenges/challengeDb';
import {
  archiveTaskImmediately,
  pauseTask,
  resumeTask,
  saveTask,
  softDeleteTask,
} from '@/components/tasks/taskDb';
import type { TaskDraft, TaskSchedule, TaskType } from '@/components/tasks/taskTypes';

function taskTypeForChallenge(category: ChallengeRecord['category']): TaskType {
  switch (category) {
    case 'prayer':
      return 'prayer';
    case 'scripture':
      return 'reading';
    case 'journal':
      return 'journal';
    case 'church':
      return 'church';
    default:
      return 'custom';
  }
}

function scriptureReadingType(record: ChallengeRecord) {
  if (record.groupKey === 'psalter') return 'psalter' as const;
  if (record.groupKey === 'old_testament') return 'old_testament' as const;
  if (record.groupKey === 'lectionary') return 'church_calendar' as const;
  return 'new_testament' as const;
}

function journalType(record: ChallengeRecord) {
  if (record.templateId.includes('morning')) return 'morning_pages' as const;
  if (record.templateId.includes('free')) return 'free_writing' as const;
  return 'daily' as const;
}

function challengeSchedule(record: ChallengeRecord): TaskSchedule {
  const config = record.scriptureConfig ?? record.prayerConfig;
  const churchConfig = record.churchConfig;
  const time = churchConfig?.time ?? config?.time ?? record.time ?? '08:00';

  if (record.category === 'church') {
    return {
      frequency: churchConfig?.frequency ?? 'specific_days',
      selectedDays: churchConfig?.frequency === 'specific_days'
        ? churchConfig.selectedDays ?? [6]
        : [],
      monthlyDays: churchConfig?.frequency === 'monthly'
        ? churchConfig.monthlyDays ?? [1]
        : [1],
      time,
      sameTimeEveryDay: churchConfig?.sameTimeEveryDay !== false,
      dayTimes: churchConfig?.sameTimeEveryDay === false ? churchConfig.dayTimes ?? {} : {},
    };
  }

  return {
    frequency: 'daily',
    selectedDays: [],
    monthlyDays: [1],
    time,
    sameTimeEveryDay: config?.sameTimeEveryDay !== false,
    dayTimes: config?.sameTimeEveryDay === false ? config.dayTimes ?? {} : {},
  };
}

function subtitleFor(record: ChallengeRecord) {
  const pieces = [
    record.paceLabel,
    record.progressTotal ? `${record.progressCurrent}/${record.progressTotal} ${record.progressUnit}` : null,
  ].filter(Boolean);
  return pieces.join(' - ') || record.scheduleLabel;
}

export function challengeRecordToTaskDraft(record: ChallengeRecord): TaskDraft {
  const scriptureConfig = record.category === 'scripture'
    ? {
        readingType: scriptureReadingType(record),
        chaptersPerDay: record.scriptureConfig?.chaptersPerDay ?? undefined,
        totalUnitsRead: record.progressCurrent,
      }
    : undefined;
  const prayerConfig = record.category === 'prayer' && record.prayerConfig
    ? {
        prayerType: record.prayerConfig.prayerType,
        prayerRule: record.prayerConfig.prayerRule,
        prayerTaskKind: record.prayerConfig.taskKind,
        jesusPrayerMode: record.prayerConfig.jesusPrayerMode,
        jesusPrayerDuration: record.prayerConfig.jesusPrayerDuration,
        jesusPrayerCount: record.prayerConfig.jesusPrayerCount,
      }
    : undefined;

  return {
    id: challengeTaskId(record.id),
    title: record.title,
    subtitle: subtitleFor(record),
    level: 1,
    source: 'challenge',
    type: taskTypeForChallenge(record.category),
    icon: record.icon,
    targetView: '/challenges',
    targetTab: record.category,
    status: record.status === 'active' ? 'active' : record.status === 'paused' ? 'paused' : 'archived',
    schedule: challengeSchedule(record),
    notificationMode: record.prayerConfig?.notificationMode ?? record.scriptureConfig?.notificationMode ?? record.churchConfig?.notificationMode ?? 'single',
    reminderMinutes: (
      record.prayerConfig?.notificationMode === 'double'
        ? record.prayerConfig.reminderMinutes
        : record.scriptureConfig?.notificationMode === 'double'
          ? record.scriptureConfig.reminderMinutes
          : record.churchConfig?.notificationMode === 'double'
            ? record.churchConfig.reminderMinutes
            : undefined
    ),
    scriptureConfig,
    prayerConfig,
    journalConfig: record.category === 'journal'
      ? {
          journalType: journalType(record),
          technique: journalType(record),
        }
      : undefined,
    challengeConfig: {
      challengeId: record.id,
      templateId: record.templateId,
      progressCurrent: record.progressCurrent,
      progressTotal: record.progressTotal ?? record.durationDays ?? record.totalUnits ?? 0,
      progressUnit: record.progressUnit,
    },
  };
}

export async function upsertChallengeTask(record: ChallengeRecord) {
  const task = await saveTask(challengeRecordToTaskDraft(record));
  if (record.status === 'paused') {
    await pauseTask(task.id);
  }
  if (record.status === 'cancelled' || record.status === 'completed') {
    await softDeleteTask(task.id);
  }
  return task;
}

export async function pauseChallengeTask(challengeId: string) {
  await pauseTask(challengeTaskId(challengeId));
}

export async function resumeChallengeTask(challengeId: string) {
  await resumeTask(challengeTaskId(challengeId));
}

export async function removeChallengeTask(challengeId: string) {
  await softDeleteTask(challengeTaskId(challengeId));
}

export async function endChallengeTask(challengeId: string) {
  await archiveTaskImmediately(challengeTaskId(challengeId));
}
