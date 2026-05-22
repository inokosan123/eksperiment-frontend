import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import NotificationSettings, { type NotificationMode } from '@/components/shared/NotificationSettings';
import TaskFrequencyEditor, { type TaskFrequency } from '@/components/shared/TaskFrequencyEditor';
import TaskTimeEditor, { type TaskDayTimes } from '@/components/shared/TaskTimeEditor';
import {
  buildPrayerChallengeConfig,
  ChallengePanel,
  defaultChallengeSchedule,
  prayerChallengeDetail,
  scriptureApproxDays,
  scriptureDailyAmountLabel,
  type ChallengeScheduleDraft,
  type JesusPrayerMode,
  type PrayerChallengeRuleChoice,
} from '@/components/shared/SetAsTaskSheet';
import {
  Book,
  BookMarked,
  CalendarCheck,
  CheckSmall,
  ChevronDown,
  Cross,
  Feather,
  Flame,
  Moon,
  Notebook,
  OpenBook,
  Play,
  Sparkles,
  Sun,
} from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import { useChallenges } from './ChallengesContext';
import { useTasks } from '@/components/tasks/TaskProvider';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { AnimatedProgressFill } from '@/components/shared/taskAnimations';

import {
  ChallengeCatalogEntry,
  type ChallengeChurchConfig,
  ChallengeIconKey,
  ChallengeRecord,
  ChallengeTab,
  type ChallengeCategory,
  TAB_ACTIVE_COLORS,
} from './challengeData';
import { StaticChallengeTrophy } from './ChallengeTrophy';

function getTone(category: ChallengeRecord['category'] | ChallengeCatalogEntry['category']) {
  switch (category) {
    case 'prayer':
      return {
        accent: '#C58A2D',
        soft: '#FFF7EA',
        border: '#F1D6A4',
        text: '#8B5E13',
        iconBg: '#FEF3D9',
      };
    case 'journal':
      return {
        accent: '#8B5CF6',
        soft: '#F5F1FF',
        border: '#DDD0FF',
        text: '#6D28D9',
        iconBg: '#EEE8FF',
      };
    case 'church':
      return {
        accent: '#2F8A62',
        soft: '#EEF9F2',
        border: '#CEEBDD',
        text: '#17603F',
        iconBg: '#E0F3E8',
      };
    case 'scripture':
    default:
      return {
        accent: '#C5A059',
        soft: '#FFFCF3',
        border: '#E9D8B1',
        text: '#8B6B2F',
        iconBg: '#F9EFD6',
      };
  }
}

function getCategoryBadge(category: ChallengeRecord['category'] | ChallengeCatalogEntry['category']) {
  switch (category) {
    case 'prayer':
      return { label: 'Prayer', text: '#C58A2D', bg: '#FFF6E8' };
    case 'journal':
      return { label: 'Journal', text: '#8B5CF6', bg: '#F4EEFF' };
    case 'church':
      return { label: 'Church', text: '#2F8A62', bg: '#EAF8F1' };
    case 'scripture':
    default:
      return { label: 'Scripture', text: '#2C9AEF', bg: '#EDF7FF' };
  }
}

