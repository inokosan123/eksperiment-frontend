import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, View, Text, StyleSheet, TextInput } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { CheckSmall } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import { FormatState, RichTextEditor, RichTextEditorRef, RichToolbar } from '@/components/shared/RichTextEditor';
import { useJournal } from '@/components/journal/JournalContext';
import { countWords, JOURNAL_MORNING_PAGES_MINIMUM_WORDS } from '@/components/journal/journalLogic';
import { useTasks } from '@/components/tasks/TaskProvider';
import { queueTaskCompletionReturnAnimation } from '@/components/tasks/taskReturnAnimation';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const BG = '#FAF7F0';
const TARGET = 750;
const COMPLETE_MINIMUM = JOURNAL_MORNING_PAGES_MINIMUM_WORDS;

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function MorningPagesView() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    date?: string;
    readOnly?: string;
    title?: string;
    isTask?: string;
    taskInstanceId?: string;
    taskDate?: string;
  }>();
  const selectedDateKey = typeof params.date === 'string' && params.date ? params.date : todayKey();
  const isReadOnly = params.readOnly === '1' || params.readOnly === 'true';
  const isTaskLaunch = params.isTask === 'true' || !!params.taskInstanceId;
  const taskTitle = typeof params.title === 'string' && params.title.trim() ? params.title.trim() : 'Morning Pages';
  const { ready: journalReady, getEntry, upsertEntry } = useJournal();
  const { completeInstance } = useTasks();
  const [html, setHtml] = useState('');
  const [fmt, setFmt] = useState<FormatState>({ bold: false, italic: false, underline: false });
  const [showInfo, setShowInfo] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);
  const [editorContentKey, setEditorContentKey] = useState(`morning:${selectedDateKey}:pending`);
  const editorRef = useRef<RichTextEditorRef>(null);
  const hydratedDateRef = useRef('');
  const dirtyRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitSaveRef = useRef({
    date: selectedDateKey,
    html: '',
    readOnly: isReadOnly,
    queueCelebration: !isTaskLaunch,
  });
  const wordCount = countWords(html);
  const pct = Math.min(wordCount / TARGET, 1);
  const isComplete = wordCount >= COMPLETE_MINIMUM;
  const reachedTarget = wordCount >= TARGET;
  exitSaveRef.current = {
    date: selectedDateKey,
    html,
    readOnly: isReadOnly,
    queueCelebration: !isTaskLaunch,
  };

  const animPct = useSharedValue(pct);
  const animCount = useSharedValue(wordCount);

  useEffect(() => {
    animPct.value = withTiming(pct, { duration: 320 });
    animCount.value = withTiming(wordCount, { duration: 320 });
  }, [pct, wordCount, animPct, animCount]);

  const barFillStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(100, animPct.value * 100))}%`,
  }));

  const countAnimatedProps = useAnimatedProps(() => ({
    text: String(Math.round(animCount.value)),
    defaultValue: String(Math.round(animCount.value)),
  }) as any);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', e => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    hydratedDateRef.current = '';
    dirtyRef.current = false;
    setEditorContentKey(`morning:${selectedDateKey}:pending`);
  }, [selectedDateKey]);

  useEffect(() => {
    if (!journalReady || hydratedDateRef.current === selectedDateKey) return;
    const entry = getEntry(selectedDateKey);
    setHtml(entry.morningPagesHtml ?? '');
    setEditorContentKey(`morning:${selectedDateKey}:${entry.updatedAt || 0}`);
    hydratedDateRef.current = selectedDateKey;
    dirtyRef.current = false;
  }, [journalReady, selectedDateKey, getEntry]);

  useEffect(() => {
    if (isReadOnly) return;
    if (!dirtyRef.current || hydratedDateRef.current !== selectedDateKey) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      void upsertEntry(selectedDateKey, {
        morningPagesHtml: html,
        morningPagesWordCount: countWords(html),
      }, {
        queueCompletionCelebration: !isTaskLaunch,
      }).then(() => {
        dirtyRef.current = false;
      }).catch(error => {
        console.warn('Morning pages autosave failed', error);
      });
    }, 350);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [html, isReadOnly, isTaskLaunch, selectedDateKey, upsertEntry]);

  const saveNow = async () => {
    if (isReadOnly) return;
    if (!dirtyRef.current || hydratedDateRef.current !== selectedDateKey) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await upsertEntry(selectedDateKey, {
      morningPagesHtml: html,
      morningPagesWordCount: countWords(html),
    }, {
      queueCompletionCelebration: !isTaskLaunch,
    });
    dirtyRef.current = false;
  };

  useEffect(() => () => {
    const snapshot = exitSaveRef.current;
    if (
      snapshot.readOnly
      || !dirtyRef.current
      || hydratedDateRef.current !== snapshot.date
    ) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    void upsertEntry(snapshot.date, {
      morningPagesHtml: snapshot.html,
      morningPagesWordCount: countWords(snapshot.html),
    }, {
      queueCompletionCelebration: snapshot.queueCelebration,
    }).catch(error => {
      console.warn('Morning pages exit save failed', error);
    });
  }, [upsertEntry]);

  const finish = async () => {
    const shouldCompleteTask = isTaskLaunch && !!params.taskInstanceId && isComplete;
    if (!shouldCompleteTask) {
      if (isComplete) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    await saveNow();
    if (shouldCompleteTask && params.taskInstanceId) {
      const completionDate = params.taskDate ?? selectedDateKey;
      await completeInstance(params.taskInstanceId, completionDate);
      queueTaskCompletionReturnAnimation(params.taskInstanceId, 420);
    }
    router.back();
  };

  return (
    <View style={[s.screen, { paddingBottom: kbHeight }]}>
      <ScreenTitleBar
        title={taskTitle.toUpperCase()}
        showBack
        bg={BG}
        onBackOverride={() => {
          if (isReadOnly) {
            router.back();
            return;
          }
          void finish();
        }}
        rightElement={(
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowInfo(v => !v); }}
            style={s.btn}
            activeOpacity={0.7}
          >
            <View style={s.infoBadge}><Text style={s.infoTxt}>i</Text></View>
          </TouchableOpacity>
        )}
      />

      {showInfo && (
        <View style={s.infoCard}>
          <Text style={s.infoHeading}>What are Morning Pages?</Text>
          <Text style={s.infoBody}>
            {"Morning Pages is a technique by Julia Cameron (The Artist's Way). Every morning, write 3 pages of stream-of-consciousness - anything that comes to mind, without judgment."}
          </Text>
        </View>
      )}

      {!isReadOnly && <RichToolbar editorRef={editorRef} activeFormats={fmt} style={s.toolbar} />}

      <RichTextEditor
        key={selectedDateKey}
        ref={editorRef}
        initialHTML={html}
        contentKey={editorContentKey}
        onChange={(value) => {
          if (isReadOnly) return;
          dirtyRef.current = true;
          setHtml(value);
        }}
        onFormatChange={setFmt}
        placeholder="Write 3 pages of stream-of-consciousness..."
        backgroundColor={BG}
        color={C.text}
        editable={!isReadOnly}
        style={s.editor}
      />

      <View style={[s.bar, { paddingBottom: kbHeight > 0 ? 0 : Math.max(insets.bottom + 4, 18) }]}>
        <View style={s.track}>
          <Animated.View style={[s.fill, barFillStyle]}>
            <LinearGradient
              colors={reachedTarget ? ['#16A34A', '#22C55E'] : ['#C5A059', '#D4B06A']}
              start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
        <View style={s.barRow}>
          <View style={s.countWrap}>
            <AnimatedTextInput
              editable={false}
              caretHidden
              underlineColorAndroid="transparent"
              defaultValue={String(wordCount)}
              animatedProps={countAnimatedProps}
              style={[s.countNum, isComplete && { color: '#7C6EAF' }, reachedTarget && { color: '#16A34A' }]}
            />
            <Text style={s.count}>{` / ${TARGET} words`}</Text>
          </View>
          {!isReadOnly && (
          <TouchableOpacity
            style={[s.doneBtn, isComplete && s.doneBtnSuccess]}
            activeOpacity={0.85}
            onPress={() => { void finish(); }}
          >
            <CheckSmall s={18} c="#fff" w={2.8} />
            <Text style={s.doneTxt}>Done</Text>
          </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen:        { flex: 1, backgroundColor: BG },
  btn:           { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  infoBadge:     { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: C.textMuted, alignItems: 'center', justifyContent: 'center' },
  infoTxt:       { fontFamily: F.sansBold, fontSize: 13, color: C.textMuted },
  infoCard:      { marginHorizontal: 16, marginBottom: 10, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#E8E3F0', padding: 16 },
  infoHeading:   { fontFamily: F.serifMedium, fontSize: 17, color: C.text, marginBottom: 8 },
  infoBody:      { fontFamily: F.sans, fontSize: 14, color: C.textSecondary, lineHeight: 22 },
  toolbar:       { marginHorizontal: 16, marginBottom: 8 },
  editor:        { flex: 1, marginHorizontal: 16 },
  bar:           { paddingHorizontal: 20, paddingTop: 12, backgroundColor: BG, borderTopWidth: 1, borderTopColor: 'rgba(124,110,175,0.1)' },
  track:         { height: 4, borderRadius: 4, backgroundColor: '#EDE9E0', overflow: 'hidden', marginBottom: 10 },
  fill:          { height: '100%', borderRadius: 4 },
  barRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  countWrap:     { flexDirection: 'row', alignItems: 'baseline' },
  count:         { fontFamily: F.sans, fontSize: 14, color: C.textMuted },
  countNum:      { fontFamily: F.sansBold, fontSize: 16, color: C.text, padding: 0, margin: 0, minWidth: 18, textAlignVertical: 'center', includeFontPadding: false },
  doneBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.textMuted, paddingVertical: 11, paddingHorizontal: 20, borderRadius: 14 },
  doneBtnSuccess:{ backgroundColor: '#16A34A', shadowColor: '#16A34A', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  doneTxt:       { fontFamily: F.sansBold, fontSize: 14, color: '#fff' },
});
