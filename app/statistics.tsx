import { Stack } from 'expo-router';
import StatisticsView from '@/components/analytics/StatisticsView';

export default function StatisticsScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatisticsView />
    </>
  );
}
