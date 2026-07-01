export type ScriptureTestament = 'ot' | 'nt' | 'dc';

export type BibleBook = {
  id: number;
  name: string;
  chapters: number;
  testament: ScriptureTestament;
};

export type ScriptureLanguage = 'en' | 'sr' | 'ru';

export const DEFAULT_SCRIPTURE_LANGUAGE: ScriptureLanguage = 'sr';

export const SCRIPTURE_LANGUAGES: { key: ScriptureLanguage; label: string }[] = [
  { key: 'en', label: 'EN' },
  { key: 'sr', label: 'SR' },
  { key: 'ru', label: 'RU' },
];

export const SCRIPTURE_LANGUAGE_DETAILS: Record<ScriptureLanguage, { name: string; label: string; version: string }> = {
  en: { name: 'English', label: 'EN', version: 'King James Version' },
  sr: { name: 'Serbian', label: 'SR', version: 'Novi SPC' },
  ru: { name: 'Russian', label: 'RU', version: 'Synodal Translation' },
};

export function normalizeScriptureLanguage(value?: string | null): ScriptureLanguage {
  return SCRIPTURE_LANGUAGES.some(language => language.key === value)
    ? value as ScriptureLanguage
    : DEFAULT_SCRIPTURE_LANGUAGE;
}

export const PSALMS_ID = 19;

