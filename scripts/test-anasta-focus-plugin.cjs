/* global __dirname */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DOMParser } = require('@xmldom/xmldom');
const xcode = require('xcode');
const withAnastaFocus = require('../plugins/with-anasta-focus');

const {
  ANALYTICS_TEST_SOURCES,
  ANALYTICS_TEST_TARGET,
  ANALYTICS_SWIFT_SOURCES,
  analyticsTestSchemeXml,
  configureAnalyticsTestBuildSettings,
  configureTargetBuildSettings,
  createExtensionManifest,
  ensureFrameworks,
  ensureSourceFiles,
  findTargetUuid,
  normalizeAnalyticsTestProduct,
  removeTargetDependency,
} = withAnastaFocus.__internal;

const fixture = {
  name: 'Anasta',
  slug: 'anasta',
  version: '2.7.3',
  ios: {
    bundleIdentifier: 'com.example.anasta',
    buildNumber: '84',
  },
};
const props = {
  bundleIdentifier: 'com.example.anasta',
  appGroup: 'group.com.example.anasta.focus',
};

const manifest = createExtensionManifest(fixture, props);
assert.equal(manifest.marketingVersion, '2.7.3');
assert.equal(manifest.buildNumber, '84');
assert.equal(manifest.extensions.length, 4);
assert.equal(new Set(manifest.extensions.map(item => item.targetName)).size, 4);
assert.equal(
  manifest.extensions.find(item => item.targetName === 'AnastaActivityReport')
    .bundleIdentifier,
  'com.example.anasta.focus-activity-report'
);

const analyticsRoot = path.resolve(
  __dirname,
  '..',
  'modules',
  'anasta-focus',
  'ios',
  'extensions',
  'analytics'
);
for (const source of ANALYTICS_SWIFT_SOURCES) {
  assert.equal(
    fs.existsSync(path.join(analyticsRoot, source)),
    true,
    `Missing analytics extension source: ${source}`
  );
}
const analyticsTestsRoot = path.resolve(
  __dirname,
  '..',
  'modules',
  'anasta-focus',
  'ios',
  'tests'
);
assert.equal(ANALYTICS_TEST_TARGET, 'AnastaAnalyticsTests');
for (const source of ANALYTICS_TEST_SOURCES) {
  const sourceExists = source === 'AnastaAnalyticsPure.swift'
    ? fs.existsSync(path.join(analyticsRoot, source))
    : fs.existsSync(path.join(analyticsTestsRoot, source));
  assert.equal(
    sourceExists,
    true,
    `Missing analytics test source: ${source}`
  );
}

const once = withAnastaFocus(structuredClone(fixture), props);
const twice = withAnastaFocus(once, props);
const appExtensions =
  twice.extra.eas.build.experimental.ios.appExtensions;
assert.equal(appExtensions.length, 4);
assert.equal(new Set(appExtensions.map(item => item.targetName)).size, 4);
for (const extension of appExtensions) {
  assert.deepEqual(
    extension.entitlements['com.apple.security.application-groups'],
    [props.appGroup]
  );
  assert.equal(
    extension.entitlements['com.apple.developer.family-controls'],
    true
  );
}

const targetUuid = 'TARGET000000000000000001';
const sourcePhase = { files: [] };
const frameworkPhase = { files: [] };
const fakeProject = {
  pbxNativeTargetSection: () => ({
    [targetUuid]: { name: '"AnastaActivityReport"' },
    [`${targetUuid}_comment`]: 'AnastaActivityReport',
  }),
  pbxSourcesBuildPhaseObj: () => sourcePhase,
  pbxFrameworksBuildPhaseObj: () => frameworkPhase,
  addSourceFile(sourcePath) {
    sourcePhase.files.push({
      value: `SOURCE-${sourcePhase.files.length}`,
      comment: `${path.basename(sourcePath)} in Sources`,
    });
    return true;
  },
  addFramework(framework) {
    frameworkPhase.files.push({
      value: `FRAMEWORK-${frameworkPhase.files.length}`,
      comment: `${path.basename(framework)} in Frameworks`,
    });
    return true;
  },
};
const reportSources = [
  'AnastaActivityReport/AnastaActivityReport.swift',
  ...ANALYTICS_SWIFT_SOURCES.map(
    source => `AnastaActivityReport/${source}`
  ),
];
assert.equal(findTargetUuid(fakeProject, 'AnastaActivityReport'), targetUuid);
ensureSourceFiles(fakeProject, targetUuid, reportSources);
ensureSourceFiles(fakeProject, targetUuid, reportSources);
ensureFrameworks(fakeProject, targetUuid, ['Charts.framework']);
ensureFrameworks(fakeProject, targetUuid, ['Charts.framework']);
assert.equal(sourcePhase.files.length, reportSources.length);
assert.equal(frameworkPhase.files.length, 1);
assert.equal(
  new Set(sourcePhase.files.map(file => file.comment)).size,
  reportSources.length
);

