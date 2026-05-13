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
import Reanimated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import { Sun, Utensils, Moon, Sparkles, Heart, Play, X, Settings, CheckSmall } from '@/components/icons/Icons';
import ConfirmModal from '@/components/shared/ConfirmModal';
import SetAsDailyTaskCard from '@/components/shared/SetAsDailyTaskCard';
import SetAsTaskSheet from '@/components/shared/SetAsTaskSheet';
import { useTasks } from '@/components/tasks/TaskProvider';
import { getLocalDateKey } from '@/components/tasks/taskScheduler';
import { queueTaskCompletionReturnAnimation } from '@/components/tasks/taskReturnAnimation';
import { C, F } from '@/constants/tokens';
import { HapticTouchableOpacity as TouchableOpacity, HapticPressable as Pressable } from '@/components/shared/HapticTouch';

import {
  getPrayerOptions,
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

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizePrayerCategory(value: string | string[] | undefined): PrayerCategory | undefined {
  const category = firstParam(value);
  return PRAYER_CATEGORIES.includes(category as PrayerCategory) ? category as PrayerCategory : undefined;
}

function defaultOptionId(options: PrayerOption[]) {
  return options.find(option => option.id === 'standard')?.id ?? options[0]?.id ?? 'standard';
}

function isPersonalRuleOption(category: PrayerCategory, optionId?: string) {
  return optionId === 'personal' && (category === 'morning' || category === 'evening');
}

const CAT_THEMES: Record<PrayerCategory, CatTheme> = {
  morning: { accent: '#D97706', bg: '#FEF3C7', border: '#FDE68A' },
  meal: { accent: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE' },
  evening: { accent: '#7C6EAF', bg: '#EDE9FE', border: '#C4B5FD' },
  jesus: { accent: '#C5A059', bg: '#FFFBEB', border: '#E8DCC4' },
  other: { accent: '#10B981', bg: '#ECFDF5', border: '#6EE7B7' },
};

const CATEGORIES: { id: PrayerCategory; label: string; Icon: React.ComponentType<any> }[] = [
  { id: 'morning', label: 'MORN', Icon: Sun },
  { id: 'meal', label: 'MEALS', Icon: Utensils },
  { id: 'evening', label: 'EVE', Icon: Moon },
  { id: 'jesus', label: 'JESUS', Icon: Sparkles },
  { id: 'other', label: 'OTHER', Icon: Heart },
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

function isShortEveningRuleTitle(title: string) {
  const clean = title.trim().toLocaleLowerCase();

  return (
    clean === 'short evening rule'
    || clean === '\u043a\u0440\u0430\u0442\u043a\u043e \u0432\u0435\u0447\u0435\u0440\u045a\u0435 \u043f\u0440\u0430\u0432\u0438\u043b\u043e'
    || clean === '\u043a\u0440\u0430\u0442\u043a\u043e\u0435 \u0432\u0435\u0447\u0435\u0440\u043d\u0435\u0435 \u043f\u0440\u0430\u0432\u0438\u043b\u043e'
  );
}

function stripParentheticalTitle(title: string) {
  return title.replace(/\s*\([^()]+\)\s*$/, '').trim();
}

function hasRulePreviewSubtitle(category: PrayerCategory) {
  return category === 'morning' || category === 'evening';
}

function mergeShortEveningOpeningSlides(section: PrayerSection, slides: PrayerSlide[]) {
  if (!isShortEveningRuleTitle(section.title) || slides.length < 2) return slides;

  const [firstSlide, secondSlide, ...restSlides] = slides;
  return [
    {
      title: firstSlide.title,
      parts: [
        ...firstSlide.parts,
        { type: 'title' as const, content: secondSlide.title },
        ...secondSlide.parts,
      ],
    },
    ...restSlides,
  ];
}

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
  return mergeShortEveningOpeningSlides(section, slides);
}

export default function PrayerBookView() {
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
  const [prayerLanguage, setPrayerLanguage] = useState<PrayerLanguage>(DEFAULT_PRAYER_LANGUAGE);
  const [category, setCategory] = useState<PrayerCategory>(launchedCategory ?? 'morning');
  const [optionId, setOptionId] = useState(launchedOptionId ?? 'standard');
  const [isReaderActive, setIsReaderActive] = useState(launchedAutoStart && !!launchedCategory);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [showTaskSheet, setShowTaskSheet] = useState(false);
  const [taskSummary, setTaskSummary] = useState('Add to your daily routine');
  const insets = useSafeAreaInsets();

  const theme = CAT_THEMES[category];
  const options = useMemo(() => getPrayerOptions(prayerLanguage, category), [category, prayerLanguage]);
  const selectedOption = options.find(option => option.id === optionId) ?? options[0];
  const section = selectedOption.section;
  const slides = useMemo(() => buildPrayerSlides(section), [section]);
  const canChooseRule = options.length > 1;
  const previewTitle = PREVIEW_CATEGORY_TITLES[prayerLanguage][category] ?? stripParentheticalTitle(section.title);
  const previewRuleSubtitle = hasRulePreviewSubtitle(category) ? selectedOption.label : '';

  useEffect(() => {
    if (!launchedAutoStart || !launchedCategory) return;
    const nextOptions = getPrayerOptions(prayerLanguage, launchedCategory);
    const nextOption = nextOptions.some(option => option.id === launchedOptionId)
      ? launchedOptionId
      : defaultOptionId(nextOptions);

    setCategory(launchedCategory);
    setOptionId(nextOption ?? 'standard');
    setIsReaderActive(!isPersonalRuleOption(launchedCategory, nextOption));
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
  };

  const handleLanguageChange = (lang: PrayerLanguage) => {
    Haptics.selectionAsync().catch(() => {});
    const nextOptions = getPrayerOptions(lang, category);
    setPrayerLanguage(lang);
    setOptionId(currentOptionId => (
      nextOptions.some(option => option.id === currentOptionId)
        ? currentOptionId
        : defaultOptionId(nextOptions)
    ));
    setShowLanguageMenu(false);
    setIsReaderActive(false);
  };

  const openPersonalRule = useCallback((titleOverride?: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const route = {
      pathname: '/personal-rule',
      params: {
        title: titleOverride ?? selectedOption?.label ?? 'Personal Rule',
        prayerType: category,
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
  }, [category, isTaskLaunch, router, selectedOption?.label, taskDate, taskInstanceId]);

  const handleOptionChange = useCallback((id: string) => {
    if (isPersonalRuleOption(category, id)) {
      openPersonalRule(options.find(option => option.id === id)?.label);
      return;
    }

    setOptionId(id);
  }, [category, openPersonalRule, options]);

  const handleStartPrayer = () => {
    if (isPersonalRuleOption(category, selectedOption?.id)) {
      openPersonalRule();
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setIsReaderActive(true);
  };

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
        showBack
        rightElement={(
          <TouchableOpacity
            onPress={() => {
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
                        ? { backgroundColor: theme.bg, borderColor: theme.border }
                        : s.languageOptionInactive,
                    ]}
                  >
                    <View style={s.languageCopy}>
                      <Text style={[s.languageName, { color: active ? theme.accent : C.text }]}>
                        {language.name}
                      </Text>
                      <Text style={s.languageCode}>{language.label}</Text>
                    </View>
                    {active && <CheckSmall s={18} c={theme.accent} w={2.4} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.bannerWrap}>
          <SetAsDailyTaskCard onPress={() => setShowTaskSheet(true)} variant="soft" subtitle={taskSummary} />
        </View>

        <View style={s.catGrid}>
          {CATEGORIES.map(cat => {
            const active = category === cat.id;
            const t = CAT_THEMES[cat.id];

            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => handleCategoryChange(cat.id)}
                activeOpacity={0.78}
                style={[
                  s.catBtn,
                  active
                    ? {
                      backgroundColor: t.bg,
                      borderColor: t.border,
                      shadowColor: t.accent,
                      shadowOpacity: 0.14,
                      shadowOffset: { width: 0, height: 3 },
                      shadowRadius: 8,
                      elevation: 2,
                    }
                    : s.catInactive,
                ]}
              >
                <cat.Icon s={21} c={active ? t.accent : '#C4BAA8'} w={active ? 2 : 1.6} />
                <Text style={[s.catLabel, { color: active ? t.accent : '#B5ADA0' }]}>{cat.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {canChooseRule && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.ruleScroll}
          >
            {options.map(option => {
              const active = option.id === selectedOption.id;

              return (
                  <TouchableOpacity
                    key={option.id}
                    onPress={() => handleOptionChange(option.id)}
                    activeOpacity={0.8}
                  style={[
                    s.rulePill,
                    active
                      ? { backgroundColor: theme.bg, borderColor: theme.accent, borderWidth: 1.5 }
                      : s.rulePillInactive,
                  ]}
                >
                  {active && <View style={[s.ruleDot, { backgroundColor: theme.accent }]} />}
                  <Text style={[s.ruleTxt, { color: active ? theme.accent : '#78716C' }]}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        <View style={s.cardWrap}>
          <View style={[s.prayerCard, { backgroundColor: theme.bg, borderColor: theme.border }]}>
            <Text style={[s.prayerCat, { color: theme.accent }]}>
              {category === 'jesus' ? 'JESUS PRAYER' : CATEGORIES.find(c => c.id === category)?.label}
            </Text>
            <Text style={s.prayerTitle}>{previewTitle}</Text>
            {previewRuleSubtitle && (
              <Text style={[s.prayerRuleSubtitle, { color: theme.accent }]}>
                {previewRuleSubtitle}
              </Text>
            )}
            <View style={[s.divider, { backgroundColor: theme.accent, opacity: 0.4 }]} />

            <View style={s.blockStack}>
              {section.blocks.map((block, index) => (
                <PrayerBlockView
                  key={`${block.type}-${index}`}
                  block={block}
                  accent={theme.accent}
                />
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[s.startWrap, { bottom: insets.bottom + 20 }]} pointerEvents="box-none">
        <TouchableOpacity
          style={[s.startBtn, { backgroundColor: theme.accent, shadowColor: theme.accent }]}
          activeOpacity={0.85}
          onPress={handleStartPrayer}
        >
          <View style={s.playCircle}>
            <Play s={12} c="#fff" />
          </View>
          <Text style={s.startTxt}>START PRAYER</Text>
        </TouchableOpacity>
      </View>

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

function PrayerBlockView({ block, accent }: { block: PrayerBlock; accent: string }) {
  if (block.type === 'title') {
    return <Text style={[s.blockTitle, { color: accent }]}>{block.content}</Text>;
  }

  if (block.type === 'instruction') {
    return <Text style={[s.prayerInstr, { color: accent }]}>{block.content}</Text>;
  }

  return <Text style={s.prayerText}>{block.content}</Text>;
}

function ReaderSlideTitle({ title }: { title: string }) {
  const splitTitle = splitRepeatTitle(title);
  const commaTitle = splitCommaTitle(splitTitle.title);

  return (
    <View style={s.readerSlideTitleWrap}>
      <Text style={s.readerSlideTitle}>{commaTitle.title}</Text>
      {commaTitle.subtitle && (
        <Text style={s.readerSlideTitleSubtitle}>{commaTitle.subtitle}</Text>
      )}
      {splitTitle.repeatNote && (
        <Text style={s.readerSlideTitleNote}>{splitTitle.repeatNote}</Text>
      )}
    </View>
  );
}

function ReaderInlineTitle({ title }: { title: string }) {
  const splitTitle = splitRepeatTitle(title);
  const commaTitle = splitCommaTitle(splitTitle.title);

  return (
    <View style={s.readerInlineTitleWrap}>
      <Text style={s.readerInlineTitle}>{commaTitle.title}</Text>
      {commaTitle.subtitle && (
        <Text style={s.readerInlineTitleSubtitle}>{commaTitle.subtitle}</Text>
      )}
      {splitTitle.repeatNote && (
        <Text style={s.readerInlineTitleNote}>{splitTitle.repeatNote}</Text>
      )}
    </View>
  );
}

function ReaderExaminationInstruction({ content }: { content: string }) {
  const step = splitExaminationStep(content);

  if (!step) {
    return <Text style={s.readerExaminationText}>{content}</Text>;
  }

  return (
    <Text style={s.readerExaminationText}>
      <Text style={s.readerExaminationStep}>{step.label}</Text>
      {`: ${step.body}`}
    </Text>
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
    pageMotion.value = withTiming(1, {
      duration: 390,
      easing: Easing.out(Easing.cubic),
    }, () => {
      runOnJS(releaseTransitionLock)();
    });
  }, [boundedIndex, selectedOption.id, pageMotion]);

  const progressFillStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(100, progressMotion.value))}%`,
  }));

  const progressSheenStyle = useAnimatedStyle(() => ({
    opacity: 0.18 + progressGlowMotion.value * 0.48,
    transform: [{ translateX: progressGlowMotion.value * 18 }],
  }));

  const pageMotionStyle = useAnimatedStyle(() => ({
    opacity: 0.46 + pageMotion.value * 0.54,
    transform: [
      { translateX: (1 - pageMotion.value) * 18 * pageDirection.value },
      { translateY: (1 - pageMotion.value) * 4 },
      { scale: 0.99 + pageMotion.value * 0.01 },
    ],
  }));

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
      finishHaptic();
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
        <View style={[s.readerHeader, { paddingTop: topInset + 2 }]}>
          <View style={s.readerHeaderRow}>
            <View style={s.readerIconSpacer} />
            <View style={[s.readerCounterPill, { borderColor: C.goldLight, backgroundColor: C.goldBg }]}>
              <Text style={s.readerCounter}>0 / 0</Text>
            </View>
            <TouchableOpacity onPress={requestExit} style={[s.readerIconBtn, { borderColor: C.goldLight, backgroundColor: C.goldBg }]} activeOpacity={0.82}>
              <X s={14} c={C.goldDark} w={2.35} />
            </TouchableOpacity>
          </View>
          <View style={s.readerProgressTrack}>
            <Reanimated.View style={[s.readerProgressFill, progressFillStyle, { backgroundColor: C.gold }]}>
              <Reanimated.View style={[s.readerProgressSheen, progressSheenStyle]} />
            </Reanimated.View>
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
      <View style={[s.readerHeader, { paddingTop: topInset + 2 }]}>
        <View style={s.readerHeaderRow}>
          <View style={s.readerIconSpacer} />
          <View style={[s.readerCounterPill, { borderColor: theme.border, backgroundColor: theme.bg }]}>
            <Text style={[s.readerCounter, { color: theme.accent }]}>
              {boundedIndex + 1} / {slides.length}
            </Text>
          </View>
          <TouchableOpacity onPress={requestExit} style={[s.readerIconBtn, { borderColor: theme.border, backgroundColor: theme.bg }]} activeOpacity={0.82}>
            <X s={14} c={theme.accent} w={2.35} />
          </TouchableOpacity>
        </View>
        <View style={s.readerProgressTrack}>
          <Reanimated.View style={[s.readerProgressFill, progressFillStyle, { backgroundColor: theme.accent }]}>
            <Reanimated.View style={[s.readerProgressSheen, progressSheenStyle]} />
          </Reanimated.View>
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
              style={[s.readerRulePill, { borderColor: theme.border, backgroundColor: theme.bg }]}
            >
              <Text style={[s.readerRuleText, { color: theme.accent }]}>{selectedOption.label}</Text>
              <Settings s={12} c={theme.accent} w={2} />
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
                <Text
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
                </Text>
              );
            })}
          </View>
        </Reanimated.View>
      </ScrollView>

      <View style={[s.readerNav, { paddingBottom: Math.max(bottomInset + 8, 18) }]}>
        <TouchableOpacity
          onPress={goPrev}
          onPressIn={() => { backPressMotion.value = withTiming(0.97, { duration: 80 }); }}
          onPressOut={() => { backPressMotion.value = withTiming(1, { duration: 120 }); }}
          disabled={isFirst}
          activeOpacity={1}
          style={isFirst && s.readerNavDisabled}
        >
          <Reanimated.View style={[s.readerBackBtn, backButtonMotionStyle]}>
            <Text style={s.readerBackText}>BACK</Text>
          </Reanimated.View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={goNext}
          onPressIn={() => { nextPressMotion.value = withTiming(0.975, { duration: 80 }); }}
          onPressOut={() => { nextPressMotion.value = withTiming(1, { duration: 120 }); }}
          activeOpacity={1}
        >
          <Reanimated.View style={[s.readerNextBtn, { backgroundColor: theme.accent, shadowColor: theme.accent }, nextButtonMotionStyle]}>
            <Text style={s.readerNextText}>{isLast ? 'FINISH' : 'CONTINUE'}</Text>
          </Reanimated.View>
        </TouchableOpacity>
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
                    {active && <CheckSmall s={18} c={theme.accent} />}
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

  bannerWrap: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10 },

  catGrid: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingTop: 6, paddingBottom: 0 },
  catBtn: { flex: 1, borderRadius: 18, paddingVertical: 13, paddingHorizontal: 4, alignItems: 'center', gap: 7, borderWidth: 1 },
  catInactive: { backgroundColor: '#F8F6F2', borderColor: '#EDE8DF' },
  catLabel: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.6 },

  ruleScroll: { gap: 8, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 6 },
  rulePill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1 },
  rulePillInactive: { backgroundColor: '#FFFFFF', borderColor: '#E8E3DA' },
  ruleDot: { width: 6, height: 6, borderRadius: 3 },
  ruleTxt: { fontFamily: F.serifMedium, fontSize: 14, letterSpacing: 0.2 },

  cardWrap: { padding: 14, paddingBottom: 16 },
  prayerCard: { padding: 22, paddingBottom: 28, borderRadius: 26, borderWidth: 1, alignItems: 'center' },
  prayerCat: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.4, textTransform: 'uppercase' },
  prayerTitle: { fontFamily: F.serifMedium, fontSize: 30, lineHeight: 35, color: C.text, marginTop: 8, textAlign: 'center' },
  prayerRuleSubtitle: { marginTop: 8, fontFamily: F.sansBold, fontSize: 10, lineHeight: 14, letterSpacing: 1.8, textAlign: 'center', textTransform: 'uppercase' },
  divider: { marginTop: 16, width: 44, height: 1 },
  blockStack: { width: '100%', marginTop: 20, gap: 16 },
  blockTitle: { fontFamily: F.serifSemiBold, fontSize: 23, lineHeight: 28, marginTop: 8, textAlign: 'center' },
  prayerInstr: { fontFamily: F.serifMediumItalic, fontSize: 17, lineHeight: 26, textAlign: 'center' },
  prayerText: { fontFamily: F.serifMedium, fontSize: 19, lineHeight: 29, color: C.text, textAlign: 'center' },

  startWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', pointerEvents: 'box-none' },
  startBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16, paddingHorizontal: 32, borderRadius: 9999, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 12, elevation: 8 },
  playCircle: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  startTxt: { fontFamily: F.sansBold, fontSize: 13, letterSpacing: 2.2, color: '#fff' },

  readerScreen: { flex: 1, backgroundColor: '#FDFBF5' },
  readerProgressTrack: { height: 3, borderRadius: 999, backgroundColor: 'rgba(197,160,89,0.13)', overflow: 'hidden', marginHorizontal: 14, marginTop: 5 },
  readerProgressFill: { height: '100%', borderRadius: 999, overflow: 'hidden' },
  readerProgressSheen: { position: 'absolute', top: 0, right: -10, bottom: 0, width: 34, backgroundColor: 'rgba(255,255,255,0.34)' },
  readerHeader: {
    paddingHorizontal: 18,
    paddingBottom: 11,
    backgroundColor: '#FDFBF5',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(197,160,89,0.12)',
  },
  readerHeaderRow: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  readerIconBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center', shadowColor: '#1C1917', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.045, shadowRadius: 8, elevation: 1 },
  readerIconSpacer: { width: 34, height: 34 },
  readerCounterPill: { minWidth: 68, height: 28, borderRadius: 14, paddingHorizontal: 12, borderWidth: 1, borderColor: 'rgba(197,160,89,0.18)', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  readerCounter: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.2, color: '#78716C' },
  readerScroll: { flex: 1 },
  readerContent: { paddingHorizontal: 28, paddingTop: 18, paddingBottom: 32, alignItems: 'center' },
  readerPageMotion: { width: '100%', alignItems: 'center' },
  readerRulePill: {
    minHeight: 34,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderRadius: 17,
    paddingHorizontal: 14,
    marginBottom: 24,
  },
  readerRuleText: { flexShrink: 1, fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', textAlign: 'center' },
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
    minHeight: 76,
    paddingHorizontal: 24,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: 'rgba(197,160,89,0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: '#FFFDF8',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.04,
    shadowRadius: 18,
    elevation: 8,
  },
  readerBackBtn: { height: 44, minWidth: 86, borderRadius: 22, borderWidth: 1, borderColor: '#E7E0D3', backgroundColor: 'rgba(255,255,255,0.78)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  readerNavDisabled: { opacity: 0 },
  readerBackText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.7, color: '#A8A29E' },
  readerNextBtn: {
    height: 44,
    minWidth: 126,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  readerNextText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.7, color: '#FFFFFF' },

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
  selectorOptionTitle: { fontFamily: F.serifMedium, fontSize: 19, lineHeight: 23 },
  selectorOptionSub: { marginTop: 3, fontFamily: F.sansBold, fontSize: 9, lineHeight: 13, letterSpacing: 1.5, color: '#A8A29E', textTransform: 'uppercase' },
});
