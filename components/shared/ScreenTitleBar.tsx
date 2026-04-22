import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';

type Props = {
  title: string;
  showBack?: boolean;
};

export default function ScreenTitleBar({ title, showBack = false }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
      {showBack && (
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft s={22} c={C.textMuted} />
        </TouchableOpacity>
      )}
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: C.bg,
    paddingBottom: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    position: 'relative',
  },
  backBtn: {
    position: 'absolute',
    left: 18,
    bottom: 12,
  },
  title: {
    fontFamily: F.serifMedium,
    fontSize: 19,
    letterSpacing: 4,
    color: C.text,
  },
});
