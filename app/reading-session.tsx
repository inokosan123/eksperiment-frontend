import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import ReadingSessionView from '@/components/library/ReadingSessionView';

export default function ReadingSessionScreen() {
  const router = useRouter();
  const { bookId, title, author, isTask } = useLocalSearchParams<{
    bookId?: string;
    title: string;
    author?: string;
    isTask?: string;
  }>();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ReadingSessionView
        bookId={bookId ?? null}
        title={title ?? 'Reading Session'}
        author={author}
        isTask={isTask === 'true'}
        onBack={() => router.back()}
      />
    </>
  );
}
