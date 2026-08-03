const fs = require('fs');
const path = require('path');
const plist = require('plist');
const {
  withDangerousMod,
  withEntitlementsPlist,
  withInfoPlist,
  withXcodeProject,
} = require('expo/config-plugins');

const ANALYTICS_SWIFT_SOURCES = [
  'AnastaAnalyticsPure.swift',
  'AnastaAnalyticsModels.swift',
  'AnastaAnalyticsMetadata.swift',
  'AnastaAnalyticsCollector.swift',
  'AnastaAnalyticsInsight.swift',
  'AnastaAnalyticsStyles.swift',
  'AnastaAnalyticsCharts.swift',
  'AnastaAnalyticsLifePerspective.swift',
  'AnastaAnalyticsReport.swift',
];

const ANALYTICS_TEST_TARGET = 'AnastaAnalyticsTests';
const ANALYTICS_TEST_SOURCES = [
  'AnastaAnalyticsPure.swift',
  'AnastaAnalyticsPureTests.swift',
];

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
    extraSwiftSources: ANALYTICS_SWIFT_SOURCES,
    frameworks: ['Charts.framework'],
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
        const sharedEngineDestination = path.join(
          destination,
          'AnastaFocusExtensionShared.swift'
        );
        if (extension.includeSharedEngine === false) {
          if (fs.existsSync(sharedEngineDestination)) {
            fs.unlinkSync(sharedEngineDestination);
          }
        } else {
          fs.copyFileSync(
            path.join(sourceRoot, '..', 'AnastaFocusEngine.swift'),
            sharedEngineDestination
          );
        }
        for (const sourceName of extension.extraSwiftSources || []) {
          fs.copyFileSync(
            path.join(sourceRoot, 'analytics', sourceName),
            path.join(destination, sourceName)
          );
        }
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

      const analyticsTestsDestination = path.join(
        iosRoot,
        ANALYTICS_TEST_TARGET
      );
      fs.mkdirSync(analyticsTestsDestination, { recursive: true });
      fs.copyFileSync(
        path.join(
          sourceRoot,
          'analytics',
          'AnastaAnalyticsPure.swift'
        ),
        path.join(
          analyticsTestsDestination,
          'AnastaAnalyticsPure.swift'
        )
      );
      fs.copyFileSync(
        path.join(
          sourceRoot,
          '..',
          'tests',
          'AnastaAnalyticsPureTests.swift'
        ),
        path.join(
          analyticsTestsDestination,
          'AnastaAnalyticsPureTests.swift'
        )
      );
      return modConfig;
    },
  ]);
}

function configureTargetBuildSettings(project, targetObject, extension, options) {
  const configList = project.pbxXCConfigurationList()[targetObject.buildConfigurationList];
  const configurations = project.pbxXCBuildConfigurationSection();
  for (const item of configList.buildConfigurations) {
    const settings = configurations[item.value].buildSettings;
    settings.APPLICATION_EXTENSION_API_ONLY = 'YES';
    settings.CODE_SIGN_ENTITLEMENTS = `"${extension.targetName}/${extension.targetName}.entitlements"`;
    settings.CURRENT_PROJECT_VERSION = String(options.buildNumber);
    settings.GENERATE_INFOPLIST_FILE = 'NO';
    settings.INFOPLIST_FILE = `"${extension.targetName}/${extension.targetName}-Info.plist"`;
    settings.IPHONEOS_DEPLOYMENT_TARGET = '16.0';
    settings.MARKETING_VERSION = String(options.marketingVersion);
    settings.PRODUCT_BUNDLE_IDENTIFIER = `"${extension.bundleIdentifier}"`;
    settings.PRODUCT_NAME = '"$(TARGET_NAME)"';
    settings.SKIP_INSTALL = 'YES';
    settings.SWIFT_EMIT_LOC_STRINGS = 'YES';
    settings.SWIFT_VERSION = '5.0';
    settings.TARGETED_DEVICE_FAMILY = '1';
  }
}

