import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft, CheckSmall, ChevronDown, Search, Trash2, X,
} from '@/components/icons/Icons';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { C, F } from '@/constants/tokens';
import { getTitleBarTopPadding, TITLE_BAR_BOTTOM_PADDING } from '@/components/shared/titleBar';
import { RichTextEditor, RichToolbar, RichTextEditorRef, FormatState } from '@/components/shared/RichTextEditor';
import { ScriptureBibleNote, useScripture } from '@/components/scripture/ScriptureContext';

const BG = '#F5F3EE';
const GOLD = '#C5A059';
const PSALMS_ID = 19;
const CHAPTER_COLUMNS = 5;
const CHAPTER_GAP = 7;
const PAGE_SIDE_PADDING = 16;
const CHAPTER_GRID_SIDE_PADDING = 4;

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

export default function BibleNotesView() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bookId?: string; chapter?: string; open?: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { bibleNotes, saveBibleNote, deleteBibleNote } = useScripture();

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<BibleTab>('nt');
  const pillAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const idx = activeTab === 'nt' ? 0 : activeTab === 'psalms' ? 1 : 2;
    Animated.spring(pillAnim, {
      toValue: idx,
      useNativeDriver: false,
      tension: 68,
      friction: 11,
    }).start();
    if (activeTab === 'psalms') setExpandedBookId(PSALMS_ID);
    else setExpandedBookId(null);
  }, [activeTab, pillAnim]);
  const [expandedBookId, setExpandedBookId] = useState<number | null>(null);
  const [activeChapter, setActiveChapter] = useState<{ book: BibleBook; chapter: number; note?: ScriptureBibleNote } | null>(null);
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

  const saveChapter = async () => {
    if (!activeChapter) return;
    const cleanObservations = observations.trim();
    const cleanLessons = lessons.trim();
    const cleanApplication = application.trim();
    if (!cleanObservations && !cleanLessons && !cleanApplication) {
      setActiveChapter(null);
      return;
    }

    await saveBibleNote(activeChapter.book.id, activeChapter.chapter, cleanObservations, cleanLessons, cleanApplication);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setActiveChapter(null);
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
      <Header title="BIBLE NOTES" top={insets.top} onBack={() => router.back()} />

      <View style={s.searchWrap}>
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

      <View style={s.tabsWrap}>
        <View style={s.tabs}>
          {/* Animated sliding pill */}
          <Animated.View
            pointerEvents="none"
            style={[
              s.tabPill,
              { left: pillAnim.interpolate({ inputRange: [0, 1, 2], outputRange: ['0.9%', '33.9%', '66.9%'] }) },
            ]}
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
            const isExpanded = expandedBookId === book.id;

            return (
              <View key={book.id}>
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
                    <Text style={[s.bookName, !hasAnyNote && s.bookNameMuted]}>{book.name}</Text>
                    {hasAnyNote && (
                      <Text style={s.bookCount}>{chaptersWithNotes.length}</Text>
                    )}
                    <View style={isExpanded && s.chevronOpen}>
                      <ChevronDown s={15} c={isExpanded ? GOLD : '#D1D5DB'} />
                    </View>
                  </TouchableOpacity>
                )}

                {isExpanded && (
                  <View style={s.chapterGrid}>
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
                  </View>
                )}
              </View>
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
        onClose={() => setActiveChapter(null)}
        onSave={saveChapter}
        onDelete={activeChapter?.note ? () => setDeleteTarget(activeChapter.note ?? null) : undefined}
      />

      <DeleteBibleModal
        visible={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </View>
  );
}

