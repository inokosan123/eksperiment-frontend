import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import ReadingSessionView from '@/components/library/ReadingSessionView';
import { getLocalDateKey } from '@/components/tasks/taskScheduler';
import { useReadingList } from '@/components/library/ReadingListContext';
import {
  RoutedTaskCompletionErrorModal,
  useRoutedTaskCompletion,
} from '@/components/tasks/use-routed-task-completion';

export default function ReadingSessionScreen() {
  const router = useRouter();
  const { commitReadingSession, refresh } = useReadingList();
  const { bookId, title, author, isTask, taskInstanceId, taskDate } = useLocalSearchParams<{
    bookId?: string;
    title: string;
    author?: string;
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
      <ReadingSessionView
        bookId={bookId ?? null}
        title={title ?? 'Reading Session'}
        author={author}
        isTask={isTask === 'true'}
        showFinishLoader={completion.showSlowIndicator}
        sessionDate={taskDate}
        onBack={() => router.back()}
        onComplete={async elapsedMinutes => {
          if (!taskInstanceId) return true;
          const result = await completion.completeBeforeReturn({
            persistCritical: async () => {
              if (elapsedMinutes >= 1 && bookId) {
                await commitReadingSession(bookId, elapsedMinutes, taskDate);
              }
            },
            reconcileAfterReturn: refresh,
          });
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
