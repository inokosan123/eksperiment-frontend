import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  deleteChallengeRecord,
  listChallengeRecords,
  markChurchWeeksPractice,
  repairChurchChallengeState,
  saveChallengeRecord,
} from '@/components/challenges/challengeDb';
import {
  endChallengeTask,
  pauseChallengeTask,
  resumeChallengeTask,
  upsertChallengeTask,
} from '@/components/challenges/challengeTaskSync';
import {
  CATALOG_ENTRIES,
  ChallengeCatalogEntry,
  ChallengeChurchConfig,
  ChallengePrayerConfig,
  ChallengeRecord,
  ChallengeScriptureConfig,
  PaceOption,
  compareChallengeCatalogEntries,
} from './challengeData';
import {
  getScriptureChallengeProgressUnit,
  getScriptureChallengeTotal,
  getScriptureChallengeUnitLabel,
  getScriptureChallengeUnits,
} from '@/components/scripture/scriptureChallengePlan';

type ChallengeScheduleUpdate = {
  time?: string;
  scheduleLabel?: string;
  paceLabel?: string;
  prayerConfig?: ChallengePrayerConfig;
  churchConfig?: ChallengeChurchConfig;
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
  churchConfig?: ChallengeChurchConfig;
};

type ChallengesContextValue = {
  ready: boolean;
  challenges: ChallengeRecord[];
  activeChallenges: ChallengeRecord[];
  pausedChallenges: ChallengeRecord[];
  completedChallenges: ChallengeRecord[];
  cancelledChallenges: ChallengeRecord[];
  catalogEntries: ChallengeCatalogEntry[];
  availableCatalogEntries: ChallengeCatalogEntry[];
  refreshChallenges: () => Promise<void>;
  startChallenge: (entryId: string, pace?: PaceOption | null, overrides?: ChallengeStartOverrides) => Promise<ChallengeRecord | null>;
  updateChallenge: (id: string, updates: ChallengeScheduleUpdate) => Promise<void>;
  pauseChallenge: (id: string) => Promise<void>;
  resumeChallenge: (id: string) => Promise<void>;
  endChallenge: (id: string) => Promise<void>;
};

function churchRequirementKey(config?: ChallengeChurchConfig) {
  if (!config) return '';
  return JSON.stringify({
    frequency: config.frequency,
    selectedDays: [...(config.selectedDays ?? [])].sort((left, right) => left - right),
    monthlyDays: [...(config.monthlyDays ?? [])].sort((left, right) => left - right),
  });
}

const ChallengesContext = createContext<ChallengesContextValue | null>(null);

