import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Reanimated, {
  Easing,
  FadeInDown,
  FadeOutUp,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  CheckSmall, ChevronDown, Search, Trash2, X,
} from '@/components/icons/Icons';
import ConfirmModal from '@/components/shared/ConfirmModal';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import { C, F } from '@/constants/tokens';
import { RichTextEditor, RichToolbar, RichTextEditorRef, FormatState } from '@/components/shared/RichTextEditor';
import { ScriptureBibleNote, useScripture } from '@/components/scripture/ScriptureContext';
import { HapticTouchableOpacity as TouchableOpacity, HapticPressable as Pressable } from '@/components/shared/HapticTouch';
import { useGuidedSetup, useGuideTarget } from '@/components/onboarding/guided/GuidedSetupContext';


const BG = '#F5F3EE';
const GOLD = '#C5A059';
const PSALMS_ID = 19;
const CHAPTER_COLUMNS = 5;
const CHAPTER_GAP = 7;
const PAGE_SIDE_PADDING = 16;
const CHAPTER_GRID_SIDE_PADDING = 4;
const BIBLE_NOTES_EASE = Easing.bezier(0.22, 1, 0.36, 1);
const bibleNotesLayout = LinearTransition.duration(178).easing(BIBLE_NOTES_EASE);

type BibleTab = 'nt' | 'psalms' | 'ot';
type BibleBook = {
  id: number;
  name: string;
  chapters: number;
  section: 'ot' | 'nt';
};

const BOOKS: BibleBook[] = [
  { id: 1, name: 'Genesis', chapters: 50, section: 'ot' },
  { id: 2, name: 'Exodus', chapters: 40, section: 'ot' },
  { id: 3, name: 'Leviticus', chapters: 27, section: 'ot' },
  { id: 4, name: 'Numbers', chapters: 36, section: 'ot' },
  { id: 5, name: 'Deuteronomy', chapters: 34, section: 'ot' },
  { id: 6, name: 'Joshua', chapters: 24, section: 'ot' },
  { id: 7, name: 'Judges', chapters: 21, section: 'ot' },
  { id: 8, name: 'Ruth', chapters: 4, section: 'ot' },
  { id: 9, name: '1 Samuel', chapters: 31, section: 'ot' },
  { id: 10, name: '2 Samuel', chapters: 24, section: 'ot' },
  { id: 11, name: '1 Kings', chapters: 22, section: 'ot' },
  { id: 12, name: '2 Kings', chapters: 25, section: 'ot' },
  { id: 13, name: '1 Chronicles', chapters: 29, section: 'ot' },
  { id: 14, name: '2 Chronicles', chapters: 36, section: 'ot' },
  { id: 15, name: 'Ezra', chapters: 10, section: 'ot' },
  { id: 16, name: 'Nehemiah', chapters: 13, section: 'ot' },
  { id: 17, name: 'Esther', chapters: 10, section: 'ot' },
  { id: 18, name: 'Job', chapters: 42, section: 'ot' },
  { id: 19, name: 'Psalms', chapters: 150, section: 'ot' },
  { id: 20, name: 'Proverbs', chapters: 31, section: 'ot' },
  { id: 21, name: 'Ecclesiastes', chapters: 12, section: 'ot' },
  { id: 22, name: 'Song of Solomon', chapters: 8, section: 'ot' },
  { id: 23, name: 'Isaiah', chapters: 66, section: 'ot' },
  { id: 24, name: 'Jeremiah', chapters: 52, section: 'ot' },
  { id: 25, name: 'Lamentations', chapters: 5, section: 'ot' },
  { id: 26, name: 'Ezekiel', chapters: 48, section: 'ot' },
  { id: 27, name: 'Daniel', chapters: 12, section: 'ot' },
  { id: 28, name: 'Hosea', chapters: 14, section: 'ot' },
  { id: 29, name: 'Joel', chapters: 3, section: 'ot' },
  { id: 30, name: 'Amos', chapters: 9, section: 'ot' },
  { id: 31, name: 'Obadiah', chapters: 1, section: 'ot' },
  { id: 32, name: 'Jonah', chapters: 4, section: 'ot' },
  { id: 33, name: 'Micah', chapters: 7, section: 'ot' },
  { id: 34, name: 'Nahum', chapters: 3, section: 'ot' },
  { id: 35, name: 'Habakkuk', chapters: 3, section: 'ot' },
  { id: 36, name: 'Zephaniah', chapters: 3, section: 'ot' },
  { id: 37, name: 'Haggai', chapters: 2, section: 'ot' },
  { id: 38, name: 'Zechariah', chapters: 14, section: 'ot' },
  { id: 39, name: 'Malachi', chapters: 4, section: 'ot' },
  { id: 40, name: 'Matthew', chapters: 28, section: 'nt' },
  { id: 41, name: 'Mark', chapters: 16, section: 'nt' },
  { id: 42, name: 'Luke', chapters: 24, section: 'nt' },
  { id: 43, name: 'John', chapters: 21, section: 'nt' },
  { id: 44, name: 'Acts', chapters: 28, section: 'nt' },
  { id: 45, name: 'Romans', chapters: 16, section: 'nt' },
  { id: 46, name: '1 Corinthians', chapters: 16, section: 'nt' },
  { id: 47, name: '2 Corinthians', chapters: 13, section: 'nt' },
  { id: 48, name: 'Galatians', chapters: 6, section: 'nt' },
  { id: 49, name: 'Ephesians', chapters: 6, section: 'nt' },
  { id: 50, name: 'Philippians', chapters: 4, section: 'nt' },
  { id: 51, name: 'Colossians', chapters: 4, section: 'nt' },
  { id: 52, name: '1 Thessalonians', chapters: 5, section: 'nt' },
  { id: 53, name: '2 Thessalonians', chapters: 3, section: 'nt' },
  { id: 54, name: '1 Timothy', chapters: 6, section: 'nt' },
  { id: 55, name: '2 Timothy', chapters: 4, section: 'nt' },
  { id: 56, name: 'Titus', chapters: 3, section: 'nt' },
  { id: 57, name: 'Philemon', chapters: 1, section: 'nt' },
  { id: 58, name: 'Hebrews', chapters: 13, section: 'nt' },
  { id: 59, name: 'James', chapters: 5, section: 'nt' },
  { id: 60, name: '1 Peter', chapters: 5, section: 'nt' },
  { id: 61, name: '2 Peter', chapters: 3, section: 'nt' },
  { id: 62, name: '1 John', chapters: 5, section: 'nt' },
  { id: 63, name: '2 John', chapters: 1, section: 'nt' },
  { id: 64, name: '3 John', chapters: 1, section: 'nt' },
  { id: 65, name: 'Jude', chapters: 1, section: 'nt' },
  { id: 66, name: 'Revelation', chapters: 22, section: 'nt' },
];