const reportExtension = manifest.extensions.find(
  item => item.targetName === 'AnastaActivityReport'
);
const settings = {};
const settingsProject = {
  pbxXCConfigurationList: () => ({
    CONFIG_LIST: {
      buildConfigurations: [{ value: 'REPORT_CONFIG' }],
    },
  }),
  pbxXCBuildConfigurationSection: () => ({
    REPORT_CONFIG: { buildSettings: settings },
  }),
};
configureTargetBuildSettings(
  settingsProject,
  { buildConfigurationList: 'CONFIG_LIST' },
  reportExtension,
  manifest
);
assert.equal(settings.CURRENT_PROJECT_VERSION, '84');
assert.equal(settings.MARKETING_VERSION, '2.7.3');
assert.equal(settings.GENERATE_INFOPLIST_FILE, 'NO');
assert.equal(
  settings.INFOPLIST_FILE,
  '"AnastaActivityReport/AnastaActivityReport-Info.plist"'
);
assert.equal(settings.SKIP_INSTALL, 'YES');
assert.equal(
  settings.PRODUCT_BUNDLE_IDENTIFIER,
  '"com.example.anasta.focus-activity-report"'
);

const testSettings = {
  APPLICATION_EXTENSION_API_ONLY: 'YES',
  BUNDLE_LOADER: '"stale"',
  CODE_SIGN_ENTITLEMENTS: '"stale.entitlements"',
  INFOPLIST_FILE: '"stale.plist"',
  TEST_HOST: '"stale.app"',
};
const testSettingsProject = {
  pbxXCConfigurationList: () => ({
    TEST_CONFIG_LIST: {
      buildConfigurations: [{ value: 'TEST_CONFIG' }],
    },
  }),
  pbxXCBuildConfigurationSection: () => ({
    TEST_CONFIG: { buildSettings: testSettings },
  }),
};
configureAnalyticsTestBuildSettings(
  testSettingsProject,
  { buildConfigurationList: 'TEST_CONFIG_LIST' },
  manifest
);
assert.equal(testSettings.GENERATE_INFOPLIST_FILE, 'YES');
assert.equal(testSettings.SKIP_INSTALL, 'YES');
assert.equal(testSettings.ENABLE_TESTABILITY, 'YES');
assert.equal(
  testSettings.PRODUCT_BUNDLE_IDENTIFIER,
  '"com.example.anasta.analytics-tests"'
);
assert.equal('APPLICATION_EXTENSION_API_ONLY' in testSettings, false);
assert.equal('BUNDLE_LOADER' in testSettings, false);
assert.equal('CODE_SIGN_ENTITLEMENTS' in testSettings, false);
assert.equal('INFOPLIST_FILE' in testSettings, false);
assert.equal('TEST_HOST' in testSettings, false);
assert.equal(testSettings.WRAPPER_EXTENSION, 'xctest');

const productReferenceUuid = 'PRODUCT00000000000000001';
const productBuildFileUuid = 'PRODUCTBUILD000000000001';
const productTarget = {
  productReference: productReferenceUuid,
};
const productProject = {
  pbxFileReferenceSection: () =>
    productProject.hash.project.objects.PBXFileReference,
  pbxBuildFileSection: () =>
    productProject.hash.project.objects.PBXBuildFile,
  hash: {
    project: {
      objects: {
        PBXFileReference: {
          [productReferenceUuid]: {
            isa: 'PBXFileReference',
            name: '"AnastaAnalyticsTests.mdimporter"',
            path: '"AnastaAnalyticsTests.mdimporter"',
            explicitFileType: '"wrapper.cfbundle"',
          },
          [`${productReferenceUuid}_comment`]:
            'AnastaAnalyticsTests.mdimporter',
        },
        PBXBuildFile: {
          [productBuildFileUuid]: {
            isa: 'PBXBuildFile',
            fileRef: productReferenceUuid,
            fileRef_comment: 'AnastaAnalyticsTests.mdimporter',
          },
          [`${productBuildFileUuid}_comment`]:
            'AnastaAnalyticsTests.mdimporter in Copy Files',
        },
        PBXGroup: {
          PRODUCTS: {
            isa: 'PBXGroup',
            children: [{
              value: productReferenceUuid,
              comment: 'AnastaAnalyticsTests.mdimporter',
            }],
          },
          PRODUCTS_comment: 'Products',
        },
      },
    },
  },
};
normalizeAnalyticsTestProduct(productProject, productTarget);
normalizeAnalyticsTestProduct(productProject, productTarget);
assert.equal(
  productProject.hash.project.objects.PBXFileReference[
    productReferenceUuid
  ].path,
  '"AnastaAnalyticsTests.xctest"'
);
assert.equal(
  productProject.hash.project.objects.PBXFileReference[
    `${productReferenceUuid}_comment`
  ],
  'AnastaAnalyticsTests.xctest'
);
assert.equal(
  productProject.hash.project.objects.PBXBuildFile[
    productBuildFileUuid
  ].fileRef_comment,
  'AnastaAnalyticsTests.xctest'
);
assert.equal(
  productProject.hash.project.objects.PBXGroup.PRODUCTS
    .children[0].comment,
  'AnastaAnalyticsTests.xctest'
);
assert.equal(
  productTarget.productReference_comment,
  'AnastaAnalyticsTests.xctest'
);

