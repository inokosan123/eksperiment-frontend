import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import PersonalRuleTaskView from '@/components/prayer/PersonalRuleTaskView';
import { useTasks } from '@/components/tasks/TaskProvider';
import { getLocalDateKey } from '@/components/tasks/taskScheduler';
import { queueTaskCompletionReturnAnimation } from '@/components/tasks/taskReturnAnimation';
import type { PersonalPrayerRuleChoice } from '@/components/prayer/PersonalRuleTaskView';

function categoryForPrayerType(prayerType?: string) {
  return prayerType === 'evening' ? 'evening' : 'morning';
}

function optionIdForRule(rule: PersonalPrayerRuleChoice) {
  if (rule === 'seraphim') return 'short';
  if (rule === 'short') return 'medium';
  return 'standard';
}

export default function PersonalRuleScreen() {
  const router = useRouter();
  const { completeInstance } = useTasks();
  const { title, prayerType, isTask, taskInstanceId, taskDate } = useLocalSearchParams<{
    title?: string;
    prayerType?: string;
    isTask?: string;
    taskInstanceId?: string;
    taskDate?: string;
  }>();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <PersonalRuleTaskView
        title={title}
        prayerType={prayerType}
        isTask={isTask === 'true'}
        selectedRule="personal"
        onBack={() => router.back()}
        onRuleChange={rule => {
          if (rule === 'personal') return;
          router.replace({
            pathname: '/prayer',
            params: {
              category: categoryForPrayerType(prayerType),
              optionId: optionIdForRule(rule),
              autoStart: 'true',
              isTask: isTask === 'true' ? 'true' : 'false',
              taskInstanceId: taskInstanceId ?? '',
              taskDate: taskDate ?? getLocalDateKey(),
            },
          } as any);
        }}
        onComplete={async () => {
          if (taskInstanceId) {
            await completeInstance(taskInstanceId, taskDate ?? getLocalDateKey());
            queueTaskCompletionReturnAnimation(taskInstanceId);
          }
        }}
      />
    </>
  );
}
