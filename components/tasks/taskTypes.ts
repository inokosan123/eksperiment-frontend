import type { TaskData } from '@/components/shared/TaskCards';
import type { NotificationMode } from '@/components/shared/NotificationSettings';

export type TaskFrequency = 'daily' | 'weekdays' | 'weekends' | 'specific_days' | 'monthly';
export type TaskLevel = 1 | 2 | 3 | 4;
export type TaskSource =
  | 'routine'
  | 'spiritual'
  | 'quick'
  | 'habit'
  | 'challenge'
  | 'reading_book'
  | 'gratitude';

export type TaskType = 'prayer' | 'reading' | 'journal' | 'church' | 'gratitude' | 'custom';
export type TaskLifecycleStatus = 'active' | 'paused' | 'archived';
export type TaskInstanceStatus = 'pending' | 'completed' | 'skipped' | 'missed' | 'not_applicable';

export type TaskSchedule = {
  frequency: TaskFrequency;
  selectedDays: number[];
  monthlyDays: number[];
  time: string;
  sameTimeEveryDay: boolean;
  dayTimes: Record<number, string>;
};

export type TaskDefinition = {
  id: string;
  title: string;
  subtitle?: string;
  level: TaskLevel;
  source: TaskSource;
  type: TaskType;
  icon?: string;
  habitColor?: string;
  targetView?: string;
  targetTab?: string;
  status: TaskLifecycleStatus;
  schedule: TaskSchedule;
  notificationMode: NotificationMode;
  reminderMinutes?: number;
  createdAt: number;
  activatedAt: number;
  pausedAt?: string;
  removedAt?: string;
};

export type TaskInstance = {
  id: string;
  taskId: string;
  date: string;
  time: string;
  status: TaskInstanceStatus;
  locked: boolean;
  title: string;
  subtitle?: string;
  level: TaskLevel;
  source: TaskSource;
  type: TaskType;
  icon?: string;
  habitColor?: string;
  targetView?: string;
  targetTab?: string;
  createdAt: number;
  resolvedAt?: number;
};

export type PrayerTaskConfig = {
  taskId: string;
  prayerType?: string;
  prayerRule?: string;
  prayerTaskKind?: string;
  jesusPrayerMode?: string;
  jesusPrayerDuration?: number;
  jesusPrayerCount?: number;
};

export type JournalTaskConfig = {
  taskId: string;
  journalType: 'daily' | 'morning_pages' | 'free_writing' | 'gratitude';
  technique?: string;
};

export type ScriptureTaskConfig = {
  taskId: string;
  readingType: 'new_testament' | 'old_testament' | 'psalter' | 'church_calendar' | 'custom';
  startBookId?: number;
  startChapter?: number;
  chaptersPerDay?: number;
  totalUnitsRead?: number;
};

export type ReadingBookTaskConfig = {
  taskId: string;
  bookId: string;
};

export type HabitTaskConfig = {
  taskId: string;
  habitId: string;
  habitStepId?: string;
};

export type ChallengeTaskConfig = {
  taskId: string;
  challengeId: string;
  templateId?: string;
  progressCurrent?: number;
  progressTotal?: number;
  progressUnit?: string;
};

export type TaskDraft = Omit<TaskDefinition, 'id' | 'createdAt' | 'activatedAt' | 'status'> & {
  id?: string;
  status?: TaskLifecycleStatus;
  createdAt?: number;
  activatedAt?: number;
  prayerConfig?: Omit<PrayerTaskConfig, 'taskId'>;
  journalConfig?: Omit<JournalTaskConfig, 'taskId'>;
  scriptureConfig?: Omit<ScriptureTaskConfig, 'taskId'>;
  readingBookConfig?: Omit<ReadingBookTaskConfig, 'taskId'>;
  habitConfig?: Omit<HabitTaskConfig, 'taskId'>;
  challengeConfig?: Omit<ChallengeTaskConfig, 'taskId'>;
};

export type TaskListItem = {
  instance: TaskInstance;
  card: TaskData;
  route?: string;
};
