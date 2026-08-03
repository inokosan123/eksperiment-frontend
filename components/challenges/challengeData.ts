export type ChallengeTab = 'active' | 'prayer' | 'scripture' | 'journal' | 'church' | 'history';
export type ChallengeStatus = 'active' | 'paused' | 'completed' | 'cancelled';
export type ChallengeCategory = 'prayer' | 'scripture' | 'journal' | 'church';
export type ChallengeGroupKey =
  | 'church'
  | 'lectionary'
  | 'new_testament'
  | 'psalter'
  | 'old_testament'
  | 'prayer'
  | 'journal';
export type ChallengeIconKey =
  | 'sun'
  | 'moon'
  | 'sparkles'
  | 'book'
  | 'openBook'
  | 'bookMarked'
  | 'calendarCheck'
  | 'feather'
  | 'notebook'
  | 'cross';

export type PaceOption = {
  id: string;
  label: string;
  caption: string;
};

export type ChallengeCatalogEntry = {
  id: string;
  templateId: string;
  title: string;
  description: string;
  category: ChallengeCategory;
  groupKey: ChallengeGroupKey;
  groupLabel: string;
  icon: ChallengeIconKey;
  descriptor: string;
  defaultTime?: string;
  scheduleLabel: string;
  totalUnits?: number;
  paceOptions?: PaceOption[];
};

export type ChallengeScriptureConfig = {
  chaptersPerDay: number;
  time?: string;
  sameTimeEveryDay?: boolean;
  dayTimes?: Record<number, string>;
  notificationMode?: 'none' | 'single' | 'double';
  reminderMinutes?: number;
};

export type ChallengePrayerConfig = {
  taskKind: 'guided_rule' | 'personal_rule' | 'jesus_prayer';
  prayerType?: 'morning' | 'evening';
  prayerRule?: 'standard' | 'short' | 'seraphim' | 'personal';
  jesusPrayerMode?: 'duration' | 'count';
  jesusPrayerDuration?: number;
  jesusPrayerCount?: number;
  time?: string;
  sameTimeEveryDay?: boolean;
  dayTimes?: Record<number, string>;
  notificationMode?: 'none' | 'single' | 'double';
  reminderMinutes?: number;
};

export type ChallengeChurchConfig = {
  frequency: 'daily' | 'weekdays' | 'weekends' | 'specific_days' | 'monthly';
  selectedDays?: number[];
  monthlyDays?: number[];
  time?: string;
  sameTimeEveryDay?: boolean;
  dayTimes?: Record<number, string>;
  notificationMode?: 'none' | 'single' | 'double';
  reminderMinutes?: number;
};

export type ChallengeChurchWeek = {
  weekStart: string;
  weekEnd: string;
  requiredDates: string[];
  completedDates: string[];
  requiredCount: number;
  completedCount: number;
  status: 'active' | 'earned' | 'missed' | 'practice';
};

export type ChallengeRecord = {
  id: string;
  templateId: string;
  title: string;
  description: string;
  category: ChallengeCategory;
  groupKey: ChallengeGroupKey;
  icon: ChallengeIconKey;
  status: ChallengeStatus;
  progressCurrent: number;
  progressTotal?: number;
  progressUnit: string;
  headline: string;
  subline: string;
  showBar: boolean;
  streak: number;
  time?: string;
  scheduleLabel: string;
  paceLabel?: string;
  endedLabel?: string;
  totalUnits?: number;
  durationDays?: number;
  startedAt?: string;
  createdAt?: number;
  pausedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  completedDates?: string[];
  skippedDates?: string[];
  lastCompletedDate?: string;
  bestStreak?: number;
  scriptureConfig?: ChallengeScriptureConfig;
  prayerConfig?: ChallengePrayerConfig;
  churchConfig?: ChallengeChurchConfig;
  churchWeek?: ChallengeChurchWeek;
  churchTrophyWeeks?: string[];
  churchTrophyCount?: number;
};

export const TAB_ACTIVE_COLORS: Record<ChallengeTab, string> = {
  active: '#10B981',
  prayer: '#C58A2D',
  scripture: '#C5A059',
  journal: '#8B5CF6',
  church: '#2F8A62',
  history: '#A8A29E',
};

export const GROUP_LABELS: Record<ChallengeGroupKey, string> = {
  church: 'Church',
  lectionary: 'Lectionary',
  new_testament: 'New Testament',
  psalter: 'Psalter',
  old_testament: 'Old Testament',
  prayer: 'Prayer',
  journal: 'Journal',
};

