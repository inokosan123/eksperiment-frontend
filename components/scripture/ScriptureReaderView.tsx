import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft, CheckSmall, ChevronLeft, ChevronRight, CircleIcon, FileEdit, Notebook, Pencil, Star, X,
} from '@/components/icons/Icons';
import {
  getAnnotationCategoryLabel, getAnnotationColorHex, hexToRgba, HighlightColor,
  ColorCategory,
} from '@/constants/annotationColors';
import { BIBLE_BOOKS, getBibleBook, ScriptureLanguage } from '@/constants/scripture';
import { C, F } from '@/constants/tokens';
import { getTitleBarTopPadding, TITLE_BAR_BOTTOM_PADDING } from '@/components/shared/titleBar';
import { FormatState, RichTextEditor, RichTextEditorRef, RichToolbar } from '@/components/shared/RichTextEditor';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import { InnerNote, NoteKind, NoteSourceRef, useInnerTools } from '@/components/inner-tools/InnerToolsContext';
import { CategoryChipPicker, CategoryEditorModal, CategoryEditorPanel } from './CategoryColorTools';
import { BibleVerse, ScriptureAnnotation, useScripture } from './ScriptureContext';

const BG = '#FCFCFC';
const GOLD = '#C5A059';
const ROSE = '#BE123C';
const NOTE_QUOTE_MARKER = '\n\n[[ANASTA_QUOTE]]\n\n';

