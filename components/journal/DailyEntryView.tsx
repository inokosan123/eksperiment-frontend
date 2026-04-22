import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Pressable,
  TextInput, StyleSheet, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, SlidersHorizontal, CheckSmall } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';

const BG   = '#FAF7F0';
const GOLD = '#C5A059';

// ─── Mood picker ──────────────────────────────────────────────────────────────
const MOODS = [
  { emoji: '😔', label: 'Sad'     },
  { emoji: '😕', label: 'Low'     },
  { emoji: '😐', label: 'Neutral' },
  { emoji: '🙂', label: 'Good'    },
  { emoji: '😊', label: 'Great'   },
];

const ENERGIES = [
  { emoji: '🪫', label: 'Drained' },
  { emoji: '😴', label: 'Low'     },
  { emoji: '⚡', label: 'Normal'  },
  { emoji: '🔥', label: 'High'    },
  { emoji: '💪', label: 'Peak'    },
];

function EmojiPicker({
  title, items, selected, onSelect,
}: {
  title: string;
  items: { emoji: string; label: string }[];
  selected: number;
  onSelect: (i: number) => void;
}) {
  return (
    <View style={ep.wrap}>
      <Text style={ep.title}>{title}</Text>
      <View style={ep.row}>
        {items.map((item, i) => (
          <Pressable
            key={i}
            style={({ pressed }) => [
              ep.item,
              selected === i && ep.itemActive,
              pressed && { opacity: 0.7 },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelect(i);
            }}
          >
            <Text style={[ep.emoji, selected === i && ep.emojiSelected]}>{item.emoji}</Text>
            <Text style={[ep.label, selected === i && ep.labelActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const ep = StyleSheet.create({
  wrap:          { paddingHorizontal: 20, paddingTop: 18 },
  title:         { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 2, color: C.textMuted, marginBottom: 10, textTransform: 'uppercase' },
  row:           { flexDirection: 'row', justifyContent: 'space-between' },
  item:          { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: 'transparent' },
  itemActive:    { backgroundColor: '#FBF7EE', borderColor: '#F0E2B8' },
  emoji:         { fontSize: 22, transform: [{ scale: 1 }] },
  emojiSelected: { transform: [{ scale: 1.12 }] },
  label:         { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.5, color: C.textMuted, marginTop: 5, textTransform: 'uppercase' },
  labelActive:   { color: GOLD },
});

// ─── Satisfaction slider ──────────────────────────────────────────────────────
function SatisfactionSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const color =
    value <= 2 ? C.red :
    value <= 4 ? '#D97706' :
    value <= 7 ? GOLD : '#16A34A';

  const SAT_LABELS = ['','','Very Low','Low','Okay','Okay','Satisfied','Satisfied','Very Satisfied','Very Satisfied','Excellent'];

  return (
    <View style={sl.wrap}>
      <View style={sl.headerRow}>
        <Text style={sl.title}>How satisfied are you?</Text>
        <Text style={[sl.value, { color }]}>{value}</Text>
      </View>
      <View style={sl.track}>
        <View style={[sl.fill, { width: `${(value / 10) * 100}%` as any, backgroundColor: color }]} />
      </View>
      <View style={sl.btns}>
        {[1,2,3,4,5,6,7,8,9,10].map(v => (
          <Pressable
            key={v}
            style={[sl.pip, value === v && { backgroundColor: color }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onChange(v); }}
          />
        ))}
      </View>
      <Text style={[sl.sublabel, { color }]}>{SAT_LABELS[value]}</Text>
    </View>
  );
}

const sl = StyleSheet.create({
  wrap:      { marginHorizontal: 20, marginTop: 18, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#EDE9E0', padding: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title:     { fontFamily: F.serifMedium, fontSize: 15, color: C.text },
  value:     { fontFamily: F.serifSemiBold, fontSize: 26, lineHeight: 30 },
  track:     { height: 6, backgroundColor: '#F0EDE6', borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  fill:      { height: '100%', borderRadius: 3 },
  btns:      { flexDirection: 'row', justifyContent: 'space-between' },
  pip:       { width: 22, height: 22, borderRadius: 11, backgroundColor: '#EDE9E0' },
  sublabel:  { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.5, textAlign: 'center', marginTop: 8 },
});

// ─── Guided prompt ────────────────────────────────────────────────────────────
const PROMPTS = [
  { q: 'What am I grateful for today?', a: '' },
  { q: 'What challenged me today?',     a: '' },
  { q: 'What do I want to remember?',   a: '' },
];

function GuidedPrompts({
  prompts, onChange,
}: {
  prompts: { q: string; a: string }[];
  onChange: (i: number, val: string) => void;
}) {
  return (
    <View style={gp.wrap}>
      <Text style={gp.sectionLabel}>DAILY REFLECTIONS</Text>
      {prompts.map((p, i) => (
        <View key={i} style={gp.block}>
          <Text style={gp.question}>{p.q}</Text>
          <TextInput
            style={gp.input}
            placeholder="Write your answer..."
            placeholderTextColor={C.textMuted}
            multiline
            value={p.a}
            onChangeText={v => onChange(i, v)}
          />
        </View>
      ))}
    </View>
  );
}

const gp = StyleSheet.create({
  wrap:         { paddingHorizontal: 20, marginTop: 18 },
  sectionLabel: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 2, color: C.textMuted, marginBottom: 12, textTransform: 'uppercase' },
  block:        { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#EDE9E0', padding: 14, marginBottom: 10 },
  question:     { fontFamily: F.serifMedium, fontSize: 15, color: C.textSecondary, marginBottom: 8 },
  input:        { fontFamily: F.serif, fontSize: 15, color: C.text, minHeight: 60, lineHeight: 24 },
});

// ─── Gratitude section ────────────────────────────────────────────────────────
function GratitudeSection() {
  const ITEMS = ['My faith and prayer', 'Health and family', 'This peaceful morning'];
  return (
    <View style={gr.wrap}>
      <Text style={gr.label}>GRATITUDE</Text>
      {ITEMS.map((item, i) => (
        <View key={i} style={gr.item}>
          <Text style={gr.heart}>♥</Text>
          <Text style={gr.txt}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const gr = StyleSheet.create({
  wrap:  { paddingHorizontal: 20, marginTop: 18 },
  label: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 2, color: C.textMuted, marginBottom: 10, textTransform: 'uppercase' },
  item:  { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#F0E2B8', borderRadius: 14, padding: 12, marginBottom: 8 },
  heart: { fontSize: 16, color: GOLD },
  txt:   { fontFamily: F.serifMedium, fontSize: 15, color: C.text, flex: 1 },
});

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function DailyEntryView() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [mood, setMood]       = useState(3);
  const [energy, setEnergy]   = useState(2);
  const [sat, setSat]         = useState(7);
  const [prompts, setPrompts] = useState(PROMPTS.map(p => ({ ...p })));

  const updatePrompt = (i: number, val: string) => {
    setPrompts(prev => prev.map((p, idx) => idx === i ? { ...p, a: val } : p));
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {/* Header */}
      <View style={[hd.wrap, { paddingTop: Math.max(insets.top, 24) + 10 }]}>
        <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }} style={hd.btn} activeOpacity={0.7}>
          <ArrowLeft s={22} c={C.textMuted} />
        </TouchableOpacity>
        <Text style={hd.title}>Daily Journal</Text>
        <TouchableOpacity onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)} style={hd.btn} activeOpacity={0.7}>
          <SlidersHorizontal s={18} c={C.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Date */}
      <View style={{ alignItems: 'center', paddingVertical: 8 }}>
        <Text style={{ fontFamily: F.serifMediumItalic, fontSize: 14, color: C.textMuted }}>Wednesday, April 22</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        <EmojiPicker title="How are you feeling?" items={MOODS}    selected={mood}   onSelect={setMood}   />
        <EmojiPicker title="Energy level"          items={ENERGIES} selected={energy} onSelect={setEnergy} />
        <SatisfactionSlider value={sat} onChange={setSat} />
        <GuidedPrompts prompts={prompts} onChange={updatePrompt} />
        <GratitudeSection />
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Finish button */}
      <View style={[fin.wrap, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={fin.btn}
          activeOpacity={0.85}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.back();
          }}
        >
          <CheckSmall s={18} c="#fff" w={2.8} />
          <Text style={fin.txt}>Finish</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const hd = StyleSheet.create({
  wrap:  { backgroundColor: BG, paddingBottom: 4, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  btn:   { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: F.serifMedium, fontSize: 18, color: C.text },
});

const fin = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingTop: 10, backgroundColor: BG, borderTopWidth: 1, borderTopColor: 'rgba(197,160,89,0.1)' },
  btn:  { backgroundColor: GOLD, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, shadowColor: GOLD, shadowOffset:{width:0,height:4}, shadowOpacity:0.35, shadowRadius:10, elevation:6 },
  txt:  { fontFamily: F.sansBold, fontSize: 15, color: '#fff', letterSpacing: 1 },
});
