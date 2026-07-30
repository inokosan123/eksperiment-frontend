import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState } from 'react';
import { Modal,
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, {
  Easing,
  FadeInDown,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import { X, Settings, CheckSmall, ChevronLeft, OrthodoxCross } from '@/components/icons/Icons';
import BeadLoop from '@/components/prayer/BeadLoop';
import { EveningMoon, MealBowl, MorningSun, PrayerCandle } from '@/components/icons/PrayerHours';
import ConfirmModal from '@/components/shared/ConfirmModal';
import MyRulePage from '@/components/prayer/MyRulePage';
import MyRuleStartDock, { MY_RULE_DOCK_SCRIM } from '@/components/prayer/MyRuleStartDock';
import OrthodoxPlaque, { plaqueAlpha, plaqueInk } from '@/components/prayer/OrthodoxPlaque';
import PrayerBookSwitch, { PrayerBookMode } from '@/components/prayer/PrayerBookSwitch';
import { MINE_ACCENT } from '@/components/prayer/myRuleTone';
import SetAsDailyTaskCard from '@/components/shared/SetAsDailyTaskCard';
import SetAsTaskSheet from '@/components/shared/SetAsTaskSheet';
import { useAppSettings } from '@/components/settings/SettingsContext';
import { useTasks } from '@/components/tasks/TaskProvider';
import { getLocalDateKey } from '@/components/tasks/taskScheduler';
import { queueTaskCompletionReturnAnimation } from '@/components/tasks/taskReturnAnimation';
import { C, F } from '@/constants/tokens';
import { HapticTouchableOpacity as TouchableOpacity, HapticPressable as Pressable } from '@/components/shared/HapticTouch';
import { useGuidedSetup, useGuideTarget } from '@/components/onboarding/guided/GuidedSetupContext';
import { ReadableText } from '@/components/shared/typographyScale';

import {
  getPrayerOptions,
  PRAYER_ACTION_LABELS,
  PRAYER_LANGUAGES,
  PrayerBlock,
  PrayerCategory,
  PrayerLanguage,
  PrayerOption,
  PrayerSection,
} from '@/data/prayers/prayerCatalog';

type CatTheme = { accent: string; bg: string; border: string };
type PrayerSlidePart = { type: 'instruction' | 'text' | 'title'; content: string; tone?: 'label' | 'repeat' | 'rubric' };
type PrayerSlide = { title: string; parts: PrayerSlidePart[] };

const DEFAULT_PRAYER_LANGUAGE: PrayerLanguage = 'sr';
const PRAYER_CATEGORIES: PrayerCategory[] = ['morning', 'meal', 'evening', 'jesus', 'other'];

// Spotlight anchors for the onboarding Prayer Book tour (risePrayerBook).
const PRAYER_GUIDE_TARGETS = {
  banner: 'prayer-guide-banner',
  jesusTab: 'prayer-guide-jesus-tab',
  card: 'prayer-guide-card',
} as const;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizePrayerCategory(value: string | string[] | undefined): PrayerCategory | undefined {
  const category = firstParam(value);
  return PRAYER_CATEGORIES.includes(category as PrayerCategory) ? category as PrayerCategory : undefined;
}

function normalizePrayerLanguage(value: string | undefined): PrayerLanguage {
  return PRAYER_LANGUAGES.some(language => language.key === value)
    ? value as PrayerLanguage
    : DEFAULT_PRAYER_LANGUAGE;
}

function defaultOptionId(options: PrayerOption[]) {
  return options.find(option => option.id === 'standard')?.id
    ?? options[0]?.id
    ?? 'standard';
}

/**
 * My Rule used to be a pill among the Orthodox morning and evening rules, so a
 * launch could still arrive carrying it. It is now a book of its own, one level
 * up — this is the only thing that still recognises the old id, and it does so
 * to route such a launch to the right side rather than to open a rule that no
 * longer exists.
 */
function isPersonalRuleLaunch(category: PrayerCategory | undefined, optionId?: string) {
  return optionId === 'personal' && (category === 'morning' || category === 'evening');
}

const CAT_THEMES: Record<PrayerCategory, CatTheme> = {
  morning: { accent: '#D97706', bg: '#FEF3C7', border: '#FDE68A' },
  meal: { accent: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE' },
  evening: { accent: '#7C6EAF', bg: '#EDE9FE', border: '#C4B5FD' },
  jesus: { accent: '#C5A059', bg: '#FFFBEB', border: '#E8DCC4' },
  other: { accent: '#10B981', bg: '#ECFDF5', border: '#6EE7B7' },
};

// Full words. MORN and EVE were not a choice — at 9pt over 1.6 of tracking
// "MORNING" needs 53.8pt and the button gave 52.0, so it was cut to fit.
// Easing the type to 8.5 over 1.3 and reclaiming the button's dead side
// padding leaves 6.4pt to spare; the row's gutters and colours never move.
/*
 * The hours, and what each wears. See `components/icons/PrayerHours` for why
 * these are drawn in a different register from the card emblems — 21pt across
 * five buttons is the opposite problem from a 79pt watermark.
 *
 * JESUS takes the prayer rope the app already owns rather than the `Sparkles`
 * it used to: that hour is the one prayer needing no book, and a rope is the
 * thing you actually hold while saying it. OTHER takes a candle — it holds the
 * prayers for particular occasions, and a candle is what one lights for a
 * particular need. It used to wear a heart, which said nothing about it and is
 * now Gratitude's mark two screens away.
 */
const CATEGORIES: { id: PrayerCategory; label: string; Icon: React.ComponentType<any> }[] = [
  { id: 'morning', label: 'MORNING', Icon: MorningSun },
  { id: 'meal', label: 'MEALS', Icon: MealBowl },
  { id: 'evening', label: 'EVENING', Icon: EveningMoon },
  { id: 'jesus', label: 'JESUS', Icon: BeadLoop },
  { id: 'other', label: 'OTHER', Icon: PrayerCandle },
];

const PREVIEW_CATEGORY_TITLES: Record<PrayerLanguage, Partial<Record<PrayerCategory, string>>> = {
  sr: {
    morning: 'Јутарње молитве',
    evening: 'Вечерње молитве',
  },
  en: {
    morning: 'Morning Prayers',
    evening: 'Evening Prayers',
  },
  ru: {
    morning: 'Утренние молитвы',
    evening: 'Вечерние молитвы',
  },
};

/** The page turning under the switch: a rise of ten, no longer than the
 *  plaque's own travel, so the two read as one movement rather than two.
 *
 *  ⚠ FadeInDown, not FadeIn with an initial transform. FadeIn animates opacity
 *  only, so a translateY handed to it as an initial value has nothing driving
 *  it back to zero and the page would sit ten points low forever. */
const BOOK_ENTER = FadeInDown
  .duration(260)
  .withInitialValues({ opacity: 0, transform: [{ translateY: 10 }] });

const PAGE_WORD_LIMIT = 320;
const LONG_TEXT_WORD_LIMIT = 190;

function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function slideWordCount(slide: PrayerSlide) {
  return slide.parts.reduce((total, part) => total + wordCount(part.content), 0);
}

function instructionTone(content: string): PrayerSlidePart['tone'] {
  const clean = content.trim();
  const lower = clean.toLocaleLowerCase();
  const repeatByNumber = /(?:^|[\s(])\d+\s*(?:times|x|\u043f\u0443\u0442\u0430|\u043f\u0443\u0442|\u0440\u0430\u0437\u0430|\u0440\u0430\u0437)(?:$|[\s).])/i.test(clean);

  if (
    lower.includes('three times')
    || lower.includes('twelve times')
    || lower.includes('thrice')
    || repeatByNumber
    || lower.includes('\u0442\u0440\u0438\u043f\u0443\u0442')
    || lower.includes('\u0442\u0440\u0438\u0436\u0434\u044b')
  ) {
    return 'repeat';
  }

  if (clean.endsWith(':') && wordCount(clean.replace(/:$/, '')) <= 8) {
    return 'label';
  }

  return 'rubric';
}

function splitLongTextBlock(content: string) {
  if (wordCount(content) <= LONG_TEXT_WORD_LIMIT) return [content];

  const chunks: string[] = [];
  const paragraphs = content.split(/\n{2,}/).map(part => part.trim()).filter(Boolean);
  const addPiece = (piece: string, state: { current: string }) => {
    const cleanPiece = piece.trim();
    if (!cleanPiece) return;

    const candidate = state.current ? `${state.current} ${cleanPiece}` : cleanPiece;
    if (state.current && wordCount(candidate) > LONG_TEXT_WORD_LIMIT) {
      chunks.push(state.current);
      state.current = cleanPiece;
      return;
    }

    state.current = candidate;
  };

  const splitOversizedSentence = (sentence: string) => {
    if (wordCount(sentence) <= LONG_TEXT_WORD_LIMIT) return [sentence];
    return sentence.match(/[^,]+,|[^,]+$/g)?.map(part => part.trim()).filter(Boolean) ?? [sentence];
  };

  paragraphs.forEach(paragraph => {
    if (wordCount(paragraph) <= LONG_TEXT_WORD_LIMIT) {
      chunks.push(paragraph);
      return;
    }

    const sentences = paragraph.match(/[^.!?;]+[.!?;]+["”»]?|[^.!?;]+$/g) ?? [paragraph];
    const state = { current: '' };

    sentences.forEach(sentence => {
      const cleanSentence = sentence.trim();
      if (!cleanSentence) return;

      splitOversizedSentence(cleanSentence).forEach(piece => addPiece(piece, state));
    });

    if (state.current) chunks.push(state.current);
  });

  return chunks.length > 0 ? chunks : [content];
}

function hasTextPart(parts: PrayerSlidePart[]) {
  return parts.some(part => part.type === 'text');
}

function isPsalm50Title(title: string) {
  const lower = title.toLocaleLowerCase();
  return (
    /\bpsalm\s*50\b/.test(lower)
    || /50\.?\s*\u043f\u0441\u0430\u043b[\u0430\u043e]\u043c/.test(lower)
    || /\u043f\u0441\u0430\u043b[\u0430\u043e]\u043c\s*50/.test(lower)
  );
}

function isStJohnDamasceneTitle(title: string) {
  const lower = title.toLocaleLowerCase();
  return lower.includes('damascene') || lower.includes('\u0434\u0430\u043c\u0430\u0441\u043a\u0438\u043d');
}

function isBowInstruction(content: string) {
  const clean = content.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  return clean === '(bow)' || clean === '(\u043f\u043e\u043a\u043b\u043e\u043d)';
}

function splitRepeatTitle(title: string) {
  const match = title.match(/^(.*?)\s*(\([^()]+\))$/);
  if (!match) return { title, repeatNote: '' };

  const repeatNote = match[2];
  const lowerNote = repeatNote.toLocaleLowerCase();
  const isRepeatNote =
    lowerNote.includes('repeat')
    || lowerNote.includes('once')
    || lowerNote.includes('\u043f\u043e\u043d\u043e\u0432\u0438\u0442\u0438')
    || lowerNote.includes('\u043f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u044c')
    || lowerNote.includes('\u0458\u0435\u0434\u043d\u043e\u043c')
    || lowerNote.includes('\u043e\u0434\u0438\u043d \u0440\u0430\u0437');

  if (!isRepeatNote) return { title, repeatNote: '' };

  return { title: match[1].trim(), repeatNote };
}

function splitNumberedPrayerTitle(title: string) {
  const match = title.match(/^((?:Prayer|\u041c\u043e\u043b\u0438\u0442\u0432\u0430)\s+(?:\d+|[IVXLCDM]+))\s*[,.:]?\s*(.*)$/i);
  if (!match) return { title, subtitle: '' };

  return {
    title: match[1].trim(),
    subtitle: match[2].trim(),
  };
}

function splitCommaTitle(title: string) {
  const numberedTitle = splitNumberedPrayerTitle(title);
  if (numberedTitle.subtitle) return numberedTitle;

  const commaIndex = title.indexOf(',');
  if (commaIndex === -1) return numberedTitle;

  const mainTitle = title.slice(0, commaIndex).trim();
  const subtitle = title.slice(commaIndex + 1).trim();

  if (!mainTitle || !subtitle) return numberedTitle;

  return {
    title: mainTitle,
    subtitle,
  };
}

function isBriefMealFlowInstruction(content: string) {
  const clean = content
    .trim()
    .replace(/[.!]+$/, '')
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase();

  return (
    clean === 'and make the sign of the cross'
    || clean.includes('sit at table')
    || clean === '\u0438 \u043f\u0440\u0435\u043a\u0440\u0441\u0442\u0438 \u0441\u0435'
    || clean === '\u0438 \u043f\u0435\u0440\u0435\u043a\u0440\u0435\u0441\u0442\u0438\u0441\u044c'
    || clean.includes('\u0441\u0435\u0434\u0438 \u0437\u0430 \u0441\u0442\u043e')
    || clean.includes('\u0441\u044f\u0434\u044c \u0437\u0430 \u0441\u0442\u043e\u043b')
  );
}

function isMealSectionTitle(title: string) {
  const clean = title.trim().toLocaleLowerCase();

  return (
    clean === 'breakfast'
    || clean === 'lunch'
    || clean === 'dinner'
    || clean === '\u0434\u043e\u0440\u0443\u0447\u0430\u043a'
    || clean === '\u0440\u0443\u0447\u0430\u043a'
    || clean === '\u0432\u0435\u0447\u0435\u0440\u0430'
    || clean === '\u0437\u0430\u0432\u0442\u0440\u0430\u043a'
    || clean === '\u043e\u0431\u0435\u0434'
    || clean === '\u0443\u0436\u0438\u043d'
  );
}

function isThenLabel(content: string) {
  const clean = content.trim().replace(/:$/, '').toLocaleLowerCase();

  return (
    clean === 'then'
    || clean === '\u0437\u0430\u0442\u0438\u043c'
    || clean === '\u0437\u0430\u0442\u0435\u043c'
  );
}

function isPostDamasceneOpeningInstruction(content: string) {
  const clean = content.trim().replace(/:$/, '').replace(/\s+/g, ' ').toLocaleLowerCase();

  return (
    clean === 'and then say this'
    || clean === '\u0438 \u043e\u043d\u0434\u0430 \u0433\u043e\u0432\u043e\u0440\u0438 \u043e\u0432\u043e'
    || clean === '\u0438 \u043f\u043e\u0442\u043e\u043c \u0433\u043e\u0432\u043e\u0440\u0438 \u044d\u0442\u043e'
  );
}

function isPreciousCrossBedInstruction(content: string) {
  const clean = content.trim().replace(/\s+/g, ' ').toLocaleLowerCase();

  return (
    clean.startsWith('then kiss thy cross')
    || clean.startsWith('\u043e\u043d\u0434\u0430 \u0446\u0435\u043b\u0438\u0432\u0430\u0458 \u043a\u0440\u0441\u0442')
    || clean.startsWith('\u043f\u043e\u0442\u043e\u043c \u0446\u0435\u043b\u0443\u0439 \u0441\u0432\u043e\u0439 \u043a\u0440\u0435\u0441\u0442')
  );
}

function isBeforeSleepExaminationTitle(title: string) {
  const clean = title.trim().toLocaleLowerCase();

  return (
    clean.includes('examination of the day')
    || clean.includes('\u0438\u0441\u043f\u0438\u0442\u0438\u0432\u0430\u045a\u0435 \u0434\u0430\u043d\u0430')
    || clean.includes('\u0438\u0441\u043f\u044b\u0442\u0430\u043d\u0438\u0435 \u0434\u043d\u044f')
  );
}

function splitExaminationStep(content: string) {
  const match = content.trim().match(/^([^:]+):\s*(.+)$/);
  if (!match) return null;

  const label = match[1].trim();
  const cleanLabel = label.toLocaleLowerCase();
  const stepLabels = [
    'first',
    'second',
    'third',
    'fourth',
    'fifth',
    'sixth',
    '\u043f\u0440\u0432\u043e',
    '\u0434\u0440\u0443\u0433\u043e',
    '\u0442\u0440\u0435\u045b\u0435',
    '\u0447\u0435\u0442\u0432\u0440\u0442\u043e',
    '\u043f\u0435\u0442\u043e',
    '\u0448\u0435\u0441\u0442\u043e',
    '\u043f\u0435\u0440\u0432\u043e\u0435',
    '\u0432\u0442\u043e\u0440\u043e\u0435',
    '\u0442\u0440\u0435\u0442\u044c\u0435',
    '\u0447\u0435\u0442\u0432\u0435\u0440\u0442\u043e\u0435',
    '\u0447\u0435\u0442\u0432\u0451\u0440\u0442\u043e\u0435',
    '\u043f\u044f\u0442\u043e\u0435',
    '\u0448\u0435\u0441\u0442\u043e\u0435',
  ];

  if (!stepLabels.includes(cleanLabel)) return null;

  return {
    label,
    body: match[2].trim(),
  };
}

function stripParentheticalTitle(title: string) {
  return title.replace(/\s*\([^()]+\)\s*$/, '').trim();
}

function hasRulePreviewSubtitle(category: PrayerCategory) {
  return category === 'morning' || category === 'evening';
}

/* ⚠ REMOVED: `mergeShortEveningOpeningSlides`.
 *
 * It folded the first two pages of the SHORT EVENING rule into one, so the
 * Lord's Prayer and "O Theotokos and Virgin" shared a page and the rule came
 * out at two pages where the morning's identical rule came out at three. The
 * two are the same rule of St. Seraphim said at a different hour — the data
 * is block-for-block the same, only the opening rubric differs — so there was
 * never anything for the evening to do differently.
 *
 * The pages are now, at both hours and in all three languages:
 *   1. The Lord's Prayer (3×)
 *   2. O Theotokos and Virgin (3×)
 *   3. The Symbol of Faith (once)
 *   4. — morning only — Explanation of the Rule
 *
 * No group comes near `PAGE_WORD_LIMIT` (the largest is the English Creed at
 * 213 of 320), so none of them splits further.
 */

function pushGroupSlides(slides: PrayerSlide[], title: string, parts: PrayerSlidePart[]) {
  if (isPsalm50Title(title) || isStJohnDamasceneTitle(title)) {
    slides.push({ title, parts });
    return;
  }

  let current: PrayerSlide = { title, parts: [] };

  const flush = () => {
    if (current.parts.length === 0) return;
    slides.push(current);
    current = { title, parts: [] };
  };

  parts.forEach(part => {
    const nextWords = wordCount(part.content);
    const currentWords = slideWordCount(current);
    const canOverflow = part.type === 'instruction' && part.tone === 'repeat';

    if (current.parts.length > 0 && !canOverflow && currentWords + nextWords > PAGE_WORD_LIMIT) {
      flush();
    }

    current.parts.push(part);
  });

  flush();
}

function buildPrayerSlides(section: PrayerSection): PrayerSlide[] {
  const slides: PrayerSlide[] = [];
  let currentTitle = section.title;
  let currentParts: PrayerSlidePart[] = [];

  const flushCurrentGroup = () => {
    if (currentParts.length === 0) return;
    pushGroupSlides(slides, currentTitle, currentParts);
    currentParts = [];
  };

  section.blocks.forEach(block => {
    if (block.type === 'title') {
      if (currentParts.length > 0 && !hasTextPart(currentParts)) {
        currentTitle = block.content;
        return;
      }

      flushCurrentGroup();
      currentTitle = block.content;
      return;
    }

    if (block.type === 'instruction') {
      const tone = instructionTone(block.content);
      const previousPart = currentParts[currentParts.length - 1];

      if (tone === 'repeat' && previousPart?.type === 'text') {
        previousPart.content = `${previousPart.content.trimEnd()} ${block.content.trim()}`;
        return;
      }

      if (
        hasTextPart(currentParts)
        && currentTitle === section.title
        && currentParts[0]?.type === 'instruction'
        && isPostDamasceneOpeningInstruction(currentParts[0].content)
        && isPreciousCrossBedInstruction(block.content)
      ) {
        flushCurrentGroup();
      }

      if (
        tone === 'label'
        && hasTextPart(currentParts)
        && isStJohnDamasceneTitle(currentTitle)
        && previousPart?.type === 'instruction'
        && isBowInstruction(previousPart.content)
      ) {
        flushCurrentGroup();
        currentTitle = section.title;
      }

      if (
        tone === 'label'
        && hasTextPart(currentParts)
        && currentTitle === section.title
        && !(isMealSectionTitle(section.title) && isThenLabel(block.content))
      ) {
        flushCurrentGroup();
      }

      if (
        tone === 'rubric'
        && hasTextPart(currentParts)
        && currentTitle !== section.title
        && !isBriefMealFlowInstruction(block.content)
        && !(isStJohnDamasceneTitle(currentTitle) && isBowInstruction(block.content))
      ) {
        flushCurrentGroup();
        currentTitle = section.title;
      }

      currentParts.push({ type: 'instruction', content: block.content, tone });
      return;
    }

    splitLongTextBlock(block.content).forEach(content => {
      currentParts.push({ type: 'text', content });
    });
  });

  flushCurrentGroup();
  return slides;
}

/**
 * One hour of the day, in the Prayer Book's own bright register.
 *
 * The five colours are the point of this row and are left exactly as they
 * are; what changes here is how an hour ARRIVES. It used to swap states on
 * one frame — tint on, tint off — which is the cheapest thing a selector can
 * do. Now the tint washes in, the ink warms from grey into the hour's colour,
 * and the little symbol hops once and settles, the way the app's own task
 * checks land.
 *
 * The app's standing rule is kept: nothing scales, so small Android views
 * never resample. The hop is a translate and everything else is opacity or
 * colour.
 */
function CategoryButton({
  cat,
  theme,
  active,
  onPress,
}: {
  cat: { id: PrayerCategory; label: string; Icon: React.ComponentType<any> };
  theme: CatTheme;
  active: boolean;
  onPress: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const on = useSharedValue(active ? 1 : 0);
  const hop = useSharedValue(0);
  const press = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      on.value = active ? 1 : 0;
      return;
    }
    on.value = withTiming(active ? 1 : 0, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    });
    // Only the arriving hour hops — a row of five bouncing at once would be
    // noise rather than delight.
    if (active) {
      hop.value = withSequence(
        withTiming(-5, { duration: 140, easing: Easing.out(Easing.quad) }),
        withSpring(0, { damping: 9, stiffness: 300, mass: 0.6 }),
      );
    }
  }, [active, reduceMotion, on, hop]);

  // The tint, washing in over the resting paper.
  const seatStyle = useAnimatedStyle(() => ({ opacity: on.value }));
  // The hour's own symbol, fading up over the grey one beneath it.
  const litIconStyle = useAnimatedStyle(() => ({ opacity: on.value }));
  const restIconStyle = useAnimatedStyle(() => ({ opacity: 1 - on.value }));
  // The hop, plus a touch of give under the finger.
  const liftStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: hop.value + press.value * 1.5 }],
  }));
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(on.value, [0, 1], ['#B5ADA0', theme.accent]),
    // The name firms up as its hour is chosen.
    opacity: interpolate(on.value, [0, 1], [0.9, 1]),
  }));

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      onPressIn={() => {
        press.value = withTiming(1, { duration: 90 });
      }}
      onPressOut={() => {
        press.value = withTiming(0, { duration: 190 });
      }}
      style={s.catBtn}
    >
      <Reanimated.View
        pointerEvents="none"
        style={[
          s.catSeat,
          {
            backgroundColor: theme.bg,
            borderColor: theme.border,
            shadowColor: theme.accent,
          },
          seatStyle,
        ]}
      />

      <Reanimated.View style={liftStyle}>
        <View style={s.catIcon}>
          <Reanimated.View style={restIconStyle}>
            <cat.Icon s={21} c="#C4BAA8" w={1.6} />
          </Reanimated.View>
          <Reanimated.View style={[s.catIconLit, litIconStyle]}>
            <cat.Icon s={21} c={theme.accent} w={2} />
          </Reanimated.View>
        </View>
      </Reanimated.View>

      <Reanimated.Text style={[s.catLabel, labelStyle]} numberOfLines={1}>
        {cat.label}
      </Reanimated.Text>
    </TouchableOpacity>
  );
}

