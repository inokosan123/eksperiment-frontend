import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  Easing,
  FadeInDown,
  FadeOut,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  CheckSmall, ChevronLeft, ChevronRight, CircleIcon, Feather, Notebook, Pencil, Star, Trash2, X,
} from '@/components/icons/Icons';
import ConfirmModal from '@/components/shared/ConfirmModal';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import {
  getAnnotationCategoryLabel, getAnnotationColorHex, hexToRgba, HighlightColor,
  ColorCategory,
} from '@/constants/annotationColors';
import { BIBLE_BOOKS, getBibleBook, normalizeScriptureLanguage, PSALMS_ID, ScriptureLanguage } from '@/constants/scripture';
import { C, F } from '@/constants/tokens';
import { useAppSettings } from '@/components/settings/SettingsContext';
import { FormatState, RichTextEditor, RichTextEditorRef, RichToolbar } from '@/components/shared/RichTextEditor';
import RichCommentText from '@/components/shared/RichCommentText';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import { CategoryChipPicker, CategoryEditorModal, CategoryEditorPanel } from './CategoryColorTools';
import ScriptureBibleNotesSheet from './ScriptureBibleNotesSheet';
import { BibleVerse, ScriptureAnnotation, useScripture } from './ScriptureContext';
import { HapticTouchableOpacity as TouchableOpacity, HapticPressable as Pressable } from '@/components/shared/HapticTouch';
import { useGuidedSetup, useGuideTarget } from '@/components/onboarding/guided/GuidedSetupContext';
import { GuidedOverlayHost } from '@/components/onboarding/guided/GuidedOverlayHost';
import { useGuidedScrollTransition } from '@/components/onboarding/guided/use-guided-scroll-transition';


const BG = '#FCFCFC';
const GOLD = '#C5A059';
const ROSE = '#BE123C';

const SCRIPTURE_GUIDE_TARGETS = {
  verseSlogan: 'scripture.verse-slogan',
  verseHighlight: 'scripture.verse-highlight',
  annotateFab: 'scripture.annotate-fab',
  sheetColors: 'scripture.sheet-colors',
  sheetHighlight: 'scripture.sheet-highlight',
  sheetComment: 'scripture.sheet-comment',
  commentSave: 'scripture.comment-save',
  noteIcon: 'scripture.note-icon',
  favoritesIcon: 'scripture.favorites-icon',
  notesHeader: 'scripture.notes-header',
} as const;

// The onboarding Bible tour begins on the app's real anchor passage. Target
// measurement is staged after the reader scroll settles so the spotlight's
// visual hole and native hit-test hole stay on the same verse.
const GUIDE_VERSE_SLOGAN = 14;
const GUIDE_VERSE_HIGHLIGHT = 15;
const GUIDE_COMMENT_TEXT = 'No matter how many times you fall, or how hard you fall, rise again. Every fall is only a drop in the ocean of God’s mercy. Keep fighting. Rise—Anasta. Repentance is change.';
const GUIDE_SELECTION_PHASES = new Set(['readerIntro', 'chooseComment', 'highlightIntro', 'pickColor', 'doHighlight']);

type ScriptureGuideEvent = 'sceneDone' | 'openNotes';

type ScriptureReaderViewProps = {
  bookId?: number;
  chapter?: number;
  initialVerse?: number;
  lang?: ScriptureLanguage;
  onBack?: () => void;
  canGoPrevChapter?: boolean;
  canGoNextChapter?: boolean;
  onPrevChapter?: () => void;
  onNextChapter?: () => void;
  bottomDock?: React.ReactNode;
  bottomDockHeight?: number;
  guided?: boolean;
  onGuidedAdvance?: (event: ScriptureGuideEvent) => void;
  onGuidedHighlightSaved?: (color: HighlightColor) => void;
  guidedAnnotations?: ScriptureAnnotation[];
  onGuidedAnnotationsSaved?: (annotations: ScriptureAnnotation[]) => void;
  onGuidedReady?: () => void;
};

