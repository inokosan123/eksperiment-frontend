import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ArrowLeft } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';

type Props = {
  title: string;
  showBack?: boolean;
  rightElement?: React.ReactNode;
  bg?: string;
};

export default function ScreenTitleBar({ title, showBack = false, rightElement, bg }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // On web insets.top = 0 — ensure minimum breathing room from top
  const topPad = Math.max(insets.top, Platform.OS === 'web' ? 20 : insets.top) + 14;

  return (
    <View style={[styles.wrap, { paddingTop: topPad, backgroundColor: bg ?? C.bg }]}>
      {/* Left — back button or spacer */}
      <View style={styles.side}>
        {showBack && (
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
            style={styles.backBtn}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <ArrowLeft s={26} c={C.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Center — title */}
      <Text style={styles.title}>{title}</Text>

      {/* Right — optional element or spacer */}
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
    paddingBottom: 14,
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
  title: {
    flex: 1,
    fontFamily: F.serifMedium,
    fontSize: 22,
    letterSpacing: 4,
    color: C.text,
    textAlign: 'center',
  },
});