export const BIBLE_BOOKS: BibleBook[] = [
  { id: 1,  name: 'Genesis', chapters: 50, testament: 'ot' },
  { id: 2,  name: 'Exodus', chapters: 40, testament: 'ot' },
  { id: 3,  name: 'Leviticus', chapters: 27, testament: 'ot' },
  { id: 4,  name: 'Numbers', chapters: 36, testament: 'ot' },
  { id: 5,  name: 'Deuteronomy', chapters: 34, testament: 'ot' },
  { id: 6,  name: 'Joshua', chapters: 24, testament: 'ot' },
  { id: 7,  name: 'Judges', chapters: 21, testament: 'ot' },
  { id: 8,  name: 'Ruth', chapters: 4, testament: 'ot' },
  { id: 9,  name: 'I Samuel', chapters: 31, testament: 'ot' },
  { id: 10, name: 'II Samuel', chapters: 24, testament: 'ot' },
  { id: 11, name: 'I Kings', chapters: 22, testament: 'ot' },
  { id: 12, name: 'II Kings', chapters: 25, testament: 'ot' },
  { id: 13, name: 'I Chronicles', chapters: 29, testament: 'ot' },
  { id: 14, name: 'II Chronicles', chapters: 36, testament: 'ot' },
  { id: 15, name: 'Ezra', chapters: 10, testament: 'ot' },
  { id: 16, name: 'Nehemiah', chapters: 13, testament: 'ot' },
  { id: 17, name: 'Esther', chapters: 10, testament: 'ot' },
  { id: 18, name: 'Job', chapters: 42, testament: 'ot' },
  { id: 19, name: 'Psalms', chapters: 151, testament: 'ot' },
  { id: 20, name: 'Proverbs', chapters: 31, testament: 'ot' },
  { id: 21, name: 'Ecclesiastes', chapters: 12, testament: 'ot' },
  { id: 22, name: 'Song of Solomon', chapters: 8, testament: 'ot' },
  { id: 23, name: 'Isaiah', chapters: 66, testament: 'ot' },
  { id: 24, name: 'Jeremiah', chapters: 52, testament: 'ot' },
  { id: 25, name: 'Lamentations', chapters: 5, testament: 'ot' },
  { id: 26, name: 'Ezekiel', chapters: 48, testament: 'ot' },
  { id: 27, name: 'Daniel', chapters: 14, testament: 'ot' },
  { id: 28, name: 'Hosea', chapters: 14, testament: 'ot' },
  { id: 29, name: 'Joel', chapters: 3, testament: 'ot' },
  { id: 30, name: 'Amos', chapters: 9, testament: 'ot' },
  { id: 31, name: 'Obadiah', chapters: 1, testament: 'ot' },
  { id: 32, name: 'Jonah', chapters: 4, testament: 'ot' },
  { id: 33, name: 'Micah', chapters: 7, testament: 'ot' },
  { id: 34, name: 'Nahum', chapters: 3, testament: 'ot' },
  { id: 35, name: 'Habakkuk', chapters: 3, testament: 'ot' },
  { id: 36, name: 'Zephaniah', chapters: 3, testament: 'ot' },
  { id: 37, name: 'Haggai', chapters: 2, testament: 'ot' },
  { id: 38, name: 'Zechariah', chapters: 14, testament: 'ot' },
  { id: 39, name: 'Malachi', chapters: 4, testament: 'ot' },
  { id: 40, name: 'Matthew', chapters: 28, testament: 'nt' },
  { id: 41, name: 'Mark', chapters: 16, testament: 'nt' },
  { id: 42, name: 'Luke', chapters: 24, testament: 'nt' },
  { id: 43, name: 'John', chapters: 21, testament: 'nt' },
  { id: 44, name: 'Acts', chapters: 28, testament: 'nt' },
  { id: 45, name: 'Romans', chapters: 16, testament: 'nt' },
  { id: 46, name: 'I Corinthians', chapters: 16, testament: 'nt' },
  { id: 47, name: 'II Corinthians', chapters: 13, testament: 'nt' },
  { id: 48, name: 'Galatians', chapters: 6, testament: 'nt' },
  { id: 49, name: 'Ephesians', chapters: 6, testament: 'nt' },
  { id: 50, name: 'Philippians', chapters: 4, testament: 'nt' },
  { id: 51, name: 'Colossians', chapters: 4, testament: 'nt' },
  { id: 52, name: 'I Thessalonians', chapters: 5, testament: 'nt' },
  { id: 53, name: 'II Thessalonians', chapters: 3, testament: 'nt' },
  { id: 54, name: 'I Timothy', chapters: 6, testament: 'nt' },
  { id: 55, name: 'II Timothy', chapters: 4, testament: 'nt' },
  { id: 56, name: 'Titus', chapters: 3, testament: 'nt' },
  { id: 57, name: 'Philemon', chapters: 1, testament: 'nt' },
  { id: 58, name: 'Hebrews', chapters: 13, testament: 'nt' },
  { id: 59, name: 'James', chapters: 5, testament: 'nt' },
  { id: 60, name: 'I Peter', chapters: 5, testament: 'nt' },
  { id: 61, name: 'II Peter', chapters: 3, testament: 'nt' },
  { id: 62, name: 'I John', chapters: 5, testament: 'nt' },
  { id: 63, name: 'II John', chapters: 1, testament: 'nt' },
  { id: 64, name: 'III John', chapters: 1, testament: 'nt' },
  { id: 65, name: 'Jude', chapters: 1, testament: 'nt' },
  { id: 66, name: 'Revelation of John', chapters: 22, testament: 'nt' },
  { id: 67, name: 'Prayer of Manasses', chapters: 1, testament: 'dc' },
  { id: 68, name: 'I Esdras', chapters: 9, testament: 'dc' },
  { id: 69, name: 'Tobit', chapters: 14, testament: 'dc' },
  { id: 70, name: 'Judith', chapters: 16, testament: 'dc' },
  { id: 71, name: 'Wisdom', chapters: 19, testament: 'dc' },
  { id: 72, name: 'Sirach', chapters: 51, testament: 'dc' },
  { id: 73, name: 'Epistle of Jeremiah', chapters: 1, testament: 'dc' },
  { id: 74, name: 'Baruch', chapters: 5, testament: 'dc' },
  { id: 75, name: 'I Maccabees', chapters: 16, testament: 'dc' },
  { id: 76, name: 'II Maccabees', chapters: 15, testament: 'dc' },
  { id: 77, name: 'III Maccabees', chapters: 7, testament: 'dc' },
  { id: 78, name: 'II Esdras', chapters: 16, testament: 'dc' },
];

export function getBibleBook(bookId: number) {
  return BIBLE_BOOKS.find(book => book.id === bookId);
}

export function formatScriptureRef(bookId: number, chapter: number, verse?: number) {
  const book = getBibleBook(bookId);
  return `${book?.name ?? `Book ${bookId}`} ${chapter}${verse ? `:${verse}` : ''}`;
}
