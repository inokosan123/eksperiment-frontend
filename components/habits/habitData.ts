export type HabitFrequency = 'daily' | 'weekdays' | 'weekends' | 'specific_days';

export type HabitStep = {
  id: string;
  title: string;
  time: string;
  frequency: HabitFrequency;
  selectedDays?: number[];
  completedToday: boolean;
  currentStreak: number;
  bestStreak: number;
  completionRate: number;
};

export type HabitItem = {
  id: string;
  name: string;
  color: string;
  icon: string;
  active: boolean;
  steps: HabitStep[];
};

export const HABIT_COLORS = ['#C5A059', '#16A34A', '#2563EB', '#DB2777', '#7C3AED', '#EA580C', '#0F766E'];
export const HABIT_ICONS = ['🙏', '📖', '🕯️', '💧', '🏃', '☀️', '🌙', '🎵', '🧠', '🍎', '✍️', '❤'];

export const DAY_OPTIONS = [
  { key: 1, label: 'M' },
  { key: 2, label: 'T' },
  { key: 3, label: 'W' },
  { key: 4, label: 'T' },
  { key: 5, label: 'F' },
  { key: 6, label: 'S' },
  { key: 0, label: 'S' },
];

export const INITIAL_HABITS: HabitItem[] = [
  {
    id: 'habit_1',
    name: 'Morning Rule',
    color: '#16A34A',
    icon: '🙏',
    active: true,
    steps: [
      { id: 'h1s1', title: 'Morning prayer', time: '07:00', frequency: 'daily', completedToday: true, currentStreak: 8, bestStreak: 17, completionRate: 86 },
      { id: 'h1s2', title: 'Read 1 chapter', time: '07:20', frequency: 'daily', completedToday: false, currentStreak: 4, bestStreak: 11, completionRate: 72 },
    ],
  },
  {
    id: 'habit_2',
    name: 'Evening Review',
    color: '#C5A059',
    icon: '🕯️',
    active: true,
    steps: [
      { id: 'h2s1', title: 'Examine the day', time: '22:00', frequency: 'daily', completedToday: false, currentStreak: 6, bestStreak: 14, completionRate: 80 },
      { id: 'h2s2', title: 'Write one correction', time: '22:10', frequency: 'weekdays', completedToday: false, currentStreak: 3, bestStreak: 8, completionRate: 61 },
    ],
  },
  {
    id: 'habit_3',
    name: 'Study Block',
    color: '#2563EB',
    icon: '📖',
    active: false,
    steps: [
      { id: 'h3s1', title: 'Read 20 minutes', time: '18:30', frequency: 'specific_days', selectedDays: [1, 3, 5], completedToday: false, currentStreak: 0, bestStreak: 10, completionRate: 54 },
    ],
  },
];

export function getFreqLabel(step: HabitStep) {
  switch (step.frequency) {
    case 'weekdays':
      return 'Weekdays';
    case 'weekends':
      return 'Weekends';
    case 'specific_days':
      return (step.selectedDays ?? [])
        .map(day => DAY_OPTIONS.find(item => item.key === day)?.label)
        .filter(Boolean)
        .join(' ');
    default:
      return 'Daily';
  }
}

export function buildCalendarSeed(step: HabitStep) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const done = new Set<string>();
  const skipped = new Set<string>();
  const missed = new Set<string>();

  for (let day = 1; day <= today.getDate(); day += 1) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const marker = (day + step.id.length) % 10;
    if (marker < 5) done.add(key);
    else if (marker === 5 || marker === 6) skipped.add(key);
    else if (marker < 9) missed.add(key);
  }

  return { done, skipped, missed };
}
