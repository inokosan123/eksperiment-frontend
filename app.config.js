const bundleIdentifier = process.env.ANASTA_IOS_BUNDLE_IDENTIFIER || 'com.anasta.app';
const appGroup = process.env.ANASTA_FOCUS_APP_GROUP || `group.${bundleIdentifier}.focus`;

module.exports = ({ config }) => ({
  ...config,
    ios: {
      ...config.ios,
      bundleIdentifier,
      entitlements: {
        ...(config.ios?.entitlements || {}),
        'com.apple.developer.family-controls': true,
        'com.apple.security.application-groups': [appGroup],
      },
      infoPlist: {
        ...(config.ios?.infoPlist || {}),
        AnastaFocusAppGroup: appGroup,
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    plugins: [
      ...(config.plugins || []),
      [
        'expo-build-properties',
        { ios: { deploymentTarget: '16.0' } },
      ],
      [
        './plugins/with-anasta-focus',
        { bundleIdentifier, appGroup },
      ],
    ],
    extra: {
      ...(config.extra || {}),
      anastaFocus: { bundleIdentifier, appGroup },
    },
});