function newNoteId() {
  return `scripture_note_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export default function ScriptureReaderView() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bookId?: string; chapter?: string; verse?: string; lang?: ScriptureLanguage }>();
  const insets = useSafeAreaInsets();
  const {
    ready, annotations, categories, getChapter, upsertAnnotation, deleteAnnotation, updateCategory,
  } = useScripture();
  const { notes, upsertNote } = useInnerTools();

  const initialBookId = Number(params.bookId) || 42;
  const initialChapter = Number(params.chapter) || 3;
  const initialVerse = Number(params.verse) || 0;
  const lang = params.lang ?? 'en';

  const [bookId] = useState(initialBookId);
  const [chapter, setChapter] = useState(initialChapter);
  const [showFocus, setShowFocus] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShowFocus(false), 1500);
    return () => clearTimeout(t);
  }, []);
  const [verses, setVerses] = useState<BibleVerse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVerseNumbers, setSelectedVerseNumbers] = useState<number[]>([]);
  const [selectedColor, setSelectedColor] = useState<HighlightColor>('gold');
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentOpen, setCommentOpen] = useState(false);
  const [viewingComment, setViewingComment] = useState<ScriptureAnnotation | null>(null);
  const [colorEditorOpen, setColorEditorOpen] = useState(false);
  const [sendTypeOpen, setSendTypeOpen] = useState(false);
  const [notePickerType, setNotePickerType] = useState<NoteKind | null>(null);

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

  useEffect(() => {
    if (!ready) return;
    let active = true;
    setLoading(true);
    getChapter(bookId, chapter, lang)
      .then(nextVerses => {
        if (!active) return;
        setVerses(nextVerses);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [bookId, chapter, getChapter, lang, ready]);

  const goChapter = (next: number) => {
    const bounded = Math.max(1, Math.min(currentBook.chapters, next));
    if (bounded === chapter) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setChapter(bounded);
    clearSelection();
  };

  const clearSelection = () => {
    setSelectedVerseNumbers([]);
    setActionSheetOpen(false);
    setCommentOpen(false);
    setCommentDraft('');
  };

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
    const firstVerse = selectedVerses[0];
    if (!firstVerse) return;
    const existingComment = selectedVerses.length === 1
      ? annotations.find(annotation =>
        annotation.kind === 'comment'
        && annotation.bookId === firstVerse.bookId
        && annotation.chapter === firstVerse.chapter
        && annotation.verse === firstVerse.verse)
      : undefined;
    if (existingComment) setSelectedColor(existingComment.color);
    setCommentDraft(existingComment?.comment ?? '');
    setActionSheetOpen(false);
    setCommentOpen(true);
  };

  const saveComment = async () => {
    if (selectedVerses.length === 0 || !commentDraft.trim()) return;
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
        comment: commentDraft.trim(),
      });
    }
    clearSelection();
  };

  const openCommentPreview = (annotation: ScriptureAnnotation) => {
    Haptics.selectionAsync();
    setViewingComment(annotation);
  };

  const deleteViewingComment = async () => {
    if (!viewingComment) return;
    const groupedComments = annotations.filter(annotation =>
      annotation.kind === 'comment'
      && annotation.bookId === viewingComment.bookId
      && annotation.chapter === viewingComment.chapter
      && annotation.color === viewingComment.color
      && annotation.text === viewingComment.text
      && annotation.comment === viewingComment.comment);
    await Promise.all(groupedComments.map(annotation => deleteAnnotation(annotation.id)));
    setViewingComment(null);
  };

  const openBibleNote = () => {
    router.push({
      pathname: '/bible-notes',
      params: { bookId: String(bookId), chapter: String(chapter), open: '1' },
    });
  };

  const buildSelectedSourceRef = (): NoteSourceRef | null => {
    if (selectedVerses.length === 0) return null;
    const firstVerse = selectedVerses[0];
    const lastVerse = selectedVerses[selectedVerses.length - 1];
    const label = `${currentBook.name} ${chapter}:${firstVerse.verse}${lastVerse.verse !== firstVerse.verse ? `-${lastVerse.verse}` : ''}`;
    return {
      bookId,
      chapter,
      startVerse: firstVerse.verse,
      endVerse: lastVerse.verse,
      label,
      text: selectedQuoteLines.join('\n\n'),
      verseTexts: selectedVerses.map(verse => ({ verse: verse.verse, text: verse.text })),
    };
  };

  const openBibleNoteForSelection = () => {
    if (selectedVerses.length === 0) return;
    setActionSheetOpen(false);
    setSendTypeOpen(true);
  };

  const sendSelectionToNote = async (type: NoteKind, existingNote?: InnerNote) => {
    const sourceRef = buildSelectedSourceRef();
    if (!sourceRef) return;
    const noteId = newNoteId();
    const noteSourceRefs = existingNote
      ? existingNote.sourceRefs && existingNote.sourceRefs.length > 0
        ? existingNote.sourceRefs
        : existingNote.sourceRef ? [existingNote.sourceRef] : []
      : [];
    const targetId = existingNote?.id ?? noteId;

    await upsertNote({
      id: targetId,
      type,
      title: existingNote?.title ?? '',
      content: `${existingNote?.content ?? ''}${NOTE_QUOTE_MARKER}`,
      createdAt: existingNote?.createdAt ?? Date.now(),
      color: type === 'note' ? (existingNote?.color ?? 'white') : 'gold',
      sourceRef: noteSourceRefs[0] ?? sourceRef,
      sourceRefs: [...noteSourceRefs, sourceRef],
    });

    setSendTypeOpen(false);
    setNotePickerType(null);
    router.push({
      pathname: '/notes',
      params: { openNoteId: targetId },
    });
    clearSelection();
  };

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
        top={insets.top}
        title={currentBook.name}
        onBack={() => router.back()}
        onBibleNote={openBibleNote}
        onFavorites={() => router.push('/favorites')}
      />

      <ChapterBar
        chapter={chapter}
        canGoPrev={chapter > 1}
        canGoNext={chapter < currentBook.chapters}
        onPrev={() => goChapter(chapter - 1)}
        onNext={() => goChapter(chapter + 1)}
      />

      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={s.chapterLoading}>
            <ActivityIndicator color={GOLD} />
          </View>
        ) : (
          <View style={s.verseList}>
            {verses.map(verse => (
              <VerseRow
                key={verse.verse}
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
            ))}
          </View>
        )}
      </ScrollView>

      <SelectionTools
        visible={selectionActive}
        sheetOpen={actionSheetOpen}
        bottom={insets.bottom}
        categories={categories}
        selectedColor={selectedColor}
        selectedCount={selectedVerses.length}
        onOpenSheet={() => setActionSheetOpen(true)}
        onClose={clearSelection}
        onCloseSheet={() => setActionSheetOpen(false)}
        onSelectColor={setSelectedColor}
        onHighlight={applyHighlight}
        onComment={openComment}
        onBibleNote={openBibleNoteForSelection}
        onEditColors={() => setColorEditorOpen(true)}
        colorEditorOpen={colorEditorOpen}
        onCloseColorEditor={() => setColorEditorOpen(false)}
        onSaveCategory={updateCategory}
      />

      <CommentModal
        visible={commentOpen}
        value={commentDraft}
        quoteLines={selectedQuoteLines}
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
        bookName={viewingComment ? (getBibleBook(viewingComment.bookId)?.name ?? currentBook.name) : currentBook.name}
        onClose={() => setViewingComment(null)}
        onDelete={deleteViewingComment}
      />

      <CategoryEditorModal
        visible={colorEditorOpen && !(selectionActive && actionSheetOpen)}
        categories={categories}
        onClose={() => setColorEditorOpen(false)}
        onSaveCategory={updateCategory}
      />

      <SendToNotesModal
        visible={sendTypeOpen}
        onClose={() => setSendTypeOpen(false)}
        onChoose={type => {
          setSendTypeOpen(false);
          setNotePickerType(type);
        }}
      />

      <ChooseNoteModal
        visible={!!notePickerType}
        type={notePickerType ?? 'yellow'}
        notes={notes.filter(note => note.type === (notePickerType ?? 'yellow'))}
        onClose={() => setNotePickerType(null)}
        onNew={() => {
          if (notePickerType) sendSelectionToNote(notePickerType);
        }}
        onExisting={note => {
          if (notePickerType) sendSelectionToNote(notePickerType, note);
        }}
      />
    </View>
  );
}

function SendToNotesModal({
  visible,
  onClose,
  onChoose,
}: {
  visible: boolean;
  onClose: () => void;
  onChoose: (type: NoteKind) => void;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={s.sendOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.sendCard}>
          <Text style={s.sendKicker}>SEND TO</Text>
          <SendChoice
            title="Quick Help"
            subtitle="Save as a quick reference card"
            tone="gold"
            icon={<Notebook s={18} c={GOLD} />}
            onPress={() => onChoose('yellow')}
          />
          <SendChoice
            title="Note"
            subtitle="Create a detailed note"
            tone="stone"
            icon={<FileEdit s={18} c="#6B7280" />}
            onPress={() => onChoose('note')}
          />
        </View>
      </View>
    </Modal>
  );
}

function SendChoice({
  title,
  subtitle,
  tone,
  icon,
  onPress,
}: {
  title: string;
  subtitle: string;
  tone: 'gold' | 'stone';
  icon: React.ReactNode;
  onPress: () => void;
}) {
  const isGold = tone === 'gold';
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      style={[s.sendChoice, isGold ? s.sendChoiceGold : s.sendChoiceStone]}
    >
      <View style={[s.sendChoiceIcon, isGold ? s.sendChoiceIconGold : s.sendChoiceIconStone]}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={s.sendChoiceTitle}>{title}</Text>
        <Text style={s.sendChoiceSubtitle}>{subtitle}</Text>
      </View>
    </TouchableOpacity>
  );
}

function ChooseNoteModal({
  visible,
  type,
  notes,
  onClose,
  onNew,
  onExisting,
}: {
  visible: boolean;
  type: NoteKind;
  notes: InnerNote[];
  onClose: () => void;
  onNew: () => void;
  onExisting: (note: InnerNote) => void;
}) {
  const isQuick = type === 'yellow';
  const title = isQuick ? 'CHOOSE QUICK HELP' : 'CHOOSE NOTE';
  const newLabel = isQuick ? 'New Quick Help' : 'New Note';

  return (
    <SmoothBottomSheet visible={visible} onClose={onClose} sheetStyle={s.chooseSheet}>
          <View style={s.chooseHeader}>
            <TouchableOpacity onPress={onClose} activeOpacity={0.75} style={s.chooseBack}>
              <ArrowLeft s={20} c="#9CA3AF" />
            </TouchableOpacity>
            <Text style={s.chooseKicker}>{title}</Text>
            <View style={s.chooseBack} />
          </View>

          <TouchableOpacity onPress={onNew} activeOpacity={0.88} style={s.newNoteCard}>
            <View style={s.newNoteIcon}>
              <Text style={s.newNotePlus}>+</Text>
            </View>
            <Text style={s.newNoteTitle}>{newLabel}</Text>
          </TouchableOpacity>

          <Text style={s.existingLabel}>EXISTING</Text>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.existingList}>
            {notes.map(note => (
              <TouchableOpacity
                key={note.id}
                onPress={() => onExisting(note)}
                activeOpacity={0.88}
                style={s.existingCard}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.existingTitle} numberOfLines={1}>
                    {note.title || (isQuick ? 'Quick help' : 'Untitled note')}
                  </Text>
                  <Text style={s.existingDate}>{new Date(note.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                </View>
                <ChevronRight s={16} c="#E5E7EB" />
              </TouchableOpacity>
            ))}
          </ScrollView>
    </SmoothBottomSheet>
  );
}

function Header({
  top, title, onBack, onBibleNote, onFavorites,
}: {
  top: number;
  title: string;
  onBack: () => void;
  onBibleNote: () => void;
  onFavorites: () => void;
}) {
  return (
    <View style={[s.header, { paddingTop: getTitleBarTopPadding(top) }]}>
      <TouchableOpacity onPress={onBack} style={s.headerBtn} activeOpacity={0.7}>
        <ArrowLeft s={24} c="#9CA3AF" />
      </TouchableOpacity>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={s.headerTitle}>
        {title.toUpperCase()}
      </Text>
      <View style={s.headerActions}>
        <TouchableOpacity onPress={onBibleNote} style={s.headerIconBtn} activeOpacity={0.7}>
          <Notebook s={20} c="#9CA3AF" />
        </TouchableOpacity>
        <TouchableOpacity onPress={onFavorites} style={s.headerIconBtn} activeOpacity={0.7}>
          <Star s={22} c="#9CA3AF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ChapterBar({
  chapter, canGoPrev, canGoNext, onPrev, onNext,
}: {
  chapter: number;
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <View style={s.chapterBar}>
      <TouchableOpacity onPress={onPrev} disabled={!canGoPrev} style={s.chapterBtn} activeOpacity={0.75}>
        <ChevronLeft s={23} c={canGoPrev ? '#9CA3AF' : '#E5E7EB'} />
      </TouchableOpacity>
      <Text style={s.chapterTitle}>CHAPTER {chapter}</Text>
      <TouchableOpacity onPress={onNext} disabled={!canGoNext} style={s.chapterBtn} activeOpacity={0.75}>
        <ChevronRight s={23} c={canGoNext ? '#9CA3AF' : '#E5E7EB'} />
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

  const handlePress = () => {
    if (selectionActive) {
      onPress();
      return;
    }
    if (comment) onOpenComment(comment);
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      onLongPress={onLongPress}
      delayLongPress={460}
      activeOpacity={0.88}
      style={[s.verseRow, selected && s.verseRowSelected, autoFocus && s.verseRowFocused]}
    >
      <View style={s.verseMarker}>
        {selectionActive ? (
          <View style={[s.selectCircle, selected && s.selectCircleActive]}>
            {selected && <CheckSmall s={13} c="#fff" />}
          </View>
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
    </TouchableOpacity>
  );
}

function SelectionTools({
  visible,
  sheetOpen,
  bottom,
  categories,
  selectedColor,
  selectedCount,
  onOpenSheet,
  onClose,
  onCloseSheet,
  onSelectColor,
  onHighlight,
  onComment,
  onBibleNote,
  onEditColors,
  colorEditorOpen,
  onCloseColorEditor,
  onSaveCategory,
}: {
  visible: boolean;
  sheetOpen: boolean;
  bottom: number;
  categories: ColorCategory[];
  selectedColor: HighlightColor;
  selectedCount: number;
  onOpenSheet: () => void;
  onClose: () => void;
  onCloseSheet: () => void;
  onSelectColor: (color: HighlightColor) => void;
  onHighlight: () => void;
  onComment: () => void;
  onBibleNote: () => void;
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
        style={[s.pencilFab, { bottom: bottom + 30 }]}
      >
        <Pencil s={18} c={GOLD} w={2.3} />
      </TouchableOpacity>
    );
  }

  return (
    <SmoothBottomSheet
      visible={sheetOpen}
      onClose={onCloseSheet}
      overlayStyle={s.selectionOverlay}
      backdropOpacity={0.08}
      sheetStyle={[s.selectionSheet, { paddingBottom: Math.max(bottom, 16) + 12 }]}
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

          <Text style={s.selectionCategory}>{categoryLabel}</Text>
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

          <View style={s.sheetActionGrid}>
            <SheetActionCard
              icon={<Pencil s={15} c={accent} w={2.3} />}
              kicker="COMMENT"
              title="Add reflection"
              accent={accent}
              onPress={onComment}
            />
            <SheetActionCard
              icon={<FileEdit s={15} c={GOLD} w={2.2} />}
              kicker="NOTES"
              title="Send to notes"
              tone="gold"
              onPress={onBibleNote}
            />
          </View>
    </SmoothBottomSheet>
  );
}

function SheetActionCard({
  icon, kicker, title, tone = 'neutral', accent, onPress,
}: {
  icon: React.ReactNode;
  kicker: string;
  title: string;
  tone?: 'neutral' | 'gold';
  accent?: string;
  onPress: () => void;
}) {
  const gold = tone === 'gold';
  const actionAccent = accent ?? (gold ? GOLD : '#9CA3AF');
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      style={[
        s.sheetActionCard,
        {
          borderColor: hexToRgba(actionAccent, gold ? 0.20 : 0.24),
          backgroundColor: hexToRgba(actionAccent, gold ? 0.055 : 0.075),
        },
      ]}
    >
      <View style={[s.sheetActionIcon, { backgroundColor: hexToRgba(actionAccent, 0.10) }]}>{icon}</View>
      <View style={s.sheetActionCopy}>
        <Text style={[s.sheetActionKicker, { color: actionAccent }]}>{kicker}</Text>
        <Text style={[s.sheetActionTitle, { color: gold ? '#4C3B2D' : '#2F2B27' }]}>{title}</Text>
      </View>
    </TouchableOpacity>
  );
}

function CommentModal({
  visible,
  value,
  quoteLines,
  categories,
  selectedColor,
  onSelectColor,
  onEditColors,
  onValue,
  onClose,
  onSave,
}: {
  visible: boolean;
  value: string;
  quoteLines: string[];
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
  const editorRef = useRef<RichTextEditorRef>(null);
  const [fmt, setFmt] = useState<FormatState>({ bold: false, italic: false, underline: false });
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', e => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKbHeight(0));
    const showA = Keyboard.addListener('keyboardDidShow', e => setKbHeight(e.endCoordinates.height));
    const hideA = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); showA.remove(); hideA.remove(); };
  }, []);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={[s.commentOverlay, { paddingBottom: kbHeight > 0 ? kbHeight : 54 }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.commentCard}>
          <View style={s.commentHeader}>
            <Text style={s.commentTitle}>Add Comment</Text>
            <TouchableOpacity onPress={onClose} style={s.commentCloseBtn} activeOpacity={0.85}>
              <X s={18} c="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <AnnotationPreviewCard
            color={selectedColor}
            categories={categories}
            kindLabel="COMMENT"
            quoteLines={quoteLines}
            compact
          />

          <Text style={s.commentTagLabel}>TAG CATEGORY</Text>
          <CategoryChipPicker
            categories={categories}
            selectedColor={selectedColor}
            onSelectColor={onSelectColor}
            onEdit={onEditColors}
            layout="scroll"
            contentStyle={s.commentChipContent}
          />
          <Text style={[s.commentCategoryName, { color: accent }]}>{categoryLabel}</Text>

          <RichToolbar editorRef={editorRef} activeFormats={fmt} style={s.commentToolbar} />
          <RichTextEditor
            ref={editorRef}
            initialHTML={value}
            onChange={onValue}
            onFormatChange={setFmt}
            placeholder="Write your reflection..."
            backgroundColor="#FFFFFF"
            color="#3D3229"
            style={s.commentEditor}
          />

          <TouchableOpacity onPress={onSave} style={s.commentSave} activeOpacity={0.85}>
            <Text style={s.commentSaveText}>SAVE COMMENT</Text>
          </TouchableOpacity>
        </View>
      </View>
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
  bookName,
  onClose,
  onDelete,
}: {
  annotation: ScriptureAnnotation | null;
  categories: ColorCategory[];
  bookName: string;
  onClose: () => void;
  onDelete: () => void;
}) {
  if (!annotation) return null;

  const accent = getAnnotationColorHex(annotation.color);
  const categoryLabel = getAnnotationCategoryLabel(categories, annotation.color);
  const ref = `${bookName.toUpperCase()} ${annotation.chapter}:${annotation.verse}`;
  const quoteLines = splitQuoteLines(annotation.text);

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <View style={s.previewOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[s.previewCard, { borderTopColor: accent }]}>
          <View style={s.previewHeader}>
            <View style={[s.previewChip, { backgroundColor: accent }]}>
              <Text style={s.previewChipText}>{categoryLabel}</Text>
            </View>
            <Text numberOfLines={1} style={s.previewRef}>{ref}</Text>
            <TouchableOpacity onPress={onClose} style={s.previewClose} activeOpacity={0.82}>
              <X s={18} c="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <AnnotationPreviewCard
            color={annotation.color}
            categories={categories}
            kindLabel="COMMENT"
            quoteLines={quoteLines}
          />

          <View style={s.previewCommentBox}>
            <Text style={s.previewCommentText}>{annotation.comment}</Text>
          </View>

          <TouchableOpacity onPress={onDelete} activeOpacity={0.86} style={s.previewDelete}>
            <Text style={s.previewDeleteText}>DELETE COMMENT</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: BG },
  loadingText: { marginTop: 12, fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2, color: C.textMuted, textTransform: 'uppercase' },
  sendOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  sendCard: {
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 14 },
    shadowRadius: 30,
    elevation: 14,
  },
  sendKicker: { textAlign: 'center', fontFamily: F.sansBold, fontSize: 11, letterSpacing: 2.2, color: '#9CA3AF', marginBottom: 12 },
  sendChoice: {
    minHeight: 82,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
  },
  sendChoiceGold: { borderColor: '#E8DCC4', backgroundColor: '#FFFBF2' },
  sendChoiceStone: { borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  sendChoiceIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  sendChoiceIconGold: { backgroundColor: 'rgba(197,160,89,0.12)' },
  sendChoiceIconStone: { backgroundColor: '#F4F4F5' },
  sendChoiceTitle: { fontFamily: F.serifMedium, fontSize: 22, color: C.text },
  sendChoiceSubtitle: { marginTop: 3, fontFamily: F.sans, fontSize: 12, color: '#8B95A5' },
  chooseOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.38)' },
  chooseSheet: {
    maxHeight: '78%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 18,
  },
  chooseHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  chooseBack: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  chooseKicker: { flex: 1, textAlign: 'center', fontFamily: F.sansBold, fontSize: 11, letterSpacing: 2.3, color: '#9CA3AF' },
  newNoteCard: {
    minHeight: 84,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E8DCC4',
    backgroundColor: '#FFFBF2',
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 22,
  },
  newNoteIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(197,160,89,0.12)', alignItems: 'center', justifyContent: 'center' },
  newNotePlus: { fontFamily: F.serif, fontSize: 25, lineHeight: 26, color: GOLD },
  newNoteTitle: { fontFamily: F.serifMedium, fontSize: 22, color: C.text },
  existingLabel: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.2, color: '#D1D5DB', marginBottom: 12 },
  existingList: { gap: 11, paddingBottom: 28 },
  existingCard: {
    minHeight: 72,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E8DCC4',
    backgroundColor: '#FAF6EE',
    paddingHorizontal: 17,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  existingTitle: { fontFamily: F.serifMedium, fontSize: 19, color: '#3D3229' },
  existingDate: { marginTop: 3, fontFamily: F.sansBold, fontSize: 10, color: '#C7C2BA', textTransform: 'uppercase' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: TITLE_BAR_BOTTOM_PADDING,
    backgroundColor: 'rgba(252,252,252,0.98)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(17,24,39,0.05)',
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: F.serifMedium, fontSize: 23, letterSpacing: 2.2, color: '#111827' },
  headerActions: { width: 88, height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  headerIconBtn: { width: 38, height: 44, alignItems: 'center', justifyContent: 'center' },
  chapterBar: {
    minHeight: 62,
    paddingHorizontal: 18,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(17,24,39,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chapterBtn: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  chapterTitle: { fontFamily: F.sansBold, fontSize: 12, letterSpacing: 4.2, color: ROSE },
  content: { paddingHorizontal: 16, paddingTop: 26 },
  chapterLoading: { paddingVertical: 70 },
  verseList: { gap: 18 },
  verseRow: { flexDirection: 'row', gap: 10, borderRadius: 14, paddingVertical: 5, paddingHorizontal: 3, borderWidth: 1, borderColor: 'transparent' },
  verseRowSelected: { borderColor: 'rgba(197,160,89,0.38)', backgroundColor: '#FFFEF9' },
  verseRowFocused: {},
  verseMarker: { width: 24, alignItems: 'flex-end', paddingTop: 5 },
  verseNum: { width: 20, textAlign: 'right', fontFamily: F.sansBold, fontSize: 10, color: 'rgba(190,18,60,0.42)', paddingTop: 3 },
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
  verseText: { fontFamily: F.serif, fontSize: 23, lineHeight: 31, color: '#252525' },
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
  pencilFab: {
    position: 'absolute',
    right: 22,
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
  selectionCategory: { marginTop: 8, fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.4, color: '#9CA3AF', textTransform: 'uppercase' },
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
  sheetActionGrid: { flexDirection: 'row', gap: 10, marginTop: 12 },
  sheetActionCard: {
    flex: 1,
    minHeight: 90,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ECE3D7',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 10,
    elevation: 2,
  },
  sheetActionCardGold: { borderColor: '#E8DCC4', backgroundColor: '#FAF6EE' },
  sheetActionIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#F7F3EB', alignItems: 'center', justifyContent: 'center' },
  sheetActionIconGold: { backgroundColor: 'rgba(255,255,255,0.90)' },
  sheetActionCopy: { flex: 1, minWidth: 0 },
  sheetActionKicker: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.2, color: '#9CA3AF' },
  sheetActionKickerGold: { color: GOLD },
  sheetActionTitle: { marginTop: 4, fontFamily: F.serif, fontSize: 17, lineHeight: 20, color: '#2F2B27' },
  sheetActionTitleGold: { color: '#4C3B2D' },
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
    paddingTop: 20,
    backgroundColor: 'rgba(0,0,0,0.40)',
  },
  commentCard: {
    width: '100%',
    maxWidth: 350,
    borderRadius: 30,
    backgroundColor: '#fff',
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowOffset: { width: 0, height: 16 },
    shadowRadius: 38,
    elevation: 18,
  },
  commentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  commentTitle: { fontFamily: F.serifMedium, fontSize: 23, color: '#111827' },
  commentCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F8F8FA',
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
  commentCategoryName: { marginTop: 8, marginBottom: 15, fontFamily: F.serif, fontSize: 15 },
  commentToolbar: { marginBottom: 10 },
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
  commentEditor: {
    minHeight: 132,
    borderRadius: 18,
    backgroundColor: '#F8F8FA',
  },
  commentSave: {
    minHeight: 50,
    borderRadius: 24,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  commentSaveText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 2, color: '#fff' },
  previewOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 17,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  previewCard: {
    width: '100%',
    maxWidth: 350,
    borderRadius: 30,
    borderTopWidth: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 26,
    paddingTop: 24,
    paddingBottom: 22,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 18 },
    shadowRadius: 42,
    elevation: 20,
  },
  previewHeader: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 12 },
  previewChip: {
    maxWidth: 130,
    minHeight: 24,
    borderRadius: 12,
    paddingHorizontal: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewChipText: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  previewRef: {
    flex: 1,
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 1.9,
    color: '#A0A7B2',
  },
  previewClose: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F8F8FA',
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
    minHeight: 88,
    borderRadius: 22,
    backgroundColor: '#F8F8FA',
    borderWidth: 1,
    borderColor: '#F0F1F4',
    paddingHorizontal: 24,
    paddingVertical: 22,
    justifyContent: 'center',
  },
  previewCommentText: { fontFamily: F.serif, fontSize: 21, lineHeight: 29, color: '#111827' },
  previewDelete: {
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: '#FFF1F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  previewDeleteText: {
    fontFamily: F.sansBold,
    fontSize: 11,
    letterSpacing: 2,
    color: '#DC2626',
  },
});
