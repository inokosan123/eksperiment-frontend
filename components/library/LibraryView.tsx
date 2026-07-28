import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import RibbonSectionCard from '@/components/shared/RibbonSectionCard';
import { LIBRARY_SECTION_CARDS } from '@/components/shared/sectionCardData';
import { C, F } from '@/constants/tokens';

export default function LibraryView() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenTitleBar title="LIBRARY" />
        <View style={s.quoteWrap}>
          <Text style={s.quote}>{'"Thy word is a lamp unto my feet, and a light unto my path."'}</Text>
          <Text style={s.ref}>PSALM 119:105</Text>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
          {LIBRARY_SECTION_CARDS.map(card => (
            <RibbonSectionCard
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
  quoteWrap: { paddingHorizontal: 26, paddingTop: 8, paddingBottom: 6, alignItems: 'center' },
  quote: { fontFamily: F.serifMediumItalic, fontSize: 17, color: C.textSecondary, lineHeight: 21.5, textAlign: 'center' },
  ref: { marginTop: 10, fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.4, color: C.gold },
});
