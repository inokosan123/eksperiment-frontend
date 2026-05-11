import { useMemo, useRef, useState } from 'react';
import { Modal, Pressable, View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import { Sun, Utensils, Moon, Sparkles, Heart, Play, X, Settings, CheckSmall } from '@/components/icons/Icons';
import SetAsDailyTaskCard from '@/components/shared/SetAsDailyTaskCard';
import SetAsTaskSheet from '@/components/shared/SetAsTaskSheet';
import { useTasks } from '@/components/tasks/TaskProvider';
import { C, F } from '@/constants/tokens';
import {
  getPrayerOptions,
  PrayerBlock,
  PrayerCategory,
  PrayerLanguage,
  PrayerOption,
  PrayerSection,
} from '@/data/prayers/prayerCatalog';

type CatTheme = { accent: string; bg: string; border: string };
type PrayerSlidePart = { type: 'instruction' | 'text'; content: string; tone?: 'label' | 'repeat' | 'rubric' };
type PrayerSlide = { title: string; parts: PrayerSlidePart[] };

const DEFAULT_PRAYER_LANGUAGE: PrayerLanguage = 'en';

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

const PAGE_WORD_LIMIT = 210;
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

  if (
    lower.includes('three times')
    || lower.includes('thrice')
    || lower.includes('\u0442\u0440\u0438\u043f\u0443\u0442')
    || lower.includes('\u0442\u0440\u0438\u0436\u0434\u044b')
    || lower.includes('3 \u043f\u0443\u0442\u0430')
    || lower.includes('3 \u0440\u0430\u0437\u0430')
  ) {
    return 'repeat';
  }

  if (clean.endsWith(':') && wordCount(clean.replace(/:$/, '')) <= 6) {
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

function pushGroupSlides(slides: PrayerSlide[], title: string, parts: PrayerSlidePart[]) {
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

      if (tone === 'rubric' && hasTextPart(currentParts) && currentTitle !== section.title) {
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

export default function PrayerBookView() {
  const { createOrUpdateTask, refresh: refreshTasks } = useTasks();
  const [category, setCategory] = useState<PrayerCategory>('morning');
  const [optionId, setOptionId] = useState('standard');
  const [isReaderActive, setIsReaderActive] = useState(false);
  const [showTaskSheet, setShowTaskSheet] = useState(false);
  const [taskSummary, setTaskSummary] = useState('Add to your daily routine');
  const insets = useSafeAreaInsets();

  const theme = CAT_THEMES[category];
  const options = useMemo(() => getPrayerOptions(DEFAULT_PRAYER_LANGUAGE, category), [category]);
  const selectedOption = options.find(option => option.id === optionId) ?? options[0];
  const section = selectedOption.section;
  const slides = useMemo(() => buildPrayerSlides(section), [section]);

  const handleCategoryChange = (cat: PrayerCategory) => {
    const nextOptions = getPrayerOptions(DEFAULT_PRAYER_LANGUAGE, cat);
    setCategory(cat);
    setOptionId(nextOptions[0]?.id ?? 'standard');
    setIsReaderActive(false);
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
        onClose={() => setIsReaderActive(false)}
        onOptionChange={setOptionId}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenTitleBar title="PRAYER BOOK" showBack />

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
                onPress={() => setOptionId(option.id)}
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

        <View style={s.cardWrap}>
          <View style={[s.prayerCard, { backgroundColor: theme.bg, borderColor: theme.border }]}>
            <Text style={[s.prayerCat, { color: theme.accent }]}>
              {category === 'jesus' ? 'JESUS PRAYER' : CATEGORIES.find(c => c.id === category)?.label}
            </Text>
            <Text style={s.prayerTitle}>{section.title}</Text>
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
          onPress={() => setIsReaderActive(true)}
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

function PrayerReader({
  section,
  slides,
  options,
  selectedOption,
  theme,
  topInset,
  bottomInset,
  onClose,
  onOptionChange,
}: {
  section: PrayerSection;
  slides: PrayerSlide[];
  options: PrayerOption[];
  selectedOption: PrayerOption;
  theme: CatTheme;
  topInset: number;
  bottomInset: number;
  onClose: () => void;
  onOptionChange: (id: string) => void;
}) {
  const [slideIndex, setSlideIndex] = useState(0);
  const [showRuleSelector, setShowRuleSelector] = useState(false);
  const readerScrollRef = useRef<ScrollView | null>(null);
  const boundedIndex = Math.min(slideIndex, Math.max(0, slides.length - 1));
  const slide = slides[boundedIndex];
  const isFirst = boundedIndex === 0;
  const isLast = boundedIndex === slides.length - 1;
  const progress = slides.length > 0 ? ((boundedIndex + 1) / slides.length) * 100 : 0;

  const scrollToTop = () => {
    requestAnimationFrame(() => readerScrollRef.current?.scrollTo({ y: 0, animated: false }));
  };

  const goPrev = () => {
    if (isFirst) return;
    setSlideIndex(index => Math.max(0, index - 1));
    scrollToTop();
  };

  const goNext = () => {
    if (isLast) {
      onClose();
      return;
    }

    setSlideIndex(index => Math.min(slides.length - 1, index + 1));
    scrollToTop();
  };

  const handleOptionSelect = (id: string) => {
    onOptionChange(id);
    setSlideIndex(0);
    setShowRuleSelector(false);
    scrollToTop();
  };

  if (!slide) {
    return (
      <View style={s.readerScreen}>
        <View style={[s.readerHeader, { height: topInset + 56, paddingTop: topInset + 8 }]}>
          <TouchableOpacity onPress={onClose} style={s.readerIconBtn} activeOpacity={0.75}>
            <X s={20} c="#78716C" />
          </TouchableOpacity>
          <Text style={s.readerCounter}>0 / 0</Text>
          <View style={s.readerIconBtn} />
        </View>
      </View>
    );
  }

  return (
    <View style={s.readerScreen}>
      <View style={s.readerProgressTrack}>
        <View style={[s.readerProgressFill, { width: `${progress}%`, backgroundColor: theme.accent }]} />
      </View>

      <View style={[s.readerHeader, { height: topInset + 56, paddingTop: topInset + 8 }]}>
        <TouchableOpacity onPress={onClose} style={s.readerIconBtn} activeOpacity={0.75}>
          <X s={20} c="#78716C" />
        </TouchableOpacity>
        <Text style={[s.readerCounter, { color: theme.accent }]}>
          {boundedIndex + 1} / {slides.length}
        </Text>
        <View style={s.readerIconBtn} />
      </View>

      <ScrollView
        ref={readerScrollRef}
        style={s.readerScroll}
        contentContainerStyle={s.readerContent}
        showsVerticalScrollIndicator={false}
      >
        {isFirst && (
          <TouchableOpacity
            onPress={() => setShowRuleSelector(true)}
            activeOpacity={0.76}
            style={[s.readerRulePill, { borderColor: theme.border, backgroundColor: theme.bg }]}
          >
            <Text style={[s.readerRuleText, { color: theme.accent }]}>{selectedOption.label}</Text>
            <Settings s={12} c={theme.accent} w={2} />
          </TouchableOpacity>
        )}

        {isFirst && <Text style={s.readerMainTitle}>{section.title}</Text>}

        {slide.title !== section.title && (
          <Text style={[s.readerSlideTitle, { color: theme.accent }]}>{slide.title}</Text>
        )}

        <View style={s.readerParts}>
          {slide.parts.map((part, index) => (
            <Text
              key={`${part.type}-${index}`}
              style={[
                part.type === 'instruction'
                  ? part.tone === 'label'
                    ? [s.readerLabelInstruction, { color: theme.accent }]
                    : part.tone === 'repeat'
                      ? [s.readerRepeatInstruction, { color: theme.accent }]
                      : s.readerInstruction
                  : s.readerPrayerText,
              ]}
            >
              {part.content}
            </Text>
          ))}
        </View>
      </ScrollView>

      <View style={[s.readerNav, { paddingBottom: bottomInset + 14 }]}>
        <TouchableOpacity
          onPress={goPrev}
          disabled={isFirst}
          activeOpacity={0.76}
          style={[s.readerBackBtn, isFirst && s.readerNavDisabled]}
        >
          <Text style={s.readerBackText}>BACK</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={goNext}
          activeOpacity={0.82}
          style={[s.readerNextBtn, { backgroundColor: theme.accent, shadowColor: theme.accent }]}
        >
          <Text style={s.readerNextText}>{isLast ? 'FINISH' : 'CONTINUE'}</Text>
        </TouchableOpacity>
      </View>

      <Modal
        transparent
        visible={showRuleSelector}
        animationType="fade"
        onRequestClose={() => setShowRuleSelector(false)}
      >
        <View style={s.selectorOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowRuleSelector(false)} />
          <View style={[s.selectorSheet, { paddingBottom: bottomInset + 24 }]}>
            <View style={s.selectorHandle} />
            <View style={s.selectorHeader}>
              <Text style={s.selectorTitle}>Prayer Rule</Text>
              <TouchableOpacity onPress={() => setShowRuleSelector(false)} style={s.selectorClose} activeOpacity={0.76}>
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
    </View>
  );
}

const s = StyleSheet.create({
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
  readerProgressTrack: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: 'rgba(197,160,89,0.16)', zIndex: 20 },
  readerProgressFill: { height: 3 },
  readerHeader: {
    height: 58,
    paddingHorizontal: 18,
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  readerIconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  readerCounter: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.2 },
  readerScroll: { flex: 1 },
  readerContent: { paddingHorizontal: 28, paddingTop: 16, paddingBottom: 32, alignItems: 'center' },
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
  readerRuleText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' },
  readerMainTitle: { fontFamily: F.serifMedium, fontSize: 30, lineHeight: 35, color: C.text, textAlign: 'center', marginBottom: 18 },
  readerSlideTitle: { fontFamily: F.sansBold, fontSize: 10, lineHeight: 16, letterSpacing: 2.4, textTransform: 'uppercase', textAlign: 'center', marginBottom: 20 },
  readerParts: { width: '100%', gap: 14, alignItems: 'center' },
  readerLabelInstruction: { fontFamily: F.sansBold, fontSize: 10, lineHeight: 16, letterSpacing: 2, textTransform: 'uppercase', textAlign: 'center' },
  readerRepeatInstruction: { fontFamily: F.serifMediumItalic, fontSize: 15, lineHeight: 23, textAlign: 'center' },
  readerInstruction: { fontFamily: F.serifMediumItalic, fontSize: 16, lineHeight: 25, color: '#8B2020', textAlign: 'center' },
  readerPrayerText: { fontFamily: F.serifMedium, fontSize: 21, lineHeight: 32, color: '#1C1917', textAlign: 'center' },
  readerNav: {
    minHeight: 82,
    paddingHorizontal: 28,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(197,160,89,0.16)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FDFBF5',
  },
  readerBackBtn: { height: 48, minWidth: 86, alignItems: 'flex-start', justifyContent: 'center' },
  readerNavDisabled: { opacity: 0 },
  readerBackText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 2, color: '#A8A29E' },
  readerNextBtn: {
    minWidth: 148,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 5,
  },
  readerNextText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 2, color: '#FFFFFF' },

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
