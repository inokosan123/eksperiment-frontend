import { Stack } from 'expo-router';
import MonthlyGoalsView from '@/components/inner-tools/MonthlyGoalsView';

export default function MonthlyGoalsScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <MonthlyGoalsView />
    </>
  );
}
