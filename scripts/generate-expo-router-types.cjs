const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(path.dirname(process.argv[1]), '..');
const appRoot = path.join(projectRoot, 'app');
const outputDirectory = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(projectRoot, '.expo', 'types');
const outputFile = path.join(outputDirectory, 'router.d.ts');

process.env.EXPO_ROUTER_APP_ROOT = appRoot;
fs.mkdirSync(outputDirectory, { recursive: true });

const typedRoutesPath = path.join(
  projectRoot,
  'node_modules',
  'expo-router',
  'build',
  'typed-routes',
);
const { regenerateDeclarations } = require(typedRoutesPath);

regenerateDeclarations(outputDirectory);

// Expo Router intentionally debounces this public generator by one second.
// Keep this process alive long enough to validate the resulting declaration
// before Metro starts; a malformed file must fail loudly instead of poisoning
// TypeScript during an editing session.
setTimeout(() => {
  try {
    const declaration = fs.readFileSync(outputFile, 'utf8');
    if (!declaration.includes("declare module 'expo-router'")) {
      throw new Error('router.d.ts is missing the Expo Router declaration');
    }
    if (declaration.includes('/../')) {
      throw new Error('router.d.ts contains a route outside the app directory');
    }
    if (!declaration.includes('/rich-text-lab')) {
      throw new Error('router.d.ts is missing the rich-text laboratory route');
    }
    process.stdout.write(`Generated verified Expo Router types at ${outputFile}\n`);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}, 1250);
