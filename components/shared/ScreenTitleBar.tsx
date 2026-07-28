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
  variant?: 'primary' | 'secondary';
  titleSize?: number;
  titleLetterSpacing?: number;
  subtitle?: string;
  onBackOverride?: () => void;
  compactBottom?: boolean;
  sideWidth?: number;
  horizontalBleed?: number;
  backButtonProps?: {
    ref?: React.Ref<any>;
    onLayout?: (event: any) => void;
  };
};

export default function ScreenTitleBar({
  title,
  showBack = false,
  rightElement,
  bg,
  variant,
  titleSize,
  titleLetterSpacing,
  subtitle,
  onBackOverride,
  compactBottom,
  sideWidth,
  horizontalBleed = 0,
  backButtonProps,
}: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const resolvedVariant = variant ?? (showBack ? 'secondary' : 'primary');
  const isSecondary = resolvedVariant === 'secondary';

  const topPad = isSecondary
    ? insets.top > 0 ? insets.top + 3 : 8
    : getTitleBarTopPadding(insets.top);
  const bottomPad = compactBottom
    ? 4
    : isSecondary ? 6 : TITLE_BAR_BOTTOM_PADDING;
  const resolvedTitleSize = titleSize ?? (isSecondary ? 21 : 24);
  const resolvedLetterSpacing = titleLetterSpacing ?? (isSecondary ? 1.55 : 3.1);
  const resolvedLineHeight = Math.round(resolvedTitleSize + (isSecondary ? 4 : 6));
  const defaultSideWidth = isSecondary ? 48 : 44;
  const resolvedSideWidth = sideWidth ?? defaultSideWidth;
  const wideSides = resolvedSideWidth > defaultSideWidth;

  return (
    <View style={[styles.wrap, { paddingTop: topPad, paddingBottom: bottomPad, backgroundColor: bg ?? C.bg, marginHorizontal: -horizontalBleed }]}>
      <View style={[styles.side, wideSides && styles.sideLeftWide, { width: resolvedSideWidth }]}>
        {showBack && (
          <TouchableOpacity
            {...backButtonProps}
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
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={isSecondary ? 0.78 : 0.88}
          style={[
            styles.title,
            isSecondary && styles.titleSecondary,
            {
              fontSize: resolvedTitleSize,
              lineHeight: resolvedLineHeight,
              letterSpacing: resolvedLetterSpacing,
              transform: isSecondary ? [{ translateY: -1 }] : undefined,
            },
          ]}
        >
          {title}
        </Text>
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>

      <View style={[styles.side, wideSides && styles.sideRightWide, { width: resolvedSideWidth }]}>
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
  sideLeftWide: {
    alignItems: 'flex-start',
  },
  sideRightWide: {
    alignItems: 'flex-end',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  title: {
    fontFamily: F.serifMedium,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: 3.1,
    color: C.text,
    textAlign: 'center',
  },
  titleSecondary: {
    maxWidth: '100%',
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
