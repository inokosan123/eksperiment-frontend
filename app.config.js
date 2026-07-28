const bundleIdentifier = process.env.ANASTA_IOS_BUNDLE_IDENTIFIER || 'com.anasta.app';
const appGroup = process.env.ANASTA_FOCUS_APP_GROUP || `group.${bundleIdentifier}.focus`;
const easProjectId = '0d7cabc8-20b3-49cb-84f0-1036c47910d3';
const isNativeBuild = process.env.ANASTA_NATIVE_BUILD === '1' || process.env.EAS_BUILD === 'true';
const nativeRichTextEditorEnabled = (
  isNativeBuild
  && process.env.EXPO_PUBLIC_NATIVE_RICH_TEXT_EDITOR === '1'
);

module.exports = ({ config }) => {
  const { projectId: _linkedProjectId, ...easConfig } = config.extra?.eas || {};

  return {
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
      nativeRichTextEditor: nativeRichTextEditorEnabled,
      eas: {
        ...easConfig,
        ...(isNativeBuild ? { projectId: easProjectId } : {}),
      },
    },
  };
};
