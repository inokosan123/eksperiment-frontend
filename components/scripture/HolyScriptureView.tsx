import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  ActivityIndicator,
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
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Line, Path } from 'react-native-svg';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  CheckSmall,
  Book, ChevronDown, ChevronRight, Notebook,
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
import { ScriptureSearchResult, useScripture } from './ScriptureContext';
import SetAsDailyTaskCard from '@/components/shared/SetAsDailyTaskCard';
import SetAsTaskSheet from '@/components/shared/SetAsTaskSheet';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import { useAppSettings } from '@/components/settings/SettingsContext';
import { useTasks } from '@/components/tasks/TaskProvider';
import { HapticTouchableOpacity as TouchableOpacity, HapticPressable as Pressable } from '@/components/shared/HapticTouch';
import { useGuidedSetup, useGuideTarget } from '@/components/onboarding/guided/GuidedSetupContext';
import { useGuidedScrollTransition } from '@/components/onboarding/guided/use-guided-scroll-transition';


const BG = '#FCFCFC';
const GOLD = '#C5A059';
const GREEN = '#5E7B55';
const ROSE = '#BE123C';

type ScriptureTab = 'bible' | 'psalter';
type ScriptureGuideEntryTarget = 'top' | 'bibleNotes' | 'browse';
const SEGMENT_SPRING = {
  damping: 18,
  stiffness: 235,
  mass: 0.72,
};