function configureAnalyticsTestBuildSettings(
  project,
  targetObject,
  options
) {
  const configList = project.pbxXCConfigurationList()[
    targetObject.buildConfigurationList
  ];
  const configurations = project.pbxXCBuildConfigurationSection();
  for (const item of configList.buildConfigurations) {
    const settings = configurations[item.value].buildSettings;
    delete settings.APPLICATION_EXTENSION_API_ONLY;
    delete settings.BUNDLE_LOADER;
    delete settings.CODE_SIGN_ENTITLEMENTS;
    delete settings.INFOPLIST_FILE;
    delete settings.TEST_HOST;
    settings.CLANG_ENABLE_MODULES = 'YES';
    settings.CURRENT_PROJECT_VERSION = String(options.buildNumber);
    settings.ENABLE_TESTABILITY = 'YES';
    settings.GENERATE_INFOPLIST_FILE = 'YES';
    settings.IPHONEOS_DEPLOYMENT_TARGET = '16.0';
    settings.MARKETING_VERSION = String(options.marketingVersion);
    settings.PRODUCT_BUNDLE_IDENTIFIER =
      `"${options.bundleIdentifier}.analytics-tests"`;
    settings.PRODUCT_NAME = '"$(TARGET_NAME)"';
    settings.SKIP_INSTALL = 'YES';
    settings.SWIFT_VERSION = '5.0';
    settings.TARGETED_DEVICE_FAMILY = '1';
    settings.WRAPPER_EXTENSION = 'xctest';
  }
}

function phaseContainsFile(phase, basename) {
  return !!phase?.files?.some(file =>
    String(file.comment || '').replace(/^"|"$/g, '') === `${basename} in Sources`
    || String(file.comment || '').replace(/^"|"$/g, '') === `${basename} in Frameworks`
  );
}

function findFileReference(project, filePath) {
  const normalizedPath = filePath.replace(/\\/g, '/').replace(/^"|"$/g, '');
  const basename = path.basename(normalizedPath);
  const section = project.pbxFileReferenceSection();
  for (const [key, value] of Object.entries(section)) {
    if (key.endsWith('_comment') || !value || typeof value !== 'object') continue;
    const candidate = String(value.path || value.name || '')
      .replace(/^"|"$/g, '')
      .replace(/\\/g, '/');
    if (candidate === normalizedPath || candidate.endsWith(`/${normalizedPath}`)) {
      return { key, basename };
    }
  }
  return null;
}

function addExistingReferenceToPhase(project, phase, fileReference, group) {
  const buildFileUuid = project.generateUuid();
  const comment = `${fileReference.basename} in ${group}`;
  const section = project.pbxBuildFileSection();
  section[buildFileUuid] = {
    isa: 'PBXBuildFile',
    fileRef: fileReference.key,
    fileRef_comment: fileReference.basename,
  };
  section[`${buildFileUuid}_comment`] = comment;
  phase.files.push({ value: buildFileUuid, comment });
}

function ensureSourceFiles(project, targetUuid, sourcePaths) {
  let phase = project.pbxSourcesBuildPhaseObj(targetUuid);
  if (!phase) {
    project.addBuildPhase(
      sourcePaths,
      'PBXSourcesBuildPhase',
      'Sources',
      targetUuid
    );
    return;
  }

  for (const sourcePath of sourcePaths) {
    const basename = path.basename(sourcePath);
    if (phaseContainsFile(phase, basename)) continue;
    const added = project.addSourceFile(sourcePath, { target: targetUuid });
    if (added) continue;
    const existing = findFileReference(project, sourcePath);
    if (!existing) {
      throw new Error(`Unable to add ${sourcePath} to the Anasta extension target.`);
    }
    addExistingReferenceToPhase(project, phase, existing, 'Sources');
  }
}

function ensureFrameworks(project, targetUuid, frameworks) {
  let phase = project.pbxFrameworksBuildPhaseObj(targetUuid);
  if (!phase) {
    project.addBuildPhase(
      [],
      'PBXFrameworksBuildPhase',
      'Frameworks',
      targetUuid
    );
    phase = project.pbxFrameworksBuildPhaseObj(targetUuid);
  }

  for (const framework of frameworks) {
    const basename = path.basename(framework);
    if (phaseContainsFile(phase, basename)) continue;
    const added = project.addFramework(framework, { target: targetUuid });
    if (added) continue;
    const existing = findFileReference(project, framework);
    if (!existing) {
      throw new Error(`Unable to link ${framework} to the Anasta extension target.`);
    }
    addExistingReferenceToPhase(project, phase, existing, 'Frameworks');
  }
}

function findTargetUuid(project, targetName) {
  const section = project.pbxNativeTargetSection();
  for (const [key, value] of Object.entries(section)) {
    if (
      key.endsWith('_comment')
      && String(value).replace(/^"|"$/g, '') === targetName
    ) {
      return key.slice(0, -'_comment'.length);
    }
    if (
      !key.endsWith('_comment')
      && value
      && typeof value === 'object'
      && String(value.name || '').replace(/^"|"$/g, '') === targetName
    ) {
      return key;
    }
  }
  return null;
}

