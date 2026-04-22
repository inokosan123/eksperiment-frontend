import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import SectionCard from '@/components/shared/SectionCard';
import { Cross, OpenBook, Star, Notebook, Book } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';

const CARDS = [
  {
    label: 'RULE OF PRAYER', title: 'Prayer Book',
    description: 'Daily morning, evening, and mealtime prayers to guide your rhythm of life.',
    bg: '#EEEAF5', border: '#DDD5ED', labelColor: '#6D5AAE', titleColor: '#3B2F76',
    bodyColor: '#6D5AAE', arrowBg: '#2E2478',
    decor: <Cross s={64} c="#6D5AAE" w={1.3} />,
    route: '/prayer',
  },
  {
    label: 'BIBLE & PSALMS', title: 'Holy Scripture',
    description: 'The divinely inspired Word of God, including the Psalms of David.',
    bg: '#FBE6E9', border: '#F5CDD3', labelColor: '#B54155', titleColor: '#7F1B2D',
    bodyColor: '#B54155', arrowBg: '#8C2636',
    decor: <OpenBook s={64} c="#B54155" w={1.3} />,
  },
  {
    label: 'HIGHLIGHTS & NOTES', title: 'My Favorites',
    description: 'Your saved verses, highlights, and personal reflections from Scripture.',
    bg: '#FBF3DE', border: '#F0E3B8', labelColor: '#A9863F', titleColor: '#6D4F13',
    bodyColor: '#A9863F', arrowBg: '#8A5A1A',
    decor: <Star s={64} c="#A9863F" w={1.3} />,
  },
  {
    label: 'STUDY REFLECTIONS', title: 'Bible Notes',
    description: 'Your chapter notes — observations, lessons learned, and personal application.',
    bg: '#EFEEEB', border: '#DEDCD6', labelColor: '#5b564f', titleColor: '#1c1917',
    bodyColor: '#5b564f', arrowBg: '#1c1917',
    decor: <Notebook s={60} c="#5b564f" w={1.3} />,
  },
  {
    label: 'PERSONAL LIBRARY', title: 'Reading List',
    description: 'Track the books you\'re reading, set reading goals, and keep notes.',
    bg: '#E6EEE7', border: '#CFE0D1', labelColor: '#4B8152', titleColor: '#1E4E27',
    bodyColor: '#4B8152', arrowBg: '#2C6A36',
    decor: <Book s={60} c="#4B8152" w={1.3} />,
  },
];

export default function LibraryView() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenTitleBar title="LIBRARY" />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.quoteWrap}>
          <Text style={s.quote}>"Thy word is a lamp unto my feet, and a light unto my path."</Text>
          <Text style={s.ref}>PSALM 119:105</Text>
        </View>

        <View style={{ paddingTop: 14 }}>
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
  quote: { fontFamily: F.serifMediumItalic, fontSize: 20, color: C.textSecondary, lineHeight: 30, textAlign: 'center' },
  ref: { marginTop: 10, fontFamily: F.sansBold, fontSize: 13, letterSpacing: 2.4, color: C.gold },
});
