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
      activeOpacity={0.82}
      style={[s.card, { backgroundColor: bg, borderColor: border }]}
    >
      {/* Dijagonalni sheen — svetlo gore-levo, tamnije dole-desno */}
      <LinearGradient
        colors={['rgba(255,255,255,0.45)', 'rgba(255,255,255,0.06)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Decor — suptilna ikona gore desno */}
      {decor && (
        <View style={s.decor} pointerEvents="none">
          {decor}
        </View>
      )}

      {/* Tekst — padded desno da ne ulazi pod decor */}
      <View style={s.content}>
        <Text style={[s.label, { color: labelColor }]}>{label}</Text>
        <Text style={[s.title, { color: titleColor }]}>{title}</Text>
        <Text style={[s.desc,  { color: bodyColor  }]}>{description}</Text>
      </View>

      {/* Strelica — donji desni ugao, ispod decora */}
      <View style={[s.arrow, { backgroundColor: arrowBg }]}>
        <ArrowUpRight s={18} c="#fff" w={2.6} />
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    position: 'relative',
    padding: 20,
    paddingBottom: 58,      // 42px arrow + 14px margin + 2px buffer
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 14,
    overflow: 'hidden',
    // Elegantna senka sa bojom
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  decor: {
    position: 'absolute',
    right: 14,
    top: 14,
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.18,
  },
  content: {
    paddingRight: 86,
  },
  label: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    marginBottom: 7,
  },
  title: {
    fontFamily: 'EBGaramond_600SemiBold',
    fontSize: 36,
    lineHeight: 40,
    marginBottom: 10,
  },
  desc: {
    fontSize: 18,
    lineHeight: 26,
    fontFamily: 'EBGaramond_400Regular',
  },
  arrow: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 5,
  },
});
