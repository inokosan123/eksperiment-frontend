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
  centered = false,
}: {
  title: string;
  kicker?: string;
  subtitle?: string;
  onClose: () => void;
  large?: boolean;
  // Task-sheet grammar: close on the left, serif title centered, a hairline
  // under the whole header. Kicker and subtitle are not rendered.
  centered?: boolean;
}) {
  if (centered) {
    return (
      <>
        <View style={s.centerHandle} />
        <View style={s.centerHeader}>
          <TouchableOpacity style={s.centerButton} onPress={onClose} hitSlop={8} activeOpacity={0.76}>
            <X s={20} c={C.textMuted} w={2.1} />
          </TouchableOpacity>
          <Text style={s.centerTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>{title}</Text>
          <View style={s.centerSpacer} />
        </View>
      </>
    );
  }
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
  centerHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#D6D3D1',
    marginTop: 12,
    marginBottom: 6,
  },
  centerHeader: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: -18,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EDE6',
  },
  centerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerSpacer: { width: 36 },
  centerTitle: {
    flexShrink: 1,
    fontFamily: F.serifMedium,
    fontSize: 20,
    color: C.text,
    textAlign: 'center',
  },
});