export default function ScriptureReaderView({
  bookId: controlledBookId,
  chapter: controlledChapter,
  initialVerse: controlledInitialVerse,
  lang: controlledLang,
  onBack,
  canGoPrevChapter,
  canGoNextChapter,
  onPrevChapter,
  onNextChapter,
  bottomDock,
  bottomDockHeight = 155,
  guided = false,
  onGuidedAdvance,
  onGuidedHighlightSaved,
  guidedAnnotations = [],
  onGuidedAnnotationsSaved,
  onGuidedReady,
}: ScriptureReaderViewProps = {}) {
  const router = useRouter();
  const params = useLocalSearchParams<{
    bookId?: string;
    chapter?: string;
    verse?: string;
    lang?: ScriptureLanguage;
    editCommentId?: string;
    bibleNotes?: 'collapsed' | 'expanded';
  }>();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const { settings } = useAppSettings();
  const {
    ready, annotations, categories, getChapter, upsertAnnotation, upsertAnnotations, deleteAnnotation, updateCategory,
  } = useScripture();

  const initialBookId = controlledBookId ?? (Number(params.bookId) || 42);
  const initialChapter = controlledChapter ?? (Number(params.chapter) || 3);
  const initialVerse = controlledInitialVerse ?? (Number(params.verse) || 0);
  const lang = controlledLang ?? normalizeScriptureLanguage(params.lang ?? settings.bibleLang);

  const [localBookId] = useState(initialBookId);
  const [localChapter, setLocalChapter] = useState(initialChapter);
  const bookId = controlledBookId ?? localBookId;
  const chapter = controlledChapter ?? localChapter;
  const [showFocus, setShowFocus] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShowFocus(false), 1500);
    return () => clearTimeout(t);
  }, []);
  const [verses, setVerses] = useState<BibleVerse[]>([]);
  const [loading, setLoading] = useState(true);
  const chapterNavLockedRef = useRef(false);
  const [chapterNavLocked, setChapterNavLocked] = useState(false);
  const [chapterError, setChapterError] = useState<string | null>(null);
  const [selectedVerseNumbers, setSelectedVerseNumbers] = useState<number[]>([]);
  const [selectedColor, setSelectedColor] = useState<HighlightColor>('gold');
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentSession, setCommentSession] = useState(0);
  const [commentMode, setCommentMode] = useState<'add' | 'edit'>('add');
  const [viewingComment, setViewingComment] = useState<ScriptureAnnotation | null>(null);
  const [editCommentTarget, setEditCommentTarget] = useState<ScriptureAnnotation | null>(null);
  const [colorEditorOpen, setColorEditorOpen] = useState(false);
  const [stagedVersePhase, setStagedVersePhase] = useState('');
  const [stagedSheetPhase, setStagedSheetPhase] = useState('');
  const [stagedCommentPhase, setStagedCommentPhase] = useState('');
  const [settledSheetPhase, setSettledSheetPhase] = useState('');
  const [commentSaving, setCommentSaving] = useState(false);
  const [guidedInitialTargetLaidOut, setGuidedInitialTargetLaidOut] = useState(false);
  const [bibleNotesSheetMode, setBibleNotesSheetMode] = useState<'closed' | 'collapsed' | 'expanded'>(
    guided
      ? 'closed'
      : params.bibleNotes === 'collapsed'
      ? 'collapsed'
      : params.bibleNotes === 'expanded'
        ? 'expanded'
        : 'closed',
  );
  const scrollRef = useRef<ScrollView>(null);
  const verseLayoutYRef = useRef<Record<number, number>>({});
  const handledInitialScrollKeyRef = useRef<string | null>(null);

  const { session, patchSession, setPresentation } = useGuidedSetup();
  const isGuided = guided && session?.active === true && session.activeStep === 'riseBibleHighlight';
  const guidePhase = isGuided ? session.phase : '';
  // Refs keep clearSelection's identity stable — several long-standing
  // effects depend on it, and they must not re-fire on every phase change.
  const guidePhaseRef = useRef(guidePhase);
  guidePhaseRef.current = guidePhase;
  const isGuidedRef = useRef(isGuided);
  isGuidedRef.current = isGuided;
  const guidedSelectionLockRef = useRef(false);
  const guidedMutationLockRef = useRef(false);
  const guidedNoteMotionLockRef = useRef(false);
  const pendingSelectionExitRef = useRef<
    'openComment' | 'readerIntro' | 'highlightIntro' | 'markMade' | null
  >(null);
  const pendingCommentExitPhaseRef = useRef<'readerIntro' | 'highlightIntro' | null>(null);
  const commentCleanupPendingRef = useRef(false);
  const guidedCommentPositionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guidedReadyNotifiedRef = useRef(false);
  const sloganVerseTarget = useGuideTarget(SCRIPTURE_GUIDE_TARGETS.verseSlogan, isGuided);
  const highlightVerseTarget = useGuideTarget(SCRIPTURE_GUIDE_TARGETS.verseHighlight, isGuided);
  const annotateFabTarget = useGuideTarget(SCRIPTURE_GUIDE_TARGETS.annotateFab, isGuided);
  const sheetColorsTarget = useGuideTarget(SCRIPTURE_GUIDE_TARGETS.sheetColors, isGuided);
  const sheetHighlightTarget = useGuideTarget(SCRIPTURE_GUIDE_TARGETS.sheetHighlight, isGuided);
  const sheetCommentTarget = useGuideTarget(SCRIPTURE_GUIDE_TARGETS.sheetComment, isGuided);
  const commentSaveTarget = useGuideTarget(SCRIPTURE_GUIDE_TARGETS.commentSave, isGuided);
  const noteIconTarget = useGuideTarget(SCRIPTURE_GUIDE_TARGETS.noteIcon, isGuided);
  const favoritesIconTarget = useGuideTarget(SCRIPTURE_GUIDE_TARGETS.favoritesIcon, isGuided);
  const notesHeaderTarget = useGuideTarget(SCRIPTURE_GUIDE_TARGETS.notesHeader, isGuided);
  const {
    clear: clearVerseGuideScroll,
    finish: finishVerseGuideScroll,
    onScroll: handleVerseGuideScroll,
    schedule: scheduleVerseGuide,
    scrollYRef: verseGuideScrollYRef,
    stageTarget: stageVerseGuideTarget,
  } = useGuidedScrollTransition({
    scrollRef,
    screenHeight,
    setPresentation,
    scrollFallbackMs: 540,
    dismissOnAnyReposition: true,
  });

  const readerGuideTargetY = useCallback((targetHeight: number) => Math.max(
    insets.top + 126,
    screenHeight * 0.38 - targetHeight / 2,
  ), [insets.top, screenHeight]);

  const currentBook = getBibleBook(bookId) ?? BIBLE_BOOKS[41];
  const effectiveAnnotations = useMemo(() => {
    if (isGuided) return guidedAnnotations;
    return annotations;
  }, [annotations, guidedAnnotations, isGuided]);
  const currentAnnotations = useMemo(
    () => effectiveAnnotations.filter(annotation => annotation.bookId === bookId && annotation.chapter === chapter),
    [bookId, chapter, effectiveAnnotations],
  );
  // The walkthrough uses preview-only annotations, so an existing personal
  // note on this verse never blocks the lesson and is never overwritten.
  const guideSloganHasProtectedComment = false;
  const selectedVerseSet = useMemo(() => new Set(selectedVerseNumbers), [selectedVerseNumbers]);
  const selectedVerses = useMemo(
    () => verses.filter(verse => selectedVerseSet.has(verse.verse)),
    [selectedVerseSet, verses],
  );
  const selectedQuoteLines = useMemo(
    () => selectedVerses.map(verse => verse.text),
    [selectedVerses],
  );
  const selectionActive = selectedVerseNumbers.length > 0;
  const targetInitialVerse = initialVerse > 0 && bookId === initialBookId && chapter === initialChapter
    ? initialVerse
    : 0;
  const initialScrollKey = targetInitialVerse > 0 ? `${bookId}:${chapter}:${targetInitialVerse}` : null;
  const hasCommentOverlap = useMemo(
    () => !isGuided && selectedVerses.some(verse =>
      annotations.some(annotation =>
        annotation.kind === 'comment'
        && annotation.bookId === verse.bookId
        && annotation.chapter === verse.chapter
        && annotation.verse === verse.verse)),
    [annotations, isGuided, selectedVerses],
  );

  useEffect(() => {
    if (!ready) return;
    let active = true;
    setLoading(true);
    setChapterError(null);
    getChapter(bookId, chapter, lang)
      .then(nextVerses => {
        if (!active) return;
        setVerses(nextVerses);
        if (nextVerses.length === 0) {
          setChapterError('This chapter could not be loaded.');
        }
      })
      .catch(error => {
        console.warn('Failed to load scripture chapter', error);
        if (!active) return;
        setVerses([]);
        setChapterError('This chapter could not be loaded.');
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
        chapterNavLockedRef.current = false;
        setChapterNavLocked(false);
      });

    return () => {
      active = false;
    };
  }, [bookId, chapter, getChapter, lang, ready]);

  useEffect(() => {
    verseLayoutYRef.current = {};
    setGuidedInitialTargetLaidOut(false);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: !isGuided });
      if (isGuided) verseGuideScrollYRef.current = 0;
    });
  }, [bookId, chapter, isGuided, verseGuideScrollYRef]);

  const scrollToInitialVerse = useCallback(() => {
    // Guided positioning owns the scroll while the tour is active. Running
    // the regular deep-link scroll as well caused two competing native
    // animations when Reader opened, which looked like a hitch or jump.
    if (isGuided || !initialScrollKey || handledInitialScrollKeyRef.current === initialScrollKey || loading || chapterError) return;
    if (!verses.some(verse => verse.verse === targetInitialVerse)) return;

    const targetY = verseLayoutYRef.current[targetInitialVerse];
    if (typeof targetY !== 'number') return;

    handledInitialScrollKeyRef.current = initialScrollKey;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, targetY - 18),
        animated: true,
      });
    });
  }, [chapterError, initialScrollKey, isGuided, loading, targetInitialVerse, verses]);

  useEffect(() => {
    scrollToInitialVerse();
  }, [scrollToInitialVerse]);

  const handleVerseLayout = useCallback((verseNumber: number, y: number) => {
    verseLayoutYRef.current[verseNumber] = y;
    if (isGuided && verseNumber === targetInitialVerse) {
      setGuidedInitialTargetLaidOut(true);
    }
    if (verseNumber === targetInitialVerse) scrollToInitialVerse();
  }, [isGuided, scrollToInitialVerse, targetInitialVerse]);

  // Incoming Reader scenes are positioned while still invisible. The parent
  // does not begin its screen handoff until the requested verse has been
  // jumped into place and freshly measured, so users never watch Chapter 5
  // scroll from verse 1 to the lesson target.
  useEffect(() => {
    if (
      !isGuided
      || !onGuidedReady
      || guidedReadyNotifiedRef.current
      || loading
      || chapterError
      || !guidedInitialTargetLaidOut
      || targetInitialVerse <= 0
    ) return undefined;

    const targetBinding = targetInitialVerse === GUIDE_VERSE_SLOGAN
      ? sloganVerseTarget
      : highlightVerseTarget;
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
      targetBinding.measureNow(layout => {
        if (cancelled || guidedReadyNotifiedRef.current) return;
        if (!layout) {
          if (attempt >= 48) {
            guidedReadyNotifiedRef.current = true;
            onGuidedReady();
            return;
          }
          retryTimer = setTimeout(() => positionAndConfirm(attempt + 1), 40);
          return;
        }

        const desiredY = readerGuideTargetY(layout.height);
        const delta = layout.y - desiredY;
        const visible = layout.y < screenHeight - 8
          && layout.y + layout.height > insets.top + 70;
        if (Math.abs(delta) > 3 || !visible) {
          if (attempt >= 48) {
            guidedReadyNotifiedRef.current = true;
            onGuidedReady();
            return;
          }
          const nextScrollY = Math.max(0, verseGuideScrollYRef.current + delta);
          if (nextScrollY === 0 && verseGuideScrollYRef.current === 0 && visible) {
            guidedReadyNotifiedRef.current = true;
            onGuidedReady();
            return;
          }
          scrollRef.current?.scrollTo({ y: nextScrollY, animated: false });
          verseGuideScrollYRef.current = nextScrollY;
          scheduleFrames(() => positionAndConfirm(attempt + 1));
          return;
        }

        guidedReadyNotifiedRef.current = true;
        onGuidedReady();
      });
    };

    scheduleFrames(positionAndConfirm);
    return () => {
      cancelled = true;
      frames.forEach(cancelAnimationFrame);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [
    chapterError,
    guidedInitialTargetLaidOut,
    highlightVerseTarget,
    insets.top,
    isGuided,
    loading,
    onGuidedReady,
    readerGuideTargetY,
    screenHeight,
    sloganVerseTarget,
    targetInitialVerse,
    verseGuideScrollYRef,
  ]);

  const completeMissingVerseTarget = useCallback(() => {
    const now = Date.now();
    const sloganVerse = verses.find(verse => verse.verse === GUIDE_VERSE_SLOGAN);
    const highlightVerse = verses.find(verse => verse.verse === GUIDE_VERSE_HIGHLIGHT);
    const fallbackAnnotations: ScriptureAnnotation[] = [];
    if (sloganVerse) {
      fallbackAnnotations.push({
        id: `bible-guide-comment-${bookId}-${chapter}-${GUIDE_VERSE_SLOGAN}`,
        kind: 'comment',
        color: selectedColor,
        bookId,
        chapter,
        verse: GUIDE_VERSE_SLOGAN,
        text: sloganVerse.text,
        comment: GUIDE_COMMENT_TEXT,
        createdAt: now,
        updatedAt: now,
      });
    }
    if (highlightVerse) {
      fallbackAnnotations.push({
        id: `bible-guide-highlight-${bookId}-${chapter}-${GUIDE_VERSE_HIGHLIGHT}`,
        kind: 'highlight',
        color: selectedColor,
        bookId,
        chapter,
        verse: GUIDE_VERSE_HIGHLIGHT,
        text: highlightVerse.text,
        createdAt: now,
        updatedAt: now,
      });
    }
    if (fallbackAnnotations.length > 0) {
      onGuidedAnnotationsSaved?.(fallbackAnnotations);
    }
    onGuidedHighlightSaved?.(selectedColor);
    setPresentation(null);
    onGuidedAdvance?.('sceneDone');
  }, [bookId, chapter, onGuidedAdvance, onGuidedAnnotationsSaved, onGuidedHighlightSaved, selectedColor, setPresentation, verses]);

  const presentMissingVerseTarget = useCallback(() => {
    setPresentation({
      key: `bible-verse-target-fallback-${guidePhaseRef.current}`,
      coachGroupKey: 'bible-primary-coach',
      placement: 'center',
      lightScrim: true,
      eyebrow: 'HOLY SCRIPTURE',
      message: 'This passage is ready. Continue to see where your comments and highlights are kept.',
      highlights: ['comments and highlights'],
      ctaLabel: 'Continue to My Favorites',
      onCta: completeMissingVerseTarget,
    });
  }, [completeMissingVerseTarget, setPresentation]);

  // Match the Home guide choreography: move first, wait for native momentum
  // to finish, re-measure in-window coordinates, and only then reveal the
  // next spotlight. This replaces the old fixed 680ms guess.
  useEffect(() => {
    const needsVerseStage = guidePhase === 'readerIntro'
      || guidePhase === 'highlightIntro'
      || guidePhase === 'returnIntro';
    if (!isGuided || !needsVerseStage || loading || verses.length === 0) {
      setStagedVersePhase('');
      return undefined;
    }

    setStagedVersePhase('');
    if (guidePhase !== 'readerIntro') setPresentation(null);
    const target = guidePhase === 'readerIntro' ? sloganVerseTarget : highlightVerseTarget;
    scheduleVerseGuide(() => {
      stageVerseGuideTarget(
        target,
        readerGuideTargetY,
        () => setStagedVersePhase(guidePhase),
        presentMissingVerseTarget,
      );
    }, 72);

    return clearVerseGuideScroll;
  }, [
    clearVerseGuideScroll,
    guidePhase,
    highlightVerseTarget,
    isGuided,
    loading,
    presentMissingVerseTarget,
    readerGuideTargetY,
    scheduleVerseGuide,
    setPresentation,
    sloganVerseTarget,
    stageVerseGuideTarget,
    verses.length,
  ]);

  const handledEditCommentIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (guided || isGuided || !ready || loading) return;
    const editId = params.editCommentId;
    if (!editId || handledEditCommentIdRef.current === editId) return;
    const target = annotations.find(annotation => annotation.id === editId && annotation.kind === 'comment');
    if (!target) return;
    handledEditCommentIdRef.current = editId;
    startEditFlow(target);
    router.setParams({ editCommentId: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guided, isGuided, ready, loading, annotations, params.editCommentId]);

  const clearSelection = useCallback((options?: { preserveGuidePhase?: boolean }) => {
    setSelectedVerseNumbers([]);
    setActionSheetOpen(false);
    setCommentOpen(false);
    setCommentDraft('');
    setCommentMode('add');
    setEditCommentTarget(null);
    // If the tour is mid-lesson and the selection is abandoned, fall back to
    // the long-press step so the guide always points at something real.
    if (!options?.preserveGuidePhase && isGuidedRef.current && GUIDE_SELECTION_PHASES.has(guidePhaseRef.current)) {
      const interruptedPhase = guidePhaseRef.current;
      patchSession({
        phase: interruptedPhase === 'readerIntro' || interruptedPhase === 'chooseComment'
          ? 'readerIntro'
          : 'highlightIntro',
      });
    }
  }, [patchSession]);

  useEffect(() => {
    if (typeof controlledBookId !== 'number' && typeof controlledChapter !== 'number') return;
    clearSelection();
  }, [clearSelection, controlledBookId, controlledChapter]);

  useEffect(() => {
    if (guidePhase === 'readerIntro' || guidePhase === 'highlightIntro') {
      guidedSelectionLockRef.current = false;
    }
  }, [guidePhase]);

  const goChapter = useCallback((next: number) => {
    const bounded = Math.max(1, Math.min(currentBook.chapters, next));
    if (bounded === chapter) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLocalChapter(bounded);
    clearSelection();
  }, [chapter, clearSelection, currentBook.chapters]);

  const startSelection = (verse: BibleVerse) => {
    if (isGuided && guidePhase !== 'readerIntro' && guidePhase !== 'highlightIntro') return;
    const guidedSelectionStart = isGuided
      && (guidePhase === 'readerIntro' || guidePhase === 'highlightIntro');
    if (
      guidedSelectionStart
      && (
        (guidePhase === 'readerIntro' && verse.verse !== GUIDE_VERSE_SLOGAN)
        || (guidePhase === 'highlightIntro' && verse.verse !== GUIDE_VERSE_HIGHLIGHT)
      )
    ) return;
    if (guidedSelectionStart && guidedSelectionLockRef.current) return;
    if (guidedSelectionStart) guidedSelectionLockRef.current = true;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedVerseNumbers([verse.verse]);
    setSettledSheetPhase('');
    setActionSheetOpen(guidedSelectionStart);
    if (isGuided && guidePhase === 'readerIntro') {
      patchSession({ phase: 'chooseComment' });
    } else if (isGuided && guidePhase === 'highlightIntro') {
      patchSession({ phase: 'pickColor' });
    }
  };

  const toggleSelection = (verse: BibleVerse) => {
    if (isGuided) return;
    if (!selectionActive) return;
    Haptics.selectionAsync();
    setSelectedVerseNumbers(current => {
      const exists = current.includes(verse.verse);
      const next = exists
        ? current.filter(item => item !== verse.verse)
        : [...current, verse.verse].sort((a, b) => a - b);
      if (next.length === 0) setActionSheetOpen(false);
      return next;
    });
  };

  const applyHighlight = async () => {
    if (selectedVerses.length === 0) return;
    if (isGuided && guidePhase !== 'doHighlight') return;
    const completingGuidedHighlight = isGuided && guidePhase === 'doHighlight';
    if (completingGuidedHighlight && guidedMutationLockRef.current) return;
    if (completingGuidedHighlight) guidedMutationLockRef.current = true;

    const joinedText = selectedVerses.map(verse => verse.text).join('\n\n');
    if (completingGuidedHighlight) {
      const now = Date.now();
      onGuidedAnnotationsSaved?.(selectedVerses.map(verse => ({
        id: `bible-guide-highlight-${verse.bookId}-${verse.chapter}-${verse.verse}`,
        kind: 'highlight',
        color: selectedColor,
        bookId: verse.bookId,
        chapter: verse.chapter,
        verse: verse.verse,
        text: joinedText,
        createdAt: now,
        updatedAt: now,
      })));
      onGuidedHighlightSaved?.(selectedColor);
      pendingSelectionExitRef.current = 'markMade';
      guidePhaseRef.current = 'selectionClosing';
      setPresentation(null);
      patchSession({ phase: 'selectionClosing' });
      setActionSheetOpen(false);
      return;
    }

    try {
      await upsertAnnotations(selectedVerses.map(verse => ({
        // Only replace same-color highlight — preserve other colors
        kind: 'highlight',
        color: selectedColor,
        bookId: verse.bookId,
        chapter: verse.chapter,
        verse: verse.verse,
        text: joinedText,
      })));

      clearSelection();
    } catch (error) {
      guidedMutationLockRef.current = false;
      console.warn('Failed to save Scripture highlight', error);
    }
  };

  const openComment = () => {
    if (selectedVerses.length === 0) return;
    if (hasCommentOverlap) return;
    if (pendingSelectionExitRef.current) return;

    setCommentDraft('');
    setCommentMode('add');
    setCommentSession(value => value + 1);
    pendingSelectionExitRef.current = 'openComment';
    setSettledSheetPhase('');
    setActionSheetOpen(false);
    if (isGuided && guidePhase === 'chooseComment') {
      guidePhaseRef.current = 'commentOpening';
      setPresentation(null);
      patchSession({ phase: 'commentOpening' });
    }
  };

  const closeGuidedCommentOnHighlightVerse = useCallback(() => {
    // Verse 15 is the next lesson. Move it into place while the native comment
    // modal still covers the reader, then let the modal fade away. This keeps
    // the walkthrough direct and removes the visible post-save page scroll.
    const positionBehindModal = (attempt = 0) => {
      highlightVerseTarget.measureNow(layout => {
        if (!layout && attempt < 6) {
          guidedCommentPositionTimerRef.current = setTimeout(
            () => positionBehindModal(attempt + 1),
            32,
          );
          return;
        }
        guidedCommentPositionTimerRef.current = null;
        if (layout) {
          const desiredY = readerGuideTargetY(layout.height);
          const nextScrollY = Math.max(
            0,
            verseGuideScrollYRef.current + (layout.y - desiredY),
          );
          scrollRef.current?.scrollTo({ y: nextScrollY, animated: false });
          verseGuideScrollYRef.current = nextScrollY;
        }
        setCommentOpen(false);
      });
    };
    if (guidedCommentPositionTimerRef.current) {
      clearTimeout(guidedCommentPositionTimerRef.current);
    }
    positionBehindModal();
  }, [highlightVerseTarget, readerGuideTargetY, verseGuideScrollYRef]);

  useEffect(() => () => {
    if (guidedCommentPositionTimerRef.current) {
      clearTimeout(guidedCommentPositionTimerRef.current);
    }
  }, []);

  const saveComment = async () => {
    if (commentSaving || guidedMutationLockRef.current) return;
    const cleanComment = commentDraft.trim();
    if (!plainRichText(cleanComment)) return;
    if (commentMode !== 'edit' && selectedVerses.length === 0) return;
    // Guided comments are preview-only. Until the typing lesson explicitly
    // reaches its save phase, the visible editor button is intentionally inert
    // so no timing window can fall through to Scripture persistence.
    if (isGuidedRef.current && guidePhaseRef.current !== 'commentReady') return;
    guidedMutationLockRef.current = true;
    setCommentSaving(true);

    try {
      const completingGuidedComment = isGuidedRef.current && guidePhaseRef.current === 'commentReady';
      if (completingGuidedComment) {
        const selectionText = selectedQuoteLines.join('\n\n');
        const now = Date.now();
        onGuidedAnnotationsSaved?.(selectedVerses.map(verse => ({
          id: `bible-guide-comment-${verse.bookId}-${verse.chapter}-${verse.verse}`,
          kind: 'comment',
          color: selectedColor,
          bookId: verse.bookId,
          chapter: verse.chapter,
          verse: verse.verse,
          text: selectionText,
          comment: cleanComment,
          createdAt: now,
          updatedAt: now,
        })));
        commentCleanupPendingRef.current = true;
        pendingCommentExitPhaseRef.current = 'highlightIntro';
        guidePhaseRef.current = 'commentClosing';
        setPresentation(null);
        patchSession({ phase: 'commentClosing' });
        closeGuidedCommentOnHighlightVerse();
        return;
      }

      if (commentMode === 'edit' && editCommentTarget) {
        const targets = getGroupedCommentAnnotations(editCommentTarget);
        const editTargets = targets.length > 0 ? targets : [editCommentTarget];
        for (const old of editTargets) {
          await deleteAnnotation(old.id);
          await upsertAnnotation({
            kind: 'comment',
            color: selectedColor,
            bookId: old.bookId,
            chapter: old.chapter,
            verse: old.verse,
            text: old.text,
            comment: cleanComment,
          });
        }
        commentCleanupPendingRef.current = true;
        setCommentOpen(false);
        return;
      }

      if (selectedVerses.length === 0) return;
      const selectionText = selectedQuoteLines.join('\n\n');
      for (const verse of selectedVerses) {
        const existingComments = annotations.filter(annotation =>
          annotation.kind === 'comment'
          && annotation.bookId === verse.bookId
          && annotation.chapter === verse.chapter
          && annotation.verse === verse.verse);
        await Promise.all(existingComments.map(annotation => deleteAnnotation(annotation.id)));
        await upsertAnnotation({
          kind: 'comment',
          color: selectedColor,
          bookId: verse.bookId,
          chapter: verse.chapter,
          verse: verse.verse,
          text: selectionText,
          comment: cleanComment,
        });
      }

      commentCleanupPendingRef.current = true;
      setCommentOpen(false);
    } catch (error) {
      guidedMutationLockRef.current = false;
      console.warn('Failed to save Scripture comment', error);
    } finally {
      setCommentSaving(false);
    }
  };
  const saveCommentRef = useRef(saveComment);
  saveCommentRef.current = saveComment;

  const openCommentPreview = (annotation: ScriptureAnnotation) => {
    Haptics.selectionAsync();
    if (isGuided && guidePhase === 'returnIntro') {
      setPresentation(null);
      patchSession({ phase: 'returnCommentOpen' });
    }
    setViewingComment(annotation);
  };

  const closeCommentPreview = () => {
    setViewingComment(null);
    if (isGuidedRef.current && guidePhaseRef.current === 'returnCommentOpen') {
      patchSession({ phase: 'returnCommentDone' });
    }
  };

  const getGroupedCommentAnnotations = (target: ScriptureAnnotation | null) => {
    if (!target) return [];
    return annotations
      .filter(annotation =>
        annotation.kind === 'comment'
        && annotation.bookId === target.bookId
        && annotation.chapter === target.chapter
        && annotation.color === target.color
        && annotation.text === target.text
        && annotation.comment === target.comment)
      .sort((a, b) => a.verse - b.verse);
  };

  const getCommentVerseRange = (target: ScriptureAnnotation | null) => {
    if (!target) return '';
    const book = getBibleBook(target.bookId)?.name ?? currentBook.name;
    const group = getGroupedCommentAnnotations(target);
    const first = group[0]?.verse ?? target.verse;
    const last = group[group.length - 1]?.verse ?? first;
    return `${book.toUpperCase()} ${target.chapter}:${first}${last !== first ? `-${last}` : ''}`;
  };

  const deleteViewingComment = async () => {
    if (!viewingComment) return;
    const groupedComments = getGroupedCommentAnnotations(viewingComment);
    await Promise.all(groupedComments.map(annotation => deleteAnnotation(annotation.id)));
    setViewingComment(null);
  };

  const startEditFlow = (target: ScriptureAnnotation) => {
    setSelectedVerseNumbers([]);
    setSelectedColor(target.color);
    setEditCommentTarget(target);
    setCommentDraft(target.comment ?? '');
    setCommentMode('edit');
    setCommentSession(value => value + 1);
    setActionSheetOpen(false);
    setViewingComment(null);
    setCommentOpen(true);
  };

  const editViewingComment = () => {
    if (!viewingComment) return;
    startEditFlow(viewingComment);
  };

  const editCommentVerseTexts = useMemo(() => {
    if (!editCommentTarget) return [];
    const grouped = annotations
      .filter(annotation =>
        annotation.kind === 'comment'
        && annotation.bookId === editCommentTarget.bookId
        && annotation.chapter === editCommentTarget.chapter
        && annotation.color === editCommentTarget.color
        && annotation.text === editCommentTarget.text
        && annotation.comment === editCommentTarget.comment)
      .sort((a, b) => a.verse - b.verse);
    const targets = grouped.length > 0 ? grouped : [editCommentTarget];
    const fallbackLines = splitQuoteLines(editCommentTarget.text);

    return targets.map((annotation, index) => {
      const loadedVerse = verses.find(verse => verse.verse === annotation.verse);
      return {
        verse: annotation.verse,
        text: loadedVerse?.text ?? fallbackLines[index] ?? plainRichText(annotation.text),
      };
    });
  }, [annotations, editCommentTarget, verses]);

  const editCommentVerseRange = useMemo(() => {
    if (!editCommentTarget) return '';
    const book = getBibleBook(editCommentTarget.bookId)?.name ?? currentBook.name;
    const verseNumbers = editCommentVerseTexts.map(item => item.verse).sort((a, b) => a - b);
    const first = verseNumbers[0] ?? editCommentTarget.verse;
    const last = verseNumbers[verseNumbers.length - 1] ?? first;
    return `${book.toUpperCase()} ${editCommentTarget.chapter}:${first}${last !== first ? `-${last}` : ''}`;
  }, [currentBook.name, editCommentTarget, editCommentVerseTexts]);

  const activeCommentVerseTexts = commentMode === 'edit' && editCommentTarget
    ? editCommentVerseTexts
    : selectedVerses.map(verse => ({ verse: verse.verse, text: verse.text }));

  const activeCommentVerseRange = commentMode === 'edit' && editCommentTarget
    ? editCommentVerseRange
    : selectedVerses.length > 0
      ? `${currentBook.name.toUpperCase()} ${chapter}:${selectedVerses[0].verse}${selectedVerses.length > 1 ? `-${selectedVerses[selectedVerses.length - 1].verse}` : ''}`
      : '';

  const closeCommentModal = useCallback(() => {
    if (commentSaving) return;
    commentCleanupPendingRef.current = true;
    setCommentOpen(false);
    if (
      isGuidedRef.current
      && (
        guidePhaseRef.current === 'commentOpening'
        || guidePhaseRef.current === 'commentTyping'
        || guidePhaseRef.current === 'commentReady'
      )
    ) {
      pendingCommentExitPhaseRef.current = 'readerIntro';
      guidePhaseRef.current = 'commentClosing';
      setPresentation(null);
      patchSession({ phase: 'commentClosing' });
    }
  }, [commentSaving, patchSession, setPresentation]);

  const openGuidedCommentEditor = useCallback(() => {
    const target = verses.find(verse => (
      verse.verse > initialVerse
      && !currentAnnotations.some(annotation => annotation.kind === 'comment' && annotation.verse === verse.verse)
    )) ?? [...verses].reverse().find(verse => (
      verse.verse < initialVerse
      && !currentAnnotations.some(annotation => annotation.kind === 'comment' && annotation.verse === verse.verse)
    )) ?? verses.find(verse => !currentAnnotations.some(annotation => annotation.kind === 'comment' && annotation.verse === verse.verse));
    if (!target) {
      patchSession({ phase: 'openNote' });
      return;
    }
    setSelectedVerseNumbers([target.verse]);
    setSelectedColor('gold');
    setCommentDraft('What is this verse asking me to live today?');
    setCommentMode('add');
    setCommentSession(value => value + 1);
    setActionSheetOpen(false);
    setCommentOpen(true);
    setPresentation(null);
    patchSession({ phase: 'commentEditor' });
  }, [currentAnnotations, initialVerse, patchSession, setPresentation, verses]);

  const handleGuidedCommentTyped = useCallback((value: string) => {
    setCommentDraft(value);
    if (isGuidedRef.current && guidePhaseRef.current === 'commentTyping') {
      guidePhaseRef.current = 'commentReady';
      patchSession({ phase: 'commentReady' });
    }
  }, [patchSession]);

  const handleSelectionSheetEntered = useCallback(() => {
    const phase = guidePhaseRef.current;
    if (phase === 'chooseComment' || phase === 'pickColor') {
      guidedSelectionLockRef.current = false;
      setSettledSheetPhase(phase);
    }
  }, []);

  const handleSelectionSheetExited = useCallback(() => {
    const next = pendingSelectionExitRef.current;
    pendingSelectionExitRef.current = null;
    setSettledSheetPhase('');

    if (next === 'openComment') {
      setCommentOpen(true);
      return;
    }
    if (!next) return;

    clearSelection({ preserveGuidePhase: true });
    guidedMutationLockRef.current = false;
    guidePhaseRef.current = next;
    patchSession({ phase: next });
    if (next === 'markMade') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, [clearSelection, patchSession]);

  const handleSelectionDismiss = useCallback(() => {
    const phase = guidePhaseRef.current;
    if (
      isGuidedRef.current
      && (phase === 'chooseComment' || phase === 'pickColor' || phase === 'doHighlight')
    ) {
      if (pendingSelectionExitRef.current) return;
      pendingSelectionExitRef.current = phase === 'chooseComment' ? 'readerIntro' : 'highlightIntro';
      guidePhaseRef.current = 'selectionClosing';
      setPresentation(null);
      patchSession({ phase: 'selectionClosing' });
      setActionSheetOpen(false);
      return;
    }
    clearSelection();
  }, [clearSelection, patchSession, setPresentation]);

  const handleSelectionSheetDismiss = useCallback(() => {
    const phase = guidePhaseRef.current;
    if (
      isGuidedRef.current
      && (phase === 'chooseComment' || phase === 'pickColor' || phase === 'doHighlight')
    ) {
      handleSelectionDismiss();
      return;
    }
    setActionSheetOpen(false);
  }, [handleSelectionDismiss]);

  const handleCommentModalEntered = useCallback(() => {
    if (!isGuidedRef.current || guidePhaseRef.current !== 'commentOpening') return;
    guidePhaseRef.current = 'commentTyping';
    patchSession({ phase: 'commentTyping' });
  }, [patchSession]);

  const handleCommentModalExited = useCallback(() => {
    if (commentCleanupPendingRef.current) {
      commentCleanupPendingRef.current = false;
      clearSelection({ preserveGuidePhase: true });
    }

    const next = pendingCommentExitPhaseRef.current;
    pendingCommentExitPhaseRef.current = null;
    guidedMutationLockRef.current = false;
    if (!next) return;

    guidePhaseRef.current = next;
    patchSession({ phase: next });
  }, [clearSelection, patchSession]);

  // Modal and sheet completion callbacks normally advance these phases. A
  // native transition can be interrupted when the app backgrounds or another
  // modal replaces it, so keep a small idempotent recovery path. Without it,
  // the guide could remain on a presentation-less phase forever.
  useEffect(() => {
    if (!isGuided) return undefined;
    let recover: (() => void) | undefined;

    if (
      (guidePhase === 'chooseComment' || guidePhase === 'pickColor')
      && actionSheetOpen
      && settledSheetPhase !== guidePhase
    ) {
      recover = handleSelectionSheetEntered;
    } else if (guidePhase === 'selectionClosing') {
      recover = handleSelectionSheetExited;
    } else if (guidePhase === 'commentOpening') {
      recover = commentOpen ? handleCommentModalEntered : handleSelectionSheetExited;
    } else if (guidePhase === 'commentClosing') {
      recover = handleCommentModalExited;
    }

    if (!recover) return undefined;
    const timer = setTimeout(recover, 760);
    return () => clearTimeout(timer);
  }, [
    actionSheetOpen,
    commentOpen,
    guidePhase,
    handleCommentModalEntered,
    handleCommentModalExited,
    handleSelectionSheetEntered,
    handleSelectionSheetExited,
    isGuided,
    settledSheetPhase,
  ]);

  const saveViewingCommentEdit = async (target: ScriptureAnnotation, newCommentHtml: string) => {
    const cleanComment = newCommentHtml.trim();
    if (!plainRichText(cleanComment)) return;
    const groupedComments = getGroupedCommentAnnotations(target);
    const targets = groupedComments.length > 0 ? groupedComments : [target];

    for (const old of targets) {
      await deleteAnnotation(old.id);
      await upsertAnnotation({
        kind: 'comment',
        color: old.color,
        bookId: old.bookId,
        chapter: old.chapter,
        verse: old.verse,
        text: old.text,
        comment: cleanComment,
      });
    }

    // Keep the popup open with an updated reference so the local "savedDraft"
    // reflects what's now in storage, not the stale annotation row.
    setViewingComment(prev => (prev ? { ...prev, comment: cleanComment } : prev));
  };

  const openBibleNote = () => {
    if (isGuided && guidePhase !== 'openNote') return;
    // During the tour, opening the chapter note IS the lesson — hand over to
    // the notes scene instead of navigating away from onboarding.
    if (isGuided && guidePhase === 'openNote') {
      Keyboard.dismiss();
      clearSelection({ preserveGuidePhase: true });
      setViewingComment(null);
      guidedNoteMotionLockRef.current = false;
      setBibleNotesSheetMode('expanded');
      setPresentation(null);
      guidePhaseRef.current = 'noteSheetOpening';
      patchSession({ phase: 'noteSheetOpening' });
      return;
    }
    Keyboard.dismiss();
    clearSelection();
    setViewingComment(null);
    setBibleNotesSheetMode('expanded');
  };

  const handleBibleNotesMotionSettled = useCallback((nextExpanded: boolean) => {
    if (!isGuidedRef.current) return;
    if (guidePhaseRef.current === 'noteSheetOpening' && nextExpanded) {
      guidedNoteMotionLockRef.current = false;
      guidePhaseRef.current = 'noteSheetIntro';
      patchSession({ phase: 'noteSheetIntro' });
      return;
    }
    if (guidePhaseRef.current === 'noteSheetCollapse' && !nextExpanded) {
      guidedNoteMotionLockRef.current = false;
      guidePhaseRef.current = 'noteSheetCollapsed';
      patchSession({ phase: 'noteSheetCollapsed' });
    }
  }, [patchSession]);

  useEffect(() => {
    if (!isGuided) return undefined;
    const openingNeedsRecovery = guidePhase === 'noteSheetOpening'
      && bibleNotesSheetMode === 'expanded';
    const collapseNeedsRecovery = guidePhase === 'noteSheetCollapse'
      && bibleNotesSheetMode === 'collapsed';
    if (!openingNeedsRecovery && !collapseNeedsRecovery) return undefined;
    const timer = setTimeout(
      () => handleBibleNotesMotionSettled(openingNeedsRecovery),
      900,
    );
    return () => clearTimeout(timer);
  }, [bibleNotesSheetMode, guidePhase, handleBibleNotesMotionSettled, isGuided]);

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    router.back();
  };

  // ─── Guided Bible tour presentations ───────────────────────────────────────
  useEffect(() => {
    if (!isGuided) return;

    if (guidePhase === 'legacyReaderIntro') {
      if (stagedVersePhase !== 'readerIntro') {
        setPresentation(null);
        return;
      }
      setPresentation({
        key: 'bible-reader-intro',
        targetId: SCRIPTURE_GUIDE_TARGETS.verseSlogan,
        cutoutPadding: 6,
        placement: 'below',
        allowTargetInteraction: true,
        eyebrow: 'HOLY SCRIPTURE',
        message: 'This is the verse Anasta is built around. Let’s highlight it.',
        highlights: ['Anasta', 'highlight it'],
        action: 'Press and hold Ephesians 5:14',
        hint: 'long-press',
      });
      return;
    }
    if (guidePhase === 'legacyReturnCommentOpen' || guidePhase === 'legacyCommentEditor') {
      // The real comment popup/editor owns the stage in these phases.
      setPresentation(null);
      return;
    }
    if (guidePhase === 'legacyOpenTools') {
      setPresentation({
        key: 'bible-open-tools',
        targetId: SCRIPTURE_GUIDE_TARGETS.annotateFab,
        cutoutPadding: 8,
        placement: 'below',
        allowTargetInteraction: true,
        eyebrow: 'HOLY SCRIPTURE',
        message: 'The verse is selected and waiting.',
        action: 'Open your annotation tools',
        hint: 'tap',
        hintAnchor: 'left',
      });
      return;
    }
    if (guidePhase === 'legacyPickColor') {
      if (stagedSheetPhase !== 'pickColor') {
        setPresentation(null);
        return;
      }
      setPresentation({
        key: 'bible-pick-color',
        targetId: SCRIPTURE_GUIDE_TARGETS.sheetColors,
        cutoutPadding: 7,
        placement: 'above',
        allowTargetInteraction: true,
        eyebrow: 'HOLY SCRIPTURE',
        message: 'Colors are the heart of this study. Each carries a name and a meaning — and soon you will make them your own.',
        highlights: ['name and a meaning'],
        action: 'Choose the first color',
        hint: 'tap',
        hintAnchor: 'left',
      });
      return;
    }
    if (guidePhase === 'legacyDoHighlight') {
      if (stagedSheetPhase !== 'doHighlight') {
        setPresentation(null);
        return;
      }
      setPresentation({
        key: 'bible-do-highlight',
        targetId: SCRIPTURE_GUIDE_TARGETS.sheetHighlight,
        cutoutPadding: 7,
        placement: 'above',
        allowTargetInteraction: true,
        eyebrow: 'HOLY SCRIPTURE',
        message: 'This underlines the verse in your chosen color.',
        action: 'Press Highlight',
        hint: 'tap',
        hintAnchor: 'left',
      });
      return;
    }
    if (guidePhase === 'legacyMarkMade') {
      setPresentation({
        key: 'bible-mark-made',
        targetId: SCRIPTURE_GUIDE_TARGETS.favoritesIcon,
        cutoutPadding: 8,
        placement: 'below',
        allowTargetInteraction: true,
        eyebrow: 'HOLY SCRIPTURE',
        message: 'Your highlight is saved. Press the star to see where every highlight and comment lives.',
        highlights: ['saved', 'every highlight and comment'],
        action: 'Open My Favorites',
        hint: 'tap',
      });
      return;
    }
    if (guidePhase === 'legacyCommentDone') {
      setPresentation({
        key: 'bible-comment-done',
        placement: 'bottom',
        lightScrim: true,
        eyebrow: 'HOLY SCRIPTURE',
        message: 'That is the complete annotation flow: select the verse, choose its meaning, then highlight it or leave a comment.',
        highlights: ['select the verse', 'highlight it or leave a comment'],
        ctaLabel: 'Continue to Bible Notes',
        onCta: () => patchSession({ phase: 'openNote' }),
      });
      return;
    }
    if (guidePhase === 'legacyReturnIntro') {
      if (stagedVersePhase !== 'returnIntro') {
        setPresentation(null);
        return;
      }
      setPresentation({
        key: 'bible-return-intro',
        targetId: SCRIPTURE_GUIDE_TARGETS.verseSlogan,
        cutoutPadding: 6,
        placement: 'above',
        allowTargetInteraction: true,
        eyebrow: 'HOLY SCRIPTURE',
        message: 'One tap on a saved comment brings you back to exactly where it lives in Scripture.',
        highlights: ['exactly where it lives'],
        action: 'Tap the marked verse to read the comment',
        hint: 'tap',
      });
      return;
    }
    if (guidePhase === 'legacyReturnCommentDone') {
      setPresentation({
        key: 'bible-return-comment-done',
        placement: 'bottom',
        lightScrim: true,
        eyebrow: 'HOLY SCRIPTURE',
        message: 'Comments can hold thoughts, reflections, or prayers — and they stay beside the text. Now add one of your own in the real editor.',
        highlights: ['thoughts, reflections, or prayers', 'real editor'],
        ctaLabel: 'Open Add Comment',
        onCta: openGuidedCommentEditor,
      });
      return;
    }
    if (guidePhase === 'legacyOpenNote') {
      setPresentation({
        key: 'bible-open-note',
        targetId: SCRIPTURE_GUIDE_TARGETS.noteIcon,
        cutoutPadding: 8,
        placement: 'below',
        allowTargetInteraction: true,
        eyebrow: 'BIBLE NOTES',
        message: 'Every chapter can hold a study note — what you observed, what it taught you, how you will live it. Write freely; nothing is lost.',
        highlights: ['study note'],
        action: 'Open this chapter’s note — top right',
        hint: 'tap',
      });
    }
  }, [guidePhase, isGuided, onGuidedAdvance, openGuidedCommentEditor, patchSession, setPresentation, stagedSheetPhase, stagedVersePhase]);

  useEffect(() => {
    if (!isGuided) return undefined;

    if (guidePhase === 'readerIntro') {
      if (stagedVersePhase !== 'readerIntro') return undefined;
      setPresentation({
        key: 'bible-reader-intro-v2',
        coachGroupKey: 'bible-primary-coach',
        targetId: SCRIPTURE_GUIDE_TARGETS.verseSlogan,
        cutoutPadding: 6,
        placement: 'below',
        allowTargetInteraction: !guideSloganHasProtectedComment,
        eyebrow: 'EPHESIANS 5:14',
        message: guideSloganHasProtectedComment
          ? 'Your comment is already saved beside this verse. Anasta never replaces your own reflection.'
          : 'This verse inspired Anasta. Press and hold it to add a comment.',
        highlights: guideSloganHasProtectedComment
          ? ['already saved', 'never replaces']
          : ['Press and hold'],
        action: guideSloganHasProtectedComment ? undefined : 'Press and hold Ephesians 5:14',
        hint: guideSloganHasProtectedComment ? undefined : 'long-press',
        ctaLabel: guideSloganHasProtectedComment ? 'Keep my comment' : undefined,
        onCta: guideSloganHasProtectedComment
          ? () => patchSession({ phase: 'highlightIntro' })
          : undefined,
      });
      return undefined;
    }

    if (guidePhase === 'chooseComment') {
      if (stagedSheetPhase !== 'chooseComment') return undefined;
      setPresentation({
        key: 'bible-choose-comment',
        coachGroupKey: 'bible-selection-coach',
        targetId: SCRIPTURE_GUIDE_TARGETS.sheetComment,
        cutoutPadding: 7,
        placement: 'above',
        allowTargetInteraction: true,
        eyebrow: 'COMMENT',
        message: 'Comments keep your thoughts beside the verse.',
        action: 'Tap Add reflection',
        hint: 'tap',
      });
      return undefined;
    }

    if (guidePhase === 'commentTyping') {
      setPresentation(null);
      return undefined;
    }

    if (guidePhase === 'commentReady') {
      if (stagedCommentPhase !== 'commentReady') return undefined;
      setPresentation({
        key: 'bible-comment-ready',
        coachGroupKey: 'bible-comment-coach',
        targetId: SCRIPTURE_GUIDE_TARGETS.commentSave,
        cutoutPadding: 8,
        placement: 'above',
        allowTargetInteraction: true,
        eyebrow: 'COMMENT',
        message: 'Your comment is ready.',
        action: 'Save the comment',
        hint: 'tap',
      });
      return undefined;
    }

    if (guidePhase === 'highlightIntro') {
      if (stagedVersePhase !== 'highlightIntro') return undefined;
      setPresentation({
        key: 'bible-highlight-intro',
        coachGroupKey: 'bible-primary-coach',
        targetId: SCRIPTURE_GUIDE_TARGETS.verseHighlight,
        cutoutPadding: 6,
        placement: 'above',
        allowTargetInteraction: true,
        eyebrow: 'HIGHLIGHT',
        message: 'Press and hold the next verse to highlight it.',
        highlights: ['Press and hold', 'highlight it'],
        action: 'Press and hold Ephesians 5:15',
        hint: 'long-press',
      });
      return undefined;
    }

    if (guidePhase === 'pickColor') {
      if (stagedSheetPhase !== 'pickColor') return undefined;
      setPresentation({
        key: 'bible-pick-color-v2',
        coachGroupKey: 'bible-selection-coach',
        targetId: SCRIPTURE_GUIDE_TARGETS.sheetColors,
        cutoutPadding: 7,
        placement: 'above',
        allowTargetInteraction: true,
        eyebrow: 'HIGHLIGHT',
        message: 'Choose a color for this highlight. You can name colors in My Favorites.',
        highlights: ['Choose a color', 'name colors'],
        action: 'Choose a color',
        hint: 'tap',
        hintAnchor: 'left',
      });
      return undefined;
    }

    if (guidePhase === 'doHighlight') {
      if (stagedSheetPhase !== 'doHighlight') return undefined;
      setPresentation({
        key: 'bible-do-highlight-v2',
        coachGroupKey: 'bible-selection-coach',
        targetId: SCRIPTURE_GUIDE_TARGETS.sheetHighlight,
        cutoutPadding: 7,
        placement: 'above',
        allowTargetInteraction: true,
        eyebrow: 'HIGHLIGHT',
        message: 'Tap Highlight to save it.',
        highlights: ['Tap Highlight'],
        action: 'Tap Highlight',
        hint: 'tap',
      });
      return undefined;
    }

    if (guidePhase === 'markMade') {
      setPresentation({
        key: 'bible-mark-made-v2',
        coachGroupKey: 'bible-primary-coach',
        targetId: SCRIPTURE_GUIDE_TARGETS.favoritesIcon,
        cutoutPadding: 8,
        placement: 'below',
        allowTargetInteraction: true,
        eyebrow: 'HOLY SCRIPTURE',
        message: 'My Favorites keeps your comments and highlights together.',
        highlights: ['My Favorites'],
        action: 'Open My Favorites',
        hint: 'tap',
      });
      return undefined;
    }

    if (guidePhase === 'returnArrival') {
      // Let the direct jump land cleanly on Ephesians 5:15 before teaching the
      // next control. This replaces a second CTA without hiding the result of
      // tapping the saved highlight behind an immediate new spotlight.
      setPresentation(null);
      const timer = setTimeout(() => {
        if (guidePhaseRef.current === 'returnArrival') {
          patchSession({ phase: 'openNote' });
        }
      }, 180);
      return () => clearTimeout(timer);
    }

    if (guidePhase === 'returnIntro') {
      if (stagedVersePhase !== 'returnIntro') return undefined;
      setPresentation({
        key: 'bible-return-intro-v2',
        coachGroupKey: 'bible-primary-coach',
        targetId: SCRIPTURE_GUIDE_TARGETS.verseHighlight,
        cutoutPadding: 6,
        placement: 'above',
        allowTargetInteraction: false,
        eyebrow: 'EPHESIANS 5:15',
        message: 'The highlight brings you back to its exact verse.',
        highlights: ['exact verse'],
        ctaLabel: 'Continue',
        onCta: () => patchSession({ phase: 'openNote' }),
      });
      return undefined;
    }

    if (guidePhase === 'openNote') {
      setPresentation({
        key: 'bible-open-note-v2',
        coachGroupKey: 'bible-primary-coach',
        targetId: SCRIPTURE_GUIDE_TARGETS.noteIcon,
        cutoutPadding: 8,
        placement: 'below',
        allowTargetInteraction: true,
        eyebrow: 'BIBLE NOTES',
        message: 'The highlight returned you to Ephesians 5:15. Bible Notes keeps one note for each chapter.',
        highlights: ['returned you to Ephesians 5:15', 'one note for each chapter'],
        action: 'Open this chapter’s note',
        hint: 'tap',
      });
      return undefined;
    }

    if (guidePhase === 'noteSheetOpening') {
      setPresentation(null);
      return undefined;
    }

    if (guidePhase === 'noteSheetIntro') {
      setPresentation({
        key: 'bible-note-sheet-intro',
        coachGroupKey: 'bible-primary-coach',
        placement: 'bottom',
        lightScrim: true,
        eyebrow: 'BIBLE NOTES',
        message: 'Each chapter has its own note. Use Observations, Lessons, and Application to organize what you learn.',
        highlights: ['Each chapter', 'Observations, Lessons, and Application'],
        chips: ['Observations', 'Lessons', 'Application'],
        ctaLabel: 'Continue',
        onCta: () => patchSession({ phase: 'noteSheetCollapse' }),
      });
      return undefined;
    }

    if (guidePhase === 'noteSheetCollapse') {
      setPresentation(null);
      let cancelled = false;
      let retryTimer: ReturnType<typeof setTimeout> | undefined;
      const stageHeader = (attempt = 0) => {
        notesHeaderTarget.measureNow(layout => {
          if (cancelled) return;
          if (!layout) {
            if (attempt >= 24) {
              setBibleNotesSheetMode('collapsed');
              return;
            }
            retryTimer = setTimeout(
              () => stageHeader(attempt + 1),
              48,
            );
            return;
          }
          requestAnimationFrame(() => {
            if (cancelled) return;
            setPresentation({
              key: 'bible-note-sheet-collapse',
              coachGroupKey: 'bible-primary-coach',
              targetId: SCRIPTURE_GUIDE_TARGETS.notesHeader,
              cutoutPadding: 6,
              placement: 'below',
              allowTargetInteraction: true,
              eyebrow: 'BIBLE NOTES',
              message: 'Collapse the sheet to keep reading without closing your note.',
              action: 'Tap the Bible Notes title',
              hint: 'tap',
            });
          });
        });
      };
      retryTimer = setTimeout(() => stageHeader(), 32);
      return () => {
        cancelled = true;
        if (retryTimer) clearTimeout(retryTimer);
      };
    }

    if (guidePhase === 'noteSheetCollapsed') {
      setPresentation({
        key: 'bible-note-sheet-collapsed',
        coachGroupKey: 'bible-primary-coach',
        placement: 'bottom',
        hideDim: true,
        eyebrow: 'BIBLE NOTES',
        message: 'Your note stays open and saves automatically while you read and scroll.',
        highlights: ['saves automatically'],
        ctaLabel: 'Return to Holy Scripture',
        onCta: () => onGuidedAdvance?.('openNotes'),
      });
      return undefined;
    }

    return undefined;
  }, [guidePhase, guideSloganHasProtectedComment, isGuided, notesHeaderTarget, onGuidedAdvance, patchSession, setPresentation, stagedCommentPhase, stagedSheetPhase, stagedVersePhase]);

  // A native Modal has its own window and the sheet moves on the UI thread.
  // Confirm the real in-window target after that motion before mounting the
  // coach. Until confirmation, the actual sheet remains fully pressable.
  useEffect(() => {
    if (!isGuided) {
      setStagedSheetPhase('');
      return undefined;
    }
    if (guidePhase === 'chooseComment' || guidePhase === 'pickColor' || guidePhase === 'doHighlight') {
      setStagedSheetPhase('');
      if (guidePhase !== 'doHighlight') setPresentation(null);
      if (settledSheetPhase !== guidePhase) return undefined;

      let cancelled = false;
      let retryTimer: ReturnType<typeof setTimeout> | undefined;
      let firstFrame: number | undefined;
      let secondFrame: number | undefined;
      const target = guidePhase === 'chooseComment'
        ? sheetCommentTarget
        : guidePhase === 'pickColor'
          ? sheetColorsTarget
          : sheetHighlightTarget;

      const measureWhenReady = (attempt = 0) => {
        if (cancelled) return;
        target.measureNow(layout => {
          if (cancelled) return;
          if (!layout) {
            if (attempt >= 24) {
              handleSelectionDismiss();
              return;
            }
            retryTimer = setTimeout(
              () => measureWhenReady(attempt + 1),
              48,
            );
            return;
          }
          firstFrame = requestAnimationFrame(() => {
            secondFrame = requestAnimationFrame(() => {
              if (!cancelled) setStagedSheetPhase(guidePhase);
            });
          });
        });
      };

      retryTimer = setTimeout(() => measureWhenReady(), 32);
      return () => {
        cancelled = true;
        if (retryTimer) clearTimeout(retryTimer);
        if (firstFrame) cancelAnimationFrame(firstFrame);
        if (secondFrame) cancelAnimationFrame(secondFrame);
      };
    }

    setStagedSheetPhase('');
    const timer = setTimeout(() => {
      if (guidePhase === 'openTools') annotateFabTarget.measure();
    }, 220);
    return () => clearTimeout(timer);
  }, [annotateFabTarget, guidePhase, handleSelectionDismiss, isGuided, setPresentation, settledSheetPhase, sheetColorsTarget, sheetCommentTarget, sheetHighlightTarget]);

  useEffect(() => {
    if (!isGuided || guidePhase !== 'commentReady') {
      setStagedCommentPhase('');
      return undefined;
    }
    setStagedCommentPhase('');
    setPresentation(null);
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const measureSave = (attempt = 0) => {
      commentSaveTarget.measureNow(layout => {
        if (cancelled) return;
        if (!layout) {
          if (attempt >= 24) {
            void saveCommentRef.current();
            return;
          }
          retryTimer = setTimeout(
            () => measureSave(attempt + 1),
            48,
          );
          return;
        }
        requestAnimationFrame(() => {
          if (!cancelled) setStagedCommentPhase('commentReady');
        });
      });
    };
    retryTimer = setTimeout(() => measureSave(), 32);
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [commentSaveTarget, guidePhase, isGuided, setPresentation]);

  const canNavigatePrevChapter = canGoPrevChapter ?? chapter > 1;
  const canNavigateNextChapter = canGoNextChapter ?? chapter < currentBook.chapters;

  const handlePrevChapter = () => {
    if (!canNavigatePrevChapter || loading || chapterNavLocked || chapterNavLockedRef.current) return;
    if (onPrevChapter) {
      chapterNavLockedRef.current = true;
      setChapterNavLocked(true);
      onPrevChapter();
      clearSelection();
      return;
    }
    chapterNavLockedRef.current = true;
    setChapterNavLocked(true);
    goChapter(chapter - 1);
  };

  const handleNextChapter = () => {
    if (!canNavigateNextChapter || loading || chapterNavLocked || chapterNavLockedRef.current) return;
    if (onNextChapter) {
      chapterNavLockedRef.current = true;
      setChapterNavLocked(true);
      onNextChapter();
      clearSelection();
      return;
    }
    chapterNavLockedRef.current = true;
    setChapterNavLocked(true);
    goChapter(chapter + 1);
  };

  const hasBottomDock = !!bottomDock;
  const selectionFabTop = insets.top + 100;
  const selectionSheetBottom = insets.bottom;

  if (!ready) {
    return (
      <View style={s.loadingScreen}>
        <ActivityIndicator color={GOLD} />
        <Text style={s.loadingText}>Loading Scripture...</Text>
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <Header
        title={currentBook.name}
        onBack={handleBack}
        onBibleNote={openBibleNote}
        onFavorites={() => {
          if (isGuided) {
            if (guidePhase === 'markMade') {
              setPresentation(null);
              onGuidedAdvance?.('sceneDone');
            }
            return;
          }
          router.push('/favorites');
        }}
        showBack={!isGuided}
        noteTargetProps={isGuided ? { ref: noteIconTarget.ref, onLayout: noteIconTarget.onLayout } : undefined}
        favoritesTargetProps={isGuided ? { ref: favoritesIconTarget.ref, onLayout: favoritesIconTarget.onLayout } : undefined}
      />

      <ChapterBar
        chapter={chapter}
        label={currentBook.id === PSALMS_ID ? 'PSALM' : 'CHAPTER'}
        canGoPrev={!loading && !chapterNavLocked && canNavigatePrevChapter}
        canGoNext={!loading && !chapterNavLocked && canNavigateNextChapter}
        onPrev={handlePrevChapter}
        onNext={handleNextChapter}
      />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + (hasBottomDock ? bottomDockHeight : 120) }]}
        showsVerticalScrollIndicator={false}
        onScroll={isGuided ? handleVerseGuideScroll : undefined}
        onMomentumScrollEnd={isGuided ? () => {
          finishVerseGuideScroll();
          sloganVerseTarget.measure();
          highlightVerseTarget.measure();
        } : undefined}
        onScrollEndDrag={isGuided ? () => {
          sloganVerseTarget.measure();
          highlightVerseTarget.measure();
        } : undefined}
        scrollEventThrottle={isGuided ? 16 : undefined}
      >
        <Reanimated.View
          key={`${bookId}:${chapter}:${loading ? 'loading' : chapterError ? 'error' : 'ready'}`}
          entering={FadeInDown.duration(240)}
          exiting={FadeOut.duration(120)}
          style={s.chapterTransition}
        >
          {loading ? (
            <View style={s.chapterLoading}>
              <ActivityIndicator color={GOLD} />
            </View>
          ) : chapterError ? (
            <View style={s.emptyChapter}>
              <Notebook s={24} c="#C5A059" />
              <Text style={s.emptyChapterTitle}>Scripture is reloading</Text>
              <Text style={s.emptyChapterText}>{chapterError}</Text>
            </View>
          ) : (
            <View style={s.verseList}>
              {verses.map(verse => {
                // Keep both guided verse refs mounted for the whole Reader
                // scene. Swapping one ref between phases can miss onLayout on
                // native and leaves the overlay without a registered cutout.
                const verseGuideTarget = !isGuided
                  ? null
                  : verse.verse === GUIDE_VERSE_SLOGAN
                    ? sloganVerseTarget
                    : verse.verse === GUIDE_VERSE_HIGHLIGHT
                      ? highlightVerseTarget
                      : null;
                return (
                  <View
                    key={verse.verse}
                    onLayout={event => {
                      handleVerseLayout(verse.verse, event.nativeEvent.layout.y);
                    }}
                  >
                    <VerseRow
                      verse={verse}
                      selected={selectedVerseSet.has(verse.verse)}
                      selectionActive={selectionActive}
                      annotations={currentAnnotations.filter(annotation => annotation.verse === verse.verse)}
                      categories={categories}
                      autoFocus={showFocus && initialVerse === verse.verse && chapter === initialChapter}
                      onPress={() => toggleSelection(verse)}
                      onLongPress={() => startSelection(verse)}
                      onOpenComment={openCommentPreview}
                      guideTargetProps={verseGuideTarget ? { ref: verseGuideTarget.ref, onLayout: verseGuideTarget.onLayout } : undefined}
                    />
                  </View>
                );
              })}
            </View>
          )}
        </Reanimated.View>
      </ScrollView>

      {bottomDock}

      {isGuided && guidePhase === 'returnArrival' && (
        <View
          pointerEvents="auto"
          onStartShouldSetResponder={() => true}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={s.guidedInteractionShield}
        />
      )}

      {bibleNotesSheetMode !== 'closed' && (
        <ScriptureBibleNotesSheet
          bookId={bookId}
          bookName={currentBook.name}
          chapter={chapter}
          expanded={bibleNotesSheetMode === 'expanded'}
          guidedPreview={isGuided}
          guideHeaderTargetProps={isGuided ? {
            ref: notesHeaderTarget.ref,
            onLayout: notesHeaderTarget.onLayout,
          } : undefined}
          onExpandedChange={nextExpanded => {
            if (isGuided) {
              if (guidePhaseRef.current !== 'noteSheetCollapse' || nextExpanded) return;
              if (guidedNoteMotionLockRef.current) return;
              guidedNoteMotionLockRef.current = true;
              setPresentation(null);
            }
            setBibleNotesSheetMode(nextExpanded ? 'expanded' : 'collapsed');
          }}
          onMotionSettled={handleBibleNotesMotionSettled}
          expandedChangeEnabled={!isGuided || guidePhase === 'noteSheetCollapse'}
          closeDisabled={isGuided && guidePhase.startsWith('noteSheet')}
          onClose={() => setBibleNotesSheetMode('closed')}
        />
      )}

      <SelectionTools
        visible={selectionActive}
        sheetOpen={actionSheetOpen}
        fabTop={selectionFabTop}
        sheetBottom={selectionSheetBottom}
        categories={categories}
        selectedColor={selectedColor}
        selectedCount={selectedVerses.length}
        commentDisabled={hasCommentOverlap}
        onOpenSheet={() => {
          setActionSheetOpen(true);
          if (isGuided && guidePhase === 'openTools') {
            patchSession({ phase: 'pickColor' });
          }
        }}
        onClose={handleSelectionDismiss}
        onCloseSheet={handleSelectionSheetDismiss}
        onSheetEntered={handleSelectionSheetEntered}
        onSheetExited={handleSelectionSheetExited}
        onSelectColor={color => {
          setSelectedColor(color);
          if (isGuided && guidePhase === 'pickColor') {
            setSettledSheetPhase('doHighlight');
            guidePhaseRef.current = 'doHighlight';
            patchSession({ phase: 'doHighlight' });
          }
        }}
        onHighlight={applyHighlight}
        onComment={openComment}
        onEditColors={() => {
          if (!isGuided) setColorEditorOpen(true);
        }}
        colorEditorOpen={colorEditorOpen}
        onCloseColorEditor={() => setColorEditorOpen(false)}
        onSaveCategory={isGuided ? () => {} : updateCategory}
        fabTargetProps={isGuided ? { ref: annotateFabTarget.ref, onLayout: annotateFabTarget.onLayout } : undefined}
        colorsTargetProps={isGuided ? { ref: sheetColorsTarget.ref, onLayout: sheetColorsTarget.onLayout } : undefined}
        highlightTargetProps={isGuided ? { ref: sheetHighlightTarget.ref, onLayout: sheetHighlightTarget.onLayout } : undefined}
        commentTargetProps={isGuided ? { ref: sheetCommentTarget.ref, onLayout: sheetCommentTarget.onLayout } : undefined}
        guidedOverlay={isGuided ? <GuidedOverlayHost /> : undefined}
      />

      <CommentModal
        editorKey={`scripture-comment-${commentSession}`}
        visible={commentOpen}
        mode={commentMode}
        value={commentDraft}
        verseTexts={activeCommentVerseTexts}
        verseRange={activeCommentVerseRange}
        categories={categories}
        selectedColor={selectedColor}
        onSelectColor={setSelectedColor}
        onEditColors={() => {
          if (!isGuided) setColorEditorOpen(true);
        }}
        onValue={setCommentDraft}
        onClose={closeCommentModal}
        onSave={saveComment}
        onEntered={handleCommentModalEntered}
        onExited={handleCommentModalExited}
        saving={commentSaving}
        guidedAutoTypeText={isGuided && guidePhase === 'commentTyping' ? GUIDE_COMMENT_TEXT : undefined}
        onGuidedTypingDone={handleGuidedCommentTyped}
        saveTargetProps={isGuided ? {
          ref: commentSaveTarget.ref,
          onLayout: commentSaveTarget.onLayout,
        } : undefined}
        guidedOverlay={isGuided ? <GuidedOverlayHost /> : undefined}
      />

      <CommentPreviewModal
        annotation={viewingComment}
        categories={categories}
        verseRange={getCommentVerseRange(viewingComment)}
        guidedReadOnly={isGuided && guidePhase === 'returnCommentOpen'}
        onClose={closeCommentPreview}
        onSave={saveViewingCommentEdit}
        onDelete={deleteViewingComment}
      />

      <CategoryEditorModal
        visible={!isGuided && colorEditorOpen && !(selectionActive && actionSheetOpen)}
        categories={categories}
        onClose={() => setColorEditorOpen(false)}
        onSaveCategory={updateCategory}
      />

    </View>
  );
}

