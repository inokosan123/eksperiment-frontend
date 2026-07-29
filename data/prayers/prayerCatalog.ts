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

/**
 * The two halves of a meal grace — before the table and after it — as one rule.
 *
 * ⚠ The wrapper's own title is only injected when the half does not already
 * open with one. Every meal in all three books does: `before.title` is
 * "Before Breakfast" and `before.blocks[0]` is the heading "Prayer Before
 * Breakfast", so injecting unconditionally printed both, one under the other,
 * eighteen times over. The block's heading is the one the book actually prints,
 * so it is the one that stays.
 */
function mealHalfBlocks(section: PrayerSection): PrayerBlock[] {
  const opensWithTitle = section.blocks[0]?.type === 'title';
  return opensWithTitle
    ? section.blocks
    : [{ type: 'title', content: section.title }, ...section.blocks];
}

function buildMealSection(title: string, section: MealSection): PrayerSection {
  return {
    title,
    blocks: [
      ...mealHalfBlocks(section.before),
      ...mealHalfBlocks(section.after),
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
  /**
   * ⚠ FIVE items, each a NOUN PHRASE, each starting with a capital, each
   * short enough to hold ONE LINE at every phone width in every language.
   *
   * They were six lower-case fragments completing the heading's colon —
   * "Use this for: prayer from a physical prayer book" — which read as a
   * form field's help text, wrapped to two lines on a 360pt phone, and made
   * the one element on this page that had to stand beside two lifted cards
   * look like the leftovers. A capital and one line each is most of the fix;
   * dropping the sixth (a devotional, which the prayer book already covers)
   * is the rest. Widths are checked offline against the bundled EB Garamond
   * metrics — see the `anasta-font-fit-check` note.
   */
  listItems: string[];
  startLine: string;
  note: string;
};

export const PERSONAL_RULE_PREVIEW: Record<PrayerLanguage, PersonalRulePreviewContent> = {
  en: {
    intro: 'For Christians of every tradition — Catholic, Protestant, Orthodox, non-denominational, and any other.',
    listHeading: 'Made for the way you already pray:',
    listItems: [
      'A prayer book in your hands',
      'Prayers you know by heart',
      'A prayer rope or rosary',
      'Your own words',
      'Any other way you pray',
    ],
    startLine: 'Start Prayer opens a quiet timer that runs while you pray.',
    note: 'The other Morning and Evening rules in the app (Standard, Shortened, St. Seraphim) follow the Orthodox tradition.',
  },
  sr: {
    intro: 'За хришћане сваке традиције — католике, протестанте, православне, неденоминационе хришћане и сваке друге.',
    listHeading: 'За начин на који се већ молите:',
    listItems: [
      'Молитвеник у вашим рукама',
      'Молитве које знате напамет',
      'Бројаница или круница',
      'Својим речима',
      'Било који други начин',
    ],
    startLine: 'Притиском на Start Prayer отвара се тих тајмер док се молите.',
    note: 'Остала јутарња и вечерња правила у апликацији (Стандардно, Скраћено, Светог Серафима) су из православне традиције.',
  },
  ru: {
    intro: 'Для христиан любой традиции — католиков, протестантов, евангелистов, пятидесятников, англикан, православных, внеконфессиональных и любых других.',
    listHeading: 'Для того, как вы уже молитесь:',
    listItems: [
      'Молитвослов у вас в руках',
      'Молитвы, знакомые наизусть',
      'Чётки или розарий',
      'Своими словами',
      'Любой другой способ',
    ],
    startLine: 'Нажмите Start Prayer — откроется тихий таймер на время вашей молитвы.',
    note: 'Другие утренние и вечерние правила в приложении (Стандартное, Сокращённое, Святого Серафима) — из православной традиции.',
  },
};

/**
 * The headings on the My Rule page.
 *
 * They live here with the rest of the prayer copy because the page's body —
 * intro, list, note — is already localized from PERSONAL_RULE_PREVIEW, and a
 * card whose sentence follows the chosen language while its title does not is
 * worse than one that never translated at all.
 */
/**
 * The Start action, in the book's own voice.
 *
 * ⚠ ONE label for both books. The two buttons are different objects — one
 * floats, one docks — but they do the same thing, and naming the same action
 * two ways ("Start Prayer" / "Start My Rule") made the switch above them look
 * like it changed what the button did rather than which book it belongs to.
 *
 * ⚠ Sentence case, not the tracked capitals used elsewhere on this screen.
 * MORNING, MEALS and ORTH. are LABELS — they name a thing. This asks you to do
 * one, and both buttons set it in the serif, where capitals would shout.
 * `MY_RULE_PAGE_LABELS.startAction` is the capitals version, and it stays that
 * way because the plinth it sits in is a small tracked row, not a button face.
 */
export const PRAYER_ACTION_LABELS: Record<PrayerLanguage, {
  startPrayer: string;
  continue: string;
  finish: string;
}> = {
  en: { startPrayer: 'Start Prayer', continue: 'Continue', finish: 'Finish' },
  sr: { startPrayer: 'Почни молитву', continue: 'Настави', finish: 'Заврши' },
  ru: { startPrayer: 'Начать молитву', continue: 'Далее', finish: 'Завершить' },
};

/**
 * The line under the switch: what the chosen book actually is.
 *
 * ⚠ IT STATES, IT DOES NOT SELL. Each line says what is on that side and
 * nothing else — who it is for, and what is in it. No promises about how it
 * will feel, no adjectives doing work a noun could do.
 *
 * ⚠ AND IT MUST STAY TRUE TO THE CATALOGUE. Every claim on the Orthodox side
 * is checkable in this file: morning and evening prayers (three rules each),
 * `meals` carrying a `before` AND an `after` for breakfast, lunch and dinner,
 * `JESUS_PRAYER`, and `other`. The word "others" is the OTHER tab, which holds
 * three prayers today. If the catalogue loses a category, this line is wrong
 * and has to change with it.
 *
 * ⚠ MY RULE IS STATED BY WHAT IT HOLDS, NOT BY WHAT IT LACKS. It read
 * "Nothing is set for you here" first, and that was the fault: the Orthodox
 * line is a list of what is in that book, so defining this one by absence made
 * the two sides an abundance and an emptiness rather than two books. It now
 * names ways to pray the way the other names prayers — an equal offer, and a
 * true one, since the whole point of this side is that it accepts all of them.
 *
 * ⚠ The ways are `PERSONAL_RULE_PREVIEW.listItems` in the page's own words —
 * a prayer book in hand, prayers known by heart, a rope or rosary, your own
 * words, any other way. The line carries four of the five and leaves the fifth
 * ("any other way") to the page, because a sentence that ends in "or anything
 * else" states nothing. ⚠ "Your own words" must never be the whole of it: it
 * is one way among five, and a line that named only it would contradict the
 * list directly beneath it.
 *
 * ⚠ THE TIMER IS NOT THE POINT, and the line must not end on it. It said
 * "this side keeps the time", which made the whole offer sound like a
 * stopwatch. What Prayer Book actually does is help you build a prayer
 * routine, and what My Rule does is open that to traditions whose texts this
 * app does not carry: it cannot print your prayers, so it gives you the quiet
 * space to say them and a place for it in your day. The timer is one
 * mechanism inside that, and `MY_RULE_PAGE_LABELS.startHint` names it a
 * finger's width below — which is the other reason this line should not.
 */
export const PRAYER_BOOK_SWITCH_NOTES: Record<PrayerLanguage, {
  mine: string;
  orthodox: string;
}> = {
  en: {
    mine: 'For Christians of every tradition. Pray from a book, by heart, on a prayer rope or in your own words — this side gives it a quiet space in your day.',
    orthodox: 'The full Orthodox prayer book — morning and evening prayers, prayers before and after meals, the Jesus Prayer, and others.',
  },
  sr: {
    mine: 'За хришћане сваке традиције. Молите се из молитвеника, напамет, уз бројаницу или својим речима — ова страна за то даје тих простор у вашем дану.',
    orthodox: 'Цео православни молитвеник — јутарње и вечерње молитве, молитве пре и после јела, Исусова молитва и друге.',
  },
  ru: {
    mine: 'Для христиан любой традиции. Молитесь по молитвослову, наизусть, по чёткам или своими словами — эта сторона даёт для этого тихое место в вашем дне.',
    orthodox: 'Полный православный молитвослов — утренние и вечерние молитвы, молитвы до и после еды, Иисусова молитва и другие.',
  },
};

export const MY_RULE_PAGE_LABELS: Record<PrayerLanguage, {
  eyebrow: string;
  title: string;
  /** The plinth at the card's foot — the card itself is the button. */
  startAction: string;
  /** One short line beside it. `PERSONAL_RULE_PREVIEW.startLine` says the same
   *  thing in a full sentence and names the button, which a button cannot do. */
  startHint: string;
  jesusEyebrow: string;
  jesusTitle: string;
  jesusDescription: string;
}> = {
  en: {
    eyebrow: 'FOR EVERY TRADITION',
    title: 'My Rule',
    startAction: 'START MY RULE',
    startHint: 'A quiet timer, running while you pray',
    jesusEyebrow: 'PRAYER OF THE HEART',
    jesusTitle: 'Jesus Prayer',
    jesusDescription: 'One prayer, said over and over — kept by the rope or by the clock.',
  },
  sr: {
    eyebrow: 'ЗА СВАКУ ТРАДИЦИЈУ',
    title: 'Моје правило',
    startAction: 'ПОКРЕНИ ПРАВИЛО',
    startHint: 'Тих тајмер, ради док се молите',
    jesusEyebrow: 'МОЛИТВА СРЦА',
    jesusTitle: 'Исусова молитва',
    jesusDescription: 'Једна молитва, изнова и изнова — уз бројаницу или уз сат.',
  },
  ru: {
    eyebrow: 'ДЛЯ ЛЮБОЙ ТРАДИЦИИ',
    title: 'Моё правило',
    startAction: 'НАЧАТЬ ПРАВИЛО',
    startHint: 'Тихий таймер, идёт пока вы молитесь',
    jesusEyebrow: 'МОЛИТВА СЕРДЦА',
    jesusTitle: 'Иисусова молитва',
    jesusDescription: 'Одна молитва, снова и снова — по чёткам или по часам.',
  },
};

export function getPrayerOptions(lang: PrayerLanguage, category: PrayerCategory): PrayerOption[] {
  const book = PRAYER_BOOKS[lang];
  const labels = RULE_LABELS[lang];

  // ⚠ No `personal` option here. My Rule used to sit as the first pill among the
  // morning and evening rules; it is now a book of its own, chosen one level up
  // by the Prayer Book's My Rule / Orthodox switch. Everything this function
  // returns is a received Orthodox rule, which is what lets the pill row, the
  // preview card and the reader stop asking whether the selection has any text.
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