/**
 * One rule within an hour — the sub-selection under the category row.
 *
 * It was a flat pill that swapped border and colour on a single frame, and a
 * plain round dot appeared beside the chosen one. It now arrives the way the
 * hour above it does: the tint washes in, the ink warms, and the marker is
 * the app's own struck diamond, turning as it lands.
 */
function RulePill({
  label,
  theme,
  active,
  onPress,
}: {
  label: string;
  theme: CatTheme;
  active: boolean;
  onPress: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const on = useSharedValue(active ? 1 : 0);
  const press = useSharedValue(0);

  useEffect(() => {
    on.value = reduceMotion
      ? active ? 1 : 0
      : withTiming(active ? 1 : 0, { duration: 240, easing: Easing.out(Easing.cubic) });
  }, [active, reduceMotion, on]);

  const seatStyle = useAnimatedStyle(() => ({ opacity: on.value }));
  const liftStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: press.value * 1.5 }],
  }));
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(on.value, [0, 1], ['#78716C', theme.accent]),
  }));
  // The diamond opens out of nothing and settles square — it never scales,
  // it grows its own width, so small Android views never resample.
  const markStyle = useAnimatedStyle(() => ({
    opacity: on.value,
    width: interpolate(on.value, [0, 1], [0, 6]),
    marginRight: interpolate(on.value, [0, 1], [0, 8]),
    transform: [{ rotate: `${interpolate(on.value, [0, 1], [0, 45])}deg` }],
  }));

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      onPressIn={() => {
        press.value = withTiming(1, { duration: 90 });
      }}
      onPressOut={() => {
        press.value = withTiming(0, { duration: 190 });
      }}
    >
      <Reanimated.View style={[s.rulePill, liftStyle]}>
        <Reanimated.View
          pointerEvents="none"
          style={[
            s.ruleSeat,
            { backgroundColor: theme.bg, borderColor: theme.accent },
            seatStyle,
          ]}
        />
        <Reanimated.View style={[s.ruleMark, { backgroundColor: theme.accent }, markStyle]} />
        <Reanimated.Text style={[s.ruleTxt, labelStyle]} numberOfLines={1}>
          {label}
        </Reanimated.Text>
      </Reanimated.View>
    </TouchableOpacity>
  );
}