function Header({
  title, onBack, onBibleNote, onFavorites, showBack = true, noteTargetProps, favoritesTargetProps,
}: {
  title: string;
  onBack: () => void;
  onBibleNote: () => void;
  onFavorites: () => void;
  showBack?: boolean;
  noteTargetProps?: { ref: React.Ref<any>; onLayout: (event: any) => void };
  favoritesTargetProps?: { ref: React.Ref<any>; onLayout: (event: any) => void };
}) {
  return (
    <ScreenTitleBar
      title={title.toUpperCase()}
      showBack={showBack}
      bg={BG}
      onBackOverride={onBack}
      sideWidth={88}
      rightElement={(
        <View style={s.headerActions}>
          <TouchableOpacity {...noteTargetProps} onPress={onBibleNote} style={s.headerIconBtn} activeOpacity={0.7}>
            <Notebook s={20} c="#9CA3AF" />
          </TouchableOpacity>
          <TouchableOpacity {...favoritesTargetProps} onPress={onFavorites} style={s.headerIconBtn} activeOpacity={0.7}>
            <Star s={22} c="#9CA3AF" />
          </TouchableOpacity>
        </View>
      )}
    />
  );
}

function ChapterBar({
  chapter, label, canGoPrev, canGoNext, onPrev, onNext,
}: {
  chapter: number;
  label: 'CHAPTER' | 'PSALM';
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <View style={s.chapterBar}>
      <TouchableOpacity onPress={onPrev} disabled={!canGoPrev} style={s.chapterBtn} activeOpacity={0.65}>
        <ChevronLeft s={20} c={canGoPrev ? '#9CA3AF' : '#E5E7EB'} />
      </TouchableOpacity>
      <View style={s.chapterPill}>
        <View style={s.chapterPillDot} />
        <Text style={s.chapterTitle}>{label} {chapter}</Text>
        <View style={s.chapterPillDot} />
      </View>
      <TouchableOpacity onPress={onNext} disabled={!canGoNext} style={s.chapterBtn} activeOpacity={0.65}>
        <ChevronRight s={20} c={canGoNext ? '#9CA3AF' : '#E5E7EB'} />
      </TouchableOpacity>
    </View>
  );
}

