import type { TaskData, TaskState, TaskVariant } from '@/components/shared/TaskCards';
import type { TaskInstance, TaskLaunchDescriptor, TaskListItem, TaskType } from '@/components/tasks/taskTypes';

function instanceStateToCardState(status: TaskInstance['status']): TaskState {
  switch (status) {
    case 'completed':
      return 'done';
    case 'skipped':
      return 'skipped';
    case 'missed':
      return 'locked';
    case 'pending':
    default:
      return 'pending';
  }
}

// Structural shape used by all card-look helpers. Both TaskInstance and
// MyRoutine's RoutineTask satisfy this — keeping the helpers generic lets
// Home and MyRoutine share one variant/type/icon resolution.
export type TaskCardLookInput = {
  source?: TaskInstance['source'];
  type?: TaskType;
  level?: number;
  title?: string;
  subtitle?: string;
  icon?: string;
  targetView?: string;
};

export function resolveTaskVariant(input: TaskCardLookInput): TaskVariant {
  if (input.source === 'challenge') return 'challenge';
  if (input.source === 'habit') return 'habit';
  if (input.source === 'quick') return 'quick';
  if (input.source === 'gratitude' || input.type === 'gratitude') return 'gratitude';
  // Spiritual is checked before the generic reading fallback. Scripture
  // tasks created from Holy Scripture have source='spiritual' AND
  // type='reading'; without this priority they would render as a book
  // reading card instead of the proper spiritual task card.
  if (input.source === 'spiritual' || input.level === 1) return 'spiritual';
  if (input.source === 'reading_book' || input.type === 'reading') return 'reading';
  return 'routine';
}

function searchLabel(input: TaskCardLookInput) {
  return `${input.title ?? ''} ${input.subtitle ?? ''} ${input.icon ?? ''}`.toLowerCase();
}

function isPrayerLike(input: TaskCardLookInput) {
  const label = searchLabel(input);
  return (
    input.type === 'prayer' ||
    input.targetView?.startsWith('/prayer') ||
    label.includes('prayer') ||
    label.includes('molit') ||
    label.includes('jesus') ||
    label.includes('isus') ||
    label.includes('morning') ||
    label.includes('jutarn') ||
    label.includes('evening') ||
    label.includes('vecer') ||
    label.includes('vecern') ||
    label.includes('čer') ||
    label.includes('čern')
  );
}

export function resolveDisplayType(input: TaskCardLookInput, variant: TaskVariant): TaskType {
  if (variant === 'spiritual' || variant === 'challenge') {
    if (isPrayerLike(input)) return 'prayer';
    if (input.targetView?.startsWith('/prayer')) return 'prayer';
    if (input.targetView?.startsWith('/journal')) return 'journal';
    if (input.targetView?.startsWith('/scripture')) return 'reading';
  }
  return (input.type ?? 'custom') as TaskType;
}

export function resolveDisplayIcon(input: TaskCardLookInput, variant: TaskVariant) {
  if (variant !== 'spiritual' && variant !== 'challenge') return input.icon;

  const label = searchLabel(input);
  const isPrayer = isPrayerLike(input);
  const isEveningPrayer =
    label.includes('evening') ||
    label.includes('vecer') ||
    label.includes('vecern') ||
    label.includes('čer') ||
    label.includes('čern');

  if (!isPrayer) return input.icon;
  if (label.includes('jesus') || label.includes('isus')) return 'Cross';
  if (isEveningPrayer) return 'Moon';
  if (label.includes('morning') || label.includes('jutarn') || label.includes('jutro')) return 'Sun';

  return input.icon ?? 'Sun';
}

export function routeForTaskInstance(instance: TaskInstance): TaskListItem['route'] {
  if (instance.targetView) return instance.targetView;
  if (instance.source === 'challenge') return '/challenges';
  if (instance.source === 'habit') return '/habits';
  if (instance.source === 'reading_book') return '/reading-list';

  switch (instance.type) {
    case 'prayer':
      return '/prayer';
    case 'reading':
      return '/scripture';
    case 'journal':
      return '/journal';
    case 'gratitude':
      return '/gratitude';
    case 'church':
      return '/my-routine';
    default:
      return undefined;
  }
}

export function taskInstanceToCard(instance: TaskInstance): TaskData {
  const variant = resolveTaskVariant(instance);
  const type = resolveDisplayType(instance, variant);
  return {
    variant,
    title: instance.title,
    time: instance.time,
    subtitle: instance.subtitle,
    state: instanceStateToCardState(instance.status),
    type,
    habitColor: instance.habitColor,
    habitIconName: resolveDisplayIcon(instance, variant),
  };
}

export function taskInstanceToListItem(
  instance: TaskInstance,
  launch?: TaskLaunchDescriptor,
): TaskListItem {
  return {
    instance,
    card: taskInstanceToCard(instance),
    route: routeForTaskInstance(instance),
    launch,
  };
}