export const GROUP_ORDER: ChallengeGroupKey[] = [
  'church',
  'new_testament',
  'psalter',
  'old_testament',
  'lectionary',
  'prayer',
  'journal',
];

const CATALOG_ENTRY_ORDER: Record<string, number> = {
  nt_full: 10,
  gospel_four: 20,
  gospel_matthew: 30,
  gospel_mark: 40,
  gospel_luke: 50,
  gospel_john: 60,
  nt_acts: 70,
  nt_paul_epistles: 80,
  nt_catholic_epistles: 90,
  nt_revelation: 100,
  ot_full: 200,
  ot_pentateuch: 210,
  ot_history: 220,
  ot_wisdom: 230,
  ot_prophets: 240,
  psalter_full: 150,
  lectionary_daily: 300,
  church_weekly: 400,
  prayer_morning: 500,
  prayer_evening: 510,
  prayer_jesus: 520,
  journal_daily: 600,
  journal_morning_pages: 610,
  journal_free_writing: 620,
};

export function compareChallengeCatalogEntries(a: ChallengeCatalogEntry, b: ChallengeCatalogEntry) {
  const groupDiff = GROUP_ORDER.indexOf(a.groupKey) - GROUP_ORDER.indexOf(b.groupKey);
  if (groupDiff !== 0) return groupDiff;

  const orderDiff = (CATALOG_ENTRY_ORDER[a.id] ?? 9999) - (CATALOG_ENTRY_ORDER[b.id] ?? 9999);
  if (orderDiff !== 0) return orderDiff;

  return a.title.localeCompare(b.title);
}

