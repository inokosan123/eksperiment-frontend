import React, {
  startTransition, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  type StyleProp,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  Easing,
  FadeIn,
  interpolateColor,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Line, Path } from 'react-native-svg';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  CheckSmall,
  Book, ChevronRight, Notebook,
  OpenBook, Search, Settings, Star, X,
} from '@/components/icons/Icons';
import {
  BIBLE_BOOKS,
  BibleBook,
  normalizeScriptureLanguage,
  PSALMS_ID,
  SCRIPTURE_LANGUAGE_DETAILS,
  SCRIPTURE_LANGUAGES,
  ScriptureLanguage,
} from '@/constants/scripture';
import { C, F } from '@/constants/tokens';
import { groupPsalmsIntoKathismata } from '@/components/scripture/kathismata';
import { ScriptureSearchResult, useScripture } from './ScriptureContext';
import SetAsDailyTaskCard from '@/components/shared/SetAsDailyTaskCard';
import SetAsTaskSheet from '@/components/shared/SetAsTaskSheet';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import { DoorGround, DoorSeal, doorInk } from '@/components/scripture/ScriptureDoor';
import { useAppSettings } from '@/components/settings/SettingsContext';
import { useTasks } from '@/components/tasks/TaskProvider';
import { HapticTouchableOpacity as TouchableOpacity, HapticPressable as Pressable } from '@/components/shared/HapticTouch';
import { useGuidedSetup, useGuideTarget } from '@/components/onboarding/guided/GuidedSetupContext';
import { useGuidedScrollTransition } from '@/components/onboarding/guided/use-guided-scroll-transition';
import { ReadableText } from '@/components/shared/typographyScale';


const BG = '#FCFCFC';
const GOLD = '#C5A059';
const GREEN = '#5E7B55';
const ROSE = '#BE123C';

type ScriptureTab = 'bible' | 'psalter';
type ScriptureGuideEntryTarget = 'top' | 'bibleNotes' | 'browse';
const SEGMENT_SLIDE_MS = 210;
const SEGMENT_CONTENT_COMMIT_DELAY_MS = SEGMENT_SLIDE_MS + 24;
const SEGMENT_SLIDE = {
  duration: SEGMENT_SLIDE_MS,
  easing: Easing.bezier(0.22, 1, 0.36, 1),
};
const SEGMENT_PRESS_IN = { duration: 70 };
const SEGMENT_PRESS_OUT = { duration: 120 };
const INITIAL_BOOK_RENDER_COUNT = 8;
const BOOK_RENDER_BATCH_SIZE = 4;
const INITIAL_PSALTER_SECTION_COUNT = 3;
const PSALTER_RENDER_BATCH_SIZE = 2;
const FIRST_CONTENT_BATCH_DELAY_MS = 240;
const NEXT_CONTENT_BATCH_DELAY_MS = 80;
const CONTENT_IDLE_TIMEOUT_MS = 500;

