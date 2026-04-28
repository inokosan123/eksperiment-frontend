import React, { createContext, useContext, useMemo, useState } from 'react';
import {
  CATALOG_ENTRIES,
  ChallengeCatalogEntry,
  ChallengePrayerConfig,
  ChallengeRecord,
  ChallengeScriptureConfig,
  ChallengeStatus,
  GROUP_ORDER,
  INITIAL_CHALLENGES,
  PaceOption,
} from './challengeData';

type ChallengeScheduleUpdate = {
  time?: string;
  scheduleLabel?: string;
  paceLabel?: string;
  prayerConfig?: ChallengePrayerConfig;
};

type ChallengeStartOverrides = {
  time?: string;
  scheduleLabel?: string;
  paceLabel?: string;
  title?: string;
  description?: string;
  progressCurrent?: number;
  progressTotal?: number;
  progressUnit?: string;
  headline?: string;
  subline?: string;
  showBar?: boolean;
  streak?: number;
  totalUnits?: number;
  durationDays?: number;
  scriptureConfig?: ChallengeScriptureConfig;
  prayerConfig?: ChallengePrayerConfig;
};

type ChallengesContextValue = {
  challenges: ChallengeRecord[];
  activeChallenges: ChallengeRecord[];
  pausedChallenges: ChallengeRecord[];
  completedChallenges: ChallengeRecord[];
  cancelledChallenges: ChallengeRecord[];
  catalogEntries: ChallengeCatalogEntry[];
  availableCatalogEntries: ChallengeCatalogEntry[];
  startChallenge: (entryId: string, pace?: PaceOption | null, overrides?: ChallengeStartOverrides) => void;
  updateChallenge: (id: string, updates: ChallengeScheduleUpdate) => void;
  pauseChallenge: (id: string) => void;
  resumeChallenge: (id: string) => void;
  endChallenge: (id: string) => void;
};

const ChallengesContext = createContext<ChallengesContextValue | null>(null);

function todayLabel(prefix: 'Completed' | 'Ended') {
  const formatter = new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
  });
  return `${prefix} ${formatter.format(new Date())}`;
}

function buildScriptureChallengeFromSetup(
  entry: ChallengeCatalogEntry,
  overrides: ChallengeStartOverrides,
): ChallengeRecord {
  const chaptersPerDay = entry.id === 'lectionary_daily'
    ? 0
    : Math.max(1, overrides.scriptureConfig?.chaptersPerDay || 1);
  const totalUnits = overrides.totalUnits ?? entry.totalUnits ?? 0;
  const totalDays = entry.id === 'lectionary_daily'
    ? (overrides.durationDays ?? 365)
    : Math.max(1, overrides.durationDays ?? Math.ceil(totalUnits / chaptersPerDay));
  const isPsalter = entry.groupKey === 'psalter';

  return {
    id: `${entry.id}_${Date.now()}`,
    templateId: entry.templateId,
    title: overrides.title ?? entry.title,
    description: overrides.description ?? entry.description,
    category: entry.category,
    groupKey: entry.groupKey,
    icon: entry.icon,
    status: 'active',
    progressCurrent: overrides.progressCurrent ?? 0,
    progressTotal: overrides.progressTotal ?? (entry.id === 'lectionary_daily' ? 0 : totalDays),
    progressUnit: overrides.progressUnit ?? 'days',
    headline: overrides.headline ?? (entry.id === 'lectionary_daily' ? 'Day 1' : `Day 1 of ${totalDays}`),
    subline: overrides.subline ?? (entry.id === 'lectionary_daily' ? 'Church-calendar daily readings' : `0/${totalDays} days completed`),
    showBar: overrides.showBar ?? (entry.id !== 'lectionary_daily'),
    streak: overrides.streak ?? 0,
    time: overrides.time ?? overrides.scriptureConfig?.time ?? entry.defaultTime,
    scheduleLabel: overrides.scheduleLabel ?? entry.scheduleLabel,
    paceLabel: overrides.paceLabel ?? (
      entry.id === 'lectionary_daily'
        ? undefined
        : `${chaptersPerDay} ${isPsalter ? (chaptersPerDay === 1 ? 'psalm/day' : 'psalms/day') : (chaptersPerDay === 1 ? 'chapter/day' : 'chapters/day')}`
    ),
    totalUnits,
    durationDays: totalDays,
    scriptureConfig: overrides.scriptureConfig,
  };
}

