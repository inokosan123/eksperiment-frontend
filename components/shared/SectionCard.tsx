import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowUpRight } from '@/components/icons/Icons';
import { F } from '@/constants/tokens';
import { ReactNode } from 'react';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';


type Props = {
  label: string;
  title: string;
  description: string;
  bg: string;
  border: string;
  labelColor: string;
  titleColor: string;
  bodyColor: string;
  arrowBg: string;
  decor?: ReactNode;
  // When true, the watermark icon is rendered without the playful tilt — used
  // for symbols that would read as broken if rotated (e.g. the Cross).
  decorUpright?: boolean;
  onPress?: () => void;
};

// Mix the per-card bg color with white so the gradient end stays bright
// without going to pure white — keeps the whole card visibly tinted.
function gradientEnd(hex: string): string {
  const m = hex.replace('#', '');
  const v = m.length === 3 ? m.split('').map(c => c + c).join('') : m;
  const n = parseInt(v, 16);
  if (Number.isNaN(n)) return '#FFFFFF';
  const mix = 0.78; // 78% white, 22% bg tint
  const r = Math.round(((n >> 16) & 255) * (1 - mix) + 255 * mix);
  const g = Math.round(((n >> 8) & 255) * (1 - mix) + 255 * mix);
  const b = Math.round((n & 255) * (1 - mix) + 255 * mix);
  return `rgb(${r},${g},${b})`;
}

export default function SectionCard({
  label, title, description, bg, border, labelColor, titleColor, bodyColor, arrowBg, decor, decorUpright, onPress,
}: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.86}
      style={[s.card, { backgroundColor: bg, borderColor: border }]}
    >
      <LinearGradient
        colors={[bg, gradientEnd(bg)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {decor && (
        <View
          style={[s.watermark, decorUpright && s.watermarkUpright]}
          pointerEvents="none"
        >
          {decor}
        </View>
      )}

      <View style={[s.arrowWrap, { backgroundColor: arrowBg }]} pointerEvents="none">
        <View style={s.arrowRotated}>
          <ArrowUpRight s={15} c="#fff" w={2.5} />
        </View>
      </View>

      <View style={s.row}>
        <View style={s.textCol}>
          <Text style={[s.label, { color: labelColor }]}>{label}</Text>
          <Text style={[s.title, { color: titleColor }]}>{title}</Text>
          <Text style={[s.desc,  { color: bodyColor  }]}>{description}</Text>
        </View>
      </View>
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
  row: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
  },
  textCol: {
    maxWidth: '84%',
    paddingRight: 12,
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
  },
  desc: {
    fontSize: 16,
    lineHeight: 23,
    fontFamily: F.serif,
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
});