function ChallengeIcon({
  icon,
  size = 18,
  color = C.gold,
}: {
  icon: ChallengeIconKey;
  size?: number;
  color?: string;
}) {
  switch (icon) {
    case 'sun':
      return <Sun s={size} c={color} />;
    case 'moon':
      return <Moon s={size} c={color} />;
    case 'sparkles':
      return <Sparkles s={size} c={color} />;
    case 'book':
      return <Book s={size} c={color} />;
    case 'openBook':
      return <OpenBook s={size} c={color} />;
    case 'bookMarked':
      return <BookMarked s={size} c={color} />;
    case 'calendarCheck':
      return <CalendarCheck s={size} c={color} />;
    case 'feather':
      return <Feather s={size} c={color} />;
    case 'notebook':
      return <Notebook s={size} c={color} />;
    case 'cross':
      return <Cross s={size} c={color} />;
    default:
      return <Book s={size} c={color} />;
  }
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return hex;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function dateValue(date?: string) {
  if (!date) return 0;
  const value = new Date(`${date}T12:00:00`).getTime();
  return Number.isFinite(value) ? value : 0;
}

function shortDateLabel(date?: string, fallback?: string) {
  if (!date) return fallback ?? 'Completed';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`));
}

function completionWord(count: number) {
  return count === 1 ? 'completion' : 'completions';
}

function completionMilestoneLabel(count: number) {
  if (count >= 100) return 'Century series';
  if (count >= 25) return 'Legacy run';
  if (count >= 10) return 'Tenfold victory';
  if (count >= 2) return 'Repeat victory';
  return 'First trophy';
}

function progressTotalFor(challenge: ChallengeRecord) {
  return challenge.progressTotal ?? challenge.durationDays ?? challenge.totalUnits ?? 0;
}

function progressPercentFor(challenge: ChallengeRecord) {
  const total = progressTotalFor(challenge);
  if (total <= 0) return 100;
  return Math.min(100, Math.round((challenge.progressCurrent / total) * 100));
}

function compareHistoryAttempts(a: ChallengeRecord, b: ChallengeRecord) {
  return dateValue(b.completedAt) - dateValue(a.completedAt);
}

function compareBestAttempt(a: ChallengeRecord, b: ChallengeRecord) {
  const streakDiff = (b.bestStreak ?? b.streak ?? 0) - (a.bestStreak ?? a.streak ?? 0);
  if (streakDiff !== 0) return streakDiff;
  const progressDiff = progressPercentFor(b) - progressPercentFor(a);
  if (progressDiff !== 0) return progressDiff;
  return compareHistoryAttempts(a, b);
}

function compareActiveChallengeCards(a: ChallengeRecord, b: ChallengeRecord) {
  const pctA = a.progressTotal && a.progressTotal > 0
    ? (a.progressCurrent / a.progressTotal) * 100
    : 0;
  const pctB = b.progressTotal && b.progressTotal > 0
    ? (b.progressCurrent / b.progressTotal) * 100
    : 0;
  if (pctB !== pctA) return pctB - pctA;
  return dateValue(b.startedAt) - dateValue(a.startedAt);
}

type ChallengeHistoryGroup = {
  templateId: string;
  title: string;
  category: ChallengeRecord['category'];
  attempts: ChallengeRecord[];
  latest: ChallengeRecord;
  best: ChallengeRecord;
};

function buildHistoryGroups(challenges: ChallengeRecord[]): ChallengeHistoryGroup[] {
  const groups = new Map<string, ChallengeRecord[]>();
  challenges.forEach(challenge => {
    const key = challenge.templateId || challenge.id;
    groups.set(key, [...(groups.get(key) ?? []), challenge]);
  });

  return [...groups.entries()]
    .map(([templateId, attempts]) => {
      const sortedAttempts = [...attempts].sort(compareHistoryAttempts);
      const best = [...attempts].sort(compareBestAttempt)[0] ?? sortedAttempts[0];
      const latest = sortedAttempts[0] ?? best;
      return {
        templateId,
        title: latest?.title ?? best?.title ?? 'Challenge',
        category: latest?.category ?? best?.category ?? 'scripture',
        attempts: sortedAttempts,
        latest,
        best,
      };
    })
    .sort((a, b) => dateValue(b.latest.completedAt) - dateValue(a.latest.completedAt));
}

type ChurchScheduleDraft = {
  frequency: TaskFrequency;
  selectedDays: number[];
  monthlyDays: number[];
  time: string;
  sameTimeEveryDay: boolean;
  dayTimes: TaskDayTimes;
  notificationMode: NotificationMode;
  reminderMinutes: number;
};

const CHURCH_DEFAULT_DAYS = [6];
const CHURCH_DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

function defaultChurchSchedule(time = '09:00'): ChurchScheduleDraft {
  return {
    frequency: 'specific_days',
    selectedDays: CHURCH_DEFAULT_DAYS,
    monthlyDays: [1],
    time,
    sameTimeEveryDay: true,
    dayTimes: {},
    notificationMode: 'single',
    reminderMinutes: 15,
  };
}

function churchActiveDayIndexes(schedule: ChurchScheduleDraft) {
  switch (schedule.frequency) {
    case 'weekdays':
      return [0, 1, 2, 3, 4];
    case 'weekends':
      return [5, 6];
    case 'specific_days':
      return schedule.selectedDays.length ? schedule.selectedDays : CHURCH_DEFAULT_DAYS;
    case 'daily':
    case 'monthly':
    default:
      return [0, 1, 2, 3, 4, 5, 6];
  }
}

function churchScheduleLabel(schedule: ChurchScheduleDraft) {
  switch (schedule.frequency) {
    case 'daily':
      return 'Daily';
    case 'weekdays':
      return 'Weekdays';
    case 'weekends':
      return 'Weekends';
    case 'monthly':
      return `Monthly ${schedule.monthlyDays.join(', ')}`;
    case 'specific_days': {
      const days = schedule.selectedDays.length ? schedule.selectedDays : CHURCH_DEFAULT_DAYS;
      if (days.length === 1 && days[0] === 6) return 'Every Sunday';
      return days.map(day => CHURCH_DAY_LABELS[day]).join(' / ');
    }
    default:
      return 'Every Sunday';
  }
}

function churchScheduleToConfig(schedule: ChurchScheduleDraft): ChallengeChurchConfig {
  return {
    frequency: schedule.frequency,
    selectedDays: schedule.frequency === 'specific_days'
      ? (schedule.selectedDays.length ? schedule.selectedDays : CHURCH_DEFAULT_DAYS)
      : [],
    monthlyDays: schedule.frequency === 'monthly' ? schedule.monthlyDays : [1],
    time: schedule.time,
    sameTimeEveryDay: schedule.sameTimeEveryDay,
    dayTimes: schedule.sameTimeEveryDay ? {} : schedule.dayTimes,
    notificationMode: schedule.notificationMode,
    reminderMinutes: schedule.notificationMode === 'double' ? schedule.reminderMinutes : undefined,
  };
}

function TabPill({
  active,
  label,
  color,
  onPress,
}: {
  active: boolean;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.84}
      style={[
        s.tabPill,
        active
          ? { backgroundColor: color, borderColor: color }
          : { backgroundColor: hexToRgba(color, 0.08), borderColor: hexToRgba(color, 0.18) },
      ]}
    >
      <Text style={[s.tabText, active ? s.tabTextActive : { color: hexToRgba(color, 0.72) }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function ChallengeLifecycleCard({
  challenge,
  onPress,
}: {
  challenge: ChallengeRecord;
  onPress: () => void;
}) {
  const badge = getCategoryBadge(challenge.category);
  const progress = challenge.progressTotal && challenge.progressTotal > 0
    ? Math.max(6, Math.round((challenge.progressCurrent / challenge.progressTotal) * 100))
    : 0;

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress}>
      <LinearGradient
        colors={['#FFFDF8', '#FFFFFF']}
        start={{ x: 0.02, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.lifecycleCard}
      >
        <View style={s.lifecycleTop}>
          <View style={s.lifecycleHeadLeft}>
            <View style={[s.categoryBadge, { backgroundColor: badge.bg }]}>
              <Text style={[s.categoryBadgeText, { color: badge.text }]}>{badge.label}</Text>
            </View>

            <Text style={s.lifecycleTitle}>{challenge.title}</Text>
          </View>

          <View style={s.lifecycleRight}>
            {challenge.streak > 0 ? (
              <View style={s.streakPill}>
                <Flame s={10} filled color="#F97316" />
                <Text style={s.streakText}>{challenge.streak}</Text>
              </View>
            ) : null}
            <ChevronDown s={14} c={C.textMuted} w={2.2} />
          </View>
        </View>

        <View style={s.lifecycleMetaRow}>
          <View style={s.lifecycleMetaLeft}>
            {challenge.time ? <Text style={s.lifecycleMeta}>{challenge.time}</Text> : null}
            {challenge.time ? <Text style={s.lifecycleMetaDot}>◊</Text> : null}
            <Text style={s.lifecycleMeta}>{challenge.headline}</Text>
          </View>
          <Text style={s.lifecyclePct}>{challenge.showBar && challenge.progressTotal ? `${progress}%` : challenge.scheduleLabel.toUpperCase()}</Text>
        </View>

        {challenge.showBar && challenge.progressTotal ? (
          <View style={s.progressTrack}>
            <LinearGradient
              colors={['#C5A059', '#E3C15D']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[s.progressFill, { width: `${progress}%` }]}
            />
          </View>
        ) : (
          <Text style={s.lifecycleChurchMeta}>{challenge.subline}</Text>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

export function CatalogEntryCard({
  entry,
  expanded,
  selectedPaceId,
  churchSchedule,
  onToggle,
  onSelectPace,
  onChurchScheduleChange,
  onStart,
}: {
  entry: ChallengeCatalogEntry;
  expanded: boolean;
  selectedPaceId?: string;
  churchSchedule?: ChurchScheduleDraft;
  onToggle: () => void;
  onSelectPace: (paceId: string) => void;
  onChurchScheduleChange?: (schedule: ChurchScheduleDraft) => void;
  onStart: () => void;
}) {
  const tone = getTone(entry.category);
  const showChurchSchedule = entry.category === 'church' && churchSchedule && onChurchScheduleChange;

  return (
    <View style={[s.catalogCard, { borderColor: tone.border, backgroundColor: '#FFFFFF' }]}>
      <TouchableOpacity activeOpacity={0.85} onPress={onToggle} style={s.catalogTop}>
        <View style={[s.catalogIconWrap, { backgroundColor: tone.iconBg }]}>
          <ChallengeIcon icon={entry.icon} size={17} color={tone.accent} />
        </View>

        <View style={s.catalogBody}>
          <Text style={s.catalogTitle}>{entry.title}</Text>
          <Text style={s.catalogDescription}>{entry.description}</Text>
        </View>

        <View style={[s.expandCircle, expanded ? { borderColor: tone.border, backgroundColor: tone.soft } : null]}>
          <ChevronDown s={15} c={tone.accent} w={2.2} />
        </View>
      </TouchableOpacity>

      {expanded ? (
        <View style={s.catalogExpanded}>
          <View style={[s.catalogDescriptor, { backgroundColor: tone.soft, borderColor: tone.border }]}>
            <Text style={[s.catalogDescriptorText, { color: tone.text }]}>{entry.descriptor}</Text>
            <Text style={s.catalogDescriptorMeta}>{entry.defaultTime || 'Anytime'} | {entry.scheduleLabel}</Text>
          </View>

          {entry.paceOptions?.length ? (
            <View style={s.paceWrap}>
              {entry.paceOptions.map(option => {
                const active = option.id === selectedPaceId;
                return (
                  <TouchableOpacity
                    key={option.id}
                    activeOpacity={0.84}
                    onPress={() => onSelectPace(option.id)}
                    style={[
                      s.paceChip,
                      active ? { borderColor: tone.accent, backgroundColor: tone.soft } : null,
                    ]}
                  >
                    <Text style={[s.paceChipTitle, active ? { color: tone.accent } : null]}>{option.label}</Text>
                    <Text style={s.paceChipCaption}>{option.caption}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}

          {showChurchSchedule ? (
            <View style={s.churchSetupStack}>
              <TaskFrequencyEditor
                frequency={churchSchedule.frequency}
                selectedDays={churchSchedule.selectedDays}
                monthlyDays={churchSchedule.monthlyDays}
                accent={tone.accent}
                label="Schedule"
                onFrequencyChange={frequency => onChurchScheduleChange({
                  ...churchSchedule,
                  frequency,
                  selectedDays: frequency === 'specific_days' && churchSchedule.selectedDays.length === 0
                    ? CHURCH_DEFAULT_DAYS
                    : churchSchedule.selectedDays,
                  monthlyDays: frequency === 'monthly' && churchSchedule.monthlyDays.length === 0
                    ? [1]
                    : churchSchedule.monthlyDays,
                  sameTimeEveryDay: frequency === 'monthly' ? true : churchSchedule.sameTimeEveryDay,
                })}
                onSelectedDaysChange={selectedDays => onChurchScheduleChange({
                  ...churchSchedule,
                  selectedDays: selectedDays.length ? selectedDays : CHURCH_DEFAULT_DAYS,
                })}
                onMonthlyDaysChange={monthlyDays => onChurchScheduleChange({
                  ...churchSchedule,
                  monthlyDays: monthlyDays.length ? monthlyDays : [1],
                })}
              />

              <View style={s.churchSetupBlock}>
                <TaskTimeEditor
                  time={churchSchedule.time}
                  sameTimeEveryDay={churchSchedule.sameTimeEveryDay}
                  dayTimes={churchSchedule.dayTimes}
                  activeDayIndexes={churchActiveDayIndexes(churchSchedule)}
                  accent={tone.accent}
                  softBg={tone.soft}
                  borderColor={tone.border}
                  mutedColor={C.textMuted}
                  allowPerDayTimes={churchSchedule.frequency !== 'monthly'}
                  onTimeChange={time => onChurchScheduleChange({ ...churchSchedule, time })}
                  onSameTimeEveryDayChange={sameTimeEveryDay => onChurchScheduleChange({
                    ...churchSchedule,
                    sameTimeEveryDay,
                  })}
                  onDayTimesChange={dayTimes => onChurchScheduleChange({ ...churchSchedule, dayTimes })}
                />
              </View>

              <NotificationSettings
                mode={churchSchedule.notificationMode}
                reminderMinutes={churchSchedule.reminderMinutes}
                accent={tone.accent}
                onModeChange={notificationMode => onChurchScheduleChange({ ...churchSchedule, notificationMode })}
                onReminderChange={reminderMinutes => onChurchScheduleChange({ ...churchSchedule, reminderMinutes })}
              />
            </View>
          ) : null}

          <TouchableOpacity
            activeOpacity={0.84}
            onPress={onStart}
            style={[s.startBtn, { backgroundColor: tone.accent }]}
          >
            <Play s={12} c="#FFFFFF" />
            <Text style={s.startBtnText}>START CHALLENGE</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

function HistoryCard({
  group,
}: {
  group: ChallengeHistoryGroup;
}) {
  const { width: viewportWidth } = useWindowDimensions();
  const { attempts, best, latest } = group;
  const tone = getTone(group.category);
  const badge = getCategoryBadge(group.category);
  const completionCount = attempts.length;
  const progressTotal = progressTotalFor(best);
  const progressPercent = progressPercentFor(best);
  const progressLabel = progressTotal > 0
    ? `${best.progressCurrent}/${progressTotal} ${best.progressUnit}`
    : best.headline;
  const bestStreak = best.bestStreak ?? best.streak;
  const shelfWidth = Math.max(220, viewportWidth - 80);
  const maxShelfTrophies = Math.max(4, Math.min(10, Math.floor((shelfWidth - 78) / 30) + 1));
  const shownTrophies = attempts.slice(0, Math.min(completionCount, maxShelfTrophies));
  const hiddenTrophies = Math.max(0, completionCount - shownTrophies.length);
  const recentAttempts = attempts.slice(0, 3);
  const milestoneLabel = completionMilestoneLabel(completionCount);
  const latestLabel = shortDateLabel(latest.completedAt, latest.endedLabel);
  const cardColors = [tone.soft, '#FFFFFF', '#FFFDF7'] as const;

  return (
    <LinearGradient
      colors={cardColors}
      start={{ x: 0.04, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        s.historyCard,
        s.historyCardCompleted,
        { borderColor: tone.border },
      ]}
    >
      <View style={s.historyShine} />
      <View style={[s.historyAccentRail, { backgroundColor: tone.accent }]} />
      <View style={[s.historyTopLine, { backgroundColor: hexToRgba(tone.accent, 0.3) }]} />
      <View style={s.historyTop}>
        <View style={s.historyTrophyStage}>
          <LinearGradient
            colors={['#FFFFFF', '#FFF0C2']}
            start={{ x: 0.18, y: 0 }}
            end={{ x: 0.86, y: 1 }}
            style={s.historyTrophyHalo}
          />
          <View style={s.historyTrophyBaseShadow} />
          <StaticChallengeTrophy size={70} />
          <View style={s.historyCountBadge}>
            <Text style={s.historyCountText}>x{completionCount}</Text>
          </View>
        </View>

        <View style={s.historyCopy}>
          <View style={s.historyBadgeRow}>
            <View style={[s.historyCategoryBadge, { backgroundColor: badge.bg }]}>
              <Text style={[s.historyCategoryText, { color: badge.text }]}>{badge.label}</Text>
            </View>
            <View style={[
              s.historyStateBadge,
              s.historyStateCompleted,
            ]}>
              <CheckSmall s={10} c={C.gold} />
              <Text style={[
                s.historyStateText,
                s.historyStateTextCompleted,
              ]}>
                Completed
              </Text>
            </View>
          </View>
          <Text style={s.historyTitle}>{group.title}</Text>
          <Text style={s.historyFoot}>
            {completionCount} {completionWord(completionCount)} | Latest {latestLabel}
          </Text>
        </View>
      </View>

      <View style={[s.seriesPlaque, { borderColor: hexToRgba(tone.accent, 0.2) }]}>
        <View style={[s.seriesPlaqueMark, { backgroundColor: tone.accent }]} />
        <View style={s.seriesPlaqueCopy}>
          <Text style={[s.seriesPlaqueLabel, { color: tone.text }]}>{milestoneLabel}</Text>
          <Text style={s.seriesPlaqueText} numberOfLines={1}>
            {best.id === latest.id ? 'Latest run is also the best run' : `Best saved from ${shortDateLabel(best.completedAt, best.endedLabel)}`}
          </Text>
        </View>
      </View>

      <Text style={s.historyBody}>
        {completionCount === 1
          ? 'Finished with momentum. This is the first trophy in the series.'
          : `Finished ${completionCount} times. Best run is highlighted below, with every trophy kept on the shelf.`}
      </Text>

      <View style={s.trophyShelf}>
        <View style={s.trophyShelfRail} />
        {shownTrophies.map((attempt, index) => (
          <View
            key={attempt.id}
            style={[
              s.shelfTrophy,
              attempt.id === best.id && s.shelfTrophyBest,
              index > 0 && { marginLeft: -6 },
            ]}
          >
            <StaticChallengeTrophy size={24} />
          </View>
        ))}
        {hiddenTrophies > 0 ? (
          <View style={[s.shelfMore, shownTrophies.length > 0 && { marginLeft: -2 }]}>
            <Text style={s.shelfMoreText}>+{hiddenTrophies}</Text>
          </View>
        ) : null}
      </View>

      <View style={s.historyMetaRow}>
        <View style={s.historyMetric}>
          <Text style={s.historyMetricLabel}>BEST RUN</Text>
          <Text style={s.historyProgressText}>{progressLabel}</Text>
        </View>
        <View style={s.historyMetric}>
          <Text style={s.historyMetricLabel}>BEST STREAK</Text>
          <View style={s.historyStreakPill}>
            <Flame s={10} filled color="#F97316" />
            <Text style={s.historyStreakText}>{bestStreak || 0}</Text>
          </View>
        </View>
        <View style={s.historyMetric}>
          <Text style={s.historyMetricLabel}>LATEST</Text>
          <Text style={s.historyProgressText}>{latestLabel}</Text>
        </View>
      </View>

      {recentAttempts.length > 1 ? (
        <View style={s.attemptStack}>
          {recentAttempts.map((attempt, index) => {
            const isBest = attempt.id === best.id;
            return (
              <View key={attempt.id} style={s.attemptRow}>
                <View style={[s.attemptDot, isBest && { backgroundColor: tone.accent }]} />
                <Text style={s.attemptText} numberOfLines={1}>
                  {index === 0 ? 'Latest' : `Run ${completionCount - index}`} | {shortDateLabel(attempt.completedAt, attempt.endedLabel)}
                </Text>
                {isBest ? <Text style={[s.attemptBest, { color: tone.accent }]}>BEST</Text> : null}
              </View>
            );
          })}
        </View>
      ) : null}

      <View style={s.historyProgressTrack}>
        <AnimatedProgressFill percent={Math.max(100, progressPercent)} color={tone.accent} height={5} />
      </View>
    </LinearGradient>
  );
}

type PanelChallengeContext = ChallengeCategory;
const PANEL_CONTEXTS: PanelChallengeContext[] = ['prayer', 'scripture', 'journal', 'church'];

function isPanelChallengeContext(value: ChallengeTab): value is PanelChallengeContext {
  return value === 'prayer' || value === 'scripture' || value === 'journal' || value === 'church';
}

export default function ChallengesView() {
  const {
    activeChallenges,
    pausedChallenges,
    completedChallenges,
    availableCatalogEntries,
    pauseChallenge,
    resumeChallenge,
    endChallenge,
    startChallenge,
    updateChallenge,
    refreshChallenges,
  } = useChallenges();
  const { refresh: refreshTasks } = useTasks();
  const [activeTab, setActiveTab] = useState<ChallengeTab>('active');
  const [selectedCatalog, setSelectedCatalog] = useState<ChallengeCatalogEntry | null>(null);
  const [selectedPaceId, setSelectedPaceId] = useState<string | null>(null);
  const [challengeSchedule, setChallengeSchedule] = useState<ChallengeScheduleDraft>(defaultChallengeSchedule('08:00'));
  const [scriptureDailyAmount, setScriptureDailyAmount] = useState(1);
  const [challengePrayerRule, setChallengePrayerRule] = useState<PrayerChallengeRuleChoice>('personal');
  const [challengeJesusMode, setChallengeJesusMode] = useState<JesusPrayerMode>('duration');
  const [challengeJesusDuration, setChallengeJesusDuration] = useState('15');
  const [challengeJesusCount, setChallengeJesusCount] = useState('100');
  const [churchSchedule, setChurchSchedule] = useState<ChurchScheduleDraft>(defaultChurchSchedule());
  const [expandedChallengeId, setExpandedChallengeId] = useState<string | null>(null);
  const [recentlyStartedTemplateId, setRecentlyStartedTemplateId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void refreshChallenges();
      void refreshTasks();
    }, [refreshChallenges, refreshTasks]),
  );

  const ongoingChallenges = useMemo(
    () => [...activeChallenges, ...pausedChallenges],
    [activeChallenges, pausedChallenges],
  );
  const historyCount = completedChallenges.length;
  const historyGroups = useMemo(() => buildHistoryGroups(completedChallenges), [completedChallenges]);
  const activeLifecycleChallenges = useMemo(
    () => PANEL_CONTEXTS.flatMap(context => [...activeChallenges]
      .filter(item => item.category === context)
      .sort(compareActiveChallengeCards)),
    [activeChallenges],
  );
  const pausedLifecycleChallenges = useMemo(
    () => PANEL_CONTEXTS.flatMap(context => pausedChallenges.filter(item => item.category === context)),
    [pausedChallenges],
  );
  const onlyPausedOnActiveTab = activeTab === 'active'
    && activeChallenges.length === 0
    && pausedChallenges.length > 0;

  const tabs: { key: ChallengeTab; label: string }[] = [
    { key: 'active', label: `ACTIVE (${ongoingChallenges.length})` },
    { key: 'prayer', label: 'PRAYER' },
    { key: 'scripture', label: 'SCRIPTURE' },
    { key: 'journal', label: 'JOURNAL' },
    { key: 'church', label: 'CHURCH' },
    { key: 'history', label: `HISTORY (${historyCount})` },
  ];

  const openUnifiedChallengeSetup = (entry: ChallengeCatalogEntry) => {
    setExpandedChallengeId(null);
    if (selectedCatalog?.id === entry.id) {
      setSelectedCatalog(null);
      setSelectedPaceId(null);
      return;
    }

    setSelectedCatalog(entry);
    setSelectedPaceId(entry.paceOptions?.[0]?.id ?? null);
    setChallengeSchedule(defaultChallengeSchedule(entry.defaultTime ?? '08:00'));
    setScriptureDailyAmount(1);
    setChallengePrayerRule('personal');
    setChallengeJesusMode('duration');
    setChallengeJesusDuration('15');
    setChallengeJesusCount('100');
    if (entry.category === 'church') {
      setChurchSchedule(defaultChurchSchedule(entry.defaultTime ?? '09:00'));
    }
  };

  const startUnifiedChallenge = async () => {
    if (!selectedCatalog) return;
    const selectedPace = selectedCatalog.paceOptions?.find(option => option.id === selectedPaceId)
      ?? selectedCatalog.paceOptions?.[0]
      ?? null;

    if (selectedCatalog.category === 'church') {
      const record = await startChallenge(selectedCatalog.id, selectedPace, {
        time: churchSchedule.time,
        scheduleLabel: churchScheduleLabel(churchSchedule),
        churchConfig: churchScheduleToConfig(churchSchedule),
      });
      await refreshTasks();
      setRecentlyStartedTemplateId(record?.templateId ?? selectedCatalog.templateId);
      setSelectedCatalog(null);
      setExpandedChallengeId(null);
      setTimeout(() => setRecentlyStartedTemplateId(null), 700);
      return;
    }

    if (selectedCatalog.category === 'scripture') {
      const chaptersPerDay = selectedCatalog.id === 'lectionary_daily' ? 0 : Math.max(1, scriptureDailyAmount);
      const totalDays = selectedCatalog.id === 'lectionary_daily'
        ? 365
        : scriptureApproxDays(selectedCatalog, chaptersPerDay) || 1;
      const record = await startChallenge(selectedCatalog.id, null, {
        title: selectedCatalog.id === 'lectionary_daily' ? `${selectedCatalog.title} - 365 Days` : selectedCatalog.title,
        time: challengeSchedule.time,
        scheduleLabel: selectedCatalog.scheduleLabel,
        paceLabel: selectedCatalog.id === 'lectionary_daily'
          ? undefined
          : scriptureDailyAmountLabel(selectedCatalog, chaptersPerDay),
        durationDays: totalDays,
        progressTotal: selectedCatalog.id === 'lectionary_daily' ? 0 : totalDays,
        progressUnit: 'days',
        headline: selectedCatalog.id === 'lectionary_daily' ? 'Day 1' : `Day 1 of ${totalDays}`,
        subline: selectedCatalog.id === 'lectionary_daily'
          ? 'Church-calendar daily readings'
          : `0/${totalDays} days completed`,
        showBar: selectedCatalog.id !== 'lectionary_daily',
        totalUnits: selectedCatalog.totalUnits ?? 0,
        scriptureConfig: {
          chaptersPerDay,
          time: challengeSchedule.time,
          sameTimeEveryDay: challengeSchedule.sameTimeEveryDay,
          dayTimes: challengeSchedule.sameTimeEveryDay ? {} : challengeSchedule.dayTimes,
          notificationMode: challengeSchedule.notificationMode,
          reminderMinutes: challengeSchedule.notificationMode === 'double' ? challengeSchedule.reminderMinutes : undefined,
        },
      });
      await refreshTasks();
      setRecentlyStartedTemplateId(record?.templateId ?? selectedCatalog.templateId);
      setSelectedCatalog(null);
      setExpandedChallengeId(null);
      setTimeout(() => setRecentlyStartedTemplateId(null), 700);
      return;
    }

    const prayerDetail = prayerChallengeDetail(
      selectedCatalog,
      challengePrayerRule,
      challengeJesusMode,
      challengeJesusDuration,
      challengeJesusCount,
    );
    const prayerConfig = buildPrayerChallengeConfig(
      selectedCatalog,
      challengePrayerRule,
      challengeJesusMode,
      challengeJesusDuration,
      challengeJesusCount,
      challengeSchedule,
    );
    const paceLabel = selectedCatalog.category === 'prayer'
      ? [selectedPace?.label, prayerDetail].filter(Boolean).join(' · ')
      : selectedPace?.label;

    const record = await startChallenge(selectedCatalog.id, selectedPace, {
      time: challengeSchedule.time,
      scheduleLabel: selectedCatalog.scheduleLabel,
      paceLabel,
      prayerConfig: selectedCatalog.category === 'prayer' ? prayerConfig : undefined,
    });
    await refreshTasks();
    setRecentlyStartedTemplateId(record?.templateId ?? selectedCatalog.templateId);
    setSelectedCatalog(null);
    setExpandedChallengeId(null);
    setTimeout(() => setRecentlyStartedTemplateId(null), 700);
  };

  const renderUnifiedPanel = (
    context: PanelChallengeContext,
    includeAvailable = true,
    options?: {
      includeActive?: boolean;
      includePaused?: boolean;
      showActiveLabel?: boolean;
      showPausedLabel?: boolean;
    },
  ) => {
    const includeActive = options?.includeActive ?? true;
    const includePaused = options?.includePaused ?? true;
    const activeItems = includeActive
      ? [...activeChallenges]
          .filter(item => item.category === context)
          .sort((a, b) => {
            const pctA = a.progressTotal && a.progressTotal > 0
              ? (a.progressCurrent / a.progressTotal) * 100 : 0;
            const pctB = b.progressTotal && b.progressTotal > 0
              ? (b.progressCurrent / b.progressTotal) * 100 : 0;
            return pctB - pctA;
          })
      : [];
    const pausedItems = includePaused ? pausedChallenges.filter(item => item.category === context) : [];
    const availableItems = includeAvailable
      ? availableCatalogEntries.filter(item => item.category === context)
      : [];

    if (!includeAvailable && activeItems.length === 0 && pausedItems.length === 0) return null;

    return (
      <ChallengePanel
        context={context}
        activeItems={activeItems}
        pausedItems={pausedItems}
        availableItems={availableItems}
        selectedCatalog={selectedCatalog}
        selectedPaceId={selectedPaceId}
        challengeSchedule={challengeSchedule}
        scriptureDailyAmount={scriptureDailyAmount}
        challengePrayerRule={challengePrayerRule}
        challengeJesusMode={challengeJesusMode}
        challengeJesusDuration={challengeJesusDuration}
        challengeJesusCount={challengeJesusCount}
        churchSchedule={churchSchedule}
        expandedChallengeId={expandedChallengeId}
        recentlyStartedTemplateId={recentlyStartedTemplateId}
        showActiveLabel={options?.showActiveLabel ?? includeAvailable}
        showPausedLabel={options?.showPausedLabel ?? true}
        onOpenSetup={openUnifiedChallengeSetup}
        onSelectedPaceIdChange={setSelectedPaceId}
        onChallengeScheduleChange={setChallengeSchedule}
        onScriptureDailyAmountChange={setScriptureDailyAmount}
        onChallengePrayerRuleChange={setChallengePrayerRule}
        onChallengeJesusModeChange={setChallengeJesusMode}
        onChallengeJesusDurationChange={setChallengeJesusDuration}
        onChallengeJesusCountChange={setChallengeJesusCount}
        onChurchScheduleChange={setChurchSchedule}
        onStartChallenge={startUnifiedChallenge}
        onExpandedChallengeChange={setExpandedChallengeId}
        onPauseChallenge={async id => {
          await pauseChallenge(id);
          await refreshTasks();
        }}
        onResumeChallenge={async id => {
          await resumeChallenge(id);
          await refreshTasks();
        }}
        onEndChallenge={async id => {
          await endChallenge(id);
          await refreshTasks();
        }}
        onUpdateChallenge={async (id, updates) => {
          await updateChallenge(id, updates);
          await refreshTasks();
        }}
      />
    );
  };

  const renderLifecyclePanel = (
    activeItems: ChallengeRecord[],
    pausedItems: ChallengeRecord[],
  ) => (
    <ChallengePanel
      context="scripture"
      activeItems={activeItems}
      pausedItems={pausedItems}
      availableItems={[]}
      selectedCatalog={selectedCatalog}
      selectedPaceId={selectedPaceId}
      challengeSchedule={challengeSchedule}
      scriptureDailyAmount={scriptureDailyAmount}
      challengePrayerRule={challengePrayerRule}
      challengeJesusMode={challengeJesusMode}
      challengeJesusDuration={challengeJesusDuration}
      challengeJesusCount={challengeJesusCount}
      churchSchedule={churchSchedule}
      expandedChallengeId={expandedChallengeId}
      recentlyStartedTemplateId={recentlyStartedTemplateId}
      showActiveLabel={false}
      showPausedLabel={false}
      onOpenSetup={openUnifiedChallengeSetup}
      onSelectedPaceIdChange={setSelectedPaceId}
      onChallengeScheduleChange={setChallengeSchedule}
      onScriptureDailyAmountChange={setScriptureDailyAmount}
      onChallengePrayerRuleChange={setChallengePrayerRule}
      onChallengeJesusModeChange={setChallengeJesusMode}
      onChallengeJesusDurationChange={setChallengeJesusDuration}
      onChallengeJesusCountChange={setChallengeJesusCount}
      onChurchScheduleChange={setChurchSchedule}
      onStartChallenge={startUnifiedChallenge}
      onExpandedChallengeChange={setExpandedChallengeId}
      onPauseChallenge={async id => {
        await pauseChallenge(id);
        await refreshTasks();
      }}
      onResumeChallenge={async id => {
        await resumeChallenge(id);
        await refreshTasks();
      }}
      onEndChallenge={async id => {
        await endChallenge(id);
        await refreshTasks();
      }}
      onUpdateChallenge={async (id, updates) => {
        await updateChallenge(id, updates);
        await refreshTasks();
      }}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenTitleBar title="CHALLENGES" showBack />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.tabsScroll}
        contentContainerStyle={s.tabsRow}
      >
        {tabs.map(tab => (
          <TabPill
            key={tab.key}
            active={tab.key === activeTab}
            label={tab.label}
            color={TAB_ACTIVE_COLORS[tab.key]}
            onPress={() => {
              setActiveTab(tab.key);
              setExpandedChallengeId(null);
              setSelectedCatalog(null);
            }}
          />
        ))}
      </ScrollView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.scrollContent, onlyPausedOnActiveTab && s.scrollContentOnlyPaused]}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'active' ? (
          <View style={s.sectionStack}>
            {activeChallenges.length === 0 && pausedChallenges.length === 0 ? (
              <View style={s.emptyWrap}>
                <Text style={s.emptyTitle}>No active challenges</Text>
                <Text style={s.emptyBody}>Pick a category above and start your next rule.</Text>
              </View>
            ) : null}

            {activeChallenges.length > 0 ? (
              <Text style={[s.sectionLabel, { color: '#10B981' }]}>ACTIVE</Text>
            ) : null}

            {activeLifecycleChallenges.length > 0
              ? renderLifecyclePanel(activeLifecycleChallenges, [])
              : null}

            {pausedChallenges.length > 0 ? (
              <Text style={[s.sectionLabel, { color: '#A8A29E' }]}>PAUSED</Text>
            ) : null}

            {pausedLifecycleChallenges.length > 0
              ? renderLifecyclePanel([], pausedLifecycleChallenges)
              : null}

          </View>
        ) : null}

        {isPanelChallengeContext(activeTab) ? (
          <View style={s.sectionStack}>
            {renderUnifiedPanel(activeTab, true)}
          </View>
        ) : null}

        {activeTab === 'history' ? (
          <View style={s.sectionStack}>
            {completedChallenges.length > 0 ? (
              <View style={s.sectionBlock}>
                <Text style={[s.sectionLabel, { color: C.gold }]}>ACHIEVEMENTS</Text>
                {historyGroups.map(group => (
                  <HistoryCard key={group.templateId} group={group} />
                ))}
              </View>
            ) : null}

            {completedChallenges.length === 0 ? (
              <View style={s.emptyWrap}>
                <Text style={s.emptyTitle}>No history yet</Text>
                <Text style={s.emptyBody}>Successfully completed challenges will live here.</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 128,
    paddingTop: 10,
  },
  scrollContentOnlyPaused: {
    paddingTop: 4,
  },
  tabsScroll: {
    flexGrow: 0,
    maxHeight: 52,
  },
  tabsRow: {
    gap: 8,
    paddingHorizontal: 18,
    paddingBottom: 8,
    alignItems: 'center',
  },
  tabPill: {
    flexShrink: 0,
    alignSelf: 'center',
    minHeight: 34,
    borderRadius: 17,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#EEE8DA',
    backgroundColor: '#F7F4ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontFamily: F.sansBold,
    fontSize: 9.8,
    letterSpacing: 1.5,
    color: '#B4AE9F',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  sectionStack: {
    gap: 14,
  },
  sectionBlock: {
    gap: 8,
  },
  sectionLabel: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2.4,
    color: C.textMuted,
    marginLeft: 2,
  },
  groupBlock: {
    gap: 8,
  },
  groupLabel: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2.4,
    color: C.gold,
    marginLeft: 2,
    marginTop: 6,
  },
  emptyWrap: {
    paddingVertical: 56,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  emptyTitle: {
    fontFamily: F.serifMedium,
    fontSize: 24,
    color: C.text,
  },
  emptyBody: {
    marginTop: 6,
    fontFamily: F.sans,
    fontSize: 12,
    lineHeight: 18,
    color: C.textMuted,
    textAlign: 'center',
  },
  lifecycleCard: {
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderColor: C.gold,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 9,
    paddingBottom: 11,
    shadowColor: '#B6913D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 3,
  },
  lifecycleTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  lifecycleHeadLeft: {
    flex: 1,
    minWidth: 0,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 999,
    marginBottom: 7,
  },
  categoryBadgeText: {
    fontFamily: F.sansBold,
    fontSize: 8.5,
    lineHeight: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  lifecycleTitle: {
    fontFamily: F.serifMedium,
    fontSize: 19,
    color: C.text,
    lineHeight: 24,
  },
  lifecycleRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FFF2E8',
  },
  streakText: {
    fontFamily: F.sansBold,
    fontSize: 10.5,
    color: '#B45309',
  },
  lifecycleMetaRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  lifecycleMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  lifecycleMeta: {
    fontFamily: F.sansMedium,
    fontSize: 10.5,
    color: '#AAA397',
  },
  lifecycleMetaDot: {
    fontFamily: F.sansBold,
    fontSize: 10,
    color: '#D8D2C5',
    marginTop: -1,
  },
  lifecyclePct: {
    fontFamily: F.sansBold,
    fontSize: 10,
    color: '#C5A059',
  },
  progressTrack: {
    marginTop: 10,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#F3EEE2',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  lifecycleChurchMeta: {
    marginTop: 10,
    fontFamily: F.sansMedium,
    fontSize: 11,
    color: '#AAA397',
  },
  catalogCard: {
    borderWidth: 1,
    borderRadius: 24,
    overflow: 'hidden',
  },
  catalogTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  catalogIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catalogBody: {
    flex: 1,
    minWidth: 0,
  },
  catalogTitle: {
    fontFamily: F.serifMedium,
    fontSize: 16,
    color: C.text,
  },
  catalogDescription: {
    marginTop: 2,
    fontFamily: F.sans,
    fontSize: 12,
    lineHeight: 18,
    color: C.textSecondary,
  },
  expandCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#EEEAE1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catalogExpanded: {
    borderTopWidth: 1,
    borderTopColor: '#F3EFE7',
    padding: 14,
    gap: 12,
  },
  catalogDescriptor: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  catalogDescriptorText: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  catalogDescriptorMeta: {
    marginTop: 4,
    fontFamily: F.sans,
    fontSize: 12,
    color: C.textSecondary,
  },
  paceWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paceChip: {
    minWidth: 92,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EEEAE1',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FCFCFA',
  },
  paceChipTitle: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: C.text,
    textTransform: 'uppercase',
  },
  paceChipCaption: {
    marginTop: 3,
    fontFamily: F.sans,
    fontSize: 11,
    color: C.textMuted,
  },
  churchSetupStack: {
    gap: 14,
  },
  churchSetupBlock: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#F0E5CE',
    backgroundColor: '#FFFDF8',
    padding: 14,
  },
  startBtn: {
    minHeight: 48,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  startBtnText: {
    fontFamily: F.sansBold,
    fontSize: 10.5,
    letterSpacing: 2.1,
    color: '#FFFFFF',
  },
  historyCard: {
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderRadius: 28,
    padding: 17,
    paddingTop: 18,
    backgroundColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.13,
    shadowRadius: 24,
    elevation: 5,
    overflow: 'hidden',
  },
  historyCardCompleted: {
    backgroundColor: '#FFFDF8',
    shadowColor: '#C5A059',
  },
  historyCardEnded: {
    backgroundColor: '#FFFDFD',
    shadowColor: '#EF4444',
  },
  historyTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    zIndex: 1,
  },
  historyShine: {
    position: 'absolute',
    top: -44,
    right: -24,
    width: 180,
    height: 108,
    borderRadius: 54,
    backgroundColor: 'rgba(255, 222, 122, 0.22)',
    transform: [{ rotate: '-12deg' }],
  },
  historyAccentRail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    opacity: 0.95,
  },
  historyTopLine: {
    position: 'absolute',
    left: 18,
    right: 18,
    top: 0,
    height: 1,
  },
  historyTrophyStage: {
    width: 82,
    height: 82,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyTrophyHalo: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.20)',
    shadowColor: '#C5A059',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 2,
    transform: [{ rotate: '-4deg' }],
  },
  historyTrophyBaseShadow: {
    position: 'absolute',
    bottom: 5,
    width: 58,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(104,72,24,0.10)',
  },
  historyCountBadge: {
    position: 'absolute',
    right: -4,
    bottom: 4,
    minWidth: 34,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.92)',
    backgroundColor: '#1C1917',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  historyCountText: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 0.4,
    color: '#FFFFFF',
  },
  historyIconBubble: {
    width: 42,
    height: 42,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyCopy: {
    flex: 1,
    minWidth: 0,
  },
  historyBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  historyCategoryBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  historyCategoryText: {
    fontFamily: F.sansBold,
    fontSize: 8,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  historyStateBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  historyStateCompleted: {
    borderColor: 'rgba(197,160,89,0.18)',
    backgroundColor: '#FFF8E8',
  },
  historyStateEnded: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  historyStateText: {
    fontFamily: F.sansBold,
    fontSize: 8,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  historyStateTextCompleted: {
    color: C.gold,
  },
  historyStateTextEnded: {
    color: '#EF4444',
  },
  historyTitle: {
    fontFamily: F.serifMedium,
    fontSize: 18,
    lineHeight: 23,
    color: C.text,
  },
  seriesPlaque: {
    marginTop: 14,
    minHeight: 54,
    borderRadius: 19,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.64)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    zIndex: 1,
  },
  seriesPlaqueMark: {
    width: 6,
    height: 34,
    borderRadius: 3,
  },
  seriesPlaqueCopy: {
    flex: 1,
    minWidth: 0,
  },
  seriesPlaqueLabel: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 1.9,
    textTransform: 'uppercase',
  },
  seriesPlaqueText: {
    marginTop: 3,
    fontFamily: F.serif,
    fontSize: 13,
    lineHeight: 17,
    color: '#6F665B',
  },
  historyBody: {
    marginTop: 13,
    fontFamily: F.serif,
    fontSize: 14,
    lineHeight: 20,
    color: C.textSecondary,
    zIndex: 1,
  },
  trophyShelf: {
    marginTop: 14,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    paddingHorizontal: 5,
    zIndex: 1,
  },
  trophyShelfRail: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 6,
    height: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(197,160,89,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.12)',
  },
  shelfTrophy: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.16)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  shelfTrophyBest: {
    borderColor: '#C5A059',
    backgroundColor: '#FFF7D6',
    shadowColor: '#C5A059',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  shelfMore: {
    minWidth: 42,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(28,25,23,0.08)',
    backgroundColor: '#1C1917',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  shelfMoreText: {
    fontFamily: F.sansBold,
    fontSize: 10,
    color: '#FFFFFF',
  },
  historyFoot: {
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 1.6,
    color: C.textMuted,
    textTransform: 'uppercase',
  },
  historyMetaRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    zIndex: 1,
  },
  historyMetric: {
    flex: 1,
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.16)',
    backgroundColor: 'rgba(255,255,255,0.76)',
    paddingHorizontal: 9,
    paddingVertical: 9,
    justifyContent: 'center',
  },
  historyStreakMetric: {
    flex: 0.72,
  },
  historyMetricLabel: {
    fontFamily: F.sansBold,
    fontSize: 7.5,
    letterSpacing: 1.4,
    color: '#B8A783',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  historyProgressText: {
    fontFamily: F.sansBold,
    fontSize: 8.5,
    lineHeight: 12,
    letterSpacing: 1.2,
    color: '#9A7A3F',
    textTransform: 'uppercase',
  },
  historyStreakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  historyStreakText: {
    fontFamily: F.sansBold,
    fontSize: 10,
    color: '#F97316',
  },
  attemptStack: {
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.14)',
    backgroundColor: 'rgba(255,255,255,0.62)',
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 7,
    zIndex: 1,
  },
  attemptRow: {
    minHeight: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  attemptDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D8D2C5',
  },
  attemptText: {
    flex: 1,
    fontFamily: F.sansMedium,
    fontSize: 10,
    lineHeight: 14,
    color: '#8A8177',
  },
  attemptBest: {
    fontFamily: F.sansBold,
    fontSize: 8,
    letterSpacing: 1.2,
  },
  historyProgressTrack: {
    marginTop: 12,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#F1ECE2',
    overflow: 'hidden',
    zIndex: 1,
  },
  historyProgressFill: {
    height: '100%',
    borderRadius: 999,
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 28,
  },
  sheetHandle: {
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#E9E2D4',
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sheetTitle: {
    flex: 1,
    fontFamily: F.serifMedium,
    fontSize: 28,
    color: C.text,
  },
  closeCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F7F4EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBody: {
    marginTop: 6,
    fontFamily: F.sans,
    fontSize: 13,
    lineHeight: 19,
    color: C.textSecondary,
  },
  actionGrid: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 10,
  },
  actionCard: {
    flex: 1,
    minHeight: 78,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#EDE7DA',
    backgroundColor: '#FFFCF5',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  actionLabel: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 1.8,
    color: C.gold,
    textTransform: 'uppercase',
  },
  endBtn: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FFF5F5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  endBtnText: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2,
    color: '#DC2626',
  },
  formLabel: {
    marginTop: 16,
    marginBottom: 8,
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2.2,
    color: C.textMuted,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    minWidth: 88,
    minHeight: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#EDE7DA',
    backgroundColor: '#FCFBF8',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  presetChipActive: {
    borderColor: C.gold,
    backgroundColor: C.goldBg,
  },
  presetChipText: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: C.textSecondary,
    textTransform: 'uppercase',
  },
  presetChipTextActive: {
    color: C.goldDark,
  },
  saveBtn: {
    marginTop: 18,
    minHeight: 48,
    borderRadius: 22,
    backgroundColor: C.text,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveBtnText: {
    fontFamily: F.sansBold,
    fontSize: 10.5,
    letterSpacing: 2,
    color: '#FFFFFF',
  },
});