function VerseRow({
  verse, annotations, categories, selected, selectionActive, autoFocus, onPress, onLongPress, onOpenComment, guideTargetProps,
}: {
  verse: BibleVerse;
  annotations: ScriptureAnnotation[];
  categories: ColorCategory[];
  selected: boolean;
  selectionActive: boolean;
  autoFocus: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onOpenComment: (annotation: ScriptureAnnotation) => void;
  guideTargetProps?: { ref: React.Ref<any>; onLayout: (event: any) => void };
}) {
  const allHighlights = annotations
    .filter(a => a.kind === 'highlight')
    .filter((a, i, arr) => arr.findIndex(b => b.color === a.color) === i);
  const highlight = allHighlights[0];
  const extraHighlights = allHighlights.slice(1); // additional colors beyond the first
  const underline = annotations.find(annotation => annotation.kind === 'underline');
  const favorite = annotations.find(annotation => annotation.kind === 'favorite');
  const comment = annotations.find(annotation => annotation.kind === 'comment');
  const highlightAccent = highlight ? getAnnotationColorHex(highlight.color) : undefined;
  const underlineAccent = underline ? getAnnotationColorHex(underline.color) : undefined;
  const commentAccent = comment ? getAnnotationColorHex(comment.color) : undefined;
  const favoriteAccent = favorite ? getAnnotationColorHex(favorite.color) : undefined;
  const decorationAccent = commentAccent ?? underlineAccent;
  const markerAccent = commentAccent ?? favoriteAccent;
  const selectedMotion = useSharedValue(selected ? 1 : 0);
  const highlightMotion = useSharedValue(highlightAccent ? 1 : 0);
  const pressMotion = useSharedValue(0);
  const highlightBg = highlightAccent ? hexToRgba(highlightAccent, 0.15) : 'rgba(255,255,255,0)';
  const highlightLine = highlightAccent ? hexToRgba(highlightAccent, 0.30) : 'rgba(255,255,255,0)';

  useEffect(() => {
    selectedMotion.value = withSpring(selected ? 1 : 0, {
      damping: 18,
      stiffness: 230,
      mass: 0.72,
    });
  }, [selected, selectedMotion]);

  useEffect(() => {
    highlightMotion.value = withTiming(highlightAccent ? 1 : 0, {
      duration: highlightAccent ? 220 : 120,
    });
  }, [highlightAccent, highlightMotion]);

  const handlePress = useCallback(() => {
    if (selectionActive) {
      onPress();
      return;
    }
    if (comment) onOpenComment(comment);
  }, [comment, onOpenComment, onPress, selectionActive]);

  const rowGesture = useMemo(() => {
    const tap = Gesture.Tap()
      .maxDuration(260)
      .onBegin(() => {
        pressMotion.value = withTiming(1, { duration: 70 });
      })
      .onEnd((_event, success) => {
        if (success) runOnJS(handlePress)();
      })
      .onFinalize(() => {
        pressMotion.value = withTiming(0, { duration: 120 });
      });

    const longPress = Gesture.LongPress()
      .minDuration(620)
      .maxDistance(14)
      .onBegin(() => {
        pressMotion.value = withTiming(1, { duration: 90 });
      })
      .onEnd((_event, success) => {
        if (success) runOnJS(onLongPress)();
      })
      .onFinalize(() => {
        pressMotion.value = withTiming(0, { duration: 120 });
      });

    return Gesture.Exclusive(longPress, tap);
  }, [handlePress, onLongPress, pressMotion]);

  const rowMotionStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      selectedMotion.value,
      [0, 1],
      ['rgba(255,255,255,0)', '#FFFEF9']
    ),
    borderColor: interpolateColor(
      selectedMotion.value,
      [0, 1],
      ['rgba(197,160,89,0)', 'rgba(197,160,89,0.38)']
    ),
    opacity: 1 - pressMotion.value * 0.05,
  }));

  const selectCircleMotionStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(selectedMotion.value, [0, 1], ['#FFFFFF', GOLD]),
    borderColor: interpolateColor(selectedMotion.value, [0, 1], ['rgba(197,160,89,0.36)', GOLD]),
  }));

  const highlightMotionStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      highlightMotion.value,
      [0, 1],
      ['rgba(255,255,255,0)', highlightBg],
    ),
    borderBottomColor: interpolateColor(
      highlightMotion.value,
      [0, 1],
      ['rgba(255,255,255,0)', highlightLine],
    ),
  }));

  return (
    <GestureDetector gesture={rowGesture}>
      <Reanimated.View
        ref={guideTargetProps?.ref}
        onLayout={guideTargetProps?.onLayout}
        collapsable={false}
        style={[s.verseRow, rowMotionStyle, autoFocus && s.verseRowFocused]}
      >
      <View style={s.verseMarker}>
        {selectionActive ? (
          <Reanimated.View style={[s.selectCircle, selectCircleMotionStyle]}>
            {selected && <CheckSmall s={13} c="#fff" />}
          </Reanimated.View>
        ) : (
          <Text style={s.verseNum}>{verse.verse}</Text>
        )}
      </View>
      <View style={s.verseBody}>
        {markerAccent && !selectionActive && (
          <TouchableOpacity
            onPress={() => { if (comment) onOpenComment(comment); }}
            activeOpacity={0.82}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            style={[s.commentStarBadge, { borderColor: hexToRgba(markerAccent, 0.20), backgroundColor: hexToRgba(markerAccent, 0.08) }]}
          >
            <Star s={14} c={markerAccent} />
          </TouchableOpacity>
        )}
        <Reanimated.View
          style={[
            s.verseTextWrap,
            markerAccent && !selectionActive && s.verseTextWrapMarked,
            highlightAccent && s.verseHighlightWrap,
            highlightAccent && highlightMotionStyle,
          ]}
        >
          <Text
            style={[
              s.verseText,
              decorationAccent && {
                textDecorationLine: 'underline',
                textDecorationStyle: commentAccent ? 'dashed' : 'solid',
                textDecorationColor: hexToRgba(decorationAccent, commentAccent ? 0.70 : 0.58),
              },
            ]}
          >
            {verse.text}
          </Text>

        </Reanimated.View>

        {/* Extra color tray */}
        {!selectionActive && extraHighlights.length > 0 && (
          <View style={s.extraColorTray}>
            <Text style={s.extraColorLabel}>ALSO IN</Text>
            {extraHighlights.map(h => {
              const accent = getAnnotationColorHex(h.color);
              const label = getAnnotationCategoryLabel(categories, h.color);
              return (
                <View key={h.color} style={[s.extraColorChip, { borderColor: hexToRgba(accent, 0.35), backgroundColor: hexToRgba(accent, 0.08) }]}>
                  <View style={[s.extraColorDot, { backgroundColor: accent }]} />
                  <Text style={[s.extraColorChipText, { color: accent }]}>{label}</Text>
                </View>
              );
            })}
          </View>
        )}
      </View>
      </Reanimated.View>
    </GestureDetector>
  );
}

