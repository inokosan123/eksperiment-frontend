import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGuidedSetup, useGuideTarget } from '@/components/onboarding/guided/GuidedSetupContext';
import { GuidedOverlayHost } from '@/components/onboarding/guided/GuidedOverlayHost';
import { useGuidedScrollTransition } from '@/components/onboarding/guided/use-guided-scroll-transition';
import {
  Pencil, Search, SlidersHorizontal, Star, Trash2, X,
} from '@/components/icons/Icons';
import ConfirmModal from '@/components/shared/ConfirmModal';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import {
  getAnnotationCategoryLabel, getAnnotationColorHex, hexToRgba,
  HighlightColor, ColorCategory,
} from '@/constants/annotationColors';
import { C, F } from '@/constants/tokens';
import { BIBLE_BOOKS, PSALMS_ID } from '@/constants/scripture';
import { CategoryChipPicker, CategoryEditorModal } from './CategoryColorTools';
import RichCommentText from '@/components/shared/RichCommentText';
import { HapticTouchableOpacity as TouchableOpacity, HapticPressable as Pressable } from '@/components/shared/HapticTouch';

import {
  annotationLocation, ScriptureAnnotation, useScripture,
} from './ScriptureContext';

const BG = '#FFFFFF';
const GOLD = '#C5A059';

const FAVORITES_GUIDE_TARGETS = {
  filters: 'favorites.filters',
  categories: 'favorites.categories',
  verseCard: 'favorites.verse-card',
  categorySave: 'favorites.category-save',
} as const;

const GUIDE_FAVORITE_BOOK = 49;
const GUIDE_FAVORITE_CHAPTER = 5;
const GUIDE_FAVORITE_VERSE = 15;

type TypeFilter = 'all' | ScriptureAnnotation['kind'];
type SourceFilter = 'all' | 'nt' | 'ot' | 'psalms';

const BOOK_BY_ID = new Map(BIBLE_BOOKS.map(book => [book.id, book]));
const SOURCE_OPTIONS: { key: SourceFilter; label: string; accent: string }[] = [
  { key: 'all', label: 'All', accent: '#111827' },
  { key: 'nt', label: 'New T.', accent: '#5E7B55' },
  { key: 'ot', label: 'Old T.', accent: '#9A7426' },
  { key: 'psalms', label: 'Psalms', accent: '#C26A1B' },
];

function matchesSource(annotation: ScriptureAnnotation, source: SourceFilter) {
  if (source === 'all') return true;
  if (source === 'psalms') return annotation.bookId === PSALMS_ID;

  const book = BOOK_BY_ID.get(annotation.bookId);
  if (!book) return false;
  if (source === 'nt') return book.testament === 'nt';
  return annotation.bookId !== PSALMS_ID && book.testament !== 'nt';
}

