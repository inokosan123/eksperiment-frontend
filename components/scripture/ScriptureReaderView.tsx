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
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
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
import { BibleVerse, ScriptureAnnotation, useScripture } from './ScriptureContext';
import { HapticTouchableOpacity as TouchableOpacity, HapticPressable as Pressable } from '@/components/shared/HapticTouch';


const BG = '#FCFCFC';
const GOLD = '#C5A059';
const ROSE = '#BE123C';

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
}: ScriptureReaderViewProps = {}) {
  const router = useRouter();
  const params = useLocalSearchParams<{ bookId?: string; chapter?: string; verse?: string; lang?: ScriptureLanguage; editCommentId?: string }>();
  const insets = useSafeAreaInsets();
  const { settings } = useAppSettings();
  const {
    ready, annotations, categories, getChapter, upsertAnnotation, deleteAnnotation, updateCategory,
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
  const [colorEditorOpen, setColorEditorOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const verseLayoutYRef = useRef<Record<number, number>>({});
  const handledInitialScrollKeyRef = useRef<string | null>(null);

  const currentBook = getBibleBook(bookId) ?? BIBLE_BOOKS[41];
  const currentAnnotations = useMemo(
    () => annotations.filter(annotation => annotation.bookId === bookId && annotation.chapter === chapter),
    [annotations, bookId, chapter],
  );
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
    () => selectedVerses.some(verse =>
      annotations.some(annotation =>
        annotation.kind === 'comment'
        && annotation.bookId === verse.bookId
        && annotation.chapter === verse.chapter
        && annotation.verse === verse.verse)),
    [annotations, selectedVerses],
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
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    });
  }, [bookId, chapter]);

  const scrollToInitialVerse = useCallback(() => {
    if (!initialScrollKey || handledInitialScrollKeyRef.current === initialScrollKey || loading || chapterError) return;
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
  }, [chapterError, initialScrollKey, loading, targetInitialVerse, verses]);

  useEffect(() => {
    scrollToInitialVerse();
  }, [scrollToInitialVerse]);

  const handleVerseLayout = useCallback((verseNumber: number, y: number) => {
    verseLayoutYRef.current[verseNumber] = y;
    if (verseNumber === targetInitialVerse) scrollToInitialVerse();
  }, [scrollToInitialVerse, targetInitialVerse]);

  const handledEditCommentIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!ready || loading) return;
    const editId = params.editCommentId;
    if (!editId || handledEditCommentIdRef.current === editId) return;
    const target = annotations.find(annotation => annotation.id === editId && annotation.kind === 'comment');
    if (!target) return;
    handledEditCommentIdRef.current = editId;
    startEditFlow(target);
    router.setParams({ editCommentId: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, loading, annotations, params.editCommentId]);

  const clearSelection = useCallback(() => {
    setSelectedVerseNumbers([]);
    setActionSheetOpen(false);
    setCommentOpen(false);
    setCommentDraft('');
    setCommentMode('add');
  }, []);

  useEffect(() => {
    if (typeof controlledBookId !== 'number' && typeof controlledChapter !== 'number') return;
    clearSelection();
  }, [clearSelection, controlledBookId, controlledChapter]);

  const goChapter = useCallback((next: number) => {
    const bounded = Math.max(1, Math.min(currentBook.chapters, next));
    if (bounded === chapter) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLocalChapter(bounded);
    clearSelection();
  }, [chapter, clearSelection, currentBook.chapters]);

  const startSelection = (verse: BibleVerse) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedVerseNumbers([verse.verse]);
    setActionSheetOpen(false);
  };

  const toggleSelection = (verse: BibleVerse) => {
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
    const joinedText = selectedVerses.map(verse => verse.text).join('\n\n');
    for (const verse of selectedVerses) {
      // Only replace same-color highlight — preserve other colors
      const sameColor = annotations.find(annotation =>
        annotation.kind === 'highlight'
        && annotation.bookId === verse.bookId
        && annotation.chapter === verse.chapter
        && annotation.verse === verse.verse
        && annotation.color === selectedColor);
      if (sameColor) await deleteAnnotation(sameColor.id);
      await upsertAnnotation({
        kind: 'highlight',
        color: selectedColor,
        bookId: verse.bookId,
        chapter: verse.chapter,
        verse: verse.verse,
        text: joinedText,
      });
    }
    clearSelection();
  };

  const openComment = () => {
    if (selectedVerses.length === 0) return;
    if (hasCommentOverlap) return;
    setCommentDraft('');
    setCommentMode('add');
    setCommentSession(value => value + 1);
    setActionSheetOpen(false);
    setCommentOpen(true);
  };

  const saveComment = async () => {
    const cleanComment = commentDraft.trim();
    if (selectedVerses.length === 0 || !plainRichText(cleanComment)) return;
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
    clearSelection();
  };

  const openCommentPreview = (annotation: ScriptureAnnotation) => {
    Haptics.selectionAsync();
    setViewingComment(annotation);
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
    const groupedComments = getGroupedCommentAnnotations(target);
    const verseNumbers = groupedComments
      .map(annotation => annotation.verse)
      .sort((a, b) => a - b);
    setSelectedVerseNumbers(verseNumbers.length > 0 ? verseNumbers : [target.verse]);
    setSelectedColor(target.color);
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
    router.push({
      pathname: '/bible-notes',
      params: { bookId: String(bookId), chapter: String(chapter), open: '1' },
    });
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    router.back();
  };

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
  const selectionFabBottom = insets.bottom + (hasBottomDock ? 92 : 0);
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
        onFavorites={() => router.push('/favorites')}
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
              {verses.map(verse => (
                <View
                  key={verse.verse}
                  onLayout={event => handleVerseLayout(verse.verse, event.nativeEvent.layout.y)}
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
                  />
                </View>
              ))}
            </View>
          )}
        </Reanimated.View>
      </ScrollView>

      {bottomDock}

      <SelectionTools
        visible={selectionActive}
        sheetOpen={actionSheetOpen}
        fabBottom={selectionFabBottom}
        sheetBottom={selectionSheetBottom}
        categories={categories}
        selectedColor={selectedColor}
        selectedCount={selectedVerses.length}
        commentDisabled={hasCommentOverlap}
        onOpenSheet={() => setActionSheetOpen(true)}
        onClose={clearSelection}
        onCloseSheet={() => setActionSheetOpen(false)}
        onSelectColor={setSelectedColor}
        onHighlight={applyHighlight}
        onComment={openComment}
        onEditColors={() => setColorEditorOpen(true)}
        colorEditorOpen={colorEditorOpen}
        onCloseColorEditor={() => setColorEditorOpen(false)}
        onSaveCategory={updateCategory}
      />

      <CommentModal
        editorKey={`scripture-comment-${commentSession}`}
        visible={commentOpen}
        mode={commentMode}
        value={commentDraft}
        verseTexts={selectedVerses.map(verse => ({ verse: verse.verse, text: verse.text }))}
        verseRange={selectedVerses.length > 0
          ? `${currentBook.name.toUpperCase()} ${chapter}:${selectedVerses[0].verse}${selectedVerses.length > 1 ? `-${selectedVerses[selectedVerses.length - 1].verse}` : ''}`
          : ''}
        categories={categories}
        selectedColor={selectedColor}
        onSelectColor={setSelectedColor}
        onEditColors={() => setColorEditorOpen(true)}
        onValue={setCommentDraft}
        onClose={() => setCommentOpen(false)}
        onSave={saveComment}
      />

      <CommentPreviewModal
        annotation={viewingComment}
        categories={categories}
        verseRange={getCommentVerseRange(viewingComment)}
        onClose={() => setViewingComment(null)}
        onSave={saveViewingCommentEdit}
        onDelete={deleteViewingComment}
      />

      <CategoryEditorModal
        visible={colorEditorOpen && !(selectionActive && actionSheetOpen)}
        categories={categories}
        onClose={() => setColorEditorOpen(false)}
        onSaveCategory={updateCategory}
      />

    </View>
  );
}

