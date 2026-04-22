import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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
      {/* Large faded decor icon — right side, vertically centered */}
      {decor && (
        <View style={styles.decorWrap} pointerEvents="none">
          {decor}
        </View>
      )}

      {/* Text content — leaves space for decor */}
      <View style={styles.content}>
        <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
        <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
        <Text style={[styles.desc, { color: bodyColor }]}>{description}</Text>
      </View>

      {/* Arrow at absolute bottom-right */}
      <View style={[styles.arrow, { backgroundColor: arrowBg }]}>
        <ArrowUpRight s={16} c="#fff" w={2.6} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    padding: 18,
    paddingBottom: 52,        // room for bottom-right arrow
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
    minHeight: 140,
    // Subtle lift shadow — the "glow" effect
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  decorWrap: {
    position: 'absolute',
    right: 10,
    top: 0,
    bottom: 0,
    width: 100,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.18,
  },
  content: {
    paddingRight: 100,        // keep text from overlapping decor
  },
  label: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: 'EBGaramond_500Medium',
    fontSize: 26,
    lineHeight: 30,
    marginTop: 6,
  },
  desc: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
    fontFamily: 'Inter_400Regular',
  },
  arrow: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
});
