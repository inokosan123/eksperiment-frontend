import { HABIT_SVG, HabitEmojiName } from './habits';

// Maps legacy emoji-glyph strings (saved on existing habits before the
// switch to Noto SVG names) to the new icon name. Items that no longer
// exist in the curated set fall back to a sensible neighbour.
const LEGACY_EMOJI_MAP: Record<string, HabitEmojiName> = {
  '🙏': 'praying-hands',
  '📖': 'open-book',
  '🕯️': 'candle',
  '🕯': 'candle',
  '✝️': 'latin-cross',
  '✝': 'latin-cross',
  '⛪': 'church',
  '📿': 'praying-hands',     // prayer-beads removed
  '💧': 'droplet',
  '🏃': 'person-running',
  '🚶': 'person-walking',
  '💪': 'flexed-biceps',
  '🥗': 'green-salad',
  '🍎': 'red-apple',
  '😴': 'sleeping-face',
  '🚿': 'shower',
  '💼': 'briefcase',
  '💊': 'pill',
  '👔': 'briefcase',
  '✍️': 'writing-hand',
  '✍': 'writing-hand',
  '📚': 'books',
  '💡': 'light-bulb',
  '🎯': 'bullseye',
  '☀️': 'sun',
  '☀': 'sun',
  '🌙': 'crescent-moon',
  '⭐': 'star',
  '🌅': 'sunrise',
  '🎵': 'musical-notes',
  '🎸': 'guitar',
  '🎨': 'artist-palette',
  '☕': 'hot-beverage',
  '🚗': 'briefcase',         // car removed → work commute
  '🌱': 'seedling',
  '🌳': 'evergreen-tree',
  '🌲': 'evergreen-tree',
  '🔥': 'fire',
  '❤️': 'red-heart',
  '❤': 'red-heart',
  '🤝': 'handshake',
  '🧠': 'brain',
};

const FALLBACK: HabitEmojiName = 'praying-hands';

// Returns a valid HabitEmojiName for any string that may currently be
// stored as a habit icon — whether it is already a Noto name or a legacy
// emoji glyph saved before the migration. Always returns a renderable name.
export function normalizeHabitIcon(icon: string | null | undefined): HabitEmojiName {
  if (!icon) return FALLBACK;
  if (icon in HABIT_SVG) return icon as HabitEmojiName;
  if (icon in LEGACY_EMOJI_MAP) return LEGACY_EMOJI_MAP[icon];
  return FALLBACK;
}
