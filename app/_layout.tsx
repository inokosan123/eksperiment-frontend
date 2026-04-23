import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, EBGaramond_400Regular, EBGaramond_400Regular_Italic, EBGaramond_500Medium, EBGaramond_500Medium_Italic, EBGaramond_600SemiBold, EBGaramond_700Bold } from '@expo-google-fonts/eb-garamond';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { View, ActivityIndicator } from 'react-native';
import { C } from '@/constants/tokens';
import { BucketListProvider } from '@/components/bucket/BucketListContext';
import { InnerToolsProvider } from '@/components/inner-tools/InnerToolsContext';
import { ScriptureProvider } from '@/components/scripture/ScriptureContext';
import { ReadingListProvider } from '@/components/library/ReadingListContext';
import { ChallengesProvider } from '@/components/challenges/ChallengesContext';

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
    <SafeAreaProvider>
      <SQLiteProvider
        databaseName="bible.db"
        assetSource={{ assetId: require('../assets/databases/bible.db') }}
      >
        <ScriptureProvider>
          <ReadingListProvider>
            <ChallengesProvider>
              <BucketListProvider>
                <InnerToolsProvider>
                  <Stack>
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    <Stack.Screen name="prayer"          options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                    <Stack.Screen name="journal"         options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                    <Stack.Screen name="journal-daily"   options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                    <Stack.Screen name="journal-morning" options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                    <Stack.Screen name="journal-free"    options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                    <Stack.Screen name="bucket-list"     options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                    <Stack.Screen name="focus-zone"      options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                    <Stack.Screen name="notes"           options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                    <Stack.Screen name="scripture"       options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                    <Stack.Screen name="scripture-reader" options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                    <Stack.Screen name="favorites"       options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                    <Stack.Screen name="bible-notes"     options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                    <Stack.Screen name="gratitude"       options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                    <Stack.Screen name="ideal-self"      options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                    <Stack.Screen name="reading-list"    options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                    <Stack.Screen name="reading-analytics" options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                    <Stack.Screen name="habits"          options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                    <Stack.Screen name="challenges"      options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                    <Stack.Screen name="my-routine"      options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
                  </Stack>
                </InnerToolsProvider>
                <StatusBar style="dark" backgroundColor={C.bg} />
              </BucketListProvider>
            </ChallengesProvider>
          </ReadingListProvider>
        </ScriptureProvider>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
