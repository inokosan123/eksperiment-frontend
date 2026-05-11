import { Stack } from 'expo-router';
import YearInPixelsView from '@/components/journal/YearInPixelsView';

export default function YearInPixelsScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <YearInPixelsView />
    </>
  );
}
