import type { TaskData, TaskState, TaskVariant } from '@/components/shared/TaskCards';
import type { TaskInstance, TaskListItem } from '@/components/tasks/taskTypes';

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

function instanceVariant(instance: TaskInstance): TaskVariant {
  if (instance.source === 'challenge') return 'challenge';
  if (instance.source === 'habit') return 'habit';
  if (instance.source === 'quick') return 'quick';
  if (instance.level === 1 || instance.source === 'spiritual' || instance.source === 'gratitude') return 'spiritual';
  return 'routine';
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
  const variant = instanceVariant(instance);
  return {
    variant,
    title: instance.title,
    time: instance.time,
    subtitle: instance.subtitle,
    state: instanceStateToCardState(instance.status),
    type: instance.type,
    habitColor: instance.habitColor,
    habitIconName: instance.icon,
  };
}

export function taskInstanceToListItem(instance: TaskInstance): TaskListItem {
  return {
    instance,
    card: taskInstanceToCard(instance),
    route: routeForTaskInstance(instance),
  };
}
