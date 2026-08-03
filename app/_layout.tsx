import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, EBGaramond_400Regular, EBGaramond_400Regular_Italic, EBGaramond_500Medium, EBGaramond_500Medium_Italic, EBGaramond_600SemiBold, EBGaramond_700Bold } from '@expo-google-fonts/eb-garamond';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { View, ActivityIndicator } from 'react-native';
import { C } from '@/constants/tokens';
import { BucketListProvider } from '@/components/bucket/BucketListContext';
import { InnerToolsProvider } from '@/components/inner-tools/InnerToolsContext';
import { MonthlyGoalsProvider } from '@/components/inner-tools/MonthlyGoalsContext';
import { BigEventsProvider } from '@/components/journal/BigEventsContext';
import { JournalProvider } from '@/components/journal/JournalContext';
import { ScriptureProvider } from '@/components/scripture/ScriptureContext';
import { ReadingListProvider } from '@/components/library/ReadingListContext';
import { ChallengesProvider } from '@/components/challenges/ChallengesContext';
import { TaskProvider } from '@/components/tasks/TaskProvider';
import { SettingsProvider } from '@/components/settings/SettingsContext';
import NotificationBridge from '@/components/notifications/NotificationBridge';
import { GuidedSetupProvider } from '@/components/onboarding/guided/GuidedSetupContext';
import FocusNativeCoordinator from '@/components/focus-watch/FocusNativeCoordinator';
import { NativeRichTextKeyboardBoundary } from '@/components/shared/rich-text/native-rich-text-keyboard';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    EBGaramond_400Regular,
    EBGaramond_400Regular_Italic,
    EBGaramond_500Medium,
    EBGaramond_500Medium_Italic,
    EBGaramond_600SemiBold,
    EBGaramond_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg }}>
        <ActivityIndicator color={C.gold} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NativeRichTextKeyboardBoundary>
      <SafeAreaProvider>
        <SQLiteProvider
          databaseName="anasta_bible_v1.db"
          assetSource={{ assetId: require('../assets/databases/bible.db') }}
        >
          <ScriptureProvider>
            <ReadingListProvider>
              <ChallengesProvider>
                <TaskProvider>
                  <BucketListProvider>
                    <SettingsProvider>
                      <NotificationBridge />
                      <FocusNativeCoordinator />
                      <InnerToolsProvider>
                        <BigEventsProvider>
                          <MonthlyGoalsProvider>
                            <JournalProvider>
                              <GuidedSetupProvider>
                                <Stack>
                                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                                  <Stack.Screen name="prayer"          options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                                  <Stack.Screen name="personal-rule"   options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                                  <Stack.Screen name="jesus-prayer"    options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                                  <Stack.Screen name="journal"         options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                                  <Stack.Screen name="journal-daily"   options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                                  <Stack.Screen name="journal-daily-guided" options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                                  <Stack.Screen name="rich-text-lab" options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                                  <Stack.Screen name="journal-morning" options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                                  <Stack.Screen name="journal-free"    options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                                  <Stack.Screen name="bucket-list"     options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                                  <Stack.Screen name="big-events"      options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                                  <Stack.Screen name="focus-zone"      options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                                  <Stack.Screen name="focus-intervention" options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                                  <Stack.Screen name="focus-never-allowed" options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                                  <Stack.Screen name="day-plans"       options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                                  <Stack.Screen name="day-plan"        options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                                  <Stack.Screen name="day-plan-today"  options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                                  <Stack.Screen name="clean-sight"     options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                                  <Stack.Screen name="focus-analytics" options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                                  <Stack.Screen name="notes"           options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                                  <Stack.Screen name="scripture"       options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                                  <Stack.Screen name="scripture-reader" options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                                  <Stack.Screen name="scripture-challenge" options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                                  <Stack.Screen name="scripture-checkpoint" options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                                  <Stack.Screen name="favorites"       options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                                  <Stack.Screen name="bible-notes"     options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                                  <Stack.Screen name="gratitude"       options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                                  <Stack.Screen name="gratitude-task"  options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                                  <Stack.Screen name="ideal-self"      options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                                  <Stack.Screen name="reading-list"    options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                                  <Stack.Screen name="reading-analytics" options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                                  <Stack.Screen name="reading-session"   options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                                  <Stack.Screen name="habits"          options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                                  <Stack.Screen name="challenges"      options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                                  <Stack.Screen name="my-routine"      options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                                  <Stack.Screen name="year-in-pixels"  options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                                  <Stack.Screen name="monthly-goals"   options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                                  <Stack.Screen name="statistics"      options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                                  <Stack.Screen name="settings"        options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                                  <Stack.Screen name="account"         options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                                  <Stack.Screen name="onboarding"      options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }} />
                                </Stack>
                              </GuidedSetupProvider>
                            </JournalProvider>
                          </MonthlyGoalsProvider>
                        </BigEventsProvider>
                      </InnerToolsProvider>
                    </SettingsProvider>
                    <StatusBar style="dark" backgroundColor={C.bg} />
                  </BucketListProvider>
                </TaskProvider>
              </ChallengesProvider>
            </ReadingListProvider>
          </ScriptureProvider>
        </SQLiteProvider>
      </SafeAreaProvider>
      </NativeRichTextKeyboardBoundary>
    </GestureHandlerRootView>
  );
}
