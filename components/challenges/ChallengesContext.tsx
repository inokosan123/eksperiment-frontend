import React, { createContext, useContext, useMemo, useState } from 'react';
import {
  CATALOG_ENTRIES,
  ChallengeCatalogEntry,
  ChallengeRecord,
  ChallengeStatus,
  GROUP_ORDER,
  INITIAL_CHALLENGES,
  PaceOption,
} from './challengeData';

type ChallengeScheduleUpdate = {
  time?: string;
  scheduleLabel?: string;
  paceLabel?: string;
};

type ChallengesContextValue = {
  challenges: ChallengeRecord[];
  activeChallenges: ChallengeRecord[];
  pausedChallenges: ChallengeRecord[];
  completedChallenges: ChallengeRecord[];
  cancelledChallenges: ChallengeRecord[];
  catalogEntries: ChallengeCatalogEntry[];
  availableCatalogEntries: ChallengeCatalogEntry[];
  startChallenge: (entryId: string, pace?: PaceOption | null) => void;
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

function buildNewChallenge(entry: ChallengeCatalogEntry, pace?: PaceOption | null): ChallengeRecord {
  const paceLabel = pace?.label;

  switch (entry.groupKey) {
    case 'church':
      return {
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
    case 'prayer':
    case 'journal':
      return {
        id: `${entry.id}_${Date.now()}`,
        templateId: entry.templateId,
        title: entry.title,
        description: entry.description,
        category: entry.category,
        groupKey: entry.groupKey,
        icon: entry.icon,
        status: 'active',
        progressCurrent: 0,
        progressTotal: Number.parseInt(pace?.id || '30', 10) || 30,
        progressUnit: 'days',
        headline: `Day 1 of ${Number.parseInt(pace?.id || '30', 10) || 30}`,
        subline: 'Fresh start',
        showBar: true,
        streak: 0,
        time: entry.defaultTime,
        scheduleLabel: entry.scheduleLabel,
        paceLabel,
      };
    case 'psalter':
      return {
        id: `${entry.id}_${Date.now()}`,
        templateId: entry.templateId,
        title: paceLabel ? `${paceLabel} Psalter` : entry.title,
        description: entry.description,
        category: entry.category,
        groupKey: entry.groupKey,
        icon: entry.icon,
        status: 'active',
        progressCurrent: 0,
        progressTotal: Number.parseInt(pace?.id || '40', 10) || 40,
        progressUnit: 'days',
        headline: `0 of ${Number.parseInt(pace?.id || '40', 10) || 40} days`,
        subline: 'Daily psalter rhythm',
        showBar: true,
        streak: 0,
        time: entry.defaultTime,
        scheduleLabel: entry.scheduleLabel,
        paceLabel,
      };
    case 'lectionary':
      return {
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
    default:
      return {
        id: `${entry.id}_${Date.now()}`,
        templateId: entry.templateId,
        title: entry.title,
        description: entry.description,
        category: entry.category,
        groupKey: entry.groupKey,
        icon: entry.icon,
        status: 'active',
        progressCurrent: 0,
        progressTotal: entry.groupKey === 'new_testament'
          ? 260
          : entry.groupKey === 'old_testament'
            ? 929
            : 89,
        progressUnit: 'chapters',
        headline: `0 of ${entry.groupKey === 'new_testament' ? 260 : entry.groupKey === 'old_testament' ? 929 : 89} chapters`,
        subline: 'Structured reading plan',
        showBar: true,
        streak: 0,
        time: entry.defaultTime,
        scheduleLabel: entry.scheduleLabel,
        paceLabel,
      };
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
      startChallenge: (entryId, pace) => {
        const entry = CATALOG_ENTRIES.find(item => item.id === entryId);
        if (!entry) return;
        setChallenges(current => [buildNewChallenge(entry, pace), ...current]);
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
