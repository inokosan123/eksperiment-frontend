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
  '⛪': 'praying-hands',     // church removed → fall back to a spiritual neighbour
  '📿': 'praying-hands',     // prayer-beads removed
  '💧': 'droplet',
  '🏃': 'person-running',
  '🚶': 'person-walking',
  '💪': 'flexed-biceps',
  '🥗': 'green-salad',
  '🍎': 'red-apple',
  '😴': 'crescent-moon',     // sleeping-face removed → moon (rest)
  '🚿': 'shower',
  '💼': 'briefcase',
  '💊': 'red-apple',         // pill removed → apple (health)
  '👔': 'briefcase',
  '✍️': 'writing-hand',
  '✍': 'writing-hand',
  '📚': 'books',
  '💡': 'light-bulb',
  '🎯': 'bullseye',
  '☀️': 'sun',
  '☀': 'sun',
  '🌙': 'crescent-moon',
  '⭐': 'sun',                // star removed → sun
  '🌅': 'sunrise',
  '🎵': 'artist-palette',    // music removed → creative
  '🎸': 'artist-palette',
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
  '🧠': 'light-bulb',         // brain removed → idea
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
