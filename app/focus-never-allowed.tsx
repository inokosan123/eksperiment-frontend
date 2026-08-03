import { Stack } from 'expo-router';
import NeverAllowedView from '@/components/focus-watch/NeverAllowedView';

export default function FocusNeverAllowedScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <NeverAllowedView />
    </>
  );
}
