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
      {decor && (
        <View style={styles.decorWrap} pointerEvents="none">
          {decor}
        </View>
      )}
      <View style={styles.content}>
        <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
        <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
        <Text style={[styles.desc, { color: bodyColor }]}>{description}</Text>
      </View>
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
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
    minHeight: 110,
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
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
});