export const CATALOG_ENTRIES: ChallengeCatalogEntry[] = [
  {
    id: 'church_weekly',
    templateId: 'church_weekly',
    title: 'Go to Church Every Week',
    description: 'A weekly Sunday service rhythm with one reminder and one check-in.',
    category: 'church',
    groupKey: 'church',
    groupLabel: 'Church',
    icon: 'cross',
    descriptor: 'Weekly Sunday rhythm',
    defaultTime: '09:00',
    scheduleLabel: 'Every Sunday',
  },
  {
    id: 'nt_full',
    templateId: 'nt_full',
    title: 'Full New Testament',
    description: 'All 27 books, from Matthew to Revelation.',
    category: 'scripture',
    groupKey: 'new_testament',
    groupLabel: 'New Testament',
    icon: 'openBook',
    descriptor: 'Structured chapter plan',
    defaultTime: '21:00',
    scheduleLabel: 'Daily',
    totalUnits: 260,
    paceOptions: [
      { id: '60d', label: '60 Days', caption: 'Steady pace' },
      { id: '90d', label: '90 Days', caption: 'Gentler pace' },
      { id: '120d', label: '120 Days', caption: 'Light pace' },
    ],
  },
  {
    id: 'gospel_four',
    templateId: 'gospel_four',
    title: 'The Four Gospels',
    description: 'Matthew, Mark, Luke and John in one guided challenge.',
    category: 'scripture',
    groupKey: 'new_testament',
    groupLabel: 'New Testament',
    icon: 'book',
    descriptor: 'Structured chapter plan',
    defaultTime: '21:00',
    scheduleLabel: 'Daily',
    totalUnits: 89,
    paceOptions: [
      { id: '30d', label: '30 Days', caption: 'Focused pace' },
      { id: '45d', label: '45 Days', caption: 'Balanced pace' },
      { id: '60d', label: '60 Days', caption: 'Slow pace' },
    ],
  },
  {
    id: 'gospel_matthew',
    templateId: 'gospel_matthew',
    title: 'Gospel of Matthew',
    description: '28 chapters.',
    category: 'scripture',
    groupKey: 'new_testament',
    groupLabel: 'New Testament',
    icon: 'book',
    descriptor: 'Single-book challenge',
    defaultTime: '21:00',
    scheduleLabel: 'Daily',
    totalUnits: 28,
  },
  {
    id: 'gospel_mark',
    templateId: 'gospel_mark',
    title: 'Gospel of Mark',
    description: '16 chapters.',
    category: 'scripture',
    groupKey: 'new_testament',
    groupLabel: 'New Testament',
    icon: 'book',
    descriptor: 'Single-book challenge',
    defaultTime: '21:00',
    scheduleLabel: 'Daily',
    totalUnits: 16,
  },
  {
    id: 'gospel_luke',
    templateId: 'gospel_luke',
    title: 'Gospel of Luke',
    description: '24 chapters.',
    category: 'scripture',
    groupKey: 'new_testament',
    groupLabel: 'New Testament',
    icon: 'book',
    descriptor: 'Single-book challenge',
    defaultTime: '21:00',
    scheduleLabel: 'Daily',
    totalUnits: 24,
  },
  {
    id: 'gospel_john',
    templateId: 'gospel_john',
    title: 'Gospel of John',
    description: '21 chapters.',
    category: 'scripture',
    groupKey: 'new_testament',
    groupLabel: 'New Testament',
    icon: 'book',
    descriptor: 'Single-book challenge',
    defaultTime: '21:00',
    scheduleLabel: 'Daily',
    totalUnits: 21,
  },
  {
    id: 'nt_acts',
    templateId: 'nt_acts',
    title: 'Acts of the Apostles',
    description: '28 chapters.',
    category: 'scripture',
    groupKey: 'new_testament',
    groupLabel: 'New Testament',
    icon: 'book',
    descriptor: 'Single-book challenge',
    defaultTime: '21:00',
    scheduleLabel: 'Daily',
    totalUnits: 28,
  },
  {
    id: 'nt_paul_epistles',
    templateId: 'nt_paul_epistles',
    title: 'Epistles of St. Paul',
    description: '14 epistles, Romans to Hebrews.',
    category: 'scripture',
    groupKey: 'new_testament',
    groupLabel: 'New Testament',
    icon: 'openBook',
    descriptor: 'Structured chapter plan',
    defaultTime: '21:00',
    scheduleLabel: 'Daily',
    totalUnits: 100,
  },
  {
    id: 'nt_catholic_epistles',
    templateId: 'nt_catholic_epistles',
    title: 'Catholic Epistles',
    description: 'James, Peter, John and Jude.',
    category: 'scripture',
    groupKey: 'new_testament',
    groupLabel: 'New Testament',
    icon: 'openBook',
    descriptor: 'Structured chapter plan',
    defaultTime: '21:00',
    scheduleLabel: 'Daily',
    totalUnits: 21,
  },
  {
    id: 'nt_revelation',
    templateId: 'nt_revelation',
    title: 'Revelation',
    description: '22 chapters.',
    category: 'scripture',
    groupKey: 'new_testament',
    groupLabel: 'New Testament',
    icon: 'book',
    descriptor: 'Single-book challenge',
    defaultTime: '21:00',
    scheduleLabel: 'Daily',
    totalUnits: 22,
  },
  {
    id: 'psalter_full',
    templateId: 'psalter_full',
    title: 'Full Psalter',
    description: 'All 151 Psalms in one reading journey.',
    category: 'scripture',
    groupKey: 'psalter',
    groupLabel: 'Psalter',
    icon: 'bookMarked',
    descriptor: 'Psalm-by-psalm plan',
    defaultTime: '06:45',
    scheduleLabel: 'Daily',
    totalUnits: 151,
    paceOptions: [
      { id: '20d', label: '20 Days', caption: 'Fast cycle' },
      { id: '40d', label: '40 Days', caption: 'Classic pace' },
      { id: '60d', label: '60 Days', caption: 'Slow pace' },
    ],
  },
  {
    id: 'ot_full',
    templateId: 'ot_full',
    title: 'Full Old Testament',
    description: 'A long-form reading path through the entire Old Testament.',
    category: 'scripture',
    groupKey: 'old_testament',
    groupLabel: 'Old Testament',
    icon: 'openBook',
    descriptor: 'Long-form scripture plan',
    defaultTime: '20:30',
    scheduleLabel: 'Daily',
    totalUnits: 929,
    paceOptions: [
      { id: '180d', label: '180 Days', caption: 'Focused' },
      { id: '270d', label: '270 Days', caption: 'Balanced' },
      { id: '365d', label: '365 Days', caption: 'Year pace' },
    ],
  },
  {
    id: 'ot_pentateuch',
    templateId: 'ot_pentateuch',
    title: 'Pentateuch',
    description: 'Genesis, Exodus, Leviticus, Numbers, Deuteronomy.',
    category: 'scripture',
    groupKey: 'old_testament',
    groupLabel: 'Old Testament',
    icon: 'openBook',
    descriptor: 'Structured chapter plan',
    defaultTime: '20:30',
    scheduleLabel: 'Daily',
    totalUnits: 187,
  },
  {
    id: 'ot_history',
    templateId: 'ot_history',
    title: 'Historical Books',
    description: 'Joshua through Esther.',
    category: 'scripture',
    groupKey: 'old_testament',
    groupLabel: 'Old Testament',
    icon: 'openBook',
    descriptor: 'Structured chapter plan',
    defaultTime: '20:30',
    scheduleLabel: 'Daily',
    totalUnits: 249,
  },
  {
    id: 'ot_wisdom',
    templateId: 'ot_wisdom',
    title: 'Wisdom Books',
    description: 'Job, Proverbs, Ecclesiastes, Song of Songs.',
    category: 'scripture',
    groupKey: 'old_testament',
    groupLabel: 'Old Testament',
    icon: 'openBook',
    descriptor: 'Structured chapter plan',
    defaultTime: '20:30',
    scheduleLabel: 'Daily',
    totalUnits: 93,
  },
  {
    id: 'ot_prophets',
    templateId: 'ot_prophets',
    title: 'Prophetic Books',
    description: 'Isaiah through Malachi.',
    category: 'scripture',
    groupKey: 'old_testament',
    groupLabel: 'Old Testament',
    icon: 'openBook',
    descriptor: 'Structured chapter plan',
    defaultTime: '20:30',
    scheduleLabel: 'Daily',
    totalUnits: 252,
  },
  {
    id: 'prayer_morning',
    templateId: 'prayer_morning',
    title: 'Morning Prayer',
    description: 'A steady morning prayer rhythm with one clear check-in each day.',
    category: 'prayer',
    groupKey: 'prayer',
    groupLabel: 'Prayer',
    icon: 'sun',
    descriptor: 'Dedicated prayer setup',
    defaultTime: '07:00',
    scheduleLabel: 'Daily',
    paceOptions: [
      { id: '14d', label: '14 Days', caption: 'Short reset' },
      { id: '30d', label: '30 Days', caption: 'Full month' },
      { id: '40d', label: '40 Days', caption: 'Longer rule' },
    ],
  },
  {
    id: 'prayer_evening',
    templateId: 'prayer_evening',
    title: 'Evening Prayer',
    description: 'Close the day with a short evening office and reflection.',
    category: 'prayer',
    groupKey: 'prayer',
    groupLabel: 'Prayer',
    icon: 'moon',
    descriptor: 'Dedicated prayer setup',
    defaultTime: '22:00',
    scheduleLabel: 'Daily',
    paceOptions: [
      { id: '14d', label: '14 Days', caption: 'Short reset' },
      { id: '30d', label: '30 Days', caption: 'Full month' },
      { id: '40d', label: '40 Days', caption: 'Longer rule' },
    ],
  },
  {
    id: 'prayer_jesus',
    templateId: 'prayer_jesus',
    title: 'Daily Jesus Prayer',
    description: 'A small daily challenge to keep the Jesus Prayer close.',
    category: 'prayer',
    groupKey: 'prayer',
    groupLabel: 'Prayer',
    icon: 'cross',
    descriptor: 'Dedicated prayer setup',
    defaultTime: '13:00',
    scheduleLabel: 'Daily',
    paceOptions: [
      { id: '21d', label: '21 Days', caption: 'Short practice' },
      { id: '30d', label: '30 Days', caption: 'Balanced' },
      { id: '60d', label: '60 Days', caption: 'Deepen habit' },
    ],
  },
  {
    id: 'journal_daily',
    templateId: 'journal_daily',
    title: 'Daily Journal',
    description: 'Write in your journal every day and keep a visible streak.',
    category: 'journal',
    groupKey: 'journal',
    groupLabel: 'Journal',
    icon: 'notebook',
    descriptor: 'Dedicated journal setup',
    defaultTime: '21:30',
    scheduleLabel: 'Daily',
    paceOptions: [
      { id: '14d', label: '14 Days', caption: 'Short reset' },
      { id: '30d', label: '30 Days', caption: 'Full month' },
      { id: '90d', label: '90 Days', caption: 'Longer consistency' },
      { id: '365d', label: '365 Days', caption: 'One year' },
    ],
  },
  {
    id: 'journal_morning_pages',
    templateId: 'journal_morning_pages',
    title: 'Morning Pages',
    description: 'Start each day with free-flow pages and clear your head.',
    category: 'journal',
    groupKey: 'journal',
    groupLabel: 'Journal',
    icon: 'feather',
    descriptor: 'Dedicated journal setup',
    defaultTime: '07:15',
    scheduleLabel: 'Daily',
    paceOptions: [
      { id: '14d', label: '14 Days', caption: 'Short reset' },
      { id: '30d', label: '30 Days', caption: 'Classic month' },
      { id: '60d', label: '60 Days', caption: 'Longer habit' },
      { id: '365d', label: '365 Days', caption: 'One year' },
    ],
  },
  {
    id: 'journal_free_writing',
    templateId: 'journal_free_writing',
    title: 'Free Writing',
    description: 'A simple daily writing challenge with no fixed prompt.',
    category: 'journal',
    groupKey: 'journal',
    groupLabel: 'Journal',
    icon: 'feather',
    descriptor: 'Dedicated journal setup',
    defaultTime: '20:45',
    scheduleLabel: 'Daily',
    paceOptions: [
      { id: '14d', label: '14 Days', caption: 'Short reset' },
      { id: '30d', label: '30 Days', caption: 'Balanced' },
      { id: '90d', label: '90 Days', caption: 'Longer consistency' },
      { id: '365d', label: '365 Days', caption: 'One year' },
    ],
  },
];

