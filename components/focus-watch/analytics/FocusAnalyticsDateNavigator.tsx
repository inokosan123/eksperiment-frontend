import { StyleSheet, Text, View } from 'react-native';
import { ChevronRight, RotateCcw } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';

export default function FocusAnalyticsDateNavigator({
  label,
  accessibilityLabel,
  canMoveForward,
  onPrevious,
  onNext,
  onToday,
  onRefresh,
  isCurrent,
}: {
  label: string;
  accessibilityLabel: string;
  canMoveForward: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onRefresh: () => void;
  isCurrent: boolean;
}) {
  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={styles.button}
        onPress={onPrevious}
        accessibilityLabel="Previous period"
        hitSlop={5}
        haptic="selection"
      >
        <View style={styles.back}>
          <ChevronRight s={18} c={C.textSecondary} w={2.15} />
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.labelButton}
        onPress={onToday}
        disabled={isCurrent}
        accessibilityLabel={`${accessibilityLabel}. ${isCurrent ? 'Current period' : 'Go to current period'}`}
        haptic="selection"
      >
        <Text
          numberOfLines={2}
          style={styles.label}
        >
          {label}
        </Text>
        <Text style={[styles.meta, isCurrent && styles.metaCurrent]}>
          {isCurrent ? 'CURRENT PERIOD' : 'TAP TO RETURN TO NOW'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, !canMoveForward && styles.disabled]}
        onPress={onNext}
        disabled={!canMoveForward}
        accessibilityLabel="Next period"
        hitSlop={5}
        haptic="selection"
      >
        <ChevronRight s={18} c={canMoveForward ? C.textSecondary : C.textMuted} w={2.15} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={onRefresh}
        accessibilityLabel="Retry current report"
        hitSlop={5}
        haptic="selection"
      >
        <RotateCcw s={16} c={C.goldDark} w={2} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 62,
    marginHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E7E1D6',
  },
  button: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  back: { transform: [{ rotate: '180deg' }] },
  labelButton: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  label: {
    maxWidth: '100%',
    fontFamily: F.serifMedium,
    fontSize: 18,
    lineHeight: 22,
    color: C.text,
    textAlign: 'center',
    flexShrink: 1,
  },
  meta: {
    marginTop: 2,
    fontFamily: F.sansBold,
    fontSize: 7.5,
    letterSpacing: 1.2,
    color: C.goldDark,
  },
  metaCurrent: {
    color: C.textMuted,
  },
});
