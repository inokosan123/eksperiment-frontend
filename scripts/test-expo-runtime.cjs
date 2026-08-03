'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const readJson = relativePath => JSON.parse(
  fs.readFileSync(path.join(root, relativePath), 'utf8'),
);
const fail = message => {
  throw new Error(`[expo-runtime] ${message}`);
};
const expectEqual = (actual, expected, label) => {
  if (actual !== expected) {
    fail(`${label} must be ${expected}; received ${String(actual)}`);
  }
};

const expected = {
  reanimated: '4.1.1',
  worklets: '0.5.1',
};

const manifest = readJson('package.json');
const lockfile = readJson('package-lock.json');
const appConfig = readJson('app.json');
const babelConfig = fs.readFileSync(path.join(root, 'babel.config.js'), 'utf8');
const dependencies = manifest.dependencies ?? {};
const packages = lockfile.packages ?? {};

if (!/^~?54\./.test(dependencies.expo ?? '')) {
  fail('the Expo Go runtime guard must be reviewed when upgrading beyond SDK 54');
}

expectEqual(
  dependencies['react-native-reanimated'],
  expected.reanimated,
  'package.json react-native-reanimated',
);
expectEqual(
  dependencies['react-native-worklets'],
  expected.worklets,
  'package.json react-native-worklets',
);
expectEqual(
  packages['node_modules/react-native-reanimated']?.version,
  expected.reanimated,
  'package-lock.json react-native-reanimated',
);
expectEqual(
  packages['node_modules/react-native-worklets']?.version,
  expected.worklets,
  'package-lock.json react-native-worklets',
);

const installedCopies = packageName => Object.entries(packages)
  .filter(([packagePath]) => (
    packagePath === `node_modules/${packageName}`
    || packagePath.endsWith(`/node_modules/${packageName}`)
  ))
  .map(([packagePath, metadata]) => ({ packagePath, version: metadata.version }));

const reanimatedCopies = installedCopies('react-native-reanimated');
const workletsCopies = installedCopies('react-native-worklets');
if (reanimatedCopies.length !== 1) {
  fail(`expected one Reanimated lockfile copy; found ${JSON.stringify(reanimatedCopies)}`);
}
if (workletsCopies.length !== 1) {
  fail(`expected one Worklets lockfile copy; found ${JSON.stringify(workletsCopies)}`);
}

if (!babelConfig.includes('babel-preset-expo')) {
  fail('babel.config.js must use babel-preset-expo');
}
if (/react-native-(?:reanimated|worklets)\/plugin/.test(babelConfig)) {
  fail('do not configure a Reanimated/Worklets plugin manually; babel-preset-expo owns it');
}

const resolvedBabelConfig = require(path.join(root, 'babel.config.js'))({
  cache() {},
});
const expoPreset = resolvedBabelConfig.presets?.find(entry => (
  Array.isArray(entry) && entry[0] === 'babel-preset-expo'
));
const compilerSources = expoPreset?.[1]?.['react-compiler']?.sources;
if (typeof compilerSources !== 'function') {
  fail('babel.config.js must expose a React Compiler sources predicate');
}

for (const relativePath of [
  'components/onboarding/OnboardingView.tsx',
  'components/focus-watch/DayPlanHubView.tsx',
  'components/focus-watch/PurityView.tsx',
  'components/focus-watch/NeverAllowedView.tsx',
]) {
  if (compilerSources(path.join(root, relativePath)) !== false) {
    fail(`React Compiler must be disabled for ${relativePath}`);
  }
}

if (compilerSources(path.join(root, 'components/home/HomeView.tsx')) !== true) {
  fail('React Compiler must remain enabled outside the narrow exclusion list');
}

const routerPlugin = (appConfig.expo?.plugins ?? []).find(plugin => (
  Array.isArray(plugin) && plugin[0] === 'expo-router'
));
const pluginAsyncRoutes = routerPlugin?.[1]?.asyncRoutes;
const runtimeAsyncRoutes = appConfig.expo?.extra?.router?.asyncRoutes;
expectEqual(
  pluginAsyncRoutes?.ios,
  false,
  'app.json expo-router plugin asyncRoutes.ios',
);
expectEqual(
  runtimeAsyncRoutes?.ios,
  false,
  'app.json extra.router asyncRoutes.ios',
);

console.log(
  `Expo Go runtime contract is aligned: Reanimated ${expected.reanimated}, Worklets ${expected.worklets}; Focus crash routes are excluded from React Compiler; iOS async routes are disabled.`,
);
