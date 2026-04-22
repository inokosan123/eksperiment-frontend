import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, EBGaramond_400Regular, EBGaramond_400Regular_Italic, EBGaramond_500Medium, EBGaramond_500Medium_Italic, EBGaramond_600SemiBold, EBGaramond_700Bold } from '@expo-google-fonts/eb-garamond';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { View, ActivityIndicator } from 'react-native';
import { C } from '@/constants/tokens';

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
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="prayer"          options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
        <Stack.Screen name="journal"         options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
        <Stack.Screen name="journal-daily"   options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
        <Stack.Screen name="journal-morning" options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
        <Stack.Screen name="journal-free"    options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />
      </Stack>
      <StatusBar style="dark" backgroundColor={C.bg} />
    </SafeAreaProvider>
  );
}
