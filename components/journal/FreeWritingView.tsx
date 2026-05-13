import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, CheckSmall } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import { getTitleBarTopPadding, TITLE_BAR_BOTTOM_PADDING } from '@/components/shared/titleBar';
import { FormatState, RichTextEditor, RichTextEditorRef, RichToolbar } from '@/components/shared/RichTextEditor';
import { useJournal } from '@/components/journal/JournalContext';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';


const BG = '#FAF7F0';
const TEAL = '#4A9E8F';

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function FreeWritingView() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string; readOnly?: string }>();
  const selectedDateKey = typeof params.date === 'string' && params.date ? params.date : todayKey();
  const isReadOnly = params.readOnly === '1' || params.readOnly === 'true';
  const { ready: journalReady, getEntry, upsertEntry } = useJournal();
  const [html, setHtml] = useState('');
  const [fmt, setFmt] = useState<FormatState>({ bold: false, italic: false, underline: false });
  const [kbHeight, setKbHeight] = useState(0);
  const editorRef = useRef<RichTextEditorRef>(null);
  const hydratedDateRef = useRef('');
  const dirtyRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', e => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    if (!journalReady || hydratedDateRef.current === selectedDateKey) return;
    const entry = getEntry(selectedDateKey);
    setHtml(entry.freeWritingHtml ?? '');
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
      void upsertEntry(selectedDateKey, { freeWritingHtml: html });
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
    await upsertEntry(selectedDateKey, { freeWritingHtml: html });
    dirtyRef.current = false;
  };

  return (
    <View style={[s.screen, { paddingBottom: kbHeight }]}>
      <View style={[s.header, { paddingTop: getTitleBarTopPadding(insets.top) }]}>
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
          style={s.headerBtn} activeOpacity={0.7}
        >
          <ArrowLeft s={24} c={C.textMuted} />
        </TouchableOpacity>
        <Text style={s.title}>Free Writing</Text>
        {isReadOnly ? (
          <View style={s.headerBtn} />
        ) : (
        <TouchableOpacity
          style={[s.doneBtn, html.length > 0 && s.doneBtnActive]}
          activeOpacity={0.85}
          onPress={() => {
            if (html.length > 0) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            void saveNow().finally(() => router.back());
          }}
        >
          <CheckSmall s={18} c="#fff" w={2.8} />
        </TouchableOpacity>
        )}
      </View>

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
        placeholder="Write freely without rules or structure..."
        backgroundColor={BG}
        color={C.text}
        editable={!isReadOnly}
        style={s.editor}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: BG },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: TITLE_BAR_BOTTOM_PADDING, backgroundColor: BG },
  headerBtn:    { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title:        { fontFamily: F.serifMedium, fontSize: 20, color: C.text },
  doneBtn:      { width: 40, height: 40, borderRadius: 20, backgroundColor: C.textMuted, alignItems: 'center', justifyContent: 'center' },
  doneBtnActive:{ backgroundColor: TEAL, shadowColor: TEAL, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 5 },
  toolbar:      { marginHorizontal: 16, marginBottom: 8 },
  editor:       { flex: 1, marginHorizontal: 16 },
});