function noteKey(bookId: number, chapter: number) {
  return `${bookId}:${chapter}`;
}

function tabMatches(book: BibleBook, tab: BibleTab) {
  if (tab === 'psalms') return book.id === PSALMS_ID;
  if (tab === 'nt') return book.section === 'nt';
  return book.section === 'ot' && book.id !== PSALMS_ID;
}

const BIBLE_NOTES_GUIDE_TARGETS = {
  tabs: 'bible-notes.tabs',
  search: 'bible-notes.search',
} as const;

export default function BibleNotesView({
  guided = false,
  initialBookId,
  initialChapter,
  onGuidedComplete,
}: {
  guided?: boolean;
  initialBookId?: number;
  initialChapter?: number;
  onGuidedComplete?: () => void;
} = {}) {
  const router = useRouter();
  const params = useLocalSearchParams<{ bookId?: string; chapter?: string; open?: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { bibleNotes, saveBibleNote, deleteBibleNote } = useScripture();

  const { session, patchSession, setPresentation } = useGuidedSetup();
  const isGuided = guided && session?.active === true && session.activeStep === 'riseBibleHighlight';
  const guidePhase = isGuided ? session.phase : '';
  const tabsTarget = useGuideTarget(BIBLE_NOTES_GUIDE_TARGETS.tabs, isGuided);
  const searchTarget = useGuideTarget(BIBLE_NOTES_GUIDE_TARGETS.search, isGuided);
  const guideEntryOpenedRef = useRef(false);

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<BibleTab>('nt');
  const tabProgress = useSharedValue(0);
  const [tabsWidth, setTabsWidth] = useState(0);
  const tabPillWidth = tabsWidth > 0 ? (tabsWidth - 14) / 3 : 0;
  const tabPillTravel = tabPillWidth + 3;

  useEffect(() => {
    const idx = activeTab === 'nt' ? 0 : activeTab === 'psalms' ? 1 : 2;
    tabProgress.value = withTiming(idx, {
      duration: 190,
      easing: BIBLE_NOTES_EASE,
    });
    if (activeTab !== 'psalms') setExpandedBookId(null);
  }, [activeTab, tabProgress]);

  const tabPillMotionStyle = useAnimatedStyle(() => ({
    width: tabPillWidth,
    transform: [{ translateX: tabProgress.value * tabPillTravel }],
  }), [tabPillWidth, tabPillTravel]);

  const [expandedBookId, setExpandedBookId] = useState<number | null>(null);
  const [activeChapter, setActiveChapter] = useState<{ book: BibleBook; chapter: number; note?: ScriptureBibleNote } | null>(null);
  // True only when the editor was opened via deep-link (Scripture → Bible Notes).
  // In that case, pressing back inside the editor should pop one extra route to
  // return all the way to Scripture, instead of leaving the user on the index list.
  const openedFromDeepLinkRef = useRef(false);
  const [deleteTarget, setDeleteTarget] = useState<ScriptureBibleNote | null>(null);
  const [observations, setObservations] = useState('');
  const [lessons, setLessons] = useState('');
  const [application, setApplication] = useState('');

  const notesByChapter = useMemo(() => {
    const map = new Map<string, ScriptureBibleNote>();
    bibleNotes.forEach(note => map.set(noteKey(note.bookId, note.chapter), note));
    return map;
  }, [bibleNotes]);

  const filteredBooks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return BOOKS.filter(book => tabMatches(book, activeTab))
      .filter(book => !q || book.name.toLowerCase().includes(q));
  }, [activeTab, search]);

  const tabCount = (tab: BibleTab) => bibleNotes.filter(note => {
    const book = BOOKS.find(item => item.id === note.bookId);
    return book ? tabMatches(book, tab) : false;
  }).length;

  const chapterGridWidth = Math.min(width, 430) - (PAGE_SIDE_PADDING * 2) - (CHAPTER_GRID_SIDE_PADDING * 2);
  const chapterCellWidth = Math.floor((chapterGridWidth - (CHAPTER_GAP * (CHAPTER_COLUMNS - 1))) / CHAPTER_COLUMNS);

  useEffect(() => {
    const paramBookId = Number(params.bookId);
    const paramChapter = Number(params.chapter);
    if (!paramBookId || !paramChapter) return;

    const book = BOOKS.find(item => item.id === paramBookId);
    if (!book) return;

    setActiveTab(book.id === PSALMS_ID ? 'psalms' : book.section === 'nt' ? 'nt' : 'ot');
    setExpandedBookId(book.id);

    if (params.open === '1') {
      const note = notesByChapter.get(noteKey(book.id, paramChapter));
      setActiveChapter({ book, chapter: paramChapter, note });
      setObservations(note?.observations ?? '');
      setLessons(note?.lessons ?? '');
      setApplication(note?.application ?? '');
      openedFromDeepLinkRef.current = true;
    }
  }, [notesByChapter, params.bookId, params.chapter, params.open]);

  const openChapter = (book: BibleBook, chapter: number) => {
    const existing = notesByChapter.get(noteKey(book.id, chapter));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveChapter({ book, chapter, note: existing });
    setObservations(existing?.observations ?? '');
    setLessons(existing?.lessons ?? '');
    setApplication(existing?.application ?? '');
  };

  // ─── Guided Bible tour ─────────────────────────────────────────────────────
  // The tour arrives here straight from the reader's notebook icon: open the
  // chapter's note once (a full-screen modal — the overlay steps aside), and
  // when the user leaves it, walk the shelf: tabs, then search, then close.
  useEffect(() => {
    if (!isGuided || !initialBookId || guideEntryOpenedRef.current) return;
    if (guidePhase !== 'noteEntry') return;
    guideEntryOpenedRef.current = true;
    const book = BOOKS.find(item => item.id === initialBookId);
    if (!book) return;
    setActiveTab(book.id === PSALMS_ID ? 'psalms' : book.section === 'nt' ? 'nt' : 'ot');
    setExpandedBookId(book.id);
    openChapter(book, initialChapter ?? 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guidePhase, initialBookId, initialChapter, isGuided]);

  const handleGuidedEditorClosed = () => {
    if (isGuided && guidePhase === 'noteEntry') {
      patchSession({ phase: 'notesTabs' });
    }
  };

  useEffect(() => {
    if (!isGuided) return;

    if (guidePhase === 'noteEntry') {
      // Full-screen editor modal owns the stage.
      setPresentation(null);
      return;
    }
    if (guidePhase === 'notesTabs') {
      setPresentation({
        key: 'bible-notes-tabs',
        targetId: BIBLE_NOTES_GUIDE_TARGETS.tabs,
        cutoutPadding: 7,
        placement: 'below',
        allowTargetInteraction: false,
        eyebrow: 'BIBLE NOTES',
        message: 'Every note is filed where it belongs — the New Testament, the Psalter, the Old.',
        highlights: ['filed where it belongs'],
        ctaLabel: 'Continue',
        onCta: () => patchSession({ phase: 'notesSearch' }),
      });
      return;
    }
    if (guidePhase === 'notesSearch') {
      setPresentation({
        key: 'bible-notes-search',
        targetId: BIBLE_NOTES_GUIDE_TARGETS.search,
        cutoutPadding: 7,
        placement: 'below',
        allowTargetInteraction: false,
        eyebrow: 'BIBLE NOTES',
        message: 'And when you need a thought back — search carries you straight to it.',
        highlights: ['search'],
        ctaLabel: 'Continue',
        onCta: () => patchSession({ phase: 'notesDone' }),
      });
      return;
    }
    if (guidePhase === 'notesDone') {
      setPresentation({
        key: 'bible-notes-done',
        placement: 'center',
        celebrate: true,
        eyebrow: 'HOLY SCRIPTURE',
        message: 'The Scripture is yours to mark now.\n\nEvery highlight, thought, and lesson will be waiting for you.',
        highlights: ['yours to mark'],
        ctaLabel: 'Continue',
        onCta: onGuidedComplete,
      });
    }
  }, [guidePhase, isGuided, onGuidedComplete, patchSession, setPresentation]);

  const saveChapter = async () => {
    if (!activeChapter) return;
    const cleanObservations = observations.trim();
    const cleanLessons = lessons.trim();
    const cleanApplication = application.trim();
    if (!cleanObservations && !cleanLessons && !cleanApplication) {
      setActiveChapter(null);
      handleGuidedEditorClosed();
      return;
    }

    await saveBibleNote(activeChapter.book.id, activeChapter.chapter, cleanObservations, cleanLessons, cleanApplication);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setActiveChapter(null);
    handleGuidedEditorClosed();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteBibleNote(deleteTarget.bookId, deleteTarget.chapter);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setDeleteTarget(null);
    setActiveChapter(null);
  };

  return (
    <View style={s.screen}>
      <ScreenTitleBar title="BIBLE NOTES" showBack={!isGuided} bg={BG} />

      <View {...searchTarget} style={s.searchWrap}>
        <View style={s.searchBox}>
          <Search s={15} c="#D1D5DB" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search books..."
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

      <View ref={tabsTarget.ref} onLayout={tabsTarget.onLayout} style={s.tabsWrap}>
        <View style={s.tabs} onLayout={event => setTabsWidth(event.nativeEvent.layout.width)}>
          {/* Animated sliding pill */}
          <Reanimated.View
            pointerEvents="none"
            style={[s.tabPill, tabPillMotionStyle]}
          />
          <TabButton label="New Test." active={activeTab === 'nt'} count={tabCount('nt')} onPress={() => setActiveTab('nt')} />
          <TabButton label="Psalter" active={activeTab === 'psalms'} count={tabCount('psalms')} onPress={() => setActiveTab('psalms')} />
          <TabButton label="Old Test." active={activeTab === 'ot'} count={tabCount('ot')} onPress={() => setActiveTab('ot')} />
        </View>
      </View>

      <ScrollView contentContainerStyle={[s.bookList, { paddingBottom: insets.bottom + 36 }]} showsVerticalScrollIndicator={false}>
        {filteredBooks.length === 0 ? (
          <Text style={s.noBooks}>No books found</Text>
        ) : (
          filteredBooks.map(book => {
            const chaptersWithNotes = Array.from({ length: book.chapters }, (_, index) => index + 1)
              .filter(chapter => notesByChapter.has(noteKey(book.id, chapter)));
            const hasAnyNote = chaptersWithNotes.length > 0;
            const isExpanded = activeTab === 'psalms' || expandedBookId === book.id;

            return (
              <Reanimated.View key={book.id} layout={bibleNotesLayout}>
                {activeTab !== 'psalms' && (
                  <TouchableOpacity
                    onPress={() => setExpandedBookId(isExpanded ? null : book.id)}
                    activeOpacity={0.88}
                    style={[
                      s.bookCard,
                      isExpanded && s.bookCardExpanded,
                      !hasAnyNote && !isExpanded && s.bookCardMuted,
                    ]}
                  >
                    <View
                      style={[
                        s.bookAccent,
                        hasAnyNote && s.bookAccentActive,
                        isExpanded && s.bookAccentExpanded,
                      ]}
                    />
                    <Text style={[s.bookName, !hasAnyNote && s.bookNameMuted]} numberOfLines={1}>{book.name}</Text>
                    {hasAnyNote && (
                      <Text style={s.bookCount}>{chaptersWithNotes.length}</Text>
                    )}
                    <View style={[s.chevronWrap, isExpanded && s.chevronWrapOpen, isExpanded && s.chevronOpen]}>
                      <ChevronDown s={15} c={isExpanded ? GOLD : '#D1D5DB'} />
                    </View>
                  </TouchableOpacity>
                )}

                {isExpanded && (
                  <Reanimated.View
                    entering={FadeInDown.duration(168).easing(BIBLE_NOTES_EASE).withInitialValues({
                      opacity: 0,
                      transform: [{ translateY: 8 }],
                    })}
                    exiting={FadeOutUp.duration(118).easing(Easing.out(Easing.cubic))}
                    layout={bibleNotesLayout}
                    style={s.chapterGrid}
                  >
                    {Array.from({ length: book.chapters }, (_, index) => index + 1).map(chapter => {
                      const hasNote = notesByChapter.has(noteKey(book.id, chapter));
                      return (
                        <TouchableOpacity
                          key={chapter}
                          onPress={() => openChapter(book, chapter)}
                          activeOpacity={0.82}
                          style={[s.chapterCell, { width: chapterCellWidth }, hasNote && s.chapterCellActive]}
                        >
                          <Text style={[s.chapterText, hasNote && s.chapterTextActive]}>{chapter}</Text>
                          {hasNote && <View style={s.noteDot} />}
                        </TouchableOpacity>
                      );
                    })}
                  </Reanimated.View>
                )}
              </Reanimated.View>
            );
          })
        )}
      </ScrollView>

      <ChapterEditor
        chapter={activeChapter}
        observations={observations}
        lessons={lessons}
        application={application}
        onObservations={setObservations}
        onLessons={setLessons}
        onApplication={setApplication}
        onClose={() => {
          setActiveChapter(null);
          if (isGuided) {
            handleGuidedEditorClosed();
            return;
          }
          if (openedFromDeepLinkRef.current) {
            openedFromDeepLinkRef.current = false;
            router.back();
          }
        }}
        onSave={saveChapter}
        onDelete={activeChapter?.note ? () => setDeleteTarget(activeChapter.note ?? null) : undefined}
        deleteVisible={!!deleteTarget}
        onCancelDelete={() => setDeleteTarget(null)}
        onConfirmDelete={confirmDelete}
      />
    </View>
  );
}

