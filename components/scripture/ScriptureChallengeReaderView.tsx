import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  Book,
  CheckSmall,
  ChevronLeft,
  ChevronRight,
  Trophy,
} from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { F } from '@/constants/tokens';
import { getTitleBarTopPadding } from '@/components/shared/titleBar';
import {
  getScriptureChallengeReaderSession,
  type ScriptureChallengeReaderSession,
  type ScriptureChallengeSessionResult,
} from '@/components/challenges/challengeDb';
import { getScriptureChallengeUnitLabel } from '@/components/scripture/scriptureChallengePlan';
import { BibleVerse, useScripture } from '@/components/scripture/ScriptureContext';

const BG = '#FCFCFC';
const GOLD = '#C5A059';
const INK = '#1C1917';

type Props = {
  taskInstanceId: string;
  title?: string;
  onBack: () => void;
  onComplete: (readUnits: number) => Promise<ScriptureChallengeSessionResult | null>;
};

export default function ScriptureChallengeReaderView({
  taskInstanceId,
  title,
  onBack,
  onComplete,
}: Props) {
  const insets = useSafeAreaInsets();
  const { ready, getChapter } = useScripture();
  const [session, setSession] = useState<ScriptureChallengeReaderSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [readLimit, setReadLimit] = useState(0);
  const [verses, setVerses] = useState<BibleVerse[]>([]);
  const [chapterLoading, setChapterLoading] = useState(true);
  const [chapterError, setChapterError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [celebrationVisible, setCelebrationVisible] = useState(false);

  useEffect(() => {
    let active = true;
    setSessionLoading(true);
    setSessionError(null);
    getScriptureChallengeReaderSession(taskInstanceId)
      .then(next => {
        if (!active) return;
        setSession(next);
        setReadLimit(Math.max(0, next?.plannedUnits.length ?? 0));
        setCursor(0);
        if (!next) setSessionError('This challenge reading could not be loaded.');
      })
      .catch(error => {
        console.warn('Failed to load scripture challenge session', error);
        if (!active) return;
        setSession(null);
        setSessionError('This challenge reading could not be loaded.');
      })
      .finally(() => {
        if (active) setSessionLoading(false);
      });

    return () => {
      active = false;
    };
  }, [taskInstanceId]);

  const visibleUnits = useMemo(() => {
    if (!session) return [];
    return session.allUnits.slice(session.startUnitIndex, session.startUnitIndex + readLimit);
  }, [readLimit, session]);

  const currentUnit = visibleUnits[cursor];
  const plannedFirst = session?.plannedUnits[0];
  const plannedLast = session?.plannedUnits[Math.max(0, session.plannedUnits.length - 1)];
  const canGoPrev = cursor > 0;
  const canReadMore = !!session && session.startUnitIndex + readLimit < session.allUnits.length;
  const atVisibleEnd = visibleUnits.length > 0 && cursor >= visibleUnits.length - 1;
  const currentReadUnits = visibleUnits.length > 0 ? cursor + 1 : 0;
  const currentProgress = session ? Math.min(session.progressTotal, session.progressBefore + currentReadUnits) : 0;
  const currentUnitLabel = currentUnit?.noun === 'psalm' ? 'PSALM' : 'CHAPTER';
  const nextButtonLabel = currentUnit?.noun === 'psalm' ? 'NEXT PSALM' : 'NEXT CHAPTER';
  const readMoreLabel = session
    ? `READ ONE MORE ${getScriptureChallengeUnitLabel(session.challenge, 1).toUpperCase()}`
    : 'READ ONE MORE';

  useEffect(() => {
    if (!ready || !currentUnit) return;
    let active = true;
    setChapterLoading(true);
    setChapterError(null);
    getChapter(currentUnit.bookId, currentUnit.chapter, 'en')
      .then(nextVerses => {
        if (!active) return;
        setVerses(nextVerses);
        if (nextVerses.length === 0) {
          setChapterError('This passage could not be loaded.');
        }
      })
      .catch(error => {
        console.warn('Failed to load scripture challenge chapter', error);
        if (!active) return;
        setVerses([]);
        setChapterError('This passage could not be loaded.');
      })
      .finally(() => {
        if (active) setChapterLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentUnit, getChapter, ready]);

  const goPrev = useCallback(() => {
    if (!canGoPrev) return;
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    setCursor(value => Math.max(0, value - 1));
  }, [canGoPrev]);

  const goNext = useCallback(() => {
    if (!currentUnit || cursor >= visibleUnits.length - 1) return;
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    setCursor(value => Math.min(visibleUnits.length - 1, value + 1));
  }, [currentUnit, cursor, visibleUnits.length]);

  const readOneMore = useCallback(() => {
    if (!canReadMore) return;
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    setReadLimit(value => value + 1);
    setCursor(value => value + 1);
  }, [canReadMore]);

  const finish = useCallback(async () => {
    if (!currentUnit || finishing) return;
    setFinishing(true);
    try {
      const result = await onComplete(currentReadUnits);
      if (result?.completed) {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
        setCelebrationVisible(true);
        return;
      }
      onBack();
    } finally {
      setFinishing(false);
    }
  }, [currentReadUnits, currentUnit, finishing, onBack, onComplete]);

  const closeCelebration = useCallback(() => {
    setCelebrationVisible(false);
    onBack();
  }, [onBack]);

  if (!ready || sessionLoading) {
    return (
      <View style={s.loadingScreen}>
        <ActivityIndicator color={GOLD} />
        <Text style={s.loadingText}>Loading Scripture...</Text>
      </View>
    );
  }

  if (sessionError || !session || !currentUnit) {
    return (
      <View style={s.screen}>
        <Header top={insets.top} title={title ?? 'Scripture Challenge'} onBack={onBack} />
        <View style={s.emptyState}>
          <Book s={26} c={GOLD} />
          <Text style={s.emptyTitle}>Reading plan unavailable</Text>
          <Text style={s.emptyText}>{sessionError ?? 'There is no reading assigned for this challenge.'}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <Header top={insets.top} title={title ?? session.challenge.title} onBack={onBack} />

      <View style={s.planWrap}>
        <View style={s.planPill}>
          <Text style={s.planEyebrow}>TODAY</Text>
          <Text style={s.planText} numberOfLines={1} adjustsFontSizeToFit>
            {plannedFirst?.ref ?? currentUnit.ref}{plannedLast && plannedLast.ref !== plannedFirst?.ref ? ` - ${plannedLast.ref}` : ''}
          </Text>
        </View>
        <Text style={s.progressText}>
          {currentProgress}/{session.progressTotal} {session.progressUnit}
        </Text>
      </View>

      <ChapterBar
        chapter={currentUnit.chapter}
        label={currentUnitLabel}
        canGoPrev={canGoPrev}
        onPrev={goPrev}
      />

      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 155 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.bookTitle}>{currentUnit.bookName.toUpperCase()}</Text>
        {chapterLoading ? (
          <View style={s.chapterLoading}>
            <ActivityIndicator color={GOLD} />
          </View>
        ) : chapterError ? (
          <View style={s.emptyChapter}>
            <Book s={24} c={GOLD} />
            <Text style={s.emptyTitle}>Scripture is reloading</Text>
            <Text style={s.emptyText}>{chapterError}</Text>
          </View>
        ) : (
          <View style={s.verseList}>
            {verses.map(verse => (
              <ChallengeVerseRow key={verse.verse} verse={verse} />
            ))}
          </View>
        )}
      </ScrollView>

      <View style={[s.actionDockWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={s.actionDock}>
          {!atVisibleEnd ? (
            <>
              <TouchableOpacity
                onPress={finish}
                disabled={finishing}
                activeOpacity={0.82}
                style={[s.secondaryBtn, finishing && s.disabledBtn]}
              >
                <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.78} style={s.secondaryText}>FINISH EARLY</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={goNext} activeOpacity={0.84} style={s.primaryBtn}>
                <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.78} style={s.primaryText}>{nextButtonLabel}</Text>
                <ChevronRight s={16} c="#FFFFFF" w={2.4} />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                onPress={finish}
                disabled={finishing}
                activeOpacity={0.84}
                style={[s.primaryBtn, !canReadMore && s.primaryBtnWide, finishing && s.disabledBtn]}
              >
                <CheckSmall s={15} c="#FFFFFF" w={2.6} />
                <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.78} style={s.primaryText}>FINISH</Text>
              </TouchableOpacity>
              {canReadMore ? (
                <TouchableOpacity onPress={readOneMore} activeOpacity={0.82} style={s.secondaryBtn}>
                  <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.72} style={s.secondaryText}>{readMoreLabel}</Text>
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </View>
      </View>

      <CelebrationModal
        visible={celebrationVisible}
        title={session.challenge.title}
        onContinue={closeCelebration}
      />
    </View>
  );
}

function Header({
  top,
  title,
  onBack,
}: {
  top: number;
  title: string;
  onBack: () => void;
}) {
  return (
    <View style={[s.header, { paddingTop: getTitleBarTopPadding(top) }]}>
      <View style={s.headerTitleAbs} pointerEvents="none">
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.62} style={s.headerTitle}>
          {title.toUpperCase()}
        </Text>
      </View>
      <TouchableOpacity onPress={onBack} style={s.headerBtn} activeOpacity={0.7}>
        <ArrowLeft s={24} c="#9CA3AF" />
      </TouchableOpacity>
    </View>
  );
}

function ChapterBar({
  chapter,
  label,
  canGoPrev,
  onPrev,
}: {
  chapter: number;
  label: 'CHAPTER' | 'PSALM';
  canGoPrev: boolean;
  onPrev: () => void;
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
      <View style={s.chapterBtn}>
        <ChevronRight s={20} c="#E5E7EB" />
      </View>
    </View>
  );
}

function ChallengeVerseRow({ verse }: { verse: BibleVerse }) {
  return (
    <View style={s.verseRow}>
      <View style={s.verseMarker}>
        <Text style={s.verseNum}>{verse.verse}</Text>
      </View>
      <Text style={s.verseText}>{verse.text}</Text>
    </View>
  );
}

function CelebrationModal({
  visible,
  title,
  onContinue,
}: {
  visible: boolean;
  title: string;
  onContinue: () => void;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onContinue}>
      <View style={s.modalOverlay}>
        <View style={s.celebrationCard}>
          <View style={s.trophyCircle}>
            <Trophy s={30} c={GOLD} w={2.1} />
          </View>
          <Text style={s.celebrationKicker}>CHALLENGE COMPLETE</Text>
          <Text style={s.celebrationTitle}>{title}</Text>
          <Text style={s.celebrationBody}>
            The final passage is finished. Your trophy is waiting in challenge history.
          </Text>
          <TouchableOpacity onPress={onContinue} activeOpacity={0.85} style={s.continueBtn}>
            <Text style={s.continueText}>CONTINUE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BG,
  },
  loadingText: {
    marginTop: 12,
    fontFamily: F.sansSemiBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: '#A8A29E',
    textTransform: 'uppercase',
  },
  header: {
    minHeight: 73,
    paddingHorizontal: 16,
    paddingBottom: 11,
    justifyContent: 'flex-end',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(28,25,23,0.05)',
  },
  headerTitleAbs: {
    position: 'absolute',
    left: 62,
    right: 62,
    bottom: 17,
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: F.serifMedium,
    fontSize: 16,
    letterSpacing: 1.8,
    color: '#0F172A',
  },
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  planWrap: {
    paddingHorizontal: 16,
    paddingTop: 13,
    gap: 8,
  },
  planPill: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.18)',
    backgroundColor: '#FFFDF8',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  planEyebrow: {
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 1.8,
    color: '#C5A059',
    marginBottom: 4,
  },
  planText: {
    fontFamily: F.serifMedium,
    fontSize: 18,
    color: INK,
    letterSpacing: 0,
  },
  progressText: {
    alignSelf: 'center',
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: '#A8A29E',
    textTransform: 'uppercase',
  },
  chapterBar: {
    marginTop: 13,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chapterBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterPill: {
    minWidth: 155,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.18)',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  chapterPillDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(197,160,89,0.45)',
  },
  chapterTitle: {
    fontFamily: F.sansBold,
    fontSize: 11,
    letterSpacing: 1.7,
    color: '#8B7354',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 22,
  },
  bookTitle: {
    alignSelf: 'center',
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2,
    color: '#C5A059',
    marginBottom: 18,
  },
  chapterLoading: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  emptyChapter: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 220,
    gap: 10,
  },
  emptyTitle: {
    fontFamily: F.serifMedium,
    fontSize: 20,
    color: INK,
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: F.serif,
    fontSize: 15,
    lineHeight: 22,
    color: '#78716C',
    textAlign: 'center',
  },
  verseList: {
    gap: 16,
  },
  verseRow: {
    flexDirection: 'row',
    gap: 11,
    paddingVertical: 6,
    paddingHorizontal: 3,
  },
  verseMarker: {
    width: 26,
    alignItems: 'center',
    paddingTop: 4,
  },
  verseNum: {
    fontFamily: F.sansBold,
    fontSize: 11,
    color: '#C5A059',
  },
  verseText: {
    flex: 1,
    fontFamily: F.serif,
    fontSize: 21,
    lineHeight: 32,
    color: '#1F1F1F',
    letterSpacing: 0,
  },
  actionDockWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: 'rgba(252,252,252,0.96)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(28,25,23,0.06)',
  },
  actionDock: {
    minHeight: 68,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(28,25,23,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.09,
    shadowRadius: 24,
    elevation: 7,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  primaryBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 18,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 12,
  },
  primaryBtnWide: {
    flex: 1,
  },
  primaryText: {
    fontFamily: F.sansBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.24)',
    backgroundColor: '#FFFDF8',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  secondaryText: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 1.35,
    color: '#8B7354',
    textAlign: 'center',
  },
  disabledBtn: {
    opacity: 0.55,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.36)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  celebrationCard: {
    width: '100%',
    maxWidth: 330,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 26,
    alignItems: 'center',
  },
  trophyCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF6E8',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  celebrationKicker: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2,
    color: GOLD,
    marginBottom: 8,
  },
  celebrationTitle: {
    fontFamily: F.serifMedium,
    fontSize: 24,
    lineHeight: 29,
    color: INK,
    textAlign: 'center',
    marginBottom: 10,
  },
  celebrationBody: {
    fontFamily: F.serif,
    fontSize: 15,
    lineHeight: 23,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 22,
  },
  continueBtn: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: GOLD,
    alignItems: 'center',
    paddingVertical: 14,
  },
  continueText: {
    fontFamily: F.sansBold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: '#FFFFFF',
  },
});
