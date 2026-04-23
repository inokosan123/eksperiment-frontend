import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, Feather, CheckSmall } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import { getTitleBarTopPadding, TITLE_BAR_BOTTOM_PADDING } from '@/components/shared/titleBar';
import { TextFormatToolbar, TextSelection } from '@/components/shared/TextFormatToolbar';
import { LinedTextInput } from '@/components/shared/LinedTextInput';

const BG = '#FAF7F0';
const PURPLE = '#7C6EAF';
const TARGET = 750;

const DAILY_PROMPTS = [
  'What is on your mind right now?',
  'What are you afraid of today?',
  'What do you truly desire?',
  'What would make today wonderful?',
];

function countWords(text: string) {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
}

export default function MorningPagesView() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [text, setText] = useState('');
  const [selection, setSelection] = useState<TextSelection>({ start: 0, end: 0 });
  const [showInfo, setShowInfo] = useState(false);
  const wordCount = countWords(text);
  const pct = Math.min(wordCount / TARGET, 1);
  const isDone = wordCount >= TARGET;
  const promptIdx = new Date().getDay();

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <View style={[hd.wrap, { paddingTop: getTitleBarTopPadding(insets.top) }]}>
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
          style={hd.btn} activeOpacity={0.7}
        >
          <ArrowLeft s={24} c={C.textMuted} />
        </TouchableOpacity>
        <Text style={hd.title}>Morning Pages</Text>
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowInfo(v => !v); }}
          style={hd.btn} activeOpacity={0.7}
        >
          <View style={hd.infoBadge}><Text style={hd.infoTxt}>i</Text></View>
        </TouchableOpacity>
      </View>

      <Text style={dt.date}>Wed, April 22</Text>

      <TextFormatToolbar
        value={text}
        selection={selection}
        onChangeText={setText}
        onSelectionChange={setSelection}
        style={fmt.toolbar}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
        {showInfo && (
          <View style={info.card}>
            <Text style={info.heading}>What are Morning Pages?</Text>
            <Text style={info.body}>
              {"Morning Pages is a technique by Julia Cameron (The Artist's Way). Every morning, write 3 pages of stream-of-consciousness - anything that comes to mind, without judgment or editing."}
            </Text>
            <View style={info.steps}>
              {['Write first thing after waking', 'Fill 3 full pages without stopping', 'Never re-read or share what you wrote'].map((s, i) => (
                <View key={i} style={info.step}>
                  <View style={info.stepNum}><Text style={info.stepNumTxt}>{i + 1}</Text></View>
                  <Text style={info.stepTxt}>{s}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={wr.wrap}>
          {text.length === 0 && (
            <View style={wr.placeholder}>
              <Feather s={32} c={PURPLE} w={1.5} />
              <Text style={wr.placeholderTitle}>Write 3 pages of stream-of-consciousness</Text>
              <Text style={wr.prompt}>{`Today's prompt: "${DAILY_PROMPTS[promptIdx % DAILY_PROMPTS.length]}"`}</Text>
            </View>
          )}
          <LinedTextInput
            placeholder=""
            value={text}
            onChangeText={setText}
            selection={selection}
            onSelectionChange={setSelection}
            minLines={11}
            lineHeight={34}
            inputStyle={wr.input}
            autoCorrect={false}
          />
        </View>
      </ScrollView>

      <View style={[bb.wrap, { paddingBottom: insets.bottom + 8 }]}>
        <View style={bb.track}>
          <LinearGradient
            colors={isDone ? ['#16A34A', '#22C55E'] : ['#C5A059', '#D4B06A']}
            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            style={[bb.fill, { width: `${pct * 100}%` as any }]}
          />
        </View>

        <View style={bb.row}>
          <Text style={bb.count}>
            <Text style={[bb.countNum, isDone && { color: '#16A34A' }]}>{wordCount}</Text>
            {' '}/ {TARGET} words
          </Text>
          <TouchableOpacity
            style={[bb.doneBtn, isDone && bb.doneBtnSuccess]}
            activeOpacity={0.85}
            onPress={() => {
              if (isDone) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } else {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }
              router.back();
            }}
          >
            <CheckSmall s={18} c="#fff" w={2.8} />
            <Text style={bb.doneTxt}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const hd = StyleSheet.create({
  wrap:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: TITLE_BAR_BOTTOM_PADDING, backgroundColor: BG },
  btn:       { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title:     { fontFamily: F.serifMedium, fontSize: 20, color: C.text },
  infoBadge: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: C.textMuted, alignItems: 'center', justifyContent: 'center' },
  infoTxt:   { fontFamily: F.sansBold, fontSize: 13, color: C.textMuted },
});

const dt = StyleSheet.create({
  date: { textAlign: 'center', fontFamily: F.serifMediumItalic, fontSize: 15, color: C.textMuted, marginBottom: 8 },
});

const fmt = StyleSheet.create({
  toolbar: { marginHorizontal: 16, marginBottom: 10 },
});

const info = StyleSheet.create({
  card:       { marginHorizontal: 16, marginBottom: 14, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#E8E3F0', padding: 18 },
  heading:    { fontFamily: F.serifMedium, fontSize: 19, color: C.text, marginBottom: 10 },
  body:       { fontFamily: F.sans, fontSize: 15, color: C.textSecondary, lineHeight: 23, marginBottom: 14 },
  steps:      { gap: 10 },
  step:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepNum:    { width: 24, height: 24, borderRadius: 12, backgroundColor: PURPLE, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  stepNumTxt: { fontFamily: F.sansBold, fontSize: 13, color: '#fff' },
  stepTxt:    { fontFamily: F.sans, fontSize: 15, color: C.textSecondary, lineHeight: 23, flex: 1 },
});

const wr = StyleSheet.create({
  wrap:             { marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#EDE9E0', minHeight: 400, padding: 18, position: 'relative' },
  placeholder:      { alignItems: 'center', gap: 12, paddingTop: 40, paddingHorizontal: 20 },
  placeholderTitle: { fontFamily: F.serifMedium, fontSize: 18, color: C.textSecondary, textAlign: 'center', lineHeight: 26 },
  prompt:           { fontFamily: F.serifMediumItalic, fontSize: 16, color: C.textMuted, textAlign: 'center', lineHeight: 23 },
  input:            { fontFamily: F.serif, fontSize: 18, color: C.text, lineHeight: 34 },
});

const bb = StyleSheet.create({
  wrap:           { paddingHorizontal: 20, paddingTop: 10, backgroundColor: BG, borderTopWidth: 1, borderTopColor: 'rgba(197,160,89,0.1)' },
  track:          { height: 8, backgroundColor: '#EDE9E0', borderRadius: 4, overflow: 'hidden', marginBottom: 12 },
  fill:           { height: '100%', borderRadius: 4 },
  row:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count:          { fontFamily: F.sans, fontSize: 15, color: C.textMuted },
  countNum:       { fontFamily: F.sansBold, fontSize: 17, color: C.text },
  doneBtn:        { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#C5A059', paddingVertical: 12, paddingHorizontal: 22, borderRadius: 14, shadowColor: '#C5A059', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 5 },
  doneBtnSuccess: { backgroundColor: '#16A34A', shadowColor: '#16A34A' },
  doneTxt:        { fontFamily: F.sansBold, fontSize: 15, color: '#fff', letterSpacing: 0.5 },
});