function Header({
  title, onBack, onBibleNote, onFavorites,
}: {
  title: string;
  onBack: () => void;
  onBibleNote: () => void;
  onFavorites: () => void;
}) {
  return (
    <ScreenTitleBar
      title={title.toUpperCase()}
      showBack
      bg={BG}
      onBackOverride={onBack}
      sideWidth={88}
      rightElement={(
        <View style={s.headerActions}>
          <TouchableOpacity onPress={onBibleNote} style={s.headerIconBtn} activeOpacity={0.7}>
            <Notebook s={20} c="#9CA3AF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onFavorites} style={s.headerIconBtn} activeOpacity={0.7}>
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
  verse, annotations, categories, selected, selectionActive, autoFocus, onPress, onLongPress, onOpenComment,
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
  const pressMotion = useSharedValue(0);

  useEffect(() => {
    selectedMotion.value = withSpring(selected ? 1 : 0, {
      damping: 18,
      stiffness: 230,
      mass: 0.72,
    });
  }, [selected, selectedMotion]);

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

  return (
    <GestureDetector gesture={rowGesture}>
      <Reanimated.View
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
        <View
          style={[
            s.verseTextWrap,
            markerAccent && !selectionActive && s.verseTextWrapMarked,
            highlightAccent && [
              s.verseHighlightWrap,
              {
                backgroundColor: hexToRgba(highlightAccent, 0.15),
                borderBottomColor: hexToRgba(highlightAccent, 0.30),
              },
            ],
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

        </View>

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
  fabBottom,
  sheetBottom,
  categories,
  selectedColor,
  selectedCount,
  commentDisabled,
  onOpenSheet,
  onClose,
  onCloseSheet,
  onSelectColor,
  onHighlight,
  onComment,
  onEditColors,
  colorEditorOpen,
  onCloseColorEditor,
  onSaveCategory,
}: {
  visible: boolean;
  sheetOpen: boolean;
  fabBottom: number;
  sheetBottom: number;
  categories: ColorCategory[];
  selectedColor: HighlightColor;
  selectedCount: number;
  commentDisabled: boolean;
  onOpenSheet: () => void;
  onClose: () => void;
  onCloseSheet: () => void;
  onSelectColor: (color: HighlightColor) => void;
  onHighlight: () => void;
  onComment: () => void;
  onEditColors: () => void;
  colorEditorOpen: boolean;
  onCloseColorEditor: () => void;
  onSaveCategory: (color: HighlightColor, label: string) => Promise<void> | void;
}) {
  if (!visible) return null;

  const accent = getAnnotationColorHex(selectedColor);
  const categoryLabel = getAnnotationCategoryLabel(categories, selectedColor);

  if (!sheetOpen) {
    return (
      <TouchableOpacity
        onPress={onOpenSheet}
        activeOpacity={0.88}
        style={[s.pencilFabWrap, { bottom: fabBottom + 30 }]}
      >
        <View style={s.pencilFab}>
          <Pencil s={18} c={GOLD} w={2.3} />
        </View>
        <Text style={s.pencilFabLabel}>ANNOTATE</Text>
      </TouchableOpacity>
    );
  }

  return (
    <SmoothBottomSheet
      visible={sheetOpen}
      onClose={onCloseSheet}
      overlayStyle={s.selectionOverlay}
      backdropOpacity={0.08}
      sheetStyle={[s.selectionSheet, { paddingBottom: Math.max(sheetBottom, 16) + 12 }]}
      overlayChildren={colorEditorOpen ? (
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
    >
          <View style={s.actionHandle} />

          <View style={s.selectionTop}>
            <View style={s.selectionChipWrap}>
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

          <TouchableOpacity
            onPress={onHighlight}
            activeOpacity={0.88}
            style={[
              s.highlightAction,
              {
                borderColor: hexToRgba(accent, 0.22),
                backgroundColor: hexToRgba(accent, 0.08),
              },
            ]}
          >
            <View style={s.highlightIconCircle}>
              <Pencil s={18} c={accent} w={2.4} />
            </View>
            <View style={s.sheetActionCopy}>
              <Text style={[s.highlightKicker, { color: accent }]}>HIGHLIGHT</Text>
              <Text style={[s.highlightTitle, { color: accent }]}>Highlight as {categoryLabel}</Text>
              {selectedCount > 1 && <Text style={s.selectionCount}>{selectedCount} verses selected</Text>}
            </View>
            <View style={[s.highlightAccent, { backgroundColor: hexToRgba(accent, 0.52) }]} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={commentDisabled ? undefined : onComment}
            activeOpacity={commentDisabled ? 1 : 0.88}
            disabled={commentDisabled}
            style={[
              s.commentAction,
              commentDisabled
                ? { borderColor: '#E5E7EB', backgroundColor: '#F6F6F7', opacity: 0.55 }
                : {
                    borderColor: hexToRgba(accent, 0.22),
                    backgroundColor: '#FFFFFF',
                  },
            ]}
          >
            <View
              style={[
                s.highlightIconCircle,
                commentDisabled && { backgroundColor: '#ECECEE' },
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
          </TouchableOpacity>
    </SmoothBottomSheet>
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

  useEffect(() => {
    if (!visible) {
      setVersesExpanded(false);
      setKeyboardOpen(false);
    }
  }, [visible]);

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

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        style={[
          s.commentOverlay,
          { paddingTop: Math.max(insets.top + 14, 36), paddingBottom: Math.max(insets.bottom + 14, 28) },
        ]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={StyleSheet.absoluteFill} pointerEvents="none" />
        <View style={s.commentCard}>
          <View style={s.commentHeader}>
            <Text style={s.commentTitle} numberOfLines={1}>{mode === 'edit' ? 'Edit Comment' : 'Add Comment'}</Text>
            <TouchableOpacity onPress={onClose} style={s.commentCloseBtn} activeOpacity={0.85} hitSlop={6}>
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
            />
          </View>
          </ScrollView>

          <TouchableOpacity onPress={onSave} style={s.commentSave} activeOpacity={0.85}>
            <Text style={s.commentSaveText}>SAVE COMMENT</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  onClose,
  onSave,
  onDelete,
}: {
  annotation: ScriptureAnnotation | null;
  categories: ColorCategory[];
  verseRange: string;
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

  const annotationId = annotation?.id;

  // Reset every time a different annotation is opened
  useEffect(() => {
    setEditing(false);
    setSavedDraft(null);
    setKeyboardOpen(false);
    setConfirmDeleteOpen(false);
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

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
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
            <TouchableOpacity onPress={onClose} style={s.previewClose} activeOpacity={0.82} hitSlop={6}>
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

          {editing ? (
            <TouchableOpacity onPress={handleSaveEdit} style={s.commentSave} activeOpacity={0.85}>
              <Text style={s.commentSaveText}>SAVE COMMENT</Text>
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
        icon={<Trash2 s={22} c="#EF4444" w={2.2} />}
        iconBg="#FEF2F2"
        title="Delete this comment?"
        body="This comment will be permanently removed."
        cancelLabel="CANCEL"
        confirmLabel="DELETE"
        confirmColor="#EF4444"
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={() => {
          setConfirmDeleteOpen(false);
          onDelete();
        }}
      />
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
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
  verseText: { fontFamily: F.serif, fontSize: 21, lineHeight: 32, color: '#1F1F1F', letterSpacing: 0.1 },
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
    right: 22,
    alignItems: 'center',
  },
  pencilFab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1.5,
    borderColor: 'rgba(197,160,89,0.40)',
    backgroundColor: '#FFFDF7',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 18,
    elevation: 8,
  },
  pencilFabLabel: {
    marginTop: 6,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: GOLD,
    backgroundColor: '#FFFDF7',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.40)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 3,
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
  sheetDivider: { height: 1, backgroundColor: '#F1F5F9', marginTop: 15, marginBottom: 13 },
  highlightAction: {
    minHeight: 78,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    overflow: 'hidden',
  },
  highlightIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 1,
  },
  highlightKicker: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.6 },
  highlightTitle: { marginTop: 2, fontFamily: F.serif, fontSize: 21, lineHeight: 24 },
  selectionCount: { marginTop: 3, fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.4, color: '#9CA3AF', textTransform: 'uppercase' },
  highlightAccent: { width: 26, height: 26, borderRadius: 13, marginLeft: 'auto' },
  sheetActionCopy: { flex: 1, minWidth: 0 },
  commentAction: {
    minHeight: 78,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    overflow: 'hidden',
    marginTop: 12,
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
