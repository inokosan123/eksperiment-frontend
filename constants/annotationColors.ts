export type HighlightColor =
  | 'gold'
  | 'red'
  | 'blue'
  | 'green'
  | 'purple'
  | 'rose'
  | 'orange'
  | 'teal'
  | 'cyan'
  | 'slate';

export type ColorCategory = {
  color: HighlightColor;
  label: string;
};

export const ANNOTATION_COLOR_ORDER: HighlightColor[] = [
  'gold',
  'red',
  'blue',
  'green',
  'purple',
  'rose',
  'orange',
  'teal',
  'cyan',
  'slate',
];

export const ANNOTATION_COLOR_PRESETS: Record<HighlightColor, { label: string; accent: string }> = {
  gold: { label: 'Prophecy', accent: '#D6A21E' },
  red: { label: 'Dogma', accent: '#DC2626' },
  blue: { label: 'Comfort', accent: '#4F46E5' },
  green: { label: 'Practice', accent: '#16A34A' },
  purple: { label: 'Repentance', accent: '#7C3AED' },
  rose: { label: 'Mercy', accent: '#EC4899' },
  orange: { label: 'Zeal', accent: '#F97316' },
  teal: { label: 'Peace', accent: '#0D9488' },
  cyan: { label: 'Clarity', accent: '#0EA5E9' },
  slate: { label: 'Wisdom', accent: '#64748B' },
};

export const DEFAULT_CATEGORIES: ColorCategory[] = ANNOTATION_COLOR_ORDER.map(color => ({
  color,
  label: ANNOTATION_COLOR_PRESETS[color].label,
}));

export function getAnnotationColorHex(color?: string) {
  return color && color in ANNOTATION_COLOR_PRESETS
    ? ANNOTATION_COLOR_PRESETS[color as HighlightColor].accent
    : ANNOTATION_COLOR_PRESETS.gold.accent;
}

export function getAnnotationCategoryLabel(categories: ColorCategory[], color?: string) {
  const existing = categories.find(category => category.color === color);
  if (existing) return existing.label;
  return color && color in ANNOTATION_COLOR_PRESETS
    ? ANNOTATION_COLOR_PRESETS[color as HighlightColor].label
    : ANNOTATION_COLOR_PRESETS.gold.label;
}

export function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  const value = Number.parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