function buildNewChallenge(entry: ChallengeCatalogEntry, pace?: PaceOption | null, overrides?: ChallengeStartOverrides): ChallengeRecord {
  if (entry.category === 'scripture' && overrides?.scriptureConfig) {
    return buildScriptureChallengeFromSetup(entry, overrides);
  }

  const paceLabel = pace?.label;

  switch (entry.groupKey) {
    case 'church':
      {
        const base: ChallengeRecord = {
          id: `${entry.id}_${Date.now()}`,
          templateId: entry.templateId,
          title: entry.title,
          description: entry.description,
          category: entry.category,
          groupKey: entry.groupKey,
          icon: entry.icon,
          status: 'active',
          progressCurrent: 0,
          progressTotal: 0,
          progressUnit: 'weeks',
          headline: 'Week 1',
          subline: 'Sunday rhythm begins this week',
          showBar: false,
          streak: 0,
          time: entry.defaultTime,
          scheduleLabel: entry.scheduleLabel,
          paceLabel,
        };
        return overrides ? { ...base, ...overrides } : base;
      }
    case 'prayer':
    case 'journal':
      {
        const totalDays = Number.parseInt(pace?.id || '30', 10) || 30;
        const base: ChallengeRecord = {
          id: `${entry.id}_${Date.now()}`,
          templateId: entry.templateId,
          title: entry.title,
          description: entry.description,
          category: entry.category,
          groupKey: entry.groupKey,
          icon: entry.icon,
          status: 'active',
          progressCurrent: 0,
          progressTotal: totalDays,
          progressUnit: 'days',
          headline: `Day 1 of ${totalDays}`,
          subline: 'Fresh start',
          showBar: true,
          streak: 0,
          time: entry.defaultTime,
          scheduleLabel: entry.scheduleLabel,
          paceLabel,
        };
        return overrides ? { ...base, ...overrides } : base;
      }
    case 'psalter':
      {
        const totalDays = Number.parseInt(pace?.id || '40', 10) || 40;
        const base: ChallengeRecord = {
          id: `${entry.id}_${Date.now()}`,
          templateId: entry.templateId,
          title: paceLabel ? `${paceLabel} Psalter` : entry.title,
          description: entry.description,
          category: entry.category,
          groupKey: entry.groupKey,
          icon: entry.icon,
          status: 'active',
          progressCurrent: 0,
          progressTotal: totalDays,
          progressUnit: 'days',
          headline: `0 of ${totalDays} days`,
          subline: 'Daily psalter rhythm',
          showBar: true,
          streak: 0,
          time: entry.defaultTime,
          scheduleLabel: entry.scheduleLabel,
          paceLabel,
        };
        return overrides ? { ...base, ...overrides } : base;
      }
    case 'lectionary':
      {
        const base: ChallengeRecord = {
          id: `${entry.id}_${Date.now()}`,
          templateId: entry.templateId,
          title: entry.title,
          description: entry.description,
          category: entry.category,
          groupKey: entry.groupKey,
          icon: entry.icon,
          status: 'active',
          progressCurrent: 0,
          progressTotal: 0,
          progressUnit: 'readings',
          headline: 'Today starts fresh',
          subline: 'Church-calendar daily readings',
          showBar: false,
          streak: 0,
          time: entry.defaultTime,
          scheduleLabel: entry.scheduleLabel,
          paceLabel,
        };
        return overrides ? { ...base, ...overrides } : base;
      }
    default:
      {
        const totalChapters = entry.totalUnits ?? (
          entry.groupKey === 'new_testament'
            ? 260
            : entry.groupKey === 'old_testament'
              ? 929
              : 89
        );
        const base: ChallengeRecord = {
          id: `${entry.id}_${Date.now()}`,
          templateId: entry.templateId,
          title: entry.title,
          description: entry.description,
          category: entry.category,
          groupKey: entry.groupKey,
          icon: entry.icon,
          status: 'active',
          progressCurrent: 0,
          progressTotal: totalChapters,
          progressUnit: 'chapters',
          headline: `0 of ${totalChapters} chapters`,
          subline: 'Structured reading plan',
          showBar: true,
          streak: 0,
          time: entry.defaultTime,
          scheduleLabel: entry.scheduleLabel,
          paceLabel,
          totalUnits: totalChapters,
        };
        return overrides ? { ...base, ...overrides } : base;
      }
  }
}

function setStatus(items: ChallengeRecord[], id: string, status: ChallengeStatus, endedPrefix?: 'Completed' | 'Ended') {
  return items.map(item => item.id === id ? {
    ...item,
    status,
    endedLabel: endedPrefix ? todayLabel(endedPrefix) : item.endedLabel,
  } : item);
}

export function ChallengesProvider({ children }: { children: React.ReactNode }) {
  const [challenges, setChallenges] = useState<ChallengeRecord[]>(INITIAL_CHALLENGES);

  const value = useMemo<ChallengesContextValue>(() => {
    const activeChallenges = challenges.filter(item => item.status === 'active');
    const pausedChallenges = challenges.filter(item => item.status === 'paused');
    const completedChallenges = challenges.filter(item => item.status === 'completed');
    const cancelledChallenges = challenges.filter(item => item.status === 'cancelled');
    const ongoingTemplateIds = new Set(
      challenges
        .filter(item => item.status === 'active' || item.status === 'paused')
        .map(item => item.templateId),
    );
    const availableCatalogEntries = [...CATALOG_ENTRIES]
      .filter(entry => !ongoingTemplateIds.has(entry.templateId))
      .sort((a, b) => {
        const groupDiff = GROUP_ORDER.indexOf(a.groupKey) - GROUP_ORDER.indexOf(b.groupKey);
        if (groupDiff !== 0) return groupDiff;
        return a.title.localeCompare(b.title);
      });

    return {
      challenges,
      activeChallenges,
      pausedChallenges,
      completedChallenges,
      cancelledChallenges,
      catalogEntries: CATALOG_ENTRIES,
      availableCatalogEntries,
      startChallenge: (entryId, pace, overrides) => {
        const entry = CATALOG_ENTRIES.find(item => item.id === entryId);
        if (!entry) return;
        setChallenges(current => [buildNewChallenge(entry, pace, overrides), ...current]);
      },
      updateChallenge: (id, updates) => {
        setChallenges(current => current.map(item => item.id === id ? { ...item, ...updates } : item));
      },
      pauseChallenge: id => {
        setChallenges(current => setStatus(current, id, 'paused'));
      },
      resumeChallenge: id => {
        setChallenges(current => setStatus(current, id, 'active'));
      },
      endChallenge: id => {
        setChallenges(current => setStatus(current, id, 'cancelled', 'Ended'));
      },
    };
  }, [challenges]);

  return (
    <ChallengesContext.Provider value={value}>
      {children}
    </ChallengesContext.Provider>
  );
}

export function useChallenges() {
  const context = useContext(ChallengesContext);
  if (!context) {
    throw new Error('useChallenges must be used inside ChallengesProvider');
  }
  return context;
}
