import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';

const ROOTS = ['app', 'components'] as const;
const KEYBOARD_CONTROLLER = 'react-native-keyboard-controller';
const RUNTIME_LOADER = 'components/shared/rich-text/native-rich-text-keyboard-runtime.ts';

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.[cm]?[jt]sx?$/.test(entry.name) ? [path] : [];
  });
}

test('Expo Go never evaluates Keyboard Controller through a runtime import', () => {
  const runtimeImports: string[] = [];
  const runtimeRequires: string[] = [];

  for (const path of ROOTS.flatMap(sourceFiles)) {
    const source = readFileSync(path, 'utf8');
    const sourceFile = ts.createSourceFile(
      path,
      source,
      ts.ScriptTarget.Latest,
      true,
      path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );

    const visit = (node: ts.Node) => {
      if (
        ts.isImportDeclaration(node)
        && ts.isStringLiteral(node.moduleSpecifier)
        && node.moduleSpecifier.text === KEYBOARD_CONTROLLER
        && !node.importClause?.isTypeOnly
      ) {
        runtimeImports.push(relative('.', path).replaceAll('\\', '/'));
      }

      if (
        ts.isCallExpression(node)
        && ts.isIdentifier(node.expression)
        && node.expression.text === 'require'
        && node.arguments.length === 1
        && ts.isStringLiteral(node.arguments[0])
        && node.arguments[0].text === KEYBOARD_CONTROLLER
      ) {
        runtimeRequires.push(relative('.', path).replaceAll('\\', '/'));
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  assert.deepEqual(runtimeImports, []);
  assert.deepEqual(runtimeRequires, [RUNTIME_LOADER]);
});