type IdleRuntime = typeof globalThis & {
  requestIdleCallback?: (
    callback: () => void,
    options?: { timeout: number },
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

function scheduleContentBatch(callback: () => void, delayMs: number) {
  const runtime = globalThis as IdleRuntime;
  let idleHandle: number | null = null;
  const delayHandle = setTimeout(() => {
    if (runtime.requestIdleCallback) {
      idleHandle = runtime.requestIdleCallback(callback, {
        timeout: CONTENT_IDLE_TIMEOUT_MS,
      });
      return;
    }
    callback();
  }, delayMs);

  return () => {
    clearTimeout(delayHandle);
    if (idleHandle !== null) runtime.cancelIdleCallback?.(idleHandle);
  };
}

const NEW_TESTAMENT_MOTIF_PATH = Array.from({ length: 6 }, (_, index) => {
  const offset = index * 26;
  return `M ${200 - offset} -6 L ${200 - offset - 62} 106`;
}).join(' ');
const OLD_TESTAMENT_MOTIF_PATH = Array.from({ length: 5 }, (_, index) => {
  const offset = index * 26;
  return `M ${200 - offset - 62} -6 L ${200 - offset} 106`;
}).join(' ');

const NEW_TESTAMENT = BIBLE_BOOKS.filter(book => book.testament === 'nt');
const OLD_TESTAMENT = BIBLE_BOOKS.filter(book => book.testament !== 'nt' && book.id !== PSALMS_ID);
const PSALTER = BIBLE_BOOKS.filter(book => book.id === PSALMS_ID);
const PSALMS_BOOK = PSALTER[0];
const ALL_PSALM_NUMBERS = Array.from(
  { length: PSALMS_BOOK?.chapters ?? 151 },
  (_, index) => index + 1,
);
const EMPTY_SEARCH_RESULTS: ScriptureSearchResult[] = [];
const HOLY_SCRIPTURE_GUIDE_TARGETS = {
  ephesians: 'scripture-library.ephesians',
  chapterFive: 'scripture-library.chapter-five',
  bibleNotes: 'scripture-library.bible-notes',
  bibleNotesAction: 'scripture-library.bible-notes-action',
  rhythm: 'scripture-library.rhythm',
  browse: 'scripture-library.browse',
} as const;

export default function HolyScriptureView({
  guided = false,
  onGuidedOpen,
  onGuidedOpenBibleNotes,
  onGuidedComplete,
  onGuidedReady,
  guidedEntryTarget = 'top',
}: {
  guided?: boolean;
  onGuidedOpen?: (bookId: number, chapter: number) => void;
  onGuidedOpenBibleNotes?: () => void;
  onGuidedComplete?: () => void;
  onGuidedReady?: () => void;
  guidedEntryTarget?: ScriptureGuideEntryTarget;
} = {}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height: screenHeight } = useWindowDimensions();
  const { ready, searchVerses } = useScripture();
  const { settings, updateSettings } = useAppSettings();
  const scriptureLanguage = normalizeScriptureLanguage(settings.bibleLang);
  const { createOrUpdateTask, refresh: refreshTasks } = useTasks();

  const [tab, setTab] = useState<ScriptureTab>('bible');
  const [psalterPrepared, setPsalterPrepared] = useState(false);
  const tabProgress = useSharedValue(0);
  const [segWidth, setSegWidth] = useState(0);
  const [activeSection, setActiveSection] = useState<'new' | 'old'>('new');
  const [oldTestamentPrepared, setOldTestamentPrepared] = useState(false);
  const sectionProgress = useSharedValue(0);
  const [sectionWrapWidth, setSectionWrapWidth] = useState(0);
  const segPillWidth = segWidth > 0 ? (segWidth - 12) / 2 : 0;
  const segPillTravel = segPillWidth + 4;
  const sectionPillWidth = sectionWrapWidth > 0 ? (sectionWrapWidth - 14) / 2 : 0;
  const sectionPillTravel = sectionPillWidth + 4;
  const [expandedBookId, setExpandedBookId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ScriptureSearchResult[]>([]);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [showTaskSheet, setShowTaskSheet] = useState(false);
  const [taskSummary, setTaskSummary] = useState('Add to your daily routine');
  const tabIntentRef = useRef<ScriptureTab>('bible');
  const sectionIntentRef = useRef<'new' | 'old'>('new');
  const tabCommitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sectionCommitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { session, patchSession, setPresentation } = useGuidedSetup();
  const isGuided = guided && session?.active === true && session.activeStep === 'riseBibleHighlight';
  const guidePhase = isGuided ? session.phase : '';
  const ephesiansTarget = useGuideTarget(HOLY_SCRIPTURE_GUIDE_TARGETS.ephesians, isGuided);
  const chapterFiveTarget = useGuideTarget(HOLY_SCRIPTURE_GUIDE_TARGETS.chapterFive, isGuided);
  const bibleNotesTarget = useGuideTarget(HOLY_SCRIPTURE_GUIDE_TARGETS.bibleNotes, isGuided);
  const bibleNotesActionTarget = useGuideTarget(HOLY_SCRIPTURE_GUIDE_TARGETS.bibleNotesAction, isGuided);
  const rhythmTarget = useGuideTarget(HOLY_SCRIPTURE_GUIDE_TARGETS.rhythm, isGuided);
  const browseTarget = useGuideTarget(HOLY_SCRIPTURE_GUIDE_TARGETS.browse, isGuided);
  const guideScrollRef = useRef<ScrollView>(null);
  const guideActionLockRef = useRef('');
  const guidedReadyNotifiedRef = useRef(false);
  const {
    clear: clearGuideTimers,
    finish: finishGuideScroll,
    onScroll: handleGuideScroll,
    schedule: scheduleGuide,
    scrollYRef: guideScrollYRef,
    stageTarget: stageGuideScrollTarget,
  } = useGuidedScrollTransition({
    scrollRef: guideScrollRef,
    screenHeight,
    setPresentation,
    // Ephesians can sit several viewports below the hub. The native momentum
    // event normally wins; this only prevents an early fallback on slower phones.
    scrollFallbackMs: 620,
    dismissOnAnyReposition: true,
  });

  const query = searchQuery.trim().toLowerCase();

  const guidedEntryDesiredY = useCallback((
    entry: Exclude<ScriptureGuideEntryTarget, 'top'>,
    targetHeight: number,
  ) => {
    const baseY = entry === 'bibleNotes'
      ? Math.max(126, screenHeight * 0.18)
      : Math.max(150, screenHeight * 0.24);
    return baseY - Math.max(0, targetHeight - 56) * 0.22;
  }, [screenHeight]);

  useEffect(() => {
    if (
      !isGuided
      || !ready
      || !onGuidedReady
      || guidedReadyNotifiedRef.current
    ) return undefined;

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
    const finishReady = () => {
      if (cancelled || guidedReadyNotifiedRef.current) return;
      guidedReadyNotifiedRef.current = true;
      onGuidedReady();
    };

    if (guidedEntryTarget === 'top') {
      guideScrollRef.current?.scrollTo({ y: 0, animated: false });
      guideScrollYRef.current = 0;
      scheduleFrames(finishReady);
    } else {
      const target = guidedEntryTarget === 'bibleNotes' ? bibleNotesTarget : browseTarget;
      const positionTarget = (attempt = 0) => {
        if (cancelled || guidedReadyNotifiedRef.current) return;
        target.measureNow(layout => {
          if (cancelled || guidedReadyNotifiedRef.current) return;
          if (!layout) {
            if (attempt >= 48) {
              finishReady();
              return;
            }
            retryTimer = setTimeout(() => positionTarget(attempt + 1), 40);
            return;
          }

          const desiredY = guidedEntryDesiredY(guidedEntryTarget, layout.height);
          const delta = layout.y - desiredY;
          const visible = layout.y < screenHeight - 8
            && layout.y + layout.height > insets.top + 56;
          if (Math.abs(delta) <= 3) {
            finishReady();
            return;
          }

          if (attempt >= 48) {
            finishReady();
            return;
          }

          const nextScrollY = Math.max(0, guideScrollYRef.current + delta);
          if (nextScrollY === 0 && guideScrollYRef.current === 0 && visible) {
            finishReady();
            return;
          }
          guideScrollRef.current?.scrollTo({ y: nextScrollY, animated: false });
          // The silent jump does not always dispatch an onScroll event before
          // the incoming screen is revealed. Keep the choreography's source
          // of truth in sync so the first spotlight never corrects twice.
          guideScrollYRef.current = nextScrollY;
          scheduleFrames(() => positionTarget(attempt + 1));
        });
      };
      scheduleFrames(positionTarget);
    }

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      frames.forEach(cancelAnimationFrame);
    };
  }, [
    bibleNotesTarget,
    browseTarget,
    guideScrollYRef,
    guidedEntryDesiredY,
    guidedEntryTarget,
    insets.top,
    isGuided,
    onGuidedReady,
    ready,
    screenHeight,
  ]);
  const psalmCardWidth = useMemo(() => {
    const contentWidth = Math.min(width, 430) - 44;
    return Math.max(128, Math.floor((contentWidth - 10) / 2));
  }, [width]);
  const psalmNumbers = useMemo(() => {
    if (!query) return ALL_PSALM_NUMBERS;

    const numberPart = query.replace(/^psalms?\s*/, '').trim();
    return ALL_PSALM_NUMBERS.filter(number =>
      `psalm ${number}`.includes(query)
      || `psalms ${number}`.includes(query)
      || (!!numberPart && String(number).includes(numberPart)));
  }, [query]);

  useFocusEffect(
    useCallback(() => {
      setExpandedBookId(null);
    }, []),
  );

  useEffect(() => {
    if (!ready || query.length < 2) {
      setSearchResults([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      searchVerses(query, scriptureLanguage).then(results => {
        if (cancelled) return;
        startTransition(() => {
          setSearchResults(tab === 'psalter'
            ? results.filter(result => result.bookId === PSALMS_ID)
            : results);
        });
      });
    }, 240);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, ready, scriptureLanguage, searchVerses, tab]);

  const bookMatches = useMemo(() => {
    if (!query) return [];
    const source = tab === 'psalter' ? PSALTER : BIBLE_BOOKS;
    return source.filter(book => book.name.toLowerCase().includes(query)).slice(0, 12);
  }, [query, tab]);
  const browseContentKey = tab === 'psalter'
    ? (query ? 'psalter-search' : 'psalter-browse')
    : (query ? 'bible-search' : 'bible-browse');

  const tabPillMotionStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tabProgress.value * segPillTravel }],
  }), [segPillTravel]);

  const biblePaneMotionStyle = useAnimatedStyle(() => ({
    opacity: 1 - tabProgress.value,
  }));

  const psalterPaneMotionStyle = useAnimatedStyle(() => ({
    opacity: tabProgress.value,
  }));

  const sectionPillMotionStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sectionProgress.value * sectionPillTravel }],
    backgroundColor: interpolateColor(
      sectionProgress.value,
      [0, 1],
      ['rgba(94,123,85,0.14)', 'rgba(180,155,103,0.14)']
    ),
    borderColor: interpolateColor(
      sectionProgress.value,
      [0, 1],
      ['rgba(94,123,85,0.35)', 'rgba(180,155,103,0.35)']
    ),
  }), [sectionPillTravel]);

  const newTestamentPaneMotionStyle = useAnimatedStyle(() => ({
    opacity: 1 - sectionProgress.value,
  }));

  const oldTestamentPaneMotionStyle = useAnimatedStyle(() => ({
    opacity: sectionProgress.value,
  }));

  const switchTab = useCallback((next: ScriptureTab) => {
    if (isGuided || next === tabIntentRef.current) return;

    tabIntentRef.current = next;
    Haptics.selectionAsync().catch(() => {});
    if (tabCommitTimerRef.current !== null) {
      clearTimeout(tabCommitTimerRef.current);
    }
    // Let the UI-thread pill finish before React mounts the substantially
    // different Bible/Psalter tree. One frame was not enough: native SVG and
    // gradient mounts were competing with the pill on the main thread.
    tabCommitTimerRef.current = setTimeout(() => {
      tabCommitTimerRef.current = null;
      startTransition(() => {
        if (next === 'psalter') setPsalterPrepared(true);
        setTab(next);
        setExpandedBookId(null);
      });
    }, SEGMENT_CONTENT_COMMIT_DELAY_MS);
  }, [isGuided]);

  const handleLanguageChange = (lang: ScriptureLanguage) => {
    if (isGuided) return;
    Haptics.selectionAsync().catch(() => {});
    updateSettings({ bibleLang: lang });
    setSearchResults([]);
    setShowLanguageMenu(false);
  };

  const openReader = useCallback((book: BibleBook, chapter = 1, verse?: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isGuided) {
      if (guidePhase === 'libraryChapter' && book.id === 49 && chapter === 5) {
        if (guideActionLockRef.current === guidePhase) return;
        guideActionLockRef.current = guidePhase;
        onGuidedOpen?.(book.id, chapter);
      }
      return;
    }
    setExpandedBookId(null);
    router.push({
      pathname: '/scripture-reader',
      params: {
        bookId: String(book.id),
        chapter: String(chapter),
        lang: scriptureLanguage,
        ...(verse ? { verse: String(verse) } : {}),
      },
    });
  }, [guidePhase, isGuided, onGuidedOpen, router, scriptureLanguage]);

  const switchSection = useCallback((next: 'new' | 'old') => {
    if (isGuided || next === sectionIntentRef.current) return;

    sectionIntentRef.current = next;
    Haptics.selectionAsync().catch(() => {});
    if (sectionCommitTimerRef.current !== null) {
      clearTimeout(sectionCommitTimerRef.current);
    }
    sectionCommitTimerRef.current = setTimeout(() => {
      sectionCommitTimerRef.current = null;
      startTransition(() => {
        if (next === 'old') setOldTestamentPrepared(true);
        setActiveSection(next);
        setExpandedBookId(null);
      });
    }, SEGMENT_CONTENT_COMMIT_DELAY_MS);
  }, [isGuided]);

  const switchToBible = useCallback(() => switchTab('bible'), [switchTab]);
  const switchToPsalter = useCallback(() => switchTab('psalter'), [switchTab]);
  const switchToNewTestament = useCallback(() => switchSection('new'), [switchSection]);
  const switchToOldTestament = useCallback(() => switchSection('old'), [switchSection]);

  useEffect(() => {
    if (!ready || isGuided) return undefined;

    // Warm the two alternate panes only after the first visible Scripture UI
    // has settled. Once mounted they stay alive, so later switches never have
    // to construct a full gradient/SVG hierarchy on the interaction path.
    const cancelOldTestamentWarmup = scheduleContentBatch(() => {
      startTransition(() => setOldTestamentPrepared(true));
    }, 140);
    const cancelPsalterWarmup = scheduleContentBatch(() => {
      startTransition(() => setPsalterPrepared(true));
    }, 520);

    return () => {
      cancelOldTestamentWarmup();
      cancelPsalterWarmup();
    };
  }, [isGuided, ready]);

  useEffect(() => {
    if (!isGuided) return;

    const nextTabProgress = tab === 'bible' ? 0 : 1;
    tabIntentRef.current = tab;
    tabProgress.value = nextTabProgress;

    const nextSectionProgress = activeSection === 'new' ? 0 : 1;
    sectionIntentRef.current = activeSection;
    sectionProgress.value = nextSectionProgress;
  }, [
    activeSection,
    isGuided,
    sectionProgress,
    tab,
    tabProgress,
  ]);

  useEffect(() => () => {
    if (tabCommitTimerRef.current !== null) {
      clearTimeout(tabCommitTimerRef.current);
    }
    if (sectionCommitTimerRef.current !== null) {
      clearTimeout(sectionCommitTimerRef.current);
    }
  }, []);

  const toggleBook = useCallback((book: BibleBook) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isGuided) {
      if (guidePhase === 'libraryBook' && book.id === 49) {
        if (guideActionLockRef.current === guidePhase) return;
        guideActionLockRef.current = guidePhase;
        // Never let a rapid second tap collapse the chapter grid while its next
        // spotlight is being measured.
        setExpandedBookId(book.id);
        setPresentation(null);
        patchSession({ phase: 'libraryChapter' });
      }
      return;
    }
    setExpandedBookId(current => current === book.id ? null : book.id);
  }, [guidePhase, isGuided, patchSession, setPresentation]);

  const openPsalm = useCallback((psalm: number) => {
    if (PSALMS_BOOK) openReader(PSALMS_BOOK, psalm);
  }, [openReader]);

  useEffect(() => {
    guideActionLockRef.current = '';
  }, [guidePhase]);

  const stageGuideTarget = useCallback((
    target: { ref: React.RefObject<any>; measure: () => void },
    present: () => void,
    desiredY: number,
    delay = 80,
    onUnavailable?: () => void,
  ) => {
    scheduleGuide(() => {
      stageGuideScrollTarget(
        target,
        targetHeight => desiredY - Math.max(0, targetHeight - 56) * 0.22,
        present,
        onUnavailable,
      );
    }, delay);
  }, [scheduleGuide, stageGuideScrollTarget]);

  useEffect(() => {
    if (!isGuided) return;
    clearGuideTimers();

    if (guidePhase === 'legacyLibraryIntro') {
      setPresentation({
        key: 'scripture-library-intro',
        placement: 'bottom',
        lightScrim: true,
        eyebrow: 'HOLY SCRIPTURE',
        message: 'Every reading begins here: choose a Testament, open a book, then choose its chapter. Let’s open the passage behind Anasta’s call to rise.',
        highlights: ['choose a Testament', 'open a book', 'choose its chapter'],
        ctaLabel: 'Find Ephesians',
        onCta: () => {
          setTab('bible');
          setActiveSection('new');
          setSearchQuery('');
          patchSession({ phase: 'libraryBook' });
        },
      });
      return;
    }

    if (guidePhase === 'legacyLibraryBook') {
      stageGuideTarget(ephesiansTarget, () => {
        setPresentation({
          key: 'scripture-library-book',
          targetId: HOLY_SCRIPTURE_GUIDE_TARGETS.ephesians,
          cutoutPadding: 7,
          placement: 'above',
          allowTargetInteraction: true,
          eyebrow: 'NEW TESTAMENT',
          message: 'Each book opens in place, without leaving the library.',
          highlights: ['opens in place'],
          action: 'Tap Ephesians',
          hint: 'tap',
        });
      }, 154, 120);
      return;
    }

    if (guidePhase === 'legacyLibraryChapter') {
      stageGuideTarget(chapterFiveTarget, () => {
        setPresentation({
          key: 'scripture-library-chapter',
          targetId: HOLY_SCRIPTURE_GUIDE_TARGETS.chapterFive,
          cutoutPadding: 7,
          placement: 'above',
          allowTargetInteraction: true,
          eyebrow: 'EPHESIANS',
          message: 'The chapter grid is the fastest way to return to an exact place.',
          highlights: ['chapter grid', 'exact place'],
          action: 'Open Chapter 5',
          hint: 'tap',
        });
      }, 205, 180);
    }
  }, [chapterFiveTarget, clearGuideTimers, ephesiansTarget, guidePhase, isGuided, patchSession, setPresentation, stageGuideTarget]);

  useEffect(() => {
    if (!isGuided) return;
    clearGuideTimers();

    if (guidePhase === 'libraryIntro') {
      setPresentation({
        key: 'scripture-library-intro-v2',
        coachGroupKey: 'bible-primary-coach',
        placement: 'bottom',
        lightScrim: true,
        eyebrow: 'HOLY SCRIPTURE',
        message: 'This is your Holy Scripture — the home of your Bible and Psalter!',
        highlights: ['your Holy Scripture'],
        ctaLabel: 'Open Ephesians 5:14',
        onCta: () => {
          if (guideActionLockRef.current === guidePhase) return;
          guideActionLockRef.current = guidePhase;
          setTab('bible');
          setActiveSection('new');
          setSearchQuery('');
          setPresentation(null);
          onGuidedOpen?.(49, 5);
        },
      });
      return;
    }

    if (guidePhase === 'libraryBook') {
      setPresentation({
        key: 'scripture-library-find-v2',
        coachGroupKey: 'bible-primary-coach',
        placement: 'bottom',
        hideDim: true,
        eyebrow: 'HOLY SCRIPTURE',
        message: 'Let’s open the verse behind Anasta’s call to arise.',
      });
      stageGuideTarget(ephesiansTarget, () => {
        setPresentation({
          key: 'scripture-library-book-v2',
          coachGroupKey: 'bible-primary-coach',
          targetId: HOLY_SCRIPTURE_GUIDE_TARGETS.ephesians,
          cutoutPadding: 7,
          placement: 'above',
          allowTargetInteraction: true,
          eyebrow: 'NEW TESTAMENT',
          message: 'Open Ephesians.',
          action: 'Tap Ephesians',
          hint: 'tap',
        });
      }, Math.max(142, screenHeight * 0.22), 150);
      return;
    }

    if (guidePhase === 'libraryChapter') {
      stageGuideTarget(chapterFiveTarget, () => {
        setPresentation({
          key: 'scripture-library-chapter-v2',
          coachGroupKey: 'bible-primary-coach',
          targetId: HOLY_SCRIPTURE_GUIDE_TARGETS.chapterFive,
          cutoutPadding: 7,
          placement: 'above',
          allowTargetInteraction: true,
          eyebrow: 'EPHESIANS',
          message: 'Now open Chapter 5.',
          action: 'Tap Chapter 5',
          hint: 'tap',
        });
      }, Math.max(198, screenHeight * 0.30), 120);
      return;
    }

    if (guidePhase === 'hubSaved') {
      const openBibleNotesFallback = () => {
        if (guideActionLockRef.current === guidePhase) return;
        guideActionLockRef.current = guidePhase;
        setPresentation(null);
        onGuidedOpenBibleNotes?.();
      };
      stageGuideTarget(bibleNotesTarget, () => {
        setPresentation({
          key: 'scripture-hub-saved',
          coachGroupKey: 'bible-primary-coach',
          targetId: HOLY_SCRIPTURE_GUIDE_TARGETS.bibleNotes,
          hintTargetId: HOLY_SCRIPTURE_GUIDE_TARGETS.bibleNotesAction,
          cutoutPadding: 8,
          placement: 'below',
          allowTargetInteraction: true,
          eyebrow: 'HOLY SCRIPTURE',
          message: 'My Favorites keeps your highlights and comments. Bible Notes keeps your chapter notes.',
          highlights: ['My Favorites', 'Bible Notes'],
          action: 'Open Bible Notes',
          hint: 'tap',
        });
      }, Math.max(126, screenHeight * 0.18), 90, () => {
        setPresentation({
          key: 'scripture-hub-saved-fallback',
          coachGroupKey: 'bible-primary-coach',
          placement: 'center',
          lightScrim: true,
          eyebrow: 'HOLY SCRIPTURE',
          message: 'My Favorites keeps your highlights and comments. Bible Notes keeps your chapter notes.',
          highlights: ['My Favorites', 'Bible Notes'],
          ctaLabel: 'Open Bible Notes',
          onCta: openBibleNotesFallback,
        });
      });
      return;
    }

    if (guidePhase === 'hubRhythm') {
      stageGuideTarget(rhythmTarget, () => {
        setPresentation({
          key: 'scripture-hub-rhythm',
          coachGroupKey: 'bible-primary-coach',
          targetId: HOLY_SCRIPTURE_GUIDE_TARGETS.rhythm,
          cutoutPadding: 8,
          placement: 'above',
          allowTargetInteraction: false,
          eyebrow: 'HOLY SCRIPTURE',
          message: 'Checkpoints return you to your reading. You can also add Scripture to your daily routine.',
          highlights: ['Checkpoints', 'daily routine'],
          ctaLabel: 'Continue',
          onCta: () => patchSession({ phase: 'hubBrowse' }),
        });
      }, Math.max(132, screenHeight * 0.20), 90);
      return;
    }

    if (guidePhase === 'hubBrowse') {
      stageGuideTarget(browseTarget, () => {
        setPresentation({
          key: 'scripture-hub-browse',
          coachGroupKey: 'bible-primary-coach',
          targetId: HOLY_SCRIPTURE_GUIDE_TARGETS.browse,
          cutoutPadding: 8,
          placement: 'above',
          allowTargetInteraction: false,
          eyebrow: 'HOLY SCRIPTURE',
          message: 'Switch between the Bible and Psalter, or search for any book or passage.',
          highlights: ['Bible and Psalter', 'search'],
          ctaLabel: 'Finish Bible tour',
          onCta: onGuidedComplete,
        });
      }, Math.max(150, screenHeight * 0.24), 90, () => {
        setPresentation({
          key: 'scripture-hub-browse-fallback',
          coachGroupKey: 'bible-primary-coach',
          placement: 'center',
          lightScrim: true,
          eyebrow: 'HOLY SCRIPTURE',
          message: 'Switch between the Bible and Psalter, or search for any book or passage.',
          highlights: ['Bible and Psalter', 'search'],
          ctaLabel: 'Finish Bible tour',
          onCta: onGuidedComplete,
        });
      });
    }
  }, [bibleNotesTarget, browseTarget, chapterFiveTarget, clearGuideTimers, ephesiansTarget, guidePhase, isGuided, onGuidedComplete, onGuidedOpen, onGuidedOpenBibleNotes, patchSession, rhythmTarget, screenHeight, setPresentation, stageGuideTarget]);

  useEffect(() => clearGuideTimers, [clearGuideTimers, guidePhase]);

  const openResult = (result: ScriptureSearchResult) => {
    const book = BIBLE_BOOKS.find(item => item.id === result.bookId);
    if (!book) return;
    setSearchQuery('');
    setSearchResults([]);
    openReader(book, result.chapter, result.verse);
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
      <ScreenTitleBar
        title="HOLY SCRIPTURE"
        showBack={!isGuided}
        bg={BG}
        rightElement={(
          <TouchableOpacity
            onPress={() => {
              if (isGuided) return;
              Haptics.selectionAsync().catch(() => {});
              setShowLanguageMenu(value => !value);
            }}
            disabled={isGuided}
            style={s.titleSettingsBtn}
            activeOpacity={0.76}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Settings s={19} c={C.textSecondary} w={2} />
          </TouchableOpacity>
        )}
      />

      <Modal
        visible={!isGuided && showLanguageMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLanguageMenu(false)}
      >
        <View style={s.languageModalRoot}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowLanguageMenu(false)} />
          <View style={[s.languageMenu, { top: insets.top + 58 }]}>
            <Text style={s.languageMenuTitle}>Holy Scripture Language</Text>
            <View style={s.languageOptions}>
              {SCRIPTURE_LANGUAGES.map(language => {
                const active = language.key === scriptureLanguage;
                const details = SCRIPTURE_LANGUAGE_DETAILS[language.key];

                return (
                  <TouchableOpacity
                    key={language.key}
                    onPress={() => handleLanguageChange(language.key)}
                    activeOpacity={0.78}
                    style={[
                      s.languageOption,
                      active
                        ? s.languageOptionActive
                        : s.languageOptionInactive,
                    ]}
                  >
                    <View style={s.languageCopy}>
                      <Text style={[s.languageName, { color: active ? GREEN : C.text }]}>
                        {details.name}
                      </Text>
                      <Text style={s.languageCode}>{details.version}</Text>
                    </View>
                    {active && (
                      <View style={s.languageCheckShell}>
                        <View style={s.languageCheckCore}>
                          <CheckSmall s={14} c="#FFFDF7" w={2.35} />
                        </View>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView
        ref={guideScrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 110 }]}
        onScroll={isGuided ? handleGuideScroll : undefined}
        onMomentumScrollEnd={isGuided ? finishGuideScroll : undefined}
        scrollEventThrottle={isGuided ? 16 : undefined}
      >
        {/* Quick access — the reader's doors: haloed icons on parchment,
            each under its own fall of light */}
        <View
          {...(isGuided ? { ref: bibleNotesTarget.ref, onLayout: bibleNotesTarget.onLayout } : {})}
          collapsable={false}
          style={s.quickGrid}
        >
          <TouchableOpacity
            onPress={() => {
              if (!isGuided) router.push('/favorites');
            }}
            activeOpacity={0.86}
            style={[s.quickCard, s.quickCardGold]}
          >
            <DoorGround tint={GOLD} motif="rays" index={0} />
            <View style={s.quickCardRow}>
              <DoorSeal tint={GOLD} Icon={Star} size={15} width={2} />
              <Text
                style={[s.quickLabel, { color: doorInk(GOLD, 24) }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.88}
              >Favorites</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            {...(isGuided ? { ref: bibleNotesActionTarget.ref, onLayout: bibleNotesActionTarget.onLayout } : {})}
            onPress={() => {
              if (isGuided) {
                if (guidePhase === 'hubSaved') {
                  if (guideActionLockRef.current === guidePhase) return;
                  guideActionLockRef.current = guidePhase;
                  setPresentation(null);
                  onGuidedOpenBibleNotes?.();
                }
                return;
              }
              router.push('/bible-notes');
            }}
            activeOpacity={0.86}
            style={[s.quickCard, s.quickCardGreen]}
          >
            <DoorGround tint={GREEN} motif="counter" index={1} />
            <View style={s.quickCardRow}>
              <DoorSeal tint={GREEN} Icon={Notebook} size={14} width={2} />
              <Text
                style={[s.quickLabel, { color: doorInk(GREEN, 24) }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.88}
              >Bible Notes</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Checkpoints — the reader's bookmark hangs from its edge */}
        <View
          {...(isGuided ? { ref: rhythmTarget.ref, onLayout: rhythmTarget.onLayout } : {})}
          collapsable={false}
          style={s.doorColumn}
        >
        <TouchableOpacity
          onPress={() => {
            if (isGuided) return;
            router.push({
              pathname: '/scripture-checkpoint',
              params: { title: 'Scripture Checkpoints' },
            } as any);
          }}
          activeOpacity={0.86}
          style={s.checkpointCard}
        >
          <DoorGround tint={GOLD} motif="ruling" index={2} reserveRight={52} sealLeft={14} />
          <BookmarkRibbon />
          <DoorSeal tint={GOLD} Icon={Book} size={16} width={2.1} />
          <View style={s.checkpointTextWrap}>
            <Text style={[s.checkpointTitle, { color: doorInk(GOLD, 24) }]} numberOfLines={1}>Checkpoints</Text>
            <Text style={[s.checkpointKicker, { color: doorInk(GOLD, 48) }]}>Continue scripture reading</Text>
          </View>
          <View style={[s.chevronSeat, { borderColor: doorInk(GOLD, 64) }]}>
            <ChevronRight s={15} c={doorInk(GOLD, 44)} />
          </View>
        </TouchableOpacity>

        <SetAsDailyTaskCard
          onPress={() => {
            if (!isGuided) setShowTaskSheet(true);
          }}
          subtitle={taskSummary}
        />
        </View>

        {/* Bible / Psalter toggle + search */}
        <View
          {...(isGuided ? { ref: browseTarget.ref, onLayout: browseTarget.onLayout } : {})}
          collapsable={false}
          style={s.selectorPanel}
        >
          <View style={s.segmented} onLayout={e => setSegWidth(e.nativeEvent.layout.width)}>
            <Reanimated.View
              pointerEvents="none"
              style={[s.segPill, { width: segPillWidth }, tabPillMotionStyle]}
            />
            <TabButton
              active={tab === 'bible'}
              accessibilityLabel="Bible"
              disabled={isGuided}
              Icon={Book}
              label="BIBLE"
              onPress={switchToBible}
              progress={tabProgress}
              targetProgress={0}
            />
            <TabButton
              active={tab === 'psalter'}
              accessibilityLabel="Psalter"
              disabled={isGuided}
              Icon={OpenBook}
              label="PSALTER"
              onPress={switchToPsalter}
              progress={tabProgress}
              targetProgress={1}
            />
          </View>

          <View style={s.searchBox}>
            <Search s={15} c="#BFC3CA" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              editable={!isGuided}
              placeholder={tab === 'psalter' ? 'Search psalms...' : 'Search books or passages...'}
              placeholderTextColor="#AEB4BE"
              style={s.searchInput}
            />
            {!!searchQuery && (
              <Pressable onPress={() => {
                if (!isGuided) setSearchQuery('');
              }} hitSlop={8}>
                <X s={15} c="#AEB4BE" />
              </Pressable>
            )}
          </View>
        </View>

        {/* Keep browse panes alive after their idle warm-up. Switching now
            cross-fades compositor layers instead of unmounting and rebuilding
            the full native gradient/SVG hierarchy. */}
        <View
          pointerEvents={query ? 'none' : 'auto'}
          style={[s.cachedBrowseHost, query && s.cachedBrowseHidden]}
        >
          <View style={s.contentPaneStack}>
            <Reanimated.View
              accessibilityElementsHidden={tab !== 'bible'}
              importantForAccessibility={tab === 'bible' ? 'auto' : 'no-hide-descendants'}
              pointerEvents={tab === 'bible' ? 'auto' : 'none'}
              style={[
                s.contentPane,
                tab === 'bible' ? s.contentPaneActive : s.contentPaneInactive,
                biblePaneMotionStyle,
              ]}
            >
              <View style={s.sections}>
                <View
                  style={s.sectionTabWrap}
                  onLayout={e => setSectionWrapWidth(e.nativeEvent.layout.width)}
                >
                  <Reanimated.View
                    style={[
                      s.sectionTabPill,
                      { width: sectionPillWidth },
                      sectionPillMotionStyle,
                    ]}
                  />
                  <GestureSegmentButton
                    accessibilityLabel="New Testament"
                    active={activeSection === 'new'}
                    disabled={isGuided}
                    onPress={switchToNewTestament}
                    progress={sectionProgress}
                    style={s.sectionTabBtn}
                    targetProgress={0}
                  >
                    <SegmentLabel
                      activeColor={GREEN}
                      label="New Testament"
                      progress={sectionProgress}
                      targetProgress={0}
                    />
                  </GestureSegmentButton>
                  <GestureSegmentButton
                    accessibilityLabel="Old Testament"
                    active={activeSection === 'old'}
                    disabled={isGuided}
                    onPress={switchToOldTestament}
                    progress={sectionProgress}
                    style={s.sectionTabBtn}
                    targetProgress={1}
                  >
                    <SegmentLabel
                      activeColor="#8B6B2F"
                      label="Old Testament"
                      progress={sectionProgress}
                      targetProgress={1}
                    />
                  </GestureSegmentButton>
                </View>

                <View style={s.contentPaneStack}>
                  <Reanimated.View
                    accessibilityElementsHidden={activeSection !== 'new'}
                    importantForAccessibility={activeSection === 'new' ? 'auto' : 'no-hide-descendants'}
                    pointerEvents={activeSection === 'new' ? 'auto' : 'none'}
                    style={[
                      s.contentPane,
                      activeSection === 'new' ? s.contentPaneActive : s.contentPaneInactive,
                      newTestamentPaneMotionStyle,
                    ]}
                  >
                    <BookList
                      books={NEW_TESTAMENT}
                      tone="green"
                      expandedBookId={expandedBookId}
                      onBook={toggleBook}
                      onChapter={openReader}
                      eager={isGuided}
                      guidedBookId={isGuided ? 49 : undefined}
                      guidedChapter={isGuided ? 5 : undefined}
                      bookTargetProps={isGuided ? { ref: ephesiansTarget.ref, onLayout: ephesiansTarget.onLayout } : undefined}
                      chapterTargetProps={isGuided ? { ref: chapterFiveTarget.ref, onLayout: chapterFiveTarget.onLayout } : undefined}
                    />
                  </Reanimated.View>

                  {(oldTestamentPrepared || activeSection === 'old') && (
                    <Reanimated.View
                      accessibilityElementsHidden={activeSection !== 'old'}
                      importantForAccessibility={activeSection === 'old' ? 'auto' : 'no-hide-descendants'}
                      pointerEvents={activeSection === 'old' ? 'auto' : 'none'}
                      style={[
                        s.contentPane,
                        activeSection === 'old' ? s.contentPaneActive : s.contentPaneInactive,
                        oldTestamentPaneMotionStyle,
                      ]}
                    >
                      <BookList
                        books={OLD_TESTAMENT}
                        tone="stone"
                        expandedBookId={expandedBookId}
                        onBook={toggleBook}
                        onChapter={openReader}
                      />
                    </Reanimated.View>
                  )}
                </View>
              </View>
            </Reanimated.View>

            {(psalterPrepared || tab === 'psalter') && PSALMS_BOOK && (
              <Reanimated.View
                accessibilityElementsHidden={tab !== 'psalter'}
                importantForAccessibility={tab === 'psalter' ? 'auto' : 'no-hide-descendants'}
                pointerEvents={tab === 'psalter' ? 'auto' : 'none'}
                style={[
                  s.contentPane,
                  tab === 'psalter' ? s.contentPaneActive : s.contentPaneInactive,
                  psalterPaneMotionStyle,
                ]}
              >
                <PsalterBrowse
                  psalms={ALL_PSALM_NUMBERS}
                  results={EMPTY_SEARCH_RESULTS}
                  searching={false}
                  cardWidth={psalmCardWidth}
                  onPsalm={openPsalm}
                  onResult={openResult}
                />
              </Reanimated.View>
            )}
          </View>
        </View>

        {!!query && (
          <Reanimated.View
            key={browseContentKey}
            entering={FadeIn.duration(170).easing(Easing.out(Easing.cubic))}
          >
            {tab === 'psalter' && PSALMS_BOOK ? (
              <PsalterBrowse
                psalms={psalmNumbers}
                results={searchResults}
                searching
                cardWidth={psalmCardWidth}
                onPsalm={openPsalm}
                onResult={openResult}
              />
            ) : (
              <SearchPanel
                bookMatches={bookMatches}
                results={searchResults}
                onBook={openReader}
                onResult={openResult}
              />
            )}
          </Reanimated.View>
        )}
      </ScrollView>

      <SetAsTaskSheet
        visible={!isGuided && showTaskSheet}
        context="scripture"
        onClose={() => setShowTaskSheet(false)}
        onSummaryChange={setTaskSummary}
        onTaskDraft={createOrUpdateTask}
        onTaskMutation={refreshTasks}
      />
    </View>
  );
}

function GestureSegmentButton({
  accessibilityLabel,
  active,
  children,
  disabled = false,
  onPress,
  progress,
  style,
  targetProgress,
}: {
  accessibilityLabel: string;
  active: boolean;
  children: React.ReactNode;
  disabled?: boolean;
  onPress: () => void;
  progress: SharedValue<number>;
  style?: StyleProp<ViewStyle>;
  targetProgress: number;
}) {
  const pressProgress = useSharedValue(0);
  const pressMotionStyle = useAnimatedStyle(() => ({
    opacity: 1 - pressProgress.value * 0.16,
    transform: [{ scale: 1 - pressProgress.value * 0.015 }],
  }));
  const activateFromAccessibility = useCallback(() => {
    if (disabled) return;
    progress.value = withTiming(targetProgress, SEGMENT_SLIDE);
    onPress();
  }, [disabled, onPress, progress, targetProgress]);
  const tapGesture = useMemo(() => Gesture.Tap()
    .enabled(!disabled)
    .onBegin(() => {
      pressProgress.value = withTiming(1, SEGMENT_PRESS_IN);
    })
    .onFinalize((_event, success) => {
      pressProgress.value = withTiming(0, SEGMENT_PRESS_OUT);
      if (success) {
        progress.value = withTiming(targetProgress, SEGMENT_SLIDE);
        runOnJS(onPress)();
      }
    }), [disabled, onPress, pressProgress, progress, targetProgress]);

  return (
    <GestureDetector gesture={tapGesture}>
      <Reanimated.View
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ disabled, selected: active }}
        accessible
        focusable={!disabled}
        onAccessibilityTap={activateFromAccessibility}
        style={[style, pressMotionStyle]}
      >
        {children}
      </Reanimated.View>
    </GestureDetector>
  );
}

function TabButton({
  accessibilityLabel,
  active,
  disabled,
  Icon,
  label,
  onPress,
  progress,
  targetProgress,
}: {
  accessibilityLabel: string;
  active: boolean;
  disabled?: boolean;
  Icon: React.ComponentType<{ s?: number; c?: string; w?: number }>;
  label: string;
  onPress: () => void;
  progress: SharedValue<number>;
  targetProgress: number;
}) {
  const selectedVisualStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(1, Math.abs(progress.value - targetProgress)),
  }));
  const mutedVisualStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.abs(progress.value - targetProgress)),
  }));
  const labelVisualStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      Math.min(1, Math.abs(progress.value - targetProgress)),
      [0, 1],
      [GREEN, '#A8A29E'],
    ),
  }));

  return (
    <GestureSegmentButton
      accessibilityLabel={accessibilityLabel}
      active={active}
      disabled={disabled}
      onPress={onPress}
      progress={progress}
      style={[s.tabBtn, active && s.tabBtnActive]}
      targetProgress={targetProgress}
    >
      <View style={s.segmentIconBox}>
        <Reanimated.View style={[s.segmentIconLayer, mutedVisualStyle]}>
          <Icon s={14} c="#A8A29E" />
        </Reanimated.View>
        <Reanimated.View style={[s.segmentIconLayer, selectedVisualStyle]}>
          <Icon s={14} c={GREEN} />
        </Reanimated.View>
      </View>
      <Reanimated.Text style={[s.tabText, labelVisualStyle]}>{label}</Reanimated.Text>
    </GestureSegmentButton>
  );
}

