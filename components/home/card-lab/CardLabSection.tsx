import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { F } from '@/constants/tokens';
import { LAB_CARDS } from './cardLabData';
import { LAB_VARIANTS } from './CardLabVariants';

/* ─────────────────────────────────────────────────────────────
 * CARD LAB — a proving ground for the section-card design.
 *
 * This is a duplicate of Home's Organize section that goes
 * nowhere. The cards here are pressable so they feel like the
 * real thing, but every press is inert: no navigation, no state,
 * no side effects anywhere in the app.
 *
 * Nothing in `components/home/card-lab/` is imported by any
 * production screen, and nothing in it imports the real
 * `SectionCard` or `sectionCardData`. It is a closed room —
 * anything can be changed here without touching Home, Library
 * or Inner, and nothing changed elsewhere will silently change
 * these designs.
 *
 * The only line binding it to the app is its render in
 * HomeView; delete that line and the lab disappears.
 *
 * WHERE TO WORK:
 *   • the designs        → CardLabVariants.tsx
 *   • the cards' content → cardLabData.ts
 *   • this file          → only the lab's own chrome
 * ───────────────────────────────────────────────────────────── */

const COMPARE = 'compare';

export default function CardLabSection() {
  const [mode, setMode] = useState<string>(LAB_VARIANTS[0].key);
  const [compareCardId, setCompareCardId] = useState(LAB_CARDS[0].id);

  const comparing = mode === COMPARE;
  const active = LAB_VARIANTS.find(v => v.key === mode) ?? LAB_VARIANTS[0];
  const compareCard = LAB_CARDS.find(card => card.id === compareCardId) ?? LAB_CARDS[0];

  return (
    <View style={s.wrap}>
      {/* The lab wears a dashed shell and a graphite chrome on purpose: it
          must never be mistaken for product, and a neutral frame keeps the
          eye on the cards rather than on the frame around them. */}
      <View style={s.shell}>
        <View style={s.head}>
          <View style={s.headMark} />
          <Text style={s.headTitle}>CARD LAB</Text>
          <View style={s.headRule} />
        </View>
        <Text style={s.headNote}>
          A copy of Organize for testing the card design. Taps do nothing.
        </Text>

        {/* Design switcher */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.railRow}
          style={s.rail}
        >
          {LAB_VARIANTS.map(variant => (
            <LabPill
              key={variant.key}
              label={variant.label}
              active={mode === variant.key}
              onPress={() => setMode(variant.key)}
            />
          ))}
          <LabPill label="Compare" active={comparing} onPress={() => setMode(COMPARE)} />
        </ScrollView>

        {/* Which card to compare — only meaningful in compare mode */}
        {comparing && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.railRow}
            style={s.railTight}
          >
            {LAB_CARDS.map(card => (
              <LabChip
                key={card.id}
                label={card.title}
                active={compareCardId === card.id}
                onPress={() => setCompareCardId(card.id)}
              />
            ))}
          </ScrollView>
        )}

        {comparing ? (
          // One card, every design, stacked — the actual comparison.
          <View style={s.compareStack}>
            {LAB_VARIANTS.map(variant => (
              <View key={variant.key}>
                <Text style={s.compareLabel}>{variant.label.toUpperCase()}</Text>
                <InertCard>
                  <variant.Card card={compareCard} />
                </InertCard>
              </View>
            ))}
          </View>
        ) : (
          // The whole section in one design.
          <View style={[s.stack, { rowGap: active.gap }]}>
            {LAB_CARDS.map(card => (
              <InertCard key={card.id}>
                <active.Card card={card} />
              </InertCard>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

/**
 * Pressable, and deliberately going nowhere. Wrapping each card keeps the
 * press feel identical to the real section — which is part of what is being
 * judged — while guaranteeing the lab can never navigate or mutate anything.
 */
function InertCard({ children }: { children: React.ReactNode }) {
  return (
    <TouchableOpacity activeOpacity={0.86} onPress={() => {}} accessibilityRole="none">
      {children}
    </TouchableOpacity>
  );
}

function LabPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      haptic="selection"
      style={[s.pill, active && s.pillOn]}
    >
      <Text style={[s.pillText, active && s.pillTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

function LabChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      haptic="selection"
      style={[s.chip, active && s.chipOn]}
    >
      <Text style={[s.chipText, active && s.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  wrap: { paddingTop: 24, paddingHorizontal: 20, paddingBottom: 8 },

  shell: {
    borderRadius: 22,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D8D3C8',
    backgroundColor: 'rgba(255,255,255,0.4)',
    paddingHorizontal: 12,
    paddingTop: 13,
    paddingBottom: 14,
  },

  head: { flexDirection: 'row', alignItems: 'center', columnGap: 8 },
  headMark: { width: 6, height: 6, borderRadius: 1, backgroundColor: '#6B6559', transform: [{ rotate: '45deg' }] },
  headTitle: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.4, color: '#57534E' },
  headRule: { flex: 1, height: 1, backgroundColor: '#E4E0D6' },
  headNote: {
    marginTop: 6,
    fontFamily: F.serif,
    fontSize: 13.5,
    lineHeight: 18,
    color: '#8A8378',
  },

  rail: { marginTop: 12 },
  railTight: { marginTop: 8 },
  railRow: { columnGap: 7, paddingRight: 4 },

  pill: {
    minHeight: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E0D6',
  },
  pillOn: { backgroundColor: '#2F2A24', borderColor: '#2F2A24' },
  pillText: { fontFamily: F.sansSemiBold, fontSize: 12.5, color: '#78716C' },
  pillTextOn: { color: '#FFFFFF' },

  chip: {
    minHeight: 27,
    paddingHorizontal: 11,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: '#E9E5DB',
  },
  chipOn: { backgroundColor: '#EFEAE0', borderColor: '#CFC8BA' },
  chipText: { fontFamily: F.sansSemiBold, fontSize: 11.5, color: '#8A8378' },
  chipTextOn: { color: '#3F3A33' },

  stack: { marginTop: 14 },
  compareStack: { marginTop: 14, rowGap: 16 },
  compareLabel: {
    marginBottom: 6,
    fontFamily: F.sansBold,
    fontSize: 8.5,
    letterSpacing: 1.9,
    color: '#A8A29E',
  },
});
