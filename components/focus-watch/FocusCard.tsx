import { ReactNode } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowUpRight } from '@/components/icons/Icons';
import { F } from '@/constants/tokens';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import HairlineWeave from './HairlineWeave';
import { PulseDot } from './FocusMeter';

// The Focus hero card speaks the exact SectionCard language of the other tabs
// (tinted gradient, uppercase kicker, big serif title, watermark icon, arrow
// orb) — but it can carry live content below the title: meters, rails, chips.

export type FocusTint = {
  bg: string;
  border: string;
  label: string;
  title: string;
  body: string;
  arrowBg: string;
};

// Tint families lifted from sectionCardData so Focus reads as a sibling tab.
export const FOCUS_TINTS = {
  gold: { bg: '#FBF3DE', border: '#F0E3B8', label: '#A9863F', title: '#6D4F13', body: '#A9863F', arrowBg: '#8A5A1A' },
  green: { bg: '#E1F1EC', border: '#C8E6DD', label: '#3D8273', title: '#1F4E45', body: '#3D8273', arrowBg: '#2A6E5F' },
  plum: { bg: '#EEEAF5', border: '#DDD5ED', label: '#6D5AAE', title: '#3B2F76', body: '#6D5AAE', arrowBg: '#2E2478' },
  rose: { bg: '#FBE6E9', border: '#F5CDD3', label: '#B54155', title: '#7F1B2D', body: '#B54155', arrowBg: '#8C2636' },
} as const satisfies Record<string, FocusTint>;

// Same trick as SectionCard: blend the tint toward white so the gradient end
// stays bright without washing out entirely.
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

// Small live-state pill that sits beside the kicker: a dot (breathing when the
// state is live) plus an uppercase whisper.
export function FocusStatusChip({
  text,
  color,
  bg = 'rgba(255,255,255,0.78)',
  border = 'rgba(255,255,255,0.9)',
  pulse = false,
}: {
  text: string;
  color: string;
  bg?: string;
  border?: string;
  pulse?: boolean;
}) {
  return (
    <View style={[chip.wrap, { backgroundColor: bg, borderColor: border }]}>
      {pulse ? (
        <PulseDot color={color} size={5} />
      ) : (
        <View style={[chip.dot, { backgroundColor: color }]} />
      )}
      <Text style={[chip.text, { color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{text}</Text>
    </View>
  );
}

export default function FocusCard({
  label,
  title,
  tint,
  watermark,
  watermarkUpright,
  chip,
  description,
  children,
  onPress,
  style,
}: {
  label: string;
  title: string;
  tint: FocusTint;
  watermark?: ReactNode;
  watermarkUpright?: boolean;
  chip?: ReactNode;
  description?: string;
  children?: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.86}
      style={[s.card, { backgroundColor: tint.bg, borderColor: tint.border }, style]}
    >
      <LinearGradient
        colors={[tint.bg, gradientEnd(tint.bg)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <HairlineWeave color={tint.label} />

      {watermark && (
        <View style={[s.watermark, watermarkUpright && s.watermarkUpright]} pointerEvents="none">
          {watermark}
        </View>
      )}

      {onPress && (
        <View style={[s.arrowWrap, { backgroundColor: tint.arrowBg }]} pointerEvents="none">
          <View style={s.arrowRotated}>
            <ArrowUpRight s={15} c="#fff" w={2.5} />
          </View>
        </View>
      )}

      <View style={s.inner}>
        <View style={s.labelRow}>
          <Text style={[s.label, { color: tint.label }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>{label}</Text>
          {chip}
        </View>
        <Text style={[s.title, { color: tint.title }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.86}>{title}</Text>
        {!!description && <Text style={[s.desc, { color: tint.body }]} numberOfLines={3}>{description}</Text>}
        {children != null && <View style={s.content}>{children}</View>}
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    position: 'relative',
    borderRadius: 26,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 4,
  },
  watermark: {
    position: 'absolute',
    bottom: -6,
    right: 6,
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.13,
    transform: [{ rotate: '-8deg' }],
  },
  watermarkUpright: {
    transform: [{ rotate: '0deg' }],
  },
  inner: {
    minWidth: 0,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
  },
  labelRow: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    paddingRight: 44,
  },
  label: {
    flexShrink: 1,
    fontSize: 10,
    fontFamily: F.sansBold,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  title: {
    flexShrink: 1,
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
    maxWidth: '88%',
  },
  content: {
    marginTop: 12,
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
    zIndex: 2,
  },
  arrowRotated: {
    transform: [{ rotate: '-15deg' }],
  },
});

const chip = StyleSheet.create({
  wrap: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  text: {
    flexShrink: 1,
    fontFamily: F.sansBold,
    fontSize: 8.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
