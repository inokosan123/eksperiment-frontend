import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CalendarCheck, ChevronRight } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';

type Variant = 'soft' | 'scripture';

type Props = {
  onPress: () => void;
  variant?: Variant;
  title?: string;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
};

export default function SetAsDailyTaskCard({
  onPress,
  variant = 'soft',
  title = 'Set as Daily Task',
  subtitle = 'Add to your daily routine',
  style,
}: Props) {
  const scripture = variant === 'scripture';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.84} style={style}>
      <LinearGradient
        colors={scripture ? ['#FFFDF8', '#FFF7EA'] : ['#FFFBF2', '#FFF8E7']}
        start={{ x: 0, y: scripture ? 0 : 0 }}
        end={{ x: scripture ? 0 : 1, y: 1 }}
        style={[s.base, scripture ? s.scriptureBase : s.softBase]}
      >
        <View style={[s.iconBase, scripture ? s.scriptureIconBase : s.softIconBase]}>
          <CalendarCheck s={scripture ? 13 : 16} c={C.gold} />
        </View>

        <View style={s.copy}>
          <Text style={[s.titleBase, scripture ? s.scriptureTitle : s.softTitle]}>{title}</Text>
          <Text style={[s.subtitleBase, scripture ? s.scriptureSubtitle : s.softSubtitle]} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>

        <ChevronRight s={scripture ? 14 : 15} c={scripture ? '#D1B37E' : 'rgba(197,160,89,0.4)'} />
      </LinearGradient>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  softBase: {
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(232,220,196,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  scriptureBase: {
    justifyContent: 'space-between',
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#E8D8BA',
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 1,
  },
  iconBase: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  softIconBase: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: 'rgba(197,160,89,0.1)',
  },
  scriptureIconBase: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E7D2A8',
    backgroundColor: '#FFF8E8',
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  titleBase: {
    color: '#374151',
  },
  softTitle: {
    fontFamily: F.sansSemiBold,
    fontSize: 11,
    lineHeight: 14,
  },
  scriptureTitle: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    lineHeight: 12,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: '#B08A47',
  },
  subtitleBase: {
    marginTop: 2,
    color: '#9CA3AF',
  },
  softSubtitle: {
    fontFamily: F.sans,
    fontSize: 9,
    lineHeight: 12,
  },
  scriptureSubtitle: {
    fontFamily: F.serif,
    fontSize: 12,
    lineHeight: 16,
  },
});
