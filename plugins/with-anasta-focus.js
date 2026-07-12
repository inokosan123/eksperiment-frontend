const fs = require('fs');
const path = require('path');
const plist = require('plist');
const {
  withDangerousMod,
  withEntitlementsPlist,
  withInfoPlist,
  withXcodeProject,
} = require('expo/config-plugins');

const EXTENSIONS = [
  {
    targetName: 'AnastaDeviceActivityMonitor',
    bundleSuffix: 'focus-monitor',
    pointIdentifier: 'com.apple.deviceactivity.monitor-extension',
    principalClass: 'AnastaDeviceActivityMonitor',
  },
  {
    targetName: 'AnastaShieldConfiguration',
    bundleSuffix: 'focus-shield-configuration',
    pointIdentifier: 'com.apple.ManagedSettingsUI.shield-configuration-service',
    principalClass: 'AnastaShieldConfiguration',
  },
  {
    targetName: 'AnastaShieldAction',
    bundleSuffix: 'focus-shield-action',
    pointIdentifier: 'com.apple.ManagedSettings.shield-action-service',
    principalClass: 'AnastaShieldAction',
  },
  {
    targetName: 'AnastaActivityReport',
    bundleSuffix: 'focus-activity-report',
    pointIdentifier: 'com.apple.deviceactivityui.report-extension',
    principalClass: null,
    includeSharedEngine: false,
  },
];

function extensionEntitlements(appGroup) {
  return {
    'com.apple.developer.family-controls': true,
    'com.apple.security.application-groups': [appGroup],
  };
}

function withExtensionFiles(config, options) {
  return withDangerousMod(config, [
    'ios',
    async modConfig => {
      const sourceRoot = path.join(
        modConfig.modRequest.projectRoot,
        'modules',
        'anasta-focus',
        'ios',
        'extensions'
      );
      const iosRoot = modConfig.modRequest.platformProjectRoot;

      for (const extension of options.extensions) {
        const destination = path.join(iosRoot, extension.targetName);
        fs.mkdirSync(destination, { recursive: true });
        fs.copyFileSync(
          path.join(sourceRoot, `${extension.targetName}.swift`),
          path.join(destination, `${extension.targetName}.swift`)
        );
        fs.copyFileSync(
          path.join(sourceRoot, '..', 'AnastaFocusEngine.swift'),
          path.join(destination, 'AnastaFocusExtensionShared.swift')
        );
        const extensionInfo = {
          NSExtensionPointIdentifier: extension.pointIdentifier,
        };
        if (extension.principalClass) {
          extensionInfo.NSExtensionPrincipalClass = `$(PRODUCT_MODULE_NAME).${extension.principalClass}`;
        }
        fs.writeFileSync(
          path.join(destination, `${extension.targetName}-Info.plist`),
          plist.build({
            CFBundleDisplayName: extension.targetName,
            CFBundleIdentifier: '$(PRODUCT_BUNDLE_IDENTIFIER)',
            CFBundleInfoDictionaryVersion: '6.0',
            CFBundleName: '$(PRODUCT_NAME)',
            CFBundlePackageType: 'XPC!',
            CFBundleShortVersionString: '$(MARKETING_VERSION)',
            CFBundleVersion: '$(CURRENT_PROJECT_VERSION)',
            AnastaFocusAppGroup: options.appGroup,
            NSExtension: extensionInfo,
          })
        );
        fs.writeFileSync(
          path.join(destination, `${extension.targetName}.entitlements`),
          plist.build(extensionEntitlements(options.appGroup))
        );
      }
      return modConfig;
    },
  ]);
}

function configureTargetBuildSettings(project, target, extension) {
  const configList = project.pbxXCConfigurationList()[target.pbxNativeTarget.buildConfigurationList];
  const configurations = project.pbxXCBuildConfigurationSection();
  for (const item of configList.buildConfigurations) {
    const settings = configurations[item.value].buildSettings;
    settings.APPLICATION_EXTENSION_API_ONLY = 'YES';
    settings.CODE_SIGN_ENTITLEMENTS = `"${extension.targetName}/${extension.targetName}.entitlements"`;
    settings.CURRENT_PROJECT_VERSION = '1';
    settings.IPHONEOS_DEPLOYMENT_TARGET = '16.0';
    settings.MARKETING_VERSION = '1.0';
    settings.PRODUCT_BUNDLE_IDENTIFIER = `"${extension.bundleIdentifier}"`;
    settings.SWIFT_EMIT_LOC_STRINGS = 'YES';
    settings.SWIFT_VERSION = '5.0';
    settings.TARGETED_DEVICE_FAMILY = '1';
  }
}

function withExtensionTargets(config, options) {
  return withXcodeProject(config, modConfig => {
    const project = modConfig.modResults;
    for (const extension of options.extensions) {
      if (project.pbxTargetByName(extension.targetName)) continue;
      const target = project.addTarget(
        extension.targetName,
        'app_extension',
        extension.targetName,
        extension.bundleIdentifier
      );
      project.addBuildPhase(
        [
          `${extension.targetName}/${extension.targetName}.swift`,
          ...(extension.includeSharedEngine === false
            ? []
            : [`${extension.targetName}/AnastaFocusExtensionShared.swift`]),
        ],
        'PBXSourcesBuildPhase',
        'Sources',
        target.uuid
      );
      project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid);
      configureTargetBuildSettings(project, target, extension);
    }
    return modConfig;
  });
}

module.exports = function withAnastaFocus(config, props = {}) {
  const bundleIdentifier = props.bundleIdentifier || config.ios?.bundleIdentifier || 'com.anasta.app';
  const appGroup = props.appGroup || `group.${bundleIdentifier}.focus`;
  const options = {
    bundleIdentifier,
    appGroup,
    extensions: EXTENSIONS.map(extension => ({
      ...extension,
      bundleIdentifier: `${bundleIdentifier}.${extension.bundleSuffix}`,
    })),
  };

  config = withEntitlementsPlist(config, modConfig => {
    modConfig.modResults['com.apple.developer.family-controls'] = true;
    modConfig.modResults['com.apple.security.application-groups'] = [appGroup];
    return modConfig;
  });
  config = withInfoPlist(config, modConfig => {
    modConfig.modResults.AnastaFocusAppGroup = appGroup;
    return modConfig;
  });
  config = withExtensionFiles(config, options);
  config = withExtensionTargets(config, options);

  config.extra = config.extra || {};
  config.extra.eas = config.extra.eas || {};
  config.extra.eas.build = config.extra.eas.build || {};
  config.extra.eas.build.experimental = config.extra.eas.build.experimental || {};
  config.extra.eas.build.experimental.ios = config.extra.eas.build.experimental.ios || {};
  config.extra.eas.build.experimental.ios.appExtensions = options.extensions.map(extension => ({
    targetName: extension.targetName,
    bundleIdentifier: extension.bundleIdentifier,
    entitlements: extensionEntitlements(appGroup),
  }));

  return config;
};