function Header({ title, top, onBack }: { title: string; top: number; onBack: () => void }) {
  return (
    <View style={[s.header, { paddingTop: getTitleBarTopPadding(top) }]}>
      <TouchableOpacity onPress={onBack} style={s.headerBtn} activeOpacity={0.7}>
        <ArrowLeft s={24} c="#9CA3AF" />
      </TouchableOpacity>
      <Text style={s.headerTitle}>{title}</Text>
      <View style={s.headerBtn} />
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
}) {
  const insets = useSafeAreaInsets();
  const chapterKey = chapter ? `${chapter.book.id}-${chapter.chapter}` : 'empty';

  return (
    <Modal visible={!!chapter} animationType="slide" onRequestClose={onClose}>
      <View style={s.editorScreen}>
        <View style={[s.editorHeader, { paddingTop: getTitleBarTopPadding(insets.top) }]}>
          <TouchableOpacity onPress={onClose} style={s.headerBtn} activeOpacity={0.7}>
            <ArrowLeft s={24} c="#9CA3AF" />
          </TouchableOpacity>
          <View style={s.editorTitleBlock}>
            <Text style={s.editorTitle}>{chapter ? `${chapter.book.name} ${chapter.chapter}` : 'Bible Note'}</Text>
            <Text style={s.editorSub}>Chapter study note</Text>
          </View>
          <View style={s.editorActions}>
            {onDelete && (
              <TouchableOpacity onPress={onDelete} style={s.editorIconBtn} activeOpacity={0.7}>
                <Trash2 s={19} c="#EF4444" />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onSave} style={s.editorIconBtn} activeOpacity={0.7}>
              <CheckSmall s={21} c={GOLD} />
            </TouchableOpacity>
          </View>
        </View>

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
      </View>
    </Modal>
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

function DeleteBibleModal({
  visible, onCancel, onConfirm,
}: {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ConfirmModal
      visible={visible}
      icon={<Trash2 s={22} c="#EF4444" />}
      iconBg="#FEF2F2"
      title="Delete this Bible note?"
      body="This will permanently delete your note for this chapter."
      confirmLabel="DELETE"
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: TITLE_BAR_BOTTOM_PADDING,
    backgroundColor: 'rgba(245,243,238,0.96)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: F.serifMedium, fontSize: 20, letterSpacing: 2.8, color: C.text },
  searchWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 9 },
  searchBox: {
    height: 46,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    backgroundColor: 'rgba(255,255,255,0.90)',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  searchInput: { flex: 1, height: 46, fontFamily: F.serif, fontSize: 15, color: '#44403C', paddingVertical: 0 },
  tabsWrap: { paddingHorizontal: 16, paddingBottom: 12 },
  tabs: {
    flexDirection: 'row',
    gap: 3,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(232,220,196,0.60)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  tabPill: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    width: '32%',
    borderRadius: 14,
    backgroundColor: GOLD,
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 9,
    elevation: 2,
    zIndex: 0,
  },
  tabButton: { flex: 1, minHeight: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5, zIndex: 1 },
  tabActive: {},
  tabText: { fontFamily: F.serifMedium, fontSize: 13, color: '#B5ADA0' },
  tabTextActive: { color: '#FFFFFF' },
  tabCount: { minWidth: 17, height: 17, borderRadius: 9, backgroundColor: 'rgba(197,160,89,0.15)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabCountActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  tabCountText: { fontFamily: F.sansBold, fontSize: 8, color: GOLD },
  tabCountTextActive: { color: '#FFFFFF' },
  bookList: { paddingHorizontal: 16, gap: 7 },
  noBooks: { textAlign: 'center', paddingVertical: 60, fontFamily: F.serif, fontSize: 17, color: '#D1D5DB' },
  bookCard: {
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(232,216,186,0.45)',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 1,
  },
  bookCardExpanded: { backgroundColor: '#FFFDF7', borderColor: 'rgba(197,160,89,0.30)' },
  bookCardMuted: { backgroundColor: 'rgba(255,255,255,0.45)', borderColor: 'transparent', shadowOpacity: 0 },
  bookName: { flex: 1, fontFamily: F.serifMedium, fontSize: 17, color: '#2D2520' },
  bookNameMuted: { fontFamily: F.serif, color: '#C9C3BA' },
  bookCount: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 0.8, color: GOLD, backgroundColor: 'rgba(197,160,89,0.10)', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, overflow: 'hidden' },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  chapterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: CHAPTER_GAP,
    rowGap: 8,
    paddingHorizontal: CHAPTER_GRID_SIDE_PADDING,
    paddingTop: 10,
    paddingBottom: 6,
  },
  chapterCell: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(232,216,186,0.28)',
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterCellActive: { backgroundColor: '#FFFDF7', borderColor: 'rgba(197,160,89,0.45)' },
  chapterText: { fontFamily: F.serifMedium, fontSize: 15, color: '#D4CEC6' },
  chapterTextActive: { color: '#3D3229' },
  noteDot: { position: 'absolute', top: 7, right: 8, width: 5, height: 5, borderRadius: 3, backgroundColor: GOLD },

  editorScreen: { flex: 1, backgroundColor: '#FDFBF5' },
  editorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: TITLE_BAR_BOTTOM_PADDING,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(197,160,89,0.12)',
  },
  editorTitleBlock: { flex: 1, alignItems: 'center' },
  editorTitle: { fontFamily: F.serifMedium, fontSize: 21, letterSpacing: 1, color: C.text },
  editorSub: { marginTop: 2, fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.5, color: GOLD, textTransform: 'uppercase' },
  editorActions: { width: 78, flexDirection: 'row', justifyContent: 'flex-end', gap: 2 },
  editorIconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  editorContent: { padding: 18, gap: 14 },
  fieldCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8DCC4',
    backgroundColor: '#FFFDF8',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 1,
  },
  fieldLabel: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.9, color: GOLD, marginBottom: 10 },
  fieldToolbar: { marginBottom: 8 },
  fieldEditor: { height: 220 },

});