function SelectionTools({
  visible,
  sheetOpen,
  fabTop,
  sheetBottom,
  categories,
  selectedColor,
  selectedCount,
  commentDisabled,
  onOpenSheet,
  onClose,
  onCloseSheet,
  onSheetEntered,
  onSheetExited,
  onSelectColor,
  onHighlight,
  onComment,
  onEditColors,
  colorEditorOpen,
  onCloseColorEditor,
  onSaveCategory,
  fabTargetProps,
  colorsTargetProps,
  highlightTargetProps,
  commentTargetProps,
  guidedOverlay,
}: {
  visible: boolean;
  sheetOpen: boolean;
  fabTop: number;
  sheetBottom: number;
  categories: ColorCategory[];
  selectedColor: HighlightColor;
  selectedCount: number;
  commentDisabled: boolean;
  onOpenSheet: () => void;
  onClose: () => void;
  onCloseSheet: () => void;
  onSheetEntered?: () => void;
  onSheetExited?: () => void;
  onSelectColor: (color: HighlightColor) => void;
  onHighlight: () => void;
  onComment: () => void;
  onEditColors: () => void;
  colorEditorOpen: boolean;
  onCloseColorEditor: () => void;
  onSaveCategory: (color: HighlightColor, label: string) => Promise<void> | void;
  fabTargetProps?: { ref: React.Ref<any>; onLayout: (event: any) => void };
  colorsTargetProps?: { ref: React.Ref<any>; onLayout: (event: any) => void };
  highlightTargetProps?: { ref: React.Ref<any>; onLayout: (event: any) => void };
  commentTargetProps?: { ref: React.Ref<any>; onLayout: (event: any) => void };
  guidedOverlay?: React.ReactNode;
}) {
  if (!visible) return null;

  const accent = getAnnotationColorHex(selectedColor);
  const categoryLabel = getAnnotationCategoryLabel(categories, selectedColor);

  return (
    <>
      {!sheetOpen && (
      <Reanimated.View
        entering={FadeInDown.duration(170)}
        exiting={FadeOut.duration(110)}
        style={[s.pencilFabWrap, { top: fabTop }]}
      >
        <TouchableOpacity
          {...fabTargetProps}
          onPress={onOpenSheet}
          activeOpacity={0.9}
          style={s.pencilFab}
        >
          <View style={s.pencilFabIcon}>
            <Pencil s={15} c="#2F281D" w={2.45} />
          </View>
          <View style={s.pencilFabCopy}>
            <Text style={s.pencilFabLabel}>ANNOTATE</Text>
            <Text style={s.pencilFabHint}>Selected text</Text>
          </View>
        </TouchableOpacity>
      </Reanimated.View>
      )}

      <SmoothBottomSheet
      visible={sheetOpen}
      onClose={onCloseSheet}
      onEntered={onSheetEntered}
      onExited={onSheetExited}
      exitWatchdogMs={guidedOverlay ? 700 : undefined}
      overlayStyle={s.selectionOverlay}
      backdropOpacity={0.08}
      sheetStyle={[s.selectionSheet, { paddingBottom: Math.max(sheetBottom, 16) + 12 }]}
      overlayChildren={(
        <>
          {colorEditorOpen ? (
            <View style={s.selectionEditorLayer}>
              <Pressable style={StyleSheet.absoluteFill} onPress={onCloseColorEditor} />
              <CategoryEditorPanel
                categories={categories}
                onClose={onCloseColorEditor}
                onSaveCategory={onSaveCategory}
                style={s.selectionEditorCard}
              />
            </View>
          ) : null}
          {guidedOverlay}
        </>
      )}
    >
          <View style={s.actionHandle} />

          <View style={s.selectionTop}>
            <View {...colorsTargetProps} collapsable={false} style={s.selectionChipWrap}>
              <CategoryChipPicker
                categories={categories}
                selectedColor={selectedColor}
                onSelectColor={onSelectColor}
                onEdit={onEditColors}
                layout="scroll"
                contentStyle={s.selectionChipContent}
              />
            </View>
            <TouchableOpacity onPress={onClose} activeOpacity={0.82} style={s.sheetCloseBtn}>
              <X s={17} c="#A8A29E" />
            </TouchableOpacity>
          </View>

          <View style={s.sheetDivider} />

          <View {...highlightTargetProps} collapsable={false}>
            <TouchableOpacity
              onPress={onHighlight}
              activeOpacity={0.88}
              style={[
                s.selectionActionCard,
                {
                  borderColor: hexToRgba(accent, 0.30),
                  backgroundColor: hexToRgba(accent, 0.10),
                },
              ]}
            >
              <View style={[s.highlightIconCircle, { borderColor: hexToRgba(accent, 0.18) }]}>
                <Pencil s={18} c={accent} w={2.4} />
              </View>
              <View style={s.sheetActionCopy}>
                <Text style={[s.highlightKicker, { color: accent }]}>HIGHLIGHT</Text>
                <Text style={s.highlightTitle}>Highlight as {categoryLabel}</Text>
                {selectedCount > 1 && <Text style={s.selectionCount}>{selectedCount} verses selected</Text>}
              </View>
              <View style={[s.selectionActionArrow, { borderColor: hexToRgba(accent, 0.18), backgroundColor: hexToRgba(accent, 0.10) }]}>
                <ChevronRight s={15} c={accent} w={2.4} />
              </View>
            </TouchableOpacity>
          </View>

          <View {...commentTargetProps} collapsable={false}>
          <TouchableOpacity
            onPress={commentDisabled ? undefined : onComment}
            activeOpacity={commentDisabled ? 1 : 0.88}
            disabled={commentDisabled}
            style={[
              s.selectionActionCard,
              s.commentAction,
              commentDisabled
                ? { borderColor: '#E5E7EB', backgroundColor: '#F6F6F7', opacity: 0.55 }
                : {
                    borderColor: hexToRgba(accent, 0.24),
                    backgroundColor: '#FFFDFC',
                  },
            ]}
          >
            <View
              style={[
                s.highlightIconCircle,
                commentDisabled
                  ? { backgroundColor: '#ECECEE', borderColor: '#E5E7EB' }
                  : { borderColor: hexToRgba(accent, 0.16) },
              ]}
            >
              <Feather s={18} c={commentDisabled ? '#9CA3AF' : accent} w={2.2} />
            </View>
            <View style={s.sheetActionCopy}>
              <Text
                style={[
                  s.highlightKicker,
                  { color: commentDisabled ? '#9CA3AF' : accent },
                ]}
              >COMMENT</Text>
              <Text
                style={[
                  s.highlightTitle,
                  { color: commentDisabled ? '#9CA3AF' : '#2F2B27' },
                ]}
              >{commentDisabled ? 'Already commented' : 'Add reflection'}</Text>
            </View>
            <View
              style={[
                s.selectionActionArrow,
                {
                  borderColor: commentDisabled ? '#E5E7EB' : hexToRgba(accent, 0.16),
                  backgroundColor: commentDisabled ? '#F3F4F6' : hexToRgba(accent, 0.07),
                },
              ]}
            >
              <ChevronRight s={15} c={commentDisabled ? '#C4C7CC' : accent} w={2.4} />
            </View>
          </TouchableOpacity>
          </View>
      </SmoothBottomSheet>
    </>
  );
}

