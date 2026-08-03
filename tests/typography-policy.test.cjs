'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync, transformSync } = require('@babel/core');
const fixedNativeText = require('../scripts/babel-plugin-fixed-native-text.cjs');

function transform(source, filename = 'C:/app/components/Example.tsx') {
  return transformSync(source, {
    filename,
    configFile: false,
    babelrc: false,
    parserOpts: { plugins: ['jsx', 'typescript'] },
    plugins: [fixedNativeText],
  }).code;
}

test('native Text and TextInput are fixed by default', () => {
  const output = transform(`
    import { Text, TextInput } from 'react-native';
    export const Example = () => <><Text>Hello</Text><TextInput /></>;
  `);

  assert.equal((output.match(/allowFontScaling=\{false\}/g) ?? []).length, 2);
  assert.equal((output.match(/maxFontSizeMultiplier=\{1\}/g) ?? []).length, 2);
});

test('aliases and Reanimated.Text receive the same fixed policy', () => {
  const output = transform(`
    import { Text as Label } from 'react-native';
    import Reanimated from 'react-native-reanimated';
    export const Example = () => <><Label>Hello</Label><Reanimated.Text>World</Reanimated.Text></>;
  `);

  assert.equal((output.match(/allowFontScaling=\{false\}/g) ?? []).length, 2);
  assert.equal((output.match(/maxFontSizeMultiplier=\{1\}/g) ?? []).length, 2);
});

test('explicit or spread opt-ins cannot bypass the fixed release policy', () => {
  const output = transform(`
    import { Text } from 'react-native';
    export const Example = () => (
      <Text allowFontScaling={true} maxFontSizeMultiplier={2} {...props}>Fixed</Text>
    );
  `);

  assert.doesNotMatch(output, /allowFontScaling=\{true\}/);
  assert.doesNotMatch(output, /maxFontSizeMultiplier=\{2\}/);
  assert.match(output, /\.\.\.props[\s\S]*allowFontScaling=\{false\}/);
  assert.match(output, /allowFontScaling=\{false\}[\s\S]*maxFontSizeMultiplier=\{1\}/);
});

test('custom components and dependencies are not rewritten', () => {
  const custom = transform(`
    import { Text as NativeText } from './Text';
    export const Example = () => <NativeText>Hello</NativeText>;
  `);
  const dependency = transform(`
    import { Text } from 'react-native';
    export const Example = () => <Text>Hello</Text>;
  `, 'C:/app/node_modules/example/index.tsx');

  assert.doesNotMatch(custom, /allowFontScaling/);
  assert.doesNotMatch(dependency, /allowFontScaling/);
});

test('the Expo Babel pipeline installs the fixed-text policy', () => {
  const root = path.resolve(__dirname, '..');
  const output = transformFileSync(
    path.join(root, 'components/shared/ScreenTitleBar.tsx'),
    { configFile: path.join(root, 'babel.config.js') },
  ).code;

  assert.match(output, /allowFontScaling\s*:\s*false/);
  assert.match(output, /maxFontSizeMultiplier\s*:\s*1/);
});
