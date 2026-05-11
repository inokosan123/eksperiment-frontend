import { Stack } from 'expo-router';
import GratitudeTaskView from '@/components/inner-tools/GratitudeTaskView';

export default function GratitudeTaskScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <GratitudeTaskView />
    </>
  );
}