function newChallengeId(entryId: string) {
  return `${entryId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildScriptureChallengeFromSetup(
  entry: ChallengeCatalogEntry,
  overrides: ChallengeStartOverrides,
): ChallengeRecord {
  const chaptersPerDay = entry.id === 'lectionary_daily'
    ? 0
    : Math.max(1, overrides.scriptureConfig?.chaptersPerDay || 1);
  const totalUnits = overrides.totalUnits ?? entry.totalUnits ?? 0;
  const planKey = {
    templateId: entry.templateId,
    groupKey: entry.groupKey,
    totalUnits,
    progressTotal: overrides.progressTotal,
  };
  const plannedTotal = getScriptureChallengeTotal(planKey);
  const planUnits = getScriptureChallengeUnits(planKey);
  const progressUnit = getScriptureChallengeProgressUnit(planKey);
  const progressLabel = getScriptureChallengeUnitLabel(planKey, 2);
  const totalDays = entry.id === 'lectionary_daily'
    ? (overrides.durationDays ?? 365)
    : Math.max(1, overrides.durationDays ?? Math.ceil((plannedTotal || totalUnits) / chaptersPerDay));
  const isPsalter = entry.groupKey === 'psalter';

  return {
    id: newChallengeId(entry.id),
    templateId: entry.templateId,
    title: overrides.title ?? entry.title,
    description: overrides.description ?? entry.description,
    category: entry.category,
    groupKey: entry.groupKey,
    icon: entry.icon,
    status: 'active',
    progressCurrent: overrides.progressCurrent ?? 0,
    progressTotal: overrides.progressTotal ?? (entry.id === 'lectionary_daily' ? totalDays : plannedTotal),
    progressUnit: overrides.progressUnit ?? progressUnit,
    headline: overrides.headline ?? (entry.id === 'lectionary_daily' ? 'Day 1' : `0/${plannedTotal} ${progressLabel}`),
    subline: overrides.subline ?? (entry.id === 'lectionary_daily' ? 'Church-calendar daily readings' : (planUnits[0] ? `Next: ${planUnits[0].ref}` : `0/${plannedTotal} ${progressLabel} completed`)),
    showBar: overrides.showBar ?? (entry.id !== 'lectionary_daily'),
    streak: overrides.streak ?? 0,
    time: overrides.time ?? overrides.scriptureConfig?.time ?? entry.defaultTime,
    scheduleLabel: overrides.scheduleLabel ?? entry.scheduleLabel,
    paceLabel: overrides.paceLabel ?? (
      entry.id === 'lectionary_daily'
        ? undefined
        : `${chaptersPerDay} ${isPsalter ? (chaptersPerDay === 1 ? 'psalm/day' : 'psalms/day') : (chaptersPerDay === 1 ? 'chapter/day' : 'chapters/day')}`
    ),
    totalUnits: plannedTotal || totalUnits,
    durationDays: totalDays,
    startedAt: getTodayDateKey(),
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
          id: newChallengeId(entry.id),
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
          startedAt: getTodayDateKey(),
          churchConfig: overrides?.churchConfig,
        };
        return overrides ? { ...base, ...overrides } : base;
      }
    case 'prayer':
    case 'journal':
      {
        const totalDays = Number.parseInt(pace?.id || '30', 10) || 30;
        const base: ChallengeRecord = {
          id: newChallengeId(entry.id),
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
          startedAt: getTodayDateKey(),
        };
        return overrides ? { ...base, ...overrides } : base;
      }
    case 'psalter':
      {
        const totalDays = Number.parseInt(pace?.id || '40', 10) || 40;
        const base: ChallengeRecord = {
          id: newChallengeId(entry.id),
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
          startedAt: getTodayDateKey(),
        };
        return overrides ? { ...base, ...overrides } : base;
      }
    case 'lectionary':
      {
        const base: ChallengeRecord = {
          id: newChallengeId(entry.id),
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
          startedAt: getTodayDateKey(),
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
          id: newChallengeId(entry.id),
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
          startedAt: getTodayDateKey(),
        };
        return overrides ? { ...base, ...overrides } : base;
      }
  }
}

function getTodayDateKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function ChallengesProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [challenges, setChallenges] = useState<ChallengeRecord[]>([]);
  const startingTemplateIdsRef = useRef(new Set<string>());

  const refreshChallenges = useCallback(async () => {
    await repairChurchChallengeState();
    const records = await listChallengeRecords();
    setChallenges(records);
    setReady(true);
  }, []);

  useEffect(() => {
    refreshChallenges().catch(error => {
      console.warn('Challenge backend refresh failed:', error);
      setReady(true);
    });
  }, [refreshChallenges]);

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
      .sort(compareChallengeCatalogEntries);

    return {
      ready,
      challenges,
      activeChallenges,
      pausedChallenges,
      completedChallenges,
      cancelledChallenges,
      catalogEntries: CATALOG_ENTRIES,
      availableCatalogEntries,
      refreshChallenges,
      startChallenge: async (entryId, pace, overrides) => {
        const entry = CATALOG_ENTRIES.find(item => item.id === entryId);
        if (!entry) return null;

        const existing = challenges.find(item => (
          item.templateId === entry.templateId &&
          (item.status === 'active' || item.status === 'paused')
        ));
        if (existing) return existing;
        if (startingTemplateIdsRef.current.has(entry.templateId)) return null;

        startingTemplateIdsRef.current.add(entry.templateId);
        try {
          const persistedRecords = await listChallengeRecords();
          const persistedExisting = persistedRecords.find(item => (
            item.templateId === entry.templateId &&
            (item.status === 'active' || item.status === 'paused')
          ));
          if (persistedExisting) {
            setChallenges(persistedRecords);
            return persistedExisting;
          }

          const saved = await saveChallengeRecord(buildNewChallenge(entry, pace, overrides));
          await upsertChallengeTask(saved);
          const refreshed = await listChallengeRecords();
          const next = refreshed.find(item => item.id === saved.id) ?? saved;
          setChallenges(refreshed);
          return next;
        } finally {
          startingTemplateIdsRef.current.delete(entry.templateId);
        }
      },
      updateChallenge: async (id, updates) => {
        const current = challenges.find(item => item.id === id);
        if (!current) return;
        const churchScheduleChanged = current.category === 'church'
          && !!updates.churchConfig
          && churchRequirementKey(updates.churchConfig) !== churchRequirementKey(current.churchConfig);
        if (churchScheduleChanged) {
          await markChurchWeeksPractice(current, getTodayDateKey());
        }
        const saved = await saveChallengeRecord({ ...current, ...updates });
        await upsertChallengeTask(saved);
        const refreshed = await listChallengeRecords();
        setChallenges(refreshed);
      },
      pauseChallenge: async id => {
        const current = challenges.find(item => item.id === id);
        if (!current) return;
        if (current.category === 'church') {
          await markChurchWeeksPractice(current, getTodayDateKey());
        }
        await saveChallengeRecord({
          ...current,
          status: 'paused',
          pausedAt: getTodayDateKey(),
        });
        await pauseChallengeTask(id);
        const refreshed = await listChallengeRecords();
        setChallenges(refreshed);
      },
      resumeChallenge: async id => {
        const current = challenges.find(item => item.id === id);
        if (!current) return;
        if (current.category === 'church' && current.pausedAt) {
          await markChurchWeeksPractice(current, current.pausedAt, getTodayDateKey());
        }
        await saveChallengeRecord({
          ...current,
          status: 'active',
          pausedAt: undefined,
        });
        await resumeChallengeTask(id);
        const refreshed = await listChallengeRecords();
        setChallenges(refreshed);
      },
      endChallenge: async id => {
        const current = challenges.find(item => item.id === id);
        if (!current) return;
        await endChallengeTask(id);
        await deleteChallengeRecord(id);
        setChallenges(items => items.filter(item => item.id !== id));
      },
    };
  }, [ready, challenges, refreshChallenges]);

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