function TabButton({
  label, active, count, onPress,
}: {
  label: string;
  active: boolean;
  count: number;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.86} style={[s.tabButton, active && s.tabActive]}>
      <Text style={[s.tabText, active && s.tabTextActive]}>{label}</Text>
      {count > 0 && (
        <View style={[s.tabCount, active && s.tabCountActive]}>
          <Text style={[s.tabCountText, active && s.tabCountTextActive]}>{count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function ChapterEditor({
  chapter,
  observations,
  lessons,
  application,
  onObservations,
  onLessons,
  onApplication,
  onClose,
  onSave,
  onDelete,
  deleteVisible,
  onCancelDelete,
  onConfirmDelete,
}: {
  chapter: { book: BibleBook; chapter: number; note?: ScriptureBibleNote } | null;
  observations: string;
  lessons: string;
  application: string;
  onObservations: (value: string) => void;
  onLessons: (value: string) => void;
  onApplication: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
  deleteVisible: boolean;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  const insets = useSafeAreaInsets();
  const chapterKey = chapter ? `${chapter.book.id}-${chapter.chapter}` : 'empty';

  return (
    <Modal visible={!!chapter} animationType="slide" onRequestClose={onClose}>
      <View style={s.editorScreen}>
        <ScreenTitleBar
          title={(chapter ? `${chapter.book.name} ${chapter.chapter}` : 'Bible Note').toUpperCase()}
          subtitle="Chapter study note"
          showBack
          bg={BG}
          onBackOverride={onClose}
          sideWidth={88}
          rightElement={(
            <View style={s.editorActions}>
            {onDelete && (
              <TouchableOpacity onPress={onDelete} style={[s.editorIconBtn, s.editorDeleteBtn]} activeOpacity={0.76}>
                <Trash2 s={18} c={C.red} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onSave} style={[s.editorIconBtn, s.editorSaveBtn]} activeOpacity={0.78}>
              <CheckSmall s={19} c="#FFFFFF" />
            </TouchableOpacity>
            </View>
          )}
        />

        <ScrollView
          contentContainerStyle={[s.editorContent, { paddingBottom: insets.bottom + 42 }]}
          keyboardShouldPersistTaps="handled"
        >
          <BibleField
            label="OBSERVATIONS"
            editorKey={`${chapterKey}-observations`}
            value={observations}
            onChange={onObservations}
            placeholder="What do you notice in this chapter?"
          />
          <BibleField
            label="LESSONS"
            editorKey={`${chapterKey}-lessons`}
            value={lessons}
            onChange={onLessons}
            placeholder="What is God teaching here?"
          />
          <BibleField
            label="APPLICATION"
            editorKey={`${chapterKey}-application`}
            value={application}
            onChange={onApplication}
            placeholder="How will you live this today?"
          />
        </ScrollView>

        <DeleteBibleModal
          visible={deleteVisible}
          embedded
          onCancel={onCancelDelete}
          onConfirm={onConfirmDelete}
        />
      </View>
    </Modal>
  );
}

function DeleteBibleModal({
  visible, embedded = false, onCancel, onConfirm,
}: {
  visible: boolean;
  embedded?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ConfirmModal
      visible={visible}
      embedded={embedded}
      icon={<Trash2 s={22} c={C.red} />}
      iconBg="#FEF2F2"
      title="Delete this Bible note?"
      body="This will permanently delete your note for this chapter."
      confirmLabel="DELETE"
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
function BibleField({
  label, editorKey, value, onChange, placeholder,
}: {
  label: string;
  editorKey: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const editorRef = useRef<RichTextEditorRef>(null);
  const [fmt, setFmt] = useState<FormatState>({ bold: false, italic: false, underline: false });

  return (
    <View style={s.fieldCard}>
      <Text style={s.fieldLabel}>{label}</Text>
      <RichToolbar editorRef={editorRef} activeFormats={fmt} style={s.fieldToolbar} />
      <RichTextEditor
        key={editorKey}
        ref={editorRef}
        initialHTML={value}
        onChange={onChange}
        onFormatChange={setFmt}
        placeholder={placeholder}
        backgroundColor="#FFFEFB"
        color="#3D3229"
        style={s.fieldEditor}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  searchWrap: { paddingHorizontal: 16, paddingTop: 11, paddingBottom: 10 },
  searchBox: {
    height: 48,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.16)',
    backgroundColor: '#FFFDF8',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.045,
    shadowRadius: 16,
    elevation: 1,
  },
  searchInput: { flex: 1, height: 46, fontFamily: F.serif, fontSize: 15.5, lineHeight: 21, color: '#3D3229' },
  tabsWrap: { paddingHorizontal: 16, paddingBottom: 11 },
  tabs: {
    flexDirection: 'row',
    gap: 3,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(232,220,196,0.68)',
    backgroundColor: 'rgba(255,255,255,0.84)',
    padding: 4,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.055,
    shadowRadius: 14,
    elevation: 1,
  },
  tabPill: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    width: '32%',
    borderRadius: 14,
    backgroundColor: GOLD,
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 10,
    elevation: 2,
    zIndex: 0,
  },
  tabButton: { flex: 1, minHeight: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5, zIndex: 1 },
  tabActive: {},
  tabText: { fontFamily: F.serifMedium, fontSize: 13.5, color: '#B5ADA0' },
  tabTextActive: { color: '#FFFFFF' },
  tabCount: { minWidth: 17, height: 17, borderRadius: 9, backgroundColor: 'rgba(197,160,89,0.15)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabCountActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  tabCountText: { fontFamily: F.sansBold, fontSize: 8, color: GOLD },
  tabCountTextActive: { color: '#FFFFFF' },
  bookList: { paddingHorizontal: 16, gap: 7 },
  noBooks: { textAlign: 'center', paddingVertical: 60, fontFamily: F.serif, fontSize: 17, color: '#D1D5DB' },
  bookCard: {
    minHeight: 56,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(232,216,186,0.45)',
    backgroundColor: '#FFFDF9',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.045,
    shadowRadius: 14,
    elevation: 1,
  },
  bookCardExpanded: { backgroundColor: '#FFFCF3', borderColor: 'rgba(197,160,89,0.34)' },
  bookCardMuted: { backgroundColor: 'rgba(255,255,255,0.50)', borderColor: 'rgba(255,255,255,0.40)', shadowOpacity: 0 },
  bookAccent: {
    width: 7,
    height: 26,
    borderRadius: 7,
    backgroundColor: 'rgba(214,207,195,0.55)',
  },
  bookAccentActive: { backgroundColor: 'rgba(197,160,89,0.45)' },
  bookAccentExpanded: { backgroundColor: GOLD },
  bookName: { flex: 1, fontFamily: F.serifMedium, fontSize: 17.5, lineHeight: 23, color: '#2D2520' },
  bookNameMuted: { fontFamily: F.serif, color: '#C9C3BA' },
  bookCount: {
    minWidth: 25,
    textAlign: 'center',
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 0.9,
    color: GOLD,
    backgroundColor: 'rgba(197,160,89,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 11,
    overflow: 'hidden',
  },
  chevronWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245,243,238,0.76)',
    borderWidth: 1,
    borderColor: 'rgba(232,216,186,0.24)',
  },
  chevronWrapOpen: {
    backgroundColor: 'rgba(197,160,89,0.10)',
    borderColor: 'rgba(197,160,89,0.22)',
  },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  chapterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: CHAPTER_GAP,
    rowGap: 8,
    paddingHorizontal: CHAPTER_GRID_SIDE_PADDING,
    paddingTop: 9,
    paddingBottom: 7,
  },
  chapterCell: {
    minHeight: 44,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(232,216,186,0.32)',
    backgroundColor: 'rgba(255,255,255,0.90)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterCellActive: {
    backgroundColor: '#FFF9EA',
    borderColor: 'rgba(197,160,89,0.52)',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 1,
  },
  chapterText: { fontFamily: F.serifMedium, fontSize: 15, color: '#D4CEC6' },
  chapterTextActive: { color: '#3D3229' },
  noteDot: { position: 'absolute', top: 7, right: 8, width: 6, height: 6, borderRadius: 3, backgroundColor: GOLD },

  editorScreen: { flex: 1, backgroundColor: '#FDFBF5' },
  editorActions: { width: 86, flexDirection: 'row', justifyContent: 'flex-end', gap: 7 },
  editorIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  editorDeleteBtn: { backgroundColor: '#FEF2F2', borderColor: 'rgba(190,18,60,0.14)' },
  editorSaveBtn: {
    backgroundColor: GOLD,
    borderColor: 'rgba(255,255,255,0.30)',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 10,
    elevation: 2,
  },
  editorContent: { padding: 18, gap: 13 },
  fieldCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(232,220,196,0.84)',
    backgroundColor: '#FFFDF8',
    padding: 15,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 1,
  },
  fieldLabel: { fontFamily: F.sansBold, fontSize: 10.5, letterSpacing: 2.05, color: GOLD, marginBottom: 9 },
  fieldToolbar: { marginBottom: 8 },
  fieldEditor: { height: 220 },

});
