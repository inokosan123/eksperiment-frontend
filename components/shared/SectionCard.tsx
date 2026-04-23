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
      <LinearGradient
        colors={[bg, '#FFFFFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {decor && (
        <View style={s.watermark} pointerEvents="none">
          {decor}
        </View>
      )}

      <View style={[s.arrowWrap, { backgroundColor: arrowBg }]} pointerEvents="none">
        <View style={s.arrowRotated}>
          <ArrowUpRight s={18} c="#fff" w={2.5} />
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
    borderRadius: 32,
    borderWidth: 1,
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  watermark: {
    position: 'absolute',
    bottom: -10,
    right: 12,
    width: 118,
    height: 118,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.1,
  },
  row: {
    padding: 20,
  },
  textCol: {
    maxWidth: '84%',
    paddingRight: 14,
  },
  label: {
    fontSize: 10,
    fontFamily: F.sansBold,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    marginBottom: 7,
  },
  title: {
    fontFamily: F.serifMedium,
    fontSize: 26,
    lineHeight: 30,
    marginBottom: 8,
  },
  desc: {
    fontSize: 16,
    lineHeight: 23,
    fontFamily: F.serif,
  },
  arrowWrap: {
    position: 'absolute',
    top: 18,
    right: 18,
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
  arrowRotated: {
    transform: [{ rotate: '-15deg' }],
  },
});
