import Constants from 'expo-constants';

type AnastaExtra = {
  nativeRichTextEditor?: boolean;
};

/**
 * Expo Go does not contain the native Enriched view. The development EAS
 * profile (or an explicit local custom-build command) sets the public pilot
 * flag. ANASTA_NATIVE_BUILD alone only controls native build configuration and
 * intentionally does not activate this runtime feature.
 */
export function isNativeRichTextEditorEnabled() {
  const extra = Constants.expoConfig?.extra as AnastaExtra | undefined;
  return (
    extra?.nativeRichTextEditor === true
    || process.env.EXPO_PUBLIC_NATIVE_RICH_TEXT_EDITOR === '1'
  );
}
