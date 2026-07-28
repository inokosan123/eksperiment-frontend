export const RICH_TEXT_STORAGE_ELEMENTS = [
  'p',
  'br',
  'strong',
  'em',
  'u',
  'ul',
  'ol',
  'li',
] as const;

export type RichTextStorageElement = typeof RICH_TEXT_STORAGE_ELEMENTS[number];

const STORAGE_ELEMENT_SET = new Set<string>(RICH_TEXT_STORAGE_ELEMENTS);

function normalizeWhitespace(value: string) {
  return value.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
}

function decodeNumericEntity(entity: string, digits: string, radix: 10 | 16) {
  const codePoint = Number.parseInt(digits, radix);
  if (
    !Number.isFinite(codePoint)
    || codePoint < 0
    || codePoint > 0x10FFFF
    || (codePoint >= 0xD800 && codePoint <= 0xDFFF)
  ) {
    return entity;
  }
  return String.fromCodePoint(codePoint);
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&#x([0-9a-f]+);/gi, (entity, hex: string) => (
      decodeNumericEntity(entity, hex, 16)
    ))
    .replace(/&#([0-9]+);/g, (entity, decimal: string) => (
      decodeNumericEntity(entity, decimal, 10)
    ));
}

function unwrapEnrichedHtmlTransport(value: string) {
  const documentMatch = value.match(/^<html(?:\s[^>]*)?>([\s\S]*)<\/html>$/i);
  if (!documentMatch) return value;

  const documentContent = documentMatch[1].trim();
  const bodyMatch = documentContent.match(/^<body(?:\s[^>]*)?>([\s\S]*)<\/body>$/i);
  return (bodyMatch?.[1] ?? documentContent).trim();
}

/**
 * Produces text for completion checks, previews, and migration assertions.
 * It deliberately does not sanitize or rewrite the stored HTML.
 */
export function richTextToPlainText(html = '') {
  if (!html) return '';

  const withSpacing = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|ul|ol)>/gi, '\n')
    .replace(/<li(?:\s[^>]*)?>/gi, '\n- ')
    .replace(/<\/?(strong|b|em|i|u)(?:\s[^>]*)?>/gi, '')
    .replace(/<[^>]+>/g, ' ');

  return normalizeWhitespace(decodeHtmlEntities(withSpacing));
}

/**
 * Mirrors the native editor's plain-text change payload closely enough to
 * recognize programmatic `defaultValue`/`setValue` echoes. Unlike preview
 * text, block boundaries stay as newlines and list markers are not invented.
 */
export function richTextToNativePlainText(html = '') {
  if (!html) return '';

  return normalizeNativeRichTextPlainText(decodeHtmlEntities(html
    .replace(/\r\n?/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, '')));
}

/**
 * Normalizes the native editor's already-plain `onChangeText` payload. This
 * intentionally never parses tags: literal user text such as `<prayer>` must
 * remain content and must not be confused with a programmatic HTML echo.
 */
export function normalizeNativeRichTextPlainText(value = '') {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

export function hasMeaningfulRichText(html = '') {
  return richTextToPlainText(html).length > 0;
}

/**
 * Reports markup outside the native editor's v1 storage contract. Legacy
 * markup can still be displayed, but must pass the migration corpus before it
 * is normalized and saved by the native editor.
 */
export function getUnsupportedRichTextElements(html = '') {
  const unsupported = new Set<string>();
  const tagPattern = /<\/?\s*([a-z][a-z0-9-]*)\b[^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(html)) !== null) {
    const name = match[1].toLowerCase();
    if (!STORAGE_ELEMENT_SET.has(name)) unsupported.add(name);
  }

  return Array.from(unsupported).sort();
}

/**
 * Minimal deterministic canonicalization for newly persisted native-editor
 * output. Structural migration remains fixture-gated; this function never
 * strips unknown markup or user text.
 */
export function canonicalizeRichTextHtml(html = '') {
  const normalized = unwrapEnrichedHtmlTransport(
    html.replace(/\r\n?/g, '\n').trim(),
  )
    .replace(/<\/?b\b([^>]*)>/gi, match => (
      match.startsWith('</') ? '</strong>' : '<strong>'
    ))
    .replace(/<\/?i\b([^>]*)>/gi, match => (
      match.startsWith('</') ? '</em>' : '<em>'
    ))
    .trim();

  return hasMeaningfulRichText(normalized) ? normalized : '';
}

/**
 * `react-native-enriched-html` distinguishes its own rich HTML from plain text
 * by the exact outer `<html>...</html>` transport wrapper on iOS and Android.
 * Anasta deliberately stores only the inner fragment, so this conversion must
 * happen only at the native component boundary and must never leak into SQL.
 */
export function toNativeRichTextTransportHtml(html = '') {
  const fragment = canonicalizeRichTextHtml(html);
  return `<html>${fragment || '<p></p>'}</html>`;
}
