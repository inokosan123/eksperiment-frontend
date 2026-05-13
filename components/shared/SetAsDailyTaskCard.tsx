import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CalendarCheck, ChevronRight } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';


type Variant = 'soft' | 'scripture';

type Props = {
  onPress: () => void;
  variant?: Variant;
  title?: string;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
  textMaxFontSizeMultiplier?: number;
};

export default function SetAsDailyTaskCard({
  onPress,
  variant = 'soft',
  title = 'Set as Daily Task',
  subtitle = 'Add to your daily routine',
  style,
  textMaxFontSizeMultiplier = 1.08,
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
          <CalendarCheck s={scripture ? 13 : 20} c={C.gold} />
        </View>

        <View style={s.copy}>
          <Text
            style={[s.titleBase, scripture ? s.scriptureTitle : s.softTitle]}
            allowFontScaling={false}
            maxFontSizeMultiplier={textMaxFontSizeMultiplier}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.82}
          >
            {title}
          </Text>
          <Text
            style={[s.subtitleBase, scripture ? s.scriptureSubtitle : s.softSubtitle]}
            allowFontScaling={false}
            numberOfLines={scripture ? 1 : 2}
            maxFontSizeMultiplier={textMaxFontSizeMultiplier}
            adjustsFontSizeToFit={scripture}
            minimumFontScale={0.82}
          >
            {subtitle}
          </Text>
        </View>

        <View style={s.chevronSlot}>
          <ChevronRight s={scripture ? 14 : 15} c={scripture ? '#D1B37E' : 'rgba(197,160,89,0.4)'} />
        </View>
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
    gap: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(232,220,196,0.7)',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  scriptureBase: {
    minHeight: 58,
    gap: 10,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#E8D8BA',
    paddingHorizontal: 13,
    paddingVertical: 11,
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
    width: 42,
    height: 42,
    borderRadius: 14,
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
    paddingRight: 2,
  },
  chevronSlot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  titleBase: {
    color: '#374151',
  },
  softTitle: {
    fontFamily: F.sansSemiBold,
    fontSize: 14,
    lineHeight: 18,
  },
  scriptureTitle: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    lineHeight: 13,
    letterSpacing: 1.65,
    textTransform: 'uppercase',
    color: '#B08A47',
  },
  subtitleBase: {
    marginTop: 2,
    color: '#9CA3AF',
  },
  softSubtitle: {
    fontFamily: F.sans,
    fontSize: 12,
    lineHeight: 16,
  },
  scriptureSubtitle: {
    fontFamily: F.serif,
    fontSize: 11.5,
    lineHeight: 15,
  },
});
