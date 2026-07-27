import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import Svg, { Line } from 'react-native-svg';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  Book, CheckSmall, ChevronDown, Search, Trash2, X,
} from '@/components/icons/Icons';
import ConfirmModal from '@/components/shared/ConfirmModal';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import { C, F } from '@/constants/tokens';
import { RichTextEditor, RichToolbar, RichTextEditorRef, FormatState } from '@/components/shared/RichTextEditor';
import { ScriptureBibleNote, useScripture } from '@/components/scripture/ScriptureContext';
import { groupPsalmsIntoKathismata } from '@/components/scripture/kathismata';
import { HapticTouchableOpacity as TouchableOpacity, HapticPressable as Pressable } from '@/components/shared/HapticTouch';
import { useGuidedSetup, useGuideTarget } from '@/components/onboarding/guided/GuidedSetupContext';
import { GuidedOverlayHost } from '@/components/onboarding/guided/GuidedOverlayHost';


const BG = '#F5F3EE';
const GOLD = '#C5A059';
// Bible Notes is Scripture's sibling, not its copy. It borrows Scripture's
// grammar — the thin spine, the double rule, the lit edge, the leader ruled
// across to a folio — and a book with nothing written in it stays quiet
// until it has something to show.
//
// But the three parts of the Bible are three different rooms, and the screen
// changes lamp when you cross between them, exactly as Scripture does. The
// New Testament is green under a fall of diagonal rays; the Psalter is a
// pale gold and is divided into its kathismata; the Old Testament is a
// deeper brown under horizontal scroll-ruling — the same two motifs
// Scripture gives its testaments, so the two screens read as one canon.
const NOTE_GREEN = '#5E7B55';

type NoteTone = {
  accent: string;      // the ink of this room
  soft: string;        // the ink at rest, for folios and chevrons
  ground: string;      // the ground of a book that has been written in
  border: string;
  frame: string;
  frameInner: string;
  spine: string;
  leader: string;
  motif: 'rays' | 'ruling';
  pill: string;
  pillBorder: string;
  pillText: string;
  countBg: string;
  countBgActive: string;
  countText: string;
};

const NOTE_TONES: Record<BibleTab, NoteTone> = {
  nt: {
    accent: NOTE_GREEN,
    soft: '#6E8A64',
    ground: '#F7FBF4',
    border: '#DDE6D9',
    frame: 'rgba(94,123,85,0.16)',
    frameInner: 'rgba(94,123,85,0.09)',
    spine: 'rgba(94,123,85,0.45)',
    leader: '#5E7B55',
    motif: 'rays',
    pill: '#F3F9EE',
    pillBorder: 'rgba(94,123,85,0.34)',
    pillText: '#4C6647',
    countBg: 'rgba(94,123,85,0.12)',
    countBgActive: 'rgba(94,123,85,0.18)',
    countText: '#6E8A64',
  },
  psalms: {
    accent: '#C5A059',
    soft: '#A9873F',
    ground: '#FFFBF0',
    border: '#EEE1C7',
    frame: 'rgba(197,160,89,0.18)',
    frameInner: 'rgba(197,160,89,0.10)',
    spine: 'rgba(197,160,89,0.5)',
    leader: '#C5A059',
    motif: 'rays',
    pill: '#FFF8E7',
    pillBorder: 'rgba(197,160,89,0.38)',
    pillText: '#8B6B2F',
    countBg: 'rgba(197,160,89,0.13)',
    countBgActive: 'rgba(197,160,89,0.2)',
    countText: '#A9873F',
  },
  ot: {
    // The Old Testament's brown: the elder half of the canon, and the
    // deepest note on either screen.
    accent: '#8A6A45',
    soft: '#8A6A45',
    ground: '#FBF5EC',
    border: '#E6D9C6',
    frame: 'rgba(138,106,69,0.17)',
    frameInner: 'rgba(138,106,69,0.09)',
    spine: 'rgba(138,106,69,0.45)',
    leader: '#8A6A45',
    motif: 'ruling',
    pill: '#F7EFE3',
    pillBorder: 'rgba(138,106,69,0.36)',
    pillText: '#6E5334',
    countBg: 'rgba(138,106,69,0.12)',
    countBgActive: 'rgba(138,106,69,0.19)',
    countText: '#8A6A45',
  },
};
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
  back: 'bible-notes.back',
} as const;

