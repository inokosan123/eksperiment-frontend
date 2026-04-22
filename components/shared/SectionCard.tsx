import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowUpRight } from '@/components/icons/Icons';
import { F } from '@/constants/tokens';
import { ReactNode } from 'react';

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
  onPress?: () => void;
};

export default function SectionCard({
  label, title, description, bg, border, labelColor, titleColor, bodyColor, arrowBg, decor, onPress,
}: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[s.card, { backgroundColor: bg, borderColor: border }]}
    >
      {/* Subtle white highlight from top */}
      <LinearGradient
        colors={['rgba(255,255,255,0.32)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Decor — faded, top-right, behind content */}
      {decor && (
        <View style={s.decor} pointerEvents="none">
          {decor}
        </View>
      )}

      {/* Text content — padded right to avoid decor overlap */}
      <View style={s.content}>
        <Text style={[s.label, { color: labelColor }]}>{label}</Text>
        <Text style={[s.title, { color: titleColor }]}>{title}</Text>
        <Text style={[s.desc,  { color: bodyColor  }]}>{description}</Text>
      </View>

      {/* Arrow — bottom-right corner, clear of decor */}
      <View style={[s.arrow, { backgroundColor: arrowBg }]}>
        <ArrowUpRight s={18} c="#fff" w={2.6} />
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    position: 'relative',
    padding: 18,
    paddingBottom: 66,      // space for bottom-right arrow (42px + 14px margin + 10px buffer)
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  decor: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.16,
  },
  content: {
    paddingRight: 88,       // keep text from going under decor icon
  },
  label: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    fontFamily: 'EBGaramond_600SemiBold',
    fontSize: 36,
    lineHeight: 40,
    marginBottom: 8,
  },
  desc: {
    fontSize: 18,
    lineHeight: 25,
    fontFamily: 'EBGaramond_400Regular',
  },
  arrow: {
    position: 'absolute',
    right: 14,
    bottom: 14,             // bottom-right — does NOT overlap decor (top-right)
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
});
