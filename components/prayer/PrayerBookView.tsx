import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import { Sun, Utensils, Moon, Sparkles, Heart, Play } from '@/components/icons/Icons';
import SetAsDailyTaskCard from '@/components/shared/SetAsDailyTaskCard';
import SetAsTaskSheet from '@/components/shared/SetAsTaskSheet';
import { useTasks } from '@/components/tasks/TaskProvider';
import { C, F } from '@/constants/tokens';

type Category = 'morning' | 'meal' | 'evening' | 'jesus' | 'other';
type Rule = 'standard' | 'short' | 'seraphim' | 'personal' | 'breakfast' | 'lunch' | 'dinner' | 'before_study' | 'after_study' | 'anytime';

type CatTheme = { accent: string; bg: string; border: string };

const CAT_THEMES: Record<Category, CatTheme> = {
  morning: { accent: '#D97706', bg: '#FEF3C7', border: '#FDE68A' },
  meal:    { accent: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE' },
  evening: { accent: '#7C6EAF', bg: '#EDE9FE', border: '#C4B5FD' },
  jesus:   { accent: '#C5A059', bg: '#FFFBEB', border: '#E8DCC4' },
  other:   { accent: '#10B981', bg: '#ECFDF5', border: '#6EE7B7' },
};

const CATEGORIES: { id: Category; label: string; Icon: React.ComponentType<any> }[] = [
  { id: 'morning', label: 'MORN',    Icon: Sun },
  { id: 'meal',    label: 'MEALS',   Icon: Utensils },
  { id: 'evening', label: 'EVE',     Icon: Moon },
  { id: 'jesus',   label: 'JESUS',   Icon: Sparkles },
  { id: 'other',   label: 'OTHER',   Icon: Heart },
];

const CATEGORY_RULES: Record<Category, { id: Rule; label: string }[]> = {
  morning: [
    { id: 'standard', label: 'Standard' },
    { id: 'short',    label: 'Short' },
    { id: 'seraphim', label: 'Seraphim' },
    { id: 'personal', label: 'Personal' },
  ],
  evening: [
    { id: 'standard', label: 'Standard' },
    { id: 'short',    label: 'Short' },
    { id: 'seraphim', label: 'Seraphim' },
    { id: 'personal', label: 'Personal' },
  ],
  meal: [
    { id: 'breakfast', label: 'Breakfast' },
    { id: 'lunch',     label: 'Lunch' },
    { id: 'dinner',    label: 'Dinner' },
  ],
  jesus: [
    { id: 'standard', label: 'Standard' },
    { id: 'short',    label: 'Short' },
    { id: 'personal', label: 'Personal' },
  ],
  other: [
    { id: 'before_study', label: 'Pre učenja' },
    { id: 'after_study',  label: 'Posle učenja' },
    { id: 'anytime',      label: 'U svako doba' },
  ],
};

const PRAYER_TITLE: Record<Rule, string> = {
  standard:     'Standard Rule',
  short:        'Short Rule',
  seraphim:     'Seraphim Rule',
  personal:     'Personal Rule',
  breakfast:    'Before Breakfast',
  lunch:        'Before Lunch',
  dinner:       'Before Dinner',
  before_study: 'Pre učenja',
  after_study:  'Posle učenja',
  anytime:      'U svako doba',
};

const PRAYER_CONTENT: Partial<Record<Category, Partial<Record<Rule, { instr: string; text: string }>>>> = {
  morning: {
    standard: {
      instr: 'Upon awakening from sleep, arise immediately, gather thy mind, and say this with piety and the fear of God, making the sign of the Cross:',
      text: 'In the name of the Father, and of the Son, and of the Holy Spirit. Amen.',
    },
    short: {
      instr: 'Upon arising, stand before the holy icons and say briefly with contrition:',
      text: 'O Lord, open my lips, and my mouth shall declare Thy praise.',
    },
    seraphim: {
      instr: 'The Seraphim Rule, as given by St. Seraphim of Sarov. Arise and say three times with reverence:',
      text: 'Our Father, Who art in heaven, hallowed be Thy Name. Thy Kingdom come. Thy will be done, on earth as it is in heaven.\n\nHail Mary, full of grace, the Lord is with thee.\n\nGlory to the Father, and to the Son, and to the Holy Spirit.',
    },
    personal: {
      instr: 'Read your personal morning prayer rule from your prayer book. Take time to pray with attention and reverence.',
      text: '',
    },
  },
  meal: {
    breakfast: {
      instr: 'Before the meal, standing and making the sign of the Cross, say:',
      text: 'Our Father, Who art in heaven, hallowed be Thy Name. Thy Kingdom come. Thy will be done, on earth as it is in heaven. Give us this day our daily bread.',
    },
    lunch: {
      instr: 'Before the midday meal, with gratitude, say:',
      text: 'The eyes of all look to Thee with hope, O Lord, and Thou givest them food in due season.',
    },
    dinner: {
      instr: 'Before the evening meal, with thanksgiving, say:',
      text: 'Glory to Thee, O Lord; glory to Thee, O Holy One; glory to Thee, O King, for Thou hast given us food and drink for our rejoicing.',
    },
  },
  evening: {
    standard: {
      instr: 'In the evening, before sleep, stand before the holy icons and begin with piety:',
      text: 'In the name of the Father, and of the Son, and of the Holy Spirit. Amen. O Lord, forgive me, a sinner.',
    },
    short: {
      instr: 'Before sleep, make the sign of the Cross and say briefly:',
      text: 'Into Thy hands, O Lord Jesus Christ my God, I commit my spirit. Do Thou bless me, have mercy on me and grant me eternal life. Amen.',
    },
    seraphim: {
      instr: 'The Seraphim Rule for the evening. Say three times with reverence and contrition:',
      text: 'Our Father, Who art in heaven, hallowed be Thy Name. Thy Kingdom come. Thy will be done, on earth as it is in heaven.\n\nHail Mary, full of grace, the Lord is with thee.\n\nGlory to the Father, and to the Son, and to the Holy Spirit.',
    },
    personal: {
      instr: 'Read your personal evening prayer rule from your prayer book with attention and contrition of heart.',
      text: '',
    },
  },
  jesus: {
    standard: {
      instr: 'The Jesus Prayer. Breathe slowly and repeat with full attention of heart:',
      text: 'Lord Jesus Christ, Son of God, have mercy on me, a sinner.',
    },
    short: {
      instr: 'A shorter form of the Jesus Prayer, to be repeated quietly and continuously:',
      text: 'Lord Jesus Christ, have mercy on me.',
    },
    personal: {
      instr: 'Use your prayer rope (chotki). With each knot, say the Jesus Prayer once, in silence and recollection.',
      text: 'Lord Jesus Christ, Son of God, have mercy on me, a sinner.',
    },
  },
  other: {
    before_study: {
      instr: 'Molitva pre početka učenja ili čitanja duhovnih knjiga:',
      text: 'Gospode, prosvetli um moj i srce moje, da razumem i zapamtim ovo što budem čitao, na slavu Tvoju i spasenje moje. Amin.',
    },
    after_study: {
      instr: 'Molitva posle učenja ili čitanja duhovnih knjiga:',
      text: 'Hvala Ti, Gospode, što si me prosvetlio i podario mi razumevanje. Neka sve što sam naučio posluži na slavu Tvoju i korist bližnjih mojih. Amin.',
    },
    anytime: {
      instr: 'Ove molitve mogu se čitati u svako doba dana, kad god srce žudi za Bogom:',
      text: 'Gospode Isuse Hriste, Sine Božiji, pomiluj me grešnog.\n\nPresvetaa Bogorodice, spasi nas.',
    },
  },
};

export default function PrayerBookView() {
  const { createOrUpdateTask } = useTasks();
  const [category, setCategory] = useState<Category>('morning');
  const [rule, setRule] = useState<Rule>('standard');
  const [showTaskSheet, setShowTaskSheet] = useState(false);
  const [taskSummary, setTaskSummary] = useState('Add to your daily routine');
  const insets = useSafeAreaInsets();

  const theme = CAT_THEMES[category];
  const rules = CATEGORY_RULES[category];
  const content = PRAYER_CONTENT[category]?.[rule] ?? { instr: '', text: '' };

  const handleCategoryChange = (cat: Category) => {
    setCategory(cat);
    setRule(CATEGORY_RULES[cat][0].id);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenTitleBar title="PRAYER BOOK" showBack />

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.bannerWrap}>
          <SetAsDailyTaskCard onPress={() => setShowTaskSheet(true)} variant="soft" subtitle={taskSummary} />
        </View>

        {/* Category tabs — 4 columns, per-category color */}
        <View style={s.catGrid}>
          {CATEGORIES.map(cat => {
            const active = category === cat.id;
            const t = CAT_THEMES[cat.id];
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => handleCategoryChange(cat.id)}
                activeOpacity={0.78}
                style={[
                  s.catBtn,
                  active
                    ? { backgroundColor: t.bg, borderColor: t.border, shadowColor: t.accent, shadowOpacity: 0.14, shadowOffset: { width: 0, height: 3 }, shadowRadius: 8, elevation: 2 }
                    : s.catInactive,
                ]}
              >
                <cat.Icon s={21} c={active ? t.accent : '#C4BAA8'} w={active ? 2.0 : 1.6} />
                <Text style={[s.catLabel, { color: active ? t.accent : '#B5ADA0' }]}>{cat.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Rule pills — horizontal scrollable, dynamic per category */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.ruleScroll}
        >
          {rules.map(r => {
            const active = rule === r.id;
            return (
              <TouchableOpacity
                key={r.id}
                onPress={() => setRule(r.id)}
                activeOpacity={0.8}
                style={[
                  s.rulePill,
                  active
                    ? { backgroundColor: theme.bg, borderColor: theme.accent, borderWidth: 1.5 }
                    : s.rulePillInactive,
                ]}
              >
                {active && <View style={[s.ruleDot, { backgroundColor: theme.accent }]} />}
                <Text style={[s.ruleTxt, { color: active ? theme.accent : '#78716C' }]}>{r.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Prayer card */}
        <View style={s.cardWrap}>
          <View style={[s.prayerCard, { backgroundColor: theme.bg, borderColor: theme.border }]}>
            <Text style={[s.prayerCat, { color: theme.accent }]}>
              {category === 'jesus' ? 'JESUS PRAYER' : CATEGORIES.find(c => c.id === category)?.label}
            </Text>
            <Text style={s.prayerTitle}>{PRAYER_TITLE[rule]}</Text>
            <View style={[s.divider, { backgroundColor: theme.accent, opacity: 0.4 }]} />
            {!!content.instr && (
              <Text style={[s.prayerInstr, { color: theme.accent }]}>{content.instr}</Text>
            )}
            {!!content.text && (
              <Text style={s.prayerText}>{content.text}</Text>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Floating Start Prayer button */}
      <View style={[s.startWrap, { bottom: insets.bottom + 20 }]} pointerEvents="box-none">
        <TouchableOpacity
          style={[s.startBtn, { backgroundColor: theme.accent, shadowColor: theme.accent }]}
          activeOpacity={0.85}
        >
          <View style={s.playCircle}>
            <Play s={12} c="#fff" />
          </View>
          <Text style={s.startTxt}>START PRAYER</Text>
        </TouchableOpacity>
      </View>

      <SetAsTaskSheet
        visible={showTaskSheet}
        context="prayer"
        onClose={() => setShowTaskSheet(false)}
        onSummaryChange={setTaskSummary}
        onTaskDraft={createOrUpdateTask}
      />
    </View>
  );
}

const s = StyleSheet.create({
  bannerWrap: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10 },

  catGrid: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingTop: 6, paddingBottom: 0 },
  catBtn: { flex: 1, borderRadius: 18, paddingVertical: 13, paddingHorizontal: 4, alignItems: 'center', gap: 7, borderWidth: 1 },
  catInactive: { backgroundColor: '#F8F6F2', borderColor: '#EDE8DF' },
  catLabel: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.6 },

  ruleScroll: { gap: 8, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 6 },
  rulePill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1 },
  rulePillInactive: { backgroundColor: '#FFFFFF', borderColor: '#E8E3DA' },
  ruleDot: { width: 6, height: 6, borderRadius: 3 },
  ruleTxt: { fontFamily: F.serifMedium, fontSize: 14, letterSpacing: 0.2 },

  cardWrap: { padding: 14, paddingBottom: 16 },
  prayerCard: { padding: 22, paddingBottom: 28, borderRadius: 26, borderWidth: 1, alignItems: 'center' },
  prayerCat: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.4, textTransform: 'uppercase' },
  prayerTitle: { fontFamily: F.serifMedium, fontSize: 30, color: C.text, marginTop: 8 },
  divider: { marginTop: 16, width: 44, height: 1 },
  prayerInstr: { fontFamily: F.serifMediumItalic, fontSize: 17, lineHeight: 26, marginTop: 20, textAlign: 'center' },
  prayerText: { fontFamily: F.serifMedium, fontSize: 19, lineHeight: 28, color: C.text, marginTop: 22, textAlign: 'center' },

  startWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', pointerEvents: 'box-none' },
  startBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16, paddingHorizontal: 32, borderRadius: 9999, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 12, elevation: 8 },
  playCircle: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  startTxt: { fontFamily: F.sansBold, fontSize: 13, letterSpacing: 2.2, color: '#fff' },
});
