module.exports = function (api) {
  api.cache(true);

  const reactCompilerExcludedFiles = [
    '/components/onboarding/OnboardingView.tsx',
    // Reanimated currently recommends opting troublesome worklet-heavy
    // components out of React Compiler. Keep the visual/animation code intact
    // and skip only the compiler pass for the worklet-heavy Focus routes that terminate
    // Expo Go on iOS.
    '/components/focus-watch/DayPlanHubView.tsx',
    '/components/focus-watch/PurityView.tsx',
    '/components/focus-watch/NeverAllowedView.tsx',
  ];

  return {
    presets: [
      [
        'babel-preset-expo',
        {
          'react-compiler': {
            sources: filename => {
              const normalizedFilename = filename.replace(/\\/g, '/');
              const excludedFile = reactCompilerExcludedFiles.some(file => (
                normalizedFilename.endsWith(file)
              ));
              return !excludedFile;
            },
          },
        },
      ],
    ],
    // Expo SDK 54 configures the Worklets/Reanimated transform through
    // babel-preset-expo. Keep only app-owned transforms here so a worklet is
    // never compiled twice or by a plugin that differs from Expo Go's runtime.
    plugins: ['./scripts/babel-plugin-fixed-native-text.cjs'],
  };
};
