import { StyleSheet, Text, View } from 'react-native';
import { X } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';

export default function FocusSheetHeader({
  title,
  kicker,
  subtitle,
  onClose,
  large = false,
}: {
  title: string;
  kicker?: string;
  subtitle?: string;
  onClose: () => void;
  large?: boolean;
}) {
  return (
    <>
      <View style={s.handle} />
      <View style={[s.headerRow, large && s.headerRowLarge]}>
        <View style={s.copy}>
          {!!kicker && <Text style={[s.kicker, large && s.kickerLarge]} numberOfLines={1}>{kicker}</Text>}
          <Text style={[s.title, large && s.titleLarge]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.82}>{title}</Text>
        </View>
        <TouchableOpacity style={[s.closeButton, large && s.closeButtonLarge]} onPress={onClose} hitSlop={10} activeOpacity={0.76}>
          <X s={large ? 19 : 17} c={C.textMuted} w={2.2} />
        </TouchableOpacity>
      </View>
      {!!subtitle && <Text style={[s.subtitle, large && s.subtitleLarge]}>{subtitle}</Text>}
    </>
  );
}

const s = StyleSheet.create({
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E0DA',
    marginTop: 10,
  },
  headerRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerRowLarge: { marginTop: 17 },
  copy: { flex: 1, minWidth: 0 },
  kicker: {
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 2,
    color: C.gold,
  },
  kickerLarge: { fontSize: 10, letterSpacing: 2.3 },
  title: {
    marginTop: 3,
    fontFamily: F.serifMedium,
    fontSize: 25,
    lineHeight: 29,
    color: C.text,
  },
  titleLarge: { marginTop: 4, fontSize: 28, lineHeight: 32, letterSpacing: -0.2 },
  subtitle: {
    marginTop: 7,
    paddingRight: 8,
    fontFamily: F.serif,
    fontSize: 13,
    lineHeight: 18,
    color: C.textSecondary,
  },
  subtitleLarge: { marginTop: 8, fontSize: 14, lineHeight: 19, paddingRight: 14 },
  closeButton: {
    flexShrink: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0EFEA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonLarge: { width: 38, height: 38, borderRadius: 19 },
});