export default function BibleNotesView({
  guided = false,
  initialBookId,
  initialChapter,
  onGuidedComplete,
  onGuidedReady,
}: {
  guided?: boolean;
  initialBookId?: number;
  initialChapter?: number;
  onGuidedComplete?: () => void;
  onGuidedReady?: () => void;
} = {}) {
  const router = useRouter();
  const params = useLocalSearchParams<{ bookId?: string; chapter?: string; open?: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { ready, bibleNotes, saveBibleNote, deleteBibleNote } = useScripture();

  const { session, patchSession, setPresentation } = useGuidedSetup();
  const isGuided = guided && session?.active === true && session.activeStep === 'riseBibleHighlight';
  const guidePhase = isGuided ? session.phase : '';
  const tabsTarget = useGuideTarget(BIBLE_NOTES_GUIDE_TARGETS.tabs, isGuided);
  const searchTarget = useGuideTarget(BIBLE_NOTES_GUIDE_TARGETS.search, isGuided);
  const backTarget = useGuideTarget(BIBLE_NOTES_GUIDE_TARGETS.back, isGuided);
  const guideEntryOpenedRef = useRef(false);
  const guideActionLockRef = useRef(false);
  const guidedReadyNotifiedRef = useRef(false);
  const guideTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const guideStageTokenRef = useRef(0);
  const visibleBibleNotes = useMemo<ScriptureBibleNote[]>(
    () => (isGuided ? [] : bibleNotes),
    [bibleNotes, isGuided],
  );

  const clearGuideTimers = useCallback(() => {
    guideStageTokenRef.current += 1;
    guideTimersRef.current.forEach(clearTimeout);
    guideTimersRef.current = [];
  }, []);

  useEffect(() => {
    if (!isGuided || !ready || !onGuidedReady || guidedReadyNotifiedRef.current) return undefined;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const confirmReady = (attempt = 0) => {
      tabsTarget.measureNow(layout => {
        if (cancelled || guidedReadyNotifiedRef.current) return;
        if (!layout) {
          if (attempt >= 48) {
            guidedReadyNotifiedRef.current = true;
            onGuidedReady();
            return;
          }
          retryTimer = setTimeout(
            () => confirmReady(attempt + 1),
            32,
          );
          return;
        }
        guidedReadyNotifiedRef.current = true;
        onGuidedReady();
      });
    };
    const frame = requestAnimationFrame(() => confirmReady());
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [isGuided, onGuidedReady, ready, tabsTarget]);

  const stageStaticTarget = useCallback((
    target: ReturnType<typeof useGuideTarget>,
    present: () => void,
    onUnavailable: () => void,
    attempt = 0,
    token = guideStageTokenRef.current,
  ) => {
    if (token !== guideStageTokenRef.current) return;
    target.measureNow(layout => {
      if (token !== guideStageTokenRef.current) return;
      if (!layout) {
        if (attempt >= 24) {
          onUnavailable();
          return;
        }
        guideTimersRef.current.push(setTimeout(
          () => stageStaticTarget(target, present, onUnavailable, attempt + 1, token),
          48,
        ));
        return;
      }
      guideTimersRef.current.push(setTimeout(() => {
        if (token === guideStageTokenRef.current) present();
      }, 42));
    });
  }, []);

  const handleGuidedBack = useCallback(() => {
    if (!isGuided) {
      onGuidedComplete?.();
      return;
    }
    if (guideActionLockRef.current) return;
    guideActionLockRef.current = true;
    setPresentation(null);
    onGuidedComplete?.();
  }, [isGuided, onGuidedComplete, setPresentation]);

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<BibleTab>('nt');
  const tabProgress = useSharedValue(0);
  const [tabsWidth, setTabsWidth] = useState(0);
  const tabPillWidth = tabsWidth > 0 ? (tabsWidth - 14) / 3 : 0;
  const tabPillTravel = tabPillWidth + 3;

  useEffect(() => {
    guideActionLockRef.current = false;
  }, [guidePhase]);

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
    visibleBibleNotes.forEach(note => map.set(noteKey(note.bookId, note.chapter), note));
    return map;
  }, [visibleBibleNotes]);

  const filteredBooks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return BOOKS.filter(book => tabMatches(book, activeTab))
      .filter(book => !q || book.name.toLowerCase().includes(q));
  }, [activeTab, search]);

  // The room the screen is standing in.
  const tone = NOTE_TONES[activeTab];

  const tabCount = (tab: BibleTab) => visibleBibleNotes.filter(note => {
    const book = BOOKS.find(item => item.id === note.bookId);
    return book ? tabMatches(book, tab) : false;
  }).length;

  const chapterGridWidth = Math.min(width, 430) - (PAGE_SIDE_PADDING * 2) - (CHAPTER_GRID_SIDE_PADDING * 2);
  const chapterCellWidth = Math.floor((chapterGridWidth - (CHAPTER_GAP * (CHAPTER_COLUMNS - 1))) / CHAPTER_COLUMNS);

  useEffect(() => {
    if (guided || isGuided) {
      openedFromDeepLinkRef.current = false;
      setActiveChapter(null);
      return;
    }
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
  }, [guided, isGuided, notesByChapter, params.bookId, params.chapter, params.open]);

  const openChapter = (book: BibleBook, chapter: number) => {
    if (isGuided && guidePhase !== 'noteEntry') return;
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
      setPresentation({
        key: 'bible-notes-editor',
        placement: 'bottom',
        lightScrim: true,
        eyebrow: 'BIBLE NOTES',
        message: 'Every chapter note has three parts: what you observed, what God is teaching, and how you will live it.',
        highlights: ['what you observed', 'what God is teaching', 'how you will live it'],
        chips: ['Observations', 'Lessons', 'Application'],
        ctaLabel: 'Continue',
        onCta: () => {
          setPresentation(null);
          setActiveChapter(null);
          patchSession({ phase: 'notesTabs' });
        },
      });
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
    if (guidePhase === 'legacyNotesSearch') {
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
        onCta: () => patchSession({ phase: 'notesRhythm' }),
      });
      return;
    }
    if (guidePhase === 'notesRhythm') {
      setPresentation({
        key: 'bible-notes-rhythm',
        placement: 'center',
        lightScrim: true,
        eyebrow: 'SCRIPTURE IN YOUR RHYTHM',
        message: 'A Bible reading can become a task or a challenge, and your saved Favorites remain one tap away from the Scripture reader.',
        highlights: ['task or a challenge', 'Favorites'],
        chips: ['Daily task', 'Challenge', 'Favorites'],
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

  useEffect(() => {
    if (!isGuided) return;
    clearGuideTimers();

    if (guidePhase === 'notesOverview') {
      stageStaticTarget(tabsTarget, () => {
        setPresentation({
          key: 'bible-notes-overview-v2',
          coachGroupKey: 'bible-primary-coach',
          targetId: BIBLE_NOTES_GUIDE_TARGETS.tabs,
          cutoutPadding: 7,
          placement: 'below',
          allowTargetInteraction: false,
          eyebrow: 'BIBLE NOTES',
          message: 'Your chapter notes are organized by New Testament, Psalter, and Old Testament.',
          highlights: ['chapter notes'],
          chips: ['New Testament', 'Psalter', 'Old Testament'],
          ctaLabel: 'Continue',
          onCta: () => patchSession({ phase: 'notesSearch' }),
        });
      }, () => {
        setPresentation(null);
        patchSession({ phase: 'notesSearch' });
      });
      return;
    }

    if (guidePhase === 'notesSearch') {
      stageStaticTarget(searchTarget, () => {
        setPresentation({
          key: 'bible-notes-search-v2',
          coachGroupKey: 'bible-primary-coach',
          targetId: BIBLE_NOTES_GUIDE_TARGETS.search,
          cutoutPadding: 7,
          placement: 'below',
          allowTargetInteraction: false,
          eyebrow: 'BIBLE NOTES',
          message: 'Search by book to find the note you need.',
          highlights: ['Search by book'],
          ctaLabel: 'Continue',
          onCta: () => patchSession({ phase: 'notesBack' }),
        });
      }, () => {
        setPresentation(null);
        patchSession({ phase: 'notesBack' });
      });
      return;
    }

    if (guidePhase === 'notesBack') {
      stageStaticTarget(backTarget, () => {
        setPresentation({
          key: 'bible-notes-back-v2',
          coachGroupKey: 'bible-primary-coach',
          targetId: BIBLE_NOTES_GUIDE_TARGETS.back,
          cutoutPadding: 7,
          placement: 'below',
          allowTargetInteraction: true,
          eyebrow: 'BIBLE NOTES',
          message: 'Return to Holy Scripture.',
          action: 'Tap the back arrow',
          hint: 'tap',
        });
      }, handleGuidedBack);
    }
  }, [
    backTarget,
    clearGuideTimers,
    guidePhase,
    handleGuidedBack,
    isGuided,
    patchSession,
    searchTarget,
    setPresentation,
    stageStaticTarget,
    tabsTarget,
  ]);

  useEffect(() => clearGuideTimers, [clearGuideTimers, guidePhase]);

  const saveChapter = async () => {
    if (!activeChapter) return;
    if (isGuided) {
      setActiveChapter(null);
      handleGuidedEditorClosed();
      return;
    }
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

  const openChapterInScripture = () => {
    if (!activeChapter) return;
    if (isGuided) return;

    const target = activeChapter;
    const cleanObservations = observations.trim();
    const cleanLessons = lessons.trim();
    const cleanApplication = application.trim();

    // saveBibleNote updates shared Scripture state optimistically, allowing
    // the reader sheet to show this draft on the very next screen.
    void saveBibleNote(
      target.book.id,
      target.chapter,
      cleanObservations,
      cleanLessons,
      cleanApplication,
    ).catch(error => console.warn('Failed to save Bible note before opening Scripture', error));

    openedFromDeepLinkRef.current = false;
    setActiveChapter(null);
    router.push({
      pathname: '/scripture-reader',
      params: {
        bookId: String(target.book.id),
        chapter: String(target.chapter),
        bibleNotes: 'collapsed',
      },
    });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (isGuided) {
      setDeleteTarget(null);
      setActiveChapter(null);
      return;
    }
    await deleteBibleNote(deleteTarget.bookId, deleteTarget.chapter);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setDeleteTarget(null);
    setActiveChapter(null);
  };

  return (
    <View style={s.screen}>
      <ScreenTitleBar
        title="BIBLE NOTES"
        showBack
        bg={BG}
        onBackOverride={isGuided ? handleGuidedBack : undefined}
        backButtonProps={isGuided ? {
          ref: backTarget.ref,
          onLayout: backTarget.onLayout,
        } : undefined}
      />

      <View ref={searchTarget.ref} onLayout={searchTarget.onLayout} style={s.searchWrap}>
        <View style={s.searchBox}>
          <Search s={15} c="#D1D5DB" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            editable={!isGuided}
            placeholder="Search books..."
            placeholderTextColor="#D1D5DB"
            style={s.searchInput}
          />
          {!!search && (
            <Pressable onPress={() => {
              if (!isGuided) setSearch('');
            }} hitSlop={8}>
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
            style={[
              s.tabPill,
              { backgroundColor: tone.pill, borderColor: tone.pillBorder, shadowColor: tone.accent },
              tabPillMotionStyle,
            ]}
          />
          <TabButton label="New Test." tone={tone} active={activeTab === 'nt'} count={tabCount('nt')} onPress={() => {
            if (!isGuided) setActiveTab('nt');
          }} />
          <TabButton label="Psalter" tone={tone} active={activeTab === 'psalms'} count={tabCount('psalms')} onPress={() => {
            if (!isGuided) setActiveTab('psalms');
          }} />
          <TabButton label="Old Test." tone={tone} active={activeTab === 'ot'} count={tabCount('ot')} onPress={() => {
            if (!isGuided) setActiveTab('ot');
          }} />
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
                  <NotedBookRow
                    name={book.name}
                    count={chaptersWithNotes.length}
                    expanded={isExpanded}
                    tone={tone}
                    onPress={() => {
                      if (!isGuided) setExpandedBookId(isExpanded ? null : book.id);
                    }}
                  />
                )}

                {isExpanded && (
                  <Reanimated.View
                    entering={FadeInDown.duration(168).easing(BIBLE_NOTES_EASE).withInitialValues({
                      opacity: 0,
                      transform: [{ translateY: 8 }],
                    })}
                    exiting={FadeOutUp.duration(118).easing(Easing.out(Easing.cubic))}
                    layout={bibleNotesLayout}
                  >
                    {activeTab === 'psalms' ? (
                      // The Psalter is read in kathismata, so it is written in
                      // them too — the same twenty divisions Holy Scripture
                      // lays it out in, from the same shared table.
                      groupPsalmsIntoKathismata(
                        Array.from({ length: book.chapters }, (_, index) => index + 1),
                      ).map(section => (
                        <View key={section.key}>
                          <View style={s.kathismaHead}>
                            <View style={[s.kathismaRule, { backgroundColor: tone.frame }]} />
                            <View style={[s.kathismaDiamond, { backgroundColor: tone.spine }]} />
                            <Text style={[s.kathismaLabel, { color: tone.soft }]} numberOfLines={1}>
                              {section.label}
                            </Text>
                            <View style={[s.kathismaDiamond, { backgroundColor: tone.spine }]} />
                            <View style={[s.kathismaRule, { backgroundColor: tone.frame }]} />
                          </View>
                          <View style={s.chapterGrid}>
                            {section.psalms.map(chapter => (
                              <ChapterCell
                                key={chapter}
                                chapter={chapter}
                                width={chapterCellWidth}
                                tone={tone}
                                hasNote={notesByChapter.has(noteKey(book.id, chapter))}
                                onPress={() => {
                                  if (!isGuided) openChapter(book, chapter);
                                }}
                              />
                            ))}
                          </View>
                        </View>
                      ))
                    ) : (
                      <View style={s.chapterGrid}>
                        {Array.from({ length: book.chapters }, (_, index) => index + 1).map(chapter => (
                          <ChapterCell
                            key={chapter}
                            chapter={chapter}
                            width={chapterCellWidth}
                            tone={tone}
                            hasNote={notesByChapter.has(noteKey(book.id, chapter))}
                            onPress={() => {
                              if (!isGuided) openChapter(book, chapter);
                            }}
                          />
                        ))}
                      </View>
                    )}
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
        onScripture={openChapterInScripture}
        onDelete={!isGuided && activeChapter?.note ? () => setDeleteTarget(activeChapter.note ?? null) : undefined}
        deleteVisible={!!deleteTarget}
        onCancelDelete={() => setDeleteTarget(null)}
        onConfirmDelete={confirmDelete}
        guidedOverlay={isGuided && guidePhase === 'noteEntry' ? <GuidedOverlayHost /> : undefined}
      />
    </View>
  );
}

// The room's own light, raked behind a book that has been written in. Rays
// for the New Testament and the Psalter, horizontal scroll-ruling for the
// Old — the two motifs Scripture gives its testaments.
function NoteMotif({ tone }: { tone: NoteTone }) {
  const W = 170;
  const H = 90;
  return (
    <View pointerEvents="none" style={s.noteMotif}>
      <Svg width={W} height={H}>
        {tone.motif === 'rays'
          ? Array.from({ length: 5 }).map((_, index) => {
            const offset = index * 26;
            return (
              <Line
                key={index}
                x1={W - offset}
                y1={-6}
                x2={W - offset - 56}
                y2={H + 6}
                stroke={tone.accent}
                strokeOpacity={0.075}
                strokeWidth={1}
              />
            );
          })
          : Array.from({ length: 5 }).map((_, index) => {
            const y = 12 + index * 17;
            return (
              <Line
                key={index}
                x1={16}
                y1={y}
                x2={W}
                y2={y}
                stroke={tone.accent}
                strokeOpacity={0.085}
                strokeWidth={1}
              />
            );
          })}
      </Svg>
    </View>
  );
}

function NotedBookRow({
  name, count, expanded, tone, onPress,
}: {
  name: string;
  count: number;
  expanded: boolean;
  tone: NoteTone;
  onPress: () => void;
}) {
  // Measured, not scaled: a viewBox would stretch each dot as the leader
  // lengthens, so short names would be ruled in different dots than long.
  const [leaderWidth, setLeaderWidth] = useState(0);
  const written = count > 0;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      style={[
        s.bookCard,
        written
          ? [s.bookCardWritten, { backgroundColor: tone.ground, borderColor: tone.border }]
          : s.bookCardBlank,
        expanded && { borderColor: tone.pillBorder },
      ]}
    >
      {written && <NoteMotif tone={tone} />}
      {written && <View pointerEvents="none" style={[s.bookFrame, { borderColor: tone.frame }]} />}
      {written && <View pointerEvents="none" style={[s.bookFrameInner, { borderColor: tone.frameInner }]} />}
      <View pointerEvents="none" style={s.bookLit} />
      <View
        pointerEvents="none"
        style={[s.bookSpine, { backgroundColor: written ? tone.spine : 'rgba(198,193,183,0.5)' }]}
      />
      <View style={s.bookCopy}>
        <View style={s.bookLine}>
          <Text style={[s.bookName, !written && s.bookNameMuted]} numberOfLines={1}>{name}</Text>
          {written && (
            <>
              <View
                style={s.bookLeader}
                onLayout={event => setLeaderWidth(event.nativeEvent.layout.width)}
              >
                {leaderWidth > 0 && (
                  <Svg width={leaderWidth} height={4}>
                    <Line
                      x1={0}
                      y1={2}
                      x2={leaderWidth}
                      y2={2}
                      stroke={tone.leader}
                      strokeOpacity={0.32}
                      strokeWidth={1.4}
                      strokeLinecap="round"
                      strokeDasharray="0.5 5"
                    />
                  </Svg>
                )}
              </View>
              <Text style={[s.bookFolio, { color: tone.soft }]}>{count}</Text>
            </>
          )}
        </View>
      </View>
      <View
        style={[
          s.chevronWrap,
          written && { borderColor: tone.pillBorder },
          expanded && s.chevronOpen,
        ]}
      >
        <ChevronDown s={13} c={written ? tone.soft : '#C7C2B8'} />
      </View>
    </TouchableOpacity>
  );
}

function ChapterCell({
  chapter, width, tone, hasNote, onPress,
}: {
  chapter: number;
  width: number;
  tone: NoteTone;
  hasNote: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      style={[
        s.chapterCell,
        { width },
        hasNote && [s.chapterCellActive, {
          backgroundColor: tone.ground,
          borderColor: tone.pillBorder,
          shadowColor: tone.accent,
        }],
      ]}
    >
      <View pointerEvents="none" style={s.chapterCellLit} />
      <Text style={[s.chapterText, hasNote && s.chapterTextActive]}>{chapter}</Text>
      {hasNote && <View style={[s.noteDot, { backgroundColor: tone.accent }]} />}
    </TouchableOpacity>
  );
}

function TabButton({
  label, active, count, tone, onPress,
}: {
  label: string;
  active: boolean;
  count: number;
  tone: NoteTone;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.86} style={s.tabButton}>
      <Text style={[s.tabText, active && { color: tone.pillText }]} numberOfLines={1}>{label}</Text>
      {count > 0 && (
        <View style={[s.tabCount, { backgroundColor: active ? tone.countBgActive : tone.countBg }]}>
          <Text style={[s.tabCountText, { color: active ? tone.pillText : tone.countText }]}>{count}</Text>
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
  onScripture,
  onDelete,
  deleteVisible,
  onCancelDelete,
  onConfirmDelete,
  guidedOverlay,
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
  onScripture: () => void;
  onDelete?: () => void;
  deleteVisible: boolean;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  guidedOverlay?: React.ReactNode;
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
          sideWidth={132}
          rightElement={(
            <View style={s.editorActions}>
            <TouchableOpacity
              onPress={onScripture}
              accessibilityRole='button'
              accessibilityLabel='Open this chapter in Scripture'
              style={[s.editorIconBtn, s.editorScriptureBtn]}
              activeOpacity={0.76}
            >
              <Book s={18} c='#55705C' />
            </TouchableOpacity>
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
        {guidedOverlay}
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
    // Recessed track, raised leaf: a pale plaque on a white track had
    // nothing to lift off, which is why this pill used to be solid gold.
    borderColor: '#E4DED2',
    backgroundColor: '#EDEAE2',
    padding: 4,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.055,
    shadowRadius: 14,
    elevation: 1,
  },
  // The selected tab is a leaf of the notebook, not a gold slab: the same
  // pale green page the written books wear, under a green hairline.
  tabPill: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    width: '32%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(94,123,85,0.34)',
    backgroundColor: '#F3F9EE',
    shadowColor: NOTE_GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 2,
    zIndex: 0,
  },
  tabButton: { flex: 1, minHeight: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5, zIndex: 1 },
  tabActive: {},
  tabText: { fontFamily: F.serifMedium, fontSize: 13.5, color: '#9A968C' },
  tabCount: { minWidth: 17, height: 17, borderRadius: 9, backgroundColor: 'rgba(94,123,85,0.12)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabCountText: { fontFamily: F.sansBold, fontSize: 8, color: '#6E8A64' },
  bookList: { paddingHorizontal: 16, gap: 5 },
  noBooks: { textAlign: 'center', paddingVertical: 60, fontFamily: F.serif, fontSize: 17, color: '#D1D5DB' },
  // The shelf card of Scripture, read in the notebook's register. A book
  // that has been written in carries the ruled page, the double rule and a
  // leader out to its count; one that has not stays a blank line.
  bookCard: {
    minHeight: 54,
    borderRadius: 19,
    borderCurve: 'continuous',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingLeft: 14,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  bookCardWritten: {
    borderColor: '#DDE6D9',
    backgroundColor: '#F7FBF4',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.045,
    shadowRadius: 14,
    elevation: 1,
  },
  bookCardBlank: {
    borderColor: 'rgba(226,222,213,0.7)',
    backgroundColor: 'rgba(252,251,248,0.72)',
  },
  bookCardExpanded: { borderColor: 'rgba(94,123,85,0.4)' },
  noteMotif: { position: 'absolute', top: 0, right: 0, bottom: 0, overflow: 'hidden' },
  bookFrame: {
    position: 'absolute',
    top: 5,
    left: 5,
    right: 5,
    bottom: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(94,123,85,0.16)',
  },
  bookFrameInner: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    bottom: 8,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(94,123,85,0.09)',
  },
  bookLit: {
    position: 'absolute',
    top: 1,
    left: 10,
    right: 10,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  bookSpine: {
    position: 'absolute',
    left: 0,
    top: 9,
    bottom: 9,
    width: 2.5,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  bookSpineBlank: { backgroundColor: 'rgba(198,193,183,0.5)' },
  bookCopy: { flex: 1, minWidth: 0, justifyContent: 'center' },
  bookLine: { flexDirection: 'row', alignItems: 'baseline', gap: 9, minWidth: 0 },
  bookName: { fontFamily: F.serif, fontSize: 17.5, lineHeight: 21, letterSpacing: 0.25, color: '#2D2520', flexShrink: 1 },
  bookNameMuted: { color: '#BDB8AF' },
  bookLeader: { flex: 1, minWidth: 10, height: 4, alignSelf: 'center' },
  bookFolio: {
    fontFamily: F.serif,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 0.3,
    color: '#6E8A64',
    fontVariant: ['lining-nums', 'tabular-nums'],
  },
  chevronWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(214,209,199,0.5)',
    flexShrink: 0,
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
  kathismaHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 12,
    marginBottom: 7,
    paddingHorizontal: CHAPTER_GRID_SIDE_PADDING + 2,
  },
  kathismaRule: { flex: 1, height: 1 },
  kathismaDiamond: {
    width: 4,
    height: 4,
    borderRadius: 0.8,
    transform: [{ rotate: '45deg' }],
  },
  kathismaLabel: { fontFamily: F.sansBold, fontSize: 8.8, letterSpacing: 2.1 },
  chapterCellLit: {
    position: 'absolute',
    top: 1,
    left: 7,
    right: 7,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  chapterCell: {
    overflow: 'hidden',
    minHeight: 44,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(232,216,186,0.32)',
    backgroundColor: 'rgba(255,255,255,0.90)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterCellActive: {
    backgroundColor: '#F4FAF0',
    borderColor: 'rgba(94,123,85,0.42)',
    shadowColor: NOTE_GREEN,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 1,
  },
  chapterText: { fontFamily: F.serifMedium, fontSize: 15, color: '#D4CEC6' },
  chapterTextActive: { color: '#3D3229' },
  noteDot: { position: 'absolute', top: 7, right: 8, width: 5, height: 5, borderRadius: 2.5, backgroundColor: NOTE_GREEN },

  editorScreen: { flex: 1, backgroundColor: '#FDFBF5' },
  editorActions: { width: 130, flexDirection: 'row', justifyContent: 'flex-end', gap: 7 },
  editorIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  editorDeleteBtn: { backgroundColor: '#FEF2F2', borderColor: 'rgba(190,18,60,0.14)' },
  editorScriptureBtn: { backgroundColor: '#F1F6EF', borderColor: 'rgba(85,112,92,0.16)' },
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
  // Identity is green on this screen, action stays gold: the field heads
  // name what you are writing, so they follow the notebook; the save button
  // is the app's confirm and keeps the app's colour.
  fieldLabel: { fontFamily: F.sansBold, fontSize: 10.5, letterSpacing: 2.05, color: '#6E8A64', marginBottom: 9 },
  fieldToolbar: { marginBottom: 8 },
  fieldEditor: { height: 220 },

});