const xcodeFixturePath = path.resolve(
  __dirname,
  '..',
  'node_modules',
  'react-native-gesture-handler',
  'apple',
  'RNGestureHandler.xcodeproj',
  'project.pbxproj'
);
const parsedProject = xcode.project(xcodeFixturePath);
parsedProject.parseSync();
const parsedTestTarget = parsedProject.addTarget(
  ANALYTICS_TEST_TARGET,
  'unit_test_bundle',
  ANALYTICS_TEST_TARGET,
  'com.example.anasta.analytics-tests'
);
normalizeAnalyticsTestProduct(
  parsedProject,
  parsedTestTarget.pbxNativeTarget
);
assert.equal(
  parsedProject.pbxFileReferenceSection()[
    parsedTestTarget.pbxNativeTarget.productReference
  ].path,
  '"AnastaAnalyticsTests.xctest"'
);

const appUuid = 'APP000000000000000000001';
const testUuid = 'TEST00000000000000000001';
const dependencyUuid = 'DEPENDENCY00000000000001';
const proxyUuid = 'PROXY0000000000000000001';
const dependencyProject = {
  pbxNativeTargetSection: () => dependencyProject.nativeTargets,
  nativeTargets: {
    [appUuid]: {
      dependencies: [
        { value: dependencyUuid, comment: 'PBXTargetDependency' },
      ],
    },
    [testUuid]: { dependencies: [] },
  },
  hash: {
    project: {
      objects: {
        PBXTargetDependency: {
          [dependencyUuid]: {
            target: testUuid,
            targetProxy: proxyUuid,
          },
          [`${dependencyUuid}_comment`]: 'PBXTargetDependency',
        },
        PBXContainerItemProxy: {
          [proxyUuid]: { remoteGlobalIDString: testUuid },
          [`${proxyUuid}_comment`]: 'PBXContainerItemProxy',
        },
      },
    },
  },
};
removeTargetDependency(dependencyProject, appUuid, testUuid);
assert.equal(dependencyProject.nativeTargets[appUuid].dependencies.length, 0);
assert.equal(
  dependencyProject.hash.project.objects.PBXTargetDependency[dependencyUuid],
  undefined
);
assert.equal(
  dependencyProject.hash.project.objects.PBXContainerItemProxy[proxyUuid],
  undefined
);
const scheme = analyticsTestSchemeXml(testUuid, 'Anasta.xcodeproj');
const schemeDocument = new DOMParser().parseFromString(
  scheme,
  'application/xml'
);
assert.equal(
  schemeDocument.getElementsByTagName('parsererror').length,
  0
);
assert.match(scheme, /BlueprintIdentifier = "TEST00000000000000000001"/);
assert.match(scheme, /BuildableName = "AnastaAnalyticsTests\.xctest"/);
assert.match(scheme, /ReferencedContainer = "container:Anasta\.xcodeproj"/);
assert.match(scheme, /<TestableReference/);
assert.doesNotMatch(scheme, /buildForArchiving = "YES"/);

console.log(
  `Anasta Focus plugin manifest verified: ${appExtensions.length} extensions, `
    + `${ANALYTICS_SWIFT_SOURCES.length} analytics Swift sources, `
    + `${ANALYTICS_TEST_SOURCES.length} pure Swift test sources.`
);
