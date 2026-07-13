import { StyleSheet, Text, View } from 'react-native';
import { X } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';

export default function FocusSheetHeader({
  title,
  kicker,
  subtitle,
  onClose,
}: {
  title: string;
  kicker?: string;
  subtitle?: string;
  onClose: () => void;
}) {
  return (
    <>
      <View style={s.handle} />
      <View style={s.headerRow}>
        <View style={s.copy}>
          {!!kicker && <Text style={s.kicker} numberOfLines={1}>{kicker}</Text>}
          <Text style={s.title} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.82}>{title}</Text>
        </View>
        <TouchableOpacity style={s.closeButton} onPress={onClose} hitSlop={10} activeOpacity={0.76}>
          <X s={17} c={C.textMuted} w={2.2} />
        </TouchableOpacity>
      </View>
      {!!subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
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
  copy: { flex: 1, minWidth: 0 },
  kicker: {
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 2,
    color: C.gold,
  },
  title: {
    marginTop: 3,
    fontFamily: F.serifMedium,
    fontSize: 25,
    lineHeight: 29,
    color: C.text,
  },
  subtitle: {
    marginTop: 7,
    paddingRight: 8,
    fontFamily: F.serif,
    fontSize: 13,
    lineHeight: 18,
    color: C.textSecondary,
  },
  closeButton: {
    flexShrink: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0EFEA',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
