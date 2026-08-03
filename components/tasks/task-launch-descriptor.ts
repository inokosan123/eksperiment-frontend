import type {
  JournalTaskRoute,
  PrayerTaskConfig,
  TaskInstance,
  TaskLaunchConfigBundle,
  TaskLaunchDescriptor,
} from '@/components/tasks/taskTypes';

function positiveWholeNumber(value: unknown) {
  const numeric = typeof value === 'number'
    ? value
    : Number.parseInt(String(value ?? '').trim(), 10);
  if (!Number.isFinite(numeric) || numeric <= 0) return undefined;
  return Math.round(numeric);
}

function inferPlannedCount(instance: TaskInstance, configuredCount?: number) {
  const fromConfig = positiveWholeNumber(configuredCount);
  if (fromConfig) return fromConfig;

  const label = `${instance.title ?? ''} ${instance.subtitle ?? ''}`;
  const countMatch = label.match(/\b(\d{1,2})\s*(?:chapter|chapters|psalm|psalms)\b/i)
    ?? label.match(/\b(?:chapter|chapters|psalm|psalms)\s*(?:per\s*day|\/day)?\D{0,8}(\d{1,2})\b/i);
  return positiveWholeNumber(countMatch?.[1]) ?? 1;
}

function journalRoute(instance: TaskInstance, technique?: string): JournalTaskRoute {
  if (
    instance.targetView === '/journal-daily'
    || instance.targetView === '/journal-morning'
    || instance.targetView === '/journal-free'
  ) return instance.targetView;
  if (technique === 'morning_pages') return '/journal-morning';
  if (technique === 'free_writing') return '/journal-free';
  return '/journal-daily';
}

function isPersonalRule(config?: PrayerTaskConfig) {
  return config?.prayerTaskKind === 'personal_rule' || config?.prayerRule === 'personal';
}

function isJesusPrayer(config?: PrayerTaskConfig) {
  return config?.prayerTaskKind === 'jesus_prayer' || config?.prayerType === 'jesus';
}

function prayerOptionId(config?: PrayerTaskConfig) {
  switch (config?.prayerRule) {
    case 'seraphim': return 'short';
    case 'short': return 'medium';
    case 'breakfast':
    case 'lunch':
    case 'dinner':
      return config.prayerRule;
    default:
      return 'standard';
  }
}

function legacyPrayerCategory(instance: TaskInstance) {
  const label = `${instance.title} ${instance.subtitle ?? ''}`.toLowerCase();
  if (label.includes('evening') || label.includes('vesper')) return 'evening' as const;
  if (label.includes('meal') || label.includes('breakfast') || label.includes('lunch') || label.includes('dinner')) {
    return 'meal' as const;
  }
  return 'morning' as const;
}

export function resolveTaskLaunchDescriptor(
  instance: TaskInstance,
  config: TaskLaunchConfigBundle | undefined,
): TaskLaunchDescriptor | undefined {
  if (instance.source === 'gratitude' || instance.type === 'gratitude') {
    return { kind: 'gratitude' };
  }

  if (instance.type === 'journal' || instance.targetView?.startsWith('/journal')) {
    return {
      kind: 'journal',
      route: journalRoute(instance, config?.journal?.technique ?? config?.journal?.journalType),
    };
  }

  if (instance.source === 'reading_book' || instance.taskId.startsWith('reading_book_')) {
    return {
      kind: 'readingSession',
      bookId: config?.readingBook?.bookId ?? instance.taskId.slice('reading_book_'.length),
    };
  }

  if (instance.source === 'challenge' && instance.type === 'reading') {
    return config?.scripture?.readingType === 'church_calendar'
      ? { kind: 'directCompletion' }
      : { kind: 'scriptureChallenge' };
  }

  if (instance.source === 'spiritual' && instance.type === 'reading') {
    return {
      kind: 'scriptureCheckpoint',
      plannedCount: inferPlannedCount(instance, config?.scripture?.chaptersPerDay),
    };
  }

  if (instance.type !== 'prayer' || (instance.source !== 'spiritual' && instance.source !== 'challenge')) {
    return undefined;
  }

  const prayer = config?.prayer;
  if (isJesusPrayer(prayer) || instance.targetView === '/jesus-prayer') {
    return {
      kind: 'jesusPrayer',
      mode: prayer?.jesusPrayerMode === 'count' ? 'count' : 'duration',
      duration: positiveWholeNumber(prayer?.jesusPrayerDuration) ?? 15,
      count: positiveWholeNumber(prayer?.jesusPrayerCount) ?? 100,
    };
  }

  if ((isPersonalRule(prayer) && prayer?.prayerType !== 'meal') || instance.targetView === '/personal-rule') {
    return { kind: 'personalRule', prayerType: prayer?.prayerType ?? '' };
  }

  const category = prayer?.prayerType === 'morning'
    || prayer?.prayerType === 'evening'
    || prayer?.prayerType === 'meal'
    ? prayer.prayerType
    : legacyPrayerCategory(instance);
  return {
    kind: 'guidedPrayer',
    category,
    optionId: prayerOptionId(prayer),
  };
}