function SegmentLabel({
  activeColor,
  label,
  progress,
  targetProgress,
}: {
  activeColor: string;
  label: string;
  progress: SharedValue<number>;
  targetProgress: number;
}) {
  const labelMotionStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      Math.min(1, Math.abs(progress.value - targetProgress)),
      [0, 1],
      [activeColor, '#A8A29E'],
    ),
  }));

  return (
    <Reanimated.Text style={[s.sectionTabText, labelMotionStyle]}>
      {label}
    </Reanimated.Text>
  );
}

const BookList = React.memo(function BookList({
  books, tone, expandedBookId, onBook, onChapter, eager = false, guidedBookId, guidedChapter, bookTargetProps, chapterTargetProps,
}: {
  books: BibleBook[];
  tone: 'green' | 'stone';
  expandedBookId: number | null;
  onBook: (book: BibleBook) => void;
  onChapter: (book: BibleBook, chapter?: number) => void;
  eager?: boolean;
  guidedBookId?: number;
  guidedChapter?: number;
  bookTargetProps?: { ref: React.Ref<any>; onLayout: (event: any) => void };
  chapterTargetProps?: { ref: React.Ref<any>; onLayout: (event: any) => void };
}) {
  const isGreen = tone === 'green';
  const panelColors = (isGreen ? ['#FCFDF9', '#F4F8EF'] : ['#FFFDF9', '#F8F4EC']) as [string, string];
  const [visibleCount, setVisibleCount] = useState(() => eager
    ? books.length
    : Math.min(INITIAL_BOOK_RENDER_COUNT, books.length));

  // The first screenful is complete immediately. Everything below it is
  // mounted in short batches so a Testament switch never creates every
  // gradient, SVG motif, and animated card in one native commit.
  useEffect(() => {
    if (eager) {
      if (visibleCount !== books.length) setVisibleCount(books.length);
      return undefined;
    }
    if (visibleCount >= books.length) return undefined;

    return scheduleContentBatch(() => {
      startTransition(() => {
        setVisibleCount(current => Math.min(books.length, current + BOOK_RENDER_BATCH_SIZE));
      });
    }, visibleCount <= INITIAL_BOOK_RENDER_COUNT
      ? FIRST_CONTENT_BATCH_DELAY_MS
      : NEXT_CONTENT_BATCH_DELAY_MS);
  }, [books.length, eager, visibleCount]);

  return (
    <LinearGradient
      colors={panelColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[s.bookListPanel, { borderColor: isGreen ? '#DCE5D7' : '#ECE4D7' }]}
    >
      <View
        pointerEvents="none"
        style={[
          s.shelfFrame,
          { borderColor: isGreen ? 'rgba(94,123,85,0.13)' : 'rgba(180,155,103,0.15)' },
        ]}
      />
      {books.slice(0, visibleCount).map(book => (
        <BookListItem
          key={book.id}
          book={book}
          bookTargetProps={book.id === guidedBookId ? bookTargetProps : undefined}
          chapterTargetProps={book.id === guidedBookId ? chapterTargetProps : undefined}
          expanded={expandedBookId === book.id}
          guidedChapter={book.id === guidedBookId ? guidedChapter : undefined}
          onBook={onBook}
          onChapter={onChapter}
          tone={tone}
        />
      ))}
    </LinearGradient>
  );
});

