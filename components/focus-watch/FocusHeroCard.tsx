import { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowUpRight } from '@/components/icons/Icons';
import { F } from '@/constants/tokens';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import type { FocusHeroCard as HeroConfig } from './focusContent';

export type HeroMetaItem = {
  icon: ReactNode;
  text: string;
};

// Same visual grammar as the shared SectionCard, but denser: a hairline-split
// footer strip carries live state (next schedule, active packs) so the Focus
// cards read as instruments, not brochures.
function gradientEnd(hex: string): string {
  const m = hex.replace('#', '');
  const v = m.length === 3 ? m.split('').map(c => c + c).join('') : m;
  const n = parseInt(v, 16);
  if (Number.isNaN(n)) return '#FFFFFF';
  const mix = 0.78;
  const r = Math.round(((n >> 16) & 255) * (1 - mix) + 255 * mix);
  const g = Math.round(((n >> 8) & 255) * (1 - mix) + 255 * mix);
  const b = Math.round((n & 255) * (1 - mix) + 255 * mix);
  return `rgb(${r},${g},${b})`;
}

export default function FocusHeroCardView({
  card,
  meta,
  onPress,
}: {
  card: HeroConfig;
  meta: HeroMetaItem[];
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.86}
      style={[s.card, { backgroundColor: card.bg, borderColor: card.border }]}
    >
      <LinearGradient
        colors={[card.bg, gradientEnd(card.bg)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={s.watermark} pointerEvents="none">
        {card.decor}
      </View>

      <View style={[s.arrowWrap, { backgroundColor: card.arrowBg }]} pointerEvents="none">
        <View style={s.arrowRotated}>
          <ArrowUpRight s={15} c="#fff" w={2.5} />
        </View>
      </View>

      <View style={s.body}>
        <Text style={[s.label, { color: card.labelColor }]}>{card.label}</Text>
        <Text style={[s.title, { color: card.titleColor }]}>{card.title}</Text>
        <Text style={[s.desc, { color: card.bodyColor }]}>{card.description}</Text>
      </View>

      {meta.length > 0 && (
        <View style={[s.metaStrip, { borderTopColor: card.border }]}>
          {meta.map((item, i) => (
            <View key={i} style={s.metaItem}>
              {item.icon}
              <Text style={[s.metaText, { color: card.labelColor }]} numberOfLines={1}>
                {item.text}
              </Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    position: 'relative',
    borderRadius: 26,
    borderWidth: 1,
    marginBottom: 6,
    overflow: 'hidden',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 4,
  },
  watermark: {
    position: 'absolute',
    bottom: 20,
    right: 6,
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.13,
    transform: [{ rotate: '-8deg' }],
  },
  arrowWrap: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 4,
  },
  arrowRotated: {
    transform: [{ rotate: '-15deg' }],
  },
  body: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
  },
  label: {
    fontSize: 10,
    fontFamily: F.sansBold,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    fontFamily: F.serifMedium,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.3,
    marginBottom: 4,
    maxWidth: '84%',
  },
  desc: {
    fontSize: 16,
    lineHeight: 23,
    fontFamily: F.serif,
    maxWidth: '84%',
  },
  metaStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    paddingVertical: 10.5,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  metaText: {
    fontFamily: F.sansSemiBold,
    fontSize: 11,
    letterSpacing: 0.2,
  },
});
