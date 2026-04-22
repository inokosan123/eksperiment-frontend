import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import SectionCard from '@/components/shared/SectionCard';
import { Notebook, CheckSmall, Heart, Star, HourGlass } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';

const CARDS = [
  {
    label: 'DAILY REFLECTION', title: 'Journal',
    description: 'Capture your daily thoughts, spiritual struggles, and progress.',
    bg: '#F1F0ED', border: '#DFDDD7', labelColor: '#5b564f', titleColor: '#1c1917',
    bodyColor: '#5b564f', arrowBg: '#1c1917',
    decor: <Notebook s={60} c="#5b564f" w={1.3} />,
    route: '/journal',
  },
  {
    label: 'DAILY RHYTHM', title: 'Habits',
    description: 'Build consistent habits and track your daily progress.',
    bg: '#E4EFE4', border: '#CCDFCB', labelColor: '#4E7F52', titleColor: '#1F4F28',
    bodyColor: '#4E7F52', arrowBg: '#2B5B33',
    decor: <CheckSmall s={66} c="#4E7F52" w={1.6} />,
  },
  {
    label: 'SELF-CORRECTION', title: 'Notes',
    description: 'Short notes and advice to yourself for when you fall.',
    bg: '#FBF3DE', border: '#F0E3B8', labelColor: '#A9863F', titleColor: '#6D4F13',
    bodyColor: '#A9863F', arrowBg: '#8A5A1A',
    decor: <Notebook s={60} c="#A9863F" w={1.3} />,
  },
  {
    label: 'GIVE THANKS', title: 'Gratitude',
    description: 'A dedicated space to list blessings and God\'s daily mercy.',
    bg: '#FBE6E9', border: '#F5CDD3', labelColor: '#B54155', titleColor: '#7F1B2D',
    bodyColor: '#B54155', arrowBg: '#8C2636',
    decor: <Heart s={62} c="#B54155" w={1.3} />,
  },
  {
    label: 'LIFE DREAMS', title: 'Bucket List',
    description: 'Keep track of your life goals and celebrate achievements.',
    bg: '#FBF6E1', border: '#F0E7BA', labelColor: '#A78542', titleColor: '#6E4F14',
    bodyColor: '#A78542', arrowBg: '#8A5A1A',
    decor: <Star s={64} c="#A78542" w={1.3} />,
    route: '/bucket-list',
  },
  {
    label: 'STUDY TIMER', title: 'Focus Zone',
    description: 'Timer to help you focus deeply while reading or praying.',
    bg: '#E8EAF4', border: '#D2D5EA', labelColor: '#4E5394', titleColor: '#1F2464',
    bodyColor: '#4E5394', arrowBg: '#2D3478',
    decor: <HourGlass s={62} c="#4E5394" w={1.3} />,
  },
];

export default function InnerLifeView() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenTitleBar title="INNER LIFE" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Scripture quote — matches original Capacitor app */}
        <View style={s.quoteWrap}>
          <Text style={s.quote}>{"The Kingdom of God is within you."}</Text>
          <Text style={s.ref}>LUKE 17:21</Text>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
          {CARDS.map((card, i) => (
            <SectionCard
              key={i}
              {...card}
              onPress={card.route ? () => router.push(card.route as any) : undefined}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  quoteWrap: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 6, alignItems: 'center' },
  quote:     { fontFamily: F.serifMediumItalic, fontSize: 20, color: C.textSecondary, lineHeight: 30, textAlign: 'center' },
  ref:       { marginTop: 10, fontFamily: F.sansBold, fontSize: 13, letterSpacing: 2.4, color: C.gold },
});