const BookListItem = React.memo(function BookListItem({
  book,
  bookTargetProps,
  chapterTargetProps,
  expanded,
  guidedChapter,
  onBook,
  onChapter,
  tone,
}: {
  book: BibleBook;
  bookTargetProps?: { ref: React.Ref<any>; onLayout: (event: any) => void };
  chapterTargetProps?: { ref: React.Ref<any>; onLayout: (event: any) => void };
  expanded: boolean;
  guidedChapter?: number;
  onBook: (book: BibleBook) => void;
  onChapter: (book: BibleBook, chapter?: number) => void;
  tone: 'green' | 'stone';
}) {
  const handleBook = useCallback(() => onBook(book), [book, onBook]);
  const handleChapter = useCallback((chapter: number) => onChapter(book, chapter), [book, onChapter]);

  return (
    <View style={s.bookListItem}>
      <View {...bookTargetProps}>
        <PremiumBookCard
          book={book}
          tone={tone}
          expanded={expanded}
          onPress={handleBook}
        />
      </View>
      {expanded && (
        <View style={s.chapterPanelWrap}>
          <ChapterPanel
            book={book}
            tone={tone}
            onChapter={handleChapter}
            guidedChapter={guidedChapter}
            chapterTargetProps={chapterTargetProps}
          />
        </View>
      )}
    </View>
  );
});