export const INITIAL_CHALLENGES: ChallengeRecord[] = [
  {
    id: 'challenge_gospels',
    templateId: 'gospel_four',
    title: 'Read the Gospels',
    description: 'Matthew, Mark, Luke and John with a daily reading plan.',
    category: 'scripture',
    groupKey: 'new_testament',
    icon: 'book',
    status: 'active',
    progressCurrent: 6,
    progressTotal: 45,
    progressUnit: 'days',
    headline: 'Day 7 of 45',
    subline: '6/45 days completed',
    showBar: true,
    streak: 7,
    time: '21:00',
    scheduleLabel: 'Daily',
    paceLabel: '2 chapters/day',
    totalUnits: 89,
    durationDays: 45,
    scriptureConfig: {
      chaptersPerDay: 2,
      time: '21:00',
      sameTimeEveryDay: true,
      notificationMode: 'single',
      reminderMinutes: 15,
    },
  },
  {
    id: 'challenge_psalter',
    templateId: 'psalter_full',
    title: '40-Day Psalter',
    description: 'A classic psalter rhythm spread across 40 days.',
    category: 'scripture',
    groupKey: 'psalter',
    icon: 'bookMarked',
    status: 'active',
    progressCurrent: 6,
    progressTotal: 40,
    progressUnit: 'days',
    headline: '6 of 40 days',
    subline: '34 days left',
    showBar: true,
    streak: 6,
    time: '06:45',
    scheduleLabel: 'Daily',
    paceLabel: '4 psalms/day',
    totalUnits: 151,
    durationDays: 40,
    scriptureConfig: {
      chaptersPerDay: 4,
      time: '06:45',
      sameTimeEveryDay: true,
      notificationMode: 'single',
      reminderMinutes: 15,
    },
  },
  {
    id: 'challenge_morning_prayer',
    templateId: 'prayer_morning',
    title: 'Morning Prayer',
    description: 'A short daily morning office to anchor the day.',
    category: 'prayer',
    groupKey: 'prayer',
    icon: 'sun',
    status: 'paused',
    progressCurrent: 18,
    progressTotal: 30,
    progressUnit: 'days',
    headline: '18 of 30 days',
    subline: 'Paused after a strong run',
    showBar: true,
    streak: 5,
    time: '07:00',
    scheduleLabel: 'Daily',
    paceLabel: '30 Days',
  },
  {
    id: 'challenge_jesus_prayer_done',
    templateId: 'prayer_jesus',
    title: 'Daily Jesus Prayer',
    description: 'Kept the prayer active every day for the full cycle.',
    category: 'prayer',
    groupKey: 'prayer',
    icon: 'cross',
    status: 'completed',
    progressCurrent: 30,
    progressTotal: 30,
    progressUnit: 'days',
    headline: 'Completed 30-day rule',
    subline: 'A full month kept faithfully',
    showBar: true,
    streak: 14,
    time: '13:00',
    scheduleLabel: 'Daily',
    paceLabel: '30 Days',
    endedLabel: 'Completed Apr 6',
  },
  {
    id: 'challenge_church_cancelled',
    templateId: 'church_weekly',
    title: 'Go to Church Every Week',
    description: 'A Sunday rhythm challenge that ended early.',
    category: 'church',
    groupKey: 'church',
    icon: 'cross',
    status: 'cancelled',
    progressCurrent: 3,
    progressTotal: 8,
    progressUnit: 'weeks',
    headline: 'Reached week 4',
    subline: 'Ended before completion',
    showBar: false,
    streak: 2,
    time: '09:00',
    scheduleLabel: 'Every Sunday',
    endedLabel: 'Ended Apr 2',
  },
];
