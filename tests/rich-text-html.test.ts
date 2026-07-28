import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  canonicalizeRichTextHtml,
  getUnsupportedRichTextElements,
  hasMeaningfulRichText,
  normalizeNativeRichTextPlainText,
  richTextToNativePlainText,
  richTextToPlainText,
  toNativeRichTextTransportHtml,
} from '@/components/shared/rich-text/rich-text-html';

const LEGACY_GOLDEN_CORPUS = [
  { name: 'empty', html: '', text: '' },
  { name: 'empty paragraph', html: '<p><br></p>', text: '' },
  { name: 'legacy empty div', html: '<div><br></div>', text: '' },
  { name: 'paragraph', html: '<p>Grace for today.</p>', text: 'Grace for today.' },
  { name: 'legacy div and br', html: '<div>First line<br>Second line</div>', text: 'First line Second line' },
  { name: 'mixed emphasis', html: '<p><b>Bold</b>, <i>quiet</i>, and <u>clear</u>.</p>', text: 'Bold, quiet, and clear.' },
  { name: 'unordered list', html: '<ul><li>Pray</li><li>Read Scripture</li></ul>', text: '- Pray - Read Scripture' },
  { name: 'ordered list', html: '<ol><li>Notice</li><li>Respond</li></ol>', text: '- Notice - Respond' },
  { name: 'entities', html: '<p>Faith &amp; work&nbsp;&mdash; together.</p>', text: 'Faith & work &mdash; together.' },
  { name: 'unicode and emoji', html: '<p>Молитва 🙏 and λόγος.</p>', text: 'Молитва 🙏 and λόγος.' },
] as const;

describe('rich-text HTML contract', () => {
  test('legacy golden corpus preserves meaningful text', () => {
    for (const fixture of LEGACY_GOLDEN_CORPUS) {
      assert.equal(richTextToPlainText(fixture.html), fixture.text, fixture.name);
      assert.equal(hasMeaningfulRichText(fixture.html), fixture.text.length > 0, fixture.name);
    }
  });

  test('native plain-text comparison preserves block boundaries without list markers', () => {
    assert.equal(
      richTextToNativePlainText('<p>First line<br>Second line</p><p>Third line</p>'),
      'First line\nSecond line\nThird line',
    );
    assert.equal(
      richTextToNativePlainText('<ul><li>Pray</li><li>Read &amp; reflect</li></ul>'),
      'Pray\nRead & reflect',
    );
    assert.equal(
      richTextToNativePlainText('<p><strong>Grace</strong>&nbsp;today.</p>'),
      'Grace today.',
    );
  });

  test('native plain-text payload normalization preserves literal angle-bracket text', () => {
    assert.equal(
      normalizeNativeRichTextPlainText('  Keep <prayer> & 2 < 3  '),
      'Keep <prayer> & 2 < 3',
    );
    assert.notEqual(normalizeNativeRichTextPlainText('<prayer>'), '');
  });

  test('reports markup outside the v1 native storage contract', () => {
    assert.deepEqual(
      getUnsupportedRichTextElements('<div><span style="color:red">Text</span><script>x</script></div>'),
      ['div', 'script', 'span'],
    );
    assert.deepEqual(
      getUnsupportedRichTextElements('<p><strong>Safe</strong><br><u>text</u></p>'),
      [],
    );
  });

  test('canonicalization is deterministic and does not erase unknown markup', () => {
    const legacy = '<div><b>Keep</b> <i>everything</i></div>\r\n';
    const once = canonicalizeRichTextHtml(legacy);
    const twice = canonicalizeRichTextHtml(once);

    assert.equal(once, '<div><strong>Keep</strong> <em>everything</em></div>');
    assert.equal(twice, once);
    assert.deepEqual(getUnsupportedRichTextElements(once), ['div']);
  });

  test('removes the native editor transport wrapper without changing stored content', () => {
    assert.equal(
      canonicalizeRichTextHtml('<html><p>Grace <b>today</b>.</p></html>'),
      '<p>Grace <strong>today</strong>.</p>',
    );
    assert.equal(
      canonicalizeRichTextHtml('<html lang="en"><body><ol><li>Pray</li></ol></body></html>'),
      '<ol><li>Pray</li></ol>',
    );
  });

  test('adds exactly one native transport wrapper without changing the storage contract', () => {
    assert.equal(
      toNativeRichTextTransportHtml('<p>Grace <b>today</b>.</p>'),
      '<html><p>Grace <strong>today</strong>.</p></html>',
    );
    assert.equal(
      toNativeRichTextTransportHtml('<html><p>Already wrapped.</p></html>'),
      '<html><p>Already wrapped.</p></html>',
    );
    assert.equal(
      canonicalizeRichTextHtml(toNativeRichTextTransportHtml('<ol><li>Pray</li></ol>')),
      '<ol><li>Pray</li></ol>',
    );
    assert.equal(toNativeRichTextTransportHtml(''), '<html><p></p></html>');
  });

  test('does not strip a non-transport document with additional outer content', () => {
    const unusual = '<html><body><p>Keep me</p></body></html><p>Also keep me</p>';
    assert.equal(canonicalizeRichTextHtml(unusual), unusual);
  });

  test('visually empty markup canonicalizes to an empty storage value', () => {
    assert.equal(canonicalizeRichTextHtml('  <p><br></p>  '), '');
    assert.equal(canonicalizeRichTextHtml('&nbsp;'), '');
  });

  test('malformed numeric entities remain text instead of crashing completion checks', () => {
    assert.equal(richTextToPlainText('<p>&#999999999999;</p>'), '&#999999999999;');
  });
});
