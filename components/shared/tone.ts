/**
 * Hex to HSL.
 *
 * Kept in one place because getting it wrong is expensive and has been: a
 * colour lifted by mixing it toward white loses its saturation — the app's
 * green falls from 72% to 30% that way — so every tint in the app is built by
 * holding the hue, holding the saturation, and raising only the lightness.
 * That only works if everyone measures the colour the same way.
 *
 * The SATURATION FLOOR is deliberately not decided here. The section cards
 * carry the app's vivid colours and hold them at 70%+; Scripture's tones are
 * muted on purpose — its sage is 18% and its gold 48% — and forcing those to
 * the cards' floor turns a liturgical page into a highlighter. Each register
 * names its own floor.
 */
export function toHsl(hex: string): { h: number; s: number; l: number } {
  const m = hex.replace('#', '');
  const v = m.length === 3 ? m.split('').map(c => c + c).join('') : m;
  const n = parseInt(v, 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r
    ? (g - b) / d + (g < b ? 6 : 0)
    : max === g
      ? (b - r) / d + 2
      : (r - g) / d + 4;
  return { h: (h / 6) * 360, s: s * 100, l: l * 100 };
}