function plainRichText(html?: string) {
  return (html ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

export default function MyFavoritesView({
  guided = false,
  onGuidedAdvance,
  guidedHighlightColor,
  guidedAnnotations = [],
  onGuidedReady,
}: {
  guided?: boolean;
  onGuidedAdvance?: () => void;
  guidedHighlightColor?: HighlightColor;
  guidedAnnotations?: ScriptureAnnotation[];
  onGuidedReady?: () => void;
} = {}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const {
    annotations, categories, deleteAnnotation, updateCategory,
  } = useScripture();

  const [search, setSearch] = useState('');
  const [color, setColor] = useState<HighlightColor | 'all'>('all');
  const [kind, setKind] = useState<TypeFilter>('all');
  const [source, setSource] = useState<SourceFilter>('all');
  const [deleteTarget, setDeleteTarget] = useState<ScriptureAnnotation | null>(null);
  const [colorDeleteGroup, setColorDeleteGroup] = useState<{ annotation: ScriptureAnnotation; colors: string[] } | null>(null);
  const [colorEditorOpen, setColorEditorOpen] = useState(false);
  const [guidedCategoryLabel, setGuidedCategoryLabel] = useState<string | null>(null);

  const { session, patchSession, setPresentation } = useGuidedSetup();
  const isGuided = guided && session?.active === true && session.activeStep === 'riseBibleHighlight';
  const guidePhase = isGuided ? session.phase : '';
  const guidePhaseRef = useRef(guidePhase);
  guidePhaseRef.current = guidePhase;
  const filtersTarget = useGuideTarget(FAVORITES_GUIDE_TARGETS.filters, isGuided);
  const categoriesTarget = useGuideTarget(FAVORITES_GUIDE_TARGETS.categories, isGuided);
  const verseCardTarget = useGuideTarget(FAVORITES_GUIDE_TARGETS.verseCard, isGuided);
  const categorySaveTarget = useGuideTarget(FAVORITES_GUIDE_TARGETS.categorySave, isGuided);
  const favScrollRef = useRef<ScrollView>(null);
  const guideActionLockRef = useRef(false);
  const pendingEditorExitPhaseRef = useRef<'favColors' | 'favVerse' | null>(null);
  const guidedCategorySavedRef = useRef(false);
  const guidedReadyNotifiedRef = useRef(false);
  const {
    clear: clearGuideTimers,
    finish: finishGuideScroll,
    onScroll: handleGuideScroll,
    schedule: scheduleGuide,
    scrollYRef: guideScrollYRef,
    stageTarget: stageGuideTarget,
  } = useGuidedScrollTransition({
    scrollRef: favScrollRef,
    screenHeight,
    setPresentation,
    scrollFallbackMs: 560,
    dismissOnAnyReposition: true,
  });

  const visibleAnnotations = useMemo(() => {
    if (isGuided) return guidedAnnotations;
    return annotations;
  }, [annotations, guidedAnnotations, isGuided]);

  const guideHighlight = useMemo(() => visibleAnnotations.find(annotation => (
    annotation.kind === 'highlight'
    && annotation.bookId === GUIDE_FAVORITE_BOOK
    && annotation.chapter === GUIDE_FAVORITE_CHAPTER
    && annotation.verse === GUIDE_FAVORITE_VERSE
  )), [visibleAnnotations]);

  useEffect(() => {
    guideActionLockRef.current = false;
  }, [guidePhase]);

  useEffect(() => {
    if (!isGuided || !onGuidedReady || guidedReadyNotifiedRef.current) return undefined;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const frames: number[] = [];
    const scheduleFrames = (callback: () => void) => {
      const first = requestAnimationFrame(() => {
        const second = requestAnimationFrame(callback);
        frames.push(second);
      });
      frames.push(first);
    };
    const positionAndConfirm = (attempt = 0) => {
      filtersTarget.measureNow(layout => {
        if (cancelled || guidedReadyNotifiedRef.current) return;
        if (!layout) {
          if (attempt >= 48) {
            guidedReadyNotifiedRef.current = true;
            onGuidedReady();
            return;
          }
          retryTimer = setTimeout(
            () => positionAndConfirm(attempt + 1),
            32,
          );
          return;
        }
        const desiredY = insets.top + 76;
        const delta = layout.y - desiredY;
        if (Math.abs(delta) > 3) {
          if (attempt >= 48) {
            guidedReadyNotifiedRef.current = true;
            onGuidedReady();
            return;
          }
          const nextScrollY = Math.max(0, guideScrollYRef.current + delta);
          if (nextScrollY === 0 && guideScrollYRef.current === 0) {
            guidedReadyNotifiedRef.current = true;
            onGuidedReady();
            return;
          }
          favScrollRef.current?.scrollTo({ y: nextScrollY, animated: false });
          guideScrollYRef.current = nextScrollY;
          scheduleFrames(() => positionAndConfirm(attempt + 1));
          return;
        }
        guidedReadyNotifiedRef.current = true;
        onGuidedReady();
      });
    };
    scheduleFrames(() => positionAndConfirm());
    return () => {
      cancelled = true;
      frames.forEach(cancelAnimationFrame);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [filtersTarget, guideScrollYRef, insets.top, isGuided, onGuidedReady]);
  const guideHighlightColor = guidedHighlightColor ?? guideHighlight?.color ?? 'gold';
  const displayCategories = useMemo(() => (
    isGuided && guidedCategoryLabel
      ? categories.map(category => (
        category.color === guideHighlightColor
          ? { ...category, label: guidedCategoryLabel }
          : category
      ))
      : categories
  ), [categories, guideHighlightColor, guidedCategoryLabel, isGuided]);

  const saveGuidedCategoryPreview = useCallback((
    colorKey: HighlightColor,
    label: string,
  ) => {
    if (colorKey === guideHighlightColor) {
      setGuidedCategoryLabel(label.trim() || 'Anasta');
    }
  }, [guideHighlightColor]);

  const filtered = useMemo(() => visibleAnnotations
    .filter(annotation => annotation.kind === 'highlight' || annotation.kind === 'comment')
    .filter(annotation => color === 'all' || annotation.color === color)
    .filter(annotation => kind === 'all' || annotation.kind === kind)
    .filter(annotation => matchesSource(annotation, source))
    .filter(annotation => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return annotation.text.toLowerCase().includes(q)
        || plainRichText(annotation.comment).toLowerCase().includes(q)
        || annotationLocation(annotation).toLowerCase().includes(q);
    })
    .sort((a, b) => b.updatedAt - a.updatedAt), [color, kind, search, source, visibleAnnotations]);

  const displayItems = useMemo(() => {
    function groupKey(annotation: ScriptureAnnotation): string {
      if (annotation.kind === 'highlight') {
        // Group by passage (book+chapter+text) — ignore color so multi-color highlights merge
        return ['highlight', annotation.bookId, annotation.chapter, annotation.text].join('\x00');
      }
      if (annotation.kind === 'comment') {
        return ['comment', annotation.bookId, annotation.chapter, annotation.text, annotation.comment ?? ''].join('\x00');
      }
      return annotation.id;
    }

    const groupVerses = new Map<string, number[]>();
    const groupColors = new Map<string, string[]>();

    for (const annotation of filtered) {
      const key = groupKey(annotation);
      const existingVerses = groupVerses.get(key);
      if (existingVerses) {
        if (!existingVerses.includes(annotation.verse)) existingVerses.push(annotation.verse);
      } else {
        groupVerses.set(key, [annotation.verse]);
      }
      const existingColors = groupColors.get(key);
      if (existingColors) {
        if (!existingColors.includes(annotation.color)) existingColors.push(annotation.color);
      } else {
        groupColors.set(key, [annotation.color]);
      }
    }

    const seen = new Set<string>();
    return filtered.map(annotation => {
      const key = groupKey(annotation);
      if (seen.has(key)) return null;
      seen.add(key);

      const verses = (groupVerses.get(key) ?? [annotation.verse]).sort((a, b) => a - b);
      const colors = groupColors.get(key) ?? [annotation.color];
      const bookName = BOOK_BY_ID.get(annotation.bookId)?.name ?? `Book ${annotation.bookId}`;
      const verseRange = verses.length > 1
        ? `${bookName} ${annotation.chapter}:${verses[0]}–${verses[verses.length - 1]}`
        : annotationLocation(annotation);

      return { annotation, verseRange, verses, colors };
    }).filter((item): item is { annotation: ScriptureAnnotation; verseRange: string; verses: number[]; colors: string[] } => item !== null);
  }, [filtered]);

  const handleDeletePress = (annotation: ScriptureAnnotation, colors: string[]) => {
    if (colors.length > 1) {
      setColorDeleteGroup({ annotation, colors });
    } else {
      setDeleteTarget(annotation);
    }
  };

  const deleteOneColor = async (colorKey: string) => {
    if (!colorDeleteGroup) return;
    const { annotation } = colorDeleteGroup;
    const group = annotations.filter(a =>
      a.kind === 'highlight'
      && a.bookId === annotation.bookId
      && a.chapter === annotation.chapter
      && a.color === colorKey
      && a.text === annotation.text);
    await Promise.all(group.map(a => deleteAnnotation(a.id)));
    const remaining = colorDeleteGroup.colors.filter(c => c !== colorKey);
    if (remaining.length === 0) setColorDeleteGroup(null);
    else setColorDeleteGroup({ annotation, colors: remaining });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === 'highlight') {
      const group = annotations.filter(annotation =>
        annotation.kind === 'highlight'
        && annotation.bookId === deleteTarget.bookId
        && annotation.chapter === deleteTarget.chapter
        && annotation.color === deleteTarget.color
        && annotation.text === deleteTarget.text);
      await Promise.all(group.map(annotation => deleteAnnotation(annotation.id)));
    } else if (deleteTarget.kind === 'comment') {
      const group = annotations.filter(annotation =>
        annotation.kind === 'comment'
        && annotation.bookId === deleteTarget.bookId
        && annotation.chapter === deleteTarget.chapter
        && annotation.color === deleteTarget.color
        && annotation.text === deleteTarget.text
        && annotation.comment === deleteTarget.comment);
      await Promise.all(group.map(annotation => deleteAnnotation(annotation.id)));
    } else {
      await deleteAnnotation(deleteTarget.id);
    }
    setDeleteTarget(null);
  };

  // ─── Guided Bible tour presentations ───────────────────────────────────────
  const stageVerseCard = useCallback((present: () => void, onUnavailable?: () => void) => {
    scheduleGuide(() => {
      stageGuideTarget(
        verseCardTarget,
        targetHeight => Math.max(140, screenHeight * 0.5 - targetHeight / 2),
        present,
        onUnavailable,
      );
    }, 72);
  }, [scheduleGuide, screenHeight, stageGuideTarget, verseCardTarget]);

  const silentlyPositionGuideVerseCard = useCallback((attempt = 0) => {
    verseCardTarget.measureNow(layout => {
      if (!layout) {
        if (attempt >= 24) return;
        scheduleGuide(
          () => silentlyPositionGuideVerseCard(attempt + 1),
          40,
        );
        return;
      }
      const desiredY = Math.max(140, screenHeight * 0.5 - layout.height / 2);
      const delta = layout.y - desiredY;
      if (Math.abs(delta) <= 3) return;
      const nextScrollY = Math.max(0, guideScrollYRef.current + delta);
      favScrollRef.current?.scrollTo({ y: nextScrollY, animated: false });
      guideScrollYRef.current = nextScrollY;
      scheduleGuide(
        () => silentlyPositionGuideVerseCard(attempt + 1),
        32,
      );
    });
  }, [guideScrollYRef, scheduleGuide, screenHeight, verseCardTarget]);

  useEffect(() => {
    if (!isGuided) return;
    clearGuideTimers();

    if (guidePhase === 'legacyFavIntro') {
      setPresentation({
        key: 'favorites-intro',
        placement: 'bottom',
        lightScrim: true,
        eyebrow: 'MY FAVORITES',
        message: 'Everything you ever highlight or write is saved here — organized by meaning.',
        highlights: ['saved here', 'organized by meaning'],
        ctaLabel: 'Continue',
        onCta: () => patchSession({ phase: 'favFilters' }),
      });
      return;
    }
    if (guidePhase === 'legacyFavFilters') {
      setPresentation({
        key: 'favorites-filters',
        targetId: FAVORITES_GUIDE_TARGETS.filters,
        cutoutPadding: 8,
        placement: 'bottom',
        allowTargetInteraction: false,
        eyebrow: 'MY FAVORITES',
        message: 'Favorites has three levels of filters: the kind of mark, its source in Scripture, and the color or meaning you gave it.',
        highlights: ['kind of mark', 'source in Scripture', 'color or meaning'],
        chips: ['Type', 'Source', 'Category'],
        ctaLabel: 'Continue',
        onCta: () => patchSession({ phase: 'favColors' }),
      });
      return;
    }
    if (guidePhase === 'legacyFavColors') {
      setPresentation({
        key: 'favorites-colors',
        targetId: FAVORITES_GUIDE_TARGETS.categories,
        cutoutPadding: 8,
        placement: 'below',
        allowTargetInteraction: true,
        eyebrow: 'MY FAVORITES',
        message: 'The pen lets you rename any color — by meaning, by theme, or by whatever helps you grow.',
        highlights: ['rename any color', 'whatever helps you grow'],
        action: 'Tap the pencil to see your color names',
      });
      return;
    }
    if (guidePhase === 'legacyFavEditor') {
      // The category editor is a native modal — the overlay steps aside and
      // closing the editor advances the tour.
      setPresentation(null);
      return;
    }
    if (guidePhase === 'legacyFavAnasta') {
      setPresentation({
        key: 'favorites-anasta',
        targetId: FAVORITES_GUIDE_TARGETS.categories,
        cutoutPadding: 8,
        placement: 'below',
        allowTargetInteraction: true,
        eyebrow: 'MY FAVORITES',
        message: 'We prepared one meaningful comment for you in the Anasta category.',
        highlights: ['Anasta'],
        action: 'Tap Anasta',
        hint: 'tap',
      });
      return;
    }
    if (guidePhase === 'legacyFavVerse') {
      stageVerseCard(() => {
        setPresentation({
          key: 'favorites-verse',
          targetId: FAVORITES_GUIDE_TARGETS.verseCard,
          cutoutPadding: 8,
          placement: 'above',
          allowTargetInteraction: true,
          eyebrow: 'MY FAVORITES',
          message: 'This is the comment we prepared. Tap it and Scripture will open at its exact place.',
          highlights: ['exact place'],
          action: 'Open the Anasta comment',
          hint: 'tap',
        });
      });
      return;
    }
  }, [clearGuideTimers, guidePhase, isGuided, patchSession, setPresentation, stageVerseCard]);

  useEffect(() => {
    if (!isGuided) return;
    clearGuideTimers();

    if (guidePhase === 'favIntro') {
      stageGuideTarget(filtersTarget, 'origin', () => {
        setPresentation({
          key: 'favorites-intro-v2',
          coachGroupKey: 'bible-primary-coach',
          placement: 'bottom',
          lightScrim: true,
          eyebrow: 'MY FAVORITES',
          message: 'Every comment and highlight you save is here.',
          highlights: ['comment and highlight'],
          ctaLabel: 'Continue',
          onCta: () => patchSession({ phase: 'favFilters' }),
        });
      });
      return;
    }

    if (guidePhase === 'favFilters') {
      stageGuideTarget(filtersTarget, () => insets.top + 76, () => {
        setPresentation({
          key: 'favorites-filters-v2',
          coachGroupKey: 'bible-primary-coach',
          targetId: FAVORITES_GUIDE_TARGETS.filters,
          cutoutPadding: 8,
          placement: 'bottom',
          allowTargetInteraction: false,
          eyebrow: 'MY FAVORITES',
          message: 'Every comment and highlight you save is here. Search them, then filter by type, source, or category.',
          highlights: ['comment and highlight', 'Search', 'type, source, or category'],
          chips: ['Type', 'Source', 'Category'],
          ctaLabel: 'Continue',
          onCta: () => patchSession({ phase: 'favColors' }),
        });
      }, () => {
        setPresentation({
          key: 'favorites-filters-fallback-v2',
          coachGroupKey: 'bible-primary-coach',
          placement: 'center',
          lightScrim: true,
          eyebrow: 'MY FAVORITES',
          message: 'Every comment and highlight you save is here. Search them, then filter by type, source, or category.',
          highlights: ['comment and highlight', 'type, source, or category'],
          ctaLabel: 'Continue',
          onCta: () => patchSession({ phase: 'favColors' }),
        });
      });
      return;
    }

    if (guidePhase === 'favColors') {
      stageGuideTarget(categoriesTarget, () => insets.top + 138, () => {
        setPresentation({
          key: 'favorites-colors-v2',
          coachGroupKey: 'bible-primary-coach',
          targetId: FAVORITES_GUIDE_TARGETS.categories,
          cutoutPadding: 8,
          placement: 'below',
          allowTargetInteraction: true,
          eyebrow: 'MY FAVORITES',
          message: 'Give each color a name and meaning. Let\'s name this one Anasta for the tour.',
          highlights: ['name and meaning', 'Anasta'],
          action: 'Tap the pencil',
          actionIcon: 'pencil',
          hint: 'tap',
          hintAnchor: 'right',
        });
      }, () => {
        // If this responsive control cannot be measured, keep the preview
        // local and continue to the saved passage instead of leaving a blank
        // guided phase.
        setGuidedCategoryLabel('Anasta');
        silentlyPositionGuideVerseCard();
        setPresentation(null);
        patchSession({ phase: 'favVerse' });
      });
      return;
    }

    if (
      guidePhase === 'favEditorOpening'
      || guidePhase === 'favEditorTyping'
      || guidePhase === 'favEditorClosing'
    ) {
      setPresentation(null);
      return;
    }

    if (guidePhase === 'favEditorReady') {
      setPresentation(null);
      // The native editor still covers this screen, making it the ideal time
      // to place the saved preview card without showing a long list scroll.
      silentlyPositionGuideVerseCard();
      const stageSave = (attempt = 0) => {
        categorySaveTarget.measureNow(layout => {
          if (guidePhaseRef.current !== 'favEditorReady') return;
          if (!layout) {
            if (attempt >= 24) {
              // The category editor is only a guided preview. If its native
              // save target never becomes measurable, preserve the lesson's
              // result and close the modal instead of trapping the tour.
              setGuidedCategoryLabel('Anasta');
              guidedCategorySavedRef.current = true;
              pendingEditorExitPhaseRef.current = 'favVerse';
              guidePhaseRef.current = 'favEditorClosing';
              setPresentation(null);
              setColorEditorOpen(false);
              patchSession({ phase: 'favEditorClosing' });
              return;
            }
            scheduleGuide(
              () => stageSave(attempt + 1),
              48,
            );
            return;
          }
          requestAnimationFrame(() => {
            if (guidePhaseRef.current !== 'favEditorReady') return;
            setPresentation({
              key: 'favorites-editor-ready',
              coachGroupKey: 'bible-category-coach',
              targetId: FAVORITES_GUIDE_TARGETS.categorySave,
              cutoutPadding: 8,
              placement: 'above',
              allowTargetInteraction: true,
              eyebrow: 'STUDY COLORS',
              message: 'This color is named Anasta for this example.',
              highlights: ['Anasta'],
              action: 'Save the name',
              hint: 'tap',
            });
          });
        });
      };
      scheduleGuide(() => stageSave(), 32);
      return;
    }

    if (guidePhase === 'favVerse') {
      stageVerseCard(() => {
        setPresentation({
          key: 'favorites-verse-v2',
          coachGroupKey: 'bible-primary-coach',
          targetId: FAVORITES_GUIDE_TARGETS.verseCard,
          cutoutPadding: 8,
          placement: 'above',
          allowTargetInteraction: true,
          eyebrow: 'MY FAVORITES',
          message: 'Tap this highlight to return to Ephesians 5:15.',
          highlights: ['Ephesians 5:15'],
          action: 'Open the highlight',
          hint: 'tap',
        });
      }, () => {
        setPresentation({
          key: 'favorites-verse-fallback-v2',
          coachGroupKey: 'bible-primary-coach',
          placement: 'center',
          lightScrim: true,
          eyebrow: 'MY FAVORITES',
          message: 'Your highlight is saved here and returns you to its exact place in Scripture.',
          highlights: ['returns you to its exact place'],
          ctaLabel: 'Return to Scripture',
          onCta: onGuidedAdvance,
        });
      });
    }
  }, [
    categoriesTarget,
    categorySaveTarget,
    clearGuideTimers,
    filtersTarget,
    guidePhase,
    insets.top,
    isGuided,
    onGuidedAdvance,
    patchSession,
    scheduleGuide,
    setPresentation,
    silentlyPositionGuideVerseCard,
    stageGuideTarget,
    stageVerseCard,
  ]);

  const handleCategoryEditorEntered = useCallback(() => {
    if (!isGuided || guidePhaseRef.current !== 'favEditorOpening') return;
    guidePhaseRef.current = 'favEditorTyping';
    patchSession({ phase: 'favEditorTyping' });
  }, [isGuided, patchSession]);

  const handleCategoryEditorExited = useCallback(() => {
    const next = pendingEditorExitPhaseRef.current;
    pendingEditorExitPhaseRef.current = null;
    guideActionLockRef.current = false;
    if (!isGuided || !next) return;
    guidePhaseRef.current = next;
    patchSession({ phase: next });
  }, [isGuided, patchSession]);

  useEffect(() => {
    if (!isGuided) return undefined;
    const recover = guidePhase === 'favEditorOpening'
      ? handleCategoryEditorEntered
      : guidePhase === 'favEditorClosing'
        ? handleCategoryEditorExited
        : null;
    if (!recover) return undefined;
    const timer = setTimeout(recover, 760);
    return () => clearTimeout(timer);
  }, [guidePhase, handleCategoryEditorEntered, handleCategoryEditorExited, isGuided]);

  useEffect(() => clearGuideTimers, [clearGuideTimers, guidePhase]);

  return (
    <View style={s.screen}>
      <ScreenTitleBar title="MY FAVORITES" showBack={!isGuided} bg={BG} />
      <ScrollView
        ref={favScrollRef}
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
        onScroll={isGuided ? handleGuideScroll : undefined}
        onMomentumScrollEnd={isGuided ? finishGuideScroll : undefined}
        scrollEventThrottle={isGuided ? 16 : undefined}
      >
        <View ref={filtersTarget.ref} onLayout={filtersTarget.onLayout} style={s.guideFiltersGroup}>
        <View style={s.filterCard}>
          <View style={s.searchBox}>
            <Search s={15} c="#D1D5DB" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search your saved passages..."
              placeholderTextColor="#D1D5DB"
              style={s.searchInput}
            />
            {!!search && (
              <Pressable onPress={() => setSearch('')} hitSlop={8}>
                <X s={15} c="#D1D5DB" />
              </Pressable>
            )}
          </View>
        </View>

        <View>
          <View ref={categoriesTarget.ref} onLayout={categoriesTarget.onLayout} style={s.colorWrap}>
            <FilterTitle label="CATEGORY" />
            <CategoryChipPicker
              categories={displayCategories}
              selectedColor={color}
              includeAll
              onSelectAll={() => {
                if (!isGuided) setColor('all');
              }}
              onSelectColor={nextColor => {
                if (!isGuided) setColor(nextColor);
              }}
              onEdit={() => {
                if (isGuided && guidePhase === 'favColors') {
                  if (guideActionLockRef.current) return;
                  guideActionLockRef.current = true;
                  guidedCategorySavedRef.current = false;
                  pendingEditorExitPhaseRef.current = null;
                  guidePhaseRef.current = 'favEditorOpening';
                  setPresentation(null);
                  patchSession({ phase: 'favEditorOpening' });
                }
                setColorEditorOpen(true);
              }}
              layout="wrap"
              contentStyle={s.colorRow}
            />
          </View>

          <View style={s.typeWrap}>
            <FilterTitle label="TYPE" />
            <View style={s.typeGrid}>
              {([
                ['all', 'All', ''],
                ['highlight', 'Highlights', '"'],
                ['comment', 'Comments', '*'],
              ] as [TypeFilter, string, string][]).map(([key, label, marker]) => {
                const active = kind === key;
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setKind(key)}
                    activeOpacity={0.84}
                    style={[s.typeChip, active && s.typeChipActive]}
                  >
                    {!!marker && <Text style={[s.typeMarker, active && s.typeMarkerActive]}>{marker}</Text>}
                    <Text style={[s.typeText, active && s.typeTextActive]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={s.sourceWrap}>
            <FilterTitle label="SOURCE" />
            <View style={s.sourceGrid}>
              {SOURCE_OPTIONS.map(option => {
                const active = source === option.key;
                const isAll = option.key === 'all';
                return (
                  <TouchableOpacity
                    key={option.key}
                    onPress={() => setSource(option.key)}
                    activeOpacity={0.84}
                    style={[
                      s.sourceChip,
                      active && {
                        backgroundColor: isAll ? option.accent : hexToRgba(option.accent, 0.10),
                        borderColor: isAll ? option.accent : hexToRgba(option.accent, 0.28),
                      },
                    ]}
                  >
                    {!isAll && (
                      <View
                        style={[
                          s.sourceDot,
                          { backgroundColor: active ? option.accent : '#D8D1C5' },
                        ]}
                      />
                    )}
                    <Text
                      style={[
                        s.sourceText,
                        active && { color: isAll ? '#FFFFFF' : option.accent },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
        </View>

        <View style={s.listHead}>
          <Text style={s.sectionKicker}>SAVED PASSAGES</Text>
          <Text style={s.countText}>{displayItems.length}</Text>
        </View>

        {displayItems.length === 0 ? (
          <View style={s.empty}>
            <Star s={32} c="rgba(197,160,89,0.35)" />
            <Text style={s.emptyTitle}>Nothing saved yet</Text>
            <Text style={s.emptyText}>Open Holy Scripture and save highlights or comments.</Text>
          </View>
        ) : (
          <View style={s.list}>
            {displayItems.map(({ annotation, verseRange, verses, colors }) => {
              const isGuideVerseCard = isGuided
                && annotation.id.startsWith('bible-guide-highlight-')
                && annotation.kind === 'highlight'
                && annotation.bookId === GUIDE_FAVORITE_BOOK
                && annotation.chapter === GUIDE_FAVORITE_CHAPTER
                && (verses.includes(GUIDE_FAVORITE_VERSE) || annotation.verse === GUIDE_FAVORITE_VERSE);
              const cardTargetProps = isGuideVerseCard
                ? { ref: verseCardTarget.ref, onLayout: verseCardTarget.onLayout }
                : {};
              return (
              <View key={annotation.id} {...cardTargetProps}>
              <AnnotationCard
                annotation={annotation}
                verseRange={verseRange}
                verses={verses}
                colors={colors}
                categories={displayCategories}
                onOpen={() => {
                  // During the tour, tapping the highlight hands over to
                  // the return-to-Scripture scene instead of navigating.
                  if (isGuided && guidePhase === 'favVerse' && isGuideVerseCard) {
                    if (guideActionLockRef.current) return;
                    guideActionLockRef.current = true;
                    setPresentation(null);
                    onGuidedAdvance?.();
                    return;
                  }
                  if (isGuided) return;
                  router.push({
                  pathname: '/scripture-reader',
                  params: {
                    bookId: String(annotation.bookId),
                    chapter: String(annotation.chapter),
                    verse: String(verses[0] ?? annotation.verse),
                  },
                  });
                }}
                onEdit={!isGuided && annotation.kind === 'comment' ? () => router.push({
                  pathname: '/scripture-reader',
                  params: {
                    bookId: String(annotation.bookId),
                    chapter: String(annotation.chapter),
                    editCommentId: annotation.id,
                  },
                }) : undefined}
                onDelete={!isGuided ? () => handleDeletePress(annotation, colors) : undefined}
              />
              </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <DeleteModal visible={!!deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />

      {colorDeleteGroup && (
        <ColorDeleteModal
          colors={colorDeleteGroup.colors}
          categories={categories}
          onClose={() => setColorDeleteGroup(null)}
          onDeleteColor={deleteOneColor}
        />
      )}
      <CategoryEditorModal
        visible={colorEditorOpen}
        categories={displayCategories}
        onClose={() => {
          setColorEditorOpen(false);
          if (
            isGuided
            && !guidedCategorySavedRef.current
            && (
              guidePhaseRef.current === 'favEditorOpening'
              || guidePhaseRef.current === 'favEditorTyping'
              || guidePhaseRef.current === 'favEditorReady'
            )
          ) {
            pendingEditorExitPhaseRef.current = 'favColors';
            guidePhaseRef.current = 'favEditorClosing';
            setPresentation(null);
            patchSession({ phase: 'favEditorClosing' });
          }
        }}
        onSaveCategory={isGuided ? saveGuidedCategoryPreview : updateCategory}
        guidedRename={isGuided && guidePhase === 'favEditorTyping' ? {
          color: guideHighlightColor,
          label: 'Anasta',
          onDone: () => {
            guidePhaseRef.current = 'favEditorReady';
            patchSession({ phase: 'favEditorReady' });
          },
        } : undefined}
        saveTargetProps={isGuided ? {
          ref: categorySaveTarget.ref,
          onLayout: categorySaveTarget.onLayout,
        } : undefined}
        onSaved={isGuided ? () => {
          guidedCategorySavedRef.current = true;
          pendingEditorExitPhaseRef.current = 'favVerse';
          guidePhaseRef.current = 'favEditorClosing';
          setPresentation(null);
          patchSession({ phase: 'favEditorClosing' });
        } : undefined}
        onEntered={handleCategoryEditorEntered}
        onExited={handleCategoryEditorExited}
        exitWatchdogMs={isGuided ? 700 : undefined}
        overlay={isGuided ? <GuidedOverlayHost /> : undefined}
      />
    </View>
  );
}

function FilterTitle({ label }: { label: string }) {
  return (
    <View style={s.filterTitle}>
      <SlidersHorizontal s={14} c={GOLD} w={2.1} />
      <Text style={s.sectionKicker}>{label}</Text>
    </View>
  );
}

const PREVIEW_COUNT = 2;

function AnnotationCard({
  annotation, verseRange, verses, colors, categories, onOpen, onEdit, onDelete,
}: {
  annotation: ScriptureAnnotation;
  verseRange: string;
  verses: number[];
  colors: string[];
  categories: ColorCategory[];
  onOpen: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const accent = getAnnotationColorHex(colors[0] ?? annotation.color);
  const kindLabel = annotation.kind === 'comment'
    ? 'Comment'
    : annotation.kind === 'favorite'
      ? 'Favorite'
      : annotation.kind === 'underline'
        ? 'Underline'
        : 'Highlight';
  const quoteLines = annotation.text
    .split(/\n{2,}/)
    .map(line => line.trim())
    .filter(Boolean);

  const hasMore = quoteLines.length > PREVIEW_COUNT;
  const visibleLines = hasMore && !expanded ? quoteLines.slice(0, PREVIEW_COUNT) : quoteLines;
  const hiddenCount = quoteLines.length - PREVIEW_COUNT;
  const commentText = plainRichText(annotation.comment);
  const hasComment = !!commentText;

  return (
    <TouchableOpacity
      onPress={onOpen}
      activeOpacity={0.86}
      style={[s.card, { borderColor: hexToRgba(accent, 0.18) }]}
    >
      <View style={s.cardTop}>
        <View style={s.cardTags}>
          <View style={[s.cardDot, { backgroundColor: accent }]} />
          {colors.map(c => {
            const hex = getAnnotationColorHex(c);
            const label = getAnnotationCategoryLabel(categories, c);
            return (
              <View key={c} style={[s.cardChip, { backgroundColor: hexToRgba(hex, 0.10), borderColor: hexToRgba(hex, 0.18) }]}>
                <Text style={[s.cardChipText, { color: hex }]}>{label}</Text>
              </View>
            );
          })}
          <View style={[s.cardChip, s.cardKindChip]}>
            <Text style={[s.cardChipText, { color: '#9A7426' }]}>{kindLabel}</Text>
          </View>
        </View>
        <View style={s.cardActions}>
          {onEdit && (
            <Pressable
              onPress={event => {
                event.stopPropagation?.();
                onEdit();
              }}
              hitSlop={8}
              style={s.editBtn}
            >
              <Pencil s={16} c="#8D8278" w={2.2} />
            </Pressable>
          )}
          {onDelete && (
            <Pressable
              onPress={event => {
                event.stopPropagation?.();
                onDelete();
              }}
              hitSlop={8}
              style={s.trashBtn}
            >
              <Trash2 s={16} c={C.red} w={2.15} />
            </Pressable>
          )}
        </View>
      </View>
      <Text style={s.cardRef}>{verseRange}</Text>
      <View style={s.quoteBlock}>
        {visibleLines.map((line, index) => (
          <View key={`${annotation.id}-${index}`}>
            <View style={s.quoteLine}>
              {(verses.length > 1 || colors.length > 1) && (
                <Text style={s.quoteVerseNum}>{verses[index] ?? verses[0] ?? ''}</Text>
              )}
              <Text style={[s.quoteText, verses.length > 1 && s.quoteTextIndented]}>{`"${line}"`}</Text>
            </View>
            {index < visibleLines.length - 1 && <View style={s.quoteDivider} />}
          </View>
        ))}
      </View>

      {hasMore && (
        <TouchableOpacity
          onPress={e => { e.stopPropagation?.(); setExpanded(v => !v); }}
          activeOpacity={0.7}
          style={s.seeMoreBtn}
        >
          <Text style={[s.seeMoreText, { color: accent }]}>
            {expanded ? 'See less' : `See ${hiddenCount} more verse${hiddenCount > 1 ? 's' : ''}`}
          </Text>
          <View style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}>
            <Text style={[s.seeMoreArrow, { color: accent }]}>›</Text>
          </View>
        </TouchableOpacity>
      )}

      {hasComment && (
        <View style={s.commentBox}>
          <RichCommentText html={annotation.comment ?? ''} color="#6F5320" />
        </View>
      )}
    </TouchableOpacity>
  );
}

function ColorDeleteModal({
  colors, categories, onClose, onDeleteColor,
}: {
  colors: string[];
  categories: ColorCategory[];
  onClose: () => void;
  onDeleteColor: (color: string) => void;
}) {
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <View style={s.cdOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.cdCard}>
          <View style={s.cdHeader}>
            <Text style={s.cdTitle}>Remove highlight</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={s.cdClose}>
              <X s={16} c="#9CA3AF" />
            </TouchableOpacity>
          </View>
          <Text style={s.cdSub}>Choose which color to remove</Text>
          <View style={s.cdChips}>
            {colors.map(colorKey => {
              const accent = getAnnotationColorHex(colorKey as HighlightColor);
              const label = getAnnotationCategoryLabel(categories, colorKey as HighlightColor);
              return (
                <TouchableOpacity
                  key={colorKey}
                  onPress={() => onDeleteColor(colorKey)}
                  activeOpacity={0.82}
                  style={[s.cdChip, { backgroundColor: hexToRgba(accent, 0.10), borderColor: hexToRgba(accent, 0.30) }]}
                >
                  <View style={[s.cdDot, { backgroundColor: accent }]} />
                  <Text style={[s.cdChipText, { color: accent }]}>{label}</Text>
                  <View style={[s.cdXBox, { backgroundColor: hexToRgba(accent, 0.15) }]}>
                    <X s={10} c={accent} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function DeleteModal({
  visible, onCancel, onConfirm,
}: {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ConfirmModal
      visible={visible}
      icon={<Trash2 s={22} c={C.red} />}
      iconBg="#FEF2F2"
      title="Delete saved passage?"
      body="This removes it from My Favorites."
      confirmLabel="DELETE"
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  content: { paddingHorizontal: 14, paddingTop: 16 },
  filterCard: { borderRadius: 22, borderWidth: 1, borderColor: '#ECE4D7', backgroundColor: '#FFFDF9', padding: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.04, shadowRadius: 24, elevation: 2 },
  searchBox: { height: 46, borderRadius: 17, borderWidth: 1, borderColor: '#EEE5D8', backgroundColor: '#fff', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: { flex: 1, height: 46, fontFamily: F.serif, fontSize: 15, lineHeight: 21, color: '#44403C' },
  guideFiltersGroup: {},
  colorWrap: { marginTop: 18 },
  filterTitle: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10, paddingLeft: 3 },
  sectionKicker: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2, color: '#A8A29E' },
  colorRow: { gap: 8, paddingBottom: 3 },
  typeWrap: { marginTop: 18 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    minHeight: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#E7DED1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  typeChipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  typeMarker: { fontFamily: F.serifMedium, fontSize: 14, color: '#C5A059', marginTop: -1 },
  typeMarkerActive: { color: '#FFFFFF' },
  typeText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.7, color: '#7C7470', textTransform: 'uppercase' },
  typeTextActive: { color: '#FFFFFF' },
  sourceWrap: { marginTop: 18 },
  sourceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sourceChip: {
    minHeight: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#E7DED1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  sourceDot: { width: 7, height: 7, borderRadius: 4 },
  sourceText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.7, color: '#7C7470', textTransform: 'uppercase' },
  categoryChip: { height: 34, borderRadius: 17, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 7 },
  categoryChipAllActive: { backgroundColor: '#1C1917', borderColor: '#1C1917' },
  categoryText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' },
  categoryTextAllActive: { color: '#fff' },
  categoryDot: { width: 7, height: 7, borderRadius: 4 },
  listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 10, paddingLeft: 3 },
  countText: { fontFamily: F.sansBold, fontSize: 10, color: GOLD, paddingRight: 5 },
  list: { gap: 12 },
  empty: { alignItems: 'center', paddingVertical: 58, paddingHorizontal: 26 },
  emptyTitle: { marginTop: 12, fontFamily: F.serifMediumItalic, fontSize: 19, color: '#A8A29E' },
  emptyText: { marginTop: 5, fontFamily: F.serif, fontSize: 15, lineHeight: 21, color: '#B8B2AA', textAlign: 'center' },
  card: { borderRadius: 18, borderWidth: 1, backgroundColor: '#FFFFFF', padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8, gap: 10 },
  cardTags: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  cardDot: { width: 11, height: 11, borderRadius: 6 },
  cardChip: { minHeight: 25, borderRadius: 13, borderWidth: 1, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  cardKindChip: { backgroundColor: '#FFF7EA', borderColor: '#EEDCB6' },
  cardChipText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.8, textTransform: 'uppercase' },
  cardRef: { marginBottom: 12, fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.7, color: '#C0B8AE', textTransform: 'uppercase' },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 0, marginTop: -3 },
  editBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F7F5',
    borderWidth: 1,
    borderColor: '#EEEAE4',
  },
  trashBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF1F3',
    borderWidth: 1,
    borderColor: 'rgba(190,18,60,0.16)',
  },
  quoteBlock: { paddingHorizontal: 0 },
  quoteLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  quoteVerseNum: { minWidth: 22, paddingTop: 5, fontFamily: F.sansBold, fontSize: 10, color: 'rgba(190,18,60,0.45)', textAlign: 'right' },
  quoteText: { flex: 1, fontFamily: F.serifMedium, fontSize: 16, lineHeight: 26, color: '#4B5563' },
  quoteTextIndented: { flex: 1 },
  quoteDivider: {
    height: 1,
    backgroundColor: '#E7EAF0',
    marginTop: Platform.OS === 'ios' ? 9 : 13,
    marginBottom: 13,
  },
  commentBox: { marginTop: 14, borderRadius: 16, borderWidth: 1, borderColor: '#F2E4C8', backgroundColor: '#FFF8EF', padding: 14 },
  seeMoreBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10, alignSelf: 'flex-start' },
  seeMoreText: { fontFamily: F.sansSemiBold, fontSize: 12, letterSpacing: 0.3 },
  seeMoreArrow: { fontSize: 18, lineHeight: 18, fontFamily: F.serifMedium },

  cdOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  cdCard: { width: '100%', maxWidth: 320, borderRadius: 28, backgroundColor: '#FFFFFF', padding: 22, shadowColor: '#000', shadowOpacity: 0.18, shadowOffset: { width: 0, height: 16 }, shadowRadius: 28, elevation: 12 },
  cdHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  cdTitle: { fontFamily: F.serifMedium, fontSize: 20, color: '#111827' },
  cdClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F5F5F4', alignItems: 'center', justifyContent: 'center' },
  cdSub: { fontFamily: F.serif, fontSize: 14, color: '#9CA3AF', marginBottom: 18 },
  cdChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cdChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, borderWidth: 1, paddingLeft: 10, paddingRight: 6, paddingVertical: 7 },
  cdDot: { width: 8, height: 8, borderRadius: 4 },
  cdChipText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase' },
  cdXBox: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