const COMMENT_VERSE_PREVIEW_COUNT = 2;

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

function normalizeCommentForDirtyCheck(html?: string) {
  const source = (html ?? '').trim();
  if (!plainRichText(source)) return '';
  return source
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();
}

function CommentModal({
  editorKey,
  visible,
  mode,
  value,
  verseTexts,
  verseRange,
  categories,
  selectedColor,
  onSelectColor,
  onEditColors,
  onValue,
  onClose,
  onSave,
  onEntered,
  onExited,
  saving,
  guidedAutoTypeText,
  onGuidedTypingDone,
  saveTargetProps,
  guidedOverlay,
}: {
  editorKey: string;
  visible: boolean;
  mode: 'add' | 'edit';
  value: string;
  verseTexts: { verse: number; text: string }[];
  verseRange: string;
  categories: ColorCategory[];
  selectedColor: HighlightColor;
  onSelectColor: (color: HighlightColor) => void;
  onEditColors: () => void;
  onValue: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
  onEntered?: () => void;
  onExited?: () => void;
  saving?: boolean;
  guidedAutoTypeText?: string;
  onGuidedTypingDone?: (value: string) => void;
  saveTargetProps?: { ref: React.Ref<any>; onLayout: (event: any) => void };
  guidedOverlay?: React.ReactNode;
}) {
  const accent = getAnnotationColorHex(selectedColor);
  const categoryLabel = getAnnotationCategoryLabel(categories, selectedColor);
  const insets = useSafeAreaInsets();
  const editorRef = useRef<RichTextEditorRef>(null);
  const scrollRef = useRef<ScrollView>(null);
  const toolbarYRef = useRef(0);
  const [fmt, setFmt] = useState<FormatState>({ bold: false, italic: false, underline: false });
  const [versesExpanded, setVersesExpanded] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const initialValueRef = useRef('');
  const discardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guidedTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guidedTypingKeyRef = useRef('');
  const [mounted, setMounted] = useState(visible);
  const modalProgress = useSharedValue(visible ? 1 : 0);
  const onEnteredRef = useRef(onEntered);
  const onExitedRef = useRef(onExited);
  const modalExitCompletedRef = useRef(false);
  const guidedExitWatchdog = Boolean(guidedOverlay);
  onEnteredRef.current = onEntered;
  onExitedRef.current = onExited;

  const completeModalEnter = useCallback(() => {
    onEnteredRef.current?.();
  }, []);
  const completeModalExit = useCallback(() => {
    if (modalExitCompletedRef.current) return;
    modalExitCompletedRef.current = true;
    setMounted(false);
    onExitedRef.current?.();
  }, []);

  useEffect(() => {
    if (visible) {
      modalExitCompletedRef.current = false;
      setMounted(true);
      modalProgress.value = 0;
      const frame = requestAnimationFrame(() => {
        modalProgress.value = withTiming(1, {
          duration: 300,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
        }, finished => {
          if (finished) runOnJS(completeModalEnter)();
        });
      });
      return () => cancelAnimationFrame(frame);
    }
    if (!mounted) return undefined;

    Keyboard.dismiss();
    modalExitCompletedRef.current = false;
    modalProgress.value = withTiming(0, {
      duration: 210,
      easing: Easing.in(Easing.cubic),
    }, finished => {
      if (finished) runOnJS(completeModalExit)();
    });
    if (!guidedExitWatchdog) return undefined;
    const exitTimer = setTimeout(completeModalExit, 700);
    return () => clearTimeout(exitTimer);
  }, [completeModalEnter, completeModalExit, guidedExitWatchdog, modalProgress, mounted, visible]);

  const modalFadeStyle = useAnimatedStyle(() => ({
    opacity: modalProgress.value,
  }));
  const commentCardMotionStyle = useAnimatedStyle(() => ({
    opacity: modalProgress.value,
    transform: [
      { translateY: (1 - modalProgress.value) * 18 },
      { scale: 0.992 + modalProgress.value * 0.008 },
    ],
  }));

  useEffect(() => {
    if (!mounted) {
      setVersesExpanded(false);
      setKeyboardOpen(false);
      setDiscardConfirmOpen(false);
      if (discardTimerRef.current) {
        clearTimeout(discardTimerRef.current);
        discardTimerRef.current = null;
      }
    }
  }, [mounted]);

  useEffect(() => {
    if (!visible || !guidedAutoTypeText) return undefined;
    const typingKey = `${editorKey}:${guidedAutoTypeText}`;
    if (guidedTypingKeyRef.current === typingKey) return undefined;
    guidedTypingKeyRef.current = typingKey;

    let cancelled = false;
    let position = 0;
    const escapeHTML = (text: string) => text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    const typeNext = () => {
      if (cancelled) return;
      position = Math.min(guidedAutoTypeText.length, position + 8);
      const visibleText = guidedAutoTypeText.slice(0, position);
      editorRef.current?.setHTML(escapeHTML(visibleText), false);
      if (position >= guidedAutoTypeText.length) {
        onValue(guidedAutoTypeText);
        guidedTypingTimerRef.current = setTimeout(() => {
          if (!cancelled) onGuidedTypingDone?.(guidedAutoTypeText);
        }, 220);
        return;
      }
      guidedTypingTimerRef.current = setTimeout(typeNext, 30);
    };

    guidedTypingTimerRef.current = setTimeout(typeNext, 360);
    return () => {
      cancelled = true;
      if (guidedTypingTimerRef.current) clearTimeout(guidedTypingTimerRef.current);
    };
  }, [editorKey, guidedAutoTypeText, onGuidedTypingDone, onValue, visible]);

  useEffect(() => {
    if (!visible) return;
    initialValueRef.current = value;
    // The baseline must be captured only when a fresh editor instance opens.
    // Updating it while the user types would make dirty-checking ineffective.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorKey, visible]);

  useEffect(() => {
    if (!visible) return;
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, () => {
      setKeyboardOpen(true);
      // Scroll so toolbar sits at top of viewport — verse card scrolls out of the way,
      // toolbar + editor + Save become the focus (matches the user's reference layout).
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y: Math.max(0, toolbarYRef.current - 4), animated: true });
      });
    });
    const hideSub = Keyboard.addListener(hideEvt, () => {
      setKeyboardOpen(false);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  const hasMoreVerses = verseTexts.length > COMMENT_VERSE_PREVIEW_COUNT;
  const visibleVerses = hasMoreVerses && !versesExpanded
    ? verseTexts.slice(0, COMMENT_VERSE_PREVIEW_COUNT)
    : verseTexts;
  const hiddenVerseCount = verseTexts.length - COMMENT_VERSE_PREVIEW_COUNT;
  const showVerseNumbers = verseTexts.length > 1;
  const hasUnsavedEditChanges = mode === 'edit'
    && normalizeCommentForDirtyCheck(value) !== normalizeCommentForDirtyCheck(initialValueRef.current);

  const requestClose = () => {
    if (hasUnsavedEditChanges) {
      if (discardTimerRef.current) clearTimeout(discardTimerRef.current);
      editorRef.current?.blur();
      Keyboard.dismiss();
      discardTimerRef.current = setTimeout(() => {
        setDiscardConfirmOpen(true);
        discardTimerRef.current = null;
      }, keyboardOpen ? (Platform.OS === 'ios' ? 280 : 170) : 0);
      return;
    }
    onClose();
  };

  const discardEditChanges = () => {
    setDiscardConfirmOpen(false);
    onClose();
  };

  if (!mounted) return null;

  return (
    <Modal transparent visible={mounted} animationType="none" onRequestClose={requestClose} statusBarTranslucent>
      <Reanimated.View style={[StyleSheet.absoluteFillObject, modalFadeStyle]}>
      <KeyboardAvoidingView
        style={[
          s.commentOverlay,
          { paddingTop: Math.max(insets.top + 14, 36), paddingBottom: Math.max(insets.bottom + 14, 28) },
        ]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={StyleSheet.absoluteFill} pointerEvents="none" />
        <Reanimated.View style={[s.commentCard, commentCardMotionStyle]}>
          <View style={s.commentHeader}>
            <Text style={s.commentTitle} numberOfLines={1}>{mode === 'edit' ? 'Edit Comment' : 'Add Comment'}</Text>
            <TouchableOpacity onPress={requestClose} style={s.commentCloseBtn} activeOpacity={0.85} hitSlop={6}>
              <X s={16} c="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <ScrollView
            ref={scrollRef}
            style={s.commentScroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.commentScrollContent}
            keyboardShouldPersistTaps="handled"
          >
          <View style={[s.commentVerseCard, { borderColor: hexToRgba(accent, 0.22) }]}>
            <View style={s.commentVerseTags}>
              <View style={[s.commentVerseDot, { backgroundColor: accent }]} />
              <View style={[s.commentVerseChip, { backgroundColor: hexToRgba(accent, 0.10), borderColor: hexToRgba(accent, 0.18) }]}>
                <Text style={[s.commentVerseChipText, { color: accent }]}>{categoryLabel}</Text>
              </View>
            </View>
            {!!verseRange && <Text style={s.commentVerseRef}>{verseRange}</Text>}
            <View style={s.commentVerseQuoteBlock}>
              {visibleVerses.map((vt, index) => (
                <View key={`${vt.verse}-${index}`}>
                  <View style={s.commentVerseLine}>
                    {showVerseNumbers && (
                      <Text style={s.commentVerseNum}>{vt.verse}</Text>
                    )}
                    <Text style={[s.commentVerseText, showVerseNumbers && s.commentVerseTextIndented]}>
                      {`"${vt.text}"`}
                    </Text>
                  </View>
                  {index < visibleVerses.length - 1 && <View style={s.commentVerseDivider} />}
                </View>
              ))}
            </View>
            {hasMoreVerses && (
              <TouchableOpacity
                onPress={() => setVersesExpanded(value => !value)}
                activeOpacity={0.7}
                style={s.commentVerseSeeMore}
              >
                <Text style={[s.commentVerseSeeMoreText, { color: accent }]}>
                  {versesExpanded ? 'See less' : `See ${hiddenVerseCount} more verse${hiddenVerseCount > 1 ? 's' : ''}`}
                </Text>
                <View style={{ transform: [{ rotate: versesExpanded ? '180deg' : '0deg' }] }}>
                  <Text style={[s.commentVerseSeeMoreArrow, { color: accent }]}>›</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          <Text style={s.commentTagLabel}>TAG CATEGORY</Text>
          <CategoryChipPicker
            categories={categories}
            selectedColor={selectedColor}
            onSelectColor={onSelectColor}
            onEdit={onEditColors}
            layout="scroll"
            contentStyle={s.commentChipContent}
          />

          <View onLayout={e => { toolbarYRef.current = e.nativeEvent.layout.y; }}>
            <RichToolbar editorRef={editorRef} activeFormats={fmt} style={s.commentToolbar} />
          </View>
          <View style={[s.commentEditorBox, keyboardOpen && s.commentEditorBoxCompact]}>
            <RichTextEditor
              key={editorKey}
              ref={editorRef}
              initialHTML={value}
              onChange={onValue}
              onFormatChange={setFmt}
              placeholder="Write your reflection..."
              backgroundColor="#FFFDF8"
              color="#3D3229"
              editable={!guidedAutoTypeText}
            />
          </View>
          </ScrollView>

          <TouchableOpacity
            {...saveTargetProps}
            disabled={saving}
            onPress={onSave}
            style={[s.commentSave, saving && { opacity: 0.72 }]}
            activeOpacity={0.85}
          >
            <Text style={s.commentSaveText}>
              {saving ? 'SAVING...' : mode === 'edit' ? 'SAVE CHANGES' : 'SAVE COMMENT'}
            </Text>
          </TouchableOpacity>
        </Reanimated.View>
      </KeyboardAvoidingView>
      {guidedOverlay}

      <ConfirmModal
        visible={discardConfirmOpen}
        embedded
        icon={<X s={22} c={C.red} w={2.35} />}
        iconBg="#FEF2F2"
        title="Delete changes?"
        body="Your edited comment has not been saved. Delete these changes and keep the original comment?"
        cancelLabel="CANCEL"
        confirmLabel="DELETE"
        confirmColor={C.red}
        onBackdropPress={() => setDiscardConfirmOpen(false)}
        onCancel={() => setDiscardConfirmOpen(false)}
        onConfirm={discardEditChanges}
      />
      </Reanimated.View>
    </Modal>
  );
}

function splitQuoteLines(text: string) {
  return text
    .split(/\n{2,}/)
    .map(line => line.trim())
    .filter(Boolean);
}

function AnnotationPreviewCard({
  color,
  categories,
  kindLabel,
  quoteLines,
  compact = false,
}: {
  color: HighlightColor;
  categories: ColorCategory[];
  kindLabel: string;
  quoteLines: string[];
  compact?: boolean;
}) {
  const accent = getAnnotationColorHex(color);
  const categoryLabel = getAnnotationCategoryLabel(categories, color);
  const lines = quoteLines.length > 0 ? quoteLines : [''];

  return (
    <View
      style={[
        s.annotationPreviewCard,
        compact && s.annotationPreviewCardCompact,
        { borderColor: hexToRgba(accent, 0.22) },
      ]}
    >
      <View style={s.annotationPreviewTags}>
        <View style={[s.annotationPreviewDot, { backgroundColor: accent }]} />
        <View style={[s.annotationPreviewChip, { backgroundColor: hexToRgba(accent, 0.10), borderColor: hexToRgba(accent, 0.18) }]}>
          <Text style={[s.annotationPreviewChipText, { color: accent }]}>{categoryLabel}</Text>
        </View>
        <View style={[s.annotationPreviewChip, s.annotationPreviewKindChip, { borderColor: hexToRgba(GOLD, 0.24) }]}>
          <Text style={[s.annotationPreviewChipText, { color: '#9A7426' }]}>{kindLabel}</Text>
        </View>
      </View>

      <ScrollView
        nestedScrollEnabled
        style={compact ? s.annotationPreviewScrollCompact : undefined}
        showsVerticalScrollIndicator={false}
      >
        {lines.map((line, index) => (
          <View key={`${line}-${index}`}>
            <Text style={s.annotationPreviewQuote}>{`"${line}"`}</Text>
            {index < lines.length - 1 && <View style={s.annotationPreviewDivider} />}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function CommentPreviewModal({
  annotation,
  categories,
  verseRange,
  guidedReadOnly = false,
  onClose,
  onSave,
  onDelete,
}: {
  annotation: ScriptureAnnotation | null;
  categories: ColorCategory[];
  verseRange: string;
  guidedReadOnly?: boolean;
  onClose: () => void;
  onSave: (target: ScriptureAnnotation, newCommentHtml: string) => Promise<void> | void;
  onDelete: () => void;
}) {
  const insets = useSafeAreaInsets();
  const editorRef = useRef<RichTextEditorRef>(null);
  const scrollRef = useRef<ScrollView>(null);
  const toolbarYRef = useRef(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  // Holds the most-recently-saved comment HTML so the popup can keep showing
  // the updated text after Save without waiting for a new annotation prop.
  const [savedDraft, setSavedDraft] = useState<string | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [fmt, setFmt] = useState<FormatState>({ bold: false, italic: false, underline: false });
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const discardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const annotationId = annotation?.id;

  // Reset every time a different annotation is opened
  useEffect(() => {
    setEditing(false);
    setSavedDraft(null);
    setKeyboardOpen(false);
    setConfirmDeleteOpen(false);
    setDiscardConfirmOpen(false);
    if (discardTimerRef.current) {
      clearTimeout(discardTimerRef.current);
      discardTimerRef.current = null;
    }
    setDraft(annotation?.comment ?? '');
    setEditorKey(k => k + 1);
  }, [annotationId]);

  // Keyboard listeners only matter while editing
  useEffect(() => {
    if (!editing) return;
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, () => {
      setKeyboardOpen(true);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y: Math.max(0, toolbarYRef.current - 4), animated: true });
      });
    });
    const hideSub = Keyboard.addListener(hideEvt, () => {
      setKeyboardOpen(false);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [editing]);

  if (!annotation) return null;

  const accent = getAnnotationColorHex(annotation.color);
  const categoryLabel = getAnnotationCategoryLabel(categories, annotation.color);
  const quoteLines = splitQuoteLines(annotation.text);

  // Comment to display in view mode — prefer the in-session saved draft
  const displayedComment = savedDraft ?? annotation.comment ?? '';
  const hasUnsavedEditChanges = editing
    && normalizeCommentForDirtyCheck(draft) !== normalizeCommentForDirtyCheck(displayedComment);

  const handleStartEdit = () => {
    setDraft(displayedComment);
    setEditorKey(k => k + 1);
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    const cleanCheck = plainRichText(draft).trim();
    if (!cleanCheck) return;
    await onSave(annotation, draft);
    setSavedDraft(draft);
    setEditing(false);
    setKeyboardOpen(false);
    Keyboard.dismiss();
  };

  const requestPreviewClose = () => {
    if (hasUnsavedEditChanges) {
      if (discardTimerRef.current) clearTimeout(discardTimerRef.current);
      editorRef.current?.blur();
      Keyboard.dismiss();
      discardTimerRef.current = setTimeout(() => {
        setDiscardConfirmOpen(true);
        discardTimerRef.current = null;
      }, keyboardOpen ? (Platform.OS === 'ios' ? 280 : 170) : 0);
      return;
    }
    onClose();
  };

  const discardPreviewChanges = () => {
    setDiscardConfirmOpen(false);
    setDraft(displayedComment);
    setEditing(false);
    setKeyboardOpen(false);
    Keyboard.dismiss();
    onClose();
  };

  return (
    <Modal transparent visible animationType="fade" onRequestClose={requestPreviewClose} statusBarTranslucent>
      <KeyboardAvoidingView
        style={[
          s.previewOverlay,
          { paddingTop: Math.max(insets.top + 14, 36), paddingBottom: Math.max(insets.bottom + 14, 28) },
        ]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={StyleSheet.absoluteFill} pointerEvents="none" />
        <View style={[s.previewCard, { borderTopColor: accent }]}>
          <View style={s.previewHeader}>
            <View style={[s.previewChip, { backgroundColor: accent }]}>
              <Text style={s.previewChipText}>{categoryLabel}</Text>
            </View>
            <Text numberOfLines={1} style={s.previewRef}>{verseRange}</Text>
            <TouchableOpacity onPress={requestPreviewClose} style={s.previewClose} activeOpacity={0.82} hitSlop={6}>
              <X s={16} c="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <ScrollView
            ref={scrollRef}
            style={s.previewScroll}
            contentContainerStyle={s.previewScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <AnnotationPreviewCard
              color={annotation.color}
              categories={categories}
              kindLabel="COMMENT"
              quoteLines={quoteLines}
            />

            {editing ? (
              <>
                <View onLayout={e => { toolbarYRef.current = e.nativeEvent.layout.y; }}>
                  <RichToolbar editorRef={editorRef} activeFormats={fmt} style={s.commentToolbar} />
                </View>
                <View style={[s.commentEditorBox, keyboardOpen && s.commentEditorBoxCompact]}>
                  <RichTextEditor
                    key={editorKey}
                    ref={editorRef}
                    initialHTML={draft}
                    onChange={setDraft}
                    onFormatChange={setFmt}
                    placeholder="Write your reflection..."
                    backgroundColor="#FFFDF8"
                    color="#3D3229"
                  />
                </View>
              </>
            ) : (
              <View style={s.previewCommentBox}>
                <RichCommentText html={displayedComment} color="#1C1917" />
              </View>
            )}
          </ScrollView>

          {guidedReadOnly ? (
            <View style={s.previewActions}>
              <TouchableOpacity onPress={onClose} activeOpacity={0.86} style={[s.previewEdit, { flex: 1 }]}>
                <Text style={s.previewEditText}>CONTINUE</Text>
              </TouchableOpacity>
            </View>
          ) : editing ? (
            <TouchableOpacity onPress={handleSaveEdit} style={s.commentSave} activeOpacity={0.85}>
              <Text style={s.commentSaveText}>SAVE CHANGES</Text>
            </TouchableOpacity>
          ) : (
            <View style={s.previewActions}>
              <TouchableOpacity onPress={handleStartEdit} activeOpacity={0.86} style={s.previewEdit}>
                <Pencil s={14} c="#FFFFFF" w={2.4} />
                <Text style={s.previewEditText}>EDIT</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setConfirmDeleteOpen(true)}
                activeOpacity={0.86}
                style={s.previewDelete}
              >
                <Text style={s.previewDeleteText}>DELETE</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      <ConfirmModal
        visible={confirmDeleteOpen}
        embedded
        icon={<Trash2 s={22} c={C.red} w={2.2} />}
        iconBg="#FEF2F2"
        title="Delete this comment?"
        body="This comment will be permanently removed."
        cancelLabel="CANCEL"
        confirmLabel="DELETE"
        confirmColor={C.red}
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={() => {
          setConfirmDeleteOpen(false);
          onDelete();
        }}
      />
      <ConfirmModal
        visible={discardConfirmOpen}
        embedded
        icon={<X s={22} c={C.red} w={2.35} />}
        iconBg="#FEF2F2"
        title="Delete changes?"
        body="Your edited comment has not been saved. Delete these changes and keep the original comment?"
        cancelLabel="CANCEL"
        confirmLabel="DELETE"
        confirmColor={C.red}
        onBackdropPress={() => setDiscardConfirmOpen(false)}
        onCancel={() => setDiscardConfirmOpen(false)}
        onConfirm={discardPreviewChanges}
      />
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  guidedInteractionShield: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 90,
    backgroundColor: 'transparent',
  },
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: BG },
  loadingText: { marginTop: 12, fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2, color: C.textMuted, textTransform: 'uppercase' },
  headerActions: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  headerIconBtn: { width: 38, height: 44, alignItems: 'center', justifyContent: 'center' },
  chapterBar: {
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(17,24,39,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chapterBtn: { width: 38, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17 },
  chapterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: 'rgba(190,18,60,0.05)',
  },
  chapterPillDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(190,18,60,0.32)' },
  chapterTitle: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 3.6, color: ROSE },
  content: { paddingHorizontal: 14, paddingTop: 24 },
  chapterTransition: { minHeight: 240 },
  chapterLoading: { paddingVertical: 70 },
  emptyChapter: {
    marginTop: 70,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.22)',
    backgroundColor: '#FFFEFA',
    paddingHorizontal: 22,
    paddingVertical: 26,
    alignItems: 'center',
    gap: 8,
  },
  emptyChapterTitle: {
    marginTop: 4,
    fontFamily: F.serifMedium,
    fontSize: 21,
    color: '#2F2B27',
  },
  emptyChapterText: {
    fontFamily: F.serif,
    fontSize: 15,
    lineHeight: 21,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  verseList: { gap: 9 },
  verseRow: { flexDirection: 'row', gap: 7, borderRadius: 14, paddingVertical: 3, paddingHorizontal: 2, borderWidth: 1, borderColor: 'transparent' },
  verseRowSelected: { borderColor: 'rgba(197,160,89,0.38)', backgroundColor: '#FFFEF9' },
  verseRowFocused: {},
  verseMarker: { width: 20, alignItems: 'flex-end', paddingTop: 6 },
  verseNum: {
    width: 20,
    textAlign: 'right',
    fontFamily: F.sansBold,
    fontSize: 10,
    color: 'rgba(190,18,60,0.55)',
    letterSpacing: 0.3,
    paddingTop: 3,
  },
  selectCircle: {
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 1.2,
    borderColor: 'rgba(197,160,89,0.36)',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectCircleActive: { backgroundColor: GOLD, borderColor: GOLD },
  verseBody: { flex: 1, position: 'relative' },
  verseTextWrap: {
    alignSelf: 'stretch',
    borderRadius: 8,
  },
  verseTextWrapMarked: { paddingRight: 31 },
  verseHighlightWrap: {
    borderBottomWidth: 2,
    marginLeft: -2,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  verseText: { fontFamily: F.serif, fontSize: 21, lineHeight: 28, color: '#1F1F1F', letterSpacing: 0.1 },
  extraColorTray: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEFCF9',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 3,
    maxWidth: '100%',
  },
  extraColorLabel: {
    fontFamily: F.sansBold,
    fontSize: 8,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: '#C4BDB5',
  },
  extraColorChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  extraColorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  extraColorDot: { width: 6, height: 6, borderRadius: 3 },
  extraColorChipText: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 0.8 },
  commentStarBadge: {
    position: 'absolute',
    top: 2,
    right: 1,
    zIndex: 3,
    width: 27,
    height: 27,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  pencilFabWrap: {
    position: 'absolute',
    right: 15,
    zIndex: 30,
    elevation: 30,
  },
  pencilFab: {
    minHeight: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(216,183,102,0.72)',
    backgroundColor: '#2F281D',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 6,
    paddingRight: 14,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.20,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    elevation: 12,
  },
  pencilFabIcon: {
    width: 35,
    height: 35,
    borderRadius: 18,
    backgroundColor: '#D8B766',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.34)',
  },
  pencilFabCopy: {
    minWidth: 76,
    justifyContent: 'center',
  },
  pencilFabLabel: {
    fontFamily: F.sansBold,
    fontSize: 10.5,
    letterSpacing: 1.65,
    color: '#FFF8E8',
    textTransform: 'uppercase',
  },
  pencilFabHint: {
    marginTop: 1,
    fontFamily: F.serif,
    fontSize: 12.5,
    lineHeight: 15,
    color: 'rgba(255,248,232,0.72)',
  },
  selectionOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.08)', position: 'relative' },
  selectionSheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: '#FFFFFF',
    paddingTop: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: -12 },
    shadowRadius: 60,
    elevation: 14,
  },
  selectionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 8 },
  selectionChipWrap: { flex: 1, minWidth: 0, minHeight: 38 },
  selectionChipContent: { paddingRight: 10, paddingBottom: 4 },
  selectionEditorLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    elevation: 40,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 23,
    paddingTop: 76,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  selectionEditorCard: {
    maxHeight: '62%',
  },
  selectionColorWrap: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  selectionColorBtn: {
    width: 39,
    height: 39,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionColorDot: { width: 17, height: 17, borderRadius: 9 },
  sheetCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetDivider: { height: 1, backgroundColor: '#F1F5F9', marginTop: 14, marginBottom: 11 },
  selectionActionCard: {
    minHeight: 74,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 2,
  },
  highlightIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 1,
  },
  highlightKicker: { fontFamily: F.sansBold, fontSize: 9.5, letterSpacing: 2.35 },
  highlightTitle: { marginTop: 2, fontFamily: F.serifMedium, fontSize: 20, lineHeight: 23, color: '#2F2B27' },
  selectionCount: { marginTop: 4, fontFamily: F.sansBold, fontSize: 8.8, letterSpacing: 1.35, color: '#9CA3AF', textTransform: 'uppercase' },
  selectionActionArrow: {
    width: 31,
    height: 31,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  sheetActionCopy: { flex: 1, minWidth: 0 },
  commentAction: {
    marginTop: 10,
  },
  actionOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.18)' },
  actionSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#fff', padding: 20, paddingBottom: 30 },
  actionHandle: { width: 44, height: 4, borderRadius: 2, backgroundColor: '#E7E5E4', alignSelf: 'center', marginBottom: 14 },
  actionRef: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2, color: GOLD, textAlign: 'center', textTransform: 'uppercase' },
  actionText: { marginTop: 8, fontFamily: F.serif, fontSize: 17, lineHeight: 24, color: '#3D3229', textAlign: 'center' },
  actionKicker: { marginTop: 18, marginBottom: 10, fontFamily: F.sansBold, fontSize: 9, letterSpacing: 2, color: '#A8A29E', textAlign: 'center' },
  colorRow: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  colorDot: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18 },
  actionBtn: { width: '48%', height: 44, borderRadius: 16, borderWidth: 1, borderColor: '#E8DCC4', backgroundColor: '#FFFDF8', alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.4, color: '#7C5E22', textTransform: 'uppercase' },
  commentOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    backgroundColor: 'rgba(0,0,0,0.40)',
  },
  commentCard: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '100%',
    flexShrink: 1,
    flexDirection: 'column',
    borderRadius: 26,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowOffset: { width: 0, height: 16 },
    shadowRadius: 38,
    elevation: 18,
  },
  commentScroll: { flexShrink: 1, flexGrow: 0 },
  commentScrollContent: { paddingBottom: 4 },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    marginBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEEFF2',
  },
  commentTitle: { flex: 1, fontFamily: F.serifMedium, fontSize: 19, color: '#111827', marginRight: 12 },
  commentCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F4F5F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentQuoteBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ECEFF3',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 17,
  },
  commentQuoteText: {
    borderLeftWidth: 2,
    borderLeftColor: '#D7DBE1',
    paddingLeft: 13,
    fontFamily: F.serifItalic,
    fontSize: 16,
    lineHeight: 24,
    color: '#5B6472',
  },
  commentTagLabel: {
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 2.1,
    color: '#A0A7B2',
    marginBottom: 10,
  },
  commentChipContent: { paddingRight: 10, paddingBottom: 3 },
  commentColorShell: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#EEF0F4',
    backgroundColor: '#FAFAFB',
    padding: 8,
  },
  commentColorBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 1,
  },
  commentColorDot: {
    width: 23,
    height: 23,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentColorInner: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' },
  commentToolbar: { marginTop: 14, marginBottom: 10 },
  commentVerseCard: {
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    marginBottom: 16,
  },
  commentVerseTags: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  commentVerseDot: { width: 10, height: 10, borderRadius: 5 },
  commentVerseChip: {
    minHeight: 24,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentVerseChipText: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 1.7,
    textTransform: 'uppercase',
  },
  commentVerseRef: {
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 1.7,
    color: '#C0B8AE',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  commentVerseQuoteBlock: { paddingHorizontal: 2 },
  commentVerseLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  commentVerseNum: {
    minWidth: 20,
    paddingTop: 4,
    fontFamily: F.sansBold,
    fontSize: 10,
    color: 'rgba(190,18,60,0.45)',
    textAlign: 'right',
  },
  commentVerseText: {
    flex: 1,
    fontFamily: F.serifItalic,
    fontSize: 16,
    lineHeight: 25,
    color: '#4B5563',
  },
  commentVerseTextIndented: { flex: 1 },
  commentVerseDivider: { height: 1, backgroundColor: '#E7EAF0', marginVertical: 11 },
  commentVerseSeeMore: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10, alignSelf: 'flex-start' },
  commentVerseSeeMoreText: { fontFamily: F.sansSemiBold, fontSize: 12, letterSpacing: 0.3 },
  commentVerseSeeMoreArrow: { fontSize: 18, lineHeight: 18, fontFamily: F.serifMedium },
  commentEditorBox: {
    height: 220,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#FFFDF8',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.18)',
  },
  commentEditorBoxCompact: { height: 170 },
  annotationPreviewCard: {
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingTop: 15,
    paddingBottom: 14,
    marginBottom: 18,
  },
  annotationPreviewCardCompact: {
    maxHeight: 174,
    marginBottom: 18,
  },
  annotationPreviewTags: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  annotationPreviewDot: { width: 11, height: 11, borderRadius: 6 },
  annotationPreviewChip: {
    minHeight: 26,
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  annotationPreviewKindChip: { backgroundColor: '#FFF7EA' },
  annotationPreviewChipText: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 1.9,
    textTransform: 'uppercase',
  },
  annotationPreviewScrollCompact: { maxHeight: 103 },
  annotationPreviewQuote: {
    fontFamily: F.serifItalic,
    fontSize: 17,
    lineHeight: 27,
    color: '#4B5563',
  },
  annotationPreviewDivider: {
    height: 1,
    backgroundColor: '#E7EAF0',
    marginVertical: 13,
  },
  commentSave: {
    height: 44,
    borderRadius: 14,
    backgroundColor: '#1C1917',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  commentSaveText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 1.8, color: '#fff' },
  previewOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  previewCard: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '100%',
    flexShrink: 1,
    flexDirection: 'column',
    borderRadius: 26,
    borderTopWidth: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 18 },
    shadowRadius: 42,
    elevation: 20,
  },
  previewScroll: { flexShrink: 1 },
  previewScrollContent: { paddingBottom: 4 },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingBottom: 10,
    marginBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEEFF2',
  },
  previewChip: {
    maxWidth: 130,
    minHeight: 22,
    borderRadius: 11,
    paddingHorizontal: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewChipText: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 1.5,
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  previewRef: {
    flex: 1,
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 1.7,
    color: '#A0A7B2',
  },
  previewClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F4F5F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewQuote: {
    fontFamily: F.serifItalic,
    fontSize: 18,
    lineHeight: 29,
    color: '#697386',
    marginBottom: 24,
  },
  previewCommentBox: {
    borderRadius: 18,
    backgroundColor: '#F8F8FA',
    borderWidth: 1,
    borderColor: '#F0F1F4',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  previewActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  previewEdit: {
    flex: 1.4,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#1C1917',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  previewEditText: {
    fontFamily: F.sansBold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: '#FFFFFF',
  },
  previewDelete: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFF1F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewDeleteText: {
    fontFamily: F.sansBold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: '#DC2626',
  },
});
