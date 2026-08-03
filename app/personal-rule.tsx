import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import PersonalRuleTaskView from '@/components/prayer/PersonalRuleTaskView';
import { getLocalDateKey } from '@/components/tasks/taskScheduler';
import type { PersonalPrayerRuleChoice } from '@/components/prayer/PersonalRuleTaskView';
import {
  RoutedTaskCompletionErrorModal,
  useRoutedTaskCompletion,
} from '@/components/tasks/use-routed-task-completion';

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
  const { title, prayerType, isTask, taskInstanceId, taskDate } = useLocalSearchParams<{
    title?: string;
    prayerType?: string;
    isTask?: string;
    taskInstanceId?: string;
    taskDate?: string;
  }>();
  const completion = useRoutedTaskCompletion({
    taskInstanceId,
    taskDate: taskDate ?? getLocalDateKey(),
  });

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <PersonalRuleTaskView
        title={title}
        prayerType={prayerType}
        isTask={isTask === 'true'}
        showFinishLoader={completion.showSlowIndicator}
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
          if (!taskInstanceId) return true;
          const result = await completion.completeBeforeReturn({});
          return result.ok;
        }}
      />
      <RoutedTaskCompletionErrorModal
        visible={completion.saveErrorVisible}
        onKeepEditing={completion.keepEditing}
        onRetry={completion.retry}
      />
    </>
  );
}
