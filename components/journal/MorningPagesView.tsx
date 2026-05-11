import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, CheckSmall } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import { getTitleBarTopPadding, TITLE_BAR_BOTTOM_PADDING } from '@/components/shared/titleBar';
import { FormatState, RichTextEditor, RichTextEditorRef, RichToolbar } from '@/components/shared/RichTextEditor';
import { useJournal } from '@/components/journal/JournalContext';
import { countWords } from '@/components/journal/journalLogic';

const BG = '#FAF7F0';
const TARGET = 750;

const DAILY_PROMPTS = [
  'What is on your mind right now?',
  'What are you afraid of today?',
  'What do you truly desire?',
  'What would make today wonderful?',
];

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function MorningPagesView() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string; readOnly?: string }>();
  const selectedDateKey = typeof params.date === 'string' && params.date ? params.date : todayKey();
  const isReadOnly = params.readOnly === '1' || params.readOnly === 'true';
  const { ready: journalReady, getEntry, upsertEntry } = useJournal();
  const [html, setHtml] = useState('');
  const [fmt, setFmt] = useState<FormatState>({ bold: false, italic: false, underline: false });
  const [showInfo, setShowInfo] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);
  const editorRef = useRef<RichTextEditorRef>(null);
  const hydratedDateRef = useRef('');
  const dirtyRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wordCount = countWords(html);
  const pct = Math.min(wordCount / TARGET, 1);
  const isDone = wordCount >= TARGET;
  const promptIdx = new Date().getDay();

  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', e => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    if (!journalReady || hydratedDateRef.current === selectedDateKey) return;
    const entry = getEntry(selectedDateKey);
    setHtml(entry.morningPagesHtml ?? '');
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
      });
      dirtyRef.current = false;
    }, 350);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [html, isReadOnly, selectedDateKey, upsertEntry]);

  const saveNow = async () => {
    if (isReadOnly) return;
    await upsertEntry(selectedDateKey, {
      morningPagesHtml: html,
      morningPagesWordCount: countWords(html),
    });
    dirtyRef.current = false;
  };

  return (
    <View style={[s.screen, { paddingBottom: kbHeight }]}>
      <View style={[s.header, { paddingTop: getTitleBarTopPadding(insets.top) }]}>
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
          style={s.btn} activeOpacity={0.7}
        >
          <ArrowLeft s={24} c={C.textMuted} />
        </TouchableOpacity>
        <Text style={s.title}>Morning Pages</Text>
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowInfo(v => !v); }}
          style={s.btn} activeOpacity={0.7}
        >
          <View style={s.infoBadge}><Text style={s.infoTxt}>i</Text></View>
        </TouchableOpacity>
      </View>

      {showInfo && (
        <View style={s.infoCard}>
          <Text style={s.infoHeading}>What are Morning Pages?</Text>
          <Text style={s.infoBody}>
            {"Morning Pages is a technique by Julia Cameron (The Artist's Way). Every morning, write 3 pages of stream-of-consciousness - anything that comes to mind, without judgment."}
          </Text>
        </View>
      )}

      <Text style={s.prompt}>{`"${DAILY_PROMPTS[promptIdx % DAILY_PROMPTS.length]}"`}</Text>

      {!isReadOnly && <RichToolbar editorRef={editorRef} activeFormats={fmt} style={s.toolbar} />}

      <RichTextEditor
        key={selectedDateKey}
        ref={editorRef}
        initialHTML={html}
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

      <View style={s.bar}>
        <View style={s.track}>
          <LinearGradient
            colors={isDone ? ['#16A34A', '#22C55E'] : ['#C5A059', '#D4B06A']}
            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            style={[s.fill, { width: `${pct * 100}%` as any }]}
          />
        </View>
        <View style={s.barRow}>
          <Text style={s.count}>
            <Text style={[s.countNum, isDone && { color: '#16A34A' }]}>{wordCount}</Text>
            {` / ${TARGET} words`}
          </Text>
          {!isReadOnly && (
          <TouchableOpacity
            style={[s.doneBtn, isDone && s.doneBtnSuccess]}
            activeOpacity={0.85}
            onPress={() => {
              if (isDone) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              void saveNow().finally(() => router.back());
            }}
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
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: TITLE_BAR_BOTTOM_PADDING, backgroundColor: BG },
  btn:           { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title:         { fontFamily: F.serifMedium, fontSize: 20, color: C.text },
  infoBadge:     { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: C.textMuted, alignItems: 'center', justifyContent: 'center' },
  infoTxt:       { fontFamily: F.sansBold, fontSize: 13, color: C.textMuted },
  infoCard:      { marginHorizontal: 16, marginBottom: 10, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#E8E3F0', padding: 16 },
  infoHeading:   { fontFamily: F.serifMedium, fontSize: 17, color: C.text, marginBottom: 8 },
  infoBody:      { fontFamily: F.sans, fontSize: 14, color: C.textSecondary, lineHeight: 22 },
  prompt:        { textAlign: 'center', fontFamily: F.serifMediumItalic, fontSize: 14, color: C.textMuted, marginBottom: 8, paddingHorizontal: 20 },
  toolbar:       { marginHorizontal: 16, marginBottom: 8 },
  editor:        { flex: 1, marginHorizontal: 16 },
  bar:           { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, backgroundColor: BG, borderTopWidth: 1, borderTopColor: 'rgba(124,110,175,0.1)' },
  track:         { height: 4, borderRadius: 4, backgroundColor: '#EDE9E0', overflow: 'hidden', marginBottom: 10 },
  fill:          { height: '100%', borderRadius: 4 },
  barRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count:         { fontFamily: F.sans, fontSize: 14, color: C.textMuted },
  countNum:      { fontFamily: F.sansBold, fontSize: 16, color: C.text },
  doneBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.textMuted, paddingVertical: 11, paddingHorizontal: 20, borderRadius: 14 },
  doneBtnSuccess:{ backgroundColor: '#16A34A', shadowColor: '#16A34A', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  doneTxt:       { fontFamily: F.sansBold, fontSize: 14, color: '#fff' },
});
