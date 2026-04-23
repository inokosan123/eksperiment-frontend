import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import { Sun, Utensils, Moon, Sparkles, Play } from '@/components/icons/Icons';
import SetAsDailyTaskCard from '@/components/shared/SetAsDailyTaskCard';
import { C, F } from '@/constants/tokens';

type Category = 'morning' | 'meal' | 'evening' | 'other';
type Rule = 'standard' | 'short' | 'seraphim';

const CATEGORIES: { id: Category; label: string; Icon: React.ComponentType<any> }[] = [
  { id: 'morning', label: 'MORNING', Icon: Sun },
  { id: 'meal',    label: 'MEAL',    Icon: Utensils },
  { id: 'evening', label: 'EVENING', Icon: Moon },
  { id: 'other',   label: 'OTHER',   Icon: Sparkles },
];

const RULES: { id: Rule; label: string }[] = [
  { id: 'standard', label: 'STANDARD' },
  { id: 'short',    label: 'SHORT' },
  { id: 'seraphim', label: 'SERAPHIM' },
];

const RULE_LABELS = { standard: 'Standard Rule', short: 'Short Rule', seraphim: 'Seraphim Rule' };
const CATEGORY_LABELS = { morning: 'MORNING', meal: 'MEAL', evening: 'EVENING', other: 'OTHER' };

export default function PrayerBookView() {
  const [category, setCategory] = useState<Category>('morning');
  const [rule, setRule] = useState<Rule>('standard');
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenTitleBar title="PRAYER BOOK" showBack />

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Set as Daily Task banner */}
        <View style={s.bannerWrap}>
          <SetAsDailyTaskCard onPress={() => {}} variant="soft" />
        </View>

        {/* Category tabs */}
        <View style={s.catGrid}>
          {CATEGORIES.map(cat => {
            const active = category === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => setCategory(cat.id)}
                activeOpacity={0.75}
                style={[s.catBtn, active ? s.catActive : s.catInactive]}
              >
                <cat.Icon s={22} c={active ? C.goldDark : C.textMuted} w={active ? 2.2 : 1.8} />
                <Text style={[s.catLabel, { color: active ? C.goldDark : C.textMuted }]}>{cat.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Rule pills */}
        <View style={s.ruleRow}>
          {RULES.map(r => {
            const active = rule === r.id;
            return (
              <TouchableOpacity
                key={r.id}
                onPress={() => setRule(r.id)}
                activeOpacity={0.8}
                style={[s.rulePill, { backgroundColor: active ? C.gold : '#fff', borderColor: active ? C.gold : '#e7e5e4' }]}
              >
                <Text style={[s.ruleTxt, { color: active ? '#fff' : C.text }]}>{r.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Prayer card */}
        <View style={s.cardWrap}>
          <View style={[s.prayerCard, { backgroundColor: C.goldBg }]}>
            <Text style={s.prayerCat}>{CATEGORY_LABELS[category]}</Text>
            <Text style={s.prayerTitle}>{RULE_LABELS[rule]}</Text>
            <View style={s.divider} />
            <Text style={s.prayerInstr}>
              Upon awakening from sleep, arise immediately, gather thy mind, and say this with piety and the fear of God, making the sign of the Cross:
            </Text>
            <Text style={s.prayerText}>
              In the name of the Father, and of the Son, and of the Holy Spirit. Amen.
            </Text>
            <Text style={s.prayerInstr}>
              Then stand for a little while in silence until…
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Floating Start Prayer button */}
      <View style={[s.startWrap, { bottom: insets.bottom + 20 }]} pointerEvents="box-none">
        <TouchableOpacity style={s.startBtn} activeOpacity={0.85}>
          <View style={s.playCircle}>
            <Play s={12} c="#fff" />
          </View>
          <Text style={s.startTxt}>START PRAYER</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bannerWrap: { padding: 16, paddingBottom: 0 },

  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 18, paddingBottom: 0 },
  catBtn: { flex: 1, minWidth: '22%', borderRadius: 14, paddingVertical: 11, paddingHorizontal: 4, alignItems: 'center', gap: 6 },
  catActive: { backgroundColor: C.goldBg, borderWidth: 1, borderColor: '#F0E2B8' },
  catInactive: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'transparent' },
  catLabel: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.8 },

  ruleRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 18, paddingTop: 16 },
  rulePill: { flex: 1, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 9999, borderWidth: 1, alignItems: 'center' },
  ruleTxt: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 2.2 },

  cardWrap: { padding: 18, paddingBottom: 16 },
  prayerCard: { padding: 22, paddingBottom: 28, borderRadius: 22, borderWidth: 1, borderColor: '#F0E2B8', alignItems: 'center' },
  prayerCat: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 2.2, color: C.goldDark },
  prayerTitle: { fontFamily: F.serifMedium, fontSize: 30, color: C.text, marginTop: 8 },
  divider: { marginTop: 16, width: 44, height: 1, backgroundColor: '#D4C493' },
  prayerInstr: { fontFamily: F.serifMediumItalic, fontSize: 17, lineHeight: 26, color: C.goldDark, marginTop: 20, textAlign: 'center' },
  prayerText: { fontFamily: F.serifMedium, fontSize: 19, lineHeight: 28, color: C.text, marginTop: 22, textAlign: 'center' },

  startWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', pointerEvents: 'box-none' },
  startBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16, paddingHorizontal: 32, backgroundColor: C.gold, borderRadius: 9999, shadowColor: C.gold, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 12, elevation: 8 },
  playCircle: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  startTxt: { fontFamily: F.sansBold, fontSize: 13, letterSpacing: 2.2, color: '#fff' },
});
