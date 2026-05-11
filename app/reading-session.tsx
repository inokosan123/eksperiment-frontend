import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import ReadingSessionView from '@/components/library/ReadingSessionView';
import { useTasks } from '@/components/tasks/TaskProvider';
import { getLocalDateKey } from '@/components/tasks/taskScheduler';

export default function ReadingSessionScreen() {
  const router = useRouter();
  const { completeInstance } = useTasks();
  const { bookId, title, author, isTask, taskInstanceId, taskDate } = useLocalSearchParams<{
    bookId?: string;
    title: string;
    author?: string;
    isTask?: string;
    taskInstanceId?: string;
    taskDate?: string;
  }>();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ReadingSessionView
        bookId={bookId ?? null}
        title={title ?? 'Reading Session'}
        author={author}
        isTask={isTask === 'true'}
        sessionDate={taskDate}
        onBack={() => router.back()}
        onComplete={() => {
          if (taskInstanceId) {
            return completeInstance(taskInstanceId, taskDate ?? getLocalDateKey());
          }
          return undefined;
        }}
      />
    </>
  );
}