export default function PrayerBookView({
  guided = false,
  guidedOrthodox = false,
  onGuidedComplete,
}: {
  // Onboarding-only: the real screen carries the spotlight tour without any
  // change to its normal behavior. All three props default off.
  guided?: boolean;
  guidedOrthodox?: boolean;
  onGuidedComplete?: () => void;
} = {}) {
  const router = useRouter();
  const params = useLocalSearchParams<{
    category?: string | string[];
    optionId?: string | string[];
    autoStart?: string | string[];
    isTask?: string | string[];
    taskInstanceId?: string | string[];
    taskDate?: string | string[];
  }>();
  const launchedCategory = normalizePrayerCategory(params.category);
  const launchedOptionId = firstParam(params.optionId);
  const launchedAutoStart = firstParam(params.autoStart) === 'true';
  const taskInstanceId = firstParam(params.taskInstanceId);
  const taskDate = firstParam(params.taskDate) ?? getLocalDateKey();
  const isTaskLaunch = firstParam(params.isTask) === 'true' || !!taskInstanceId;
  const { createOrUpdateTask, refresh: refreshTasks, completeInstance } = useTasks();
  const { settings, updateSettings } = useAppSettings();
  const prayerLanguage = normalizePrayerLanguage(settings.prayerLang);
  const initialCategory = launchedCategory ?? 'morning';
  // The Prayer Book holds two books. It opens on My Rule unless a launch is
  // carrying the reader somewhere in the Orthodox one.
  const [book, setBook] = useState<PrayerBookMode>(
    launchedCategory && !isPersonalRuleLaunch(launchedCategory, launchedOptionId)
      ? 'orthodox'
      : 'mine',
  );
  const [category, setCategory] = useState<PrayerCategory>(initialCategory);
  const [optionId, setOptionId] = useState(
    launchedOptionId ?? defaultOptionId(getPrayerOptions(prayerLanguage, initialCategory)),
  );
  const [isReaderActive, setIsReaderActive] = useState(launchedAutoStart && !!launchedCategory);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [showTaskSheet, setShowTaskSheet] = useState(false);
  const [taskSummary, setTaskSummary] = useState('Add to your daily routine');
  const insets = useSafeAreaInsets();

  // ─── Onboarding Prayer Book tour (risePrayerBook) ─────────────────────────
  const { session, patchSession, setPresentation } = useGuidedSetup();
  const isGuided = guided && session?.active === true && session.activeStep === 'risePrayerBook';
  const guidePhase = isGuided ? session.phase : '';
  const bannerTarget = useGuideTarget(PRAYER_GUIDE_TARGETS.banner, isGuided);
  const jesusTabTarget = useGuideTarget(PRAYER_GUIDE_TARGETS.jesusTab, isGuided);
  const cardTarget = useGuideTarget(PRAYER_GUIDE_TARGETS.card, isGuided);
  const guideScrollRef = useRef<ScrollView>(null);
  const guideCardYRef = useRef(0);
  const guideTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearGuideTimers = useCallback(() => {
    guideTimersRef.current.forEach(clearTimeout);
    guideTimersRef.current = [];
  }, []);

  const theme = CAT_THEMES[category];
  const options = useMemo(() => getPrayerOptions(prayerLanguage, category), [category, prayerLanguage]);
  const selectedOption = options.find(option => option.id === optionId) ?? options[0];
  const section = selectedOption.section;
  const slides = useMemo(() => buildPrayerSlides(section), [section]);
  const canChooseRule = options.length > 1;
  const previewTitle = PREVIEW_CATEGORY_TITLES[prayerLanguage][category] ?? stripParentheticalTitle(section.title);
  const previewRuleSubtitle = hasRulePreviewSubtitle(category) ? selectedOption.label : '';
  // Everything in this book is a received Orthodox text and says so at the head
  // of its page — the meal graces and the occasional prayers no less than the
  // morning and evening rules. The mark used to be limited to those two only
  // because My Rule sat among their pills and had to be told apart from them;
  // My Rule is a book of its own now, so that limit means nothing.
  //
  // ⚠ The Jesus Prayer is the exception. It is one sentence, said by Christians
  // far outside this tradition, and stamping ORTH. on it would claim it.
  const isOrthodoxRule = category !== 'jesus';
  const isMyRule = book === 'mine';
  // The colour the screen's furniture takes: the hour's, or My Rule's own.
  const bookAccent = isMyRule ? MINE_ACCENT : theme.accent;
  const actionLabels = PRAYER_ACTION_LABELS[prayerLanguage];
  // Only the first spoken block is illuminated — a versal on every paragraph
  // is a pattern, and a pattern is not an opening.
  const firstTextBlockIndex = section.blocks.findIndex(block => block.type === 'text');

  useEffect(() => {
    if (!launchedAutoStart || !launchedCategory) return;

    // A launch still carrying the retired `personal` id belongs to the other
    // book entirely — it lands on My Rule instead of opening a reader.
    if (isPersonalRuleLaunch(launchedCategory, launchedOptionId)) {
      setBook('mine');
      setIsReaderActive(false);
      return;
    }

    const nextOptions = getPrayerOptions(prayerLanguage, launchedCategory);
    const nextOption = nextOptions.some(option => option.id === launchedOptionId)
      ? launchedOptionId
      : defaultOptionId(nextOptions);

    setBook('orthodox');
    setCategory(launchedCategory);
    setOptionId(nextOption ?? 'standard');
    setIsReaderActive(true);
  }, [launchedAutoStart, launchedCategory, launchedOptionId, prayerLanguage, taskInstanceId]);

  const closeReader = useCallback(() => {
    if (isTaskLaunch) {
      router.back();
      return;
    }
    setIsReaderActive(false);
  }, [isTaskLaunch, router]);

  const finishReader = useCallback(async () => {
    if (taskInstanceId) {
      await completeInstance(taskInstanceId, taskDate);
      queueTaskCompletionReturnAnimation(taskInstanceId);
    }

    if (isTaskLaunch) {
      router.back();
      return;
    }

    setIsReaderActive(false);
  }, [completeInstance, isTaskLaunch, router, taskDate, taskInstanceId]);

  const handleCategoryChange = (cat: PrayerCategory) => {
    const nextOptions = getPrayerOptions(prayerLanguage, cat);
    setCategory(cat);
    setOptionId(defaultOptionId(nextOptions));
    setIsReaderActive(false);
    // Tour beat: tapping JESUS while the grid is spotlit advances the story.
    if (isGuided && guidePhase === 'prayerCategories' && cat === 'jesus') {
      patchSession({ phase: 'prayerJesus' });
    }
  };

  const handleLanguageChange = (lang: PrayerLanguage) => {
    Haptics.selectionAsync().catch(() => {});
    const nextOptions = getPrayerOptions(lang, category);
    updateSettings({ prayerLang: lang });
    setOptionId(currentOptionId => (
      nextOptions.some(option => option.id === currentOptionId)
        ? currentOptionId
        : defaultOptionId(nextOptions)
    ));
    setShowLanguageMenu(false);
    setIsReaderActive(false);
  };

  // My Rule is no longer bound to an hour, so it opens its timer plainly: no
  // prayerType, which is what gives PersonalRuleTaskView its own gold register
  // and drops the morning/evening rule switcher it has nothing to switch.
  const openPersonalRule = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const route = {
      pathname: '/personal-rule',
      params: {
        title: 'My Rule',
        isTask: isTaskLaunch ? 'true' : 'false',
        taskInstanceId: taskInstanceId ?? '',
        taskDate,
      },
    } as any;

    if (isTaskLaunch) {
      router.replace(route);
      return;
    }

    setIsReaderActive(false);
    router.push(route);
  }, [isTaskLaunch, router, taskDate, taskInstanceId]);

  const openJesusPrayer = useCallback((title?: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.push({
      pathname: '/jesus-prayer',
      params: {
        title: title ?? 'The Jesus Prayer',
        mode: 'duration',
        duration: '10',
        count: '100',
        isTask: 'false',
      },
    } as any);
  }, [router]);

  const handleOptionChange = useCallback((id: string) => {
    setOptionId(id);
  }, []);

  const handleBookChange = useCallback((next: PrayerBookMode) => {
    // During the tour the screen is a stage the guide dresses itself.
    if (isGuided) return;
    setBook(next);
    setIsReaderActive(false);
  }, [isGuided]);

  const handleStartPrayer = () => {
    // During the tour the screen is a stage — starting a prayer would leave it.
    if (isGuided) return;
    if (isMyRule) {
      openPersonalRule();
      return;
    }

    if (category === 'jesus') {
      openJesusPrayer(selectedOption?.label);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setIsReaderActive(true);
  };

  // The tour dresses the stage itself. The categories and the Jesus tab live in
  // the Orthodox book, so the beats that spotlight them turn to it; the My Rule
  // beat turns the switch the other way and lets that page's hero be the card.
  // All of this runs only inside the guided session — normal use never sees it.
  useEffect(() => {
    if (!isGuided) return;
    // The flip happens a beat EARLY, on prayerTimes, so the category row is
    // long mounted and measured by the time the next beat spotlights the Jesus
    // tab inside it. Flipping and spotlighting in the same commit would ask the
    // guide to measure a row that had not laid out yet.
    if (guidePhase === 'prayerTimes' || guidePhase === 'prayerCategories' || guidePhase === 'prayerJesus') {
      setBook('orthodox');
    } else if (guidePhase === 'prayerOrthodox') {
      setBook('orthodox');
      setCategory('morning');
      setOptionId(defaultOptionId(getPrayerOptions(prayerLanguage, 'morning')));
    } else if (guidePhase === 'prayerMyRule') {
      setBook('mine');
    }
  }, [guidePhase, isGuided, prayerLanguage]);

  // Card phases scroll the prayer card into view before the spotlight lands.
  const stageCard = useCallback((present: () => void) => {
    guideScrollRef.current?.scrollTo({ y: Math.max(0, guideCardYRef.current - 98), animated: true });
    guideTimersRef.current.push(setTimeout(() => {
      cardTarget.measure();
      guideTimersRef.current.push(setTimeout(present, 60));
    }, 380));
  }, [cardTarget]);

  useEffect(() => {
    if (!isGuided) return;
    clearGuideTimers();

    if (guidePhase === 'prayerIntro') {
      setPresentation({
        key: 'prayer-intro',
        placement: 'bottom',
        lightScrim: true,
        eyebrow: 'PRAYER BOOK',
        message: "This is your Prayer Book. Let's build your prayer rule.",
        highlights: ['prayer rule'],
        ctaLabel: 'Continue',
        onCta: () => patchSession({ phase: 'prayerTimes' }),
      });
      return;
    }
    if (guidePhase === 'prayerTimes') {
      setPresentation({
        key: 'prayer-times',
        targetId: PRAYER_GUIDE_TARGETS.banner,
        cutoutPadding: 8,
        placement: 'below',
        eyebrow: 'PRAYER BOOK',
        message: 'Plan prayer around your day — morning, evening, and before meals. Each becomes a daily task with its own time and reminder.',
        highlights: ['morning', 'evening', 'before meals'],
        ctaLabel: 'Continue',
        onCta: () => patchSession({ phase: 'prayerCategories' }),
      });
      return;
    }
    if (guidePhase === 'prayerCategories') {
      setPresentation({
        key: 'prayer-categories',
        targetId: PRAYER_GUIDE_TARGETS.jesusTab,
        cutoutPadding: 7,
        placement: 'below',
        allowTargetInteraction: true,
        eyebrow: 'PRAYER BOOK',
        message: 'The Jesus Prayer has its own place in your day, too.',
        highlights: ['Jesus Prayer'],
        action: 'Tap JESUS to see it',
        hint: 'tap',
      });
      return;
    }
    if (guidePhase === 'prayerJesus') {
      stageCard(() => {
        setPresentation({
          key: 'prayer-jesus',
          targetId: PRAYER_GUIDE_TARGETS.card,
          cutoutPadding: 8,
          placement: 'above',
          eyebrow: 'JESUS PRAYER',
          message: 'Give it a number of minutes, or a number of repetitions — either way, it becomes part of your rhythm, tracked like any other task.',
          highlights: ['minutes', 'repetitions'],
          ctaLabel: 'Continue',
          onCta: () => patchSession({ phase: guidedOrthodox ? 'prayerOrthodox' : 'prayerMyRule' }),
        });
      });
      return;
    }
    if (guidePhase === 'prayerOrthodox') {
      stageCard(() => {
        setPresentation({
          key: 'prayer-orthodox',
          targetId: PRAYER_GUIDE_TARGETS.card,
          cutoutPadding: 8,
          placement: 'above',
          eyebrow: 'PRAYER BOOK',
          message: 'As an Orthodox Christian, your Prayer Book already comes loaded and ready — in English, Serbian, and Russian.',
          highlights: ['loaded and ready'],
          ctaLabel: 'Continue',
          onCta: () => patchSession({ phase: 'prayerMyRule' }),
        });
      });
      return;
    }
    if (guidePhase === 'prayerMyRule') {
      stageCard(() => {
        setPresentation({
          key: 'prayer-my-rule',
          targetId: PRAYER_GUIDE_TARGETS.card,
          cutoutPadding: 8,
          placement: 'above',
          eyebrow: 'MY RULE',
          message: 'Or pray My Rule — from your own prayer book. A timer if you want one, and a calm icon of Christ — nothing else on the screen to pull you away.',
          highlights: ['My Rule'],
          ctaLabel: 'Continue',
          onCta: () => patchSession({ phase: 'prayerClose' }),
        });
      });
      return;
    }
    if (guidePhase === 'prayerClose') {
      setPresentation({
        key: 'prayer-close',
        placement: 'bottom',
        lightScrim: true,
        eyebrow: 'PRAYER BOOK',
        message: 'Available anytime. Completely free.',
        highlights: ['Completely free'],
        ctaLabel: 'Continue',
        onCta: () => onGuidedComplete?.(),
      });
      return;
    }
  }, [clearGuideTimers, guidePhase, guidedOrthodox, isGuided, onGuidedComplete, patchSession, setPresentation, stageCard]);

  useEffect(() => clearGuideTimers, [clearGuideTimers, guidePhase]);

  if (isReaderActive) {
    return (
      <PrayerReader
        section={section}
        slides={slides}
        options={options}
        selectedOption={selectedOption}
        theme={theme}
        topInset={insets.top}
        bottomInset={insets.bottom}
        canChooseRule={canChooseRule}
        deferFinishFeedback={isTaskLaunch}
        continueLabel={actionLabels.continue}
        finishLabel={actionLabels.finish}
        onClose={closeReader}
        onFinish={finishReader}
        onOptionChange={handleOptionChange}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenTitleBar
        title="PRAYER BOOK"
        showBack={!isGuided}
        rightElement={(
          <TouchableOpacity
            onPress={() => {
              if (isGuided) return;
              Haptics.selectionAsync().catch(() => {});
              setShowLanguageMenu(value => !value);
            }}
            style={s.titleSettingsBtn}
            activeOpacity={0.76}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Settings s={19} c={C.textSecondary} w={2} />
          </TouchableOpacity>
        )}
      />

      <Modal
        visible={showLanguageMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLanguageMenu(false)}
      >
        <View style={s.languageModalRoot}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowLanguageMenu(false)} />
          <View style={[s.languageMenu, { top: insets.top + 58 }]}>
            <Text style={s.languageMenuTitle}>Prayer Book Language</Text>
            <View style={s.languageOptions}>
              {PRAYER_LANGUAGES.map(language => {
                const active = language.key === prayerLanguage;

                return (
                  <TouchableOpacity
                    key={language.key}
                    onPress={() => handleLanguageChange(language.key)}
                    activeOpacity={0.78}
                    style={[
                      s.languageOption,
                      active
                        ? { backgroundColor: isMyRule ? '#EEF4FA' : theme.bg, borderColor: isMyRule ? '#D5E1EE' : theme.border }
                        : s.languageOptionInactive,
                    ]}
                  >
                    <View style={s.languageCopy}>
                      <Text style={[s.languageName, { color: active ? bookAccent : C.text }]}>
                        {language.name}
                      </Text>
                      <Text style={s.languageCode}>{language.label}</Text>
                    </View>
                    {active && <CheckSmall s={18} c={bookAccent} w={2.4} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView
        ref={guideScrollRef}
        // Room for whichever action is showing. The dock is a real bar with a
        // scrim above it, so its room is measured from its own parts rather
        // than from a constant that happened to be right on one phone.
        contentContainerStyle={{
          paddingBottom: isMyRule
            ? 56 + Math.max(insets.bottom, 10) + 8 + MY_RULE_DOCK_SCRIM + 12
            : insets.bottom + 100,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Set as Daily Task belongs to NEITHER book — the same sheet, offering
            the same hours, whichever side is showing. So it stands above the
            switch: everything below the switch changes with it, and this does
            not. Sitting under it, it read as something the choice governed. */}
        <View
          style={s.bannerWrap}
          collapsable={false}
          ref={bannerTarget.ref}
          onLayout={bannerTarget.onLayout}
        >
          <SetAsDailyTaskCard
            onPress={() => {
              if (isGuided) return;
              setShowTaskSheet(true);
            }}
            subtitle={taskSummary}
          />
        </View>

        {/* Which of the two books. Everything under it belongs to one side. */}
        <View style={s.switchWrap}>
          <PrayerBookSwitch value={book} onChange={handleBookChange} lang={prayerLanguage} />
        </View>

        {/* The page turns: what the switch chose rises into place rather than
            appearing. One key, so a change of book is one movement. */}
        <Reanimated.View key={book} entering={BOOK_ENTER}>
        {isMyRule ? (
          <View
            collapsable={false}
            onLayout={event => { guideCardYRef.current = event.nativeEvent.layout.y; }}
          >
            <MyRulePage
              lang={prayerLanguage}
              onStartMyRule={() => {
                if (isGuided) return;
                openPersonalRule();
              }}
              onOpenJesusPrayer={() => {
                if (isGuided) return;
                openJesusPrayer();
              }}
              heroRef={cardTarget.ref}
              onHeroLayout={cardTarget.onLayout}
            />
          </View>
        ) : (
          <>
          <View style={s.catGrid}>
            {CATEGORIES.map(cat => {
              const active = category === cat.id;
              const t = CAT_THEMES[cat.id];

              const button = (
                <CategoryButton
                  key={cat.id === 'jesus' ? undefined : cat.id}
                  cat={cat}
                  theme={t}
                  active={active}
                  onPress={() => handleCategoryChange(cat.id)}
                />
              );

              // The JESUS tab is a spotlight anchor during the onboarding tour.
              if (cat.id === 'jesus') {
                return (
                  <View
                    key={cat.id}
                    style={{ flex: 1 }}
                    collapsable={false}
                    ref={jesusTabTarget.ref}
                    onLayout={jesusTabTarget.onLayout}
                  >
                    {button}
                  </View>
                );
              }
              return button;
            })}
          </View>

          {canChooseRule && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.ruleScroll}
            >
              {options.map(option => (
                <RulePill
                  key={option.id}
                  label={option.label}
                  theme={theme}
                  active={option.id === selectedOption.id}
                  onPress={() => handleOptionChange(option.id)}
                />
              ))}
            </ScrollView>
          )}

          <View
            style={s.cardWrap}
            collapsable={false}
            ref={cardTarget.ref}
            onLayout={event => {
              guideCardYRef.current = event.nativeEvent.layout.y;
              cardTarget.onLayout(event);
            }}
          >
            <View style={[s.prayerCard, { borderColor: theme.border, shadowColor: theme.accent }]}>
              {/* The card's own light, in the register the app's finest cards
                  use: the ground gathers light at the head, where the title
                  stands, and settles into the hour's colour down the page. A
                  white hairline catches the top edge. Flat tint alone made this
                  the plainest surface in an app full of lit ones. */}
              <LinearGradient
                colors={['#FFFFFF', theme.bg]}
                locations={[0, 0.42]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
              <View pointerEvents="none" style={s.prayerCardLit} />

              {isOrthodoxRule && (
                <View style={s.orthodoxBadge} pointerEvents="none">
                  <OrthodoxCross s={12} c={theme.accent} w={1.35} />
                  <Text style={[s.orthodoxLabel, { color: theme.accent }]}>ORTH.</Text>
                </View>
              )}
              <Text style={[s.prayerCat, { color: theme.accent }]}>
                {category === 'jesus' ? 'JESUS PRAYER' : CATEGORIES.find(c => c.id === category)?.label}
              </Text>
              <ReadableText style={s.prayerTitle}>{previewTitle}</ReadableText>
              {previewRuleSubtitle && (
                <ReadableText style={[s.prayerRuleSubtitle, { color: theme.accent }]}>
                  {previewRuleSubtitle}
                </ReadableText>
              )}

              {/* The one thing both books keep, so the two pages stay one book:
                  a rule, a struck diamond at its waist, a rule. */}
              <View style={s.ornamentRow}>
                <View style={[s.ornamentLine, { backgroundColor: theme.accent }]} />
                <View style={[s.ornamentDiamond, { backgroundColor: theme.accent }]} />
                <View style={[s.ornamentLine, { backgroundColor: theme.accent }]} />
              </View>

              <View style={s.blockStack}>
                {section.blocks.map((block, index) => (
                  <PrayerBlockView
                    key={`${block.type}-${index}`}
                    block={block}
                    theme={theme}
                    opening={index === firstTextBlockIndex}
                  />
                ))}
              </View>
            </View>
          </View>
          </>
        )}
        </Reanimated.View>
      </ScrollView>

      {/* Two books, two actions, and deliberately not the same object. The
          received text is started by a lozenge of gold FLOATING over the page;
          My Rule is started by a bar DOCKED to its foot. See the headers on
          both files for why each is drawn the way it is. */}
      {isMyRule ? (
        <MyRuleStartDock
          label={actionLabels.startPrayer}
          bottomInset={insets.bottom}
          onPress={handleStartPrayer}
        />
      ) : (
        <View style={[s.startWrap, { bottom: insets.bottom + 20 }]} pointerEvents="box-none">
          <OrthodoxPlaque
            accent={theme.accent}
            label={actionLabels.startPrayer}
            onPress={handleStartPrayer}
          />
        </View>
      )}

      <SetAsTaskSheet
        visible={showTaskSheet}
        context="prayer"
        onClose={() => setShowTaskSheet(false)}
        onSummaryChange={setTaskSummary}
        onTaskDraft={createOrUpdateTask}
        onTaskMutation={refreshTasks}
      />
    </View>
  );
}

/**
 * One block of a received prayer, set the way a prayer book sets it.
 *
 * A prayer book has two voices on the page and prints them differently: the
 * prayer itself, and the rubric — the book telling you what to do. Here all
 * three block kinds were plain centred paragraphs, so the two voices ran
 * together. Now a heading is flanked by rules, and a rubric sits in its own
 * tinted slip, which is what the red ink does in a printed book.
 */
function PrayerBlockView({
  block,
  theme,
  opening = false,
}: {
  block: PrayerBlock;
  theme: CatTheme;
  /** The first spoken words on the card — they take the versal. */
  opening?: boolean;
}) {
  if (block.type === 'title') {
    return (
      <View style={s.blockTitleWrap}>
        <ReadableText style={[s.blockTitle, { color: theme.accent }]}>{block.content}</ReadableText>
        <View style={s.blockTitleOrnament}>
          <View style={[s.blockTitleRule, { backgroundColor: theme.accent }]} />
          <View style={[s.blockTitleDiamond, { backgroundColor: theme.accent }]} />
          <View style={[s.blockTitleRule, { backgroundColor: theme.accent }]} />
        </View>
      </View>
    );
  }

  if (block.type === 'instruction') {
    // The rubric — the book's own voice. Held between two hairlines rather
    // than boxed: in a printed prayer book a rubric is set apart by colour
    // and rule, never by a panel, and a panel here made the lightest voice
    // on the page the heaviest object on it.
    return (
      <View style={s.rubric}>
        <View style={[s.rubricRule, { backgroundColor: theme.accent }]} />
        <ReadableText style={[s.prayerInstr, { color: theme.accent }]}>{block.content}</ReadableText>
        <View style={[s.rubricRule, { backgroundColor: theme.accent }]} />
      </View>
    );
  }

  // The illuminated opening. A prayer book raises the first letter of the
  // first prayer, and it is the one flourish that says "book" before a word
  // is read. Nested Text keeps it on the same baseline and in the same flow,
  // so it survives every language and every line break.
  const versal = opening ? takeVersal(block.content) : null;

  if (versal) {
    return (
      <ReadableText style={s.prayerText}>
        <ReadableText style={[s.prayerVersal, { color: theme.accent }]}>{versal.initial}</ReadableText>
        {versal.rest}
      </ReadableText>
    );
  }

  return <ReadableText style={s.prayerText}>{block.content}</ReadableText>;
}

/**
 * Split the opening letter off a prayer, if it can carry a versal.
 *
 * Only a real letter takes one — a text opening on a quotation mark, an
 * ellipsis or a rubric bracket would give a raised piece of punctuation, which
 * is worse than no flourish at all. Short lines are left alone too: a versal
 * on three words reads as a mistake rather than an opening.
 */
function takeVersal(content: string): { initial: string; rest: string } | null {
  const text = content.trimStart();
  if (text.length < 24) return null;
  const initial = text.slice(0, 1);
  // A letter is the one character whose case changes. Cheaper and safer than
  // a \p{L} regex, which needs Unicode property escapes that Hermes has not
  // always carried — and this works for Cyrillic exactly as it does for Latin.
  if (initial.toUpperCase() === initial.toLowerCase()) return null;
  return { initial, rest: text.slice(1) };
}

function ReaderSlideTitle({ title }: { title: string }) {
  const splitTitle = splitRepeatTitle(title);
  const commaTitle = splitCommaTitle(splitTitle.title);

  return (
    <View style={s.readerSlideTitleWrap}>
      <ReadableText style={s.readerSlideTitle}>{commaTitle.title}</ReadableText>
      {commaTitle.subtitle && (
        <ReadableText style={s.readerSlideTitleSubtitle}>{commaTitle.subtitle}</ReadableText>
      )}
      {splitTitle.repeatNote && (
        <ReadableText style={s.readerSlideTitleNote}>{splitTitle.repeatNote}</ReadableText>
      )}
    </View>
  );
}

function ReaderInlineTitle({ title }: { title: string }) {
  const splitTitle = splitRepeatTitle(title);
  const commaTitle = splitCommaTitle(splitTitle.title);

  return (
    <View style={s.readerInlineTitleWrap}>
      <ReadableText style={s.readerInlineTitle}>{commaTitle.title}</ReadableText>
      {commaTitle.subtitle && (
        <ReadableText style={s.readerInlineTitleSubtitle}>{commaTitle.subtitle}</ReadableText>
      )}
      {splitTitle.repeatNote && (
        <ReadableText style={s.readerInlineTitleNote}>{splitTitle.repeatNote}</ReadableText>
      )}
    </View>
  );
}

function ReaderExaminationInstruction({ content }: { content: string }) {
  const step = splitExaminationStep(content);

  if (!step) {
    return <ReadableText style={s.readerExaminationText}>{content}</ReadableText>;
  }

  return (
    <ReadableText style={s.readerExaminationText}>
      <ReadableText style={s.readerExaminationStep}>{step.label}</ReadableText>
      {`: ${step.body}`}
    </ReadableText>
  );
}

function PrayerReader({
  section,
  slides,
  options,
  selectedOption,
  theme,
  topInset,
  bottomInset,
  canChooseRule,
  deferFinishFeedback,
  continueLabel,
  finishLabel,
  onClose,
  onFinish,
  onOptionChange,
}: {
  section: PrayerSection;
  slides: PrayerSlide[];
  options: PrayerOption[];
  selectedOption: PrayerOption;
  theme: CatTheme;
  topInset: number;
  bottomInset: number;
  canChooseRule: boolean;
  deferFinishFeedback: boolean;
  continueLabel: string;
  finishLabel: string;
  onClose: () => void;
  onFinish: () => void | Promise<void>;
  onOptionChange: (id: string) => void;
}) {
  const [slideIndex, setSlideIndex] = useState(0);
  const [showRuleSelector, setShowRuleSelector] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const readerScrollRef = useRef<ScrollView | null>(null);
  const transitionLockRef = useRef(false);
  const finishLockRef = useRef(false);
  const boundedIndex = Math.min(slideIndex, Math.max(0, slides.length - 1));
  const slide = slides[boundedIndex];
  const isFirst = boundedIndex === 0;
  const isLast = boundedIndex === slides.length - 1;
  const progress = slides.length > 0 ? ((boundedIndex + 1) / slides.length) * 100 : 0;
  const progressMotion = useSharedValue(0);
  const progressGlowMotion = useSharedValue(0);
  const pageMotion = useSharedValue(1);
  const pageDirection = useSharedValue(1);
  const backPressMotion = useSharedValue(1);
  const nextPressMotion = useSharedValue(1);

  const releaseTransitionLock = () => {
    transitionLockRef.current = false;
  };

  useEffect(() => {
    progressMotion.value = withTiming(progress, {
      duration: 560,
      easing: Easing.out(Easing.cubic),
    });
    progressGlowMotion.value = 0;
    progressGlowMotion.value = withSequence(
      withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) }),
      withTiming(0, { duration: 360, easing: Easing.out(Easing.quad) })
    );
  }, [progress, progressGlowMotion, progressMotion]);

  useEffect(() => {
    // 430 on a quintic ease-out: the page leaves fast and arrives slowly, the
    // way a leaf falls flat rather than sliding to a stop. Cubic over 390 was
    // even enough to read as a carousel. Reanimated's `Easing` has no `quint`,
    // so it comes from `poly(5)` — the same curve by its general name.
    pageMotion.value = withTiming(1, {
      duration: 430,
      easing: Easing.out(Easing.poly(5)),
    }, () => {
      runOnJS(releaseTransitionLock)();
    });
  }, [boundedIndex, selectedOption.id, pageMotion]);

  const progressFillStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(100, progressMotion.value))}%`,
  }));

  // The rubricator's mark at the head of the ink. It is always solid — the
  // old sheen rested at 0.18, which is right for a highlight sliding along a
  // bar and wrong for a mark that says where the reading has reached. What
  // moves is a strike: it swells as the page turns and settles again.
  const progressMarkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + progressGlowMotion.value * 0.34 }],
  }));

  /**
   * The page settling into place.
   *
   * ⚠ THE INK ARRIVES BEFORE THE PAGE STOPS. Opacity runs at 1.7x the clock
   * and is finished about three-fifths of the way through, so the words are
   * fully black while the leaf is still coming to rest. Fading and moving on
   * the same curve is what makes a transition read as a slide — the eye
   * follows a translating ghost — and this is a book, not a carousel.
   *
   * The drift is 13 rather than 18, and the scale opens from 0.985: a page
   * being laid down settles more than it travels. It starts at 0.34 rather
   * than 0 because a page that vanishes completely flickers on Android's
   * first composited frame.
   */
  const pageMotionStyle = useAnimatedStyle(() => {
    const p = pageMotion.value;
    return {
      opacity: Math.min(1, 0.34 + p * 1.7),
      transform: [
        { translateX: (1 - p) * 13 * pageDirection.value },
        { translateY: (1 - p) * 5 },
        { scale: 0.985 + p * 0.015 },
      ],
    };
  });

  const backButtonMotionStyle = useAnimatedStyle(() => ({
    transform: [{ scale: backPressMotion.value }],
  }));

  const nextButtonMotionStyle = useAnimatedStyle(() => ({
    transform: [{ scale: nextPressMotion.value }],
  }));

  const scrollToTop = () => {
    requestAnimationFrame(() => readerScrollRef.current?.scrollTo({ y: 0, animated: false }));
  };

  const lightHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const mediumHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };

  const finishHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  };

  const completeSlideChange = (nextIndex: number) => {
    setSlideIndex(nextIndex);
    scrollToTop();
  };

  const animateSlideChange = (nextIndex: number, direction: number) => {
    if (transitionLockRef.current || nextIndex === boundedIndex) return;
    transitionLockRef.current = true;
    pageDirection.value = -direction;
    pageMotion.value = withTiming(0, {
      duration: 135,
      easing: Easing.in(Easing.cubic),
    }, finished => {
      if (!finished) {
        runOnJS(releaseTransitionLock)();
        return;
      }

      pageDirection.value = direction;
      runOnJS(completeSlideChange)(nextIndex);
    });
  };

  const requestExit = () => {
    mediumHaptic();
    setShowExitConfirm(true);
  };

  const cancelExit = () => {
    lightHaptic();
    setShowExitConfirm(false);
  };

  const confirmExit = () => {
    mediumHaptic();
    setShowExitConfirm(false);
    onClose();
  };

  const goPrev = () => {
    if (isFirst) return;
    lightHaptic();
    animateSlideChange(Math.max(0, boundedIndex - 1), -1);
  };

  const goNext = () => {
    if (isLast) {
      if (finishLockRef.current) return;
      finishLockRef.current = true;
      if (!deferFinishFeedback) finishHaptic();
      void Promise.resolve(onFinish()).catch(error => {
        finishLockRef.current = false;
        console.warn('Prayer task completion failed:', error);
      });
      return;
    }

    lightHaptic();
    animateSlideChange(Math.min(slides.length - 1, boundedIndex + 1), 1);
  };

  const handleOptionSelect = (id: string) => {
    lightHaptic();
    pageDirection.value = 1;
    pageMotion.value = 0;
    onOptionChange(id);
    setSlideIndex(0);
    setShowRuleSelector(false);
    scrollToTop();
  };

  if (!slide) {
    return (
      <View style={s.readerScreen}>
        {/* The empty rule still gets its head-band, so a book with nothing in
            it does not flash a different design on its way to having one. */}
        <View style={[s.readerHeader, { paddingTop: topInset + 2 }]}>
          <View style={s.readerHeaderRow}>
            <View style={s.readerIconSpacer} />
            <View style={s.readerFolio}>
              <Text style={[s.readerFolioFigure, { color: plaqueInk(C.gold, 30) }]}>0</Text>
              <View style={[s.readerFolioDiamond, { backgroundColor: plaqueAlpha(C.gold, 0.5) }]} />
              <Text style={[s.readerFolioTotal, { color: plaqueAlpha(C.gold, 0.62) }]}>0</Text>
            </View>
            <TouchableOpacity onPress={requestExit} activeOpacity={0.82} style={s.readerRoundel}>
              <View pointerEvents="none" style={[s.readerRoundelFace, { borderColor: plaqueAlpha(C.gold, 0.42) }]} />
              <View pointerEvents="none" style={s.readerRoundelCatch} />
              <X s={13} c={plaqueInk(C.gold, 32)} w={2.2} />
            </TouchableOpacity>
          </View>
          <View style={s.readerRuleChannel}>
            <View style={[s.readerRuleTrack, { backgroundColor: plaqueAlpha(C.gold, 0.16) }]} />
            <View style={s.readerRuleCatch} />
          </View>
        </View>
        <ConfirmModal
          visible={showExitConfirm}
          icon={<X s={21} c={C.red} w={2.4} />}
          iconBg="#FFF1F3"
          title="Exit prayer?"
          body="Do you want to stop this prayer and return to the prayer book?"
          cancelLabel="CONTINUE"
          confirmLabel="EXIT"
          confirmColor={C.red}
          onCancel={cancelExit}
          onConfirm={confirmExit}
        />
      </View>
    );
  }

  return (
    <View style={s.readerScreen}>
      {/* ── THE HEAD-BAND ────────────────────────────────────────────────
          A bound book's page is closed at the head and the foot by a rule,
          not by a hairline border and a rounded pill. So: the folio set in
          the book's own face with a struck diamond between its figures, the
          exit cut into a roundel of the same stone the plaque is cut from,
          and a ruled channel under both with the rubricator's diamond riding
          at the head of the ink. */}
      <View style={[s.readerHeader, { paddingTop: topInset + 2 }]}>
        <View style={s.readerHeaderRow}>
          <View style={s.readerIconSpacer} />
          <View style={s.readerFolio}>
            <Text style={[s.readerFolioFigure, { color: plaqueInk(theme.accent, 30) }]}>
              {boundedIndex + 1}
            </Text>
            <View style={[s.readerFolioDiamond, { backgroundColor: plaqueAlpha(theme.accent, 0.5) }]} />
            <Text style={[s.readerFolioTotal, { color: plaqueAlpha(theme.accent, 0.62) }]}>
              {slides.length}
            </Text>
          </View>
          <TouchableOpacity onPress={requestExit} activeOpacity={0.82} style={s.readerRoundel}>
            <View pointerEvents="none" style={[s.readerRoundelFace, { borderColor: plaqueAlpha(theme.accent, 0.42) }]} />
            <View pointerEvents="none" style={s.readerRoundelCatch} />
            <X s={13} c={plaqueInk(theme.accent, 32)} w={2.2} />
          </TouchableOpacity>
        </View>

        <View style={s.readerRuleChannel}>
          <View style={[s.readerRuleTrack, { backgroundColor: plaqueAlpha(theme.accent, 0.16) }]} />
          <Reanimated.View style={[s.readerRuleInk, progressFillStyle]}>
            <View style={[s.readerRuleInkLine, { backgroundColor: theme.accent }]} />
            {/* The mark the rubricator leaves at the head of the ink. It rides
                the fill rather than sliding on its own clock, so the page and
                the mark can never disagree about where the reading is. */}
            <Reanimated.View style={[s.readerRuleMark, progressMarkStyle]}>
              <View style={[s.readerRuleMarkDiamond, { backgroundColor: theme.accent }]} />
            </Reanimated.View>
          </Reanimated.View>
          <View style={s.readerRuleCatch} />
          {/* A ruled line in a manuscript is stopped at both ends by a short
              serif, not left to fade out. They also give the empty rule and
              the finished one something to be measured between. */}
          <View pointerEvents="none" style={[s.readerRuleSerif, s.readerRuleSerifStart, { backgroundColor: plaqueAlpha(theme.accent, 0.4) }]} />
          <View pointerEvents="none" style={[s.readerRuleSerif, s.readerRuleSerifEnd, { backgroundColor: plaqueAlpha(theme.accent, 0.4) }]} />
        </View>
      </View>

      <ScrollView
        ref={readerScrollRef}
        style={s.readerScroll}
        contentContainerStyle={s.readerContent}
        showsVerticalScrollIndicator={false}
      >
        <Reanimated.View style={[s.readerPageMotion, pageMotionStyle]}>
          {isFirst && canChooseRule && (
            <TouchableOpacity
              onPress={() => {
                lightHaptic();
                setShowRuleSelector(true);
              }}
              activeOpacity={0.76}
              style={s.readerRulePill}
            >
              <View pointerEvents="none" style={[s.readerRulePillFace, { borderColor: plaqueAlpha(theme.accent, 0.4) }]} />
              <View pointerEvents="none" style={s.readerRulePillCatch} />
              <Text style={[s.readerRuleText, { color: plaqueInk(theme.accent, 30) }]} numberOfLines={1}>
                {selectedOption.label}
              </Text>
              <View style={[s.readerRuleDiamond, { backgroundColor: plaqueAlpha(theme.accent, 0.5) }]} />
              <Settings s={13} c={plaqueInk(theme.accent, 36)} w={1.9} />
            </TouchableOpacity>
          )}

          {slide.title !== section.title && (
            <ReaderSlideTitle title={slide.title} />
          )}

          <View style={s.readerParts}>
            {slide.parts.map((part, index) => {
              if (part.type === 'title') {
                return <ReaderInlineTitle key={`${part.type}-${index}`} title={part.content} />;
              }

              if (part.type === 'instruction' && isBeforeSleepExaminationTitle(slide.title)) {
                return <ReaderExaminationInstruction key={`${part.type}-${index}`} content={part.content} />;
              }

              return (
                <ReadableText
                  key={`${part.type}-${index}`}
                  style={[
                    part.type === 'instruction'
                      ? part.tone === 'label'
                        ? s.readerLabelInstruction
                        : part.tone === 'repeat'
                          ? [s.readerRepeatInstruction, { color: theme.accent }]
                          : s.readerInstruction
                      : s.readerPrayerText,
                  ]}
                >
                  {part.content}
                </ReadableText>
              );
            })}
          </View>
        </Reanimated.View>
      </ScrollView>

      {/* ── THE FOOT ─────────────────────────────────────────────────────
          The head-band's mirror: the same double rule, catch-light above the
          cut this time because the light still comes from the top. The plaque
          stands CENTRED and alone — it is the one thing this bar is for — and
          the way back is a roundel at the margin, answering the exit roundel
          at the head. */}
      <View style={[s.readerNav, { paddingBottom: Math.max(bottomInset + 8, 18) }]}>
        <View pointerEvents="none" style={[s.readerNavRule, { backgroundColor: plaqueAlpha(theme.accent, 0.3) }]} />
        <View pointerEvents="none" style={s.readerNavRuleCatch} />

        {/* Three cells, not an absolute margin control: a side, the centre,
            and a matching side. It is the only layout that puts the way back
            on the plaque's own baseline AND keeps the plaque on the screen's
            axis. Held absolutely, the roundel centred itself in the padding
            box — safe-area included — so it sat low, and the bar had to grow
            to hide it. */}
        <View style={s.readerNavSide}>
          <TouchableOpacity
            onPress={goPrev}
            onPressIn={() => { backPressMotion.value = withTiming(0.97, { duration: 80 }); }}
            onPressOut={() => { backPressMotion.value = withTiming(1, { duration: 120 }); }}
            disabled={isFirst}
            activeOpacity={1}
            style={isFirst && s.readerNavDisabled}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Reanimated.View style={[s.readerBackRoundel, backButtonMotionStyle]}>
              <View pointerEvents="none" style={[s.readerBackFace, { borderColor: plaqueAlpha(theme.accent, 0.42) }]} />
              <View pointerEvents="none" style={s.readerBackCatch} />
              <ChevronLeft s={19} c={plaqueInk(theme.accent, 30)} w={2} />
            </Reanimated.View>
          </TouchableOpacity>
        </View>

        <View style={s.readerNavCentre}>
          <Reanimated.View style={nextButtonMotionStyle}>
            <OrthodoxPlaque
              accent={theme.accent}
              size="compact"
              label={isLast ? finishLabel : continueLabel}
              onPress={goNext}
              onPressIn={() => { nextPressMotion.value = withTiming(0.975, { duration: 80 }); }}
              onPressOut={() => { nextPressMotion.value = withTiming(1, { duration: 120 }); }}
            />
          </Reanimated.View>
        </View>

        {/* The side the roundel does not occupy, so the centre stays centred. */}
        <View style={s.readerNavSide} pointerEvents="none" />
      </View>

      <Modal
        transparent
        visible={canChooseRule && showRuleSelector}
        animationType="fade"
        onRequestClose={() => setShowRuleSelector(false)}
      >
        <View style={s.selectorOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowRuleSelector(false)} />
          <View style={[s.selectorSheet, { paddingBottom: bottomInset + 24 }]}>
            <View style={s.selectorHandle} />
            <View style={s.selectorHeader}>
              <Text style={s.selectorTitle}>Prayer Rule</Text>
              <TouchableOpacity
                onPress={() => {
                  lightHaptic();
                  setShowRuleSelector(false);
                }}
                style={s.selectorClose}
                activeOpacity={0.76}
              >
                <X s={17} c="#78716C" />
              </TouchableOpacity>
            </View>

            <View style={s.selectorList}>
              {options.map(option => {
                const active = option.id === selectedOption.id;
                const showOrthodoxBadge = option.id !== 'personal';

                return (
                  <TouchableOpacity
                    key={option.id}
                    onPress={() => handleOptionSelect(option.id)}
                    activeOpacity={0.78}
                    style={[
                      s.selectorOption,
                      active
                        ? { backgroundColor: theme.bg, borderColor: theme.border }
                        : s.selectorOptionInactive,
                    ]}
                  >
                    <View style={s.selectorCopy}>
                      <Text style={[s.selectorOptionTitle, { color: active ? theme.accent : C.text }]}>
                        {option.label}
                      </Text>
                      <Text style={s.selectorOptionSub}>{option.section.title}</Text>
                    </View>
                    {(showOrthodoxBadge || active) && (
                      <View style={s.selectorOptionTrailing}>
                        {showOrthodoxBadge && (
                          <View style={s.selectorOrthodoxBadge}>
                            <OrthodoxCross s={11} c={theme.accent} w={1.35} />
                            <Text style={[s.selectorOrthodoxBadgeText, { color: theme.accent }]}>ORTH.</Text>
                          </View>
                        )}
                        {active && <CheckSmall s={18} c={theme.accent} />}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmModal
        visible={showExitConfirm}
        icon={<X s={21} c={C.red} w={2.4} />}
        iconBg="#FFF1F3"
        title="Exit prayer?"
        body="Do you want to stop this prayer and return to the prayer book?"
        cancelLabel="CONTINUE"
        confirmLabel="EXIT"
        confirmColor={C.red}
        onCancel={cancelExit}
        onConfirm={confirmExit}
      />
    </View>
  );
}

const s = StyleSheet.create({
  titleSettingsBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  languageModalRoot: { flex: 1 },
  languageMenu: {
    position: 'absolute',
    right: 14,
    width: 246,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EEE9E0',
    backgroundColor: '#FFFFFF',
    padding: 12,
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 22,
    elevation: 14,
  },
  languageMenuTitle: { paddingHorizontal: 4, paddingBottom: 9, fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.8, color: '#A8A29E', textTransform: 'uppercase' },
  languageOptions: { gap: 8 },
  languageOption: { minHeight: 54, borderRadius: 14, borderWidth: 1, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  languageOptionInactive: { borderColor: '#EEE9E0', backgroundColor: '#FAFAF9' },
  languageCopy: { flex: 1, minWidth: 0 },
  languageName: { fontFamily: F.serifMedium, fontSize: 18, lineHeight: 22 },
  languageCode: { marginTop: 1, fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.5, color: '#A8A29E' },

  bannerWrap: { paddingHorizontal: 14, paddingTop: 12 },
  switchWrap: { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 4 },

  catGrid: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingTop: 6, paddingBottom: 0 },
  // The resting paper the hour sits on. The tinted seat fades in over it, so
  // the button itself never changes — only what is laid on top of it.
  catBtn: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 13,
    // 2, not 4: the content is centred anyway, so the padding was doing
    // nothing except taking the room the full words need.
    paddingHorizontal: 2,
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    backgroundColor: '#F8F6F2',
    borderColor: '#EDE8DF',
  },
  catSeat: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    borderWidth: 1,
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 2,
  },
  // Both symbols occupy one 21pt square, the lit one stacked over the grey.
  catIcon: { width: 21, height: 21, alignItems: 'center', justifyContent: 'center' },
  catIconLit: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  catLabel: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.3 },

  ruleScroll: { gap: 8, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 8 },
  // The pill at rest. The chosen seat fades in over it, so the pill itself
  // never redraws — only what is laid on top of it.
  rulePill: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
    paddingHorizontal: 17,
    borderRadius: 14,
    borderCurve: 'continuous',
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    borderColor: '#E8E3DA',
    overflow: 'hidden',
  },
  ruleSeat: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    borderCurve: 'continuous',
    borderWidth: 1.5,
  },
  // The app's struck diamond, as it marks a chosen thing everywhere else.
  ruleMark: { height: 6, borderRadius: 1 },
  ruleTxt: { fontFamily: F.serifMedium, fontSize: 15, letterSpacing: 0.2 },

  cardWrap: { padding: 14, paddingBottom: 16 },
  prayerCard: {
    position: 'relative',
    overflow: 'hidden',
    padding: 22,
    paddingBottom: 28,
    borderRadius: 26,
    borderCurve: 'continuous',
    borderWidth: 1,
    alignItems: 'center',
    // Lifted off the page in its own colour, the way the app's best cards are.
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.13,
    shadowRadius: 16,
    elevation: 3,
  },
  prayerCardLit: {
    position: 'absolute',
    top: 1,
    left: 26,
    right: 26,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  orthodoxBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    opacity: 0.92,
  },
  orthodoxLabel: {
    marginTop: 4,
    fontFamily: F.sansBold,
    fontSize: 8,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  prayerCat: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.4, textTransform: 'uppercase' },
  prayerTitle: { fontFamily: F.serifMedium, fontSize: 30, lineHeight: 35, color: C.text, marginTop: 8, textAlign: 'center' },
  prayerRuleSubtitle: { marginTop: 8, fontFamily: F.sansBold, fontSize: 10, lineHeight: 14, letterSpacing: 1.8, textAlign: 'center', textTransform: 'uppercase' },
  ornamentRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18 },
  ornamentLine: { width: 30, height: 1, opacity: 0.42 },
  ornamentDiamond: {
    width: 5.5,
    height: 5.5,
    marginHorizontal: 8,
    borderRadius: 1,
    opacity: 0.85,
    transform: [{ rotate: '45deg' }],
  },
  // 22, not 16: on a devotional page the air between voices is what makes it
  // read as a page rather than a stack of paragraphs.
  blockStack: { width: '100%', marginTop: 22, gap: 22 },
  blockTitleWrap: { width: '100%', alignItems: 'center' },
  blockTitle: { fontFamily: F.serifSemiBold, fontSize: 23, lineHeight: 28, marginTop: 8, textAlign: 'center' },
  // A heading in a prayer book is closed by a mark, not left hanging.
  blockTitleOrnament: { flexDirection: 'row', alignItems: 'center', marginTop: 9 },
  blockTitleRule: { width: 22, height: 1, opacity: 0.34 },
  blockTitleDiamond: {
    width: 4,
    height: 4,
    marginHorizontal: 6,
    borderRadius: 1,
    opacity: 0.7,
    transform: [{ rotate: '45deg' }],
  },
  // The rubric — the book's own voice, telling you what to do. In print it is
  // set in red and stands apart from the prayer; here it takes a tinted slip,
  // so the two voices on the page are never mistaken for one another.
  rubric: { width: '100%', alignItems: 'center', gap: 11, paddingHorizontal: 10 },
  rubricRule: { width: 26, height: 1, opacity: 0.3 },
  prayerInstr: { fontFamily: F.serifMediumItalic, fontSize: 16.5, lineHeight: 24, textAlign: 'center' },
  // 25 over 19, down from 31 in two passes. A devotional page IS leaded wider
  // than a screen of copy, but at 31 — and still at 27 — a preview of a full
  // morning rule read as a column of separate lines rather than as a prayer,
  // and the card grew tall enough to push the rules above it out of reach.
  // 1.32 is the app's own body density; the prayer now sets as a block of
  // text, which is what a printed rule looks like.
  prayerText: { fontFamily: F.serifMedium, fontSize: 19, lineHeight: 25, color: C.text, textAlign: 'center' },
  // The versal: a raised initial, not a sunken drop cap — the form that
  // survives centred text and every script the app carries.
  //
  // ⚠ No line height of its own, so a nested Text inherits the parent's — and
  // anything taller than that is CLIPPED AT THE TOP on Android. This is why it
  // must follow the leading down every time the leading moves: 30 under 31,
  // then 24 under 25, where the cap stands about 16pt inside the line. Weight
  // and the accent colour carry it more than size does at this scale.
  prayerVersal: { fontFamily: F.serifSemiBold, fontSize: 24 },

  startWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', pointerEvents: 'box-none' },

  readerScreen: { flex: 1, backgroundColor: '#FDFBF5' },
  readerHeader: {
    paddingHorizontal: 18,
    paddingBottom: 12,
    backgroundColor: '#FDFBF5',
  },
  readerHeaderRow: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  readerIconSpacer: { width: 34, height: 34 },

  // ── The folio ─────────────────────────────────────────────────────────
  // Where a page number goes in a printed book: set in the book's own face,
  // the leaf in ink and the count behind it, with a struck diamond between.
  // It was a tracked-capitals pill, which is the app's LABEL voice and made
  // the count read as a status chip rather than as a page.
  readerFolio: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  readerFolioFigure: { fontFamily: F.serifSemiBold, fontSize: 19, lineHeight: 24 },
  readerFolioDiamond: { width: 4, height: 4, borderRadius: 1, transform: [{ rotate: '45deg' }] },
  readerFolioTotal: { fontFamily: F.serif, fontSize: 17, lineHeight: 24 },

  // ── The roundels ──────────────────────────────────────────────────────
  // Cut from the same stone as the plaque, by the same means: a hairline of
  // the hour's colour with a white catch-light immediately inside it.
  readerRoundel: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F3E8',
  },
  readerRoundelFace: { ...StyleSheet.absoluteFillObject, borderRadius: 17, borderWidth: 1 },
  readerRoundelCatch: {
    position: 'absolute',
    top: 1, left: 1, right: 1, bottom: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
  },

  // ── The ruled channel ─────────────────────────────────────────────────
  // Not a progress bar with a sliding sheen — a rule cut across the head of
  // the page, filling with ink as the rule is read, with the rubricator's
  // diamond riding at the head of it.
  readerRuleChannel: { height: 9, marginTop: 10, marginHorizontal: 3, justifyContent: 'center' },
  readerRuleTrack: { position: 'absolute', left: 0, right: 0, height: 1.5, borderRadius: 1 },
  readerRuleInk: { position: 'absolute', left: 0, height: 9, justifyContent: 'center' },
  // 2.25 against the track's 1.5. What has been read is a line the pen has
  // gone over; an unread rule is the ruling underneath it, and they should
  // not weigh the same.
  readerRuleInkLine: { height: 2.25, borderRadius: 1.2 },
  readerRuleMark: { position: 'absolute', right: -3.5, alignItems: 'center', justifyContent: 'center' },
  readerRuleMarkDiamond: { width: 5.5, height: 5.5, borderRadius: 1, transform: [{ rotate: '45deg' }] },
  readerRuleSerif: { position: 'absolute', width: 1.2, height: 7, borderRadius: 0.6 },
  readerRuleSerifStart: { left: 0 },
  readerRuleSerifEnd: { right: 0 },
  // The light caught under the cut, which is what makes it a rule in a page
  // rather than a bar on a screen.
  readerRuleCatch: {
    position: 'absolute',
    left: 0, right: 0,
    top: '50%',
    marginTop: 2,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  readerScroll: { flex: 1 },
  readerContent: { paddingHorizontal: 28, paddingTop: 18, paddingBottom: 32, alignItems: 'center' },
  readerPageMotion: { width: '100%', alignItems: 'center' },
  // The slip that names which rule is open. It was a tinted pill with tracked
  // capitals and a gear — the app's own furniture, standing at the head of a
  // page of prayers. Now it is cut from the plaque's stone by the plaque's
  // means: an incised hairline of the hour's colour with the light caught
  // inside it, and the rule's name set in the book's own face.
  readerRulePill: {
    minHeight: 36,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: 18,
    paddingHorizontal: 16,
    marginBottom: 24,
    backgroundColor: '#F8F3E8',
  },
  readerRulePillFace: { ...StyleSheet.absoluteFillObject, borderRadius: 18, borderWidth: 1 },
  readerRulePillCatch: {
    position: 'absolute',
    top: 1, left: 1, right: 1, bottom: 1,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  readerRuleText: { flexShrink: 1, fontFamily: F.serifMedium, fontSize: 15.5, lineHeight: 20, textAlign: 'center' },
  readerRuleDiamond: { width: 3.5, height: 3.5, borderRadius: 1, transform: [{ rotate: '45deg' }] },
  readerSlideTitleWrap: { maxWidth: '100%', alignItems: 'center', marginBottom: 22 },
  readerSlideTitle: { fontFamily: F.serifSemiBold, fontSize: 27, lineHeight: 32, letterSpacing: 0, color: C.red, textAlign: 'center' },
  readerSlideTitleSubtitle: { fontFamily: F.serifSemiBold, fontSize: 18, lineHeight: 23, letterSpacing: 0, color: C.red, textAlign: 'center', marginTop: 3 },
  readerSlideTitleNote: { fontFamily: F.serifSemiBold, fontSize: 16, lineHeight: 21, letterSpacing: 0, color: C.red, textAlign: 'center', marginTop: 3 },
  readerInlineTitleWrap: { maxWidth: '100%', alignItems: 'center', alignSelf: 'center', marginTop: 6, marginBottom: -2 },
  readerInlineTitle: { fontFamily: F.serifSemiBold, fontSize: 23, lineHeight: 28, letterSpacing: 0, color: C.red, textAlign: 'center' },
  readerInlineTitleSubtitle: { fontFamily: F.serifSemiBold, fontSize: 16, lineHeight: 21, letterSpacing: 0, color: C.red, textAlign: 'center', marginTop: 2 },
  readerInlineTitleNote: { fontFamily: F.serifSemiBold, fontSize: 15, lineHeight: 20, letterSpacing: 0, color: C.red, textAlign: 'center', marginTop: 2 },
  readerParts: { width: '100%', gap: 16, alignItems: 'center' },
  readerLabelInstruction: { fontFamily: F.serifMediumItalic, fontSize: 18, lineHeight: 26, letterSpacing: 0, color: C.red, textAlign: 'center' },
  readerRepeatInstruction: { width: '100%', fontFamily: F.serifMedium, fontSize: 21, lineHeight: 29, letterSpacing: 0, textAlign: 'left' },
  readerInstruction: { fontFamily: F.serifMediumItalic, fontSize: 18, lineHeight: 28, color: C.red, textAlign: 'center' },
  readerPrayerText: { width: '100%', fontFamily: F.serifMedium, fontSize: 21, lineHeight: 29, letterSpacing: 0, color: '#1C1917', textAlign: 'left' },
  readerExaminationText: { width: '100%', fontFamily: F.serifMedium, fontSize: 20, lineHeight: 29, letterSpacing: 0, color: '#1C1917', textAlign: 'left' },
  readerExaminationStep: { fontFamily: F.serifSemiBold, color: '#1C1917' },
  readerNav: {
    paddingHorizontal: 20,
    // 11, down from 14: with the roundel grown to the plaque's own height the
    // bar no longer has to carry a control that sat below the type's baseline,
    // so the air above can come in and the whole foot is shorter.
    paddingTop: 11,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFDF8',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.04,
    shadowRadius: 18,
    elevation: 8,
  },
  // The head-band's rule, mirrored — catch-light ABOVE the cut this time,
  // because the light still falls from the top of the page.
  readerNavRule: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
  readerNavRuleCatch: {
    position: 'absolute',
    top: 1, left: 0, right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  // Both sides are the roundel's width, so the centre cell is centred on the
  // screen and not merely between two unequal neighbours.
  readerNavSide: { width: 46, alignItems: 'flex-start' },
  readerNavCentre: { flex: 1, alignItems: 'center' },
  readerNavDisabled: { opacity: 0 },
  // 46: the compact plaque's own height. At 34 it read as a smaller class of
  // thing sitting off the plaque's baseline; matched, the two are one row.
  readerBackRoundel: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F3E8',
  },
  readerBackFace: { ...StyleSheet.absoluteFillObject, borderRadius: 23, borderWidth: 1 },
  readerBackCatch: {
    position: 'absolute',
    top: 1, left: 1, right: 1, bottom: 1,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
  },

  selectorOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(28,25,23,0.24)' },
  selectorSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 10, paddingHorizontal: 18, shadowColor: '#000', shadowOpacity: 0.18, shadowOffset: { width: 0, height: -10 }, shadowRadius: 28, elevation: 18 },
  selectorHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#E7E5E4', alignSelf: 'center', marginBottom: 12 },
  selectorHeader: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  selectorTitle: { fontFamily: F.serifMedium, fontSize: 21, color: C.text },
  selectorClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F5F5F4', alignItems: 'center', justifyContent: 'center' },
  selectorList: { gap: 10 },
  selectorOption: { minHeight: 72, borderRadius: 18, borderWidth: 1, paddingHorizontal: 15, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  selectorOptionInactive: { backgroundColor: '#FAFAF9', borderColor: '#EEE9E0' },
  selectorCopy: { flex: 1, minWidth: 0 },
  selectorOptionTitle: { fontFamily: F.serifMedium, fontSize: 19, lineHeight: 23, flexShrink: 1 },
  selectorOptionTrailing: {
    minWidth: 56,
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 7,
  },
  selectorOrthodoxBadge: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8DCC4',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  selectorOrthodoxBadgeText: {
    fontFamily: F.sansBold,
    fontSize: 7.5,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  selectorOptionSub: {
    marginTop: 4,
    fontFamily: F.sans,
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: 0,
    color: '#8A8178',
  },
});
