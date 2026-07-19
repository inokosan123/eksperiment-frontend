module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          'react-compiler': {
            // This route is a 1.1 MB generated-style component. Compiling it
            // added roughly 33 seconds to every cold iOS transform. Keep the
            // compiler enabled everywhere else and let this route use normal
            // React semantics.
            sources: filename =>
              !filename
                .replace(/\\/g, '/')
                .endsWith('/components/onboarding/OnboardingView.tsx'),
          },
        },
      ],
    ],
    plugins: ['react-native-reanimated/plugin'],
  };
};
