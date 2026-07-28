import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

test('verified route generation includes only files inside app', () => {
  const outputDirectory = mkdtempSync(join(tmpdir(), 'anasta-router-types-'));
  try {
    const result = spawnSync(process.execPath, [
      join(process.cwd(), 'scripts', 'generate-expo-router-types.cjs'),
      outputDirectory,
    ], {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 10_000,
    });

    assert.equal(result.status, 0, result.stderr);
    const declaration = readFileSync(join(outputDirectory, 'router.d.ts'), 'utf8');
    assert.match(declaration, /\/rich-text-lab/);
    assert.doesNotMatch(declaration, /\/\.\.\//);
    assert.doesNotMatch(declaration, /components|tests/);
  } finally {
    rmSync(outputDirectory, { recursive: true, force: true });
  }
});
