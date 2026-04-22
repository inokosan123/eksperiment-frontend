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
      style={[s.card, { backgroundColor: bg, borderColor: border }]}
    >
      {/* Large faded decor icon — positioned absolute top-right, behind content */}
      {decor && (
        <View style={s.decorWrap} pointerEvents="none">
          {decor}
        </View>
      )}

      {/* Flex row: text left, arrow right — no dead space */}
      <View style={s.row}>
        <View style={s.textCol}>
          <Text style={[s.label, { color: labelColor }]}>{label}</Text>
          <Text style={[s.title, { color: titleColor }]}>{title}</Text>
          <Text style={[s.desc,  { color: bodyColor  }]}>{description}</Text>
        </View>

        {/* Arrow button — vertically centered next to text */}
        <View style={[s.arrow, { backgroundColor: arrowBg }]}>
          <ArrowUpRight s={18} c="#fff" w={2.6} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 14,
    overflow: 'hidden',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  decorWrap: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.15,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  textCol: {
    flex: 1,
  },
  label: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    fontFamily: 'EBGaramond_600SemiBold',  // SemiBold — matches original's bold look
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
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
});