const NEW_TESTAMENT = BIBLE_BOOKS.filter(book => book.testament === 'nt');
const OLD_TESTAMENT = BIBLE_BOOKS.filter(book => book.testament !== 'nt' && book.id !== PSALMS_ID);
const PSALTER = BIBLE_BOOKS.filter(book => book.id === PSALMS_ID);
const PSALMS_BOOK = PSALTER[0];
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
  const tabProgress = useSharedValue(0);
  const [segWidth, setSegWidth] = useState(0);
  const [activeSection, setActiveSection] = useState<'new' | 'old'>('new');
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
    const all = Array.from({ length: PSALMS_BOOK?.chapters ?? 151 }, (_, index) => index + 1);
    if (!query) return all;

    const numberPart = query.replace(/^psalms?\s*/, '').trim();
    return all.filter(number =>
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

    const timer = setTimeout(() => {
      searchVerses(query, scriptureLanguage).then(results => {
        setSearchResults(tab === 'psalter'
          ? results.filter(result => result.bookId === PSALMS_ID)
          : results);
      });
    }, 240);

    return () => clearTimeout(timer);
  }, [query, ready, scriptureLanguage, searchVerses, tab]);

  const bookMatches = useMemo(() => {
    if (!query) return [];
    const source = tab === 'psalter' ? PSALTER : BIBLE_BOOKS;
    return source.filter(book => book.name.toLowerCase().includes(query)).slice(0, 12);
  }, [query, tab]);

  const tabPillMotionStyle = useAnimatedStyle(() => ({
    width: segPillWidth,
    transform: [{ translateX: tabProgress.value * segPillTravel }],
  }), [segPillWidth, segPillTravel]);

  const sectionPillMotionStyle = useAnimatedStyle(() => ({
    width: sectionPillWidth,
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
  }), [sectionPillWidth, sectionPillTravel]);

  const switchTab = (next: ScriptureTab) => {
    if (isGuided) return;
    if (next === tab) return;
    setTab(next);
    setExpandedBookId(null);
    tabProgress.value = withSpring(next === 'bible' ? 0 : 1, SEGMENT_SPRING);
  };

  const handleLanguageChange = (lang: ScriptureLanguage) => {
    if (isGuided) return;
    Haptics.selectionAsync().catch(() => {});
    updateSettings({ bibleLang: lang });
    setSearchResults([]);
    setShowLanguageMenu(false);
  };

  const openReader = (book: BibleBook, chapter = 1, verse?: number) => {
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
  };

  const switchSection = (next: 'new' | 'old') => {
    if (isGuided) return;
    if (next === activeSection) return;
    setActiveSection(next);
    setExpandedBookId(null);
    sectionProgress.value = withSpring(next === 'new' ? 0 : 1, SEGMENT_SPRING);
  };

  const toggleBook = (book: BibleBook) => {
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
    setExpandedBookId(expandedBookId === book.id ? null : book.id);
  };

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
            <LinearGradient
              colors={['#FFFEFA', '#F6E9CB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={s.cardGround}
              pointerEvents="none"
            />
            <DoorMotif variant="rays" stroke="#B49B67" />
            <View pointerEvents="none" style={[s.quickFrame, { borderColor: 'rgba(197,160,89,0.18)' }]} />
            <PlateCorners tone={GOLD} />
            <View pointerEvents="none" style={s.litEdge} />
            <View style={s.quickCardRow}>
              <View style={s.haloWrap}>
                <View style={[s.haloAura, { backgroundColor: 'rgba(197,160,89,0.09)' }]} />
                <View style={[s.haloOuter, { borderColor: 'rgba(197,160,89,0.16)' }]} />
                <View style={[s.haloRing, { borderColor: 'rgba(197,160,89,0.38)' }]}>
                  <View style={[s.haloCore, { backgroundColor: 'rgba(197,160,89,0.10)' }]}>
                    <Star s={14} c={GOLD} />
                  </View>
                </View>
              </View>
              <Text style={s.quickLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.88}>Favorites</Text>
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
            <LinearGradient
              colors={['#FEFFFC', '#E9F2DF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={s.cardGround}
              pointerEvents="none"
            />
            <DoorMotif variant="ruling" stroke="#5E7B55" />
            <View pointerEvents="none" style={[s.quickFrame, { borderColor: 'rgba(94,123,85,0.17)' }]} />
            <PlateCorners tone={GREEN} opacity={0.4} />
            <View pointerEvents="none" style={s.litEdge} />
            <View style={s.quickCardRow}>
              <View style={s.haloWrap}>
                <View style={[s.haloAura, { backgroundColor: 'rgba(94,123,85,0.08)' }]} />
                <View style={[s.haloOuter, { borderColor: 'rgba(94,123,85,0.15)' }]} />
                <View style={[s.haloRing, { borderColor: 'rgba(94,123,85,0.36)' }]}>
                  <View style={[s.haloCore, { backgroundColor: 'rgba(94,123,85,0.10)' }]}>
                    <Notebook s={13} c={GREEN} />
                  </View>
                </View>
              </View>
              <Text style={s.quickLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.88}>Bible Notes</Text>
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
              params: { readingType: 'custom', title: 'Scripture Checkpoints' },
            } as any);
          }}
          activeOpacity={0.86}
          style={s.checkpointCard}
        >
          <LinearGradient
            colors={['#FFFEFA', '#F8EDD4']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={s.cardGround}
            pointerEvents="none"
          />
          <DoorMotif variant="ruling" stroke="#B49B67" />
          <View pointerEvents="none" style={[s.quickFrame, { borderColor: 'rgba(197,160,89,0.18)' }]} />
          <PlateCorners tone={GOLD} />
          <View pointerEvents="none" style={s.litEdge} />
          <BookmarkRibbon />
          <View style={s.haloWrap}>
            <View pointerEvents="none" style={[s.haloOuter, { borderColor: 'rgba(197,160,89,0.16)' }]} />
            <View style={[s.haloRing, { borderColor: 'rgba(197,160,89,0.38)' }]}>
              <View style={[s.haloCore, { backgroundColor: 'rgba(197,160,89,0.10)' }]}>
                <Book s={15} c={GOLD} w={2.1} />
              </View>
            </View>
          </View>
          <View style={s.checkpointTextWrap}>
            <Text style={s.checkpointTitle} numberOfLines={1}>Checkpoints</Text>
            <Text style={s.checkpointKicker}>Continue scripture reading</Text>
          </View>
          <View style={[s.chevronSeat, { borderColor: 'rgba(180,155,103,0.28)' }]}>
            <ChevronRight s={15} c="#BCA476" />
          </View>
        </TouchableOpacity>

        <SetAsDailyTaskCard
          variant="scripture"
          onPress={() => {
            if (!isGuided) setShowTaskSheet(true);
          }}
          subtitle={taskSummary}
          ornament={<DoorMotif variant="rays" stroke="#B49B67" />}
          corners={<PlateCorners tone={GOLD} />}
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
              style={[s.segPill, tabPillMotionStyle]}
            />
            <TabButton
              active={tab === 'bible'}
              icon={<Book s={14} c={tab === 'bible' ? GREEN : '#A8A29E'} />}
              label="BIBLE"
              onPress={() => switchTab('bible')}
            />
            <TabButton
              active={tab === 'psalter'}
              icon={<OpenBook s={14} c={tab === 'psalter' ? GREEN : '#A8A29E'} />}
              label="PSALTER"
              onPress={() => switchTab('psalter')}
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

        {tab === 'psalter' && PSALMS_BOOK ? (
          <PsalterBrowse
            psalms={psalmNumbers}
            results={query ? searchResults : []}
            searching={!!query}
            cardWidth={psalmCardWidth}
            onPsalm={psalm => openReader(PSALMS_BOOK, psalm)}
            onResult={openResult}
          />
        ) : query ? (
          <SearchPanel bookMatches={bookMatches} results={searchResults} onBook={openReader} onResult={openResult} />
        ) : (
          <View style={s.sections}>
            {/* NT / OT animated tab selector */}
            <View
              style={s.sectionTabWrap}
              onLayout={e => setSectionWrapWidth(e.nativeEvent.layout.width)}
            >
              <Reanimated.View style={[s.sectionTabPill, sectionPillMotionStyle]} />
              <TouchableOpacity onPress={() => switchSection('new')} activeOpacity={0.82} style={s.sectionTabBtn}>
                <Text style={[s.sectionTabText, activeSection === 'new' && { color: GREEN, fontFamily: F.serifMedium }]}>
                  New Testament
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => switchSection('old')} activeOpacity={0.82} style={s.sectionTabBtn}>
                <Text style={[s.sectionTabText, activeSection === 'old' && { color: '#8B6B2F', fontFamily: F.serifMedium }]}>
                  Old Testament
                </Text>
              </TouchableOpacity>
            </View>

            {/* Book list for selected section */}
            <BookList
              books={activeSection === 'new' ? NEW_TESTAMENT : OLD_TESTAMENT}
              tone={activeSection === 'new' ? 'green' : 'stone'}
              expandedBookId={expandedBookId}
              onBook={toggleBook}
              onChapter={openReader}
              guidedBookId={isGuided ? 49 : undefined}
              guidedChapter={isGuided ? 5 : undefined}
              bookTargetProps={isGuided ? { ref: ephesiansTarget.ref, onLayout: ephesiansTarget.onLayout } : undefined}
              chapterTargetProps={isGuided ? { ref: chapterFiveTarget.ref, onLayout: chapterFiveTarget.onLayout } : undefined}
            />
          </View>
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

function TabButton({
  active, icon, label, onPress,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.84} style={[s.tabBtn, active && s.tabBtnActive]}>
      {icon}
      <Text style={[s.tabText, active && s.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function BookList({
  books, tone, expandedBookId, onBook, onChapter, guidedBookId, guidedChapter, bookTargetProps, chapterTargetProps,
}: {
  books: BibleBook[];
  tone: 'green' | 'stone';
  expandedBookId: number | null;
  onBook: (book: BibleBook) => void;
  onChapter: (book: BibleBook, chapter?: number) => void;
  guidedBookId?: number;
  guidedChapter?: number;
  bookTargetProps?: { ref: React.Ref<any>; onLayout: (event: any) => void };
  chapterTargetProps?: { ref: React.Ref<any>; onLayout: (event: any) => void };
}) {
  const isGreen = tone === 'green';
  const panelColors = (isGreen ? ['#FCFDF9', '#F4F8EF'] : ['#FFFDF9', '#F8F4EC']) as [string, string];
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
      {books.map(book => (
        <View key={book.id} style={s.bookListItem}>
          <View {...(book.id === guidedBookId ? bookTargetProps : undefined)}>
            <PremiumBookCard
              book={book}
              tone={tone}
              expanded={expandedBookId === book.id}
              onPress={() => onBook(book)}
            />
          </View>
          {expandedBookId === book.id && (
            <View style={s.chapterPanelWrap}>
              <ChapterPanel
                book={book}
                tone={tone}
                onChapter={chapter => onChapter(book, chapter)}
                guidedChapter={book.id === guidedBookId ? guidedChapter : undefined}
                chapterTargetProps={book.id === guidedBookId ? chapterTargetProps : undefined}
              />
            </View>
          )}
        </View>
      ))}
    </LinearGradient>
  );
}

function BookSection({
  title, count, books, open, accent, tone, expandedBookId, onToggle, onBook, onChapter,
}: {
  title: string;
  count: number;
  books: BibleBook[];
  open: boolean;
  accent: string;
  tone: 'green' | 'stone';
  expandedBookId: number | null;
  onToggle: () => void;
  onBook: (book: BibleBook) => void;
  onChapter: (book: BibleBook, chapter?: number) => void;
}) {
  const isGreen = tone === 'green';
  const sectionColors = (isGreen ? ['#F6FAF3', '#EBF4E5'] : ['#FAF7F2', '#F2EBE0']) as [string, string];
  const panelColors = (isGreen ? ['#F4F9F0', '#EDF5E7'] : ['#F8F4ED', '#F2EBE0']) as [string, string];

  return (
    <View style={s.sectionWrap}>
      <TouchableOpacity onPress={onToggle} activeOpacity={0.86}>
        <LinearGradient
          colors={sectionColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[
            s.bookSection,
            {
              borderColor: isGreen ? '#D8E3D4' : '#E8E0D4',
              shadowOpacity: open ? 0.06 : 0.04,
            },
          ]}
        >
          <View style={s.sectionHead}>
            <Text style={[s.sectionTitle, { color: isGreen ? '#2E4726' : '#3A3020' }]}>{title}</Text>
            <View style={s.sectionRight}>
              <View style={[s.countPill, { borderColor: isGreen ? '#D7E2D3' : '#ECE4D6' }]}>
                <Text style={[s.countText, { color: isGreen ? '#72876A' : '#B49B67' }]}>{count}</Text>
              </View>
              <View style={[s.chevronCircle, { borderColor: isGreen ? '#D7E2D2' : '#E8DED0' }]}>
                <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
                  <ChevronDown s={16} c={accent} />
                </View>
              </View>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {open && (
        <LinearGradient
          colors={panelColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[
            s.bookListPanel,
            { borderColor: isGreen ? '#DCE5D7' : '#ECE4D7' },
          ]}
        >
          {books.map(book => (
            <React.Fragment key={book.id}>
              <PremiumBookCard
                book={book}
                tone={tone}
                expanded={expandedBookId === book.id}
                onPress={() => onBook(book)}
              />
              {expandedBookId === book.id && (
                <ChapterPanel
                  book={book}
                  tone={tone}
                  onChapter={chapter => onChapter(book, chapter)}
                />
              )}
            </React.Fragment>
          ))}
        </LinearGradient>
      )}
    </View>
  );
}

// The doors carry their own faint light: rays for what is treasured,
// ruling lines for what is written and read.
// The illumination inside the ruled frame: four right-angle marks set at the
// plate's corners, the way a manuscript's ruling is finished before anything
// is written in it. These replaced two diamond glints that sat at opposite
// corners — scattered, asymmetric, and saying nothing. A plate reads as
// struck when its corners are registered.
function PlateCorners({ tone, opacity = 0.45 }: { tone: string; opacity?: number }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {([
        ['cornerTL', s.cornerBarH, s.cornerBarV],
        ['cornerTR', s.cornerBarHRight, s.cornerBarVRight],
        ['cornerBL', s.cornerBarHBottom, s.cornerBarV],
        ['cornerBR', s.cornerBarHBottomRight, s.cornerBarVRightBottom],
      ] as const).map(([seat, bar, stem]) => (
        <View key={seat} style={s[seat]}>
          <View style={[bar, { backgroundColor: tone, opacity }]} />
          <View style={[stem, { backgroundColor: tone, opacity }]} />
        </View>
      ))}
    </View>
  );
}

function DoorMotif({ variant, stroke }: { variant: 'rays' | 'ruling'; stroke: string }) {
  const W = 150;
  const H = 96;

  return (
    <View pointerEvents="none" style={s.motifAnchor}>
      <Svg width={W} height={H}>
        {variant === 'rays'
          ? Array.from({ length: 5 }).map((_, index) => {
            const offset = index * 24;
            return (
              <Line
                key={index}
                x1={W - offset}
                y1={-6}
                x2={W - offset - 54}
                y2={H + 6}
                stroke={stroke}
                strokeOpacity={0.08}
                strokeWidth={1}
              />
            );
          })
          : Array.from({ length: 4 }).map((_, index) => {
            const y = 14 + index * 16;
            return (
              <Line
                key={index}
                x1={18}
                y1={y}
                x2={W}
                y2={y}
                stroke={stroke}
                strokeOpacity={0.09}
                strokeWidth={1}
              />
            );
          })}
      </Svg>
    </View>
  );
}

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
  const W = 200;
  const H = 100;

  return (
    <View pointerEvents="none" style={s.motifAnchor}>
      <Svg width={W} height={H}>
        {isGreen
          ? Array.from({ length: 6 }).map((_, index) => {
            const offset = index * 26;
            return (
              <Line
                key={index}
                x1={W - offset}
                y1={-6}
                x2={W - offset - 62}
                y2={H + 6}
                stroke={stroke}
                strokeOpacity={0.075}
                strokeWidth={1}
              />
            );
          })
          : Array.from({ length: 5 }).map((_, index) => {
            const y = 10 + index * 18;
            return (
              <Line
                key={index}
                x1={24}
                y1={y}
                x2={W}
                y2={y}
                stroke={stroke}
                strokeOpacity={0.085}
                strokeWidth={1}
              />
            );
          })}
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
      <View style={s.bookCopy}>
        <Reanimated.Text
          numberOfLines={1}
          onLayout={event => setTitleWidth(event.nativeEvent.layout.width)}
          style={[s.bookName, titleStyle]}
        >
          {book.name}
        </Reanimated.Text>
        <Reanimated.View style={[s.bookMetaRow, expanded && { display: 'none' }, fadeAwayStyle]}>
          <View style={[s.metaDiamond, { backgroundColor: isGreen ? 'rgba(94,123,85,0.55)' : 'rgba(180,155,103,0.6)' }]} />
          <Text style={[s.bookMeta, { color: isGreen ? '#7E9270' : '#A48F6C' }]}>
            {book.chapters} {book.chapters === 1 ? 'CHAPTER' : 'CHAPTERS'}{isDeutero ? ' · DEUTEROCANON' : ''}
          </Text>
        </Reanimated.View>
      </View>
      <Reanimated.View
        style={[s.chevronSeat, { borderColor: isGreen ? 'rgba(94,123,85,0.24)' : 'rgba(180,155,103,0.28)' }, fadeAwayStyle]}
        pointerEvents="none"
      >
        <ChevronRight s={15} c={isGreen ? '#8FA986' : '#BCA476'} />
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

function PsalterBrowse({
  psalms, results, searching, onPsalm, onResult,
}: {
  psalms: number[];
  results: ScriptureSearchResult[];
  searching: boolean;
  cardWidth?: number;
  onPsalm: (psalm: number) => void;
  onResult: (result: ScriptureSearchResult) => void;
}) {
  const rows = Array.from({ length: Math.ceil(psalms.length / 5) }, (_, i) => i);

  return (
    <View style={s.psalterWrap}>
      {psalms.length > 0 && !searching && (
        <LinearGradient
          colors={['#FFFDF9', '#FFF6E8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={s.psalmPanel}
        >
          <View style={s.chapterGrid}>
            {rows.map(rowIndex => (
              <View key={rowIndex} style={s.chapterGridRow}>
                {Array.from({ length: 5 }, (_, offset) => {
                  const psalm = psalms[rowIndex * 5 + offset];
                  if (!psalm) return <View key={`e-${rowIndex}-${offset}`} style={s.chapterSpacer} />;
                  return (
                    <TouchableOpacity
                      key={psalm}
                      onPress={() => onPsalm(psalm)}
                      activeOpacity={0.78}
                      style={[s.chapterCell, { borderColor: '#E8DECD', backgroundColor: '#FFFEFB' }]}
                    >
                      <Text style={[s.chapterCellText, { color: '#6F5E41' }]}>{psalm}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
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
              <Text style={s.resultText} numberOfLines={3}>{result.text}</Text>
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
}

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
              <Text style={s.resultText} numberOfLines={3}>{result.text}</Text>
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
  cardGround: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
    borderRadius: 18,
  },
  // Corner registration — an 8pt arm each way, set 9 in from the plate's
  // edge so the marks sit inside the ruled frame rather than on it.
  cornerTL: { position: 'absolute', top: 9, left: 9, width: 8, height: 8 },
  cornerTR: { position: 'absolute', top: 9, right: 9, width: 8, height: 8 },
  cornerBL: { position: 'absolute', bottom: 9, left: 9, width: 8, height: 8 },
  cornerBR: { position: 'absolute', bottom: 9, right: 9, width: 8, height: 8 },
  cornerBarH: { position: 'absolute', top: 0, left: 0, width: 8, height: 1, borderRadius: 0.5 },
  cornerBarV: { position: 'absolute', top: 0, left: 0, width: 1, height: 8, borderRadius: 0.5 },
  cornerBarHRight: { position: 'absolute', top: 0, right: 0, width: 8, height: 1, borderRadius: 0.5 },
  cornerBarVRight: { position: 'absolute', top: 0, right: 0, width: 1, height: 8, borderRadius: 0.5 },
  cornerBarHBottom: { position: 'absolute', bottom: 0, left: 0, width: 8, height: 1, borderRadius: 0.5 },
  cornerBarHBottomRight: { position: 'absolute', bottom: 0, right: 0, width: 8, height: 1, borderRadius: 0.5 },
  cornerBarVRightBottom: { position: 'absolute', bottom: 0, right: 0, width: 1, height: 8, borderRadius: 0.5 },
  // A hairline of light lying along the top edge, inside the border — the
  // plate catches the light before anything on it does.
  litEdge: {
    position: 'absolute',
    top: 1,
    left: 12,
    right: 12,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  // The halo's outer ring. The seat was already a ring holding a toned core;
  // this is the nimbus around it, and it is what makes the icon read as
  // haloed rather than merely circled.
  haloOuter: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
  },
  ribbonWrap: {
    position: 'absolute',
    top: 0,
    right: 54,
  },
  quickCardGold: { backgroundColor: '#FFFDF8', borderColor: 'rgba(197,160,89,0.26)' },
  quickCardGreen: { backgroundColor: '#FBFDF8', borderColor: 'rgba(94,123,85,0.20)' },
  quickFrame: {
    position: 'absolute',
    top: 5,
    left: 5,
    right: 5,
    bottom: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  quickCardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  haloWrap: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  haloAura: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  haloRing: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  haloCore: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: { fontFamily: F.serifMedium, fontSize: 16.5, lineHeight: 20, letterSpacing: 0.2, color: '#2B2723', flex: 1 },
  checkpointCard: {
    minHeight: 64,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.26)',
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
  tabText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 2.2, color: '#A8A29E' },
  tabTextActive: { color: GREEN },
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
    fontFamily: F.serif,
    fontSize: 16,
    color: '#A8A29E',
    letterSpacing: 0.2,
  },
  sectionWrap: {
    gap: 0,
  },
  bookSection: {
    borderRadius: 23,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 28,
    elevation: 2,
  },
  sectionHead: {
    minHeight: 56,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: { flex: 1, fontFamily: F.serifMedium, fontSize: 21, letterSpacing: 0.2 },
  sectionRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  countPill: {
    minWidth: 46,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 1.6 },
  chevronCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookListPanel: {
    marginTop: 10,
    borderRadius: 21,
    borderWidth: 1,
    padding: 12,
    gap: 8,
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
    minHeight: 72,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 13,
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
    minHeight: 50,
    paddingVertical: 9,
  },
  openTopFrame: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  motifAnchor: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  bookSpine: {
    position: 'absolute',
    left: 0,
    top: 11,
    bottom: 11,
    width: 3,
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
  bookName: { alignSelf: 'flex-start', fontFamily: F.serif, fontSize: 20, lineHeight: 24, letterSpacing: 0.2, color: '#2F2B27' },
  bookMetaRow: { marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaDiamond: {
    width: 4,
    height: 4,
    borderRadius: 0.8,
    transform: [{ rotate: '45deg' }],
  },
  bookMeta: { fontFamily: F.sansBold, fontSize: 9.5, letterSpacing: 1.6 },
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