function removeTargetDependency(
  project,
  parentTargetUuid,
  dependencyTargetUuid
) {
  const nativeTargets = project.pbxNativeTargetSection();
  const parent = nativeTargets[parentTargetUuid];
  if (!parent?.dependencies?.length) return;

  const dependencySection =
    project.hash?.project?.objects?.PBXTargetDependency || {};
  const proxySection =
    project.hash?.project?.objects?.PBXContainerItemProxy || {};
  parent.dependencies = parent.dependencies.filter(reference => {
    const dependency = dependencySection[reference.value];
    if (dependency?.target !== dependencyTargetUuid) {
      return true;
    }
    const proxyUuid = dependency.targetProxy;
    delete dependencySection[reference.value];
    delete dependencySection[`${reference.value}_comment`];
    if (proxyUuid) {
      delete proxySection[proxyUuid];
      delete proxySection[`${proxyUuid}_comment`];
    }
    return false;
  });
}

function normalizeAnalyticsTestProduct(project, targetObject) {
  const productReferenceUuid = targetObject?.productReference;
  if (!productReferenceUuid) {
    throw new Error(
      `${ANALYTICS_TEST_TARGET} is missing its Xcode product reference.`
    );
  }

  const expectedProductName = `${ANALYTICS_TEST_TARGET}.xctest`;
  const quotedProductName = `"${expectedProductName}"`;
  const fileReferences = project.pbxFileReferenceSection();
  const productReference = fileReferences[productReferenceUuid];
  if (!productReference || typeof productReference !== 'object') {
    throw new Error(
      `${ANALYTICS_TEST_TARGET} has an invalid Xcode product reference.`
    );
  }

  // node-xcode maps wrapper.cfbundle to the first matching extension in its
  // table, which is currently `.mdimporter`. A unit-test product must be an
  // `.xctest` bundle or Xcode cannot resolve the product named by the scheme.
  productReference.name = quotedProductName;
  productReference.path = quotedProductName;
  productReference.explicitFileType = '"wrapper.cfbundle"';
  fileReferences[`${productReferenceUuid}_comment`] = expectedProductName;
  targetObject.productReference_comment = expectedProductName;

  const buildFiles = project.pbxBuildFileSection();
  for (const [key, value] of Object.entries(buildFiles)) {
    if (key.endsWith('_comment')) continue;
    if (value?.fileRef !== productReferenceUuid) continue;
    value.fileRef_comment = expectedProductName;
    buildFiles[`${key}_comment`] =
      `${expectedProductName} in Copy Files`;
  }

  const groups = project.hash?.project?.objects?.PBXGroup || {};
  for (const [key, value] of Object.entries(groups)) {
    if (key.endsWith('_comment') || !Array.isArray(value?.children)) continue;
    for (const child of value.children) {
      if (child?.value === productReferenceUuid) {
        child.comment = expectedProductName;
      }
    }
  }
}

function ensureAnalyticsTestTarget(project, options) {
  let targetObject = project.pbxTargetByName(ANALYTICS_TEST_TARGET);
  let targetUuid = findTargetUuid(project, ANALYTICS_TEST_TARGET);
  if (!targetObject || !targetUuid) {
    const target = project.addTarget(
      ANALYTICS_TEST_TARGET,
      'unit_test_bundle',
      ANALYTICS_TEST_TARGET,
      `${options.bundleIdentifier}.analytics-tests`
    );
    targetObject = target.pbxNativeTarget;
    targetUuid = target.uuid;
  }

  normalizeAnalyticsTestProduct(project, targetObject);
  const appTargetUuid = project.getFirstTarget().uuid;
  removeTargetDependency(project, appTargetUuid, targetUuid);
  ensureSourceFiles(
    project,
    targetUuid,
    ANALYTICS_TEST_SOURCES.map(
      source => `${ANALYTICS_TEST_TARGET}/${source}`
    )
  );
  ensureFrameworks(project, targetUuid, ['XCTest.framework']);
  configureAnalyticsTestBuildSettings(project, targetObject, options);
  return targetUuid;
}