// The doors carry their own faint light: rays for what is treasured,
// ruling lines for what is written and read.

// A gold ribbon hanging from the card's top edge — the reader's bookmark.
function BookmarkRibbon() {
  return (
    <View pointerEvents="none" style={s.ribbonWrap}>
      <Svg width={13} height={24} viewBox="0 0 13 24">
        <Path
          d="M0.5 0 H12.5 V22.5 L6.5 17.2 L0.5 22.5 Z"
          fill="#D5AC5C"
          stroke="rgba(150,108,40,0.4)"
          strokeWidth={0.8}
        />
        <Path
          d="M2.8 1.8 V19.2"
          stroke="rgba(255,248,225,0.55)"
          strokeWidth={1}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

// The testaments share one design; only the light falling across the
// parchment differs. The New Testament carries diagonal rays, the Old
// the horizontal ruling of a scroll — faint, anchored to the right edge.
function TestamentMotif({ tone }: { tone: 'green' | 'stone' }) {
  const isGreen = tone === 'green';
  const stroke = isGreen ? '#5E7B55' : '#B49B67';

  return (
    <View pointerEvents="none" style={s.motifAnchor}>
      <Svg width={200} height={100}>
        <Path
          d={isGreen ? NEW_TESTAMENT_MOTIF_PATH : OLD_TESTAMENT_MOTIF_PATH}
          fill="none"
          stroke={stroke}
          strokeOpacity={isGreen ? 0.075 : 0.085}
          strokeWidth={1}
        />
      </Svg>
    </View>
  );
}

// Selecting a book turns its card into the sheet's heading: the meta
// line and chevron fade, and the title glides — one flat horizontal
// move, no bounce — to the center, landing above the engraved
// CHAPTERS rule of the opened panel. Opacity and translateX only, so
// nothing relayouts mid-flight.
function PremiumBookCard({
  book, tone, expanded, onPress,
}: {
  book: BibleBook;
  tone: 'green' | 'stone';
  expanded: boolean;
  onPress: () => void;
}) {
  const isGreen = tone === 'green';
  const isDeutero = book.testament === 'dc';
  const progress = useSharedValue(expanded ? 1 : 0);
  const centerShift = useSharedValue(0);
  const [cardWidth, setCardWidth] = useState(0);
  const [titleWidth, setTitleWidth] = useState(0);
  // The leader is drawn, not stretched: dots keep their size and spacing at
  // any width, so it is measured rather than scaled through a viewBox.
  const [leaderWidth, setLeaderWidth] = useState(0);

  useEffect(() => {
    progress.value = withTiming(expanded ? 1 : 0, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    });
  }, [expanded, progress]);

  useEffect(() => {
    // Title's left edge sits at the card's 14px padding; gliding it to
    // (cardWidth - titleWidth) / 2 sets it optically center-card.
    centerShift.value = cardWidth > 0 && titleWidth > 0
      ? Math.max(0, (cardWidth - titleWidth) / 2 - 14)
      : 0;
  }, [cardWidth, centerShift, titleWidth]);

  const titleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * centerShift.value }],
  }));

  const fadeAwayStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
  }));

  const washStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.86}
      onLayout={event => setCardWidth(event.nativeEvent.layout.width)}
      style={[
        s.premiumBook,
        {
          borderColor: isGreen ? '#D9E4D5' : '#E8E0D4',
          borderBottomColor: expanded ? 'transparent' : (isGreen ? '#D9E4D5' : '#E8E0D4'),
          borderBottomLeftRadius: expanded ? 0 : 18,
          borderBottomRightRadius: expanded ? 0 : 18,
        },
        expanded && s.premiumBookExpanded,
        expanded && s.premiumBookCompact,
      ]}
    >
      {/* Parchment ground, warmed toward the testament's tone */}
      <LinearGradient
        colors={isGreen ? ['#FEFFFC', '#F6FAF1'] : ['#FFFEFB', '#FAF5EA']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* A quiet wash of the tone settles over the open card */}
      <Reanimated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: isGreen ? 'rgba(94,123,85,0.05)' : 'rgba(180,155,103,0.06)' },
          washStyle,
        ]}
      />
      <TestamentMotif tone={tone} />
      {/* The book's spine at the left edge — only while shelved; the open
          volume stands clean, type and rule alone. */}
      {!expanded && (
        <View
          pointerEvents="none"
          style={[
            s.bookSpine,
            { backgroundColor: isGreen ? 'rgba(94,123,85,0.4)' : 'rgba(180,155,103,0.45)' },
          ]}
        />
      )}
      {/* A book's own contents page: the name, a leader ruled across to the
          count, and the count. Stacking the two on separate lines cost the
          card 18pt of height and made a list of short names look like a list
          of paragraphs. */}
      <View style={s.bookCopy}>
        <View style={s.bookLine}>
          <Reanimated.Text
            numberOfLines={1}
            onLayout={event => setTitleWidth(event.nativeEvent.layout.width)}
            style={[s.bookName, titleStyle]}
          >
            {book.name}
          </Reanimated.Text>
          <Reanimated.View style={[s.bookTail, expanded && { display: 'none' }, fadeAwayStyle]}>
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
                    stroke={isGreen ? '#5E7B55' : '#B49B67'}
                    strokeOpacity={0.34}
                    strokeWidth={1.4}
                    strokeLinecap="round"
                    strokeDasharray="0.5 5"
                  />
                </Svg>
              )}
            </View>
            {isDeutero && (
              <Text style={[s.bookMeta, { color: isGreen ? '#8AA07C' : '#B09B76' }]}>DEUTEROCANON</Text>
            )}
            <Text style={[s.bookFolio, { color: isGreen ? '#7E9270' : '#A48F6C' }]}>{book.chapters}</Text>
          </Reanimated.View>
        </View>
      </View>
      <Reanimated.View
        style={[s.bookChevronSeat, { borderColor: isGreen ? 'rgba(94,123,85,0.22)' : 'rgba(180,155,103,0.26)' }, fadeAwayStyle]}
        pointerEvents="none"
      >
        <ChevronRight s={13} c={isGreen ? '#8FA986' : '#BCA476'} />
      </Reanimated.View>
      {/* The gradient ground swallows the native border at the rounded top
          corners of the open card — redraw the boundary line above it. */}
      {expanded && (
        <View
          pointerEvents="none"
          style={[s.openTopFrame, { borderColor: isGreen ? '#D9E4D5' : '#E8E0D4' }]}
        />
      )}
    </TouchableOpacity>
  );
}

