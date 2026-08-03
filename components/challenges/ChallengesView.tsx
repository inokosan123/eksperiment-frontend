import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, {
  Easing,
  FadeInDown,
  FadeInLeft,
  FadeInRight,
  FadeOutUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
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
import {
  notifyGuideEvent,
  useGuidedSetup,
  useGuideTarget,
} from '@/components/onboarding/guided/GuidedSetupContext';

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

const TROPHY_EMBLEM = require('@/assets/animations/challenge-trophy-preview.png');
// The flame Home and the progress calendar already burn for a streak.
const FLAME_PNG = require('@/assets/images/streak-flame-512.png');

function progressTotalFor(challenge: ChallengeRecord) {
  return challenge.progressTotal ?? challenge.durationDays ?? challenge.totalUnits ?? 0;
}

function compareHistoryAttempts(a: ChallengeRecord, b: ChallengeRecord) {
  return dateValue(b.completedAt) - dateValue(a.completedAt);
}

/**
 * How long a finished run took, in days.
 *
 * Only meaningful once a run is complete, and only when both ends are known —
 * an attempt saved before startedAt existed returns null and is judged on its
 * streak instead.
 */
function runLengthDays(record: ChallengeRecord): number | null {
  if (!record.startedAt || !record.completedAt) return null;
  const start = dateValue(record.startedAt);
  const end = dateValue(record.completedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  // Same-day finish counts as one day, not zero.
  return Math.max(1, Math.round((end - start) / 86400000) + 1);
}

/**
 * The best run is the FASTEST one.
 *
 * Progress cannot rank these: every attempt in the history is a completed one,
 * and you only get the trophy by finishing every chapter — so all of them read
 * 21/21. What separates them is how long it took to get there, so the best run
 * is the one that reached the trophy in the fewest days. Runs whose length
 * cannot be worked out fall back to the longest streak, then to the most
 * recent, so a group always has a best.
 */
function compareBestAttempt(a: ChallengeRecord, b: ChallengeRecord) {
  const lenA = runLengthDays(a);
  const lenB = runLengthDays(b);
  if (lenA !== null && lenB !== null && lenA !== lenB) return lenA - lenB;
  if (lenA !== null && lenB === null) return -1;
  if (lenA === null && lenB !== null) return 1;

  const streakDiff = (b.bestStreak ?? b.streak ?? 0) - (a.bestStreak ?? a.streak ?? 0);
  if (streakDiff !== 0) return streakDiff;
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
  const selectedProgress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    selectedProgress.value = withSpring(active ? 1 : 0, {
      damping: 19,
      stiffness: 250,
      mass: 0.72,
      overshootClamping: true,
    });
  }, [active, selectedProgress]);

  const motionStyle = useAnimatedStyle(() => ({
    opacity: 0.9 + selectedProgress.value * 0.1,
    transform: [{ scale: 0.975 + selectedProgress.value * 0.025 }],
  }));

  return (
    <Reanimated.View style={[s.tabPillMotion, motionStyle]}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.84}
        style={[
          s.tabPill,
          active
            ? {
              backgroundColor: color,
              borderColor: hexToRgba(color, 0.88),
              boxShadow: `0 3px 9px ${hexToRgba(color, 0.2)}`,
            }
            : {
              backgroundColor: hexToRgba(color, 0.075),
              borderColor: hexToRgba(color, 0.2),
              boxShadow: `0 1px 4px ${hexToRgba(color, 0.065)}`,
            },
        ]}
      >
        {active ? <View pointerEvents="none" style={s.tabPillGlaze} /> : null}
        <View style={s.tabPillInner}>
          <View style={[s.tabPillDot, { backgroundColor: active ? '#FFFFFF' : hexToRgba(color, 0.58) }]} />
          <Text style={[s.tabText, active ? s.tabTextActive : { color: hexToRgba(color, 0.76) }]}>{label}</Text>
        </View>
      </TouchableOpacity>
    </Reanimated.View>
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
  const churchWeek = challenge.category === 'church' ? challenge.churchWeek : undefined;
  const churchWeekLabel = churchWeek?.status === 'earned'
    ? 'Week complete'
    : churchWeek?.status === 'missed'
      ? 'No trophy this week'
      : churchWeek?.status === 'practice'
        ? 'Practice week'
        : `${churchWeek?.completedCount ?? 0}/${churchWeek?.requiredCount ?? 0} visits complete`;

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

        {churchWeek ? (
          <View style={s.churchWeekRow}>
            <View style={s.churchWeekTrophy}>
              <StaticChallengeTrophy size={38} />
            </View>
            <View style={s.churchWeekCopy}>
              <Text style={s.churchWeekTitle}>{churchWeekLabel}</Text>
              <Text style={[s.lifecycleChurchMeta, s.churchWeekSub]} numberOfLines={2}>{challenge.subline}</Text>
            </View>
            <View style={s.churchTrophyCount}>
              <Text style={s.churchTrophyCountText}>×{challenge.churchTrophyCount ?? 0}</Text>
            </View>
          </View>
        ) : challenge.showBar && challenge.progressTotal ? (
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
                allowedFrequencies={['daily', 'weekdays', 'weekends', 'specific_days']}
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

// One trophy's footprint on the rail, and the air between two of them.
const TRACK_SLOT_W = 34;
const TRACK_SLOT_GAP = 2;
const TRACK_ROW_PAD = 2;

/**
 * The trophy track — the shelf, kept, with its overflow fixed.
 *
 * It used to lay out a fixed number of overlapping trophies from a width
 * guess, cap at ten, and print "+30" for everything past that. Then it
 * scrolled sideways, which showed everything but hid it behind a gesture
 * nothing on the card announced: a full shelf and an overfull one looked
 * identical, so you could not tell there was more without dragging it.
 *
 * It shelves now. A row is filled left to right — oldest first, because a
 * timeline runs forwards — and when a row is full the next one opens beneath
 * it and fills the same way. Every trophy is in view at once, the series' own
 * size is the thing you see first, and the best one still stands proud of its
 * rail on a lit plinth wherever it happens to fall.
 */
function TrophyTrack({
  attempts,
  best,
  tone,
}: {
  attempts: ChallengeHistoryGroup['attempts'];
  best: ChallengeRecord;
  tone: ReturnType<typeof getTone>;
}) {
  // How many stand on one shelf depends on how wide the card is drawn, which
  // only layout knows. Until it reports, the trophies are laid out but held
  // invisible for the one frame it takes — never on a shelf that is wrong.
  const [perRow, setPerRow] = useState(0);

  const rows = useMemo(() => {
    // Oldest first: the track is a timeline, and a timeline runs forwards.
    const ordered = [...attempts].reverse();
    if (perRow <= 0) return [ordered];
    const out: ChallengeHistoryGroup['attempts'][] = [];
    for (let i = 0; i < ordered.length; i += perRow) {
      out.push(ordered.slice(i, i + perRow));
    }
    return out;
  }, [attempts, perRow]);

  const measure = useCallback((width: number) => {
    const usable = width - TRACK_ROW_PAD * 2;
    const fit = Math.floor(
      (usable + TRACK_SLOT_GAP) / (TRACK_SLOT_W + TRACK_SLOT_GAP),
    );
    const next = Math.max(1, fit);
    setPerRow(current => (current === next ? current : next));
  }, []);

  return (
    <View
      style={s.track}
      onLayout={event => measure(event.nativeEvent.layout.width)}
    >
      <View style={perRow > 0 ? undefined : s.trackMeasuring}>
        {rows.map((row, rowIndex) => (
          <View key={`row-${rowIndex}`} style={s.trackRow}>
            <View style={[s.trackRail, { backgroundColor: hexToRgba(tone.accent, 0.18) }]} />
            {/* A shelf that fills is left-aligned by filling. A lone short
                shelf would read as a row shoved to one side, so on its own it
                sits centred — the way the track has always looked when the
                series is small. Once it wraps, every row starts at the left,
                and the gap at the end of the last one is simply the room the
                next victory will take. */}
            <View style={[s.trackSlots, rows.length === 1 && s.trackSlotsAlone]}>
              {row.map(attempt => {
                const isBest = attempt.id === best.id;
                return (
                  <View key={attempt.id} style={s.trackSlot}>
                    {isBest && (
                      <View style={[s.trackBestGlow, { backgroundColor: hexToRgba(tone.accent, 0.16) }]} />
                    )}
                    <Image
                      source={TROPHY_EMBLEM}
                      resizeMode="contain"
                      style={isBest ? s.trackImgBest : s.trackImg}
                    />
                    {isBest && <View style={[s.trackBestPlinth, { backgroundColor: tone.accent }]} />}
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * One of the three figures under the track. They were three boxed tiles whose
 * values were set in 8.5pt tracked capitals — a label's voice used for a
 * reading. The box is gone, the figure is serif and large, and a hairline
 * divides one from the next.
 */
function StatCell({
  label,
  value,
  tone,
  children,
}: {
  label: string;
  value?: string;
  tone: ReturnType<typeof getTone>;
  children?: React.ReactNode;
}) {
  return (
    <View style={s.statCell}>
      <Text style={[s.statLabel, { color: tone.accent }]} numberOfLines={1}>{label}</Text>
      {children ?? (
        <Text style={s.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {value}
        </Text>
      )}
    </View>
  );
}

/**
 * The rule that divides one register of the card's base from the next: a gold
 * hairline fading at both ends with white caught under it — the same fold the
 * card's raised surfaces already crease with, run edge to edge.
 *
 * This is what replaced the borders. The three figures and the ledger used to
 * be two rounded, bordered, shadowed plates stacked under the track: two cards
 * inside a card. A card in this app is divided by its rules, not by boxes.
 */
function BaseRule({ tone }: { tone: ReturnType<typeof getTone> }) {
  return (
    <View style={s.baseRule} pointerEvents="none">
      <LinearGradient
        colors={[
          hexToRgba(tone.accent, 0),
          hexToRgba(tone.accent, 0.3),
          hexToRgba(tone.accent, 0),
        ]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={s.baseRuleLine}
      />
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.95)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={s.baseRuleLine}
      />
    </View>
  );
}

/** A rule that fades at both ends, as the app's dividers do — not a hard line. */
function StatDivider({ tone }: { tone: ReturnType<typeof getTone> }) {
  return (
    <LinearGradient
      colors={[
        hexToRgba(tone.accent, 0),
        hexToRgba(tone.accent, 0.26),
        hexToRgba(tone.accent, 0),
      ]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={s.statDivider}
      pointerEvents="none"
    />
  );
}

/**
 * The trophy ledger.
 *
 * What was here: a shelf of overlapping 24pt trophies that silently gave up
 * past ten and showed "+7", and under it a list of the three most recent runs.
 * So a long series showed neither all its trophies nor all its dates, and the
 * order they were won in was never legible.
 *
 * What it is now: the best run stands at the head with its trophy and its
 * figures, and the series opens under it — one row per run, newest first,
 * numbered, dated, the best one marked. Nothing is dropped however long the
 * series runs, because a list grows where a strip cannot.
 *
 * It no longer stands in a box. It is the last register of the card's base,
 * divided from the figures above it by the same rule, and its rows hang under
 * the head's own column so the two read as one column of type.
 */
function TrophyLedger({
  attempts,
  best,
  tone,
  completionCount,
}: {
  attempts: ChallengeHistoryGroup['attempts'];
  best: ChallengeRecord;
  tone: ReturnType<typeof getTone>;
  completionCount: number;
}) {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const turn = useSharedValue(0);

  const bestIndex = attempts.findIndex(attempt => attempt.id === best.id);
  // Runs are numbered as they were won: the oldest is Run 1.
  const runNumber = (index: number) => completionCount - index;

  useEffect(() => {
    turn.value = reduceMotion
      ? open ? 1 : 0
      : withTiming(open ? 1 : 0, { duration: 240, easing: Easing.out(Easing.cubic) });
  }, [open, reduceMotion, turn]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn.value * 180}deg` }],
  }));

  return (
    <View style={s.ledger}>
      {/* The head: the best run, and the handle that opens the rest. */}
      <TouchableOpacity
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          setOpen(value => !value);
        }}
        activeOpacity={0.82}
        accessibilityRole="button"
        accessibilityLabel={open ? 'Hide every run' : 'Show every run'}
        style={s.ledgerHead}
      >
        {/* The same stage the hero trophy stands on: a tilted haloed plate
            casting gold, and a soft shadow pooled beneath it. */}
        <View style={s.ledgerHeadTrophy}>
          <View style={s.ledgerHeadHalo} />
          <View style={s.ledgerHeadBase} />
          <Image source={TROPHY_EMBLEM} resizeMode="contain" style={s.ledgerHeadImg} />
        </View>

        {/* The thing itself on the first line with the day it was won, set the
            way the title's own foot line is set — name, dot, date. Which run
            of the series it was goes underneath, where the run number can be
            read against the total instead of standing on its own.
            It read "Best · Run 4" over "12 Mar · tap to see every run": the
            run number was doing the work of a heading, and the date was
            buried in an instruction the chevron already gives. */}
        <View style={s.ledgerHeadCopy}>
          <View style={s.ledgerHeadLine}>
            <Text style={s.ledgerHeadValue} numberOfLines={1}>Best run</Text>
            <View style={s.historyFootDot} />
            <Text style={s.ledgerHeadDate} numberOfLines={1}>
              {shortDateLabel(best.completedAt, best.endedLabel)}
            </Text>
          </View>
          {bestIndex >= 0 && (
            <Text style={s.ledgerHeadSub} numberOfLines={1}>
              {`Run ${runNumber(bestIndex)} of ${completionCount}`}
            </Text>
          )}
        </View>

        {completionCount > 1 && (
          <View style={[s.ledgerHandle, { borderColor: hexToRgba(tone.accent, 0.24) }]}>
            <Reanimated.View style={chevronStyle}>
              <ChevronDown s={15} c={tone.accent} w={2.2} />
            </Reanimated.View>
          </View>
        )}
      </TouchableOpacity>

      {/* The series, newest first. Every run, however many there are. */}
      {open && completionCount > 1 && (
        <Reanimated.View
          // Closing used to drop the list out of the tree in one frame while
          // the card snapped up behind it. It leaves the way it came now.
          exiting={reduceMotion ? undefined : FadeOutUp.duration(170).easing(Easing.out(Easing.cubic))}
        >
          <BaseRule tone={tone} />
          <View style={s.ledgerList}>
            {attempts.map((attempt, index) => {
              const isBest = attempt.id === best.id;
              const last = index === attempts.length - 1;
              return (
                <Reanimated.View
                  key={attempt.id}
                  entering={
                    reduceMotion
                      ? undefined
                      : FadeInDown.duration(260)
                        .delay(Math.min(index, 8) * 34)
                        .easing(Easing.out(Easing.cubic))
                  }
                  style={s.ledgerRow}
                >
                  {/* The thread the trophies hang from, so the order reads as a
                      sequence rather than as a pile. */}
                  <View style={s.ledgerThread}>
                    <View style={[s.ledgerThreadLine, index === 0 && s.ledgerThreadLineTop]} />
                    <View style={s.ledgerRowStage}>
                      <View pointerEvents="none" style={s.ledgerRowBase} />
                      <Image source={TROPHY_EMBLEM} resizeMode="contain" style={s.ledgerRowImg} />
                    </View>
                    {!last && <View style={s.ledgerThreadLine} />}
                  </View>

                  <View style={s.ledgerRowCopy}>
                    <Text style={s.ledgerRowTitle} numberOfLines={1}>
                      {index === 0 ? 'Latest run' : `Run ${runNumber(index)}`}
                    </Text>
                    <Text style={s.ledgerRowDate} numberOfLines={1}>
                      {shortDateLabel(attempt.completedAt, attempt.endedLabel)}
                    </Text>
                  </View>

                  {isBest && (
                    <View style={[s.ledgerBestTag, { backgroundColor: hexToRgba(tone.accent, 0.12) }]}>
                      <Text style={[s.ledgerBestText, { color: tone.accent }]}>BEST</Text>
                    </View>
                  )}
                </Reanimated.View>
              );
            })}
          </View>
        </Reanimated.View>
      )}
    </View>
  );
}

function HistoryCard({
  group,
}: {
  group: ChallengeHistoryGroup;
}) {
  const { attempts, best, latest } = group;
  const tone = getTone(group.category);
  const badge = getCategoryBadge(group.category);
  const completionCount = attempts.length;
  const progressTotal = progressTotalFor(best);
  // What made this run the best: how fast it got to the trophy. The old
  // reading was "21/21 chapters", which every completed run shows — you
  // cannot finish without doing them all, so it distinguished nothing.
  const bestDays = runLengthDays(best);
  const bestRunLabel = bestDays !== null
    ? `${bestDays} ${bestDays === 1 ? 'day' : 'days'}`
    : progressTotal > 0
      ? `${best.progressCurrent}/${progressTotal} ${best.progressUnit}`
      : best.headline;
  const bestStreak = best.bestStreak ?? best.streak;
  const latestLabel = shortDateLabel(latest.completedAt, latest.endedLabel);
  const cardColors = [tone.soft, '#FFFFFF', '#FFFDF7'] as const;
  // One trophy is a different card, not the same card with emptier parts. A
  // series has a count, a shelf, a fastest run and a latest one; a single
  // victory has none of those — it has a day it was won and how long it took.
  const single = completionCount === 1;

  const streakFigure = (
    <View style={s.statStreak}>
      {/* The app's own flame, the one Home and the progress calendar burn —
          not the outline glyph this card had on its own. */}
      <Image source={FLAME_PNG} resizeMode="contain" style={s.statFlame} />
      <Text style={s.statStreakText}>{bestStreak || 0}</Text>
    </View>
  );

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
          {/* A tally of one is not a tally. The badge counts a series; when
              there is no series the trophy speaks for itself. */}
          {!single && (
            <View style={s.historyCountBadge}>
              <Text style={s.historyCountText}>x{completionCount}</Text>
            </View>
          )}
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
          {/* The count and the date belong to the title, so they are set in
              the title's serif — they were 9pt tracked capitals, which is the
              app's label voice, not its reading voice. */}
          <View style={s.historyFootRow}>
            {single ? (
              // "1 completion · Latest 12 Mar" — a count of one and a superlative
              // over a set of one. It is simply the day it was finished.
              <Text style={s.historyFoot} numberOfLines={1}>
                Completed <Text style={s.historyFootDate}>{latestLabel}</Text>
              </Text>
            ) : (
              <>
                <Text style={s.historyFoot}>
                  <Text style={[s.historyFootFigure, { color: tone.accent }]}>{completionCount}</Text>
                  {` ${completionWord(completionCount)}`}
                </Text>
                <View style={s.historyFootDot} />
                <Text style={s.historyFoot} numberOfLines={1}>
                  Latest <Text style={s.historyFootDate}>{latestLabel}</Text>
                </Text>
              </>
            )}
          </View>
        </View>
      </View>

      {/* The series plaque is gone. It said "Repeat victory" over "Best saved
          from 12 Mar" — a label derived from a number already printed on the
          trophy badge, above a date repeated in the row beneath it. It carried
          no fact the card did not already state twice. */}

      {/* A shelf holding a single trophy, directly under the 70pt trophy that
          already stands for it, is the same victory drawn twice. The track is
          the series' instrument; with no series there is nothing to line up. */}
      {!single && <TrophyTrack attempts={attempts} best={best} tone={tone} />}

      {/* The base the card stands on.
          Everything under the track used to float on it: two rounded plates,
          each with its own border, its own white lit edge and its own gold
          shadow, and under them a progress bar pinned at 100% because a
          completed run cannot be anything else. Three widgets on a parchment.
          It is one ground now — run out to the rails, divided by rules rather
          than boxed, and deepening into the card's own gold as it falls, so
          the card gains its weight at the bottom from light instead of from a
          bar ruled across it. */}
      <View style={[s.base, single && s.baseSingle]}>
        <LinearGradient
          colors={[
            'rgba(255,255,255,0)',
            hexToRgba(tone.accent, 0.07),
            hexToRgba(tone.accent, 0.2),
          ]}
          locations={[0, 0.62, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <BaseRule tone={tone} />

        <View style={s.statRow}>
          {single ? (
            // Two figures, not three padded out. "Fastest" over a set of one
            // is not a fastest, and "Latest" is the date already read above.
            <>
              <StatCell label="Finished in" tone={tone} value={bestRunLabel} />
              <StatDivider tone={tone} />
              <StatCell label="Best streak" tone={tone}>{streakFigure}</StatCell>
            </>
          ) : (
            <>
              <StatCell label="Fastest" tone={tone} value={bestRunLabel} />
              <StatDivider tone={tone} />
              <StatCell label="Best streak" tone={tone}>{streakFigure}</StatCell>
              <StatDivider tone={tone} />
              <StatCell label="Latest" tone={tone} value={latestLabel} />
            </>
          )}
        </View>

        {/* A single completion has no series to open, and its best run is its
            latest run. The ledger would only be the card saying it again. */}
        {!single && (
          <>
            <BaseRule tone={tone} />
            <TrophyLedger
              attempts={attempts}
              best={best}
              tone={tone}
              completionCount={completionCount}
            />
          </>
        )}
      </View>
    </LinearGradient>
  );
}

function ChurchWeeklyHistoryCard({ challenge }: { challenge: ChallengeRecord }) {
  const trophyWeeks = [...(challenge.churchTrophyWeeks ?? [])].reverse();
  const latestWeeks = trophyWeeks.slice(0, 6);
  return (
    <LinearGradient
      colors={['#F0FAF5', '#FFFFFF', '#FFF9E8']}
      start={{ x: 0.04, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={s.churchHistoryCard}
    >
      <View style={s.churchHistoryTop}>
        <View style={s.churchHistoryTrophyStage}>
          <StaticChallengeTrophy size={64} />
          <View style={s.churchHistoryCountBadge}>
            <Text style={s.churchHistoryCountText}>×{challenge.churchTrophyCount ?? 0}</Text>
          </View>
        </View>
        <View style={s.churchHistoryCopy}>
          <View style={s.churchHistoryBadge}>
            <Text style={s.churchHistoryBadgeText}>CHURCH · WEEKLY</Text>
          </View>
          <Text style={s.churchHistoryTitle}>{challenge.title}</Text>
          <Text style={s.churchHistoryMeta}>
            {challenge.streak} week streak · {challenge.scheduleLabel}
          </Text>
        </View>
      </View>
      <View style={s.churchHistoryRule} />
      <Text style={s.churchHistoryLedgerLabel}>TROPHY WEEKS</Text>
      <View style={s.churchHistoryWeeks}>
        {latestWeeks.map((weekStart, index) => (
          <View key={weekStart} style={s.churchHistoryWeek}>
            <StaticChallengeTrophy size={22} />
            <Text style={s.churchHistoryWeekText}>
              {index === 0 ? 'Latest · ' : ''}{shortDateLabel(weekStart)}
            </Text>
          </View>
        ))}
        {trophyWeeks.length > latestWeeks.length ? (
          <Text style={s.churchHistoryMore}>+{trophyWeeks.length - latestWeeks.length} earlier</Text>
        ) : null}
      </View>
    </LinearGradient>
  );
}

type PanelChallengeContext = ChallengeCategory;
const PANEL_CONTEXTS: PanelChallengeContext[] = ['prayer', 'scripture', 'journal', 'church'];
const TAB_CONTENT_ENTER_FORWARD = FadeInRight
  .duration(240)
  .easing(Easing.bezier(0.22, 1, 0.36, 1))
  .withInitialValues({ opacity: 0, transform: [{ translateX: 14 }] });
const TAB_CONTENT_ENTER_BACKWARD = FadeInLeft
  .duration(240)
  .easing(Easing.bezier(0.22, 1, 0.36, 1))
  .withInitialValues({ opacity: 0, transform: [{ translateX: -14 }] });

function isPanelChallengeContext(value: ChallengeTab): value is PanelChallengeContext {
  return value === 'prayer' || value === 'scripture' || value === 'journal' || value === 'church';
}

const CHALLENGES_GUIDE_TARGETS = {
  catalog: 'challenges.catalog',
  start: 'challenges.start',
} as const;

export default function ChallengesView({
  guided = false,
  onGuidedComplete,
}: {
  guided?: boolean;
  onGuidedComplete?: () => void;
} = {}) {
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
  const contentScrollRef = useRef<ScrollView>(null);
  const hasMountedRef = useRef(false);
  const tabDirectionRef = useRef<1 | -1>(1);
  const {
    session,
    patchSession,
    setPresentation,
  } = useGuidedSetup();
  const isGuided = guided && session?.active === true && session.activeStep === 'buildChallenges';
  const guidePhase = isGuided ? session.phase : '';
  const catalogTarget = useGuideTarget(CHALLENGES_GUIDE_TARGETS.catalog, isGuided);
  const startTarget = useGuideTarget(CHALLENGES_GUIDE_TARGETS.start, isGuided);

  useFocusEffect(
    useCallback(() => {
      void refreshChallenges();
      void refreshTasks();
    }, [refreshChallenges, refreshTasks]),
  );

  useEffect(() => {
    hasMountedRef.current = true;
  }, []);

  const ongoingChallenges = useMemo(
    () => [...activeChallenges, ...pausedChallenges],
    [activeChallenges, pausedChallenges],
  );
  const churchTrophyChallenges = useMemo(
    () => ongoingChallenges.filter(item => item.category === 'church' && (item.churchTrophyCount ?? 0) > 0),
    [ongoingChallenges],
  );
  const churchTrophyCount = useMemo(
    () => churchTrophyChallenges.reduce((total, item) => total + (item.churchTrophyCount ?? 0), 0),
    [churchTrophyChallenges],
  );
  const historyCount = completedChallenges.length + churchTrophyCount;
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
  const guidedCatalogEntry = useMemo(
    () => availableCatalogEntries.find(item => item.category === 'prayer') ?? null,
    [availableCatalogEntries],
  );

  const finishGuidedChallenges = useCallback((skipped = false) => {
    if (skipped) {
      notifyGuideEvent({
        type: 'skipped',
        step: 'buildChallenges',
        phase: 'complete',
      });
    }
    patchSession({
      activeStep: 'buildMyRoutine',
      phase: 'intro',
      route: '/onboarding',
    });
    setPresentation(null);
    onGuidedComplete?.();
  }, [onGuidedComplete, patchSession, setPresentation]);

  useEffect(() => {
    if (!isGuided) return;
    if (guidePhase === 'intro') {
      setActiveTab('prayer');
      patchSession({ phase: 'catalog' });
      return;
    }
    if (guidePhase === 'catalog') {
      setPresentation({
        key: 'challenges-catalog',
        targetId: CHALLENGES_GUIDE_TARGETS.catalog,
        cutoutPadding: 7,
        placement: 'above',
        allowTargetInteraction: true,
        message: 'Challenges give a focused season a beginning and an end.\n\nOpen one to preview its countdown.',
        ctaLabel: 'SKIP FOR NOW',
        onCta: () => finishGuidedChallenges(true),
      });
      return;
    }
    if (guidePhase === 'start') {
      setPresentation({
        key: 'challenges-start',
        targetId: CHALLENGES_GUIDE_TARGETS.start,
        cutoutPadding: 7,
        placement: 'above',
        allowTargetInteraction: true,
        message: 'Choose the duration and begin when you are ready.\n\nYou can adjust it later from My Routine.',
        ctaLabel: 'SKIP FOR NOW',
        onCta: () => finishGuidedChallenges(true),
      });
      return;
    }
    if (guidePhase === 'complete') {
      setPresentation({
        key: 'challenges-complete',
        celebrate: true,
        placement: 'center',
        message: 'Your first challenge is ready.',
        ctaLabel: 'CONTINUE',
        onCta: () => finishGuidedChallenges(),
      });
    }
  }, [
    finishGuidedChallenges,
    guidePhase,
    isGuided,
    patchSession,
    setPresentation,
  ]);

  useEffect(() => {
    if (!isGuided) return;
    if (guidePhase === 'start') {
      contentScrollRef.current?.scrollToEnd({ animated: true });
    }
    const timer = setTimeout(() => {
      catalogTarget.measure();
      startTarget.measure();
    }, guidePhase === 'start' ? 560 : 160);
    return () => clearTimeout(timer);
  }, [catalogTarget, guidePhase, isGuided, startTarget]);

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
    if (isGuided) patchSession({ phase: 'start' });
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
      if (isGuided) {
        notifyGuideEvent({
          type: 'completed',
          step: 'buildChallenges',
          phase: 'complete',
          entityKey: 'challenge',
          entityId: record?.id,
        });
      }
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
        progressTotal: totalDays,
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
      if (isGuided) {
        notifyGuideEvent({
          type: 'completed',
          step: 'buildChallenges',
          phase: 'complete',
          entityKey: 'challenge',
          entityId: record?.id,
        });
      }
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
    if (isGuided) {
      notifyGuideEvent({
        type: 'completed',
        step: 'buildChallenges',
        phase: 'complete',
        entityKey: 'challenge',
        entityId: record?.id,
      });
    }
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
        guideBindings={isGuided && context === 'prayer' && guidedCatalogEntry ? {
          catalogEntryId: guidedCatalogEntry.id,
          catalogEntry: catalogTarget,
          start: startTarget,
        } : undefined}
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
              if (tab.key !== activeTab) {
                const currentIndex = tabs.findIndex(item => item.key === activeTab);
                const nextIndex = tabs.findIndex(item => item.key === tab.key);
                tabDirectionRef.current = nextIndex >= currentIndex ? 1 : -1;
              }
              setActiveTab(tab.key);
              setExpandedChallengeId(null);
              setSelectedCatalog(null);
            }}
          />
        ))}
      </ScrollView>

      <ScrollView
        ref={contentScrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={[s.scrollContent, onlyPausedOnActiveTab && s.scrollContentOnlyPaused]}
        showsVerticalScrollIndicator={false}
      >
        <Reanimated.View
          key={activeTab}
          entering={hasMountedRef.current
            ? (tabDirectionRef.current > 0 ? TAB_CONTENT_ENTER_FORWARD : TAB_CONTENT_ENTER_BACKWARD)
            : undefined}
          style={s.tabContent}
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
              {churchTrophyChallenges.length > 0 ? (
                <View style={s.sectionBlock}>
                  <Text style={[s.sectionLabel, { color: '#2F8A62' }]}>WEEKLY CHURCH TROPHIES</Text>
                  {churchTrophyChallenges.map(challenge => (
                    <ChurchWeeklyHistoryCard key={challenge.id} challenge={challenge} />
                  ))}
                </View>
              ) : null}

              {completedChallenges.length > 0 ? (
                <View style={s.sectionBlock}>
                  <Text style={[s.sectionLabel, { color: C.gold }]}>ACHIEVEMENTS</Text>
                  {historyGroups.map(group => (
                    <HistoryCard key={group.templateId} group={group} />
                  ))}
                </View>
              ) : null}

              {completedChallenges.length === 0 && churchTrophyChallenges.length === 0 ? (
                <View style={s.emptyWrap}>
                  <Text style={s.emptyTitle}>No history yet</Text>
                  <Text style={s.emptyBody}>Successfully completed challenges will live here.</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </Reanimated.View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  tabContent: {
    width: '100%',
  },
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
    maxHeight: 58,
    overflow: 'visible',
    zIndex: 2,
  },
  tabsRow: {
    gap: 8,
    paddingHorizontal: 18,
    paddingTop: 2,
    paddingBottom: 14,
    alignItems: 'center',
  },
  tabPillMotion: {
    flexShrink: 0,
    alignSelf: 'center',
  },
  tabPill: {
    position: 'relative',
    minHeight: 38,
    borderRadius: 19,
    borderCurve: 'continuous',
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#EEE8DA',
    backgroundColor: '#F7F4ED',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tabPillGlaze: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: 1,
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  tabPillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabPillDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  tabText: {
    fontFamily: F.sansBold,
    fontSize: 9.4,
    letterSpacing: 1.35,
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
  churchWeekRow: {
    marginTop: 10,
    minHeight: 48,
    borderRadius: 17,
    borderCurve: 'continuous',
    backgroundColor: '#F3FAF6',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  churchWeekTrophy: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  churchWeekCopy: { flex: 1, minWidth: 0 },
  churchWeekTitle: { fontFamily: F.serifMedium, fontSize: 14, lineHeight: 18, color: '#286C50' },
  churchWeekSub: { marginTop: 1 },
  churchTrophyCount: {
    minWidth: 38,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  churchTrophyCountText: {
    fontFamily: F.serifSemiBold,
    fontSize: 14,
    color: '#A97925',
    fontVariant: ['tabular-nums'],
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
  churchHistoryCard: {
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderColor: '#9DCDB8',
    borderRadius: 28,
    borderCurve: 'continuous',
    padding: 16,
    overflow: 'hidden',
    boxShadow: '0 10px 24px rgba(47,138,98,0.12)',
  },
  churchHistoryTop: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  churchHistoryTrophyStage: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center' },
  churchHistoryCountBadge: {
    position: 'absolute',
    right: -1,
    bottom: 0,
    minWidth: 29,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#2F8A62',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  churchHistoryCountText: { fontFamily: F.serifSemiBold, fontSize: 11, color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  churchHistoryCopy: { flex: 1, minWidth: 0 },
  churchHistoryBadge: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: '#DFF2E9', paddingHorizontal: 8, paddingVertical: 3 },
  churchHistoryBadgeText: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.2, color: '#287253' },
  churchHistoryTitle: { marginTop: 6, fontFamily: F.serifMedium, fontSize: 19, lineHeight: 23, color: C.text },
  churchHistoryMeta: { marginTop: 3, fontFamily: F.sansMedium, fontSize: 10.5, lineHeight: 15, color: '#7A8D82' },
  churchHistoryRule: { marginVertical: 12, height: 1, backgroundColor: 'rgba(47,138,98,0.16)' },
  churchHistoryLedgerLabel: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.5, color: '#62927B' },
  churchHistoryWeeks: { marginTop: 8, gap: 6 },
  churchHistoryWeek: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 7 },
  churchHistoryWeekText: { fontFamily: F.serif, fontSize: 13.5, lineHeight: 18, color: '#625D55' },
  churchHistoryMore: { paddingLeft: 29, fontFamily: F.sansMedium, fontSize: 10.5, color: '#8DA297' },
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
    fontFamily: F.serifSemiBold,
    fontSize: 11,
    letterSpacing: 0.2,
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
    fontFamily: F.serifSemiBold,
    fontSize: 12,
    lineHeight: 15,
    letterSpacing: 0.2,
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
    fontFamily: F.serifSemiBold,
    fontSize: 12,
    lineHeight: 15,
    letterSpacing: 0.2,
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
  // The line under the title, in the title's own serif. It was 9pt tracked
  // capitals — the app's voice for labels, not for a sentence about a series.
  historyFootRow: { marginTop: 5, flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyFoot: {
    fontFamily: F.serif,
    fontSize: 14,
    lineHeight: 19,
    color: '#8A8177',
  },
  historyFootFigure: { fontFamily: F.serifSemiBold, fontSize: 15 },
  historyFootDate: { fontFamily: F.serifSemiBold, color: '#6F675C' },
  historyFootDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#D8D2C5' },

/* — the trophy track — */
  track: { marginTop: 14, position: 'relative', overflow: 'hidden', zIndex: 1 },
  // Held back for the single frame between first layout and knowing how many
  // trophies a shelf holds.
  trackMeasuring: { opacity: 0 },
  // One shelf. Rows stack, so each carries its own rail rather than the track
  // carrying one across all of them.
  trackRow: { position: 'relative', justifyContent: 'center', minHeight: 52 },
  trackRail: { position: 'absolute', left: 0, right: 0, bottom: 8, height: 1.5, borderRadius: 1 },
  trackSlots: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: TRACK_ROW_PAD,
    gap: TRACK_SLOT_GAP,
  },
  trackSlotsAlone: { justifyContent: 'center' },
  trackSlot: { width: TRACK_SLOT_W, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 8 },
  trackImg: { width: 26, height: 26, transform: [{ rotate: '-8deg' }] },
  // The best one stands taller and brighter than the rest of the row.
  trackImgBest: { width: 34, height: 34, transform: [{ rotate: '-8deg' }] },
  trackBestGlow: { position: 'absolute', bottom: 2, width: 38, height: 38, borderRadius: 19 },
  trackBestPlinth: { position: 'absolute', bottom: 4, width: 20, height: 2.5, borderRadius: 2 },

/* — the base — */
  // Out to the sides and down to the bottom edge, where the plinth closes it.
  // The card pads 17; the left rail is a 4pt bar drawn inside that padding, so
  // -13 runs the base up against it rather than over it. The right side has no
  // rail — only the border — so it goes flush.
  base: {
    marginTop: 15,
    marginLeft: -13,
    marginRight: -17,
    marginBottom: -17,
    // Room under the last figure for the gold to pool, so the card ends on a
    // ground rather than on a baseline.
    paddingBottom: 9,
    position: 'relative',
    zIndex: 1,
  },
  // With no track above it, the base carries the whole distance from the title.
  baseSingle: { marginTop: 17 },
  baseRule: { height: 2 },
  baseRuleLine: { height: 1 },

  /* — the three figures — */
  statRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: 15,
    paddingHorizontal: 6,
  },
  statCell: { flex: 1, minWidth: 0, alignItems: 'center', paddingHorizontal: 6 },
  statDivider: { width: 1, alignSelf: 'stretch', marginVertical: 2 },
  // The labels are set in the card's serif too, and at a size meant to be
  // read: 7.5pt tracked capitals is the smallest voice in the app, and these
  // three name the card's only figures.
  statLabel: { fontFamily: F.serifMedium, fontSize: 13, lineHeight: 17 },
  statValue: {
    marginTop: 3,
    fontFamily: F.serifSemiBold,
    fontSize: 19,
    lineHeight: 24,
    color: C.text,
  },
  statStreak: {
    marginTop: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statFlame: { width: 19, height: 19 },
  statStreakText: { fontFamily: F.serifSemiBold, fontSize: 19, lineHeight: 24, color: '#E4692B' },

/* — the trophy ledger — */
  // No box of its own: it is the last register of the base.
  ledger: { position: 'relative' },
  ledgerHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  ledgerHeadTrophy: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  ledgerHeadHalo: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.22)',
    backgroundColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#C5A059',
    shadowOpacity: 0.16,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
    transform: [{ rotate: '-4deg' }],
  },
  ledgerHeadBase: {
    position: 'absolute',
    bottom: 5,
    width: 32,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(104,72,24,0.10)',
  },
  ledgerHeadImg: { width: 36, height: 36, transform: [{ rotate: '-8deg' }] },
  ledgerHeadCopy: { flex: 1, minWidth: 0 },
  // Name, dot, date — the title's foot line, one register down.
  ledgerHeadLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ledgerHeadValue: {
    fontFamily: F.serifSemiBold,
    fontSize: 17,
    lineHeight: 22,
    color: C.text,
    flexShrink: 0,
  },
  ledgerHeadDate: { flexShrink: 1, fontFamily: F.serifSemiBold, fontSize: 15, lineHeight: 20, color: '#6F675C' },
  ledgerHeadSub: { marginTop: 2, fontFamily: F.serif, fontSize: 13.5, lineHeight: 18, color: '#9A9187' },
  ledgerHandle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.92)',
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    shadowColor: '#C5A059',
    shadowOpacity: 0.16,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  ledgerList: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 14,
  },
  ledgerRow: { flexDirection: 'row', alignItems: 'center', gap: 13, minHeight: 46 },
  // The thread the trophies hang from: a hairline running through the column
  // so the runs read as a sequence in time rather than as a pile. It is as
  // wide as the head's trophy stage, so every run's date sits in the same
  // column as the best run's above it.
  ledgerThread: { width: 48, alignSelf: 'stretch', alignItems: 'center', flexShrink: 0 },
  ledgerThreadLine: { flex: 1, width: 1, backgroundColor: 'rgba(197,160,89,0.22)' },
  ledgerThreadLineTop: { opacity: 0 },
  ledgerRowStage: { alignItems: 'center', justifyContent: 'center', marginVertical: 4 },
  ledgerRowImg: { width: 26, height: 26, transform: [{ rotate: '-8deg' }] },
  ledgerRowBase: {
    position: 'absolute',
    bottom: 1,
    width: 18,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(104,72,24,0.10)',
  },
  ledgerRowCopy: { flex: 1, minWidth: 0 },
  ledgerRowTitle: { fontFamily: F.serifSemiBold, fontSize: 15, lineHeight: 19, color: '#5F584E' },
  ledgerRowDate: { marginTop: 1, fontFamily: F.serif, fontSize: 13.5, lineHeight: 18, color: '#9A9187' },
  ledgerBestTag: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexShrink: 0,
  },
  ledgerBestText: { fontFamily: F.serifSemiBold, fontSize: 11.5, letterSpacing: 0.3 },

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
