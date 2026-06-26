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
    personal: 'My Rule',
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
    personal: 'Моје правило',
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
    personal: 'Моё правило',
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

export type PersonalRulePreviewContent = {
  intro: string;
  listHeading: string;
  listItems: string[];
  startLine: string;
  note: string;
};

export const PERSONAL_RULE_PREVIEW: Record<PrayerLanguage, PersonalRulePreviewContent> = {
  en: {
    intro: 'For Christians of every tradition — Catholic, Protestant, Orthodox, non-denominational, and any other.',
    listHeading: 'No preset prayer text. Use this for:',
    listItems: [
      'prayer from a physical prayer book',
      'a daily devotional',
      'prayer with a rosary, prayer rope, or prayer beads',
      'memorized prayers',
      'prayer in your own words',
      '… or any other way you pray',
    ],
    startLine: 'Start Prayer opens a quiet timer that runs while you pray.',
    note: 'The other Morning and Evening rules in the app (Standard, Shortened, St. Seraphim) follow the Orthodox tradition.',
  },
  sr: {
    intro: 'За хришћане сваке традиције — католике, протестанте, православне, неденоминационе хришћане и сваке друге.',
    listHeading: 'Без унапред задатих молитава. Користите ово за:',
    listItems: [
      'молитву из физичког молитвеника',
      'дневни девоционал',
      'молитву уз бројаницу или крунички',
      'молитве које знате напамет',
      'молитву сопственим речима',
      '… или било који други начин молитве',
    ],
    startLine: 'Притиском на Start Prayer отвара се тих тајмер док се молите.',
    note: 'Остала јутарња и вечерња правила у апликацији (Стандардно, Скраћено, Светог Серафима) су из православне традиције.',
  },
  ru: {
    intro: 'Для христиан любой традиции — католиков, протестантов, евангелистов, пятидесятников, англикан, православных, внеконфессиональных и любых других.',
    listHeading: 'Без предустановленных молитв. Используйте это для:',
    listItems: [
      'молитвы по физическому молитвослову',
      'ежедневного духовного чтения',
      'молитвы с чётками или розарием',
      'заученных молитв',
      'молитвы своими словами',
      '… или любого другого вида молитвы',
    ],
    startLine: 'Нажмите Start Prayer — откроется тихий таймер на время вашей молитвы.',
    note: 'Другие утренние и вечерние правила в приложении (Стандартное, Сокращённое, Святого Серафима) — из православной традиции.',
  },
};

function buildPersonalRuleSection(label: string): PrayerSection {
  return {
    title: label,
    blocks: [],
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
