import enPrayerBook from '@/data/prayers/en_full.json';
import ruPrayerBook from '@/data/prayers/ru_full.json';
import srPrayerBook from '@/data/prayers/sr_full.json';

export type PrayerLanguage = 'en' | 'sr' | 'ru';
export type PrayerCategory = 'morning' | 'meal' | 'evening' | 'jesus' | 'other';
export type PrayerBlockType = 'title' | 'instruction' | 'text';

export type PrayerBlock = {
  type: PrayerBlockType;
  content: string;
};

export type PrayerSection = {
  title: string;
  blocks: PrayerBlock[];
};

type MealSection = {
  before: PrayerSection;
  after: PrayerSection;
};

type PrayerBookData = {
  language: PrayerLanguage;
  tradition: string;
  short_rule: {
    morning: PrayerSection;
    evening: PrayerSection;
  };
  medium_rule: {
    morning: PrayerSection;
    evening: PrayerSection;
  };
  standard_rule: {
    morning: PrayerSection;
    evening: PrayerSection;
  };
  meals: {
    breakfast: MealSection;
    lunch: MealSection;
    dinner: MealSection;
  };
  other: PrayerSection[];
};

export type PrayerOption = {
  id: string;
  label: string;
  section: PrayerSection;
};

export const PRAYER_LANGUAGES: { key: PrayerLanguage; label: string }[] = [
  { key: 'en', label: 'EN' },
  { key: 'sr', label: 'SR' },
  { key: 'ru', label: 'RU' },
];

const PRAYER_BOOKS: Record<PrayerLanguage, PrayerBookData> = {
  en: enPrayerBook as PrayerBookData,
  sr: srPrayerBook as PrayerBookData,
  ru: ruPrayerBook as PrayerBookData,
};

const RULE_LABELS: Record<PrayerLanguage, Record<'standard' | 'medium' | 'short' | 'breakfast' | 'lunch' | 'dinner' | 'standardJesus' | 'shortJesus' | 'personalJesus', string>> = {
  en: {
    standard: 'Standard',
    medium: 'Medium',
    short: 'Short',
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
    standardJesus: 'Standard',
    shortJesus: 'Short',
    personalJesus: 'Prayer Rope',
  },
  sr: {
    standard: 'Пуно',
    medium: 'Средње',
    short: 'Кратко',
    breakfast: 'Доручак',
    lunch: 'Ручак',
    dinner: 'Вечера',
    standardJesus: 'Пуно',
    shortJesus: 'Кратко',
    personalJesus: 'Бројаница',
  },
  ru: {
    standard: 'Полное',
    medium: 'Среднее',
    short: 'Краткое',
    breakfast: 'Завтрак',
    lunch: 'Обед',
    dinner: 'Ужин',
    standardJesus: 'Полное',
    shortJesus: 'Краткое',
    personalJesus: 'Четки',
  },
};

const JESUS_PRAYER: Record<PrayerLanguage, { title: string; standard: string; short: string; personalInstruction: string }> = {
  en: {
    title: 'The Jesus Prayer',
    standard: 'Lord Jesus Christ, Son of God, have mercy on me, a sinner.',
    short: 'Lord Jesus Christ, have mercy on me.',
    personalInstruction: 'Use your prayer rope with attention and contrition of heart.',
  },
  sr: {
    title: 'Исусова молитва',
    standard: 'Господе Исусе Христе, Сине Божји, помилуј ме грешног.',
    short: 'Господе Исусе Христе, помилуј ме.',
    personalInstruction: 'Узми бројаницу и говори молитву пажљиво, са скрушеним срцем.',
  },
  ru: {
    title: 'Иисусова молитва',
    standard: 'Господи Иисусе Христе, Сыне Божий, помилуй мя, грешнаго.',
    short: 'Господи Иисусе Христе, помилуй мя.',
    personalInstruction: 'Возьми четки и произноси молитву внимательно, с сокрушенным сердцем.',
  },
};

function buildMealSection(title: string, section: MealSection): PrayerSection {
  return {
    title,
    blocks: [
      { type: 'title', content: section.before.title },
      ...section.before.blocks,
      { type: 'title', content: section.after.title },
      ...section.after.blocks,
    ],
  };
}

function buildJesusSection(lang: PrayerLanguage, mode: 'standard' | 'short' | 'personal'): PrayerSection {
  const prayer = JESUS_PRAYER[lang];
  const text = mode === 'short' ? prayer.short : prayer.standard;

  return {
    title: prayer.title,
    blocks: [
      ...(mode === 'personal' ? [{ type: 'instruction' as const, content: prayer.personalInstruction }] : []),
      { type: 'text', content: text },
    ],
  };
}

export function getPrayerOptions(lang: PrayerLanguage, category: PrayerCategory): PrayerOption[] {
  const book = PRAYER_BOOKS[lang];
  const labels = RULE_LABELS[lang];

  if (category === 'morning') {
    return [
      { id: 'standard', label: labels.standard, section: book.standard_rule.morning },
      { id: 'medium', label: labels.medium, section: book.medium_rule.morning },
      { id: 'short', label: labels.short, section: book.short_rule.morning },
    ];
  }

  if (category === 'evening') {
    return [
      { id: 'standard', label: labels.standard, section: book.standard_rule.evening },
      { id: 'medium', label: labels.medium, section: book.medium_rule.evening },
      { id: 'short', label: labels.short, section: book.short_rule.evening },
    ];
  }

  if (category === 'meal') {
    return [
      { id: 'breakfast', label: labels.breakfast, section: buildMealSection(labels.breakfast, book.meals.breakfast) },
      { id: 'lunch', label: labels.lunch, section: buildMealSection(labels.lunch, book.meals.lunch) },
      { id: 'dinner', label: labels.dinner, section: buildMealSection(labels.dinner, book.meals.dinner) },
    ];
  }

  if (category === 'jesus') {
    return [
      { id: 'standard', label: labels.standardJesus, section: buildJesusSection(lang, 'standard') },
      { id: 'short', label: labels.shortJesus, section: buildJesusSection(lang, 'short') },
      { id: 'personal', label: labels.personalJesus, section: buildJesusSection(lang, 'personal') },
    ];
  }

  return book.other.map((section, index) => ({
    id: `other_${index + 1}`,
    label: section.title,
    section,
  }));
}

export function getDefaultPrayerOption(lang: PrayerLanguage, category: PrayerCategory): PrayerOption {
  return getPrayerOptions(lang, category)[0];
}