function ChapterPanel({
  book, tone, onChapter, guidedChapter, chapterTargetProps,
}: {
  book: BibleBook;
  tone: 'green' | 'stone';
  onChapter: (chapter: number) => void;
  guidedChapter?: number;
  chapterTargetProps?: { ref: React.Ref<any>; onLayout: (event: any) => void };
}) {
  const isGreen = tone === 'green';
  const rows = Array.from({ length: Math.ceil(book.chapters / 5) }, (_, rowIndex) => rowIndex);

  return (
    <LinearGradient
      colors={isGreen ? ['#F9FCF6', '#F0F7EA'] : ['#FDFBFA', '#F6F2EC']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[
        s.chapterPanel,
        { borderColor: isGreen ? '#DCE5D7' : '#E8E1D5' },
      ]}
    >
      <TestamentMotif tone={tone} />
      {/* Engraved head: rule — ◆ CHAPTERS · N ◆ — rule */}
      <View style={s.chapterHeadRow}>
        <View style={[s.chapterHeadRule, { backgroundColor: isGreen ? 'rgba(94,123,85,0.24)' : 'rgba(180,155,103,0.28)' }]} />
        <View style={[s.chapterHeadDiamond, { backgroundColor: isGreen ? 'rgba(94,123,85,0.5)' : 'rgba(180,155,103,0.55)' }]} />
        <Text style={[s.chapterHeadText, { color: isGreen ? '#72876A' : '#A89069' }]}>
          CHAPTERS · {book.chapters}
        </Text>
        <View style={[s.chapterHeadDiamond, { backgroundColor: isGreen ? 'rgba(94,123,85,0.5)' : 'rgba(180,155,103,0.55)' }]} />
        <View style={[s.chapterHeadRule, { backgroundColor: isGreen ? 'rgba(94,123,85,0.24)' : 'rgba(180,155,103,0.28)' }]} />
      </View>

      <View style={s.chapterGrid}>
        {rows.map(rowIndex => (
          <View key={rowIndex} style={s.chapterGridRow}>
            {Array.from({ length: 5 }, (_, offset) => {
              const chapter = rowIndex * 5 + offset + 1;
              if (chapter > book.chapters) {
                return <View key={`empty-${rowIndex}-${offset}`} style={s.chapterSpacer} />;
              }

              return (
                <TouchableOpacity
                  key={chapter}
                  {...(chapter === guidedChapter ? chapterTargetProps : undefined)}
                  onPress={() => onChapter(chapter)}
                  activeOpacity={0.78}
                  style={[
                    s.chapterCell,
                    {
                      borderColor: isGreen ? 'rgba(94,123,85,0.26)' : 'rgba(180,155,103,0.3)',
                      backgroundColor: isGreen ? '#FCFEFA' : '#FFFDF7',
                    },
                  ]}
                >
                  <Text style={[s.chapterCellText, { color: isGreen ? '#4C6444' : '#6F5E41' }]}>{chapter}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </LinearGradient>
  );
}

function PsalmRows({ psalms, onPsalm }: { psalms: number[]; onPsalm: (psalm: number) => void }) {
  const rows = Array.from({ length: Math.ceil(psalms.length / 5) }, (_, i) => i);
  return (
    <View style={s.psalmGrid}>
      {rows.map(rowIndex => (
        <View key={rowIndex} style={s.psalmGridRow}>
          {Array.from({ length: 5 }, (_, offset) => {
            const psalm = psalms[rowIndex * 5 + offset];
            if (!psalm) return <View key={`e-${rowIndex}-${offset}`} style={s.psalmSpacer} />;
            return (
              <TouchableOpacity
                key={psalm}
                onPress={() => onPsalm(psalm)}
                activeOpacity={0.78}
                style={s.psalmCell}
              >
                <View pointerEvents="none" style={s.psalmCellLit} />
                <Text style={s.psalmCellText}>{psalm}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// The engraved head the rest of this screen uses for its divisions.
function KathismaHead({ label }: { label: string }) {
  return (
    <View style={s.kathismaHead}>
      <View style={s.kathismaRule} />
      <View style={s.kathismaDiamond} />
      <Text style={s.kathismaLabel} numberOfLines={1}>{label}</Text>
      <View style={s.kathismaDiamond} />
      <View style={s.kathismaRule} />
    </View>
  );
}

const PsalterBrowse = React.memo(function PsalterBrowse({
  psalms, results, searching, onPsalm, onResult,
}: {
  psalms: number[];
  results: ScriptureSearchResult[];
  searching: boolean;
  cardWidth?: number;
  onPsalm: (psalm: number) => void;
  onResult: (result: ScriptureSearchResult) => void;
}) {
  // Grouped from whatever the search left standing, so a filtered Psalter
  // keeps its divisions and simply drops the ones nothing matched in.
  const sections = useMemo(() => groupPsalmsIntoKathismata(psalms), [psalms]);
  const [visibleSectionCount, setVisibleSectionCount] = useState(() =>
    Math.min(INITIAL_PSALTER_SECTION_COUNT, sections.length));

  useEffect(() => {
    if (searching || visibleSectionCount >= sections.length) return undefined;

    return scheduleContentBatch(() => {
      startTransition(() => {
        setVisibleSectionCount(current =>
          Math.min(sections.length, current + PSALTER_RENDER_BATCH_SIZE));
      });
    }, visibleSectionCount <= INITIAL_PSALTER_SECTION_COUNT
      ? FIRST_CONTENT_BATCH_DELAY_MS
      : NEXT_CONTENT_BATCH_DELAY_MS);
  }, [searching, sections.length, visibleSectionCount]);

  return (
    <View style={s.psalterWrap}>
      {psalms.length > 0 && !searching && (
        <LinearGradient
          colors={['#FFFDF9', '#FFF6E8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={s.psalmPanel}
        >
          {sections.slice(0, visibleSectionCount).map((section, index) => (
            <KathismaSection
              key={section.key}
              first={index === 0}
              label={section.label}
              onPsalm={onPsalm}
              psalms={section.psalms}
            />
          ))}
        </LinearGradient>
      )}

      {searching && results.length > 0 && (
        <View style={s.searchBlock}>
          <Text style={s.searchKicker}>PASSAGES</Text>
          {results.slice(0, 16).map(result => (
            <TouchableOpacity
              key={`${result.bookId}:${result.chapter}:${result.verse}`}
              onPress={() => onResult(result)}
              activeOpacity={0.86}
              style={s.resultCard}
            >
              <Text style={s.resultRef}>{result.bookName} {result.chapter}:{result.verse}</Text>
              <ReadableText style={s.resultText} numberOfLines={3}>{result.text}</ReadableText>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {searching && psalms.length === 0 && results.length === 0 && (
        <View style={s.emptySearch}>
          <Search s={24} c="rgba(197,160,89,0.34)" />
          <Text style={s.emptySearchText}>No psalms found.</Text>
        </View>
      )}
    </View>
  );
});

const KathismaSection = React.memo(function KathismaSection({
  first,
  label,
  onPsalm,
  psalms,
}: {
  first: boolean;
  label: string;
  onPsalm: (psalm: number) => void;
  psalms: number[];
}) {
  return (
    <View style={!first && s.kathismaBlock}>
      <KathismaHead label={label} />
      <PsalmRows psalms={psalms} onPsalm={onPsalm} />
    </View>
  );
});

function SearchPanel({
  bookMatches, results, onBook, onResult,
}: {
  bookMatches: BibleBook[];
  results: ScriptureSearchResult[];
  onBook: (book: BibleBook, chapter?: number) => void;
  onResult: (result: ScriptureSearchResult) => void;
}) {
  return (
    <View style={s.searchPanel}>
      {bookMatches.length > 0 && (
        <View style={s.searchBlock}>
          <Text style={s.searchKicker}>BOOKS</Text>
          {bookMatches.map(book => (
            <TouchableOpacity key={book.id} onPress={() => onBook(book, 1)} activeOpacity={0.84} style={s.matchBook}>
              <Text style={s.matchBookTitle}>{book.name}</Text>
              <Text style={s.matchBookSub}>{book.chapters} chapters</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {results.length > 0 && (
        <View style={s.searchBlock}>
          <Text style={s.searchKicker}>PASSAGES</Text>
          {results.slice(0, 24).map(result => (
            <TouchableOpacity
              key={`${result.bookId}:${result.chapter}:${result.verse}`}
              onPress={() => onResult(result)}
              activeOpacity={0.86}
              style={s.resultCard}
            >
              <Text style={s.resultRef}>{result.bookName} {result.chapter}:{result.verse}</Text>
              <ReadableText style={s.resultText} numberOfLines={3}>{result.text}</ReadableText>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {bookMatches.length === 0 && results.length === 0 && (
        <View style={s.emptySearch}>
          <Search s={24} c="rgba(197,160,89,0.34)" />
          <Text style={s.emptySearchText}>Keep typing to search Scripture.</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: BG },
  loadingText: { marginTop: 12, fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2, color: C.textMuted, textTransform: 'uppercase' },
  titleSettingsBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  languageModalRoot: { flex: 1 },
  languageMenu: {
    position: 'absolute',
    right: 17,
    width: 252,
    borderRadius: 22,
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.08)',
    shadowColor: '#0F172A',
    shadowOpacity: 0.11,
    shadowOffset: { width: 0, height: 16 },
    shadowRadius: 28,
    elevation: 10,
  },
  languageMenuTitle: { paddingHorizontal: 4, paddingBottom: 9, fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.8, color: '#A8A29E', textTransform: 'uppercase' },
  languageOptions: { gap: 7 },
  languageOption: {
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  languageOptionActive: { backgroundColor: '#F4FAF1', borderColor: 'rgba(94,123,85,0.28)' },
  languageOptionInactive: { backgroundColor: '#FFFFFF', borderColor: 'rgba(17,24,39,0.06)' },
  languageCopy: { flex: 1, minWidth: 0 },
  languageName: { fontFamily: F.serifMedium, fontSize: 17, lineHeight: 21 },
  languageCode: { marginTop: 2, fontFamily: F.sansMedium, fontSize: 11, lineHeight: 15, color: '#B7B1A7' },
  languageCheckShell: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF7E7',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.34)',
    shadowColor: GOLD,
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 10,
    elevation: 2,
  },
  languageCheckCore: {
    width: 19,
    height: 19,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GREEN,
  },
  content: { width: '100%', maxWidth: 430, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 14, gap: 10 },

  quickGrid: { flexDirection: 'row', gap: 10 },
  // This wrapper exists for the guided tour's measurement; without a gap of
  // its own the two cards inside it sat flush against each other while every
  // other seam on the screen breathed.
  doorColumn: { gap: 10 },
  quickCard: {
    flex: 1,
    minHeight: 64,
    borderRadius: 19,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#0F172A',
    shadowOpacity: 0.045,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 14,
    elevation: 1,
  },
  ribbonWrap: {
    position: 'absolute',
    top: 0,
    right: 54,
  },
  quickCardGold: { backgroundColor: '#FFFDF8', borderColor: 'hsl(39 48% 76%)' },
  quickCardGreen: { backgroundColor: '#FBFDF8', borderColor: 'hsl(106 40% 76%)' },
  // Shared by the testament cards' motif — the doors carry their own now.
  motifAnchor: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  quickCardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  quickLabel: { fontFamily: F.serifMedium, fontSize: 16.5, lineHeight: 20, letterSpacing: 0.2, color: '#2B2723', flex: 1 },
  checkpointCard: {
    minHeight: 64,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'hsl(39 48% 76%)',
    backgroundColor: '#FFFDF8',
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#0F172A',
    shadowOpacity: 0.045,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 14,
    elevation: 1,
  },
  checkpointTextWrap: { flex: 1, minWidth: 0 },
  checkpointKicker: { marginTop: 2, fontFamily: F.serifItalic, fontSize: 12.5, lineHeight: 16, color: '#A29A8C' },
  checkpointTitle: { fontFamily: F.serifMedium, fontSize: 16, lineHeight: 20, color: '#2B2723' },
  selectorPanel: { gap: 10 },
  segmented: {
    minHeight: 46,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.07)',
    backgroundColor: '#F3F2EF',
    padding: 4,
    flexDirection: 'row',
    gap: 4,
    position: 'relative',
  },
  segPill: {
    position: 'absolute',
    top: 4, bottom: 4, left: 4,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOpacity: 0.07, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2,
  },
  tabBtn: { flex: 1, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, zIndex: 1 },
  tabBtnActive: {},
  segmentIconBox: { width: 14, height: 14, position: 'relative' },
  segmentIconLayer: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 2.2, color: '#A8A29E' },
  searchBox: {
    height: 52,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.07)',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: { flex: 1, height: 52, fontFamily: F.serif, fontSize: 18, lineHeight: 24, color: '#3D3229' },
  cachedBrowseHost: { width: '100%' },
  cachedBrowseHidden: { display: 'none' },
  contentPaneStack: { width: '100%', position: 'relative' },
  contentPane: { width: '100%' },
  contentPaneActive: { position: 'relative' },
  contentPaneInactive: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  sections: { gap: 2 },

  sectionTabWrap: {
    position: 'relative',
    flexDirection: 'row',
    backgroundColor: '#F5F3EF',
    borderRadius: 20,
    padding: 5,
    borderWidth: 1,
    borderColor: 'rgba(28,25,23,0.06)',
  },
  sectionTabPill: {
    position: 'absolute',
    top: 5,
    bottom: 5,
    left: 5,
    borderRadius: 15,
    borderWidth: 1,
    zIndex: 0,
  },
  sectionTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    borderRadius: 15,
    zIndex: 1,
  },
  sectionTabText: {
    fontFamily: F.serifMedium,
    fontSize: 16,
    color: '#A8A29E',
    letterSpacing: 0.2,
  },
  bookListPanel: {
    marginTop: 10,
    borderRadius: 21,
    borderWidth: 1,
    padding: 10,
    gap: 6,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 28,
    elevation: 1,
  },
  bookListItem: {
    overflow: 'hidden',
    borderRadius: 18,
  },
  chapterPanelWrap: {
    overflow: 'hidden',
  },
  premiumBook: {
    // 54, down from 72. The name and its count now share a line, so the card
    // only ever needed one line's worth of height.
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingLeft: 14,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#0F172A',
    shadowOpacity: 0.035,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 1,
  },
  premiumBookExpanded: {
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
  },
  // The open card folds to a heading band: title only, centered.
  premiumBookCompact: {
    minHeight: 44,
    paddingVertical: 7,
  },
  openTopFrame: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  // The board of the book, standing clear of the card's ends rather than
  // running the full edge like a stripe.
  bookSpine: {
    position: 'absolute',
    left: 0,
    top: 9,
    bottom: 9,
    width: 2.5,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  shelfFrame: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
    bottom: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  bookCopy: { flex: 1, minWidth: 0, justifyContent: 'center' },
  bookLine: { flexDirection: 'row', alignItems: 'baseline', gap: 9, minWidth: 0 },
  bookName: { fontFamily: F.serif, fontSize: 17.5, lineHeight: 21, letterSpacing: 0.25, color: '#2F2B27', flexShrink: 1 },
  // The leader: it takes whatever the name leaves, so short books rule far
  // and long ones rule barely at all.
  bookTail: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'baseline', gap: 9 },
  // Leader dots, ruled from the name across to the count — the device a
  // printed contents page uses, and the reason this row reads as typeset
  // rather than as a label with a number stuck to it.
  bookLeader: { flex: 1, minWidth: 10, height: 4, alignSelf: 'center' },
  // The count is set as a folio: the book's own serif, not a meta badge.
  bookFolio: {
    fontFamily: F.serif,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 0.3,
    fontVariant: ['lining-nums', 'tabular-nums'],
  },
  bookMeta: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.5 },
  bookChevronSeat: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  chevronSeat: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  chapterPanel: {
    marginTop: 0,
    marginBottom: 8,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderWidth: 1,
    borderTopWidth: 0,
    paddingHorizontal: 14,
    paddingTop: 15,
    paddingBottom: 14,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 24,
    elevation: 1,
  },
  chapterHeadRow: {
    marginBottom: 13,
    paddingHorizontal: 2,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
  },
  chapterHeadRule: {
    flex: 1,
    height: 1,
  },
  chapterHeadDiamond: {
    width: 4,
    height: 4,
    borderRadius: 0.8,
    transform: [{ rotate: '45deg' }],
  },
  chapterHeadText: {
    fontFamily: F.sansBold,
    fontSize: 8.5,
    lineHeight: 11,
    letterSpacing: 2,
  },
  chapterGrid: {
    gap: 9,
  },
  chapterGridRow: {
    flexDirection: 'row',
    gap: 7,
  },
  chapterCell: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterSpacer: { flex: 1, minHeight: 44 },
  chapterCellText: { fontFamily: F.serif, fontSize: 18, lineHeight: 21 },
  psalterWrap: { gap: 14 },
  // The Psalter's own divisions. The head is the screen's engraved rule, and
  // the cells are a touch smaller than a book's chapter grid because there
  // are 151 of them and they now sit in twenty groups.
  kathismaBlock: { marginTop: 14 },
  kathismaHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 2,
    marginBottom: 9,
    paddingHorizontal: 2,
  },
  kathismaRule: { flex: 1, height: 1, backgroundColor: 'rgba(180,155,103,0.28)' },
  kathismaDiamond: {
    width: 4,
    height: 4,
    borderRadius: 0.8,
    backgroundColor: 'rgba(180,155,103,0.6)',
    transform: [{ rotate: '45deg' }],
  },
  kathismaLabel: {
    fontFamily: F.sansBold,
    fontSize: 8.8,
    letterSpacing: 2.1,
    color: '#A0885B',
  },
  psalmGrid: { gap: 6 },
  psalmGridRow: { flexDirection: 'row', gap: 6 },
  psalmSpacer: { flex: 1, minHeight: 40 },
  psalmCell: {
    flex: 1,
    minHeight: 40,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#EADFCC',
    backgroundColor: '#FFFEFB',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  psalmCellLit: {
    position: 'absolute',
    top: 1,
    left: 8,
    right: 8,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  psalmCellText: { fontFamily: F.serif, fontSize: 16.5, lineHeight: 19, color: '#6F5E41' },
  psalmPanel: {
    borderRadius: 23,
    borderWidth: 1,
    borderColor: '#E8E0D4',
    overflow: 'hidden',
    padding: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 18,
    elevation: 2,
  },
  searchPanel: { marginTop: 18, gap: 18 },
  searchBlock: { gap: 9 },
  searchKicker: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 2.2, color: GOLD },
  matchBook: {
    minHeight: 54,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.18)',
    backgroundColor: '#FFFDF8',
    paddingHorizontal: 15,
    justifyContent: 'center',
  },
  matchBookTitle: { fontFamily: F.serifMedium, fontSize: 21, color: '#3D3229' },
  matchBookSub: { marginTop: 1, fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.6, color: '#BEB7AA', textTransform: 'uppercase' },
  resultCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.18)',
    backgroundColor: '#FFFFFF',
    padding: 14,
  },
  resultRef: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 1.6, color: ROSE, textTransform: 'uppercase' },
  resultText: { marginTop: 6, fontFamily: F.serif, fontSize: 18, lineHeight: 26, color: '#3D3229' },
  emptySearch: { minHeight: 160, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptySearchText: { fontFamily: F.serif, fontSize: 18, color: '#A8A29E' },
});
