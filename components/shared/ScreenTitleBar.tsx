import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ArrowLeft } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import { getTitleBarTopPadding, TITLE_BAR_BOTTOM_PADDING } from './titleBar';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';


type Props = {
  title: string;
  showBack?: boolean;
  rightElement?: React.ReactNode;
  bg?: string;
  titleSize?: number;
  subtitle?: string;
  onBackOverride?: () => void;
  compactBottom?: boolean;
};

export default function ScreenTitleBar({ title, showBack = false, rightElement, bg, titleSize, subtitle, onBackOverride, compactBottom }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const topPad = getTitleBarTopPadding(insets.top);
  const bottomPad = compactBottom ? 4 : TITLE_BAR_BOTTOM_PADDING;

  return (
    <View style={[styles.wrap, { paddingTop: topPad, paddingBottom: bottomPad, backgroundColor: bg ?? C.bg }]}>
      <View style={styles.side}>
        {showBack && (
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (onBackOverride) onBackOverride();
              else router.back();
            }}
            style={styles.backBtn}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <ArrowLeft s={26} c={C.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.titleWrap}>
        <Text style={[styles.title, titleSize ? { fontSize: titleSize } : null]}>{title}</Text>
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>

      <View style={styles.side}>
        {rightElement}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: TITLE_BAR_BOTTOM_PADDING,
    paddingHorizontal: 18,
  },
  side: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontFamily: F.serifMedium,
    fontSize: 24,
    letterSpacing: 3.1,
    color: C.text,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 2,
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 2.2,
    color: C.gold,
    textTransform: 'uppercase',
  },
});
