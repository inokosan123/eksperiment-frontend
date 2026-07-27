import test from 'node:test';
import assert from 'node:assert/strict';
import { KATHISMATA, groupPsalmsIntoKathismata } from '../components/scripture/kathismata';

test('twenty kathismata, contiguous, covering 1-150 exactly once', () => {
  assert.equal(KATHISMATA.length, 20);
  const seen = new Set<number>();
  KATHISMATA.forEach((k, i) => {
    assert.ok(k.to >= k.from, `kathisma ${k.number} range inverted`);
    if (i > 0) assert.equal(k.from, KATHISMATA[i - 1].to + 1, `kathisma ${k.number} not contiguous`);
    assert.equal(k.number, i + 1, 'kathismata are numbered 1..20 in order');
    for (let n = k.from; n <= k.to; n += 1) {
      assert.ok(!seen.has(n), `psalm ${n} appears twice`);
      seen.add(n);
    }
  });
  assert.equal(seen.size, 150);
  for (let n = 1; n <= 150; n += 1) assert.ok(seen.has(n), `psalm ${n} missing`);
});

test('the full psalter groups into 20 sections plus psalm 151', () => {
  const all = Array.from({ length: 151 }, (_, i) => i + 1);
  const sections = groupPsalmsIntoKathismata(all);
  assert.equal(sections.length, 21);
  assert.equal(sections[20].key, 'beyond');
  assert.match(sections[20].label, /PSALM 151/);
  assert.deepEqual(sections[20].psalms, [151]);
  assert.equal(sections.reduce((n, s) => n + s.psalms.length, 0), 151);
});

test('a filtered psalter keeps its divisions and drops the empty ones', () => {
  const sections = groupPsalmsIntoKathismata([1, 2, 100]);
  assert.equal(sections.length, 2);
  assert.deepEqual(sections[0].psalms, [1, 2]);
  assert.deepEqual(sections[1].psalms, [100]);
  assert.match(sections[1].label, /KATHISMA 13/);
});

test('kathisma 17 is the single psalm 118', () => {
  const sections = groupPsalmsIntoKathismata([118]);
  assert.equal(sections.length, 1);
  assert.equal(sections[0].label, 'KATHISMA 17 · PSALM 118');
});

test('no label carries a Roman numeral', () => {
  const all = Array.from({ length: 151 }, (_, i) => i + 1);
  for (const section of groupPsalmsIntoKathismata(all)) {
    assert.doesNotMatch(
      section.label,
      /KATHISMA\s+[IVXLC]+/,
      `${section.label} still reads in Roman numerals`,
    );
  }
});
