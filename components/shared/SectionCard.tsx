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
      style={[styles.card, { backgroundColor: bg, borderColor: border }]}
    >
      {/* Subtle white gradient for depth */}
      <LinearGradient
        colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Decor icon — faded top-right */}
      {decor && (
        <View style={styles.decorWrap} pointerEvents="none">
          {decor}
        </View>
      )}

      {/* Text content */}
      <View style={styles.content}>
        <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
        <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
        <Text style={[styles.desc, { color: bodyColor }]}>{description}</Text>
      </View>

      {/* Arrow button — absolute bottom-right */}
      <View style={[styles.arrow, { backgroundColor: arrowBg }]}>
        <ArrowUpRight s={17} c="#fff" w={2.6} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    padding: 20,
    paddingBottom: 60,
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 14,
    overflow: 'hidden',
    minHeight: 155,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  decorWrap: {
    position: 'absolute',
    right: 14,
    top: 14,
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.16,
  },
  content: {
    paddingRight: 90,
  },
  label: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: 'EBGaramond_500Medium',
    fontSize: 30,
    lineHeight: 34,
    marginTop: 6,
  },
  desc: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    fontFamily: 'Inter_400Regular',
  },
  arrow: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
});
