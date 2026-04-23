import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import SectionCard from '@/components/shared/SectionCard';
import { LIBRARY_SECTION_CARDS } from '@/components/shared/sectionCardData';
import { C, F } from '@/constants/tokens';

export default function LibraryView() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenTitleBar title="LIBRARY" />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.quoteWrap}>
          <Text style={s.quote}>{'"Thy word is a lamp unto my feet, and a light unto my path."'}</Text>
          <Text style={s.ref}>PSALM 119:105</Text>
        </View>

        <View style={{ paddingTop: 14 }}>
          {LIBRARY_SECTION_CARDS.map(card => (
            <SectionCard
              key={card.id}
              {...card}
              onPress={() => router.push(card.route as any)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  quoteWrap: { paddingHorizontal: 26, paddingTop: 18, paddingBottom: 4, alignItems: 'center' },
  quote: { fontFamily: F.serifMediumItalic, fontSize: 14, color: C.textSecondary, lineHeight: 21, textAlign: 'center' },
  ref: { marginTop: 8, fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.4, color: C.gold },
});