function analyticsTestSchemeXml(targetUuid, projectContainer) {
  const reference = `
            <BuildableReference
               BuildableIdentifier = "primary"
               BlueprintIdentifier = "${targetUuid}"
               BuildableName = "${ANALYTICS_TEST_TARGET}.xctest"
               BlueprintName = "${ANALYTICS_TEST_TARGET}"
               ReferencedContainer = "container:${projectContainer}">
            </BuildableReference>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<Scheme
   LastUpgradeVersion = "1600"
   version = "1.7">
   <BuildAction
      parallelizeBuildables = "YES"
      buildImplicitDependencies = "YES">
      <BuildActionEntries>
         <BuildActionEntry
            buildForTesting = "YES"
            buildForRunning = "NO"
            buildForProfiling = "NO"
            buildForArchiving = "NO"
            buildForAnalyzing = "YES">${reference}
         </BuildActionEntry>
      </BuildActionEntries>
   </BuildAction>
   <TestAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      shouldUseLaunchSchemeArgsEnv = "YES">
      <Testables>
         <TestableReference
            skipped = "NO"
            parallelizable = "YES">${reference}
         </TestableReference>
      </Testables>
   </TestAction>
   <AnalyzeAction
      buildConfiguration = "Debug">
   </AnalyzeAction>
   <ArchiveAction
      buildConfiguration = "Release"
      revealArchiveInOrganizer = "NO">
   </ArchiveAction>
</Scheme>
`;
}

function ensureAnalyticsTestScheme(project, targetUuid) {
  const projectContainer = path.basename(path.dirname(project.filepath));
  const schemeDirectory = path.join(
    path.dirname(project.filepath),
    'xcshareddata',
    'xcschemes'
  );
  fs.mkdirSync(schemeDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(schemeDirectory, `${ANALYTICS_TEST_TARGET}.xcscheme`),
    analyticsTestSchemeXml(targetUuid, projectContainer)
  );
}

function withExtensionTargets(config, options) {
  return withXcodeProject(config, modConfig => {
    const project = modConfig.modResults;
    for (const extension of options.extensions) {
      let targetObject = project.pbxTargetByName(extension.targetName);
      let targetUuid = findTargetUuid(project, extension.targetName);
      if (!targetObject || !targetUuid) {
        const target = project.addTarget(
          extension.targetName,
          'app_extension',
          extension.targetName,
          extension.bundleIdentifier
        );
        targetObject = target.pbxNativeTarget;
        targetUuid = target.uuid;
      }

      const sourcePaths = [
        `${extension.targetName}/${extension.targetName}.swift`,
        ...(extension.includeSharedEngine === false
          ? []
          : [`${extension.targetName}/AnastaFocusExtensionShared.swift`]),
        ...(extension.extraSwiftSources || []).map(
          sourceName => `${extension.targetName}/${sourceName}`
        ),
      ];
      ensureSourceFiles(project, targetUuid, sourcePaths);
      ensureFrameworks(project, targetUuid, extension.frameworks || []);
      configureTargetBuildSettings(
        project,
        targetObject,
        extension,
        options
      );
    }
    const analyticsTestTargetUuid = ensureAnalyticsTestTarget(
      project,
      options
    );
    ensureAnalyticsTestScheme(project, analyticsTestTargetUuid);
    return modConfig;
  });
}

function createExtensionManifest(config, props) {
  const bundleIdentifier = props.bundleIdentifier
    || config.ios?.bundleIdentifier
    || 'com.anasta.app';
  const appGroup = props.appGroup || `group.${bundleIdentifier}.focus`;
  return {
    bundleIdentifier,
    appGroup,
    marketingVersion: config.version || '1.0.0',
    buildNumber: config.ios?.buildNumber || '1',
    extensions: EXTENSIONS.map(extension => ({
      ...extension,
      bundleIdentifier: `${bundleIdentifier}.${extension.bundleSuffix}`,
    })),
  };
}

module.exports = function withAnastaFocus(config, props = {}) {
  const options = createExtensionManifest(config, props);
  const { appGroup } = options;

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

module.exports.__internal = {
  ANALYTICS_TEST_SOURCES,
  ANALYTICS_TEST_TARGET,
  ANALYTICS_SWIFT_SOURCES,
  analyticsTestSchemeXml,
  configureAnalyticsTestBuildSettings,
  configureTargetBuildSettings,
  createExtensionManifest,
  ensureFrameworks,
  ensureAnalyticsTestTarget,
  ensureAnalyticsTestScheme,
  ensureSourceFiles,
  extensionEntitlements,
  findTargetUuid,
  normalizeAnalyticsTestProduct,
  removeTargetDependency,
};
