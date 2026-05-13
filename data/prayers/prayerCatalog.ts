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

export const PRAYER_LANGUAGES: { key: PrayerLanguage; label: string; name: string }[] = [
  { key: 'sr', label: 'SR', name: '\u0421\u0440\u043f\u0441\u043a\u0438' },
  { key: 'en', label: 'EN', name: 'English' },
  { key: 'ru', label: 'RU', name: '\u0420\u0443\u0441\u0441\u043a\u0438\u0439' },
];

const PRAYER_BOOKS: Record<PrayerLanguage, PrayerBookData> = {
  en: enPrayerBook as PrayerBookData,
  sr: srPrayerBook as PrayerBookData,
  ru: ruPrayerBook as PrayerBookData,
};

const RULE_LABELS: Record<PrayerLanguage, Record<'personal' | 'standard' | 'medium' | 'short' | 'breakfast' | 'lunch' | 'dinner' | 'standardJesus' | 'shortJesus' | 'personalJesus', string>> = {
  en: {
    personal: 'Personal Rule',
    standard: 'Standard Rule',
    medium: 'Shortened Rule',
    short: 'Rule of Saint Seraphim',
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
    standardJesus: 'Standard',
    shortJesus: 'Short',
    personalJesus: 'Prayer Rope',
  },
  sr: {
    personal: 'Personal Rule',
    standard: 'Стандардно правило',
    medium: 'Скраћено правило',
    short: 'Правило Светог Серафима',
    breakfast: 'Доручак',
    lunch: 'Ручак',
    dinner: 'Вечера',
    standardJesus: 'Пуно',
    shortJesus: 'Кратко',
    personalJesus: 'Бројаница',
  },
  ru: {
    personal: 'Personal Rule',
    standard: 'Стандартное правило',
    medium: 'Сокращённое правило',
    short: 'Правило святого Серафима',
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

function buildJesusSection(lang: PrayerLanguage): PrayerSection {
  const prayer = JESUS_PRAYER[lang];

  return {
    title: prayer.title,
    blocks: [
      { type: 'text', content: prayer.standard },
    ],
  };
}

function buildPersonalRuleSection(label: string): PrayerSection {
  return {
    title: label,
    blocks: [
      {
        type: 'instruction',
        content: 'Use your own prayer book or prayer rule. Start the timer when you begin, then finish when your rule is complete.',
      },
    ],
  };
}

export function getPrayerOptions(lang: PrayerLanguage, category: PrayerCategory): PrayerOption[] {
  const book = PRAYER_BOOKS[lang];
  const labels = RULE_LABELS[lang];

  if (category === 'morning') {
    return [
      { id: 'personal', label: labels.personal, section: buildPersonalRuleSection(labels.personal) },
      { id: 'standard', label: labels.standard, section: book.standard_rule.morning },
      { id: 'medium', label: labels.medium, section: book.medium_rule.morning },
      { id: 'short', label: labels.short, section: book.short_rule.morning },
    ];
  }

  if (category === 'evening') {
    return [
      { id: 'personal', label: labels.personal, section: buildPersonalRuleSection(labels.personal) },
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
      { id: 'jesus', label: JESUS_PRAYER[lang].title, section: buildJesusSection(lang) },
    ];
  }

  return book.other.map((section, index) => ({
    id: `other_${index + 1}`,
    label: section.title,
    section,
  }));
}

export function getDefaultPrayerOption(lang: PrayerLanguage, category: PrayerCategory): PrayerOption {
  const options = getPrayerOptions(lang, category);
  return options.find(option => option.id === 'standard') ?? options[0];
}
